<script lang="ts">
	// supersaw brand mark: a synth module frame with a sawtooth wave inside —
	// the wave drawn in the warm accent, frame in currentColor, family glyph
	// style. See the supersaw-design skill.
	let { size = 26 }: { size?: number } = $props();
</script>

<span class="halo-wordmark wordmark">
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
		<rect x="2.5" y="4.5" width="19" height="15" rx="2" />
		<path class="saw" d="M6 15.5 10 8.5 V15.5 L14 8.5 V15.5 L18 8.5" />
	</svg>
	<span>super<span class="accent">saw</span></span>
	<!-- Saw (2004) riff, family voice — collapses to the bare wordmark on
	     narrow screens. See the supersaw-design skill. -->
	<span class="riff">i want to play a game.</span>
</span>

<style>
	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: 0.5em;
		font-family: var(--halo-font-heading);
		font-size: 1.4rem;
	}
	.saw {
		stroke: var(--halo-accent);
		stroke-width: 1.5;
	}
	.riff {
		color: var(--halo-text-muted);
		font-weight: 400;
		font-size: 0.9rem;
	}
	@media (max-width: 520px) {
		.riff {
			display: none;
		}
	}
</style>
