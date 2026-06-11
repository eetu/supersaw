<script lang="ts">
	import FlipSwitch from '$lib/components/FlipSwitch.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import { engine } from '$lib/engine/engine';
	import { frequency, type Note } from '$lib/engine/notes';
	import { params } from '$lib/params.svelte';

	// Theremin surface: x = pitch over two octaves (quantized to the pentatonic
	// or continuous), y = filter cutoff. One continuous voice via the engine's
	// pad API — shares the synth tab's sound like everything else.

	const SCALE: Note[] = ['C4', 'D#4', 'F4', 'G4', 'A#4', 'C5', 'D#5', 'F5', 'G5', 'A#5', 'C6'];

	let quantize = $state(true);
	let active = $state(false);
	let x = $state(0.5);
	let y = $state(0.3);

	function freqAt(fx: number): number {
		if (quantize) return frequency(SCALE[Math.round(fx * (SCALE.length - 1))]);
		return frequency('C4') * 2 ** (fx * 2);
	}

	// y up = open; floor 0.15 keeps the bottom edge audible
	const cutoffAt = (fy: number): number => 0.15 + (1 - fy) * 0.85;

	function pos(e: PointerEvent): { fx: number; fy: number } {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		return {
			fx: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
			fy: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
		};
	}

	function down(e: PointerEvent): void {
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		const { fx, fy } = pos(e);
		x = fx;
		y = fy;
		engine.padOn(freqAt(fx), { ...params, cutoff: cutoffAt(fy) });
		active = true;
	}

	function move(e: PointerEvent): void {
		if (!active) return;
		const { fx, fy } = pos(e);
		x = fx;
		y = fy;
		engine.padGlide(freqAt(fx));
		engine.padFilter(cutoffAt(fy), params.resonance, params.sustain);
	}

	function up(): void {
		if (!active) return;
		engine.padOff();
		active = false;
	}
</script>

<Panel title="pad">
	{#snippet actions()}
		<FlipSwitch label="quantize" bind:checked={quantize} />
	{/snippet}

	<div
		class="surface"
		class:quantized={quantize}
		style:--cols={SCALE.length - 1}
		role="application"
		aria-label="theremin surface: horizontal pitch, vertical filter"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
	>
		<div class="dot" class:on={active} style:left="{x * 100}%" style:top="{y * 100}%"></div>
	</div>
</Panel>

<style>
	/* same hardware-dark plate language as the sequencer */
	.surface {
		position: relative;
		height: 19rem;
		background: #161616;
		border-radius: var(--halo-radius);
		box-shadow:
			inset 0 2px 8px rgba(0, 0, 0, 0.6),
			0 1px 2px rgba(0, 0, 0, 0.25);
		cursor: crosshair;
		touch-action: none;
		overflow: hidden;
	}
	/* scale-degree gridlines when quantized */
	.surface.quantized {
		background-image: repeating-linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.05) 0,
			rgba(255, 255, 255, 0.05) 1px,
			transparent 1px,
			transparent calc(100% / var(--cols))
		);
		background-color: #161616;
	}
	.dot {
		position: absolute;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		background: rgba(247, 143, 8, 0.35);
		transition: background var(--halo-d-fast);
		pointer-events: none;
	}
	.dot.on {
		background: radial-gradient(circle, #ffc985 0%, var(--halo-accent) 70%);
		box-shadow: 0 0 16px 4px rgba(247, 143, 8, 0.55);
	}
</style>
