<script lang="ts">
	import '$lib/styles/halo.css';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { applyShareHash } from '$lib/share';

	let { children } = $props();

	// shared pattern/patch links carry state in the hash — apply once on boot
	$effect(() => applyShareHash());

	const tabs = [
		{ href: '/', label: 'synth' },
		{ href: '/seq', label: 'sequencer' }
	] as const;
</script>

<svelte:head>
	<title>supersaw</title>
</svelte:head>

<div class="shell" class:wide={page.url.pathname === '/seq'}>
	<header class="top">
		<Wordmark />
	</header>

	<nav class="tabs">
		{#each tabs as tab (tab.href)}
			<a href={resolve(tab.href)} class:active={page.url.pathname === tab.href}>{tab.label}</a>
		{/each}
	</nav>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.shell {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.top {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--halo-border);
	}
	.tabs a {
		padding: 0.5rem 1rem;
		color: var(--halo-text-muted);
		text-decoration: none;
		font-family: var(--halo-font-heading);
		font-size: 0.95rem;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: color var(--halo-d-fast);
	}
	.tabs a:hover {
		color: var(--halo-text-main);
	}
	.tabs a.active {
		color: var(--halo-accent);
		border-bottom-color: var(--halo-accent);
	}
	main {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	/* Portrait phone: tighter shell so the cards get the screen. */
	@media (max-width: 640px) and (orientation: portrait) {
		.shell {
			padding: 0.75rem 0.5rem 2rem;
			gap: 0.75rem;
		}
		main {
			gap: 0.75rem;
		}
	}
</style>
