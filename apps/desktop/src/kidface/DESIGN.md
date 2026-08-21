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
  dashboard. Primary tap targets are at least 88 px; secondary text rows and
  list cells clear 88 px in height. The 88 px floor is not a style preference —
  it is the smallest touch target a fidgety or imprecise tap can reliably hit,
  and it makes each row feel like one big decision rather than a line of small
  text. Every screen answers one question at a time.
- **Calm motion only.** Slow ambient drift and a tiny press-pop; nothing that
  competes with the child's own attention. Respects `prefers-reduced-motion`.

## The child's day as structure

The parent app owns configuration, filing, and long-range planning. The child
app is built around three ideas:

1. **Today** — what do I do now?
2. **Doing** — one big bubble checkbox, immediate feedback, no accidental
   complete.
3. **Done** — a trophy case of finished things, not a grey trash-looking list.

Navigation is intentionally shallow. The first pass was **Today**; the next
added the **Done** trophy case, then the child-scale **Add** room. This pass
adds the child-scale **Calendar** room as a fourth bottom-nav stop, so a child
can see what is coming up without leaving the shallow room model.

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
- The list of things to do today: large rows, a circular checkbox, the task
  title, and a focus star when the parent has marked something important.
- A small "Done today" section at the bottom so finishing something is visible
  and undoable immediately (setback mistakes are common with ADHD).

Every row control is always visible. There are no hover-only actions.

When today is empty but tasks are scheduled for the future, the screen says
"Free today" and offers a direct path to the Calendar room so the child can see
what is coming. It never leaves the child to decode an empty-looking day on
their own.

Adding was previously an inline row on Today; it now lives in the dedicated
**Add** room so the child faces one question per screen.

## Components (kidface-only)

- `KidFaceApp.tsx` — root; keeps `useKidFaceRuntime()` and mounts the layout
  plus the shallow room switcher.
- `KidLayout.tsx` — safe-area-aware frame, error banner, ambient bubble layer.
- `KidNav.tsx` — big bottom tabs for switching between Today, Add, and Done.
- `TodayView.tsx` — the child's first screen.
- `AddView.tsx` — the child-scale Add room.
- `DoneView.tsx` — trophy case of finished things, grouped by day.
- `CalendarView.tsx` — child-scale month grid showing scheduled or due tasks.
- `TaskBubbleRow.tsx` — a single task row with the circular complete control.
- `BubbleCheckbox.tsx` — large circular checkbox, empty / filled / celebratory.
- `AddBubble.tsx` — the big add input + button, used by the Add room.
- `kidface.css` — animations scoped to the new face so the stock shell is not
  affected.

## The Add room

`AddView.tsx` is the child-scale Add surface. It is a full-screen room with a
single friendly prompt, the big `AddBubble` input, and a brief celebratory
confirmation when a task is created. The new task lands on **Today** as a
`next` action; there are no due dates, projects, or other filing decisions to
make in the moment.

## The Done room

`DoneView.tsx` is the trophy case. It shows finished tasks grouped as **Today**,
**Yesterday**, and **Before that**, with a big undo button on each row so a
child (or a parent helping them) can put something back on the list. The empty
state is celebratory, not apologetic — a trophy waiting for its first win.

## The Calendar room

`CalendarView.tsx` is a month-only grid built for the child, not a reuse of the
stock calendar. It shows which days have a scheduled or due task as small dots,
highlights today, and lets the child flip months with big arrow buttons. There
are no day/week/schedule modes to get lost in, and no search or planning panels
— just a calm view of what is coming up.

## Motion studies that graduated into the face

The `MotionPlayground` is a dev sandbox for trying motion ideas without
exposing them to children. When a study proves itself in a real surface, it
moves out of the playground and into production:

- **Room transitions** → every room switch in `KidFaceApp`.
- **Bubble checkbox celebration** → `BubbleCheckbox` / `TaskBubbleRow` complete
  control plus the global `CelebrationLayer`.
- **Trophy shine** → `DoneView` and the `TodayView` all-done payoff.
- **List stagger** → `TodayView`, `DoneView`, and `CalendarView` lists.
- **Ambient field + breathing buddy** → empty states in `TodayView`, `DoneView`,
  and `CalendarView`, so quiet rooms still feel alive.
- **Pulse rings** → parent-priority tasks in `TaskBubbleRow` (the focus star).
- **Button pops / elastic pop** → `AddBubble` submit button and the `AddView`
  success confirmation.

## Interaction principles

These rules are deliberately written down because they are easy to forget in
later passes, and they are the difference between a cute interface and one a
child can actually use:

1. **Never leave an action silent.** If a child presses something and nothing
   happens, they cannot tell whether the app is broken or they are. Every action
   must answer: trying, worked, or did not work. Examples carried into the face:
   - `AddBubble` shakes when Enter is pressed on empty input.
   - `LoadErrorView` shakes the retry button after a failed retry.
   - The offline banner shows trying / synced / still-offline states.
   - The scheduled-empty `TodayView` state offers a clear "See what's coming"
     button instead of leaving the child staring at an empty-looking day.
2. **Pulse rings mean priority.** The gentle expanding ring around a focus star
   is reserved for parent-marked important tasks. It is the visual equivalent of
   a calm "start here"; no other element may use it so the meaning stays clean.
3. **Empty states are answers, not apologies.** A child with nothing today but
   plenty this week is told "Free today" and given a way to see what is coming,
   not left to read "Nothing" as "you have nothing to do."

## Verification floor

Per `apps/desktop/KID-FACE-CONTRACT.md`: every pass runs
`bunx tsc --noEmit -p tsconfig.json`, `bun run lint`, `bun run test`, a live
look at `/?face=next`, and a confirmation that `/` still serves the stock shell.
