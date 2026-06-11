<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { SvelteSet } from 'svelte/reactivity';

	import { engine } from '$lib/engine/engine';
	import { KEY_CODES, type Note, noteAt, noteForKey } from '$lib/engine/notes';
	import { params } from '$lib/params.svelte';

	let octave = $state(5);
	const pressed = new SvelteSet<Note>();

	// 8 cap: the top keys reach one octave above the base, and a two-digit
	// octave ("C10") would break the single-digit note notation.
	function setOctave(next: number): void {
		releaseAll();
		octave = Math.max(0, Math.min(8, next));
	}

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

<div class="octave">
	<button type="button" aria-label="octave down" onclick={() => setOctave(octave - 1)}>
		<ChevronLeft size={18} aria-hidden="true" />
	</button>
	<span>octave {octave}</span>
	<button type="button" aria-label="octave up" onclick={() => setOctave(octave + 1)}>
		<ChevronRight size={18} aria-hidden="true" />
	</button>
</div>

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
	.octave {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
		font-family: var(--halo-font-heading);
		font-size: 0.8rem;
		color: var(--halo-text-muted);
		font-variant-numeric: tabular-nums;
	}
	.octave button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.2rem;
		min-height: 2rem;
		padding: 0;
		border: none;
		border-radius: var(--halo-radius-pill);
		background: var(--halo-bg-light);
		color: var(--halo-text-muted);
		cursor: pointer;
		transition: color var(--halo-d-fast);
	}
	.octave button:hover {
		color: var(--halo-accent);
	}
	.keyboard {
		display: flex;
		gap: 0.2rem;
		height: 11rem;
		user-select: none;
		touch-action: none;
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
