import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import type { AddressInfo } from 'net';
import type { Server } from 'node:http';
import { tmpdir } from 'os';
import { join } from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { ValidationError } from './errors.js';
import { parseArgs } from './flags.js';
import {
  createTinyBubblesHttpServer,
  DEFAULT_HTTP_HOST,
  DEFAULT_HTTP_PORT,
  isAuthorizedBearerToken,
  MAX_HTTP_BODY_BYTES,
  MIN_HTTP_TOKEN_LENGTH,
  RECOMMENDED_HTTP_TOKEN_LENGTH,
  resolveHttpConfig,
  startHttpServer,
} from './http-server.js';
import { createTinyBubblesMcpServer, resolveServerConfig, type ServerConfig } from './index.js';
import { createService, type TinyBubblesService } from './service.js';

const VALID_TOKEN = 'a'.repeat(32);

describe('resolveHttpConfig', () => {
  test('returns undefined when no http flags or env vars are set', () => {
    expect(resolveHttpConfig(parseArgs([]), {})).toBeUndefined();
  });

  test('throws ValidationError when --http is set without a token', () => {
    expect(() => resolveHttpConfig(parseArgs(['--http']), {})).toThrow(ValidationError);
    expect(() => resolveHttpConfig(parseArgs(['--http']), {})).toThrow(/http-token/);
  });

  test('throws ValidationError when the token is shorter than the minimum length', () => {
    expect(() => resolveHttpConfig(parseArgs(['--http', '--http-token', 'short']), {})).toThrow(ValidationError);
  });

  test('accepts a token exactly at the minimum length', () => {
    const token = 'a'.repeat(MIN_HTTP_TOKEN_LENGTH);
    expect(resolveHttpConfig(parseArgs(['--http', '--http-token', token]), {})?.token).toBe(token);
  });

  test('a token between the minimum and recommended length still starts, with a warning', () => {
    const token = 'a'.repeat(MIN_HTTP_TOKEN_LENGTH);
    const config = resolveHttpConfig(parseArgs(['--http', '--http-token', token]), {});
    expect(config?.token).toBe(token);
    expect(config?.weakTokenWarning).toContain(String(RECOMMENDED_HTTP_TOKEN_LENGTH));
  });

  test('a token at the recommended length has no warning', () => {
    const token = 'a'.repeat(RECOMMENDED_HTTP_TOKEN_LENGTH);
    const config = resolveHttpConfig(parseArgs(['--http', '--http-token', token]), {});
    expect(config?.weakTokenWarning).toBeUndefined();
  });

  test('defaults host and port when only --http and a token are given', () => {
    expect(resolveHttpConfig(parseArgs(['--http', '--http-token', VALID_TOKEN]), {})).toEqual({
      host: DEFAULT_HTTP_HOST,
      port: DEFAULT_HTTP_PORT,
      token: VALID_TOKEN,
    });
  });

  test('reads host/port/token from env var fallbacks', () => {
    expect(resolveHttpConfig(parseArgs([]), {
      TINYBUBBLES_MCP_HTTP: 'true',
      TINYBUBBLES_MCP_HTTP_HOST: '0.0.0.0',
      TINYBUBBLES_MCP_HTTP_PORT: '9100',
      TINYBUBBLES_MCP_HTTP_TOKEN: VALID_TOKEN,
    })).toEqual({
      host: '0.0.0.0',
      port: 9100,
      token: VALID_TOKEN,
    });
  });

  test('--http-port alone implies HTTP mode', () => {
    expect(resolveHttpConfig(parseArgs(['--http-port', '9000', '--http-token', VALID_TOKEN]), {})).toEqual({
      host: DEFAULT_HTTP_HOST,
      port: 9000,
      token: VALID_TOKEN,
    });
  });

  test('--http-host alone implies HTTP mode', () => {
    expect(resolveHttpConfig(parseArgs(['--http-host', '0.0.0.0', '--http-token', VALID_TOKEN]), {})).toEqual({
      host: '0.0.0.0',
      port: DEFAULT_HTTP_PORT,
      token: VALID_TOKEN,
    });
  });

  test('--http-token alone implies HTTP mode', () => {
    expect(resolveHttpConfig(parseArgs(['--http-token', VALID_TOKEN]), {})).toEqual({
      host: DEFAULT_HTTP_HOST,
      port: DEFAULT_HTTP_PORT,
      token: VALID_TOKEN,
    });
  });

  test('rejects a non-integer or out-of-range port', () => {
    expect(() => resolveHttpConfig(parseArgs(['--http-port', '70000', '--http-token', VALID_TOKEN]), {})).toThrow(ValidationError);
    expect(() => resolveHttpConfig(parseArgs(['--http-port', '0', '--http-token', VALID_TOKEN]), {})).toThrow(ValidationError);
    expect(() => resolveHttpConfig(parseArgs(['--http-port', 'not-a-number', '--http-token', VALID_TOKEN]), {})).toThrow(ValidationError);
  });

  test('camelCase flag names are accepted alongside kebab-case', () => {
    expect(resolveHttpConfig(parseArgs(['--httpHost', '0.0.0.0', '--httpPort', '9200', '--httpToken', VALID_TOKEN]), {})).toEqual({
      host: '0.0.0.0',
      port: 9200,
      token: VALID_TOKEN,
    });
  });
});

describe('resolveServerConfig (http integration)', () => {
  test('has no http field at all when no http flags are set (stdio regression)', () => {
    const config = resolveServerConfig(parseArgs(['--db', '/tmp/tinybubbles.db']), {});
    expect('http' in config).toBe(false);
    expect(config).toEqual({
      backend: 'local',
      dbPath: '/tmp/tinybubbles.db',
      readonly: true,
      keepAlive: true,
    });
  });

  test('carries the http config through for the local backend', () => {
    const config = resolveServerConfig(parseArgs(['--db', '/tmp/tinybubbles.db', '--http', '--http-token', VALID_TOKEN]), {});
    expect(config.http).toEqual({ host: DEFAULT_HTTP_HOST, port: DEFAULT_HTTP_PORT, token: VALID_TOKEN });
  });

  test('carries the http config through for the cloud backend', () => {
    const config = resolveServerConfig(
      parseArgs(['--cloud-url', 'https://tinybubbles.example.com', '--cloud-token', 'secret', '--http', '--http-token', VALID_TOKEN]),
      {}
    );
    expect(config.backend).toBe('cloud');
    expect(config.http).toEqual({ host: DEFAULT_HTTP_HOST, port: DEFAULT_HTTP_PORT, token: VALID_TOKEN });
  });
});

describe('isAuthorizedBearerToken', () => {
  test('accepts a matching bearer token', () => {
    expect(isAuthorizedBearerToken(`Bearer ${VALID_TOKEN}`, VALID_TOKEN)).toBe(true);
  });

  test('is case-insensitive on the Bearer scheme', () => {
    expect(isAuthorizedBearerToken(`bearer ${VALID_TOKEN}`, VALID_TOKEN)).toBe(true);
  });

  test('rejects a missing or empty header', () => {
    expect(isAuthorizedBearerToken(undefined, VALID_TOKEN)).toBe(false);
    expect(isAuthorizedBearerToken(null, VALID_TOKEN)).toBe(false);
    expect(isAuthorizedBearerToken('', VALID_TOKEN)).toBe(false);
  });

  test('rejects a mismatched token', () => {
    expect(isAuthorizedBearerToken(`Bearer ${'b'.repeat(32)}`, VALID_TOKEN)).toBe(false);
  });

  test('rejects a header missing the Bearer scheme', () => {
    expect(isAuthorizedBearerToken(VALID_TOKEN, VALID_TOKEN)).toBe(false);
    expect(isAuthorizedBearerToken('Basic abc', VALID_TOKEN)).toBe(false);
  });
});

describe('HTTP MCP transport (integration, real listening server)', () => {
  let baseUrl = '';
  let httpServer: Server;
  let service: TinyBubblesService;
  let tempDir = '';

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'tinybubbles-mcp-http-'));
    writeFileSync(
      join(tempDir, 'data.json'),
      JSON.stringify({
        tasks: [
          {
            id: 'task-1',
            title: 'HTTP transport task',
            status: 'inbox',
            createdAt: '2026-04-13T00:00:00.000Z',
            updatedAt: '2026-04-13T00:00:00.000Z',
          },
        ],
        projects: [],
        sections: [],
        areas: [],
        people: [],
        settings: {},
      })
    );

    const dbPath = join(tempDir, 'tinybubbles.db');
    service = createService({ dbPath, readonly: false });
    const config: ServerConfig = { backend: 'local', dbPath, readonly: false, keepAlive: true };

    httpServer = createTinyBubblesHttpServer({
      createServer: () => createTinyBubblesMcpServer(service, config),
      token: VALID_TOKEN,
    });
    await startHttpServer(httpServer, { host: '127.0.0.1', port: 0, token: VALID_TOKEN });
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolveClose) => httpServer.close(() => resolveClose()));
    await service.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('GET /healthz returns 200 without auth', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  test('GET /mcp returns 405', async () => {
    const res = await fetch(`${baseUrl}/mcp`, { headers: { Authorization: `Bearer ${VALID_TOKEN}` } });
    expect(res.status).toBe(405);
  });

  test('DELETE /mcp returns 405', async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: 'DELETE', headers: { Authorization: `Bearer ${VALID_TOKEN}` } });
    expect(res.status).toBe(405);
  });

  test('unknown paths return 404', async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });

  test('POST /mcp without Authorization returns 401', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
    const payload = await res.json();
    expect(payload).toEqual({ error: 'unauthorized' });
  });

  test('POST /mcp with the wrong token returns 401', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${'z'.repeat(32)}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /mcp with a body over 1 MiB returns 413', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${VALID_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { padding: 'x'.repeat(MAX_HTTP_BODY_BYTES + 1) },
      }),
    });
    expect(res.status).toBe(413);
  });

  test('initialize + tools/list exposes recurrence on both task write schemas', async () => {
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${VALID_TOKEN}` } },
    });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      for (const name of ['tinybubbles_add_task', 'tinybubbles_update_task']) {
        const tool = tools.find((candidate) => candidate.name === name);
        const properties = (tool?.inputSchema as { properties?: Record<string, unknown> } | undefined)?.properties;
        expect(Boolean(properties?.recurrence)).toBe(true);
      }
    } finally {
      await client.close();
    }
  });

  test('tools/call of tinybubbles_list_tasks succeeds over HTTP against a temp local db', async () => {
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${VALID_TOKEN}` } },
    });
    await client.connect(transport);
    try {
      const result = await client.callTool({ name: 'tinybubbles_list_tasks', arguments: {} });
      expect(Boolean(result.isError)).toBe(false);
      const content = result.content as Array<{ type: string; text?: string }>;
      const payload = JSON.parse(content[0]?.text ?? '{}') as { tasks: Array<{ id: string }> };
      expect(payload.tasks.some((task) => task.id === 'task-1')).toBe(true);
    } finally {
      await client.close();
    }
  });
});
