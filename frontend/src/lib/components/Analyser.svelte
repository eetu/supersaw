<script lang="ts">
	import { engine } from '$lib/engine/engine';

	let canvas: HTMLCanvasElement | undefined = $state();

	$effect(() => {
		if (!canvas) return;
		const c2d = canvas.getContext('2d');
		if (!c2d) return;
		const { width, height } = canvas;
		const data = new Uint8Array(2048);
		let raf = 0;

		// Oscilloscope graticule: dashed division lines behind the trace.
		const drawGrid = (styles: CSSStyleDeclaration): void => {
			const cols = 8;
			const rows = 4;
			c2d.save();
			c2d.globalAlpha = 0.25;
			c2d.strokeStyle = styles.getPropertyValue('--halo-text-muted');
			c2d.lineWidth = 1;
			c2d.setLineDash([8, 8]);
			c2d.beginPath();
			for (let i = 1; i < cols; i++) {
				const x = (width / cols) * i;
				c2d.moveTo(x, 0);
				c2d.lineTo(x, height);
			}
			for (let i = 1; i < rows; i++) {
				const y = (height / rows) * i;
				c2d.moveTo(0, y);
				c2d.lineTo(width, y);
			}
			c2d.stroke();
			c2d.restore();
		};

		const draw = (): void => {
			raf = requestAnimationFrame(draw);
			const styles = getComputedStyle(canvas!);
			c2d.fillStyle = styles.getPropertyValue('--halo-bg-light');
			c2d.fillRect(0, 0, width, height);
			drawGrid(styles);

			if (engine.analyser) engine.analyser.getByteTimeDomainData(data);
			else data.fill(128);

			c2d.lineWidth = 2;
			c2d.strokeStyle = styles.getPropertyValue('--halo-accent');
			c2d.beginPath();
			const slice = width / data.length;
			for (let i = 0; i < data.length; i++) {
				const y = (data[i] / 128) * (height / 2);
				if (i === 0) c2d.moveTo(0, y);
				else c2d.lineTo(i * slice, y);
			}
			c2d.stroke();
		};
		draw();
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="bezel">
	<canvas bind:this={canvas} width="600" height="120"></canvas>
</div>

<style>
	/* Recessed scope screen. The inset shadow lives on an ::after overlay:
	   inset box-shadow paints behind replaced content, so putting it on the
	   canvas itself would render it invisible. */
	.bezel {
		position: relative;
		border-radius: var(--halo-radius);
		width: 100%;
		height: 100%;
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
	/* Absolute so the canvas's intrinsic buffer size (600x120) never feeds
	   back into layout — the bezel takes its height from the flex row (the
	   slider column), and the canvas just fills it. */
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border-radius: var(--halo-radius);
	}
</style>
