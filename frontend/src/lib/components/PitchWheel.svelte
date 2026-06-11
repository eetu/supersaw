<script lang="ts">
	import { engine } from '$lib/engine/engine';

	// ± bend range in semitones (the classic wheel default)
	const RANGE = 2;

	let bend = $state(0);

	const apply = (): void => engine.setPitchBend(bend * RANGE);
	// spring return: the wheel snaps back to center on release; the engine's
	// setTargetAtTime smoothing turns the snap into a quick natural glide
	const reset = (): void => {
		bend = 0;
		engine.setPitchBend(0);
	};
</script>

<label class="wheel">
	<input
		type="range"
		min="-1"
		max="1"
		step="0.01"
		bind:value={bend}
		oninput={apply}
		onpointerup={reset}
		onpointercancel={reset}
		onkeyup={reset}
		onblur={reset}
	/>
	<span class="name">pitch</span>
</label>

<style>
	.wheel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 3.2rem;
	}
	/* Same token-rebuild as RangeSlider — native track ignores CSS vars. */
	/* Fixed length: a vertical range's intrinsic size would otherwise inflate
	   the keyboard row. 11rem keyboard − label − gap ≈ 9rem. */
	input {
		appearance: none;
		writing-mode: vertical-lr;
		direction: rtl;
		height: 9rem;
		width: 100%;
		margin: 0;
		background: transparent;
		cursor: ns-resize;
	}
	input::-webkit-slider-runnable-track {
		width: 0.35rem;
		background: var(--halo-off-bg);
		border-radius: var(--halo-radius-pill);
	}
	input::-webkit-slider-thumb {
		appearance: none;
		width: 1rem;
		height: 1rem;
		margin-left: -0.33rem;
		border-radius: 50%;
		background: var(--halo-accent);
		box-shadow: var(--halo-shadow);
	}
	input::-moz-range-track {
		width: 0.35rem;
		background: var(--halo-off-bg);
		border-radius: var(--halo-radius-pill);
	}
	input::-moz-range-thumb {
		width: 1rem;
		height: 1rem;
		border: none;
		border-radius: 50%;
		background: var(--halo-accent);
	}
	input:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: 2px;
		border-radius: var(--halo-radius-pill);
	}
	.name {
		font-family: var(--halo-font-heading);
		font-size: 0.75rem;
		color: var(--halo-text-muted);
		text-transform: lowercase;
	}
	/* Portrait phone: the wheel lies down — horizontal, full width, under the
	   keyboard (see the synth page's kb-row column-reverse). */
	@media (max-width: 640px) and (orientation: portrait) {
		.wheel {
			width: 100%;
		}
		input {
			writing-mode: horizontal-tb;
			direction: ltr;
			height: 1.2rem;
		}
		input::-webkit-slider-runnable-track {
			width: auto;
			height: 0.35rem;
		}
		input::-webkit-slider-thumb {
			margin-left: 0;
			margin-top: -0.33rem;
		}
		input::-moz-range-track {
			width: auto;
			height: 0.35rem;
		}
	}
</style>
