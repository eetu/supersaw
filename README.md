# supersaw

Browser synth. A supersaw oscillator (7 detuned saws, after [Szabó 2010](https://www.nada.kth.se/utbildning/grukth/exjobb/rapportlistor/2010/rapporter10/szabo_adam_10131.pdf)),
ADSR envelope, waveshaper distortion, mono glide, a qwerty-playable keyboard and
a 16-step grid sequencer — all client-side Web Audio, no backend.

Formerly `audio-playground` (2015, React 0.14 + Redux + gulp). Rebuilt 2026 as
a sibling in the homebrew app family: SvelteKit (runes) SPA, halo-design
tokens, served by nginx from a container.

## Develop

```sh
cd frontend
yarn install
yarn dev        # http://localhost:5173
yarn validate   # typecheck + lint + format
```

Node version: `frontend/.node-version`. Yarn is vendored (`.yarn/releases`),
no corepack needed. Run `./install-hooks.sh` once after cloning.

## Build & ship

```sh
docker build -t supersaw .   # nginx:alpine serving the static bundle, port 3013
```

CI builds `ghcr.io/eetu/supersaw` for arm64 on push to main; deployed on the Pi
via the `../raspi` pyinfra repo (quadlet behind Traefik + oauth2-proxy,
unauthenticated `/status` for gatus).

## Map

- `frontend/src/lib/engine/` — framework-free Web Audio engine (notes, curves,
  voice, engine, lookahead scheduler)
- `frontend/src/lib/params.svelte.ts` — shared synth parameters (both views)
- `frontend/src/lib/sequencer.svelte.ts` — grid state + scheduler wiring
- `frontend/src/routes/` — `/` synth, `/seq` sequencer
- `.claude/skills/supersaw-design/` — visual identity delta on halo-design
