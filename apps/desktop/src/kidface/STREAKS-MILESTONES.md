# Kid face — streaks and milestones design exploration

Status: design exploration only. No UI ships in this pass.

## Constraints from the ruling

1. **Derive everything from data that already exists** — completions and dates.
   No new stored fields, no metadata, no counters, no avatars, no parent-set
   choices in this phase.
2. **Streaks must be gentle.** A child with ADHD who misses a day must never see
   a broken chain, a zero, a flame that died, or any language that frames a gap
   as failure. Celebrate what happened; stay silent about what did not.
3. Anything needing an avatar or parent-set choices waits for the parent-controls
   phase. Notes below feed that design.

## What exists to derive from

- `task.status === 'done' | 'archived'` plus `task.completedAt`.
- `task.createdAt` for first-task milestones.
- The local task list gives us a timeline of completed days.

No new stored fields means every signal is computed on render from the existing
`tasks` array.

## Proposed gentle signals

### Streaks (gentle version)

- **Current streak** is the count of consecutive days, up to and including today,
  on which the child completed at least one task.
- If today is empty but yesterday had completions, the streak still reads as the
  current run because "today is not over yet."
- If the run ended before today, the surface does **not** display a broken
  streak. It displays the longest run ever achieved, or a simple celebratory
  message like "You have finished things on {N} different days." The number is
  framed as breadth, not an unbroken chain.
- No countdowns, no "don't break it" copy, no visual chain that empties.

### Milestones (gentle version)

- **First completion ever** — small celebration the first time a child marks
  something done.
- **First self-added task completed** — distinguishes tasks the child created
  versus parent-created tasks. Derived from comparing `createdAt`/`projectId`? No
  reliable authorship field exists, so this milestone is noted as dependent on
  parent-controls phase metadata (who created the task).
- **Day with many completions** — e.g. "You finished {N} things on this day!"
  shown only as a positive peak, never as an average or expected level.
- **Variety of days** — "You have finished things on {N} different days."

## What waits for parent-controls phase

- Avatar selection or any identity representation.
- Parent-set choices such as goals, rewards, difficulty, or which milestones are
  visible.
- Any stored fields for authorship, streak counts, or milestone state.
- Any sharing or comparison features.

## Implementation note for the future

When the time comes, compute signals in a single hook (for example
`useKidFaceCelebrations`) that reads `useTaskStore((state) => state.tasks)` and
returns only celebration-worthy, shame-free strings. Nothing it returns persists
or subtracts.
