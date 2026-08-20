# The kid face contract

Owner directive #23: the kid app gets a ground-up frontend — "build one up
from scratch and then connect the infrastructure code below to it so the
functionality don't get messed up." This file is the connection. It is the
complete list of what the new face may rely on, written for the design agent
who owns everything above it.

## How to see it

The dev server at http://localhost:5173 serves both faces from one origin:

- `/` — the stock kid shell, unchanged, stays live throughout the rebuild.
- `/?face=next` — the new face. Same origin, therefore the same stored data
  and the same sync connection. Open both side by side; they are two windows
  onto one truth.

## What exists and may be trusted

**`src/kidface/` is yours.** `KidFaceApp.tsx` currently holds a deliberately
ugly proof page — delete its markup wholesale. Keep exactly one thing: the
`useKidFaceRuntime()` call at the root. It hydrates the store, runs the same
auto-sync engine as the stock shell (focus, visibility, debounced
data-change, initial sync), and returns `{ hydrated, loadError,
lastSyncError, requestSync, retryLoad }`. `loadError` is set when loading stored data
failed — a failed load must be rendered as its own state, never as an empty
day ("Nothing left to do" after a storage error reads to a child as their
tasks vanishing).

**Data and actions come from `useTaskStore` (`@tinybubbles/core`).** The ones
a kid face plausibly needs:

- `tasks`, `projects`, `areas`, `settings` — live state, re-renders on change.
- `addTask(title, initialProps?)`, `updateTask(id, updates)` — including
  `{ status: 'done' }` to complete, checklist/notes/dueDate via `updates`.
- `deleteTask(id)` (soft delete), `restoreTask(id)`.
- A task is deleted iff `task.deletedAt` is set — always filter `!t.deletedAt`.
- Statuses: `inbox | next | waiting | someday | done | archived | reference`.
  The kid vocabulary for these lives in `src/lib/display-labels.ts`.

Persistence and sync are automatic after any store action. Never talk to the
network or storage yourself.

**Also safe to import:** `src/lib/display-labels.ts` (kid wording),
`src/contexts/language-context` (`t()` — already wrapping you from main.tsx),
theme tokens from `index.css` (the design-token custom properties; the page
inherits theme classes on `<html>`), `src/lib/utils` (`cn`).

## Rules

1. Nothing in `packages/core` or `src/lib` may change for the face's sake.
   One ratified exception: `src/lib/display-labels.ts` is the kid vocabulary
   table and is expected to grow words (new keys, kid register, per-locale
   care) as surfaces are added — words yes, machinery no.
   If the contract is missing something you need, say so in your report and
   the runtime grows to meet you — that is an infrastructure change and it
   arrives reviewed.
2. Do not import from `src/components/` — that is the old face. If something
   there tempts you, that is a sign it should be rebuilt, not reused. One
   ratified exception: machinery primitives from `src/components/ui/` (the
   Dialog focus shell and similar mechanics) may be reused — accessibility
   machinery beats a hand-rolled focus trap — with their look owned by
   kid-face styling. Everything else still needs asking first.
3. The stock shell at `/` must keep working untouched. The switch in
   `main.tsx` is the only line both faces share.
4. `?face=next` is the only way in. No other entry, no redirects.

## Verification floor for every pass

`bunx tsc --noEmit -p tsconfig.json` (typecheck is part of the floor — a
recent pass skipped it and shipped red types), `bun run lint`, and the full
**desktop package** suite (`bun run test` from `apps/desktop`) one-shot, plus
a live look at `/?face=next` and a confirmation that `/` still renders the
stock shell. The live look means a rendered page you have seen (screenshot or
read the DOM) — an HTTP 200 with the right content-type proves the server is
up, not that the app works; a pass once reported a live look while the page
was a blank ReferenceError.

Green is a property of the commit, not the tree: after committing, confirm
`git status` is clean before you report — a green working tree above a
partial commit ships a red branch tip, which is exactly what happened to
pass 4 (tests committed, implementation forgotten).

The root-level `bun run test` (core, cloud, mobile) is NOT part of the floor:
the cloud package cannot run on a Windows host by design (it fsyncs
directories; it runs in Docker), and other cross-package failures on this
machine are environment baseline. If you see them, report them and move on —
they belong to infra. The overlay-pin allowlist
(`src/test/dialog-overlay-pin.test.ts`) will legitimately grow as the kid
face adds its own surfaces (contract rule 2 forbids reusing the stock Dialog
module): add your entry with a reason and name it in your report, as the
open-task pass did.
