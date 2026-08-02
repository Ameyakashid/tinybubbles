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
- Desktop: the file holding your saved passwords, sync tokens, and API keys is now readable only by your own user account. On a shared computer, other accounts could previously read it. If you have used Mindwtr on a machine you share, rotate those credentials.
- Weekly review: the AI review step now ignores any suggestion that does not match one of the items it was asked to review, so nothing outside that list can be archived or moved to Someday.
