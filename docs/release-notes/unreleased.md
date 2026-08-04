# Mindwtr Unreleased

Changes collected after `v1.1.6` and before the next version tag.

## Highlights

_None yet._

## Full Change List

- Desktop: pressing Enter in the context menu's Start Date, Due Date, Review Date, Area, and Contexts panels now saves the value and closes the dialog, matching the task editor. (#992)
- Mobile: adding a task from a project opened via the Projects tab returns to that project again instead of dropping back to the projects list. (#766)
- Desktop: Windows sync verifies TLS through the Windows certificate engine again, so setups behind corporate TLS interception (for example Zscaler) sync like they did before 1.1.6. macOS and Linux keep the 1.1.6 TLS 1.3 support. (#663)
- Desktop: the collapsed Plan next actions panel can be expanded again at any window size — narrow windows show a labeled row instead of hiding it, and the wide-window side rail accepts clicks along its full height. (#977)
- Mobile: the Area chip in the Add Task options row shows its icon like the Contexts and Project chips. (#632)
- Mobile: editing or completing one task no longer re-renders every visible row, cutting the per-action lag in large projects. (#766)
- Mobile: task rows no longer stay stuck mid-air after a drag ends in Task order mode, which left permanent gaps and overlapping cards in long lists. (#784)
- Feedback form: the email field now says it is how you get a reply, instead of showing an example address.
- Voice capture: OpenAI's new `gpt-transcribe` model is available and is the default for new OpenAI speech-to-text setups — noticeably better accuracy on accents, numbers, and noisy audio. Existing model choices are unchanged. The mobile Gemini speech model list also offers the current Gemini 3.x models again. (#984)
- AI assistant: the model suggestions now include OpenAI's GPT-5.6 family (the default for new OpenAI setups) and Claude Opus 5. Saved model choices are unchanged, and older ids still work when typed. (#985)
- AI settings: the model pickers (assistant, copilot, and remote speech-to-text) now list your provider's current models when an API key or custom server is configured, instead of a fixed list — a self-hosted OpenAI-compatible server shows its own models. The built-in suggestions remain as the fallback whenever the list can't be fetched, and local Whisper stays fully offline. (#986)
- Desktop (Linux): the Flatpak no longer crashes or reports "Evolution Data Server is unavailable" when reading system calendars or enabling task push — the sandbox could load two conflicting copies of the calendar libraries. (#575)
- Mindwtr speaks Swedish (Svenska): a complete translation of every interface string, selectable from the language picker on desktop and mobile. That makes 20 languages.
- Desktop (Linux): with Appearance set to System, KDE Plasma with a dark theme starts in dark mode right away, instead of starting light until Settings was opened. (#989)
- Desktop (Linux): the window's minimize/maximize/close buttons respond again on Wayland when the app starts unmaximized or is reopened from the tray, without needing to maximize the window first. (#988)
- Nord theme: context dots and calendar colors now use Nord-flavored colors instead of the default palette — calendars follow the mapping contributed in the issue thread, and every stored color stays unchanged, so nothing re-syncs or moves. (#974)
- With an Area selected, the project picker's search now finds every project, not just the selected area's — the list still suggests the area's projects until you type. Applies to the task editor, inbox processing, and quick panels on desktop and mobile. (#987)
- Sync (Local File Sync): setting up file sync in a fresh folder no longer fails with "TypeError: undefined is not an object" on every attempt — the first sync now completes and writes the sync file. (#990)
- Russian: "No area" is now translated as «Нет области» instead of the literal «Нет площади».
- The mobile app now resumes writes only after it applies the exact healthy database snapshot it loaded. This prevents a stale in-memory snapshot from overwriting recovered tasks after a storage failure or migration.
- Mindwtr now queues another sync pass when a local edit arrives during the fast unchanged-check, instead of reporting success before that edit reaches the remote copy.
- Sync setup now activates a new or changed destination only after it can read, merge, write, and account for every live attachment there. A failed check keeps the last verified setup; if Mindwtr cannot verify the rollback, it leaves sync off. Desktop and mobile.
- Desktop (Linux/macOS): the file holding your saved passwords, sync tokens, and API keys is now readable only by your own user account. On a shared computer, other accounts could previously read it. If you have used Mindwtr on a shared Linux or macOS machine, rotate those credentials. Windows is unchanged and needs no equivalent: installed copies keep this file inside your user profile, which other standard accounts already cannot read, and portable mode is deliberately left alone since permissions pinned to one machine's accounts would break moving the folder between computers.
- Weekly review: the AI review step now ignores any suggestion that does not match one of the items it was asked to review, so nothing outside that list can be archived or moved to Someday.
- Search: task results now carry a labeled date — "Completed" with the date the task was finished, or "Due" with its deadline (in red once it has passed). Tasks with neither look the same as before. On desktop and mobile. (#991)
- Desktop: opening a done or archived task from search now shows it. The Done and Archive lists expand one matching group, keep other collapsed groups folded, scroll to the row, and flash it. Mindwtr also says when it clears an archive filter that hid the task. Finished project tasks open in Done or Archive because project pages cannot show them. (#991)
- Calendar: a recurring task with "Show future occurrences in Calendar" on (renamed from "Show next occurrence in Calendar") now paints every occurrence across the visible month, week, or schedule range. A daily task fills every visible day. Far-future views preserve the spacing between Start, Due, and Review dates and respect COUNT and UNTIL limits. Ended series no longer consume the preview budget needed by active series. Previews stay read-only, and device-calendar push is unchanged. Desktop and mobile.
- Desktop: the task editor's Scheduling section is quieter — reminder options collapse into one line that says whether reminders are on and how often they repeat, a recurring rule rests as a single sentence like "Weekly on Mon, Tue · Ends: Never" that opens to the full editor, and Start Date and Review Date now sit next to the other dates instead of below the recurrence controls.
- Focus: group headers (by context, tag, area, and so on) now use the same uppercase style as every other grouped list. Desktop and mobile. (#994)
- Focus and Next actions: a task whose start date includes a specific time now stays hidden until its exact start time. It appears when the time passes, so it does not occupy a morning slot. Open searches with Hide future tasks also refresh at midnight and at the next start time. Date-only start dates still show all day, and Daily Review still offers tonight's tasks while you plan the morning. Desktop and mobile. (#995)
- Mobile accessibility: task rows now announce localized Status and Due labels and point screen-reader users to the accessibility actions menu instead of giving English-only swipe and long-press instructions.
- Desktop (Linux, deb/rpm): the alt-tab switcher on KDE Plasma Wayland now shows the Mindwtr icon instead of the generic Wayland fallback — the packages ship a hidden desktop entry whose name matches the window's app id exactly. Menus and pinned launchers are unchanged. (#997)
- Mobile: Bulk organize can change Project and Area again — tapping those rows now opens the picker instead of flashing and leaving the selection stuck on "Keep project" / "Keep area". Contributed by @matharman. (#1004)
- Mobile: reference material attached to a project now shows in the project view — a References section sits below the task list, and references whose tags match the project's tags appear there too, matching desktop. (#1000)
- Sync: libraries with permanently deleted tasks no longer rewrite every deletion marker on every sync cycle — a loop that kept each cycle triggering the next one, with multi-second database writes and repeated uploads on large libraries. Saves during sync are now much smaller, and sync settles instead of re-running. Desktop and mobile. (#766)
- Mobile: completing or saving a task no longer pauses to scan the whole library before responding — the auto-sync change check now runs shortly after the edit instead of during it, cutting a fixed delay from every action on large libraries. (#766)
