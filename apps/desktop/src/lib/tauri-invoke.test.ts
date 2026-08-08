import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';

const invokeMock = vi.hoisted(() => vi.fn(async () => {
    throw new Error('no ipc');
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

import { invokeNative, invokeNativeOr, setNativeInvokeTransport } from './tauri-invoke';

const enableTauri = () => {
    (window as any).__TAURI_INTERNALS__ = {};
};

const disableTauri = () => {
    delete (window as any).__TAURI_INTERNALS__;
};

beforeEach(() => {
    invokeMock.mockClear();
});

afterEach(() => {
    setNativeInvokeTransport(null);
    disableTauri();
});

describe('invokeNative', () => {
    it('rejects when there is no Tauri runtime', async () => {
        const transport = vi.fn();
        setNativeInvokeTransport(transport as never);
        await expect(invokeNative('get_thing')).rejects.toThrow('Tauri runtime is unavailable.');
        expect(transport).not.toHaveBeenCalled();
    });

    it('forwards the command and args to the transport', async () => {
        enableTauri();
        const transport = vi.fn(async () => 'ok');
        setNativeInvokeTransport(transport as never);
        await expect(invokeNative<string>('get_thing', { id: 7 })).resolves.toBe('ok');
        expect(transport).toHaveBeenCalledWith('get_thing', { id: 7 });
    });

    it('leaves an argument-less command argument-less on the wire', async () => {
        enableTauri();
        await expect(invokeNative('get_thing')).rejects.toThrow();
        expect(invokeMock.mock.calls[0]).toEqual(['get_thing']);
    });

    it('propagates transport failures', async () => {
        enableTauri();
        setNativeInvokeTransport((async () => {
            throw new Error('boom');
        }) as never);
        await expect(invokeNative('get_thing')).rejects.toThrow('boom');
    });
});

describe('invokeNativeOr', () => {
    it('resolves to the fallback when there is no Tauri runtime', async () => {
        const transport = vi.fn();
        setNativeInvokeTransport(transport as never);
        await expect(invokeNativeOr({ enabled: false }, 'get_thing')).resolves.toEqual({ enabled: false });
        expect(transport).not.toHaveBeenCalled();
    });

    it('returns the native result when the runtime is present', async () => {
        enableTauri();
        setNativeInvokeTransport((async () => ({ enabled: true })) as never);
        await expect(invokeNativeOr({ enabled: false }, 'get_thing')).resolves.toEqual({ enabled: true });
    });

    it('does not swallow transport failures inside the runtime', async () => {
        enableTauri();
        setNativeInvokeTransport((async () => {
            throw new Error('boom');
        }) as never);
        await expect(invokeNativeOr('fallback', 'get_thing')).rejects.toThrow('boom');
    });
});

// Ten hand-rolled `tauriInvoke` copies existed before this seam, in three
// different off-Tauri shapes (throw / return a default / swallow), because
// nothing stopped the eleventh from being written. This is that stop.
const DESKTOP_SRC = resolve(import.meta.dirname, '..');
const CORE_MODULE_SPECIFIER = '@tauri-apps/api/core';
const SEAM_FILE = 'lib/tauri-invoke.ts';
const EXCLUDED_DIR_NAMES = new Set(['node_modules', 'coverage', 'dist']);
// Each entry needs a reason and a way out. Converting one of these? Delete its
// line — a stale exclusion is not an error, but it is dead weight.
const EXCLUDED_FILES = new Map<string, string>([
    // `lib/theme.ts` takes the core module as an injected loader, so its three
    // callers hold the raw import. Give it invokeNativeOr and all three drop.
    ['App.tsx', 'passes () => import(core) into resolveSystemThemeCommandPreference'],
    ['main.tsx', 'passes () => import(core) into resolveSystemThemeCommandPreference'],
    [
        'components/views/settings/useSettingsMainPage.ts',
        'passes () => import(core) into resolveSystemThemeCommandPreference',
    ],
    // convertFileSrc rewrites a path into a webview URL. It is not an IPC call,
    // so the invoke seam has nothing to offer it.
    ['components/Task/task-item-attachment-utils.ts', 'imports convertFileSrc, not invoke'],
]);

function collectSourcePaths(): string[] {
    const paths: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.tsx?$/.test(entry.name)) continue;
            // Tests mock the module by specifier; that is the point of a seam,
            // not a bypass of it.
            if (/\.test\.tsx?$/.test(entry.name)) continue;
            paths.push(full);
        }
    };
    walk(DESKTOP_SRC);
    return paths;
}

describe('tauri invoke seam ratchet', () => {
    it('keeps @tauri-apps/api/core out of every desktop source file but the seam', () => {
        const offenders = collectSourcePaths()
            .filter((path) => readFileSync(path, 'utf8').includes(CORE_MODULE_SPECIFIER))
            .map((path) => relative(DESKTOP_SRC, path))
            .filter((rel) => rel !== SEAM_FILE && !EXCLUDED_FILES.has(rel));

        expect(
            offenders,
            `${offenders.join(', ')} imports ${CORE_MODULE_SPECIFIER} directly. Call invokeNative`
            + ' (rejects off Tauri) or invokeNativeOr(fallback, ...) (resolves to the fallback) from'
            + ` src/${SEAM_FILE} instead — whichever matches what the call site should do when there`
            + ' is no desktop runtime. Adding an exclusion here re-splits that decision across files.',
        ).toEqual([]);
        // Walking every desktop source file runs well under a second locally and
        // has still blown vitest's 5s default on loaded CI runners.
    }, 60_000);
});

describe('setNativeInvokeTransport', () => {
    it('restores the real transport when passed null', async () => {
        enableTauri();
        setNativeInvokeTransport((async () => 'fake') as never);
        await expect(invokeNative<string>('get_thing')).resolves.toBe('fake');
        setNativeInvokeTransport(null);
        // The real transport reaches @tauri-apps/api/core, which has no IPC
        // handler in jsdom; the point is only that the fake is gone.
        await expect(invokeNative<string>('get_thing')).rejects.toThrow();
    });
});
