<script lang="ts">
	import '$lib/styles/halo.css';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { engine } from '$lib/engine/engine';
	import { params } from '$lib/params.svelte';
	import { applyShareHash } from '$lib/share';

	let { children } = $props();

	// Warm the audio path on ANY touch, not the first note: building the
	// context + (on iOS) the media-element output mid-note swallows that
	// note's envelope — the "first press is silent" effect. ensure() is
	// idempotent and near-free once built, so capture-phase every time.
	function warmAudio(): void {
		engine.ensure();
	}

	// shared pattern/patch links carry state in the hash — apply once on boot
	$effect(() => applyShareHash());

	const tabs = [
		{ href: '/', label: 'synth' },
		{ href: '/seq', label: 'sequencer' },
		{ href: '/pad', label: 'pad' }
	] as const;
</script>

<svelte:window onpointerdowncapture={warmAudio} onkeydowncapture={warmAudio} />

<svelte:head>
	<title>supersaw</title>
</svelte:head>

<div class="shell" class:wide={page.url.pathname === '/seq'} class:lofi={params.lofi}>
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
	/* it's an instrument: no sideways scroll, no rubber-band pull-to-refresh,
	   no text selection or iOS long-press callouts mid-performance */
	:global(html, body) {
		overflow-x: hidden;
		overscroll-behavior: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.shell {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	/* lo-fi mode wears an 80s skin: the accent goes neon magenta (every
	   control, canvas and pad reads it via the CSS var), the page warms up
	   like aged tape, and a CRT scanline overlay sits on top. */
	.shell.lofi {
		--halo-accent: #ff4fa3;
		--halo-accent-soft: rgba(255, 79, 163, 0.16);
		filter: sepia(0.22) saturate(1.25) contrast(1.03);
	}
	.shell.lofi::after {
		content: '';
		position: fixed;
		inset: 0;
		z-index: 99;
		pointer-events: none;
		background: repeating-linear-gradient(
			0deg,
			rgba(0, 0, 0, 0.07) 0,
			rgba(0, 0, 0, 0.07) 1px,
			transparent 1px,
			transparent 3px
		);
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
