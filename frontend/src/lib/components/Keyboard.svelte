<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	import { engine } from '$lib/engine/engine';
	import { clampOctave, KEY_CODES, type Note, noteAt, noteForKey } from '$lib/engine/notes';
	import { params } from '$lib/params.svelte';

	// octave is bindable so the panel header (page-level) can host the < > buttons
	let { octave = $bindable(5) }: { octave?: number } = $props();
	const pressed = new SvelteSet<Note>();

	// any octave change — keys, arrows, or the external buttons — must release
	// held notes, else their keyup maps to the wrong name and they stick.
	// untrack: releaseAll reads `pressed`, which must not re-trigger this.
	let prevOctave = octave;
	$effect(() => {
		if (octave !== prevOctave) {
			prevOctave = octave;
			untrack(() => releaseAll());
		}
	});

	function setOctave(next: number): void {
		octave = clampOctave(next);
	}

	// component teardown (navigation, HMR swap) must release held notes — the
	// new instance gets a fresh `pressed` set and could never stop them
	$effect(() => () => releaseAll());

	// 18 qwerty keys = 1.5 chromatic octaves starting at C<octave>
	const notes = $derived(KEY_CODES.map((_, i) => noteAt(i, octave)));

	function press(note: Note): void {
		if (pressed.has(note)) return;
		pressed.add(note);
		engine.noteOn(note, params);
	}

	function release(note: Note): void {
		if (!pressed.delete(note)) return;
		// mono: the single voice releases only once every key is up
		if (params.poly || pressed.size === 0) engine.noteOff(note, params);
	}

	function releaseAll(): void {
		for (const note of [...pressed]) release(note);
	}

	function onkeydown(e: KeyboardEvent): void {
		if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
		// panic button: kill every voice, however it got stuck
		if (e.code === 'Escape') {
			pressed.clear();
			engine.stopAll();
			return;
		}
		if (/^Digit\d$/.test(e.code)) {
			setOctave(Number(e.code.slice(5)));
			return;
		}
		// arrows step the octave — but not when a focused control owns them
		// (sliders move on arrow keys)
		if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
			const target = e.target as HTMLElement | null;
			if (target?.matches('input, select, textarea')) return;
			setOctave(octave + (e.code === 'ArrowRight' ? 1 : -1));
			return;
		}
		const note = noteForKey(e.code, octave);
		if (note) press(note);
	}

	function onkeyup(e: KeyboardEvent): void {
		const note = noteForKey(e.code, octave);
		if (note) release(note);
	}

	// Release the implicit pointer capture so dragging across keys glisses.
	const down = (note: Note) => (e: PointerEvent) => {
		e.stopPropagation();
		(e.target as Element).releasePointerCapture(e.pointerId);
		press(note);
	};
	const up = (note: Note) => (e: PointerEvent) => {
		e.stopPropagation();
		release(note);
	};
	const enter = (note: Note) => (e: PointerEvent) => {
		e.stopPropagation();
		if (e.buttons) press(note);
	};
</script>

<svelte:window {onkeydown} {onkeyup} onblur={releaseAll} />

<div class="keyboard">
	{#each notes as note, i (note)}
		{#if !note.includes('#')}
			{@const black = i > 0 ? notes[i - 1] : null}
			<div
				class="key"
				role="button"
				tabindex={-1}
				aria-label={note}
				class:active={pressed.has(note)}
				onpointerdown={down(note)}
				onpointerup={up(note)}
				onpointerenter={enter(note)}
				onpointerleave={up(note)}
				onpointercancel={up(note)}
			>
				{#if black?.includes('#')}
					<div
						class="key black"
						role="button"
						tabindex={-1}
						aria-label={black}
						class:active={pressed.has(black)}
						onpointerdown={down(black)}
						onpointerup={up(black)}
						onpointerenter={enter(black)}
						onpointerleave={up(black)}
						onpointercancel={up(black)}
					></div>
				{/if}
				<span class="label">{note.startsWith('C') ? note : ''}</span>
			</div>
		{/if}
	{/each}
</div>

<style>
	.keyboard {
		display: flex;
		gap: 0.2rem;
		height: 11rem;
		user-select: none;
		touch-action: none;
	}
	@media (max-width: 640px) and (orientation: portrait) {
		.keyboard {
			height: 8.5rem;
		}
	}
	.key {
		position: relative;
		flex: 1;
		background: var(--halo-bg-light);
		border: 1px solid var(--halo-border);
		border-radius: 0 0 var(--halo-radius) var(--halo-radius);
		cursor: pointer;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		user-select: none;
		-webkit-user-select: none;
	}
	.key.active {
		background: var(--halo-accent-soft);
	}
	/* tabindex=-1 divs still get focus on pointerdown in some browsers —
	   suppress the UA ring; keys are played via pointer/qwerty, never Tab. */
	.key:focus {
		outline: none;
	}
	.key.black {
		position: absolute;
		/* -1px: absolute position is relative to the padding box, so top: 0
		   would start below the white key's border — lift flush with its edge */
		top: -1px;
		left: calc(-28% - 0.1rem);
		width: 56%;
		height: 58%;
		background: var(--halo-text-main);
		border: none;
		border-radius: 0 0 var(--halo-radius-pill) var(--halo-radius-pill);
		z-index: 1;
	}
	.key.black.active {
		background: var(--halo-accent);
	}
	/* Dark: full inversion, wireframe style — "white" keys go black with a
	   light outline, "black" keys stay solid light (text-main flips light in
	   dark mode). Deliberate (eetu's call) — don't "fix" the polarity. */
	@media (prefers-color-scheme: dark) {
		.key {
			background: var(--halo-body);
			border-color: var(--halo-text-main);
		}
		.key.active {
			background: var(--halo-accent-soft);
		}
	}
	.label {
		font-family: var(--halo-font-heading);
		font-size: 0.7rem;
		color: var(--halo-text-muted);
		padding-bottom: 0.4rem;
		pointer-events: none;
	}
</style>
