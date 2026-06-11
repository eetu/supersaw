import type { SynthParams } from './engine/engine.ts';

// Shared synth parameters — both views (synth + sequencer) play through these,
// so tweaking the sound in one is heard in the other.
export const params: SynthParams = $state({
	wave: 'supersaw',
	attack: 0.01,
	decay: 0.02,
	sustain: 0.75,
	release: 0.25,
	distortion: 0,
	detune: 0.4,
	mix: 0.75,
	spread: 0.6,
	cutoff: 1,
	resonance: 0.1,
	filterEnv: 0,
	poly: true,
	glide: 0,
	lfoRate: 0.4,
	lfoDepth: 0,
	lfoTarget: 'off',
	lofi: false
});
