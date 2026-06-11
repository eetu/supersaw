// Note names, equal-temperament frequencies and the qwerty → note mapping.
// Framework-free: pure functions, no Web Audio, no Svelte.

const A4 = 440;

export const NOTE_NAMES = [
	'C',
	'C#',
	'D',
	'D#',
	'E',
	'F',
	'F#',
	'G',
	'G#',
	'A',
	'A#',
	'B'
] as const;

/** A note in scientific pitch notation, e.g. "C5" or "A#3". */
export type Note = string;

export function frequency(note: Note): number {
	const match = note.match(/^([A-G]#?)(\d)$/);
	if (!match) throw new Error(`invalid note: ${note}`);
	const [, name, octave] = match;
	const semitonesFromA4 =
		(Number(octave) - 4) * 12 + NOTE_NAMES.indexOf(name as (typeof NOTE_NAMES)[number]) - 9;
	return A4 * 2 ** (semitonesFromA4 / 12);
}

/** Note at chromatic offset `index` from C of the given octave (index may exceed one octave). */
export function noteAt(index: number, octave: number): Note {
	const len = NOTE_NAMES.length;
	const i = ((index % len) + len) % len;
	return NOTE_NAMES[i] + (octave + Math.floor(index / len));
}

// Two qwerty rows as one and a half piano octaves: home row = white keys,
// row above = black keys. KeyboardEvent.code values, layout-independent.
export const KEY_CODES = [
	'KeyA',
	'KeyW',
	'KeyS',
	'KeyE',
	'KeyD',
	'KeyF',
	'KeyT',
	'KeyG',
	'KeyY',
	'KeyH',
	'KeyU',
	'KeyJ',
	'KeyK',
	'KeyO',
	'KeyL',
	'KeyP',
	'Semicolon',
	'Quote'
] as const;

export function noteForKey(code: string, octave: number): Note | undefined {
	const index = KEY_CODES.indexOf(code as (typeof KEY_CODES)[number]);
	return index === -1 ? undefined : noteAt(index, octave);
}
