<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';

	import Panel from '$lib/components/Panel.svelte';
	import { clearGrid, ROWS, seq, STEPS, togglePlay } from '$lib/sequencer.svelte';
	import { shareUrl } from '$lib/share';

	let copied = $state(false);

	async function share(): Promise<void> {
		const url = shareUrl();
		history.replaceState(null, '', url);
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	// Taps cycle velocity: off → full → mid → low → off. Drag-to-draw paints
	// the value the first pad got (so dragging from an off pad lays full-velocity
	// steps, dragging from a lit one erases). null = not painting.
	let brush: number | null = null;

	const cycle = (level: number): number => (level === 0 ? 3 : level - 1);

	const padDown = (r: number, s: number) => (e: PointerEvent) => {
		// release the implicit capture so pointerenter fires on other pads
		(e.target as Element).releasePointerCapture(e.pointerId);
		brush = cycle(seq.grid[r][s]);
		seq.grid[r][s] = brush;
	};
	const padEnter = (r: number, s: number) => (e: PointerEvent) => {
		if (brush !== null && e.buttons) seq.grid[r][s] = brush;
	};
	// keyboard activation still cycles (click with detail 0 = Enter/Space);
	// pointer clicks already handled that on pointerdown
	const padKey = (r: number, s: number) => (e: MouseEvent) => {
		if (e.detail === 0) seq.grid[r][s] = cycle(seq.grid[r][s]);
	};

	// --- pitch window: width decides the cell size (1fr columns can't
	// overflow), measured height decides how many FULL rows fit — the plate
	// never grows the page. seq.viewRows is the target (8 compact / 16
	// expanded); fewer render when the viewport is short. ---
	let trackEl: HTMLDivElement | undefined = $state();
	let plateEl: HTMLDivElement | undefined = $state();
	let gridW = $state(0);
	let winH = $state(0);
	let plateTop = $state(0);

	function measure(): void {
		winH = window.innerHeight;
		plateTop = plateEl?.getBoundingClientRect().top ?? 0;
	}
	// measure after layout, when the grid width settles, and on every resize
	$effect(() => {
		void gridW;
		measure();
		window.addEventListener('resize', measure);
		return () => window.removeEventListener('resize', measure);
	});

	const rem = (): number =>
		typeof document === 'undefined'
			? 16
			: parseFloat(getComputedStyle(document.documentElement).fontSize);
	const portrait = (): boolean =>
		typeof window !== 'undefined' &&
		window.matchMedia('(max-width: 640px) and (orientation: portrait)').matches;

	const cellPx = $derived.by(() => {
		const r = rem();
		const label = (portrait() ? 1.6 : 2.4) * r;
		const gap = (portrait() ? 0.2 : 0.4) * r;
		return Math.max(8, (gridW - label - gap * STEPS) / STEPS);
	});
	const visibleRows = $derived.by(() => {
		const gap = (portrait() ? 0.2 : 0.4) * rem();
		const budget = winH - plateTop - 2.5 * rem();
		const fit = Math.floor(budget / (cellPx + gap));
		return Math.max(2, Math.min(fit, ROWS.length));
	});
	const maxTop = $derived(ROWS.length - visibleRows);
	const thumbPct = $derived((visibleRows / ROWS.length) * 100);
	const thumbTopPct = $derived((Math.min(seq.viewTop, maxTop) / ROWS.length) * 100);

	function scroll(delta: number): void {
		seq.viewTop = Math.max(0, Math.min(maxTop, Math.min(seq.viewTop, maxTop) + delta));
	}

	function railSeek(e: PointerEvent): void {
		if (!trackEl) return;
		const rect = trackEl.getBoundingClientRect();
		const f = (e.clientY - rect.top) / rect.height;
		seq.viewTop = Math.max(0, Math.min(maxTop, Math.round(f * ROWS.length - visibleRows / 2)));
	}
	function railDown(e: PointerEvent): void {
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		railSeek(e);
	}
	function railMove(e: PointerEvent): void {
		if (e.buttons) railSeek(e);
	}
	function onGridWheel(e: WheelEvent): void {
		e.preventDefault();
		scroll(Math.sign(e.deltaY));
	}
	// arrow keys scroll the pitch window (unless a control owns the focus)
	function onkeydown(e: KeyboardEvent): void {
		if ((e.target as HTMLElement | null)?.matches('input, select, textarea')) return;
		if (e.code === 'ArrowUp') {
			e.preventDefault();
			scroll(-1);
		} else if (e.code === 'ArrowDown') {
			e.preventDefault();
			scroll(1);
		}
	}
</script>

<svelte:window onpointerup={() => (brush = null)} onblur={() => (brush = null)} {onkeydown} />

<Panel title="sequencer">
	{#snippet actions()}
		<div class="controls">
			<label class="mini tempo">
				<span>{seq.tempo} bpm</span>
				<input type="range" min="40" max="240" step="1" bind:value={seq.tempo} />
			</label>
			<label class="mini">
				<span>swing</span>
				<input type="range" min="0" max="1" step="0.01" bind:value={seq.swing} />
			</label>
			<label class="mini">
				<span>chance</span>
				<input type="range" min="0.1" max="1" step="0.01" bind:value={seq.chance} />
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

	<div class="plate" bind:this={plateEl} onwheel={onGridWheel}>
		<div
			class="grid"
			id="seq-grid"
			bind:clientWidth={gridW}
			style:--steps={STEPS}
			style:--cellpx="{cellPx}px"
		>
			{#each { length: visibleRows } as _, i (i)}
				{@const r = Math.min(seq.viewTop, maxTop) + i}
				<span class="row-label">{ROWS[r]}</span>
				{#each seq.grid[r] as level, s (s)}
					<button
						type="button"
						class="cell v{level}"
						class:on={level > 0}
						class:beat={s % 4 === 0}
						class:playing={seq.playing && s === seq.currentStep}
						aria-label="{ROWS[r]} step {s + 1}, velocity {level}/3"
						aria-pressed={level > 0}
						onpointerdown={padDown(r, s)}
						onpointerenter={padEnter(r, s)}
						onclick={padKey(r, s)}
					></button>
				{/each}
			{/each}
		</div>
		<div class="rail">
			<button type="button" aria-label="scroll up" onclick={() => scroll(-1)}>
				<ChevronUp size={14} aria-hidden="true" />
			</button>
			<div
				class="track"
				bind:this={trackEl}
				role="scrollbar"
				aria-controls="seq-grid"
				aria-orientation="vertical"
				aria-valuenow={seq.viewTop}
				aria-valuemin={0}
				aria-valuemax={maxTop}
				tabindex={-1}
				onpointerdown={railDown}
				onpointermove={railMove}
			>
				<div class="thumb" style:height="{thumbPct}%" style:top="{thumbTopPct}%"></div>
			</div>
			<button type="button" aria-label="scroll down" onclick={() => scroll(1)}>
				<ChevronDown size={14} aria-hidden="true" />
			</button>
		</div>
	</div>
</Panel>

<style>
	.controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.mini {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--halo-text-muted);
		font-variant-numeric: tabular-nums;
	}
	/* Same token-rebuild as RangeSlider: native track ignores CSS vars. */
	.mini input {
		appearance: none;
		width: 5rem;
		margin: 0;
		background: transparent;
		cursor: ew-resize;
	}
	.tempo input {
		width: 8rem;
	}
	.mini input::-webkit-slider-runnable-track {
		height: 0.35rem;
		background: var(--halo-off-bg);
		border-radius: var(--halo-radius-pill);
	}
	.mini input::-webkit-slider-thumb {
		appearance: none;
		width: 1rem;
		height: 1rem;
		margin-top: -0.33rem;
		border-radius: 50%;
		background: var(--halo-accent);
		box-shadow: var(--halo-shadow);
	}
	.mini input::-moz-range-track {
		height: 0.35rem;
		background: var(--halo-off-bg);
		border-radius: var(--halo-radius-pill);
	}
	.mini input::-moz-range-thumb {
		width: 1rem;
		height: 1rem;
		border: none;
		border-radius: 50%;
		background: var(--halo-accent);
	}
	.mini input:focus-visible {
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
		flex: 1;
		min-width: 0;
		display: grid;
		/* columns are 1fr — width can never overflow; the script measures the
		   resulting cell width and renders only as many full rows as fit the
		   viewport, each exactly one cell tall (squares by construction) */
		grid-template-columns: 2.4rem repeat(var(--steps), 1fr);
		grid-auto-rows: var(--cellpx);
		gap: 0.4rem;
		align-items: stretch;
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
		display: flex;
		gap: 0.5rem;
		background: #161616;
		border-radius: var(--halo-radius);
		padding: 0.6rem;
		box-shadow:
			inset 0 2px 8px rgba(0, 0, 0, 0.6),
			0 1px 2px rgba(0, 0, 0, 0.25);
	}
	.rail {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.3rem;
		width: 1.1rem;
	}
	.rail button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.1rem 0;
		border: none;
		border-radius: 3px;
		background: #2b2b2b;
		color: var(--halo-text-muted);
		cursor: pointer;
	}
	.rail button:hover {
		color: var(--halo-accent);
	}
	.track {
		position: relative;
		flex: 1;
		border-radius: 3px;
		background: #2b2b2b;
		cursor: pointer;
		touch-action: none;
	}
	.thumb {
		position: absolute;
		left: 2px;
		right: 2px;
		border-radius: 3px;
		background: var(--halo-text-muted);
		pointer-events: none;
	}
	.cell {
		position: relative;
		width: 100%;
		height: 100%;
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
	/* invisible hit-slop: taps landing in the gaps still hit the nearest pad
	   (each pad claims half the gap — crucial at iPhone pad sizes) */
	.cell::after {
		content: '';
		position: absolute;
		inset: -0.1rem;
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
	/* velocity = LED brightness (filter dims the spilled glow too) */
	.cell.v2 {
		filter: brightness(0.72);
	}
	.cell.v1 {
		filter: brightness(0.45);
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
	@media (max-width: 640px) {
		.controls {
			flex-wrap: wrap;
		}
	}
	/* Portrait phone: squeeze the label column + gaps so 16 steps stay tappable;
	   controls flow as compact full-width rows under the title. */
	@media (max-width: 640px) and (orientation: portrait) {
		.grid {
			/* same 1fr columns as desktop (they can't overflow), just a slimmer
			   label + gap; the script already sizes cellPx/rows for portrait */
			grid-template-columns: 1.6rem repeat(var(--steps), 1fr);
			gap: 0.2rem;
		}
		.row-label {
			font-size: 0.6rem;
		}
		.controls {
			width: 100%;
			flex-wrap: wrap;
			gap: 0.8rem 0.5rem;
		}
		/* sliders: one full-width row each, labels aligned; buttons share a row */
		.mini {
			width: 100%;
		}
		.mini span {
			flex: none;
			width: 3.6rem;
		}
		.mini input,
		.tempo input {
			flex: 1;
			width: auto;
		}
		.controls button {
			flex: 1;
		}
	}
</style>
