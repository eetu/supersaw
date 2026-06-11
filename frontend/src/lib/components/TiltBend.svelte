<script lang="ts">
	import { engine } from '$lib/engine/engine';

	// Tilt-to-bend: device roll (gamma, ±90°) maps to ±2 semitones at ±30°.
	// iOS requires an explicit permission request from a user gesture.

	let active = $state(false);

	const supported =
		typeof window !== 'undefined' &&
		'DeviceOrientationEvent' in window &&
		window.matchMedia('(pointer: coarse)').matches;

	function handle(e: DeviceOrientationEvent): void {
		const roll = e.gamma ?? 0;
		engine.setPitchBend(Math.max(-1, Math.min(1, roll / 30)) * 2);
	}

	async function toggle(): Promise<void> {
		if (active) {
			window.removeEventListener('deviceorientation', handle);
			engine.setPitchBend(0);
			active = false;
			return;
		}
		const maybePermission = DeviceOrientationEvent as unknown as {
			requestPermission?: () => Promise<string>;
		};
		if (maybePermission.requestPermission) {
			const result = await maybePermission.requestPermission();
			if (result !== 'granted') return;
		}
		window.addEventListener('deviceorientation', handle);
		active = true;
	}
</script>

{#if supported}
	<button type="button" class:active onclick={toggle} aria-pressed={active}>tilt</button>
{/if}

<style>
	button {
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
	button.active {
		background: var(--halo-accent-soft);
		color: var(--halo-accent);
	}
</style>
