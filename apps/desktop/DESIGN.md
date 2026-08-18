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

Focus (decomposition pass 2): the "Review Due" and "Projects to review" sections are
gone from the Focus screen — the weekly-review ritual is an adult surface and the
Review view is already hidden-but-routable, so review-due items surface there, not on
the child's first screen. Presentation only: `reviewAt` is untouched in core and the
view-local review pipelines were removed from `AgendaView.tsx` alone.

Task quick-action menu (decomposition pass 2): the row's "More options" /
right-click menu keeps the child-safe set — Focus star, Rename, Due Date, Duplicate,
"Turn into a list" (promote-to-project, plain-language label via display-labels) and
Delete. Hidden: Start Date, Review Date, Mark reviewed, Review in 1 week, Area,
Contexts, Convert to Reference. Reachability of every hidden capability: start and
review dates, area and contexts edit through the task editor once re-enabled in
Settings -> GTD -> Task Editor Layout; filing to Reference happens through the Tidy
up (inbox processing) flow; row status changes stay in the editor's fixed status
control. The panel machinery is intact and serves the surviving Due Date entry.

Settings (decomposition pass 2): the nav keeps General, GTD, Manage, Notifications,
Sync, Data and About — the pages an adult needs on the kid device (GTD holds the
task-editor-layout escape hatch; Sync connects to the parent app). Integrations, AI
and Advanced are hidden from the nav: API keys, Obsidian vaults and the local
API/automation surface are adult-only. The pages stay registered — settings search
still lists their rows and navigates to them, and `initialPage` deep links still
open them. Limitation: on narrow viewports the sidebar collapses to a `<select>`
built from the same nav list, so the three hidden pages need a wide window (search
is desktop-only) — acceptable for an adult task, recorded here.

## Task quick-action menu (kid-scale pass)

The six surviving actions (Focus star, Rename, Due Date, Duplicate, Turn into a list,
Delete) keep their behaviour; only their scale and finish changed to fit a child's
hand inside the Rockpool tokens.

- **Rows are 48px tap targets**: `px-4 py-3 text-base` on every menuitem, up from
  the adult `px-3 py-2 text-sm`.
- **Icons grew to 20px** (`h-5 w-5`) and sit in a slightly wider `gap-3` row.
- **Menu surface is wider and rounder**: `w-72` (288px) and `rounded-xl`, with
  `p-2` internal padding and `my-2` separators so the list can breathe.
- **Soft press feedback**: `active:scale-[0.98]` on rows, stilled implicitly by the
  global `prefers-reduced-motion` reset.
- **Delete is the warm-coral exception**: it gets a destructive hover wash
  (`hover:bg-destructive/10 hover:text-destructive`) so a child can see which
  action is dangerous before tapping.
- **The due-date panel matches**: `rounded-xl`, `p-4`, 48px inputs (`px-4 py-3
  text-base`), and `size="lg"` Save/Cancel buttons, so the panel feels like the
  same menu system.

## Known state

- The desktop suite is green (1995/1995 as of the review-hide pass). The former
  policy of leaving simplification fallout red is over: per the owner's recorded
  decision, tests are updated to assert the simplified shell in the same pass that
  changes the surface.
- Two of the three "pre-existing baseline reds" (tauri-invoke ratchet) were
  Windows-host portability bugs in the tests themselves (backslash vs forward-slash
  paths), and the third (Ctrl+Alt+M) asserted the platform-default shortcut, which is
  'disabled' on Windows. All three are fixed, not suppressed.
- Dev-only, pre-existing: three console exceptions on dev-server load (idle prefetch
  of BoardView/ObsidianView/ReviewView). Production clean.
- Follow-ups: bundled Nunito; per-locale display overrides; an owner decision on the
  sidebar footer (area filter, sync status) and on demoting Settings to
  footer-icon-only (8a).
