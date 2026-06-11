# supersaw

Browser-only synth (Web Audio), sibling app in the homebrew family — but with
**no Rust backend**: the SPA is served by nginx (`Dockerfile` + `nginx.conf`,
port 3013). Everything else follows the family skills: `spa-frontend` (Svelte
instantiation), `halo-design` + the local `supersaw-design` skill, `ts-style`/
`svelte` code style.

## Commands (run in `frontend/`)

- `yarn dev` — Vite dev server (no proxy; there is no backend)
- `yarn validate` — typecheck (svelte-check) + lint + format check
- `yarn build` — adapter-static → `frontend/dist/`

## Architecture notes

- `src/lib/engine/` is framework-free TS — no Svelte imports allowed there.
  Voice graph: osc(s) → waveshaper → ADSR gain → level gain → compressor.
  "supersaw" = 7 detuned saws + shared 200 Hz highpass; detune/mix curves from
  the Szabó 2010 paper (coefficients in `curves.ts`, don't "simplify" them).
- `params.svelte.ts` holds the shared synth params; both the synth view and the
  sequencer play through them on the singleton `engine`.
- AudioContext is created lazily on first interaction (browser gesture rule) —
  never construct it at module scope.
- Sequencer timing = lookahead scheduler (`engine/scheduler.ts`), setInterval
  based; UI playhead is cosmetic (setTimeout), audio timing is AudioContext
  clock.

## Theme sourcing

`frontend/src/lib/styles/halo.css` is the canonical halo-design
`colors_and_type.css` (prettier-formatted). Re-copy on token changes; do not
hand-edit.
