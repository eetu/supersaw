<script lang="ts">
	import type { Waveform } from '$lib/engine/voice';

	import WaveIcon from './WaveIcon.svelte';

	let {
		value = $bindable()
	}: {
		value: Waveform;
	} = $props();

	const waves: Waveform[] = ['sine', 'square', 'sawtooth', 'triangle', 'supersaw', 'organ'];
</script>

<div class="waves" role="radiogroup" aria-label="waveform">
	{#each waves as wave (wave)}
		<button
			type="button"
			role="radio"
			aria-checked={value === wave}
			aria-label={wave}
			title={wave}
			class:active={value === wave}
			onclick={() => (value = wave)}
		>
			<WaveIcon {wave} />
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
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem 0.55rem;
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
	@media (max-width: 640px) and (orientation: portrait) {
		.waves {
			gap: 0.2rem;
		}
		button {
			padding: 0.3rem 0.45rem;
		}
	}
</style>
