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
