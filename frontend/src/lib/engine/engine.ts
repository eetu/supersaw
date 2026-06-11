import { frequency, type Note } from './notes.ts';
import { Voice, type VoiceParams } from './voice.ts';

export type SynthParams = VoiceParams & {
	poly: boolean;
	/** mono only: portamento time in seconds */
	glide: number;
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

	get analyser(): AnalyserNode | null {
		return this.analyserNode;
	}

	get currentTime(): number {
		return this.ctx?.currentTime ?? 0;
	}

	ensure(): AudioContext {
		if (!this.ctx) {
			this.ctx = new AudioContext();
			this.master = this.ctx.createDynamicsCompressor();
			this.master.connect(this.ctx.destination);
			this.analyserNode = this.ctx.createAnalyser();
			this.analyserNode.fftSize = 2048;
			this.master.connect(this.analyserNode);
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

	private createVoice(ctx: AudioContext, freq: number, params: VoiceParams, when: number): Voice {
		const voice = new Voice(ctx, this.master!, freq, params, when);
		if (this.bendCents !== 0) voice.bend(this.bendCents, when);
		return voice;
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
	play(note: Note, params: VoiceParams, when: number, duration: number): void {
		const ctx = this.ensure();
		const voice = this.createVoice(ctx, frequency(note), params, when);
		voice.stop(when + duration);
		this.scheduled.add(voice);
		// Voices disconnect themselves onended; this set only exists for stopAll.
		setTimeout(
			() => this.scheduled.delete(voice),
			(when + duration + params.release - ctx.currentTime + 1) * 1000
		);
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
