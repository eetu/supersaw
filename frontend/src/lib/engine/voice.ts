import { detuneRatios, makeDistortionCurve, mixLevels, valueAtTime } from './curves.ts';

export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'supersaw' | 'organ';

export type VoiceParams = {
	wave: Waveform;
	attack: number;
	decay: number;
	sustain: number;
	release: number;
	distortion: number;
	/** supersaw only, 0..1 */
	detune: number;
	/** supersaw only, 0..1 */
	mix: number;
	/** supersaw only, 0..1 — stereo width of the 7 saws */
	spread: number;
	/** lowpass cutoff 0..1, mapped exponentially to 20 Hz..16 kHz */
	cutoff: number;
	/** filter resonance 0..1 (Q 0.7..17.7) */
	resonance: number;
	/** filter envelope amount 0..1 — sweeps cutoff up to +4 octaves via ADSR */
	filterEnv: number;
};

export type LfoRoute = { node: AudioNode; target: 'pitch' | 'filter' };

export function cutoffHz(x: number): number {
	return 20 * 800 ** x;
}

// pan positions per saw, scaled by the spread param (centre osc stays centre)
const PAN_POSITIONS = [-1, -0.7, -0.35, 0, 0.35, 0.7, 1];

// --- Hammond ---------------------------------------------------------------
// Tonewheels are near-sines, so a PeriodicWave of sine partials IS the
// instrument. Drawbar pitches include the 16' sub-octave (0.5×) and the
// 5 1/3' quint (1.5×) — non-integer harmonics a PeriodicWave can't hold — so
// the wave is built at HALF the played note and every drawbar lands on an
// integer bin (ratio × 2). The oscillator then runs at freq/2 (ORGAN_RATIO).
//
// Registration: 888800000-ish, the Green Onions / blues shout setting, with a
// whisper of 1' on top. Drawbar steps are ~3 dB each.
const DRAWBAR_BINS = [1, 2, 3, 4, 6, 8, 10, 12, 16]; // 16' 8' 5⅓' 4' 2⅔' 2' 1⅗' 1⅓' 1' at half-pitch
const DRAWBAR_SETTING = [8, 8, 8, 8, 0, 0, 0, 0, 2];
export const ORGAN_RATIO = 0.5;

const organWaves = new WeakMap<AudioContext, PeriodicWave>();

function getOrganWave(ctx: AudioContext): PeriodicWave {
	let wave = organWaves.get(ctx);
	if (!wave) {
		const size = Math.max(...DRAWBAR_BINS) + 1;
		const real = new Float32Array(size);
		const imag = new Float32Array(size);
		DRAWBAR_BINS.forEach((bin, i) => {
			const drawbar = DRAWBAR_SETTING[i];
			if (drawbar > 0) imag[bin] = 10 ** ((-3 * (8 - drawbar)) / 20);
		});
		wave = ctx.createPeriodicWave(real, imag);
		organWaves.set(ctx, wave);
	}
	return wave;
}
// ---------------------------------------------------------------------------

type OscUnit = {
	osc: OscillatorNode;
	envelope: GainNode;
	/** frequency ratio vs the voice's base frequency (detuned saws; organ runs at 0.5) */
	ratio: number;
};

type Glide = { startTime: number; from: number; to: number; duration: number };

// One sounding note: oscillator(s) → waveshaper → ADSR gain → level gain → destination.
// "supersaw" = 7 detuned sawtooths through a shared fundamental-tracking highpass
// (Szabó 2010, see curves.ts). "organ" = a Hammond drawbar PeriodicWave (above).
export class Voice {
	private units: OscUnit[] = [];
	private freq: number;
	private glide: Glide | null = null;
	private readonly startTime: number;
	private readonly attack: number;
	private readonly decay: number;
	private readonly sustain: number;
	private readonly release: number;

	private endedUnits = 0;
	private stopped = false;
	private dead = false;
	private readonly filter: BiquadFilterNode;
	private highpass: BiquadFilterNode | null = null;
	private readonly mods: LfoRoute[];

	/** true once release (or kill) has been scheduled — steal these first */
	releasing = false;
	/** fired when the last oscillator ends (engine voice accounting) */
	onEnded: (() => void) | null = null;

	constructor(
		ctx: AudioContext,
		destination: AudioNode,
		freq: number,
		params: VoiceParams,
		when = ctx.currentTime,
		private readonly velocity = 1,
		mods: LfoRoute[] = []
	) {
		this.freq = freq;
		this.startTime = when;
		// floors: a zero-length ramp is a discontinuity — an audible click.
		// Hardware envelopes clamp the same way.
		this.attack = Math.max(params.attack, 0.003);
		this.decay = Math.max(params.decay, 0.003);
		this.sustain = params.sustain;
		this.release = Math.max(params.release, 0.01);
		this.mods = mods;

		// Per-voice resonant lowpass; the filter envelope rides the same ADSR
		// shape as the amp (sustain reuses the amp sustain level).
		this.filter = ctx.createBiquadFilter();
		this.filter.type = 'lowpass';
		this.filter.Q.value = 0.7 + params.resonance * 17;
		const base = cutoffHz(params.cutoff);
		this.filter.frequency.setValueAtTime(base, when);
		if (params.filterEnv > 0) {
			const peak = Math.min(base * 2 ** (params.filterEnv * 4), 16000);
			this.filter.frequency.linearRampToValueAtTime(peak, when + this.attack);
			this.filter.frequency.linearRampToValueAtTime(
				base + (peak - base) * this.sustain,
				when + this.attack + this.decay
			);
		}
		this.filter.connect(destination);
		for (const mod of this.mods) {
			if (mod.target === 'filter') mod.node.connect(this.filter.frequency);
		}

		if (params.wave === 'supersaw') {
			const highpass = ctx.createBiquadFilter();
			highpass.type = 'highpass';
			// per Szabó 2010: the JP-8000 high-passes AT the note's fundamental,
			// removing the sub-fundamental beating of the detuned saws (the 2015
			// code's fixed 200 Hz ate low notes' fundamentals instead)
			highpass.frequency.value = freq;
			highpass.connect(this.filter);
			this.highpass = highpass;
			const levels = mixLevels(params.mix);
			detuneRatios(params.detune).forEach((ratio, i) => {
				// stagger starts ≤10ms so the saws don't begin phase-aligned
				const stagger = Math.random() / 100;
				const pan = PAN_POSITIONS[i] * params.spread;
				this.units.push(
					this.createUnit(ctx, highpass, params, ratio, levels[i], pan, when + stagger)
				);
			});
		} else {
			// organ's PeriodicWave is built at half pitch (sub-octave drawbar)
			const ratio = params.wave === 'organ' ? ORGAN_RATIO : 1;
			this.units.push(this.createUnit(ctx, this.filter, params, ratio, 1, 0, when));
		}
		for (const mod of this.mods) {
			if (mod.target === 'pitch') {
				for (const unit of this.units) mod.node.connect(unit.osc.detune);
			}
		}
	}

	private createUnit(
		ctx: AudioContext,
		target: AudioNode,
		params: VoiceParams,
		ratio: number,
		level: number,
		pan: number,
		when: number
	): OscUnit {
		const osc = ctx.createOscillator();
		if (params.wave === 'organ') {
			osc.setPeriodicWave(getOrganWave(ctx));
		} else {
			osc.type = params.wave === 'supersaw' ? 'sawtooth' : params.wave;
		}
		osc.frequency.value = this.freq * ratio;

		// The 4x-oversampled waveshaper is the most expensive node in the voice
		// and at amount 0 its curve is exactly x/3 — skip it entirely there and
		// fold the 1/3 into the level gain instead (identical loudness, a CPU
		// saving that matters on phones: pops under fast playing came from this).
		const shaper = params.distortion > 0 ? ctx.createWaveShaper() : null;
		if (shaper) {
			shaper.curve = makeDistortionCurve(params.distortion);
			shaper.oversample = '4x';
		}

		const envelope = ctx.createGain();
		envelope.gain.setValueAtTime(0, when);
		envelope.gain.linearRampToValueAtTime(1, when + this.attack);
		envelope.gain.linearRampToValueAtTime(this.sustain, when + this.attack + this.decay);

		const levelGain = ctx.createGain();
		levelGain.gain.setValueAtTime(level * this.velocity * (shaper ? 1 : 1 / 3), when);

		const panner = ctx.createStereoPanner();
		panner.pan.value = pan;

		if (shaper) {
			osc.connect(shaper);
			shaper.connect(envelope);
		} else {
			osc.connect(envelope);
		}
		envelope.connect(levelGain);
		levelGain.connect(panner);
		panner.connect(target);
		osc.start(when);

		osc.onended = () => {
			for (const mod of this.mods) {
				if (mod.target === 'pitch') mod.node.disconnect(osc.detune);
			}
			osc.disconnect();
			shaper?.disconnect();
			envelope.disconnect();
			levelGain.disconnect();
			panner.disconnect();
			// last unit out tears down the shared per-voice nodes
			if (++this.endedUnits === this.units.length) {
				for (const mod of this.mods) {
					if (mod.target === 'filter') mod.node.disconnect(this.filter.frequency);
				}
				this.filter.disconnect();
				this.onEnded?.();
			}
		};

		return { osc, envelope, ratio };
	}

	/** Mono glide: ramp all oscillators to a new base frequency over `duration` seconds. */
	setFrequency(freq: number, duration: number, now: number): void {
		// Compute where a possibly-unfinished previous glide actually is, so a new
		// glide starts from the audible frequency instead of jumping.
		const current = this.glide
			? valueAtTime(
					this.glide.startTime,
					now,
					this.glide.startTime + this.glide.duration,
					this.glide.from,
					this.glide.to
				)
			: this.freq;
		this.glide = { startTime: now, from: current, to: freq, duration };
		this.freq = freq;
		for (const unit of this.units) {
			unit.osc.frequency.cancelScheduledValues(now);
			unit.osc.frequency.setValueAtTime(current * unit.ratio, now);
			unit.osc.frequency.linearRampToValueAtTime(freq * unit.ratio, now + duration);
		}
		// the fundamental-tracking highpass glides along
		if (this.highpass) {
			this.highpass.frequency.cancelScheduledValues(now);
			this.highpass.frequency.setValueAtTime(Math.max(current, 20), now);
			this.highpass.frequency.linearRampToValueAtTime(Math.max(freq, 20), now + duration);
		}
	}

	/**
	 * Live filter tweak on a sounding note. Lands on the envelope's steady-state
	 * value for the new cutoff (post attack+decay this is exact; mid-attack it
	 * settles early — fine for knob twisting).
	 */
	setFilter(
		cutoff: number,
		resonance: number,
		filterEnv: number,
		sustain: number,
		now: number
	): void {
		const base = cutoffHz(cutoff);
		const peak = Math.min(base * 2 ** (filterEnv * 4), 16000);
		const steady = filterEnv > 0 ? base + (peak - base) * sustain : base;
		this.filter.frequency.cancelScheduledValues(now);
		this.filter.frequency.setTargetAtTime(steady, now, 0.03);
		this.filter.Q.setTargetAtTime(0.7 + resonance * 17, now, 0.03);
	}

	/** Pitch bend in cents, applied via osc.detune so supersaw ratios stay intact. */
	bend(cents: number, now: number): void {
		for (const unit of this.units) {
			unit.osc.detune.setTargetAtTime(cents, now, 0.02);
		}
	}

	get unitCount(): number {
		return this.units.length;
	}

	/**
	 * Voice stealing: fast click-free fade-out and stop. Unlike stop() it
	 * ignores attack/release — the budget needs the units back now.
	 */
	kill(now: number): void {
		// runs even after stop(): it must override an already-scheduled release
		// (sequencer one-shots schedule theirs at creation)
		if (this.dead) return;
		this.dead = true;
		this.stopped = true;
		this.releasing = true;
		for (const unit of this.units) {
			unit.envelope.gain.cancelScheduledValues(now);
			// setTargetAtTime starts from the current value — no anchor needed.
			// 50ms tau: short enough to free the budget, long enough that
			// chopping an audible release tail doesn't read as a snap.
			unit.envelope.gain.setTargetAtTime(0, now, 0.05);
			unit.osc.stop(now + 0.25);
		}
	}

	/** Release the note: let the attack finish, then ramp out and stop. */
	stop(when: number): void {
		if (this.stopped) return;
		this.stopped = true;
		this.releasing = true;
		const attackEnd = this.startTime + this.attack;
		const decayEnd = attackEnd + this.decay;
		const releaseStart = Math.max(when, attackEnd);
		// Anchor the envelope at its actual value when the release begins —
		// a bare linearRamp would interpolate from the last scheduled event
		// (the decay endpoint, possibly long past), audibly snapping the gain
		// down before ramping. The ADSR is piecewise-linear, so the value at
		// releaseStart is exact.
		const anchor =
			releaseStart >= decayEnd
				? this.sustain
				: 1 - (1 - this.sustain) * ((releaseStart - attackEnd) / this.decay);
		for (const unit of this.units) {
			unit.envelope.gain.cancelScheduledValues(releaseStart);
			unit.envelope.gain.setValueAtTime(anchor, releaseStart);
			unit.envelope.gain.linearRampToValueAtTime(0, releaseStart + this.release);
			unit.osc.stop(releaseStart + this.release);
		}
	}
}
