<script lang="ts">
	import { engine } from '$lib/engine/engine';

	let canvas: HTMLCanvasElement | undefined = $state();

	const SEGMENTS = 24;
	const HOT_SEGMENTS = 2; // top of the ladder = clip zone, drawn in error color
	const FLOOR_DB = -60;

	$effect(() => {
		if (!canvas) return;
		const c2d = canvas.getContext('2d');
		if (!c2d) return;
		const { width, height } = canvas;
		const data = new Float32Array(2048);
		let raf = 0;
		let level = 0; // smoothed 0..1 (dB-normalized), fast attack / slow release
		let peak = 0;
		let peakAge = 0;

		const draw = (): void => {
			raf = requestAnimationFrame(draw);
			const styles = getComputedStyle(canvas!);

			let rms = 0;
			if (engine.analyser) {
				engine.analyser.getFloatTimeDomainData(data);
				let sum = 0;
				for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
				rms = Math.sqrt(sum / data.length);
			}
			const db = 20 * Math.log10(Math.max(rms, 1e-6));
			const norm = Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
			level = norm > level ? norm : level * 0.92;
			if (level >= peak) {
				peak = level;
				peakAge = 0;
			} else if (peakAge++ > 30) {
				peak *= 0.96;
			}

			c2d.fillStyle = styles.getPropertyValue('--halo-bg-light');
			c2d.fillRect(0, 0, width, height);

			const gap = 3;
			const segHeight = (height - gap) / SEGMENTS - gap;
			const lit = Math.round(level * SEGMENTS);
			const accent = styles.getPropertyValue('--halo-accent');
			const error = styles.getPropertyValue('--halo-error');
			const off = styles.getPropertyValue('--halo-off-bg');
			for (let i = 0; i < SEGMENTS; i++) {
				const y = height - (i + 1) * (segHeight + gap);
				const hot = i >= SEGMENTS - HOT_SEGMENTS;
				c2d.globalAlpha = i < lit ? 1 : 0.35;
				c2d.fillStyle = i < lit ? (hot ? error : accent) : off;
				c2d.fillRect(gap, y, width - gap * 2, segHeight);
			}
			c2d.globalAlpha = 1;

			// peak-hold line
			if (peak > 0.01) {
				const y = Math.max(1, height - peak * height);
				c2d.fillStyle = styles.getPropertyValue('--halo-text-main');
				c2d.fillRect(gap, y - 1, width - gap * 2, 2);
			}
		};
		draw();
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="bezel">
	<canvas bind:this={canvas} width="36" height="360"></canvas>
</div>

<style>
	/* Same recessed-screen treatment as the analyser (inset shadow must live
	   on an overlay — it paints behind replaced content like canvas). */
	.bezel {
		position: relative;
		border-radius: var(--halo-radius);
		width: 2.2rem;
	}
	.bezel::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		box-shadow:
			inset 0 2px 5px rgba(0, 0, 0, 0.22),
			inset 0 -1px 2px rgba(255, 255, 255, 0.5);
	}
	@media (prefers-color-scheme: dark) {
		.bezel::after {
			box-shadow:
				inset 0 2px 6px rgba(0, 0, 0, 0.65),
				inset 0 -1px 1px rgba(255, 255, 255, 0.08);
		}
	}
	/* Absolute for the same reason as the analyser: keep the 360px-tall
	   buffer's intrinsic size out of flex layout. */
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border-radius: var(--halo-radius);
	}
</style>
