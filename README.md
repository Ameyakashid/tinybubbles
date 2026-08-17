<div align="center">

# Tiny Bubbles

**Get everything out of your head.** Tiny Bubbles is a free, open-source to-do app built on
the Getting Things Done (GTD) method: it captures every task and idea in seconds, then shows
you the one next thing to do. No account, no subscription, and your data stays on your
device.

[![GitHub license](https://img.shields.io/badge/license-AGPL--3.0-brightgreen)](LICENSE)

</div>

---

> ### 🫧 This is a fork
>
> Tiny Bubbles is a modified version of **[Mindwtr](https://github.com/dongdongbh/Mindwtr)**
> by dongdongbh and the Mindwtr contributors, used under the AGPL-3.0 licence and forked at
> commit [`08b1822`](https://github.com/dongdongbh/Mindwtr/commit/08b18222d8eaf5403d2b05b9a0be39a30008d5d2).
> All credit for the original design and implementation is theirs.
>
> **If you want the polished, actively released, app-store-published product, use
> [Mindwtr](https://github.com/dongdongbh/Mindwtr) — not this.** This fork exists to grow in
> a different direction and is not a replacement for upstream.
>
> See [`NOTICE.md`](NOTICE.md) for full attribution, licence obligations and the statement of
> changes.

> ### ⚠️ Status: early
>
> Tiny Bubbles does not yet publish binaries. There is no App Store, Play Store, Flathub,
> F-Droid, Snap or Microsoft Store listing for it, and no installer to download. To try it
> you must build from source. The only currently released work is a rebrand of upstream —
> the features below are inherited from Mindwtr and behave as they do there.

---

## Sound familiar?

- **"I'll remember it." You won't.** One hotkey, type it, forget it safely. That's capture.
- **Your to-do list has 80 items, so you avoid it.** Focus shows only the few things you can do right now.
- **"Plan Mom's birthday" has been stuck for weeks.** Turn it into a project of small steps, so the next one is always obvious.
- **You asked a coworker for something and you both forgot.** Waiting For tracks it so you remember to follow up.
- **"Learn guitar someday" guilt-trips you from the list.** Park it in Someday/Maybe: kept, not nagging.
- **Sunday night, everything feels out of control.** A guided weekly review puts you back in charge.

## How it works

Your head is for having ideas, not for holding them (David Allen, who wrote the book on
this). Tiny Bubbles holds them for you:

1. **Dump it.** A task, an idea, a worry: type it (or speak it) and it lands in your Inbox. Global hotkey on desktop, widget and share sheet on your phone.
2. **Sort it.** A short guided pass over the Inbox. Takes two minutes? Do it now. Has a date? Schedule it. Waiting on someone else? Track it. Just a maybe? Shelve it for someday.
3. **Do it.** Open Focus and see only what you can act on right now. Everything else stays out of sight.
4. **Reset weekly.** A guided review catches loose ends, so the list stays trustworthy and your head stays clear.

If you know GTD: that is Capture, Clarify, Organize, Engage, and Reflect, end to end. If you
don't, no problem: Tiny Bubbles walks you through each step, and
[GTD in 15 minutes](https://hamberg.no/gtd) is a friendly introduction whenever you're curious.

## Philosophy

**Don't show me a cockpit when I just want to ride a bike.**

Tiny Bubbles is simple by default and powerful when you need it:

- Advanced options stay hidden until they matter.
- Fewer fields, fewer knobs, fewer distractions.
- Clarity beats clutter: we say no to feature creep.

## Features

*Inherited from upstream Mindwtr.*

- The full GTD loop, guided: capture, sort, do, review.
- Focus view puts today's schedule and your next actions on one screen.
- Your data lives on your device. Sync is optional, and you pick where: iCloud on Apple devices, Dropbox, a shared folder, your own server, or WebDAV.
- Projects with sections, areas, and manual task ordering for bigger plans.
- Import tasks from your Obsidian notes, with links back to the source (desktop).
- Optional AI helper: connect your own OpenAI, Gemini, or Claude account, or run a private AI on your own computer. Off by default.
- Apps for Windows, macOS, Linux, iPhone, and Android, plus a web app that works offline.
- For developers: a local REST API, a CLI, and an MCP server so AI assistants can manage your tasks.

<details>
<summary>See all features</summary>

### GTD Workflow

- **Capture** - Quick add tasks from anywhere (global hotkey popup, tray, share sheet, voice)
- **Clarify** - Guided inbox processing with 2-minute rule
- **Organize** - Projects, sections, contexts, and status lists
- **Reflect** - Weekly review wizard with reminders
- **Engage** - Context-filtered next actions
- **AI Assist (Optional)** - Clarify, break down, and review with your own AI account (OpenAI, Gemini, Claude) or a local/self-hosted OpenAI-compatible model

### Views

- 📥 **Inbox** - Capture zone with processing wizard
- 🎯 **Focus** - Agenda (time-based) + Next Actions in one view
- 📁 **Projects** - Multi-step outcomes with sections, areas, and manual task ordering
- 🏷️ **Contexts** - Tag tasks by where or how you get them done; nested contexts like @work/meetings also match @work
- ⏳ **Waiting For** - Delegated items
- 💭 **Someday/Maybe** - Deferred ideas
- 📅 **Calendar** - Time-based planning with adjustable mobile week density
- 📋 **Board** - Kanban-style drag-and-drop
- 📝 **Review** - Daily + weekly review workflows
- 📦 **Archived** - Hidden history, searchable when needed

### Productivity Features

- 🔍 **Global Search** - Search all areas globally with operators (`status:`, `context:`, `assigned:`, `location:`, `where:`, `id:`, `-id:`, `due:<=7d`)
- 📦 **Bulk Actions** - Multi-select, batch move/tag/delete
- 📎 **Attachments** - Files and links on tasks
- ✏️ **Markdown Notes** - Rich text descriptions with preview
- 🗂️ **Project States** - Active, Waiting, Someday, Archived
- ♾️ **Fluid Recurrence** - Next date is calculated after completion
- ♻️ **Reusable Lists** - Duplicate tasks or reset checklists
- ✅ **Checklist Mode** - Fast list-style checking for checklist tasks
- ✅ **Audio Capture** - Quick voice capture with automatic transcription and task creation
- 🧭 **Copilot Suggestions** - Optional context/tag/time hints while typing
- 🍅 **Pomodoro Focus (Optional)** - 15/3, 25/5, 50/10 timer panel in Focus view with one optional custom preset
- 🔔 **Notifications** - Separate start and due reminders with snooze
- 📊 **Daily Digest** - Morning briefing + evening review
- 📅 **Weekly Review** - Customizable weekly reminder

### Data & Sync

- 🔄 **Sync Options** - Multiple backends; see the docs in [`docs/`](docs/)
- 🍎 **iCloud Sync** - Built-in sync on supported iPhone, iPad, and macOS builds (CloudKit)
- ☁️ **Dropbox Sync (Optional)** - Sign in with Dropbox and sync through a private app folder
- 📤 **Export/Backup** - Export data to JSON
- ♻️ **Restore from Backup** - Replace local data from a validated backup with a recovery snapshot first
- 📥 **TickTick + Todoist + DGT GTD + OmniFocus + Apple Reminders + CSV Import** - Import TickTick CSV/ZIP, Todoist CSV/ZIP, DGT GTD JSON/ZIP, OmniFocus exports, incomplete Apple Reminders, or any app via a documented generic CSV format
- 🔗 **Obsidian Integration** - Desktop vault task import with deep links back to source notes
- 🗓️ **External Calendars (System + ICS)** - Mobile reads system calendars and pushes dated tasks; macOS desktop reads Apple Calendar and can push dated tasks; desktop/web also support ICS subscriptions and task creation from events

### Automation

- 🔌 **CLI** - Add, list, complete, search from terminal by running the repo helper
- 🌐 **REST API** - Optional desktop localhost API server for token-authenticated scripting
- 🌍 **Web App** - Runs in your browser, works offline (PWA)
- 🧠 **MCP Server** - Lets AI assistants read and manage your tasks (a local Model Context Protocol server), built from [`apps/mcp-server/`](apps/mcp-server/) in this repo

Desktop builds can start the local REST API from **Settings -> Advanced** on `127.0.0.1`
with default port `3456` and a generated bearer token. The CLI remains a repo helper; the
stdio MCP server is built from source in this repo.

### Cross-Platform

- 🖥️ **Desktop** - Tauri v2 (macOS, Linux, Windows)
- 📱 **Mobile** - React Native/Expo (iOS, Android) with in-app tips for gestures and app shortcuts
- 📲 **Android Widget** - Home screen focus/next widget
- ⌨️ **Keyboard Shortcuts** - Standard (Gmail-style), Vim, and Emacs presets
- 🎨 **Themes** - Light, Dark, OLED, Nord, Sepia, E-ink, and Material 3
- 🌍 **i18n** - English, Vietnamese, Chinese (Simplified), Chinese (Traditional), Spanish, Hindi, Arabic, German, Russian, Japanese, French, Portuguese, Polish, Korean, Czech, Italian, Turkish, Dutch, Persian, Swedish
- 🐳 **Docker** - Run the PWA + self-hosted sync server with Docker

</details>

## Installation

**There are no published Tiny Bubbles builds yet.** Build from source:

```bash
bun install
bun run dev
```

### Parent (admin) flavour

One codebase ships two apps. Built with `VITE_TINYBUBBLES_FLAVOUR=parent`, the desktop app
becomes **Tiny Bubbles Parent**: the full UI with a Parent identity that opens on a Family
dashboard (overdue / due today / coming up / recently finished). Point its self-hosted sync
at the **same server URL and token** as the child's device and everything flows both ways
through the ordinary sync engine — a task the parent adds appears on the child's device, a
completion the child makes appears on the parent's dashboard. The parent flavour keeps
appearance/language device-local by default and skips the sample-data onboarding so nothing
is seeded into the child's namespace.

```bash
cd apps/desktop
VITE_TINYBUBBLES_FLAVOUR=parent bunx vite   # parent web app (dev)
```

Serving browsers on more than one origin from one sync server: give
`TINYBUBBLES_CLOUD_CORS_ORIGIN` a comma-separated origin list.

See [`docs/`](docs/) for the inherited build and deployment guides, and
[`docker/README.md`](docker/README.md) for the Docker setup.

If you want a ready-to-install GTD app today, install
[Mindwtr](https://github.com/dongdongbh/Mindwtr) instead — it is published on the major app
stores and package managers.

## Contributing

Start with [CONTRIBUTING.md](docs/CONTRIBUTING.md).

- **Report bugs and request features:** [GitHub Issues](https://github.com/Ameyakashid/tinybubbles/issues)
- **Help with translations:** [`packages/core/src/i18n/locales/`](packages/core/src/i18n/locales/)
- **Contribute code/docs:** open a pull request and follow the contribution guide and commit conventions.

Bugs that also affect upstream are best reported to
[Mindwtr](https://github.com/dongdongbh/Mindwtr/issues) as well, so its users benefit too.

## Documentation

- 📚 [Docs in this repo](docs/)
- 📝 [Release Notes Index](docs/release-notes/README.md)
- 🔒 [Security Policy](SECURITY.md)
- ⚖️ [Attribution, licence and changes](NOTICE.md)

Upstream Mindwtr's hosted documentation at <https://docs.mindwtr.app/> covers the shared
functionality in more depth. It documents upstream, not this fork, so anything Tiny Bubbles
has changed will differ.

## Licence

Tiny Bubbles is licensed under the **GNU Affero General Public License v3.0 only**
(AGPL-3.0-only), inherited from upstream Mindwtr. The full text is in [`LICENSE`](LICENSE).

Note that AGPL §13 applies to network use: if you deploy the optional sync server in
`apps/cloud/` and let others use it, you must offer them the complete corresponding source
of your modified version. See [`NOTICE.md`](NOTICE.md).

*"Mindwtr" is the upstream project's name and is not claimed by this fork.*
