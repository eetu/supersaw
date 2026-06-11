<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		actions,
		children
	}: {
		title: string;
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section class="halo-card panel">
	<header>
		<h2>{title}</h2>
		{#if actions}
			<div class="actions">{@render actions()}</div>
		{/if}
	</header>
	{@render children()}
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	/* Portrait phone: cards give their padding back to the controls. */
	@media (max-width: 640px) and (orientation: portrait) {
		.panel {
			padding: 0.6rem;
			gap: 0.6rem;
		}
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	h2 {
		margin: 0;
		font-family: var(--halo-font-heading);
		font-size: 1.05rem;
		font-weight: 600;
	}
</style>
