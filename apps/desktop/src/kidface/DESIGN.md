# Kid face — design record

Owner directive #23: a ground-up frontend for the child's ADHD app. The engine
underneath (`packages/core`, `src/lib`, the sync runtime) is untouched. Everything
in this folder is the new face the child sees.

## Identity: Sunlit Rockpool, grown younger

The shell's "Sunlit Rockpool" palette stays — warm sand cream, deep-sea ink,
rockpool teal, kelp success, sunny spark — because the product already owns those
bubbles. The kid face pushes that identity further toward play without becoming
gamified or noisy:

- **Rounder and friendlier** than the adult shell: big bubbly cards, full pill
  buttons, and circular touch targets. Nothing is sharper than the existing
  `rounded-2xl` tokens.
- **Bigger, fewer choices.** A young child with ADHD needs a room, not a
  dashboard. Every tap target is at least 56 px. Every screen answers one
  question at a time.
- **Calm motion only.** Slow ambient drift and a tiny press-pop; nothing that
  competes with the child's own attention. Respects `prefers-reduced-motion`.

## The child's day as structure

The parent app owns configuration, filing, and long-range planning. The child
app is built around three ideas:

1. **Today** — what do I do now?
2. **Doing** — one big bubble checkbox, immediate feedback, no accidental
   complete.
3. **Done** — a trophy case of finished things, not a grey trash-looking list.

Navigation is intentionally shallow. The first pass was **Today**; this pass
adds the **Done** trophy case. A later pass will add a child-scale **Add**
surface.

## Typography and tokens

The face inherits the Rockpool token set from `src/index.css` and the rounded
font stack (`ui-rounded`, SF Pro Rounded, Nunito, Segoe UI). It uses the same
Tailwind colour mapping so the two faces stay siblings, not strangers.

Status colours are read through the existing `--status-*` tokens, but the
roster a child sees is reduced: the day-to-day set is `next` ("To do"),
`waiting` ("Waiting"), and `done` (celebrated). `inbox` and `someday` tasks may
surface if the parent files them there, but the child's verbs stay simple.

## Wording

`src/lib/display-labels.ts` is the source of kid-register text. New surfaces add
their keys to the English contract table first; other locales fall back to core
or the fallback string until a native-speaker pass reviews them. The child's
voice is plain, short, and spoken-aloud friendly.

## First living surface: Today

`TodayView.tsx` is where the child lands. It shows:

- A friendly top-of-day header (time-aware greeting, kept simple).
- A big, always-visible add row: "I need to…" + a bubbly Add button. Typed
  markdown tokens are not advertised; the parser still accepts them.
- The list of things to do today: large rows, a circular checkbox, the task
  title, and a focus star when the parent has marked something important.
- A small "Done today" section at the bottom so finishing something is visible
  and undoable immediately (setback mistakes are common with ADHD).

Every row control is always visible. There are no hover-only actions.

## Components (kidface-only)

- `KidFaceApp.tsx` — root; keeps `useKidFaceRuntime()` and mounts the layout
  plus the shallow room switcher.
- `KidLayout.tsx` — safe-area-aware frame, error banner, ambient bubble layer.
- `KidNav.tsx` — big bottom tabs for switching between Today and Done.
- `TodayView.tsx` — the child's first screen.
- `DoneView.tsx` — trophy case of finished things, grouped by day.
- `TaskBubbleRow.tsx` — a single task row with the circular complete control.
- `BubbleCheckbox.tsx` — large circular checkbox, empty / filled / celebratory.
- `AddBubble.tsx` — the big add input + button.
- `kidface.css` — animations scoped to the new face so the stock shell is not
  affected.

## The Done room

`DoneView.tsx` is the trophy case. It shows finished tasks grouped as **Today**,
**Yesterday**, and **Before that**, with a big undo button on each row so a
child (or a parent helping them) can put something back on the list. The empty
state is celebratory, not apologetic — a trophy waiting for its first win.

## Verification floor

Per `apps/desktop/KID-FACE-CONTRACT.md`: every pass runs
`bunx tsc --noEmit -p tsconfig.json`, `bun run lint`, `bun run test`, a live
look at `/?face=next`, and a confirmation that `/` still serves the stock shell.
