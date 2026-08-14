# Tiny Bubbles desktop — simplify + soft restyle

**Direction:** the app is the same mature GTD engine with the same screens; these passes
only *hide* adult complexity and *re-tone* the shell. Nothing was rebuilt, no features
were added, no mascot/illustration/game layer exists. Calm comes from fewer destinations,
fewer controls, soft sea-foam tones, rounder corners, a rounded reading voice and bigger
targets — not from removing substance.

This document records what was deliberate so the next pass doesn't have to guess.

---

## Palette — light (`src/index.css` `:root`)

The old theme was stark white + saturated blue (`217 91% 50%`). The new one is warm foam
and deep-sea teal. All values are HSL CSS variables; Tailwind maps them unchanged in
`tailwind.config.js`.

| Token | Value | Reads as |
|---|---|---|
| `--background` | `160 33% 97%` | foam white, faintly green — never stark |
| `--foreground` | `200 30% 20%` | deep-sea ink, softer than near-black |
| `--card` / `--popover` | `0 0% 100%` | cards stay white so lists float on the foam |
| `--primary` | `172 56% 30%` | muted teal (white text on it ≈ 5:1) |
| `--accent` | `160 32% 91%` | hover/highlight wash, same hue family |
| `--muted` / `--muted-foreground` | `160 22% 94%` / `200 14% 38%` | quiet secondary text, still AA |
| `--border` / `--input` / `--ring` | `160 18% 86%` / same / `172 56% 32%` | borders in the same sea family |
| `--success` | `157 43% 34%` | kelp green |
| `--info` | `199 55% 40%` | soft sea blue |
| `--warning` / `--destructive` | `36 80% 36%` / `5 65% 48%` | warmed, slightly desaturated |
| status colors (`--status-*`) | softened ~10–20% saturation | badges stop shouting |
| `--focus-star` | unchanged `45 100% 55%` | the one warm spark, kept |

## Palette — dark (`.dark`)

Same sea family at night; the app defaults to theme `system`, so this is what every
dark-mode device shows. The old dark was purple-gray `220 13%` + saturated blue primary
(`217 91% 65%`); the new one is deep calm sea (`200`-hue backgrounds, seafoam teal
primary).

| Token | Value | Reads as |
|---|---|---|
| `--background` | `200 25% 12%` | deep sea water, not near-black |
| `--foreground` | `180 20% 88%` | soft foam text |
| `--card` / `--popover` | `200 22% 16%` / `200 22% 14%` | lifted sea surfaces |
| `--primary` | `172 45% 55%` | seafoam teal; dark text on it ≈ 7:1 |
| `--accent` | `190 20% 24%` | quiet hover wash |
| `--muted` / `--muted-foreground` | `200 16% 22%` / `190 12% 65%` | subdued but legible |
| `--border` / `--input` / `--ring` | `200 16% 27%` / same / `172 45% 50%` | sea-family edges |
| `--success` | `157 40% 55%` | kelp, night-adjusted |
| `--info` | `199 55% 62%` | soft sea blue |
| `--warning` / `--destructive` | `40 75% 60%` / `5 60% 62%` | warm, desaturated |
| status colors (`--status-*`) | same hues as light, lightness ~52–70% | calm on dark |
| badge colors (`--badge-*`) | re-hued from `220` gray-purple to sea `190–200` | consistent family |

## Rounding & type

- `tailwind.config.js` → `theme.extend.borderRadius` softens every corner in the app in
  one place (md .625rem, lg .875rem, xl 1.25rem, 2xl 1.75rem, 3xl 2.25rem). Class names
  unchanged; `--radius` bumped to `0.85rem` to match.
- `body` font stack: `ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui,
  sans-serif` — system fonts only, nothing fetched, works offline. A bundled rounded
  font (Nunito) is the deliberate follow-up for a stronger identity.

## What was hidden

### Sidebar (`src/components/Layout.tsx`)

The engine keeps every view; the sidebar shows five plain-language destinations:
**Focus**, **Inbox** (Focus section) · **Projects**, **Calendar** (Lists) · **Done**
(Archive). Hidden from the sidebar but still routable by URL/keyboard: Someday/Maybe,
Waiting For, Reference, Contexts, Review, Board View, Obsidian, Archived, Trash.

### In-view toolbars

The child-facing rows are deliberately sparse. Reachability differs by feature and is
recorded explicitly here; persisted state alone is not treated as an entry point.

- **Focus view** (`agenda/AgendaHeader.tsx`): the adult controls row is removed. One small
  **Filters** button remains so filtering and sort are reachable on a fresh install.
  **Show details** remains reachable through the real global keyboard binding. Grouping
  can still be supplied by a saved Focus filter or existing list preference, but has no
  Focus-view toggle. **Top 3 only** was removed, including its dead UI plumbing.
- **Inbox** (`list/ListHeader.tsx` via new `hideControls` prop, passed by `ListView`
  when `statusFilter === 'inbox'`): the whole controls row — Filters, Select, Sort,
  Group, Show details, Density. Those Inbox-specific controls have no shortcut; stored
  values may still affect rendering. Scoped to Inbox only; other ListViews are unchanged.

- **Projects** (`projects/ProjectWorkspace.tsx`): the task toolbar keeps only Add Task.
  Sort, Select, columns/list layout, show/hide completed tasks, and Add Section sit in a
  small secondary options row below the project header. Select is the preset-independent
  entry point to multi-select, bulk organize, and bulk delete on a fresh install. This
  preserves a real path to each capability without restoring the former toolbar.

## Other simplification passes

- **Calendar:** simplified the visible calendar shell and selected-day actions while
  retaining the mature calendar data and editing flows underneath.
- **Quick add:** reduced the initial task-entry surface; the existing task model and
  full editor remain the foundation.
- **Projects:** simplified the sidebar, empty state, task rows, and primary toolbar;
  advanced view/section controls use the secondary row described above.

## Plain-language display overrides (`src/lib/display-labels.ts`)

Translations live in `packages/core` (edit-forbidden), so the shell overrides *display
strings* at the render call sites via one small map + `displayLabel(t, key, fallback)`:

| Key | Was | Now |
|---|---|---|
| `status.next` | Next | **To do** |
| `status.someday` | Someday | **Maybe later** |
| `agenda.nextActions` | Next Actions | **to do** (Focus count line: "3 to do") |
| `list.someday` | Someday/Maybe | **Maybe later** |
| `list.waiting` | Waiting For | **Waiting** |

Wired call sites: the Focus header count line (`AgendaHeader`), the task-row status
pill (`TaskItemDisplay`), the task editor status pills (`TaskMetadataFields`), and the
routable-but-hidden list titles (`App.tsx`). **English-first caveat:** an override wins
over the active locale — non-English UIs see these English words at those call sites.
Acceptable for the kid-facing shell this pass; the single map is where per-locale
overrides would go later.

## Touch targets (`Layout.tsx`)

Sidebar rows were 36px/32px; now: nav items `h-11` (44px), Add Task `h-11`, Search
`min-h-11`, saved searches `h-11`, section header toggles `h-9`, nav label text 15px.

## Known issue (dev-only, pre-existing, not chased)

In `bun run desktop:web` only, three console exceptions fire on every load —
"Failed to fetch dynamically imported module" for `BoardView.tsx`, `ObsidianView.tsx`,
`ReviewView.tsx`, from the idle prefetch in `App.tsx` (~lines 1130–1149). All three
modules serve HTTP 200 from the dev server and production preview is clean, so this
looks like a Vite dev optimize-deps race, pre-existing on the branch. Harmless in dev;
revisit only if it starts appearing in production.

## Test contract

The owner explicitly approved updating tests to assert the simplified shell. Tests may
therefore assert that intentionally hidden chrome is absent, while capability tests must
still exercise a real reachable path. Historical red-test inventories are not design
documentation; current verification results belong in the handoff that produced them.

## Previous direction removed

The earlier "Rockpool" kids-shell pass (Bloop mascot, `src/components/kids/`, kids
tokens, `?view=kids` wiring) was removed at the owner's request — wrong direction ("we
arent reinventing the wheel"). Its `KidsView.test.tsx` was deleted with the feature.
What survived from it: the soft sea-tone palette idea, folded into the main theme above.

## Follow-ups

- A bundled rounded font (Nunito) for cross-platform identity.
- Per-locale plain-language overrides in `display-labels.ts` if non-English matters.
- The task-row status `<select>` pill is still an adult control rendered on every row —
  a candidate to hide next pass (its tests would need the same sanctioned treatment).

## Kid-shell structural follow-up

- Restored Trash to the sidebar so deleted tasks and projects can be recovered; its English shell label is **Deleted**.
- Limited all plain-language label overrides to English. Other active languages use their inherited translations unchanged.
- Calmed collapsed task rows to checkbox, title, focus star, and due-date chip. The per-row status selector, secondary metadata, description preview, project badge, and tag badges are hidden; expanded task details remain available.
- Made `large` the desktop shell fallback when no text-size setting exists.
- Reduced the desktop-local default task-editor fields to due date, description, checklist, and attachments. Saved user layouts still win, and Settings can re-enable every field; no synced setting is written by this default.
