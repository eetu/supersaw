// Lookahead step scheduler (the classic "tale of two clocks" pattern, kept
// from the 2015 code but moved from requestAnimationFrame to setInterval so
// the sequencer keeps running in a background tab).
//
// Hidden tabs throttle setInterval to ~1s (Safari especially), which starves a
// 0.2s lookahead — so while hidden we schedule a much wider window, refilled
// immediately on each visibility flip.

const LOOKAHEAD_S = 0.2;
const HIDDEN_LOOKAHEAD_S = 2.5;
const TICK_MS = 25;

export class Scheduler {
	tempo = 120;
	readonly steps: number;

	private nextStepTime = 0;
	private step = 0;
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor(
		private readonly now: () => number,
		private readonly onStep: (step: number, time: number) => void,
		steps = 16
	) {
		this.steps = steps;
	}

	get running(): boolean {
		return this.timer !== null;
	}

	start(): void {
		if (this.timer) return;
		this.step = 0;
		this.nextStepTime = this.now() + 0.005;
		this.timer = setInterval(() => this.tick(), TICK_MS);
		document.addEventListener('visibilitychange', this.onVisibility);
		this.tick();
	}

	stop(): void {
		if (!this.timer) return;
		clearInterval(this.timer);
		this.timer = null;
		document.removeEventListener('visibilitychange', this.onVisibility);
	}

	// refill the schedule the instant visibility flips, before throttling bites
	private onVisibility = (): void => {
		this.tick();
	};

	private tick(): void {
		const lookahead = document.hidden ? HIDDEN_LOOKAHEAD_S : LOOKAHEAD_S;
		while (this.nextStepTime < this.now() + lookahead) {
			this.onStep(this.step, this.nextStepTime);
			this.step = (this.step + 1) % this.steps;
			// each step is a 16th note
			this.nextStepTime += (60 / this.tempo) * 0.25;
		}
	}
}
