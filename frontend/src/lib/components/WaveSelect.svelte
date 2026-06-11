<script lang="ts">
	import type { Waveform } from '$lib/engine/voice';

	let {
		value = $bindable()
	}: {
		value: Waveform;
	} = $props();

	const waves: Waveform[] = ['sine', 'square', 'sawtooth', 'triangle', 'supersaw'];
</script>

<div class="waves" role="radiogroup" aria-label="waveform">
	{#each waves as wave (wave)}
		<button
			type="button"
			role="radio"
			aria-checked={value === wave}
			class:active={value === wave}
			onclick={() => (value = wave)}
		>
			{wave}
		</button>
	{/each}
</div>

<style>
	.waves {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	button {
		font-family: var(--halo-font-heading);
		font-size: 0.8rem;
		padding: 0.35rem 0.7rem;
		border: none;
		border-radius: var(--halo-radius-pill);
		background: var(--halo-bg-light);
		color: var(--halo-text-muted);
		cursor: pointer;
		transition:
			background var(--halo-d-fast),
			color var(--halo-d-fast);
	}
	button:hover {
		color: var(--halo-text-main);
	}
	button.active {
		background: var(--halo-accent-soft);
		color: var(--halo-accent);
	}
	/* Portrait phone: tighter pills so all five waveforms share one row. */
	@media (max-width: 640px) and (orientation: portrait) {
		.waves {
			gap: 0.2rem;
			flex-wrap: nowrap;
		}
		button {
			font-size: 0.7rem;
			padding: 0.3rem 0.45rem;
		}
	}
</style>
