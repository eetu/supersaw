<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import { clearGrid, ROWS, seq, togglePlay } from '$lib/sequencer.svelte';
	import { shareUrl } from '$lib/share';

	let copied = $state(false);

	async function share(): Promise<void> {
		const url = shareUrl();
		history.replaceState(null, '', url);
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	// Drag-to-draw: pointerdown picks the brush value (inverse of the hit pad),
	// dragging paints it across pads. null = not painting.
	let brush: boolean | null = null;

	const padDown = (r: number, s: number) => (e: PointerEvent) => {
		// release the implicit capture so pointerenter fires on other pads
		(e.target as Element).releasePointerCapture(e.pointerId);
		brush = !seq.grid[r][s];
		seq.grid[r][s] = brush;
	};
	const padEnter = (r: number, s: number) => (e: PointerEvent) => {
		if (brush !== null && e.buttons) seq.grid[r][s] = brush;
	};
	// keyboard activation still toggles (click with detail 0 = Enter/Space);
	// pointer clicks already handled that on pointerdown
	const padKey = (r: number, s: number) => (e: MouseEvent) => {
		if (e.detail === 0) seq.grid[r][s] = !seq.grid[r][s];
	};
</script>

<svelte:window onpointerup={() => (brush = null)} onblur={() => (brush = null)} />

<Panel title="sequencer">
	{#snippet actions()}
		<div class="controls">
			<label class="tempo">
				<span>{seq.tempo} bpm</span>
				<input type="range" min="40" max="240" step="1" bind:value={seq.tempo} />
			</label>
			<button
				type="button"
				class="ghost life"
				class:lit={seq.evolve}
				aria-pressed={seq.evolve}
				style:--p="{seq.evolve && seq.playing
					? ((seq.currentStep + 1) / seq.grid[0].length) * 100
					: 0}%"
				onclick={() => (seq.evolve = !seq.evolve)}
				title="grid evolves by Conway's rules every loop"
			>
				life
			</button>
			<button type="button" class="ghost" onclick={share}>{copied ? 'copied' : 'share'}</button>
			<button type="button" class="ghost" onclick={clearGrid}>clear</button>
			<button type="button" class="play" class:on={seq.playing} onclick={togglePlay}>
				{seq.playing ? 'stop' : 'play'}
			</button>
		</div>
	{/snippet}

	<div class="plate">
		<div class="grid" style:--steps={seq.grid[0].length}>
			{#each seq.grid as row, r (r)}
				<span class="row-label">{ROWS[r]}</span>
				{#each row as on, s (s)}
					<button
						type="button"
						class="cell"
						class:on
						class:beat={s % 4 === 0}
						class:playing={seq.playing && s === seq.currentStep}
						aria-label="{ROWS[r]} step {s + 1}"
						aria-pressed={on}
						onpointerdown={padDown(r, s)}
						onpointerenter={padEnter(r, s)}
						onclick={padKey(r, s)}
					></button>
				{/each}
			{/each}
		</div>
	</div>
	<p class="hint">notes share the synth tab's sound — tweak it there, hear it here.</p>
</Panel>

<style>
	.controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.tempo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--halo-text-muted);
		font-variant-numeric: tabular-nums;
	}
	/* Same token-rebuild as RangeSlider: native track ignores CSS vars. */
	.tempo input {
		appearance: none;
		width: 8rem;
		margin: 0;
		background: transparent;
		cursor: ew-resize;
	}
	.tempo input::-webkit-slider-runnable-track {
		height: 0.35rem;
		background: var(--halo-off-bg);
		border-radius: var(--halo-radius-pill);
	}
	.tempo input::-webkit-slider-thumb {
		appearance: none;
		width: 1rem;
		height: 1rem;
		margin-top: -0.33rem;
		border-radius: 50%;
		background: var(--halo-accent);
		box-shadow: var(--halo-shadow);
	}
	.tempo input::-moz-range-track {
		height: 0.35rem;
		background: var(--halo-off-bg);
		border-radius: var(--halo-radius-pill);
	}
	.tempo input::-moz-range-thumb {
		width: 1rem;
		height: 1rem;
		border: none;
		border-radius: 50%;
		background: var(--halo-accent);
	}
	.tempo input:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: 2px;
		border-radius: var(--halo-radius-pill);
	}
	button {
		font-family: var(--halo-font-heading);
		font-size: 0.85rem;
		padding: 0.35rem 0.9rem;
		border: none;
		border-radius: var(--halo-radius-pill);
		cursor: pointer;
		transition:
			background var(--halo-d-fast),
			color var(--halo-d-fast);
	}
	.ghost {
		background: var(--halo-bg-light);
		color: var(--halo-text-muted);
	}
	.ghost:hover {
		color: var(--halo-text-main);
	}
	/* countdown to the next generation: the button fills over one loop.
	   @property makes --p interpolable so the 16 step jumps glide. */
	@property --p {
		syntax: '<percentage>';
		inherits: false;
		initial-value: 0%;
	}
	.life {
		transition: --p 0.15s linear;
	}
	.ghost.lit {
		background: linear-gradient(
			90deg,
			var(--halo-accent-soft) var(--p, 0%),
			var(--halo-bg-light) var(--p, 0%)
		);
		color: var(--halo-accent);
	}
	.play {
		background: var(--halo-accent-soft);
		color: var(--halo-accent);
	}
	.play.on {
		background: var(--halo-accent);
		color: var(--halo-bg-main);
	}
	.grid {
		display: grid;
		grid-template-columns: 2.4rem repeat(var(--steps), 1fr);
		gap: 0.4rem;
		/* center, NOT stretch: stretched cells take the row's height (set by the
		   label text) and aspect-ratio then collapses their width to match.
		   Centered, the pad's height comes from its column width instead and
		   the row grows to fit — pads scale with the screen. */
		align-items: center;
	}
	.row-label {
		font-family: var(--halo-font-heading);
		font-size: 0.7rem;
		color: var(--halo-text-muted);
		align-self: center;
	}
	/* Launchpad-style controller: a dark device plate, matte pads backlit by
	   LEDs — lit pads glow through the cap and spill light into the gaps.
	   The plate is hardware-dark in both themes; oranges are --halo-accent
	   (#f78f08) at varying alphas. */
	.plate {
		background: #161616;
		border-radius: var(--halo-radius);
		padding: 0.6rem;
		box-shadow:
			inset 0 2px 8px rgba(0, 0, 0, 0.6),
			0 1px 2px rgba(0, 0, 0, 0.25);
	}
	.cell {
		width: 100%;
		aspect-ratio: 1;
		padding: 0;
		border: none;
		border-radius: 3px;
		background: #2b2b2b;
		box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.05);
		cursor: pointer;
		/* drag paints pads, not scrolls — same deal as the keyboard */
		touch-action: none;
		transition:
			background var(--halo-d-fast),
			box-shadow var(--halo-d-fast);
	}
	.cell.beat {
		background: #333130;
		box-shadow: inset 0 0 8px rgba(247, 143, 8, 0.1);
	}
	/* lit: the whole cap glows from within, light bleeds into the plate gaps */
	.cell.on {
		background: radial-gradient(
			circle at 50% 42%,
			#ffc985 0%,
			#f99d1f 65%,
			var(--halo-accent) 100%
		);
		box-shadow: 0 0 12px 2px rgba(247, 143, 8, 0.55);
	}
	/* playhead over an unlit pad: LED idling warm */
	.cell.playing {
		background: #443427;
		box-shadow:
			inset 0 0 8px rgba(247, 143, 8, 0.35),
			0 0 8px 1px rgba(247, 143, 8, 0.25);
	}
	/* playhead hits a lit pad: full blast, near-white core */
	.cell.on.playing {
		background: radial-gradient(
			circle at 50% 42%,
			#ffe9c4 0%,
			#ffb74d 55%,
			var(--halo-accent) 100%
		);
		box-shadow: 0 0 18px 4px rgba(247, 143, 8, 0.75);
	}
	.hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--halo-text-muted);
	}
	@media (max-width: 640px) {
		.controls {
			flex-wrap: wrap;
		}
	}
	/* Portrait phone: squeeze the label column + gaps so 16 steps stay tappable. */
	@media (max-width: 640px) and (orientation: portrait) {
		.grid {
			grid-template-columns: 1.6rem repeat(var(--steps), 1fr);
			gap: 0.2rem;
		}
		.row-label {
			font-size: 0.6rem;
		}
	}
</style>
