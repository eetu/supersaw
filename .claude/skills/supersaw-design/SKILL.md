---
name: supersaw-design
description: supersaw's visual identity — a sibling in the homebrew web app family (halo-design). Use when styling or extending supersaw's UI so new work stays on-brand.
user-invocable: true
---

# supersaw-design

Shared tokens + conventions come from the `halo-design` skill — copy
`colors_and_type.css` verbatim (it lives at `frontend/src/lib/styles/halo.css`,
prettier-formatted; do not hand-edit, re-copy on token changes). Below is this
app's delta.

## Glyph

A synth module frame (rounded rect, currentColor) containing a sawtooth wave in
the warm accent. Family stroke language: `stroke-linecap/linejoin: round`,
currentColor outline, `#f78f08` accent detail. 24-unit viewBox.

Sources of truth: `frontend/src/lib/components/Wordmark.svelte` (inline),
`frontend/static/favicon.svg` + `icon-maskable.svg` (tiles; regenerate PNGs
with `frontend/scripts/gen-icons.sh`).

## Wordmark

`super<span class="accent">saw</span>` — riff: **"i want to play a tune."**
(Saw, 2004, one word off — it is also, literally, a synth you play). Riff
collapses below 520px.

## Layout / density

Instrument-panel density: one column of `Panel` cards, controls packed in rows
(vertical sliders side by side, pill radio groups). The keyboard and sequencer
grid are full-bleed inside their cards. Max width 900px — it's an instrument,
not a dashboard.

The sequencer is styled after a Launchpad: a hardware-dark plate (`#161616` in
**both** themes — it's a device, not a card) holding matte backlit pads whose
accent glow spills into the gaps. Portrait phones collapse the shaping sliders
behind a toggle and lay the pitch wheel horizontally under the keyboard.

## Keyboard polarity

Dark theme inverts the piano, wireframe style: "white" keys are **black**
(`--halo-body`) with a light outline (`--halo-text-main` border), "black" keys
are solid **light** (`--halo-text-main` fill). Deliberate (eetu's call) —
don't "fix" it.

## Voice

Lowercase, terse, dry. Hints are one quiet muted line (e.g. the qwerty mapping
under the keyboard). No exclamation marks, no emoji.

## Differences from family baseline

| Aspect      | Family baseline        | supersaw                                  |
| ----------- | ---------------------- | ----------------------------------------- |
| Accent use  | "alive" status         | playing state: lit cells, pressed keys, scope trace |
| Data layer  | api.ts fetch wrapper   | none — browser-only, Web Audio is the backend |
| Density     | dashboard cards        | instrument panel, 900px max width         |
| Interaction | read-mostly            | realtime input (pointer + qwerty keys)    |

## Production sources of truth

- `frontend/src/lib/components/` — Wordmark, Panel, controls (RangeSlider,
  FlipSwitch, WaveSelect), Keyboard, Analyser
- `frontend/src/lib/styles/halo.css` — tokens (copy of canonical)
- `frontend/src/lib/engine/` — framework-free Web Audio engine (not design,
  but the thing the design exists to play)
