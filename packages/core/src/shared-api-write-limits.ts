// Single home for two numeric limits that apps/cloud (the self-hosted REST API) and
// apps/mcp-server (the MCP write surface) each hand-maintained independently and had
// drifted apart (2026-07-30 deepening): cloud allowed a 500-character area name (reusing
// MAX_TASK_TITLE_LENGTH) and a 1000-row page while MCP capped both at 200/500. Aligned to
// MCP's stricter numbers here — nothing user-visible depended on the looser cloud values —
// so a future re-tune only needs one edit.
//
// Zero external dependencies, so this stays safe to import from anywhere.
export const AREA_NAME_MAX_LENGTH = 200;
export const LIST_PAGE_MAX_LIMIT = 500;
