<script lang="ts">
	// T-800 shades — flat brow bar, solid wrap lenses. Family stroke language
	// (currentColor, round joins) so it inherits the button's color.
	let { size = 18 }: { size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d="M1.5 8.5h21" />
	<path d="M3 8.5l1 4.6a2.4 2.4 0 0 0 2.4 1.9h2a2.4 2.4 0 0 0 2.3-1.8l1-4.7" fill="currentColor" />
	<path
		d="M12.3 8.5l1 4.7a2.4 2.4 0 0 0 2.3 1.8h2a2.4 2.4 0 0 0 2.4-1.9l1-4.6"
		fill="currentColor"
	/>
</svg>
