<script lang="ts">
	import Analyser from '$lib/components/Analyser.svelte';
	import FlipSwitch from '$lib/components/FlipSwitch.svelte';
	import Keyboard from '$lib/components/Keyboard.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import PitchWheel from '$lib/components/PitchWheel.svelte';
	import RangeSlider from '$lib/components/RangeSlider.svelte';
	import VuMeter from '$lib/components/VuMeter.svelte';
	import WaveSelect from '$lib/components/WaveSelect.svelte';
	import { engine, type LfoTarget } from '$lib/engine/engine';
	import { params } from '$lib/params.svelte';

	// portrait phones: shaping sliders are collapsed by default (CSS shows them
	// unconditionally on bigger screens, the toggle button only exists there)
	let showKnobs = $state(false);

	// one controls card, tabbed — keeps the keyboard on screen
	let tab: 'osc' | 'filter' = $state('osc');

	const lfoTargets: LfoTarget[] = ['off', 'pitch', 'filter'];
	const waves = ['sine', 'square', 'sawtooth', 'triangle', 'supersaw'] as const;

	// Randomize the sound, constrained to stay audible and non-hostile:
	// cutoff never fully closed, resonance off the self-oscillation zone,
	// envelope times biased short (squared roll).
	function randomize(): void {
		const r = Math.random;
		params.wave = waves[Math.floor(r() * waves.length)];
		params.detune = r();
		params.mix = r();
		params.spread = r();
		params.attack = r() ** 2 * 0.5;
		params.decay = 0.02 + r() ** 2 * 0.5;
		params.sustain = 0.3 + r() * 0.7;
		params.release = r() ** 2;
		params.distortion = Math.round(r() ** 2 * 60);
		params.cutoff = 0.25 + r() * 0.75;
		params.resonance = r() * 0.7;
		params.filterEnv = r();
		params.lfoRate = r();
		params.lfoDepth = r() * 0.8;
		params.lfoTarget = lfoTargets[Math.floor(r() * lfoTargets.length)];
	}

	// the LFO is engine-global hardware — push param changes to it live
	$effect(() => engine.setLfo(params.lfoRate, params.lfoDepth, params.lfoTarget));
	// filter knobs retarget already-sounding voices too
	$effect(() =>
		engine.setFilter(params.cutoff, params.resonance, params.filterEnv, params.sustain)
	);
</script>

<section class="halo-card controls">
	<header>
		<nav class="ctl-tabs" aria-label="control sections">
			<button class:active={tab === 'osc'} onclick={() => (tab = 'osc')}>oscillator</button>
			<button class:active={tab === 'filter'} onclick={() => (tab = 'filter')}>
				filter + lfo
			</button>
		</nav>
		<div class="header-actions">
			<button type="button" class="dice" onclick={randomize} title="randomize controls">
				<span class="material-icons-outlined">casino</span>
			</button>
			<button
				type="button"
				class="knob-toggle"
				aria-expanded={showKnobs}
				onclick={() => (showKnobs = !showKnobs)}
			>
				shaping
			</button>
			<FlipSwitch label="poly" bind:checked={params.poly} />
		</div>
	</header>

	{#if tab === 'osc'}
		<WaveSelect bind:value={params.wave} />
	{/if}

	<div class="sliders">
		{#if tab === 'osc'}
			<div class="knobs" class:open={showKnobs}>
				{#if params.wave === 'supersaw'}
					<RangeSlider label="detune" bind:value={params.detune} step={0.1} />
					<RangeSlider label="mix" bind:value={params.mix} step={0.1} />
					<RangeSlider label="spread" bind:value={params.spread} step={0.1} />
				{/if}
				<RangeSlider label="att" bind:value={params.attack} />
				<RangeSlider label="dec" bind:value={params.decay} />
				<RangeSlider label="sus" bind:value={params.sustain} />
				<RangeSlider label="rel" bind:value={params.release} />
				<RangeSlider label="dist" bind:value={params.distortion} max={100} step={1} />
				{#if !params.poly}
					<RangeSlider label="glide" bind:value={params.glide} max={2} />
				{/if}
			</div>
		{:else}
			<div class="knobs" class:open={showKnobs}>
				<RangeSlider label="cutoff" bind:value={params.cutoff} />
				<RangeSlider label="res" bind:value={params.resonance} />
				<RangeSlider label="env" bind:value={params.filterEnv} />
				<RangeSlider label="rate" bind:value={params.lfoRate} />
				<RangeSlider label="depth" bind:value={params.lfoDepth} />
			</div>
			<div class="lfo-target" role="radiogroup" aria-label="lfo target">
				{#each lfoTargets as target (target)}
					<button
						type="button"
						role="radio"
						aria-checked={params.lfoTarget === target}
						class:active={params.lfoTarget === target}
						onclick={() => (params.lfoTarget = target)}
					>
						{target}
					</button>
				{/each}
			</div>
		{/if}
		<div class="scope">
			<Analyser />
			<VuMeter />
		</div>
	</div>
</section>

<Panel title="keyboard">
	<div class="kb-row">
		<PitchWheel />
		<div class="kb"><Keyboard /></div>
	</div>
</Panel>

<style>
	.controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.controls header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.dice {
		display: inline-flex;
		padding: 0.25rem;
		border: none;
		border-radius: var(--halo-radius-pill);
		background: none;
		color: var(--halo-text-muted);
		cursor: pointer;
		transition:
			color var(--halo-d-fast),
			transform var(--halo-d-fast);
	}
	.dice:hover {
		color: var(--halo-accent);
	}
	.dice:active {
		transform: rotate(72deg);
	}
	.dice .material-icons-outlined {
		font-size: 1.25rem;
	}
	/* in-card tabs echo the top nav: underline, accent when active */
	.ctl-tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--halo-border);
	}
	.ctl-tabs button {
		font-family: var(--halo-font-heading);
		font-size: 0.95rem;
		font-weight: 600;
		padding: 0.35rem 0.9rem;
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		background: none;
		color: var(--halo-text-muted);
		cursor: pointer;
		transition: color var(--halo-d-fast);
	}
	.ctl-tabs button:hover {
		color: var(--halo-text-main);
	}
	.ctl-tabs button.active {
		color: var(--halo-accent);
		border-bottom-color: var(--halo-accent);
	}
	@media (max-width: 640px) and (orientation: portrait) {
		.controls {
			padding: 0.6rem;
			gap: 0.6rem;
		}
	}
	.sliders {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.knobs {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	/* desktop/landscape: sliders always visible, no toggle */
	.knob-toggle {
		display: none;
		font-family: var(--halo-font-heading);
		font-size: 0.8rem;
		padding: 0.35rem 0.7rem;
		border: none;
		border-radius: var(--halo-radius-pill);
		background: var(--halo-bg-light);
		color: var(--halo-text-muted);
		cursor: pointer;
		align-self: flex-start;
	}
	.knob-toggle[aria-expanded='true'] {
		background: var(--halo-accent-soft);
		color: var(--halo-accent);
	}
	.lfo-target {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-self: center;
	}
	.lfo-target button {
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
	.lfo-target button:hover {
		color: var(--halo-text-main);
	}
	.lfo-target button.active {
		background: var(--halo-accent-soft);
		color: var(--halo-accent);
	}
	.kb-row {
		display: flex;
		align-items: stretch;
		gap: 0.75rem;
	}
	.kb {
		flex: 1;
	}
	.scope {
		flex: 1;
		min-width: 200px;
		align-self: stretch;
		display: flex;
		align-items: stretch;
		gap: 0.5rem;
	}
	.scope > :global(:first-child) {
		flex: 1;
	}
	/* Portrait phone: scope hops above the sliders full-width (fixed height —
	   nothing to inherit it from anymore), wheel drops below the keyboard. */
	@media (max-width: 640px) and (orientation: portrait) {
		.scope {
			order: -1;
			flex-basis: 100%;
			height: 7rem;
			min-width: 0;
		}
		.kb-row {
			flex-direction: column-reverse;
		}
		.knob-toggle {
			display: inline-flex;
		}
		.knobs {
			display: none;
		}
		.knobs.open {
			display: flex;
			gap: 0.3rem;
			flex-wrap: nowrap;
			/* span the full card width — the slider columns flex to divide it,
			   so they grow on wide phones and narrow together on small ones */
			width: 100%;
		}
	}
</style>
