# Tiny Bubbles Parent — design record

**The aesthetic is "Evening Tide", the grown-up sibling of the kid app's Sunlit
Rockpool.** The kid app is the pool at midday — bright cream, bubbles drifting
free. The parent app is the same water at dusk, seen from the shore: deeper
teal, quieter sand, and the sunny spark warmed into a lantern amber that is lit
only where the parent must act. The parent is often tired; the app answers two
questions — *is my child okay, and is there something I need to do* — without
alarm.

This is a remaster, not a remake: the engine (`packages/core`) and every stock
view are untouched. Everything here is paint, scoped to the parent build.

## How the flavour is scoped

`src/config/flavour.ts` → `isParentFlavour` (build flag
`VITE_TINYBUBBLES_FLAVOUR=parent`). `src/main.tsx` sets
`document.documentElement.dataset.flavour = 'parent'`, and the palette hangs
off that attribute in `src/index.css` (`html[data-flavour='parent']` and the
`.dark` variant). Specificity is arranged so the parent palette overrides the
stock `:root`/`.dark` defaults but always loses to an explicit theme pick
(`:root.theme-sepia`, `.theme-nord`, …) — the parent's own themes still work.

## Palette (`src/index.css`, parent blocks)

Light — dusk, not midday:

| Token | Value | Reads as |
|---|---|---|
| `--background` | `38 24% 93%` | dusk sand — greyer, quieter than the kid cream |
| `--foreground` | `203 26% 23%` | deep-sea ink, softened |
| `--card` / `--popover` | `40 33% 98%` | warm paper white |
| `--primary` | `186 45% 26%` | deep marine teal — the kid's rockpool teal, settled |
| `--secondary` / `--accent` | `188 20% 90%` / `190 22% 89%` | evening shallows |
| `--warning` | `33 78% 35%` | **lantern amber — the "you need to act" voice** |
| `--destructive` | `6 52% 44%` | ember, not coral — information, not alarm |
| `--success` | `157 32% 30%` | deep kelp — the child's completions |
| `--info` | `200 42% 36%` | dusk sea blue |

Dark — the pool at night from the porch: `--background: 205 25% 11%`,
`--foreground: 42 18% 86%`, primary lifts to `184 38% 55%`, amber to
`38 70% 58%`.

Register rules:

- **Amber is spent, never decorated with.** It appears only where action is
  needed: the Overdue glance tile when non-zero, the Needs-attention section
  header and count, the not-connected sync dot.
- **Kelp (success) is the child's voice.** Completions, the connected sync dot,
  the Done-today tile.
- **Ember (destructive) is reserved for broken plumbing** (sync errors), never
  for the child's behaviour.

## The identity mark (`src/components/ParentIdentityMark.tsx`)

The kid app's mark is three bubbles drifting free. The parent mark holds the
same three bubbles inside one calm ring — the same water, watched over. Inline
SVG drawn from live theme tokens (no asset file, follows every theme). The
wordmark keeps "Tiny Bubbles" as the product name and demotes "Parent" to a
quiet small-caps tag: a role, not part of the name. Replaces the old
logo.png-plus-appended-text placeholder in the sidebar header
(`Layout.tsx`, parent branch only).

## The FAMILY sidebar section (`Layout.tsx`)

The section the app exists for reads as home, not as one more nav group: the
header takes the teal accent and the section body sits in a softly ringed card
(`bg-primary/[0.05] ring-primary/15`); the active Dashboard item gets a
stronger wash (`bg-primary/10`) than the stock `bg-primary/5`. Structure,
collapse behaviour and drag-and-drop are untouched.

## The Family dashboard (`src/components/views/FamilyDashboardView.tsx`)

Buckets, rows and the sync line are Fable's; the paint is:

- **Glance tiles** — three calm cards: icon in a tinted well, large
  tabular-nums count, small label. Overdue lights amber only when non-zero;
  Done-today is kelp; Due-today is teal-calm.
- **Sections as cards** — quiet uppercase header, count chip, divided rows.
  Needs-attention tints amber when it has content. Empty states are plain
  one-liners.
- **Sync strip** — a pill: status dot (kelp connected / amber not connected /
  ember error, `role="alert"` when broken), the sync line, and the CTA as a
  small solid pill. The CTA remains the parent flavour's only onboarding.
- **Finished feed rows** — `FamilyCompletedRow`, not the stock read-only task
  row: a settled kelp check-bubble, the title readable (not struck through —
  done here means *accomplished*, not cancelled), the project name, and the
  completion time the parent came for ("Today, 4:12 PM" / "Yesterday, …" /
  date). Static by design; the other three sections keep interactive
  `StoreTaskItem` rows.
- **Overdue dates on those stock rows read amber, not ember.** The stock row
  paints an overdue due date `text-destructive`, but ember is reserved for
  broken plumbing, never for the child's behaviour — so a scoped rule
  (`html[data-flavour='parent'] .family-dashboard [data-task-id] .text-destructive`
  in `index.css`) repaints it warning amber inside the dashboard only. The
  sync strip's genuine error state keeps its ember.

## Verified, not assumed

Checked against the live dev server with Playwright (screenshots inspected,
not theorised): light and dark, empty and seeded (overdue / due today /
coming up / finished all populated), collapsed sidebar, Settings. The
register holds everywhere: amber only where action is needed, kelp for the
child's completions, ember only on broken sync.

## Known state

- The `Layout.test.tsx` "sync conflict surface" red seen earlier was a
  runner artifact: under the project's actual desktop runner (`vitest run`)
  the full file is green (27/27, plus 4/4 in
  `family-dashboard-buckets.test.ts`). It only fails under `bun test`, which
  is not how desktop tests run.
- `Layout.tsx` previously contained four literal NUL bytes inside
  `.join('\x00')` separators, which made the file read as binary to editors;
  they are now `'\0'` escapes — byte-identical string values, no behaviour
  change.
