import { engine } from './engine/engine.ts';
import type { Note } from './engine/notes.ts';
import { Scheduler } from './engine/scheduler.ts';
import { params } from './params.svelte.ts';

// C minor pentatonic, two octaves, high notes on top — every cell sounds fine
// next to every other, which is the point of a toy step sequencer.
export const ROWS: Note[] = ['C6', 'A#5', 'G5', 'F5', 'D#5', 'C5', 'A#4', 'G4'];
export const STEPS = 16;

export const seq = $state({
	grid: ROWS.map(() => Array<boolean>(STEPS).fill(false)),
	tempo: 120,
	playing: false,
	currentStep: -1
});

function onStep(step: number, time: number): void {
	// pick up live tempo changes before the scheduler computes the next step
	scheduler.tempo = seq.tempo;
	const stepLength = (60 / seq.tempo) * 0.25;
	for (const [row, note] of ROWS.entries()) {
		if (seq.grid[row][step]) engine.play(note, params, time, stepLength * 0.9);
	}
	// move the playhead when the step becomes audible, not when it's scheduled
	const delay = Math.max(0, (time - engine.currentTime) * 1000);
	setTimeout(() => {
		if (seq.playing) seq.currentStep = step;
	}, delay);
}

const scheduler = new Scheduler(() => engine.ensure().currentTime, onStep, STEPS);

// Another tab claimed the audio output — stop our transport, otherwise the
// scheduler's next tick would re-ensure the context and the tabs would fight
// over the speakers forever.
engine.onReleased = () => {
	if (seq.playing) {
		scheduler.stop();
		seq.playing = false;
		seq.currentStep = -1;
	}
};

export function togglePlay(): void {
	if (seq.playing) {
		scheduler.stop();
		engine.stopAll();
		seq.playing = false;
		seq.currentStep = -1;
	} else {
		scheduler.tempo = seq.tempo;
		seq.playing = true;
		scheduler.start();
	}
}

export function clearGrid(): void {
	for (const row of seq.grid) row.fill(false);
}
