# Tiny Bubbles — design record

**The aesthetic is "Sunlit Rockpool":** warm sand under shallow water, and bubbles —
the name was always the identity; the interface now floats in it. Cream base, deep-sea
ink, rockpool teal, a sunny spark. Rich *and* calm: the richness is environmental
(light, warmth, drifting bubbles, round soft shapes), the calm is interactional (few
choices, stable layout, slow motion, nothing punishes).

The engine (`packages/core`) is untouched; everything here is paint in `apps/desktop`.

---

## Palette (`src/index.css`)

Light — warm, not grey:

| Token | Value | Reads as |
|---|---|---|
| `--background` | `42 47% 96%` | warm sand cream — the sunlit part |
| `--foreground` | `202 32% 21%` | deep-sea ink |
| `--card` / `--popover` | `0 0% 100%` | white cards float on the cream |
| `--primary` | `174 52% 30%` | rockpool teal (white text ≈ 5:1) |
| `--secondary` / `--accent` | `174 32% 91%` / `174 38% 89%` | shallow-water washes |
| `--muted` | `40 32% 92%` | warm sand |
| `--border` / `--input` / `--ring` | `38 28% 85%` / same / `174 52% 32%` | warm edges |
| `--success` | `152 45% 34%` | kelp — the complete-bubble colour |
| `--warning` / `--destructive` | `36 82% 38%` / `8 62% 50%` | amber / warm coral-red |
| `--focus-star` | `45 100% 55%` | the sunny spark, unchanged |
| `--info` | `199 55% 40%` | soft sea blue |

Dark — the pool at night: `--background: 205 28% 13%` (warm deep water),
`--foreground: 42 22% 88%` (moonlit warm foam), `--card: 204 24% 17%`, primary unchanged
seafoam `172 45% 55%`, borders/secondary/muted warmed to the same family.

Status colours (`--status-*`) stay the softened sea family from the simplify passes.

## Shape

`tailwind.config.js` → `theme.extend.borderRadius`: md .75rem, lg 1.125rem, xl 1.5rem,
2xl 2rem, 3xl 2.5rem (`--radius: 1rem`). One change, every corner. Toy-soft, never
balloon.

## Type

Rounded system stack on `body`: `ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI",
system-ui, sans-serif` — nothing fetched, works offline. A bundled rounded font (Nunito)
remains the follow-up for cross-platform consistency.

## The bubble language

- **The mark** (`Layout.tsx` sidebar header): three overlapping hand-drawn bubbles
  (teal, sun, sea-blue) with highlights — inline SVG, no asset file. It is the product
  in miniature.
- **Ambient field** (`Layout.tsx` + `.rockpool-*` in `index.css`): five bubbles of
  varying size drift slowly (12–21s cycles, staggered) behind the content at very low
  opacity. Constant, slow, ignorable — lava-lamp calm, not a screensaver demanding
  attention. `aria-hidden`, `pointer-events: none`, and stilled under
  `prefers-reduced-motion`.
- **The core loop** (`TaskItemDisplay.tsx`): the complete control is a 40px bubble —
  round, kelp-outlined, always visible on every row (the old inbox hover-reveal is
  gone on purpose: hover does not exist on tablets, and controls must not move between
  states). Pressing it gives a small `active:scale-90` pop, automatically stilled under
  reduced motion.

## Motion

Slow and ignorable by default (12–21s ambient drift), instant and tiny for feedback
(press-pop). The global `prefers-reduced-motion` reset plus explicit stills on the
bubble layer keep feedback (colour/shape) and drop movement.

## Wording

`src/lib/display-labels.ts` — English-gated display overrides; other locales keep their
real translations. Current map: To do · Maybe later · Waiting · Deleted · My lists ·
Later · Tidy up · Get it all out · Find anything · "See what is coming up" · "Pick a
list to see its tasks" · "e.g. Feed the cat" · and calendar panel wording.

---

## What was simplified (the passes before this one)

Sidebar: Focus, Inbox, Projects, Calendar, Done, Deleted — everything else hidden but
routable (Someday/Maybe, Waiting For, Reference, Contexts, Review, Board, Obsidian,
Archived). Focus/Inbox toolbars hidden from render (AgendaHeader keeps a single quiet
Filters toggle per the test-contract pass). Calendar: month grid + Today/prev/next;
planning panel, search, Completed toggle, mode toggles hidden; day cells are big with
2 large chips; tapping a day opens the selected-day panel (always-visible 44px row
actions, schedule-search aside hidden). Quick add: one bar, mic, big labelled Add;
token/AI chrome hidden (the autocomplete popup kept — it is the only path to inline
Create Project). Projects: tag filter hidden; search/sort/layout/select/show-completed/
add-section hidden from the workspace toolbar; big tappable list rows.

## Known state

- Red tests are deliberate surface fallout, inventoried per pass in the session
  reports; a separate test-update pass owns them. Current count was 27 failed /
  1968 passed before this identity pass; this pass's label/wording additions may add a
  few more (AgendaView section-title assertions are the likely candidates).
- Dev-only, pre-existing: three console exceptions on dev-server load (idle prefetch
  of BoardView/ObsidianView/ReviewView). Production clean.
- Pre-existing baseline reds: 2 tauri-invoke ratchet + 1 keybinding (Ctrl+Alt+M).
- Follow-ups: bundled Nunito; per-locale display overrides; an owner decision on the
  sidebar footer (area filter, sync status) and Settings trimming.
