import {
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    realpathSync,
    renameSync,
    unlinkSync,
    writeFileSync,
} from 'fs';
import { createHash } from 'crypto';
import { basename, dirname, join, relative, resolve, sep } from 'path';
import { sleep, type AppData } from '@mindwtr/core';
import {
    ATTACHMENT_PATH_ALLOWLIST,
    CLOUD_DATA_LOCK_WAIT_TIMEOUT_MS,
    logError,
} from './server-config';

export type RequestAbortError = Error & {
    status: number;
};

type BodyReadError = {
    __mindwtrError: {
        message: string;
        status: number;
    };
};

export type WriteLockRunner = {
    <T>(key: string, fn: () => Promise<T>, signal?: AbortSignal): Promise<T>;
    getPendingLockCount: () => number;
};

const createDefaultData = (): AppData => ({ tasks: [], projects: [], sections: [], areas: [], people: [], settings: {} });

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const toAppDataShape = (value: unknown): AppData | null => {
    if (!isObjectRecord(value)) return null;
    if (!Array.isArray(value.tasks) || !Array.isArray(value.projects)) return null;
    return {
        tasks: value.tasks as AppData['tasks'],
        projects: value.projects as AppData['projects'],
        sections: Array.isArray(value.sections) ? value.sections as AppData['sections'] : [],
        areas: Array.isArray(value.areas) ? value.areas as AppData['areas'] : [],
        people: Array.isArray(value.people) ? value.people as AppData['people'] : [],
        settings: (isObjectRecord(value.settings) ? value.settings : {}) as AppData['settings'],
    };
};

export function createRequestAbortError(message: string, status = 408): RequestAbortError {
    const error = new Error(message) as RequestAbortError;
    error.name = 'RequestAbortError';
    error.status = status;
    return error;
}

export function isRequestAbortError(error: unknown): error is RequestAbortError {
    return error instanceof Error
        && error.name === 'RequestAbortError'
        && typeof (error as { status?: unknown }).status === 'number';
}

function resolveRequestAbortError(signal: AbortSignal, fallbackMessage: string, fallbackStatus = 408): RequestAbortError {
    const reason = signal.reason;
    if (isRequestAbortError(reason)) {
        return reason;
    }
    if (reason instanceof Error) {
        const error = reason as RequestAbortError;
        error.name = 'RequestAbortError';
        error.status = typeof error.status === 'number' ? error.status : fallbackStatus;
        return error;
    }
    return createRequestAbortError(fallbackMessage, fallbackStatus);
}

export function throwIfRequestAborted(signal?: AbortSignal, fallbackMessage = 'Request timed out'): void {
    if (!signal?.aborted) return;
    throw resolveRequestAbortError(signal, fallbackMessage);
}

function createBodyReadError(message: string, status: number): BodyReadError {
    return {
        __mindwtrError: {
            message,
            status,
        },
    };
}

export function isBodyReadError(value: unknown): value is BodyReadError {
    return isObjectRecord(value)
        && isObjectRecord(value.__mindwtrError)
        && typeof value.__mindwtrError.message === 'string'
        && typeof value.__mindwtrError.status === 'number';
}

function decodeAttachmentPath(rawPath: string): string | null {
    try {
        const decoded = decodeURIComponent(rawPath);
        if (decoded.includes('%')) {
            return null;
        }
        return decoded;
    } catch {
        return null;
    }
}

function isPathWithinRoot(pathValue: string, rootPath: string): boolean {
    return pathValue === rootPath || pathValue.startsWith(`${rootPath}${sep}`);
}

export { isPathWithinRoot };

function isFsErrorWithCode(error: unknown, code: string): boolean {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && (error as { code?: unknown }).code === code;
}

/**
 * Walks each path segment from `rootRealPath` down to `targetDir`, rejecting any
 * symlink escape along the way. With `create: true` (the default; used by attachment
 * writes) missing segments are created as plain directories. With `create: false`
 * (used by read-only attachment access — see `resolveAttachmentPath`) a missing
 * segment stops the walk and returns `true` without creating anything: nothing exists
 * below that point, so there is no symlink to escape through, and the caller treats
 * the unresolved remainder as "not found" rather than "invalid".
 */
function ensureDirectoryWithinRoot(rootRealPath: string, targetDir: string, create = true): boolean {
    if (!isPathWithinRoot(targetDir, rootRealPath)) return false;
    const rel = relative(rootRealPath, targetDir);
    if (!rel || rel === '.') return true;
    const segments = rel.split(/[\\/]+/).filter(Boolean);
    let currentPath = rootRealPath;

    for (const segment of segments) {
        currentPath = join(currentPath, segment);
        try {
            const stat = lstatSync(currentPath);
            if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
        } catch (error) {
            if (!isFsErrorWithCode(error, 'ENOENT')) return false;
            if (!create) return true;
            try {
                mkdirSync(currentPath, { mode: 0o700 });
            } catch (mkdirError) {
                if (!isFsErrorWithCode(mkdirError, 'EEXIST')) return false;
            }
            try {
                const stat = lstatSync(currentPath);
                if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
            } catch {
                return false;
            }
        }

        try {
            const currentRealPath = realpathSync(currentPath);
            if (!isPathWithinRoot(currentRealPath, rootRealPath)) return false;
        } catch {
            return false;
        }
    }

    return true;
}

export function normalizeAttachmentRelativePath(rawPath: string): string | null {
    const decoded = decodeAttachmentPath(rawPath);
    if (!decoded) return null;
    if (!decoded || !ATTACHMENT_PATH_ALLOWLIST.test(decoded)) {
        return null;
    }
    const normalized = decoded.replace(/^\/+|\/+$/g, '');
    if (!normalized) return null;
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    if (segments.some((segment) => segment === '.' || segment === '..')) {
        return null;
    }
    return segments.join('/');
}

/**
 * `create` must be `true` only for PUT. GET and DELETE resolve with `create: false`
 * so an unknown token can never plant `<dataDir>/<key>/attachments` on disk merely by
 * reading or deleting — that side effect used to double as an undocumented namespace
 * creation, permanently exempting the token from `ensureNamespaceWriteAllowed` and
 * consuming a slot in `maxAnyTokenNamespaces` without ever writing data.
 */
export function resolveAttachmentPath(
    dataDir: string,
    key: string,
    rawPath: string,
    options: { create: boolean }
): { rootRealPath: string; filePath: string } | null {
    const relativePath = normalizeAttachmentRelativePath(rawPath);
    if (!relativePath) return null;
    const dataRoot = resolve(dataDir);
    if (options.create) {
        mkdirSync(dataRoot, { recursive: true });
    } else if (!existsSync(dataRoot)) {
        return null;
    }
    const dataRootRealPath = realpathSync(dataRoot);
    const rootDir = resolve(join(dataRootRealPath, key, 'attachments'));
    if (!ensureDirectoryWithinRoot(dataRootRealPath, rootDir, options.create)) return null;
    // rootDir may not exist yet when options.create is false (nothing was ever
    // uploaded for this key) — that's the whole point, so fall back to the
    // unresolved path rather than realpathSync-ing a directory that isn't there.
    const rootRealPath = existsSync(rootDir) ? realpathSync(rootDir) : rootDir;
    if (!isPathWithinRoot(rootRealPath, dataRootRealPath)) return null;
    const filePath = resolve(join(rootRealPath, relativePath));
    if (!isPathWithinRoot(filePath, rootRealPath)) return null;
    return { rootRealPath, filePath };
}

export function pathContainsSymlink(rootRealPath: string, targetPath: string): boolean {
    if (!isPathWithinRoot(targetPath, rootRealPath)) return true;
    const rel = relative(rootRealPath, targetPath);
    if (!rel || rel === '.') return false;
    const segments = rel.split(/[\\/]+/).filter(Boolean);
    let currentPath = rootRealPath;
    for (const segment of segments) {
        currentPath = join(currentPath, segment);
        if (!existsSync(currentPath)) continue;
        try {
            const stat = lstatSync(currentPath);
            if (stat.isSymbolicLink()) return true;
        } catch {
            return true;
        }
    }
    return false;
}

export function writeAttachmentFileSafely(rootRealPath: string, filePath: string, body: Uint8Array): boolean {
    const parentPath = dirname(filePath);
    if (!ensureDirectoryWithinRoot(rootRealPath, parentPath)) return false;
    if (pathContainsSymlink(rootRealPath, parentPath)) return false;
    const parentRealPath = realpathSync(parentPath);
    if (!isPathWithinRoot(parentRealPath, rootRealPath)) {
        return false;
    }

    const safeFilePath = join(parentRealPath, basename(filePath));
    if (existsSync(safeFilePath)) {
        const stat = lstatSync(safeFilePath);
        if (stat.isSymbolicLink()) {
            return false;
        }
        const realFilePath = realpathSync(safeFilePath);
        if (!isPathWithinRoot(realFilePath, rootRealPath)) {
            return false;
        }
    }

    const tempPath = join(
        parentRealPath,
        `.mindwtr-upload-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
    );
    let tempExists = false;
    try {
        writeFileSync(tempPath, body, { flag: 'wx', mode: 0o600 });
        tempExists = true;
        const tempRealPath = realpathSync(tempPath);
        if (!isPathWithinRoot(tempRealPath, rootRealPath)) {
            return false;
        }
        renameSync(tempPath, safeFilePath);
        tempExists = false;
        return true;
    } finally {
        if (tempExists && existsSync(tempPath)) {
            try {
                unlinkSync(tempPath);
            } catch {
                // Best-effort cleanup for temp files.
            }
        }
    }
}

export function readData(filePath: string): AppData | null {
    try {
        const raw = readFileSync(filePath, 'utf8');
        return toAppDataShape(JSON.parse(raw));
    } catch {
        return null;
    }
}

// Raw, uncached disk read. server-data-cache.ts wraps this as the process-local-cached
// `loadAppData` that the rest of the server imports; this uncached name stays distinct
// so an import site can tell at a glance which one it's getting.
export function loadAppDataUncached(filePath: string): AppData {
    const raw = readData(filePath);
    if (!raw) return createDefaultData();
    const nowIso = new Date().toISOString();
    const normalizedAreas = raw.areas.map((area) => {
        if (!isObjectRecord(area)) return area;
        const createdAt = typeof area.createdAt === 'string' && area.createdAt.trim().length > 0
            ? area.createdAt
            : (typeof area.updatedAt === 'string' && area.updatedAt.trim().length > 0 ? area.updatedAt : nowIso);
            const updatedAt = typeof area.updatedAt === 'string' && area.updatedAt.trim().length > 0
                ? area.updatedAt
                : createdAt;
            return {
                ...area,
            createdAt,
            updatedAt,
        };
    }) as AppData['areas'];
    return {
        ...raw,
        areas: normalizedAreas,
    };
}

export function writeData(filePath: string, data: unknown) {
    mkdirSync(dirname(filePath), { recursive: true });
    const serialized = JSON.stringify(data, null, 2);
    const tempPath = join(
        dirname(filePath),
        `.${basename(filePath)}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
    );
    let tempExists = false;
    try {
        writeFileSync(tempPath, serialized, { flag: 'wx', mode: 0o600 });
        tempExists = true;
        renameSync(tempPath, filePath);
        tempExists = false;
    } finally {
        if (tempExists && existsSync(tempPath)) {
            try {
                unlinkSync(tempPath);
            } catch {
                // Best-effort cleanup if the atomic replace fails partway through.
            }
        }
    }
}

const CLOUD_LOCK_SHARD_COUNT = 64;

function getCloudLockPath(dataDir: string, key: string): string {
    const lockId = createHash('sha256').update(key).digest('hex');
    const shard = Number.parseInt(lockId.slice(0, 8), 16) % CLOUD_LOCK_SHARD_COUNT;
    return join(dataDir, '.locks', `shard-${shard.toString(16).padStart(2, '0')}.sqlite`);
}

const isSqliteBusyError = (error: unknown): boolean => {
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    const message = error instanceof Error ? error.message : String(error);
    return code === 'SQLITE_BUSY'
        || code === 'SQLITE_LOCKED'
        || /database is (?:busy|locked)/i.test(message);
};

const waitForCloudLockRetry = async (delayMs: number, signal?: AbortSignal): Promise<void> => {
    if (!signal) {
        await sleep(delayMs);
        return;
    }
    throwIfRequestAborted(signal);
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, delayMs);
        const onAbort = () => {
            clearTimeout(timeout);
            signal.removeEventListener('abort', onAbort);
            reject(resolveRequestAbortError(signal, 'Request timed out'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });
};

async function withCloudFileLock<T>(
    dataDir: string,
    key: string,
    fn: () => Promise<T>,
    signal?: AbortSignal,
): Promise<T> {
    throwIfRequestAborted(signal);
    const lockPath = getCloudLockPath(dataDir, key);
    mkdirSync(dirname(lockPath), { recursive: true, mode: 0o700 });
    const startedAt = Date.now();
    let attempt = 0;
    const { Database } = await import('bun:sqlite');
    let lockDatabase: InstanceType<typeof Database> | null = null;

    while (true) {
        throwIfRequestAborted(signal);
        const candidate = new Database(lockPath);
        try {
            // Poll with a zero SQLite busy timeout instead of blocking Bun's event
            // loop. BEGIN IMMEDIATE is an OS-backed process lock; the kernel drops
            // it when a process crashes, so there is no stale lease to unlink.
            candidate.exec('PRAGMA busy_timeout = 0;');
            candidate.exec('BEGIN IMMEDIATE;');
            lockDatabase = candidate;
            break;
        } catch (error) {
            candidate.close();
            if (!isSqliteBusyError(error)) throw error;
            if (Date.now() - startedAt > CLOUD_DATA_LOCK_WAIT_TIMEOUT_MS) {
                throw new Error('Timed out waiting for cloud data lock');
            }
            attempt += 1;
            await waitForCloudLockRetry(Math.min(1000, 25 * attempt), signal);
        }
    }

    try {
        throwIfRequestAborted(signal);
        return await fn();
    } finally {
        try {
            lockDatabase?.exec('ROLLBACK;');
        } catch {
            // Closing the connection below still releases the OS lock.
        } finally {
            lockDatabase?.close();
        }
    }
}

export function ensureWritableDir(dirPath: string): boolean {
    try {
        mkdirSync(dirPath, { recursive: true });
        const testPath = join(dirPath, '.mindwtr_write_test');
        writeFileSync(testPath, 'ok');
        unlinkSync(testPath);
        return true;
    } catch (error) {
        logError(`cloud data dir is not writable: ${dirPath}`, error);
        logError('ensure the volume is writable by the container user (uid 1000)');
        return false;
    }
}

export async function readRequestBytes(
    req: Request,
    maxBodyBytes: number,
    signal?: AbortSignal,
): Promise<Uint8Array | BodyReadError> {
    const contentLength = Number(req.headers.get('content-length') || '0');
    if (contentLength && contentLength > maxBodyBytes) {
        return createBodyReadError('Payload too large', 413);
    }
    const stream = req.body;
    if (!stream) {
        return new Uint8Array();
    }
    try {
        throwIfRequestAborted(signal);
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        const onAbort = signal
            ? () => {
                void reader.cancel(resolveRequestAbortError(signal, 'Request timed out')).catch(() => undefined);
            }
            : null;
        if (signal && onAbort) {
            signal.addEventListener('abort', onAbort, { once: true });
        }
        try {
            while (true) {
                throwIfRequestAborted(signal);
                const { done, value } = await reader.read();
                if (done) break;
                if (!value || value.length === 0) continue;
                totalLength += value.length;
                if (totalLength > maxBodyBytes) {
                    await reader.cancel().catch(() => undefined);
                    return createBodyReadError('Payload too large', 413);
                }
                chunks.push(value);
            }
        } finally {
            if (signal && onAbort) {
                signal.removeEventListener('abort', onAbort);
            }
        }

        if (chunks.length === 0) {
            return new Uint8Array();
        }
        if (chunks.length === 1) {
            return chunks[0];
        }
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        return merged;
    } catch (error) {
        if (signal?.aborted) {
            const requestAbortError = resolveRequestAbortError(signal, 'Request timed out');
            return createBodyReadError(requestAbortError.message, requestAbortError.status);
        }
        throw error;
    }
}

export async function readJsonBody(req: Request, maxBodyBytes: number, signal?: AbortSignal): Promise<unknown> {
    const bytes = await readRequestBytes(req, maxBodyBytes, signal);
    if (isBodyReadError(bytes)) {
        return bytes;
    }
    const text = new TextDecoder().decode(bytes);
    if (!text.trim()) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export function createWriteLockRunner(dataDir?: string): WriteLockRunner {
    const writeLocks = new Map<string, Promise<void>>();
    const withWriteLock = async <T>(key: string, fn: () => Promise<T>, signal?: AbortSignal) => {
        const current = writeLocks.get(key) ?? Promise.resolve();
        let removeQueuedAbortListener: () => void = () => undefined;
        const abortBeforeStart = signal
            ? new Promise<never>((_resolve, reject) => {
                const onAbort = () => reject(resolveRequestAbortError(signal, 'Request timed out'));
                removeQueuedAbortListener = () => signal.removeEventListener('abort', onAbort);
                if (signal.aborted) {
                    onAbort();
                } else {
                    signal.addEventListener('abort', onAbort, { once: true });
                }
            })
            : null;
        const run = current.catch(() => undefined).then(() => {
            removeQueuedAbortListener();
            throwIfRequestAborted(signal);
            return dataDir ? withCloudFileLock(dataDir, key, fn, signal) : fn();
        });
        const queueTail = run.then(() => undefined, () => undefined);
        writeLocks.set(key, queueTail);
        void queueTail.then(() => {
            if (writeLocks.get(key) === queueTail) {
                writeLocks.delete(key);
            }
        });
        if (abortBeforeStart) {
            return Promise.race([run, abortBeforeStart]);
        }
        return run;
    };
    withWriteLock.getPendingLockCount = () => writeLocks.size;
    return withWriteLock;
}
