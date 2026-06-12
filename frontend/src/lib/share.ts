// Pattern + patch sharing via URL hash. No backend: the whole state rides the
// link. Grid = one 16-bit hex word per row; params = short query keys.

import type { LfoTarget } from './engine/engine.ts';
import type { Waveform } from './engine/voice.ts';
import { params } from './params.svelte.ts';
import { ROWS, seq, STEPS } from './sequencer.svelte.ts';

const WAVES: Waveform[] = ['sine', 'square', 'sawtooth', 'triangle', 'supersaw', 'organ'];
const LFO_TARGETS: LfoTarget[] = ['off', 'pitch', 'filter'];

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export function shareUrl(): string {
	// 2 bits per step (velocity 0..3) = one 32-bit hex word per row
	const grid = seq.grid
		.map((row) =>
			row
				.reduce((bits, level, step) => bits + level * 4 ** step, 0)
				.toString(16)
				.padStart(8, '0')
		)
		.join('');
	const q = new URLSearchParams({
		g: grid,
		t: String(seq.tempo),
		oc: String(seq.octaveShift),
		sw: String(seq.swing),
		ch: String(seq.chance),
		w: String(WAVES.indexOf(params.wave)),
		a: String(params.attack),
		d: String(params.decay),
		s: String(params.sustain),
		r: String(params.release),
		di: String(params.distortion),
		de: String(params.detune),
		m: String(params.mix),
		sp: String(params.spread),
		co: String(params.cutoff),
		q: String(params.resonance),
		fe: String(params.filterEnv),
		lr: String(params.lfoRate),
		ld: String(params.lfoDepth),
		lt: String(LFO_TARGETS.indexOf(params.lfoTarget)),
		lf: params.lofi ? '1' : '0'
	});
	return `${location.origin}${location.pathname}#${q.toString()}`;
}

/** Apply a shared state from the URL hash, tolerantly — bad values are skipped. */
export function applyShareHash(): void {
	const hash = location.hash.slice(1);
	if (!hash) return;
	const q = new URLSearchParams(hash);

	const grid = q.get('g');
	if (grid?.length === ROWS.length * 8) {
		// current format: 2-bit velocity per step
		for (const [r, row] of seq.grid.entries()) {
			const bits = parseInt(grid.slice(r * 8, r * 8 + 8), 16);
			if (Number.isNaN(bits)) continue;
			for (let step = 0; step < STEPS; step++) row[step] = Math.floor(bits / 4 ** step) % 4;
		}
	} else if (grid?.length === ROWS.length * 4) {
		// legacy format: 1 bit per step → full velocity
		for (const [r, row] of seq.grid.entries()) {
			const bits = parseInt(grid.slice(r * 4, r * 4 + 4), 16);
			if (Number.isNaN(bits)) continue;
			for (let step = 0; step < STEPS; step++) row[step] = (bits & (1 << step)) !== 0 ? 3 : 0;
		}
	}

	const num = (key: string, min: number, max: number, set: (v: number) => void): void => {
		const raw = q.get(key);
		if (raw === null) return;
		const v = Number(raw);
		if (Number.isFinite(v)) set(clamp(v, min, max));
	};
	num('t', 40, 240, (v) => (seq.tempo = Math.round(v)));
	num('oc', -2, 2, (v) => (seq.octaveShift = Math.round(v)));
	num('sw', 0, 1, (v) => (seq.swing = v));
	num('ch', 0, 1, (v) => (seq.chance = v));
	num('w', 0, WAVES.length - 1, (v) => (params.wave = WAVES[Math.round(v)]));
	num('a', 0, 1, (v) => (params.attack = v));
	num('d', 0, 1, (v) => (params.decay = v));
	num('s', 0, 1, (v) => (params.sustain = v));
	num('r', 0, 1, (v) => (params.release = v));
	num('di', 0, 100, (v) => (params.distortion = v));
	num('de', 0, 1, (v) => (params.detune = v));
	num('m', 0, 1, (v) => (params.mix = v));
	num('sp', 0, 1, (v) => (params.spread = v));
	num('co', 0, 1, (v) => (params.cutoff = v));
	num('q', 0, 1, (v) => (params.resonance = v));
	num('fe', 0, 1, (v) => (params.filterEnv = v));
	num('lr', 0, 1, (v) => (params.lfoRate = v));
	num('ld', 0, 1, (v) => (params.lfoDepth = v));
	num('lt', 0, LFO_TARGETS.length - 1, (v) => (params.lfoTarget = LFO_TARGETS[Math.round(v)]));
	num('lf', 0, 1, (v) => (params.lofi = v >= 0.5));
	// legacy key from the brief "tape" era
	num('tp', 0, 1, (v) => (params.lofi = v >= 0.5));
}
