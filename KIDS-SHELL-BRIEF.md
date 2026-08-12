# Tiny Bubbles — simplify and restyle

**The job is to SIMPLIFY this app and give it soft, calm Tiny Bubbles styling.**
That is the whole job. Read the two paragraphs under "Scope" before anything else.

---

## Scope — read this first

Underneath this repo is a **mature, working, heavily-tested task app** — real sync, offline
storage, recurrence, reminders, calendar, projects, search. Thousands of passing tests. It
works today.

**Do not reinvent it. Do not add features. Do not add concepts.**
Take what is already here and make it **simpler** and **softer**.

Two things, in this order:

1. **Simplify.** Fewer views. Fewer options on screen. Less jargon. The adult app exposes
   Focus, Inbox, Projects, Someday/Maybe, Waiting For, Reference, Contexts, Calendar, Review,
   Archived, plus filters, grouping, bulk actions and a dense task editor. Most of that
   should stop being visible. The engine keeps using it underneath — you are hiding and
   collapsing, not deleting the engine's capabilities.
2. **Restyle.** Soft tones. Calm, warm, rounded, gentle. Give it an identity that reads as
   *Tiny Bubbles* rather than a generic productivity tool.

**It does not have to feel fully like a children's app yet.** That is fine and expected.
This pass is simplify + style. Do not overreach trying to make it childlike in one go.

## What NOT to do

- **Do not add new features.** Nothing that does not already exist should start existing.
- **Do not invent a mascot, character system, illustration library or game layer.** Not this
  pass.
- **Do not add heavy dependencies.** No animation frameworks, no icon mega-packages.
- **Do not rebuild screens from scratch** when restyling and stripping the existing one gets
  there. This is a mature codebase; work with it.
- **Do not look at any older version of this product for inspiration.** There is an
  abandoned earlier attempt; it is irrelevant and actively unhelpful. Ignore it entirely.

## One caution on "simplify"

Simplifying means removing **complexity and options** — not removing **substance**. You are
starting from a complete, rich app, so stripping it back still leaves something real. The
result should feel **calm and finished**, never bare or unstyled. If a screen ends up looking
like a wireframe, you have gone too far in the wrong direction: put the warmth back through
tone, spacing, rounding and typography rather than through more controls.

Soft tones, low contrast churn, no motion ambush, no sudden audio. Calm — not empty.

---

## Who it is eventually for

Children roughly 5–12, in a therapy clinic for neurodivergent children, some pre-literate.
That is the destination, not this pass. What it means *now* is that your simplification
decisions should lean toward: bigger targets, fewer choices, plainer words, gentler colour.

Reasonable to honour while you simplify:

- **Large, stable touch targets** — 44×44 CSS px minimum, and controls should not jump
  between states.
- **Respect `prefers-reduced-motion`** on anything you animate.
- **Plain language** over productivity jargon. "Waiting For" and "Someday/Maybe" mean nothing
  to a child.
- **Colour is never the only signal.**

Never add punishment mechanics — no streak shaming, no lost progress, no countdown pressure.

---

## Engineering rules — do not break a working product

Styling and simplification decisions are yours. Architecture is not.

1. **Never edit `packages/core/`.** That is the engine — domain logic, storage, sync,
   recurrence, and the most tested part of the repo. If you need something it does not
   expose, **say so** instead of reaching in.
2. **Never edit a test to make it pass.** If a test fails because you deliberately hid a
   feature, that is a real signal — report it. Silently deleting assertions is not allowed.
3. **Keep the build green.** `bun run typecheck` must pass and the desktop app must build.
4. **Work only inside `apps/desktop/`.** Mobile is out of scope.
5. You are on branch `kids/shell`. `main` holds the working app — do not touch it.

## Where things are

- `apps/desktop/src/` — React + TypeScript + Vite + Tailwind. This is what you change.
- `apps/desktop/src/index.css`, `apps/desktop/tailwind.config.js` — styling entry points.
  **Most of the restyle should happen here**, in tokens, not scattered per-component.
- `packages/core/` — the engine. Read it, never edit it.
- Dev server: `bun run desktop:web` from the repo root.

## Done, for this pass

The app still runs and still works, but with far less on screen and a soft, calm, coherent
Tiny Bubbles look.

Write a short `apps/desktop/DESIGN.md` recording the palette, type and spacing decisions you
made, and a list of what you hid or collapsed — so the next pass knows what was deliberate.
