# Tiny Bubbles — simplify + soft-restyle plan

Governing directives: `D:\1Projects\tinybubbles-v3\OWNER-PROMPTS.md` entries **12** ("we arent
reinventing the wheel or adding more shit here … simply it as much as we can even if it doesnt
feel fully like a kids thing yet just simolly and stly e it for tiny bubbles and soft tones")
and **14** ("the calncer can be a kids calcners and like the task maker for adut can be
simplified for a kid like easier but we keep the underlying framework of the mature mindwtr
base"). Brief: `KIDS-SHELL-BRIEF.md`. Rule for every item: hide/collapse at the presentation
layer in `apps/desktop/`; `packages/core/` keeps doing the real work and is never edited; no
test is ever edited or deleted to go green.

---

## 0. Already done on the tree (uncommitted, verified green)

Three Kimi passes have landed. `bun run typecheck` passes, `bunx --bun vite build` passes,
production preview loads with zero console errors. `packages/core/` untouched; no test file
modified. Everything is documented in `apps/desktop/DESIGN.md` (palette tables, hidden-item
list, full red-test inventory).

- **Light + dark retone, token-level** — `apps/desktop/src/index.css` (`:root` and `.dark`
  blocks): warm foam background, deep-sea ink, muted teal primary, softened status/badge
  colors. `apps/desktop/tailwind.config.js`: global borderRadius softening, `--radius` 0.85rem.
  Rounded system font stack on `body`.
- **Sidebar collapsed to five plain destinations** — `apps/desktop/src/components/Layout.tsx`:
  Focus, Inbox, Projects, Calendar, Done. Hidden but still URL/keyboard-routable: Someday/
  Maybe, Waiting For, Reference, Contexts, Review, Board, Obsidian, Archived, Trash. Nav rows
  44px.
- **In-view toolbars hidden** — `views/agenda/AgendaHeader.tsx` (Show Top 3 Only / Filters /
  Show details / Group row no longer renders), `views/list/ListHeader.tsx` + `ListView.tsx`
  (`hideControls` prop, applied to Inbox only).
- **Plain-language display overrides** — new `apps/desktop/src/lib/display-labels.ts`
  (`displayLabel(t, key, fallback)`), wired in `App.tsx`, `Task/TaskItemDisplay.tsx`,
  `Task/fields/TaskMetadataFields.tsx`: "Next Actions"→"to do", "Next"→"To do",
  "Someday/Maybe"→"Maybe later", "Waiting For"→"Waiting". Core translations untouched.
- **Test impact so far: 37 failing / 1955 passing** in the desktop suite — 6 sidebar-hiding,
  ~28 toolbar-hiding + label-override, 3 pre-existing on the branch (2 tauri-invoke ratchet,
  1 keybinding). Complete per-test list in DESIGN.md. None edited.

## 1. How theming actually works (and the answer to "add a theme?")

Each theme is a CSS-variable block in `apps/desktop/src/index.css`: `:root` (light, lines
~25–91), `.dark` (~92–155), and `:root.theme-eink | theme-nord | theme-sepia |
theme-catppuccin-macchiato | theme-dracula` (~156–430). `apps/desktop/src/lib/theme.ts`
applies them: `DesktopThemeMode` union → `THEME_MODE_CLASSES` map → `applyThemeMode()` toggles
the class plus `.dark`. Whether a mode renders dark comes from **core**:
`resolveThemeColorScheme` in `packages/core/src/theme-scheme.ts`, and the settings value
`settings.theme` is typed by core's `AppTheme` union (`packages/core/src/types.ts:313`, which
also carries mobile-only `material3-*`/`oled` that desktop collapses).

**Conclusion: a new named "Tiny Bubbles" theme cannot be added cleanly without editing
`packages/core`** (AppTheme union + resolveThemeColorScheme + mobile parity). The correct
no-core-edit move — already taken — is to **retone the default `:root`/`.dark` blocks in
place**. Record as a core ask only if a separately-selectable theme is ever wanted. The other
adult themes (nord, dracula…) remain selectable in Settings; trimming that picker is item 8.

## 2. Ordered work items (each sized for one ~10-minute Kimi pass)

**Item 1 — Task row calm-down.** `apps/desktop/src/components/Task/TaskItemDisplay.tsx`
(1036 lines). The per-row status `<select>` pill is an adult control on every row (Kimi
already flagged it); hide it from the default row along with secondary metadata badges
(contexts, tags, time-estimate, age). Keep: large checkbox, title, star, due-date chip.
Same pass: default `settings.appearance.textSize` fallback to `'large'` at its App.tsx
consumption site (line ~299) — shell-local default, not a settings write.
*Done:* a task row is checkbox + title + star + due chip; typecheck/build green; new red
tests appended to DESIGN.md.

**Item 2 — Kid task editor via existing field-visibility system.** The editor is already
fully config-driven: `settings.gtd.taskEditor.{order,hidden,sections,presentation}` →
`useTaskItemFieldLayout.ts` → `TaskItemFieldRenderer.tsx`. The **defaults live desktop-side**
in `apps/desktop/src/components/Task/task-item-helpers.ts`: shrink
`DEFAULT_TASK_EDITOR_VISIBLE` (currently 12 fields) to a child set — suggest `['dueDate',
'description', 'checklist', 'attachments']` — so `DEFAULT_TASK_EDITOR_HIDDEN` recomputes
automatically. **No rewrite of TaskItemFieldRenderer.** Verify the fixed fields
(`TASK_EDITOR_FIXED_FIELDS = ['status','project','section','area']`) respect the hidden list;
if any can't hide via defaults, hide at the render site. Explicit saved user customizations
(Settings → GTD → Task Editor Layout) still win — that is the adult escape hatch, keep it.
Also hide the editor's layout-help button in `TaskItemEditor.tsx` (~line 520).
*Done:* opening a task shows title + ~4 plain fields; adult can still re-enable via Settings.

**Item 3 — Calendar chrome strip.** `apps/desktop/src/components/views/CalendarView.tsx`
(1044 lines) + `views/calendar/`. Keep one obvious mode (month) as default; hide the header
chrome: search, zoom (`Minus`/`Plus`), week-day-count and mode toggles; hide the
`CalendarPlanningPanel` entirely (already collapsed by default via
`tinybubbles.calendar.planningPanelCollapsed`). Keep big prev / today / next. The engine
(`use-calendar-composer.ts`, core's `calendar-composer.ts`/`recurrence.ts`) still decides
what appears on each day — presentation only.
*Done:* calendar = month grid + three navigation controls, nothing else; drag/keyboard paths
may go red in tests — record, don't edit.

**Item 4 — Kid day cells + selected-day panel.** `views/calendar/CalendarSelectedDayPanel.tsx`,
`calendar-primitives.ts`, day-cell rendering inside `CalendarView.tsx`. Bigger day cells,
task chips instead of dense dots/text, 44px+ tap targets, plain words in
`CalendarModals.tsx` composer via `display-labels.ts`.
*Done:* tapping a day shows a large, readable, soft list of that day's tasks.

**Item 5 — Quick add simplification.** `Task/TaskInput.tsx` (662 lines),
`Task/TaskEditorAiPanels.tsx`, `Task/TokenAutocompleteInput.tsx`. One plain placeholder,
big Add button, suppress token-syntax autocomplete hints and AI chrome from the default
capture surface (capability intact underneath — NLP dates etc. keep working on typed input).
*Done:* capture = one friendly input + one big button.

**Item 6 — Projects view calm-down.** `views/ProjectsView.tsx` (912 lines). Hide project
management chrome (review metadata, bulk/sort controls, status jargon); simple named lists
with a soft progress indicator.
*Done:* Projects reads as "my lists", not a PM dashboard.

**Item 7 — Jargon sweep.** Extend `src/lib/display-labels.ts` across remaining visible
strings: task-editor field labels, the Welcome/onboarding modal copy in `App.tsx`
("Set up sync" etc. — adult-facing, but soften), empty states, Search placeholder
("Tasks, projects, people"). Centralized map only; English-first (documented limitation —
other locales fall back to core translations).
*Done:* none of the five surfaced views shows GTD vocabulary.

**Item 8 — needs an owner decision, do not start unprompted.** (a) Settings stays reachable
(adults/therapists configure there) — optionally demote to footer-icon-only; (b) trim the
adult theme list in `views/settings/SettingsMainPage.tsx`; (c) the ~65 deliberately-red
tests: someone who owns that call updates them to the new contract, or the hidden surfaces
return. Not Kimi's call, not mine.

## 3. Simplification inventory (view-by-view)

| Surface (file) | Disposition |
|---|---|
| Focus/agenda (`views/AgendaView.tsx`) | **Stays** — primary screen; toolbar already hidden |
| Inbox (`views/ListView.tsx` inbox mode) | **Stays** — controls row already hidden |
| Projects (`views/ProjectsView.tsx`) | **Stays**, calmed (item 6) |
| Calendar (`views/CalendarView.tsx`) | **Stays**, simplified hard (items 3–4) |
| Done (`views/ListView.tsx` done mode) | **Stays** — celebration surface |
| Someday/Waiting/Reference lists | **Hidden** (done) — routable, relabeled "Maybe later"/"Waiting" |
| Contexts / Review / Board / Obsidian | **Hidden** (done) — engine capability intact |
| Archived / Trash | **Hidden** (done) |
| Settings (`views/SettingsView.tsx` + `settings/`) | **Stays reachable** — adult surface; item 8 decision |
| Search (Ctrl+K, `views/SearchView.tsx`) | **Stays** — placeholder rewording in item 7 |
| Quick add (`Task/TaskInput.tsx`) | **Stays**, simplified (item 5) |
| Task row (`Task/TaskItemDisplay.tsx`) | **Stays**, calmed (item 1) |
| Task editor (`Task/TaskItemFieldRenderer.tsx`) | **Stays**, shrunk via config defaults (item 2) |
| Pomodoro panel | Already feature-gated off by default (`features.pomodoro === true` opt-in) — leave |

## 4. Risks and the per-item check

- **Red tests are expected and sanctioned** — the brief says report, never edit. Current
  count 37; items 1–6 will add more (task-row and calendar tests especially). After every
  item: `git diff --name-only -- '*.test.ts' '*.test.tsx'` must be empty, and DESIGN.md's
  test-impact list must grow to match reality.
- **Change desktop-local defaults, never write settings data.** Settings sync across devices
  (`settings.theme`, `settings.gtd.taskEditor` live in synced AppData). Defaults in shell
  code (task-item-helpers.ts, App.tsx fallbacks) restyle without touching user data, and
  explicit user customizations always win.
- **Hidden views must stay routable** — do not remove `App.tsx` view cases; hiding is
  Layout-level only. This is what keeps "functionality stays the same".
- **`packages/core/` diff must stay empty** — check `git diff --stat -- packages/core/`
  after every pass.
- **i18n**: display-label overrides are English-only; non-English locales gracefully fall
  back to core translations. Documented in DESIGN.md.
- **Known dev-only issue** (pre-existing): three console exceptions on dev-server load
  ("Failed to fetch dynamically imported module" — BoardView/ObsidianView/ReviewView, from
  the idle prefetch at `App.tsx` ~1132–1145). Production build is clean. Don't chase it
  during styling passes.
- **Per-item verification**: `bun run typecheck` → `bunx --bun vite build` (in
  `apps/desktop`) → load dev server, check console (modulo the known dev-only errors) →
  screenshot **both light and dark** (theme defaults to `system`; forcing:
  `localStorage['tinybubbles-theme']='light'|'dark'`) → core diff empty → test-file diff
  empty → DESIGN.md updated.
