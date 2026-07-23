<script lang="ts">
	// Ambient repeating sawtooth-waveform texture behind the instrument. A synth is a
	// waveform generator, so the backdrop tiles the sawtooth glyph itself — the way
	// dice tiles pips. The tiling + theming comes from @anarkisti/igyb (glyphTile); we
	// own the glyph and hand igyb the draw callback.
	//
	// This is a *whisper*, not a second oscilloscope. The in-app Analyser owns all the
	// motion (and the accent colour), so the backdrop deliberately holds back:
	//  • not audio-reactive — nothing here listens to the engine;
	//  • near-static — speed 0.3 is a slow breath, never a beat, and reduced motion
	//    freezes it to a single frame;
	//  • glyph colour is only a few channel-steps off the page body colour, under a
	//    mostly-transparent container — err toward invisible;
	//  • keyed off --halo-body only, the one token lo-fi leaves untouched, so it can
	//    never clash with the lo-fi neon-magenta accent or the accent-coloured scope.
	import {
		glyphTile,
		type Palette,
		paletteFromCSS,
		toRgb,
		toRgbString
	} from '@anarkisti/igyb/core';
	import { tick } from 'svelte';

	import { params } from '$lib/params.svelte';

	type Props = { opacity?: number };
	// A true whisper: the container is already mostly transparent, on top of the tiny
	// per-channel colour offset below.
	let { opacity = 0.6 }: Props = $props();

	let el: HTMLDivElement;

	// One sawtooth: ramp up from the bottom-left to a peak, then snap straight down —
	// the ramp of a sawtooth oscillator. Two teeth per tile, drawn edge to edge so the
	// snap carries across the tile seam: each row reads as one continuous sawtooth wave.
	function drawSawtooth(ctx: CanvasRenderingContext2D, size: number): void {
		const teeth = 2;
		const amp = size * 0.2; // peak-to-peak stays well inside the cell (rows never touch)
		const x0 = -size / 2;
		const tw = size / teeth; // one tooth spans the full cell width, so seams connect
		ctx.lineWidth = Math.max(1, size * 0.045);
		ctx.lineJoin = 'miter';
		ctx.beginPath();
		ctx.moveTo(x0, amp); // start at the bottom of the first ramp
		for (let k = 0; k < teeth; k++) {
			const peakX = x0 + (k + 1) * tw;
			ctx.lineTo(peakX, -amp); // ramp up to the peak
			if (k < teeth - 1) ctx.lineTo(peakX, amp); // snap down to start the next tooth
		}
		ctx.stroke();
	}

	// A small flat per-channel lift off the page body: a few steps on the light-grey
	// body, a touch more on the near-black dark body so the whisper survives there.
	// (igyb's `lighten` mixes *toward white* — proportional — which would vanish on a
	// light body; a flat lift stays even in both themes.)
	function raise(color: string, add: number): string {
		const [r, g, b] = toRgb(color);
		return toRgbString([r + add, g + add, b + add]);
	}

	// Palette read live from the --halo tokens, passed to glyphTile as a *thunk* so
	// refresh() can re-invoke it and re-read the tokens in place on a theme flip. bg
	// matches the page body exactly (the opaque fill is seamless against the page); the
	// glyph is that same colour nudged a few steps, carried as the accent glyphTile
	// paints marks with.
	function theme(): Palette {
		const base = paletteFromCSS({ bg: '--halo-body', fg: '--halo-body' });
		const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const glyph = raise(base.bg, dark ? 9 : 7);
		return { bg: base.bg, fg: glyph, accents: [glyph] };
	}

	// Reference to the running background, shared with the theme-flip effect below.
	let bg: ReturnType<typeof glyphTile> | undefined;

	// Create the tiled field once. A theme flip re-themes it in place (next effect).
	$effect(() => {
		bg = glyphTile(el, {
			glyph: drawSawtooth,
			size: 64,
			speed: 0.3, // near-static: a slow breath, never a beat
			autoPause: true, // idle while the tab is hidden or scrolled offscreen
			themeTransition: 0.3, // crossfade the palette on a light/dark flip (via refresh)
			theme // thunk: refresh() re-invokes it to re-read the tokens
			// no `interactive`, no audio hook — the Analyser scope owns all motion
		});
		bg.start();
		return () => {
			bg?.destroy();
			bg = undefined;
		};
	});

	// Re-theme in place when the OS light/dark preference flips, or when the lo-fi token
	// skin toggles. supersaw has no theme store — light/dark is pure prefers-color-scheme
	// — so we listen on the media query directly. tick() defers the refresh a microtask
	// so any new token values have settled before the thunk re-reads them.
	$effect(() => {
		params.lofi; // reactive dep: re-read the tokens when the lo-fi skin flips too
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onFlip = (): void => void tick().then(() => bg?.refresh());
		mq.addEventListener('change', onFlip);
		void tick().then(() => bg?.refresh());
		return () => mq.removeEventListener('change', onFlip);
	});
</script>

<div class="saw-bg" style:opacity aria-hidden="true">
	<div bind:this={el} class="field"></div>
</div>

<style>
	.saw-bg {
		position: fixed;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.field {
		position: absolute;
		inset: 0;
	}
</style>
