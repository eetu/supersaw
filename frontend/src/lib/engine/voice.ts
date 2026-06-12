import { detuneRatios, makeDistortionCurve, mixLevels, valueAtTime } from './curves.ts';

export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'supersaw';

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

type OscUnit = {
	osc: OscillatorNode;
	envelope: GainNode;
	/** frequency ratio vs the voice's base frequency (1 except for detuned saws) */
	ratio: number;
};

type Glide = { startTime: number; from: number; to: number; duration: number };

// One sounding note: oscillator(s) → waveshaper → ADSR gain → level gain → destination.
// "supersaw" = 7 detuned sawtooths through a shared 200 Hz highpass (Szabó 2010, see curves.ts).
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
	private readonly filter: BiquadFilterNode;
	private readonly mods: LfoRoute[];

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
		this.attack = params.attack;
		this.decay = params.decay;
		this.sustain = params.sustain;
		this.release = params.release;
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
			this.filter.frequency.linearRampToValueAtTime(peak, when + params.attack);
			this.filter.frequency.linearRampToValueAtTime(
				base + (peak - base) * params.sustain,
				when + params.attack + params.decay
			);
		}
		this.filter.connect(destination);
		for (const mod of this.mods) {
			if (mod.target === 'filter') mod.node.connect(this.filter.frequency);
		}

		if (params.wave === 'supersaw') {
			const highpass = ctx.createBiquadFilter();
			highpass.type = 'highpass';
			highpass.frequency.value = 200;
			highpass.connect(this.filter);
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
			this.units.push(this.createUnit(ctx, this.filter, params, 1, 1, 0, when));
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
		osc.type = params.wave === 'supersaw' ? 'sawtooth' : params.wave;
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
		envelope.gain.linearRampToValueAtTime(1, when + params.attack);
		envelope.gain.linearRampToValueAtTime(params.sustain, when + params.attack + params.decay);

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

	/** Release the note: let the attack finish, then ramp out and stop. */
	stop(when: number): void {
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
