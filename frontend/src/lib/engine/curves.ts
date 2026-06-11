// Waveshaping and supersaw curves. Pure math, framework-free.

// WaveShaper distortion curve, from the MDN WaveShaperNode example.
// Note: at amount 0 the curve is still ~x/3, i.e. it always attenuates —
// that gain staging is part of the original sound, kept as-is.
//
// Memoized: this used to allocate a fresh 44.1k-sample array per oscillator
// per note (7× per supersaw voice), and the resulting GC pauses were audible
// as crackle under sequencer load. Curves are immutable once built and the
// amount is a 0-100 slider, so the cache stays small.
const curveCache = new Map<number, Float32Array<ArrayBuffer>>();

export function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
	const cached = curveCache.get(amount);
	if (cached) return cached;
	const samples = 8192;
	const curve = new Float32Array(samples);
	const deg = Math.PI / 180;
	for (let i = 0; i < samples; i++) {
		const x = (i * 2) / samples - 1;
		curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
	}
	curveCache.set(amount, curve);
	return curve;
}

// Detune profile of the Roland JP-8000 "super saw", reverse-engineered in
// Szabó, "How to Emulate the Super Saw" (KTH, 2010):
// https://www.nada.kth.se/utbildning/grukth/exjobb/rapportlistor/2010/rapporter10/szabo_adam_10131.pdf
// Coefficients are the paper's 11th-degree fit, highest power first.
const DETUNE_POLY = [
	10028.7312891634, -50818.8652045924, 111363.4808729368, -138150.6761080548, 106649.6679158292,
	-53046.9642751875, 17019.951858008, -3425.0836591318, 404.2703938388, -24.1878824391,
	0.6717417634, 0.0030115596
];

export function detuneAmount(x: number): number {
	return DETUNE_POLY.reduce((acc, c) => acc * x + c, 0);
}

// Per-oscillator frequency ratios for the 7 detuned saws (paper, table 4.2).
const DETUNE_OFFSETS = [
	-0.11002313, -0.06288439, -0.01952356, 0, 0.01991221, 0.06216538, 0.10745242
];

export function detuneRatios(x: number): number[] {
	const amount = detuneAmount(x);
	return DETUNE_OFFSETS.map((offset) => 1 + offset * amount);
}

// Centre vs side oscillator levels as a function of the mix knob (paper, ch 4.3).
export function mixLevels(x: number): number[] {
	const center = -0.55366 * x + 0.99785;
	const side = -0.73764 * x ** 2 + 1.2841 * x + 0.044372;
	return [side, side, side, center, side, side, side];
}

/** Value of a linear ramp from (startTime, startValue) to (targetTime, targetValue) at currentTime. */
export function valueAtTime(
	startTime: number,
	currentTime: number,
	targetTime: number,
	startValue: number,
	targetValue: number
): number {
	if (currentTime >= targetTime) return targetValue;
	const slope = (targetValue - startValue) / (targetTime - startTime);
	return startValue + (currentTime - startTime) * slope;
}
