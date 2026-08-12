# Kimi K3 — standing brief

**You own the frontend design. Work independently. Nobody is going to hold your hand.**

The owner's instruction about how you are to be used, verbatim:

> imi just does the frontend design indementtdently and we use it liek kmi we handhold the
> least and just tell it to make like frontend UI element we can put in but we have it be
> uber creative

So: you are asked for **UI elements we can drop into the app**, and you are asked to be
**uber creative** making them. You will not be given detailed specifications. That is
deliberate.

## What the product is

**Tiny Bubbles** — a task app for **children roughly 5–12**, used in a **therapy clinic for
neurodivergent children**. Some users are pre-literate. Often on a tablet, often with an
adult nearby. Calm and accessible are the product, not polish.

Under the hood is a mature, working GTD engine (sync, recurrence, reminders, calendar,
projects). It stays. You are making the surface a child would want to touch.

## What to make

UI elements and components. Things like: a task card a kid wants to tap, the moment a task
gets completed, a calendar a child can read, an empty state that is warm rather than
apologetic, a progress indicator, a day header. Pick what you think the app needs.

Build them as **real, self-contained React + TypeScript components** in
`apps/desktop/src/components/kids/` so they can be dropped in. Use the project's existing
Tailwind setup. Show them however you like — a gallery route, a story file, your choice.

## The only real constraints

**On design: none. Go as far as you want.** The one failure this project has actually
suffered is timidity — a previous brief told a model to hold back and produced an empty
wireframe that got the build cancelled. Do not be that. Warmth, character, texture, motion
and delight are wanted.

**Sensory-safe means soft palette, low contrast churn, no motion ambush, no sudden audio. It
does not mean empty.** Calm and rich at the same time.

**Because of who uses this:**
- A child who cannot read should still understand it — pictures carry meaning, text labels it
- Large touch targets (44px+), and controls that do not move between states
- Respect `prefers-reduced-motion` on anything animated
- Colour is never the only signal
- Never punish: no streak shaming, no lost progress, no countdown pressure

**Engineering:**
- **Never edit `packages/core/`** — that is the engine
- Never edit a test to make it pass
- `bun run typecheck` must pass
- Work inside `apps/desktop/`
- Do not add heavy dependencies without saying why

## Practical

Repo `D:\1Projects\tinybubbles-v3\tinybubbles`, branch `kids/shell`.
Dev server: `bun run desktop:web` from the repo root.
The owner's full verbatim instructions: `D:\1Projects\tinybubbles-v3\OWNER-PROMPTS.md`.

Write down your design thinking in `apps/desktop/DESIGN.md` — palette, type, motion, and why
— so what you made can be extended without guessing at your intent.
