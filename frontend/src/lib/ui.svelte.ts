import { engine, type LfoTarget } from './engine/engine.ts';
import type { Note } from './engine/notes.ts';
import { params } from './params.svelte.ts';

// Cross-view UI state + the header actions (dice, t2) — they live in the
// layout's top bar, so their logic can't sit in a single route's component.

export const ui = $state({
	octave: 5,
	// one t2 intro at a time — spamming stacked overlapping phrases
	t2Playing: false
});

const lfoTargets: LfoTarget[] = ['off', 'pitch', 'filter'];
const waves = ['sine', 'square', 'sawtooth', 'triangle', 'supersaw', 'organ'] as const;

// Randomize the sound, constrained to stay audible and non-hostile:
// cutoff never fully closed, resonance off the self-oscillation zone,
// envelope times biased short (squared roll).
export function randomize(): void {
	const r = Math.random;
	params.wave = waves[Math.floor(r() * waves.length)];
	params.detune = r();
	params.mix = r();
	params.spread = r();
	params.attack = r() ** 2 * 0.5;
	params.decay = 0.02 + r() ** 2 * 0.5;
	params.sustain = 0.3 + r() * 0.7;
	params.release = r() ** 2;
	params.distortion = Math.round(r() ** 2 * 60);
	params.cutoff = 0.25 + r() * 0.75;
	params.resonance = r() * 0.7;
	params.filterEnv = r();
	params.lfoRate = r();
	params.lfoDepth = r() * 0.8;
	params.lfoTarget = lfoTargets[Math.floor(r() * lfoTargets.length)];
}

// Easter egg: the T2 lead (Fiedel's Synclavier brass) — tight supersaw,
// slow swell, dark filter that opens on attack, mono with a touch of glide.
// Only reachable from lo-fi mode; leaves the lo-fi switch itself alone.
export function t2(): void {
	if (ui.t2Playing) return;
	ui.t2Playing = true;
	setTimeout(() => (ui.t2Playing = false), 6000);
	Object.assign(params, {
		wave: 'supersaw',
		detune: 0.2,
		mix: 0.9,
		spread: 0.3,
		attack: 0.18,
		decay: 0.3,
		sustain: 0.85,
		release: 0.4,
		distortion: 15,
		cutoff: 0.45,
		resonance: 0.2,
		filterEnv: 0.35,
		lfoRate: 0.2,
		lfoDepth: 0,
		lfoTarget: 'off',
		poly: false,
		glide: 0.05
	});
	// the theme sits low — around octave 4
	ui.octave = 4;
	// ...and introduces itself, call and answer:
	// D E F E C → low F, then D E F E C → A
	const now = engine.ensure().currentTime + 0.2;
	const p = { ...params };
	const phrase = (at: number, last: Note, lastLen: number): void => {
		engine.play('D5', p, at, 0.55);
		engine.play('E5', p, at + 0.7, 0.55);
		engine.play('F5', p, at + 1.4, 1.05);
		engine.play('E5', p, at + 2.6, 0.55);
		engine.play('C5', p, at + 3.3, 0.55);
		engine.play(last, p, at + 4.0, lastLen);
	};
	phrase(now, 'F4', 1.5);
}
