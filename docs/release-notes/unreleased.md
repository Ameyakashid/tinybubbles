# Mindwtr Unreleased

Changes collected after `v1.1.6` and before the next version tag.

## Highlights

_None yet._

## Full Change List

- Mobile: adding a task from a project opened via the Projects tab returns to that project again instead of dropping back to the projects list. (#766)
- Desktop: Windows sync verifies TLS through the Windows certificate engine again, so setups behind corporate TLS interception (for example Zscaler) sync like they did before 1.1.6. macOS and Linux keep the 1.1.6 TLS 1.3 support. (#663)
