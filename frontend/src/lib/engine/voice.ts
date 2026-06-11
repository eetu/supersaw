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
};

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
	private readonly release: number;

	constructor(
		ctx: AudioContext,
		destination: AudioNode,
		freq: number,
		params: VoiceParams,
		when = ctx.currentTime
	) {
		this.freq = freq;
		this.startTime = when;
		this.attack = params.attack;
		this.release = params.release;

		if (params.wave === 'supersaw') {
			const highpass = ctx.createBiquadFilter();
			highpass.type = 'highpass';
			highpass.frequency.value = 200;
			highpass.connect(destination);
			const levels = mixLevels(params.mix);
			detuneRatios(params.detune).forEach((ratio, i) => {
				// stagger starts ≤10ms so the saws don't begin phase-aligned
				const stagger = Math.random() / 100;
				this.units.push(this.createUnit(ctx, highpass, params, ratio, levels[i], when + stagger));
			});
		} else {
			this.units.push(this.createUnit(ctx, destination, params, 1, 1, when));
		}
	}

	private createUnit(
		ctx: AudioContext,
		target: AudioNode,
		params: VoiceParams,
		ratio: number,
		level: number,
		when: number
	): OscUnit {
		const osc = ctx.createOscillator();
		osc.type = params.wave === 'supersaw' ? 'sawtooth' : params.wave;
		osc.frequency.value = this.freq * ratio;

		const shaper = ctx.createWaveShaper();
		shaper.curve = makeDistortionCurve(params.distortion);
		shaper.oversample = '4x';

		const envelope = ctx.createGain();
		envelope.gain.setValueAtTime(0, when);
		envelope.gain.linearRampToValueAtTime(1, when + params.attack);
		envelope.gain.linearRampToValueAtTime(params.sustain, when + params.attack + params.decay);

		const levelGain = ctx.createGain();
		levelGain.gain.setValueAtTime(level, when);

		osc.connect(shaper);
		shaper.connect(envelope);
		envelope.connect(levelGain);
		levelGain.connect(target);
		osc.start(when);

		osc.onended = () => {
			osc.disconnect();
			shaper.disconnect();
			envelope.disconnect();
			levelGain.disconnect();
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

	/** Pitch bend in cents, applied via osc.detune so supersaw ratios stay intact. */
	bend(cents: number, now: number): void {
		for (const unit of this.units) {
			unit.osc.detune.setTargetAtTime(cents, now, 0.02);
		}
	}

	/** Release the note: let the attack finish, then ramp out and stop. */
	stop(when: number): void {
		const attackEnd = this.startTime + this.attack;
		const releaseStart = Math.max(when, attackEnd);
		for (const unit of this.units) {
			unit.envelope.gain.linearRampToValueAtTime(0, releaseStart + this.release);
			unit.osc.stop(releaseStart + this.release);
		}
	}
}
