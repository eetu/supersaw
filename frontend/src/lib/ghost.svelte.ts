import { SvelteSet } from 'svelte/reactivity';

import { engine } from './engine/engine.ts';
import type { Note } from './engine/notes.ts';
import { params } from './params.svelte.ts';
import { seq } from './sequencer.svelte.ts';

// Ghost player: opt-in (toggle on the synth view). Plays real tunes — a small
// public-domain songbook — with improvised pentatonic interludes between them.
// Any user input silences it instantly and re-arms the idle timer. The
// keyboard lights the notes it plays via `ghostLit`.

const IDLE_MS = 30_000;

/** [note (null = rest), length in beats] */
type TuneStep = [Note | null, number];
type Tune = { tempo: number; notes: TuneStep[] };

// Public-domain songbook (folk/classical, all pre-1900).
const TUNES: Tune[] = [
	// Beethoven — Ode to Joy
	{
		tempo: 120,
		notes: [
			['E4', 1],
			['E4', 1],
			['F4', 1],
			['G4', 1],
			['G4', 1],
			['F4', 1],
			['E4', 1],
			['D4', 1],
			['C4', 1],
			['C4', 1],
			['D4', 1],
			['E4', 1],
			['E4', 1.5],
			['D4', 0.5],
			['D4', 2],
			['E4', 1],
			['E4', 1],
			['F4', 1],
			['G4', 1],
			['G4', 1],
			['F4', 1],
			['E4', 1],
			['D4', 1],
			['C4', 1],
			['C4', 1],
			['D4', 1],
			['E4', 1],
			['D4', 1.5],
			['C4', 0.5],
			['C4', 2]
		]
	},
	// Korobeiniki (the Tetris one — 19th-century Russian folk)
	{
		tempo: 140,
		notes: [
			['E5', 1],
			['B4', 0.5],
			['C5', 0.5],
			['D5', 1],
			['C5', 0.5],
			['B4', 0.5],
			['A4', 1],
			['A4', 0.5],
			['C5', 0.5],
			['E5', 1],
			['D5', 0.5],
			['C5', 0.5],
			['B4', 1.5],
			['C5', 0.5],
			['D5', 1],
			['E5', 1],
			['C5', 1],
			['A4', 1],
			['A4', 1.5],
			[null, 0.5],
			['D5', 1],
			['F5', 0.5],
			['A5', 1],
			['G5', 0.5],
			['F5', 0.5],
			['E5', 1.5],
			['C5', 0.5],
			['E5', 1],
			['D5', 0.5],
			['C5', 0.5],
			['B4', 1],
			['B4', 0.5],
			['C5', 0.5],
			['D5', 1],
			['E5', 1],
			['C5', 1],
			['A4', 1],
			['A4', 1.5],
			[null, 0.5]
		]
	},
	// Twinkle Twinkle
	{
		tempo: 104,
		notes: [
			['C4', 1],
			['C4', 1],
			['G4', 1],
			['G4', 1],
			['A4', 1],
			['A4', 1],
			['G4', 2],
			['F4', 1],
			['F4', 1],
			['E4', 1],
			['E4', 1],
			['D4', 1],
			['D4', 1],
			['C4', 2]
		]
	},
	// The Godfather waltz motif (Nino Rota) — solo trumpet opening, A minor
	{
		tempo: 92,
		notes: [
			['E4', 1],
			['A4', 1],
			['C5', 0.5],
			['B4', 0.5],
			['A4', 1],
			['C5', 0.5],
			['A4', 0.5],
			['B4', 0.5],
			['A4', 0.5],
			['G4', 1],
			['B4', 1],
			['E4', 2],
			[null, 1],
			['E4', 1],
			['A4', 1],
			['C5', 0.5],
			['B4', 0.5],
			['A4', 1],
			['C5', 0.5],
			['A4', 0.5],
			['B4', 0.5],
			['A4', 0.5],
			['G4', 1],
			['B4', 1],
			['A4', 2]
		]
	},
	// Dueling Banjos — the call-and-response lick, G major
	{
		tempo: 150,
		notes: [
			['B4', 0.5],
			['C5', 0.5],
			['D5', 0.5],
			['B4', 0.5],
			['D5', 0.5],
			['C5', 0.5],
			['D5', 0.5],
			['B4', 0.5],
			[null, 0.5],
			['G4', 0.5],
			['A4', 0.5],
			['B4', 0.5],
			['G4', 0.5],
			['B4', 0.5],
			['A4', 0.5],
			['B4', 0.5],
			['G4', 0.5],
			[null, 0.5],
			['G4', 0.5],
			['A4', 0.5],
			['B4', 0.5],
			['G4', 0.5],
			['B4', 0.5],
			['A4', 0.5],
			['G4', 0.5],
			['E4', 0.5],
			['D4', 0.5],
			['G4', 1.5]
		]
	},
	// Frère Jacques
	{
		tempo: 126,
		notes: [
			['C4', 1],
			['D4', 1],
			['E4', 1],
			['C4', 1],
			['C4', 1],
			['D4', 1],
			['E4', 1],
			['C4', 1],
			['E4', 1],
			['F4', 1],
			['G4', 2],
			['E4', 1],
			['F4', 1],
			['G4', 2],
			['G4', 0.5],
			['A4', 0.5],
			['G4', 0.5],
			['F4', 0.5],
			['E4', 1],
			['C4', 1],
			['G4', 0.5],
			['A4', 0.5],
			['G4', 0.5],
			['F4', 0.5],
			['E4', 1],
			['C4', 1],
			['C4', 1],
			['G3', 1],
			['C4', 2],
			['C4', 1],
			['G3', 1],
			['C4', 2]
		]
	}
];

// improv interlude material: C minor pentatonic, lazy random walk
const SCALE: Note[] = ['C4', 'D#4', 'F4', 'G4', 'A#4', 'C5', 'D#5', 'F5', 'G5', 'A#5', 'C6'];
const MOVES = [-2, -1, -1, 0, 1, 1, 2];

export const ghostLit = new SvelteSet<Note>();

/** Toggle state — owned here so the hidden-tab handler can switch it off. */
export const ghost = $state({ on: false });

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let stepTimer: ReturnType<typeof setTimeout> | null = null;
let phrase: { note: Note | null; ms: number }[] = [];
let pos = 0;
let lastTune = -1;

function ghostParams() {
	return { ...params, poly: true };
}

function tunePhrase(): { note: Note | null; ms: number }[] {
	// don't repeat the previous tune
	let i = Math.floor(Math.random() * TUNES.length);
	if (i === lastTune) i = (i + 1) % TUNES.length;
	lastTune = i;
	const tune = TUNES[i];
	const beatMs = 60_000 / tune.tempo;
	return tune.notes.map(([note, beats]) => ({ note, ms: beats * beatMs }));
}

function improvPhrase(): { note: Note | null; ms: number }[] {
	let degree = 4 + Math.floor(Math.random() * 3);
	const steps: { note: Note | null; ms: number }[] = [];
	const count = 10 + Math.floor(Math.random() * 8);
	for (let i = 0; i < count; i++) {
		const move = MOVES[Math.floor(Math.random() * MOVES.length)];
		degree = Math.max(0, Math.min(SCALE.length - 1, degree + move));
		steps.push({
			note: Math.random() > 0.15 ? SCALE[degree] : null,
			ms: 260 + Math.random() * 160
		});
	}
	return steps;
}

function step(): void {
	// hidden tab: switch the ghost off entirely (the toggle follows)
	if (document.hidden) {
		stopPlaying();
		ghost.on = false;
		return;
	}
	// don't fight the sequencer — go quiet and re-arm
	if (seq.playing) {
		stopPlaying();
		arm();
		return;
	}
	if (pos >= phrase.length) {
		// phrase done: breathe, then mostly tunes, sometimes a noodle
		phrase = Math.random() < 0.7 ? tunePhrase() : improvPhrase();
		pos = 0;
		stepTimer = setTimeout(step, 1500);
		return;
	}
	const { note, ms } = phrase[pos++];
	if (note) {
		const p = ghostParams();
		engine.noteOn(note, p);
		ghostLit.add(note);
		setTimeout(() => {
			engine.noteOff(note, p);
			ghostLit.delete(note);
		}, ms * 0.85);
	}
	stepTimer = setTimeout(step, ms);
}

function startPlaying(): void {
	phrase = tunePhrase();
	pos = 0;
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

// tab hidden: full off, toggle included — don't lurk armed in the background
function onHidden(): void {
	if (document.hidden) {
		stopPlaying();
		ghost.on = false;
	}
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
	document.addEventListener('visibilitychange', onHidden);
	return () => {
		document.removeEventListener('visibilitychange', onHidden);
		stopPlaying();
		if (idleTimer) clearTimeout(idleTimer);
		idleTimer = null;
		window.removeEventListener('pointerdown', onActivity, true);
		window.removeEventListener('keydown', onActivity, true);
		window.removeEventListener('wheel', onActivity, true);
	};
}
