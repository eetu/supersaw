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

	const lfoTargets: LfoTarget[] = ['off', 'pitch', 'filter'];

	// the LFO is engine-global hardware — push param changes to it live
	$effect(() => engine.setLfo(params.lfoRate, params.lfoDepth, params.lfoTarget));
</script>

<Panel title="oscillator">
	{#snippet actions()}
		<button
			type="button"
			class="knob-toggle"
			aria-expanded={showKnobs}
			onclick={() => (showKnobs = !showKnobs)}
		>
			shaping
		</button>
		<FlipSwitch label="poly" bind:checked={params.poly} />
	{/snippet}
	<WaveSelect bind:value={params.wave} />
	<div class="sliders">
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
		<div class="scope">
			<Analyser />
			<VuMeter />
		</div>
	</div>
</Panel>

<Panel title="filter + lfo">
	<div class="sliders">
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
	</div>
</Panel>

<Panel title="keyboard">
	<div class="kb-row">
		<PitchWheel />
		<div class="kb"><Keyboard /></div>
	</div>
</Panel>

<style>
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
