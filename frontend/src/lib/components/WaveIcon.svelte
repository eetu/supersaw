<script lang="ts">
	// Waveform glyphs in the Lucide stroke language (24 box, stroke 2, round
	// caps, currentColor) — one cycle each; supersaw fans three ramps, organ
	// is a rank of pipes.
	import type { Waveform } from '$lib/engine/voice';

	let { wave, size = 18 }: { wave: Waveform; size?: number } = $props();

	const paths: Record<Waveform, string[]> = {
		sine: ['M3 12c2.5-7 6.5-7 9 0s6.5 7 9 0'],
		square: ['M3 17V7h9v10h9V7'],
		sawtooth: ['M3 17 12 7v10l9-10'],
		triangle: ['m3 12 4.5-5 9 10L21 12'],
		supersaw: ['M3 17 12 7v10', 'M7.5 17 16.5 7', 'M12 17 21 7'],
		organ: ['M7 18V7', 'M12 18V4', 'M17 18V9', 'M5 18h14']
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#each paths[wave] as d (d)}
		<path {d} />
	{/each}
</svg>
