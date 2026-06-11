<script lang="ts">
	let {
		label,
		min = 0,
		max = 1,
		step = 0.01,
		value = $bindable()
	}: {
		label: string;
		min?: number;
		max?: number;
		step?: number;
		value: number;
	} = $props();

	const onwheel = (e: WheelEvent) => {
		e.preventDefault();
		const next = value + Math.sign(-e.deltaY) * step;
		value = Math.min(max, Math.max(min, Number(next.toFixed(4))));
	};
</script>

<label class="slider">
	<input type="range" {min} {max} {step} bind:value {onwheel} />
	<span class="name">{label}</span>
</label>

<style>
	.slider {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 3.2rem;
	}
	/* Native track/thumb don't read CSS vars — appearance:none and rebuild
	   from halo tokens so the control themes with the rest of the app. */
	input {
		appearance: none;
		writing-mode: vertical-lr;
		direction: rtl;
		height: 150px;
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
	/* Portrait phone: shorter tracks, narrow columns — 7 must fit one row. */
	@media (max-width: 640px) and (orientation: portrait) {
		.slider {
			width: auto;
			min-width: 0;
			flex: 1;
		}
		input {
			height: 6.5rem;
		}
		.name {
			font-size: 0.65rem;
		}
	}
</style>
