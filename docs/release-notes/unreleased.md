# Mindwtr Unreleased

Changes collected after `v1.1.6` and before the next version tag.

## Highlights

_None yet._

## Full Change List

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
