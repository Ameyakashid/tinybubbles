# Tiny Bubbles MCP Server

MCP server for Tiny Bubbles. Connect MCP clients (Claude Desktop, etc.) to either your local Tiny Bubbles SQLite database or a self-hosted Tiny Bubbles Cloud endpoint.

By default this is a **stdio** server: MCP clients launch it as a subprocess and talk over JSON-RPC on stdin/stdout. It also has an opt-in **HTTP transport** (see [Remote access (HTTP)](#remote-access-http)) for self-hosters who want to expose it at a URL instead.

---

## App Binaries vs. MCP Helper

The desktop and mobile app binaries include the Tiny Bubbles app, but they do **not** currently include a desktop start/stop toggle or a standalone `tinybubbles-mcp` command on your `PATH`.

You do **not** need to run the whole app from source to use MCP. You can use the normal desktop app binary for your tasks, then run this separate MCP helper from the repository with Bun, or build the helper once and run it with Node. Point the helper at the desktop app's local `tinybubbles.db`.

On desktop, the app shows the exact local data path in **Settings -> Sync -> Local Data**. Mobile binaries do not expose a local MCP server surface.

---

## Requirements

- Node.js 18+ (for the MCP client that spawns the server)
- npm package installs use better-sqlite3, a native SQLite addon. If no prebuilt binary is available for your platform, npm needs a working C/C++ build toolchain and Python for node-gyp.
- Bun (recommended for development in this repo)
- A local Tiny Bubbles database (`tinybubbles.db`) for local mode, or a self-hosted Tiny Bubbles Cloud URL and bearer token for Cloud mode

Default database locations:
- Linux: `~/.local/share/tinybubbles/tinybubbles.db`
- macOS: `~/Library/Application Support/tinybubbles/tinybubbles.db`
- Windows: `%APPDATA%\tinybubbles\tinybubbles.db`

Additional macOS path for sandboxed builds:
- `~/Library/Containers/tech.dongdongbh.tinybubbles/Data/Library/Application Support/tinybubbles/tinybubbles.db`

If `tinybubbles.db` is missing but `data.json` exists in the same desktop data folder, the MCP server will bootstrap a fresh SQLite database from that local data snapshot on first start.
Desktop Settings → Sync → Local Data shows the exact storage location used by the app.

You can override local mode with:
- `--db /path/to/tinybubbles.db`
- `TINYBUBBLES_DB_PATH=/path/to/tinybubbles.db`
- `TINYBUBBLES_DB=/path/to/tinybubbles.db`

For self-hosted Cloud mode, use:
- `--cloud-url https://tinybubbles.example.com` or `TINYBUBBLES_MCP_CLOUD_URL`
- `--cloud-token <token>` or `TINYBUBBLES_MCP_CLOUD_TOKEN`
- optional `--cloud-allow-insecure-http=true` for trusted private HTTP deployments

---

## Start / Stop

### Run from npm

After installing the published package, run it directly:

```bash
tinybubbles-mcp --db "/path/to/tinybubbles.db"
```

Or let an MCP client launch it through npx:

```json
{
  "mcpServers": {
    "tinybubbles": {
      "command": "npx",
      "args": [
        "-y",
        "tinybubbles-mcp",
        "--db",
        "~/.local/share/tinybubbles/tinybubbles.db"
      ]
    }
  }
}
```

The npm package is read-only by default. Add `--write` only when you explicitly want add/update/complete/delete tools enabled.

### Self-hosted Cloud mode

Use Cloud mode when you run your own Tiny Bubbles Cloud server and want MCP tools without pointing the helper at a local SQLite database:

```bash
npx -y tinybubbles-mcp \
  --cloud-url "https://tinybubbles.example.com" \
  --cloud-token "$TINYBUBBLES_TOKEN"
```

Or pass the same values through environment variables:

```bash
TINYBUBBLES_MCP_CLOUD_URL="https://tinybubbles.example.com" \
TINYBUBBLES_MCP_CLOUD_TOKEN="$TINYBUBBLES_TOKEN" \
npx -y tinybubbles-mcp
```

Cloud mode uses the self-hosted Cloud API. Reads come from the current `/v1/data` snapshot; with `--write`, task/project/section/area writes go through the Cloud server's per-resource REST endpoints (`POST /v1/tasks`, `PATCH /v1/tasks/:id`, and so on), so they get the same validation and revision stamping as any other client. Without `--write`, write tools return `read_only`. Person edits and restoring deleted tasks are not available in Cloud mode yet.

This does not make Tiny Bubbles Cloud itself a hosted MCP server. It is still the same stdio helper, backed by a Cloud URL that you operate.

For private HTTP test deployments, local/private HTTP URLs are allowed by the shared Cloud client rules. Use `--cloud-allow-insecure-http=true` only for a self-hosted endpoint you intentionally trust.

### Remote access (HTTP)

By default `tinybubbles-mcp` only speaks stdio. Pass `--http` to also (instead of stdio) serve a stateless streamable-HTTP MCP endpoint, so you can point a remote MCP client at a URL — the motivating case is [Gemini Spark](https://gemini.google.com) "custom apps", which take an MCP server URL. HTTP mode works with either backend (local SQLite or self-hosted Cloud).

```bash
tinybubbles-mcp --http --http-token "$(openssl rand -hex 32)" --db "/path/to/tinybubbles.db"
```

Flags (all have `TINYBUBBLES_MCP_HTTP*` env var equivalents):

- `--http` / `TINYBUBBLES_MCP_HTTP` — enable HTTP mode. Also implied by setting `--http-host`, `--http-port`, or `--http-token`.
- `--http-token <token>` / `TINYBUBBLES_MCP_HTTP_TOKEN` — **required** whenever HTTP mode is on, at least 16 characters. Generate one with `openssl rand -hex 32`. The server refuses to start without it — there is no way to expose HTTP mode unauthenticated, even on loopback.
- `--http-host <host>` / `TINYBUBBLES_MCP_HTTP_HOST` — bind address, default `127.0.0.1`.
- `--http-port <port>` / `TINYBUBBLES_MCP_HTTP_PORT` — bind port, default `8722`.

The MCP endpoint is `POST /mcp` and requires `Authorization: Bearer <token>` on every request; `GET /healthz` returns `200 ok` without auth for reverse-proxy health checks. Requests without a valid token get `401`; bodies over 1 MiB get `413`. When HTTP mode is on, the server does not also connect a stdio transport — it stays alive as long as the HTTP server is listening, not stdin.

There is no built-in TLS termination or rate limiting. If you're exposing this beyond localhost, put a reverse proxy (e.g. Caddy, nginx) in front for TLS and put the resulting `https://` URL (plus your token) into the remote MCP client.

### Run directly from the repo

```bash
# from repo root (read-only by default)
bun run tinybubbles:mcp -- --db "/path/to/tinybubbles.db"
```

Enable writes (required for add/update/complete/delete tools):

```bash
bun run tinybubbles:mcp -- --db "/path/to/tinybubbles.db" --write
```

Stop:
- Press `Ctrl+C` in the terminal.

### Keep-alive behavior (why it sometimes exits)

The MCP server is **stdio‑based**. It stays alive as long as stdin is open.
If your shell/client closes stdin, the process exits.

To force an immediate exit when stdin closes (no keep-alive), pass `--nowait`:

```bash
bun run tinybubbles:mcp -- --db "/path/to/tinybubbles.db" --nowait
```

Note: When an MCP client launches the server, it keeps stdin open, so the server should remain connected.

### Run without the helper script

```bash
bun run --filter tinybubbles-mcp dev -- --db "/path/to/tinybubbles.db"
```

Stop:
- Press `Ctrl+C` in the terminal.

### Build and run the binary entry (Node)

```bash
# from repo root
bun run --filter tinybubbles-mcp build
node apps/mcp-server/dist/index.js --db "/path/to/tinybubbles.db"
```

Stop:
- Press `Ctrl+C` in the terminal.

---

## Why `tinybubbles-mcp` is “command not found”

`tinybubbles-mcp` is the package binary. It exists after installing the npm package globally, after an MCP client launches it through `npx`, or after you build the source package and run it with Node.

Use one of these source-tree options instead:

```bash
# ✅ works immediately
bun run tinybubbles:mcp -- --db "/path/to/tinybubbles.db"

# ✅ build then run
bun run --filter tinybubbles-mcp build
node apps/mcp-server/dist/index.js --db "/path/to/tinybubbles.db"
```

### Optional: create a global `tinybubbles-mcp` command

If you want a real `tinybubbles-mcp` command on your PATH, create a tiny wrapper:

```bash
cat > ~/bin/tinybubbles-mcp <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /absolute/path/to/Tiny Bubbles
exec bun run tinybubbles:mcp -- "$@"
EOF
chmod +x ~/bin/tinybubbles-mcp
```

Then use:

```bash
tinybubbles-mcp --db "/path/to/tinybubbles.db"
```

### Desktop app toggle?

Not yet. Start/stop is still manual.

---

## MCP Client Configuration

MCP clients run the server as a subprocess. You point them to **the command** and pass args/env.

**Important:** Do NOT use `bun run tinybubbles:mcp` for MCP clients. The `bun run` wrapper outputs shell messages to stdout (e.g., `$ bun run --filter...`) which breaks the JSON-RPC protocol. Always run bun directly on the source file.

### Example (generic MCP config)

```json
{
  "mcpServers": {
    "tinybubbles": {
      "command": "bun",
      "args": [
        "/absolute/path/to/tinybubbles/apps/mcp-server/src/index.ts",
        "--db",
        "~/.local/share/tinybubbles/tinybubbles.db"
      ]
    }
  }
}
```

Add `--write` to the args if you want to enable **add/update/complete/delete** tools.

If your client doesn't support Bun, build first and use Node:

```bash
# Build once
cd /path/to/Tiny Bubbles && bun run --filter tinybubbles-mcp build
```

```json
{
  "mcpServers": {
    "tinybubbles": {
      "command": "node",
      "args": [
        "/absolute/path/to/tinybubbles/apps/mcp-server/dist/index.js",
        "--db",
        "~/.local/share/tinybubbles/tinybubbles.db"
      ]
    }
  }
}
```

Add `--write` to the args if you want to enable **add/update/complete/delete** tools.

### Claude Desktop

Claude Desktop supports MCP (stdio). Add a server entry in its MCP configuration.

Typical config file locations:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

After editing, fully quit and relaunch Claude Desktop.

### Claude Code (CLI)

Add a server via the CLI:

```bash
claude mcp add tinybubbles -- \
  bun /path/to/tinybubbles/apps/mcp-server/src/index.ts --db "/path/to/tinybubbles.db" --write
```

Or edit `~/.claude.json` directly:

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "tinybubbles": {
          "type": "stdio",
          "command": "bun",
          "args": [
            "/absolute/path/to/tinybubbles/apps/mcp-server/src/index.ts",
            "--db",
            "~/.local/share/tinybubbles/tinybubbles.db",
            "--write"
          ]
        }
      }
    }
  }
}
```

Then restart the Claude Code session and run `/mcp` to verify it's connected.

### OpenAI Codex (config.toml)

Codex stores MCP config in `~/.codex/config.toml`. Add:

```toml
[mcp_servers.tinybubbles]
command = "bun"
args = ["/absolute/path/to/tinybubbles/apps/mcp-server/src/index.ts", "--db", "/path/to/tinybubbles.db", "--write"]

# Optional: pass env vars to the server
[mcp_servers.tinybubbles.env]
TINYBUBBLES_DB_PATH = "/path/to/tinybubbles.db"
```

Restart Codex after saving.

### Gemini CLI

Gemini CLI uses a JSON `settings.json` with `mcpServers`, either:
- User scope: `~/.gemini/settings.json`
- Project scope: `.gemini/settings.json` in your repo

You can add Tiny Bubbles MCP two ways:

**1) CLI (recommended):**

```bash
gemini mcp add tinybubbles \
  bun /absolute/path/to/tinybubbles/apps/mcp-server/src/index.ts \
  --db "/path/to/tinybubbles.db" --write
```

**2) Edit settings.json manually:**

```json
{
  "mcpServers": {
    "tinybubbles": {
      "command": "bun",
      "args": ["/absolute/path/to/tinybubbles/apps/mcp-server/src/index.ts", "--db", "/path/to/tinybubbles.db", "--write"]
    }
  }
}
```

Restart the Gemini CLI session after saving.

### Other MCP clients

Any MCP-compatible client can work as long as it can launch a **stdio** server with the command + args above.

---

## Migration: tool rename (`tinybubbles.*` → `tinybubbles_*`)

> **Breaking change** (introduced in this release): all tool names have changed from dot-notation (`tinybubbles.list_tasks`) to underscore-notation (`tinybubbles_list_tasks`) to comply with MCP client validation rules (e.g. Claude Desktop).

**Old → new mapping:**

| Old name                  | New name                   |
| ------------------------- | -------------------------- |
| `tinybubbles.list_tasks`      | `tinybubbles_list_tasks`       |
| `tinybubbles.list_projects`   | `tinybubbles_list_projects`    |
| `tinybubbles.get_project`     | `tinybubbles_get_project`      |
| `tinybubbles.get_task`        | `tinybubbles_get_task`         |
| `tinybubbles.list_areas`      | `tinybubbles_list_areas`       |
| `tinybubbles.add_task`        | `tinybubbles_add_task`         |
| `tinybubbles.update_task`     | `tinybubbles_update_task`      |
| `tinybubbles.complete_task`   | `tinybubbles_complete_task`    |
| `tinybubbles.delete_task`     | `tinybubbles_delete_task`      |
| `tinybubbles.restore_task`    | `tinybubbles_restore_task`     |
| `tinybubbles.add_project`     | `tinybubbles_add_project`      |
| `tinybubbles.update_project`  | `tinybubbles_update_project`   |
| `tinybubbles.delete_project`  | `tinybubbles_delete_project`   |
| `tinybubbles.add_area`        | `tinybubbles_add_area`         |
| `tinybubbles.update_area`     | `tinybubbles_update_area`      |
| `tinybubbles.delete_area`     | `tinybubbles_delete_area`      |

**Upgrade action:** find and replace `tinybubbles.` with `tinybubbles_` in any MCP client configs, system prompts, scripts, or automations that reference these tool names. No other changes are required.

---

## Tools

- `tinybubbles_list_tasks`
  - Input: `{ status?, projectId?, includeDeleted?, limit?, offset?, search?, dueDateFrom?, dueDateTo?, sortBy?, sortOrder? }`
- `tinybubbles_list_projects`
  - Input: `{}`
- `tinybubbles_get_project`
  - Input: `{ id, includeDeleted? }`
- `tinybubbles_list_sections`
  - Input: `{ projectId?, includeDeleted? }`
- `tinybubbles_get_section`
  - Input: `{ id, includeDeleted? }`
- `tinybubbles_list_areas`
  - Input: `{}`
- `tinybubbles_list_people`
  - Input: `{ includeDeleted? }`
- `tinybubbles_get_person`
  - Input: `{ id, includeDeleted? }`
- `tinybubbles_get_task`
  - Input: `{ id, includeDeleted? }`
- `tinybubbles_add_task` **(requires `--write`)**
  - Input: `{ title? | quickAdd?, status?, projectId?, sectionId?, areaId?, dueDate?, startTime?, reviewAt?, recurrence?, contexts?, tags?, description?, priority?, energyLevel?, assignedTo?, timeEstimate?, taskMode?, relativeStartOffset?, showFutureRecurrence?, pushCount?, checklist?, textDirection?, location?, isFocusedToday?, timeSpentMinutes?, suppressTinyBubblesReminders?, repeatReminderMinutes? }`
- `tinybubbles_update_task` **(requires `--write`)**
  - Input: `{ id, title?, status?, projectId?, sectionId?, areaId?, dueDate?, startTime?, reviewAt?, recurrence?, contexts?, tags?, description?, priority?, energyLevel?, assignedTo?, timeEstimate?, taskMode?, relativeStartOffset?, showFutureRecurrence?, pushCount?, checklist?, textDirection?, location?, isFocusedToday?, timeSpentMinutes?, suppressTinyBubblesReminders?, repeatReminderMinutes?, order?, boardOrder?, focusOrder? }`
  - `recurrence` accepts a recurrence object or an RFC 5545 RRULE string. Pass `null` to clear it.
- `tinybubbles_complete_task` **(requires `--write`)**
  - Input: `{ id }`
- `tinybubbles_delete_task` **(requires `--write`)**
  - Input: `{ id }`
- `tinybubbles_restore_task` **(requires `--write`)**
  - Input: `{ id }`
- `tinybubbles_add_project` **(requires `--write`)**
  - Input: `{ title, color?, status?, areaId?, isSequential?, isFocused?, dueDate?, reviewAt?, supportNotes? }`
- `tinybubbles_update_project` **(requires `--write`)**
  - Input: `{ id, title?, color?, status?, areaId?, isSequential?, isFocused?, dueDate?, reviewAt?, supportNotes? }`
- `tinybubbles_delete_project` **(requires `--write`)**
  - Input: `{ id }`
- `tinybubbles_add_section` **(requires `--write`)**
  - Input: `{ projectId, title, description?, order?, isCollapsed? }`
- `tinybubbles_update_section` **(requires `--write`)**
  - Input: `{ id, title?, description?, order?, isCollapsed? }`
- `tinybubbles_delete_section` **(requires `--write`)**
  - Input: `{ id }`
- `tinybubbles_add_area` **(requires `--write`)**
  - Input: `{ name, color?, icon? }`
- `tinybubbles_update_area` **(requires `--write`)**
  - Input: `{ id, name?, color?, icon? }`
- `tinybubbles_delete_area` **(requires `--write`)**
  - Input: `{ id }`
- `tinybubbles_add_person` **(requires `--write`)**
  - Input: `{ name, note?, referenceLink? }`
- `tinybubbles_update_person` **(requires `--write`)**
  - Input: `{ id, name?, note?, referenceLink? }`
- `tinybubbles_rename_person` **(requires `--write`)**
  - Input: `{ id, name, updateTasks? }`
- `tinybubbles_delete_person` **(requires `--write`)**
  - Input: `{ id }`

All tools return JSON text payloads with the resulting task, project, section, area, person, or collection payload.

---

## Testing

### Quick smoke test (CLI)

1) Start the server (read‑only):
```bash
bun run tinybubbles:mcp -- --db "~/.local/share/tinybubbles/tinybubbles.db"
```

2) Connect via your MCP client and run:
- `tinybubbles_list_tasks` (limit 5)

If you want to test writes, restart with `--write`:
```bash
bun run tinybubbles:mcp -- --db "~/.local/share/tinybubbles/tinybubbles.db" --write
```

Then test:
- `tinybubbles_add_task` (quickAdd: "Test task @home /due:tomorrow")
- `tinybubbles_complete_task` (use returned task id)
- `tinybubbles_update_task` (e.g. set status or dueDate)
- `tinybubbles_delete_task` (use returned task id)
- `tinybubbles_get_task` (use returned task id)
- `tinybubbles_restore_task` (after delete, restore the task)
- `tinybubbles_list_projects`
- `tinybubbles_get_project` (use returned project id)
- `tinybubbles_list_areas`
- `tinybubbles_list_people`
- `tinybubbles_add_project`
- `tinybubbles_update_project`
- `tinybubbles_delete_project`
- `tinybubbles_add_area`
- `tinybubbles_update_area`
- `tinybubbles_delete_area`
- `tinybubbles_add_person`
- `tinybubbles_update_person`
- `tinybubbles_rename_person`
- `tinybubbles_get_person` (use returned person id)
- `tinybubbles_delete_person`
- `tinybubbles_list_tasks` with `dueDateFrom`, `dueDateTo`, `sortBy`, `sortOrder`

If the list returns tasks and add/complete works, the server is healthy.

### Stdio JSON-RPC E2E (transport validation)

Use any MCP client or a small script to send:
- `initialize`
- `notifications/initialized`
- `tools/list`
- `tools/call` (e.g. `tinybubbles_list_projects` or `tinybubbles_list_tasks`)

If these succeed, the stdio transport is working end-to-end.

### Claude Code sanity check

1) Add the server:
```bash
claude mcp add tinybubbles -- \
  bun /path/to/tinybubbles/apps/mcp-server/src/index.ts --db "/path/to/tinybubbles.db" --write
```
2) Restart Claude Code, run `/mcp`, and verify **tinybubbles** is connected.
3) Ask the model to call:
   - `tinybubbles_list_tasks` (limit 5)
   - `tinybubbles_add_task` (quickAdd: "Test MCP @home /due:tomorrow")
   - `tinybubbles_complete_task` (use returned id)

---

## Safety & Concurrency

- The server uses **SQLite WAL mode**. Read-only tools can run while the desktop app is open.
- Write tools fail fast on SQLite writer locks, then retry the whole Tiny Bubbles write operation. Each retry reloads current data before applying the requested change, so a delayed MCP write does not keep working from a stale pre-lock snapshot.
- Writes are **disabled by default**. Use `--write` to enable edits.
- Write operations go through the shared **@tinybubbles/core** store to enforce business rules (both Bun and Node).
- SQL is reserved for read-heavy paths (list/search) where performance matters.
- Do not point a separate container/server deployment at the same local storage or sync data while the desktop app is also writing. That creates independent writers outside the local SQLite coordination path and is unsupported.

---

## Notes

- This MCP server targets the SQLite database used by the desktop app, with mutations routed through `@tinybubbles/core`.
- Keep an eye on schema changes across app versions (update queries if needed).
