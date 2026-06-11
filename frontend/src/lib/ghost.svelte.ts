import { SvelteSet } from 'svelte/reactivity';

import { engine } from './engine/engine.ts';
import type { Note } from './engine/notes.ts';
import { params } from './params.svelte.ts';
import { seq } from './sequencer.svelte.ts';

// Ghost player: opt-in (toggle on the synth view). While enabled, 30s of idle
// starts a lazy random walk on the pentatonic; any user input silences it
// instantly and re-arms the timer. The keyboard lights the notes it plays via
// `ghostLit`.

const SCALE: Note[] = ['C4', 'D#4', 'F4', 'G4', 'A#4', 'C5', 'D#5', 'F5', 'G5', 'A#5', 'C6'];
const IDLE_MS = 30_000;
// random-walk step weights: mostly neighbors, sometimes a leap, rarely a rest
const MOVES = [-2, -1, -1, 0, 1, 1, 2];

export const ghostLit = new SvelteSet<Note>();

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let stepTimer: ReturnType<typeof setTimeout> | null = null;
let degree = 5;

function ghostParams() {
	return { ...params, poly: true };
}

function step(): void {
	// don't fight the sequencer or play to a hidden tab — re-arm and wait
	if (document.hidden || seq.playing) {
		stopPlaying();
		arm();
		return;
	}
	if (Math.random() > 0.2) {
		const move = MOVES[Math.floor(Math.random() * MOVES.length)];
		degree = Math.max(0, Math.min(SCALE.length - 1, degree + move));
		const note = SCALE[degree];
		const p = ghostParams();
		engine.noteOn(note, p);
		ghostLit.add(note);
		setTimeout(() => {
			engine.noteOff(note, p);
			ghostLit.delete(note);
		}, 220);
	}
	stepTimer = setTimeout(step, 260 + Math.random() * 140);
}

function startPlaying(): void {
	degree = 4 + Math.floor(Math.random() * 3);
	step();
}

function stopPlaying(): void {
	if (stepTimer) clearTimeout(stepTimer);
	stepTimer = null;
	const p = ghostParams();
	for (const note of [...ghostLit]) {
		engine.noteOff(note, p);
		ghostLit.delete(note);
	}
}

function arm(): void {
	if (idleTimer) clearTimeout(idleTimer);
	idleTimer = setTimeout(startPlaying, IDLE_MS);
}

function onActivity(): void {
	stopPlaying();
	arm();
}

/** Enable: plays immediately; user input silences it and re-arms the idle
 * timer. Returns a cleanup for the page's $effect. */
export function enableGhost(): () => void {
	startPlaying();
	// capture phase: nothing in the app can stopPropagation its way past the
	// kill switch — any interaction must silence the ghost
	window.addEventListener('pointerdown', onActivity, true);
	window.addEventListener('keydown', onActivity, true);
	window.addEventListener('wheel', onActivity, true);
	return () => {
		stopPlaying();
		if (idleTimer) clearTimeout(idleTimer);
		idleTimer = null;
		window.removeEventListener('pointerdown', onActivity, true);
		window.removeEventListener('keydown', onActivity, true);
		window.removeEventListener('wheel', onActivity, true);
	};
}
