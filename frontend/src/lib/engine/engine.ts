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
};

const MONO_VOICE = 'mono';

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
	private lfoOsc: OscillatorNode | null = null;
	private lfoGain: GainNode | null = null;
	private lfoRate = 0.4;
	private lfoDepth = 0;
	private lfoTarget: LfoTarget = 'off';

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
			this.master = this.ctx.createDynamicsCompressor();
			this.master.connect(this.ctx.destination);
			this.analyserNode = this.ctx.createAnalyser();
			this.analyserNode.fftSize = 2048;
			this.master.connect(this.analyserNode);
			// one global LFO, always running; voices tap lfoGain when routed
			this.lfoOsc = this.ctx.createOscillator();
			this.lfoGain = this.ctx.createGain();
			this.lfoOsc.connect(this.lfoGain);
			this.lfoOsc.start();
			this.applyLfo();
			// Safari parks the context as suspended/"interrupted" across system
			// sleep and tab switches and doesn't always wake it on its own —
			// kick it whenever the page becomes visible again.
			document.addEventListener('visibilitychange', () => {
				if (!document.hidden && this.ctx && this.ctx.state !== 'running') {
					void this.ctx.resume();
				}
			});
		}
		if (this.ctx.state !== 'running') void this.ctx.resume();
		return this.ctx;
	}

	noteOn(note: Note, params: SynthParams): void {
		const ctx = this.ensure();
		const now = ctx.currentTime;
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
		const voice = new Voice(ctx, this.master!, freq, params, when, velocity, this.lfoRoute());
		if (this.bendCents !== 0) voice.bend(this.bendCents, when);
		return voice;
	}

	private lfoRoute(): LfoRoute | null {
		return this.lfoTarget !== 'off' && this.lfoGain
			? { node: this.lfoGain, target: this.lfoTarget }
			: null;
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

	noteOff(note: Note, params: SynthParams): void {
		if (!this.ctx) return;
		const id = params.poly ? note : MONO_VOICE;
		this.voices.get(id)?.stop(this.ctx.currentTime);
		this.voices.delete(id);
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
		void this.ctx?.close();
		this.ctx = null;
		this.master = null;
		this.analyserNode = null;
		this.lfoOsc = null;
		this.lfoGain = null;
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
