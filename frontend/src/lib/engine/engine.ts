import { frequency, type Note } from './notes.ts';
import { type LfoRoute, Voice, type VoiceParams } from './voice.ts';

export type LfoTarget = 'off' | 'pitch' | 'filter';

export type SynthParams = VoiceParams & {
	poly: boolean;
	/** mono only: portamento time in seconds */
	glide: number;
	/** LFO rate 0..1, mapped exponentially to 0.1..20 Hz */
	lfoRate: number;
	/** LFO depth 0..1 */
	lfoDepth: number;
	lfoTarget: LfoTarget;
	/** lo-fi mode: tape wobble + bitcrush + bandwidth cut + hiss */
	lofi: boolean;
};

const MONO_VOICE = 'mono';
const PAD_VOICE = '~pad';

// The shared audio graph: voices → compressor → destination, with an analyser
// tap for the oscilloscope. The AudioContext is created lazily on the first
// note (browsers require a user gesture before audio can start).
export class SynthEngine {
	private ctx: AudioContext | null = null;
	private master: DynamicsCompressorNode | null = null;
	private analyserNode: AnalyserNode | null = null;
	private voices = new Map<Note, Voice>();
	private scheduled = new Set<Voice>();
	private bendCents = 0;
	private channel: BroadcastChannel | null = null;
	private out: GainNode | null = null;
	private mediaOut: HTMLAudioElement | null = null;
	private lfoOsc: OscillatorNode | null = null;
	private lfoGain: GainNode | null = null;
	private lfoRate = 0.4;
	private lfoDepth = 0;
	private lfoTarget: LfoTarget = 'off';
	private lofiNodes: {
		wobble: GainNode;
		dry: GainNode;
		wet: GainNode;
		hiss: GainNode;
		drop: GainNode;
	} | null = null;
	private dropTimer: ReturnType<typeof setTimeout> | null = null;
	private lofiOn = false;
	private bornAt = 0;

	/** Fired when another tab claims the audio output (we release ours). */
	onReleased: (() => void) | null = null;

	get analyser(): AnalyserNode | null {
		return this.analyserNode;
	}

	get currentTime(): number {
		return this.ctx?.currentTime ?? 0;
	}

	ensure(): AudioContext {
		if (!this.ctx) {
			// One tab owns the speakers: Safari only routes output for a single
			// Web Audio context across tabs (the loser still renders — analyser
			// moves, no sound). Claim on create; other tabs release their context
			// and re-claim on their next user gesture.
			this.channel = new BroadcastChannel('supersaw-audio');
			this.channel.postMessage('claim');
			this.channel.onmessage = (e) => {
				if (e.data === 'claim') this.release();
			};
			this.ctx = new AudioContext();
			this.bornAt = performance.now();
			this.master = this.ctx.createDynamicsCompressor();
			// no direct master→destination wiring: buildLofi owns the output legs
			// (dry gain + lofi wet chain), crossfaded into the final `out` node
			this.analyserNode = this.ctx.createAnalyser();
			this.analyserNode.fftSize = 2048;
			this.master.connect(this.analyserNode);
			// Final output. iOS mutes Web Audio's direct output under the
			// ring/silent switch, but HTML5 media is exempt — so on iOS the whole
			// mix routes through an <audio> element (MediaStreamDestination)
			// instead of ctx.destination. (The old silent-loop "category flip"
			// hack stopped working on recent iOS.) We're inside the first user
			// gesture here, so play() is permitted.
			this.out = this.ctx.createGain();
			const ios =
				/iP(hone|ad|od)/.test(navigator.userAgent) ||
				(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
			if (ios) {
				const mediaDest = this.ctx.createMediaStreamDestination();
				this.out.connect(mediaDest);
				const el = document.createElement('audio');
				el.srcObject = mediaDest.stream;
				el.setAttribute('playsinline', '');
				void el.play().catch(() => {});
				this.mediaOut = el;
			} else {
				this.out.connect(this.ctx.destination);
			}
			// one global LFO, always running; voices tap lfoGain when routed
			this.lfoOsc = this.ctx.createOscillator();
			this.lfoGain = this.ctx.createGain();
			this.lfoOsc.connect(this.lfoGain);
			this.lfoOsc.start();
			this.applyLfo();
			this.buildLofi(this.ctx, this.master);
			// Safari parks the context as suspended/"interrupted" across system
			// sleep and tab switches and doesn't always wake it on its own —
			// kick context + media element whenever the page becomes visible.
			document.addEventListener('visibilitychange', () => {
				if (!document.hidden && this.ctx) {
					if (this.ctx.state !== 'running') void this.ctx.resume();
					if (this.mediaOut?.paused) void this.mediaOut.play().catch(() => {});
				}
			});
		}
		if (this.ctx.state !== 'running') void this.ctx.resume();
		return this.ctx;
	}

	/**
	 * Cold-start pad: notes triggered in the same gesture that builds the
	 * context (+ the iOS media-element output) would sound while the path is
	 * still opening and get eaten — delay them just past the warm-up.
	 */
	private startDelay(): number {
		return performance.now() - this.bornAt < 400 ? 0.12 : 0;
	}

	noteOn(note: Note, params: SynthParams): void {
		const ctx = this.ensure();
		const now = ctx.currentTime + this.startDelay();
		const freq = frequency(note);

		if (!params.poly) {
			const mono = this.voices.get(MONO_VOICE);
			if (mono) {
				// mono retrigger = glide, no new envelope (the original behavior)
				mono.setFrequency(freq, params.glide, now);
				return;
			}
			this.voices.set(MONO_VOICE, this.createVoice(ctx, freq, params, now));
			return;
		}

		this.voices.get(note)?.stop(now);
		this.voices.set(note, this.createVoice(ctx, freq, params, now));
	}

	private createVoice(
		ctx: AudioContext,
		freq: number,
		params: VoiceParams,
		when: number,
		velocity = 1
	): Voice {
		const voice = new Voice(ctx, this.master!, freq, params, when, velocity, this.modRoutes());
		if (this.bendCents !== 0) voice.bend(this.bendCents, when);
		return voice;
	}

	private modRoutes(): LfoRoute[] {
		const mods: LfoRoute[] = [];
		if (this.lfoTarget !== 'off' && this.lfoGain) {
			mods.push({ node: this.lfoGain, target: this.lfoTarget });
		}
		// lofi wobble bus is always wired (its gain is the switch)
		if (this.lofiNodes) mods.push({ node: this.lofiNodes.wobble, target: 'pitch' });
		return mods;
	}

	// --- theremin pad: continuous voices with direct frequency control,
	//     one per touch (keyed by pointerId for multitouch) ---

	padOn(id: number, freq: number, params: VoiceParams): void {
		const ctx = this.ensure();
		const now = ctx.currentTime + this.startDelay();
		const key = `${PAD_VOICE}:${id}`;
		this.voices.get(key)?.stop(now);
		this.voices.set(key, this.createVoice(ctx, freq, params, now));
	}

	padGlide(id: number, freq: number): void {
		if (!this.ctx) return;
		this.voices.get(`${PAD_VOICE}:${id}`)?.setFrequency(freq, 0.04, this.ctx.currentTime);
	}

	padFilter(id: number, cutoff: number, resonance: number, sustain: number): void {
		if (!this.ctx) return;
		this.voices
			.get(`${PAD_VOICE}:${id}`)
			?.setFilter(cutoff, resonance, 0, sustain, this.ctx.currentTime);
	}

	padOff(id: number): void {
		if (!this.ctx) return;
		const key = `${PAD_VOICE}:${id}`;
		this.voices.get(key)?.stop(this.ctx.currentTime);
		this.voices.delete(key);
	}

	/**
	 * Lo-fi section: tape wow+flutter on every voice's pitch, plus a master
	 * wet path (bitcrush → bandwidth cut → chorus → plate reverb) crossfaded
	 * against the dry signal, a hiss bed, and occasional VHS dropouts.
	 * All gains are the switch — routing never changes.
	 */
	private buildLofi(ctx: AudioContext, master: DynamicsCompressorNode): void {
		// pitch wobble: wow (slow, deep) + flutter (fast, shallow) → cents bus
		const wow = ctx.createOscillator();
		wow.frequency.value = 0.6;
		const wowDepth = ctx.createGain();
		wowDepth.gain.value = 9;
		const flutter = ctx.createOscillator();
		flutter.frequency.value = 6.3;
		const flutterDepth = ctx.createGain();
		flutterDepth.gain.value = 2.5;
		const wobble = ctx.createGain();
		wobble.gain.value = 0;
		wow.connect(wowDepth).connect(wobble);
		flutter.connect(flutterDepth).connect(wobble);
		wow.start();
		flutter.start();

		// master wet path: bitcrush (stepped waveshaper) → narrow bandwidth
		const crusher = ctx.createWaveShaper();
		const steps = 28;
		const curve = new Float32Array(8192);
		for (let i = 0; i < curve.length; i++) {
			const x = (i * 2) / curve.length - 1;
			curve[i] = Math.round(x * steps) / steps;
		}
		crusher.curve = curve;
		const highcut = ctx.createBiquadFilter();
		highcut.type = 'lowpass';
		highcut.frequency.value = 3400;
		const lowcut = ctx.createBiquadFilter();
		lowcut.type = 'highpass';
		lowcut.frequency.value = 120;
		// chorus — the Juno move: a ~20ms delay wobbled by a slow LFO, summed
		// with the straight signal
		const chorusDelay = ctx.createDelay(0.06);
		chorusDelay.delayTime.value = 0.02;
		const chorusLfo = ctx.createOscillator();
		chorusLfo.frequency.value = 0.7;
		const chorusDepth = ctx.createGain();
		chorusDepth.gain.value = 0.006;
		chorusLfo.connect(chorusDepth).connect(chorusDelay.delayTime);
		chorusLfo.start();
		const chorusLevel = ctx.createGain();
		chorusLevel.gain.value = 0.7;
		const chorusSum = ctx.createGain();

		// plate reverb — code-generated impulse: 1.2s of exponentially decaying
		// noise, parallel send under the chorused signal
		const irSeconds = 1.2;
		const ir = ctx.createBuffer(2, ctx.sampleRate * irSeconds, ctx.sampleRate);
		for (let ch = 0; ch < 2; ch++) {
			const buf = ir.getChannelData(ch);
			for (let i = 0; i < buf.length; i++) {
				buf[i] = (Math.random() * 2 - 1) * Math.exp((-4 * i) / buf.length);
			}
		}
		const plate = ctx.createConvolver();
		plate.buffer = ir;
		const plateLevel = ctx.createGain();
		plateLevel.gain.value = 0.3;

		// VHS dropout gate, normally fully open
		const drop = ctx.createGain();
		drop.gain.value = 1;

		const wet = ctx.createGain();
		wet.gain.value = 0;
		master.connect(crusher);
		crusher.connect(highcut);
		highcut.connect(lowcut);
		lowcut.connect(chorusSum);
		lowcut.connect(chorusDelay).connect(chorusLevel).connect(chorusSum);
		chorusSum.connect(drop);
		chorusSum.connect(plate).connect(plateLevel).connect(drop);
		drop.connect(wet);
		wet.connect(this.out!);
		// dry leg is the normal output path; ducks to 0 when the wet path is in
		const dry = ctx.createGain();
		dry.gain.value = 1;
		master.connect(dry);
		dry.connect(this.out!);

		// tape hiss bed: looped filtered noise, silent until switched in
		const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
		const samples = noiseBuffer.getChannelData(0);
		for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
		const noise = ctx.createBufferSource();
		noise.buffer = noiseBuffer;
		noise.loop = true;
		const hissFilter = ctx.createBiquadFilter();
		hissFilter.type = 'lowpass';
		hissFilter.frequency.value = 3000;
		const hiss = ctx.createGain();
		hiss.gain.value = 0;
		noise.connect(hissFilter).connect(hiss);
		hiss.connect(this.out!);
		noise.start();

		this.lofiNodes = { wobble, dry, wet, hiss, drop };
		this.applyLofi();
	}

	setLofi(on: boolean): void {
		this.lofiOn = on;
		this.applyLofi();
	}

	private applyLofi(): void {
		if (!this.ctx || !this.lofiNodes) return;
		const now = this.ctx.currentTime;
		const { wobble, dry, wet, hiss, drop } = this.lofiNodes;
		wobble.gain.setTargetAtTime(this.lofiOn ? 1 : 0, now, 0.1);
		dry.gain.setTargetAtTime(this.lofiOn ? 0 : 1, now, 0.05);
		wet.gain.setTargetAtTime(this.lofiOn ? 1 : 0, now, 0.05);
		hiss.gain.setTargetAtTime(this.lofiOn ? 0.0025 : 0, now, 0.1);
		if (this.lofiOn && !this.dropTimer) this.scheduleDropout();
		if (!this.lofiOn && this.dropTimer) {
			clearTimeout(this.dropTimer);
			this.dropTimer = null;
			drop.gain.setTargetAtTime(1, now, 0.05);
		}
	}

	// VHS dropout: every 8-15s the wet signal briefly dips and the pitch
	// wobble spikes, like a worn spot rolling past the head
	private scheduleDropout(): void {
		this.dropTimer = setTimeout(
			() => {
				if (!this.ctx || !this.lofiNodes || !this.lofiOn) {
					this.dropTimer = null;
					return;
				}
				const now = this.ctx.currentTime;
				const { drop, wobble } = this.lofiNodes;
				drop.gain.setTargetAtTime(0.3, now, 0.02);
				drop.gain.setTargetAtTime(1, now + 0.12, 0.06);
				wobble.gain.setTargetAtTime(2.6, now, 0.02);
				wobble.gain.setTargetAtTime(1, now + 0.15, 0.08);
				this.scheduleDropout();
			},
			8000 + Math.random() * 7000
		);
	}

	/**
	 * Route/shape the global LFO. Already-sounding voices keep their previous
	 * routing until they end; rate and depth changes are live for everyone.
	 */
	setLfo(rate: number, depth: number, target: LfoTarget): void {
		this.lfoRate = rate;
		this.lfoDepth = depth;
		this.lfoTarget = target;
		this.applyLfo();
	}

	private applyLfo(): void {
		if (!this.lfoOsc || !this.lfoGain) return;
		this.lfoOsc.frequency.value = 0.1 * 200 ** this.lfoRate;
		// pitch target = cents on osc.detune, filter target = Hz on cutoff
		this.lfoGain.gain.value =
			this.lfoTarget === 'pitch'
				? this.lfoDepth * 600
				: this.lfoTarget === 'filter'
					? this.lfoDepth * 3000
					: 0;
	}

	/**
	 * Live filter knobs: retarget held voices (keyboard/mono). Scheduled
	 * sequencer one-shots are left alone — cancelling their future envelope
	 * ramps would wreck them, and each step reads fresh params anyway.
	 */
	setFilter(cutoff: number, resonance: number, filterEnv: number, sustain: number): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		for (const voice of this.voices.values()) {
			voice.setFilter(cutoff, resonance, filterEnv, sustain, now);
		}
	}

	/** Pitch wheel: bend every sounding and future voice by ±semitones. */
	setPitchBend(semitones: number): void {
		this.bendCents = semitones * 100;
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		for (const voice of this.voices.values()) voice.bend(this.bendCents, now);
		for (const voice of this.scheduled) voice.bend(this.bendCents, now);
	}

	noteOff(note: Note, _params: SynthParams): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		// Stop whichever voice actually rings, regardless of the CURRENT poly
		// flag — toggling poly mid-hold otherwise releases the wrong id and the
		// voice rings forever. The keyboard only calls noteOff for the mono
		// voice when the last key lifts, so the fallback is safe.
		const direct = this.voices.get(note);
		if (direct) {
			direct.stop(now);
			this.voices.delete(note);
			return;
		}
		const mono = this.voices.get(MONO_VOICE);
		if (mono) {
			mono.stop(now);
			this.voices.delete(MONO_VOICE);
		}
	}

	/** Schedule a one-shot note (sequencer): starts at `when`, releases after `duration`. */
	play(note: Note, params: VoiceParams, when: number, duration: number, velocity = 1): void {
		const ctx = this.ensure();
		const voice = this.createVoice(ctx, frequency(note), params, when, velocity);
		voice.stop(when + duration);
		this.scheduled.add(voice);
		// Voices disconnect themselves onended; this set only exists for stopAll.
		setTimeout(
			() => this.scheduled.delete(voice),
			(when + duration + params.release - ctx.currentTime + 1) * 1000
		);
	}

	/** Another tab took the output: tear down so our next gesture re-claims. */
	private release(): void {
		this.onReleased?.();
		this.stopAll();
		this.channel?.close();
		this.channel = null;
		this.mediaOut?.pause();
		this.mediaOut = null;
		this.out = null;
		void this.ctx?.close();
		this.ctx = null;
		this.master = null;
		this.analyserNode = null;
		this.lfoOsc = null;
		this.lfoGain = null;
		this.lofiNodes = null;
		if (this.dropTimer) clearTimeout(this.dropTimer);
		this.dropTimer = null;
	}

	stopAll(): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		for (const voice of this.voices.values()) voice.stop(now);
		this.voices.clear();
		for (const voice of this.scheduled) voice.stop(now);
		this.scheduled.clear();
	}
}

export const engine = new SynthEngine();

// Vite HMR replaces this module but the old AudioContext (and any ringing
// voices) would survive it — the classic dev-mode stuck note. Kill everything
// on dispose; the next gesture rebuilds.
if (import.meta.hot) {
	import.meta.hot.dispose(() => engine.stopAll());
}
