// Attachment lifecycle: the cloud-key bookkeeping that cascades from a project purge,
// and the garbage collector that reconciles on-disk attachment files against what the
// stored AppData still references. Pulled out of server.ts so these rules — previously
// reachable only by spinning up a live server — have a direct test surface.
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmdirSync, unlinkSync } from 'fs';
import { join, relative } from 'path';
import {
    validateAttachmentForUpload,
    type Attachment,
    type AppData,
    type PendingRemoteAttachmentDelete,
    type Project,
} from '@mindwtr/core';
import { corsOrigin, errorResponse, jsonResponse, logWarn } from './server-config';
import { loadAppData } from './server-data-cache';
import {
    isBodyReadError,
    isPathWithinRoot,
    normalizeAttachmentRelativePath,
    readRequestBytes,
    throwIfRequestAborted,
    writeAttachmentFileSafely,
} from './server-storage';
import { validateAppData } from './server-validation';

// Relies on POSIX mtime; do not lower below 1 minute without auditing filesystem timestamp resolution and batching.
const ORPHAN_ATTACHMENT_GC_GRACE_MS = 5 * 60 * 1000;

export const stripProjectAttachmentRemoteMetadata = (attachments: Project['attachments']): Project['attachments'] => (
    attachments?.map((attachment) => (
        attachment.kind === 'file'
            ? {
                ...attachment,
                cloudKey: undefined,
                localStatus: undefined,
            }
            : attachment
    ))
);

export const getAttachmentCloudKey = (attachment: Attachment): string | null => {
    if (attachment.kind !== 'file' || !attachment.cloudKey) return null;
    return normalizeAttachmentRelativePath(attachment.cloudKey);
};

export const collectRetainedAttachmentCloudKeysForProjectPurge = (data: AppData, purgedProjectId: string): Set<string> => {
    const cloudKeys = new Set<string>();
    for (const project of data.projects) {
        if (project.id === purgedProjectId || project.purgedAt) continue;
        for (const attachment of project.attachments || []) {
            const cloudKey = getAttachmentCloudKey(attachment);
            if (cloudKey) cloudKeys.add(cloudKey);
        }
    }
    for (const task of data.tasks) {
        if (task.purgedAt) continue;
        for (const attachment of task.attachments || []) {
            const cloudKey = getAttachmentCloudKey(attachment);
            if (cloudKey) cloudKeys.add(cloudKey);
        }
    }
    return cloudKeys;
};

export const collectPendingRemoteDeletesForProjectPurge = (
    project: Project,
    data: AppData,
): PendingRemoteAttachmentDelete[] => {
    const retainedCloudKeys = collectRetainedAttachmentCloudKeysForProjectPurge(data, project.id);
    const byCloudKey = new Map<string, PendingRemoteAttachmentDelete>();
    for (const attachment of project.attachments || []) {
        const cloudKey = getAttachmentCloudKey(attachment);
        if (!cloudKey || retainedCloudKeys.has(cloudKey) || byCloudKey.has(cloudKey)) continue;
        byCloudKey.set(cloudKey, {
            cloudKey,
            title: attachment.title || cloudKey,
        });
    }
    return Array.from(byCloudKey.values());
};

export const appendPendingRemoteAttachmentDeletes = (
    settings: AppData['settings'],
    pendingDeletes: readonly PendingRemoteAttachmentDelete[],
): AppData['settings'] => {
    if (pendingDeletes.length === 0) return settings;
    const byCloudKey = new Map<string, PendingRemoteAttachmentDelete>();
    for (const existing of settings.attachments?.pendingRemoteDeletes || []) {
        byCloudKey.set(existing.cloudKey, existing);
    }
    for (const pending of pendingDeletes) {
        if (byCloudKey.has(pending.cloudKey)) continue;
        byCloudKey.set(pending.cloudKey, pending);
    }
    return {
        ...settings,
        attachments: {
            ...settings.attachments,
            pendingRemoteDeletes: Array.from(byCloudKey.values()),
        },
    };
};

export function collectReferencedAttachmentCloudKeys(data: AppData): Set<string> {
    const referenced = new Set<string>();
    const collect = (attachments: Attachment[] | undefined, ownerDeleted?: string) => {
        if (ownerDeleted) return;
        for (const attachment of attachments ?? []) {
            if (attachment.kind !== 'file' || attachment.deletedAt || !attachment.cloudKey) continue;
            const normalized = normalizeAttachmentRelativePath(attachment.cloudKey);
            if (normalized) referenced.add(normalized);
        }
    };
    data.tasks.forEach((task) => collect(task.attachments, task.deletedAt));
    data.projects.forEach((project) => collect(project.attachments, project.deletedAt));
    return referenced;
}

export function garbageCollectOrphanAttachments(dataDir: string, key: string, data: AppData): {
    deleted: number;
    errors: string[];
    kept: number;
    scanned: number;
} {
    const rootDir = join(dataDir, key, 'attachments');
    if (!existsSync(rootDir)) return { deleted: 0, errors: [], kept: 0, scanned: 0 };
    mkdirSync(rootDir, { recursive: true });
    const rootStat = lstatSync(rootDir);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
        return {
            deleted: 0,
            errors: ['attachment root is not a normal directory'],
            kept: 0,
            scanned: 0,
        };
    }
    const rootRealPath = realpathSync(rootDir);
    const referenced = collectReferencedAttachmentCloudKeys(data);
    const errors: string[] = [];
    let deleted = 0;
    let kept = 0;
    let scanned = 0;

    const visit = (dirPath: string) => {
        for (const dirent of readdirSync(dirPath, { withFileTypes: true })) {
            const entryPath = join(dirPath, dirent.name);
            let stat;
            try {
                stat = lstatSync(entryPath);
            } catch (error) {
                errors.push(`${relative(rootRealPath, entryPath)}: ${(error as Error).message}`);
                continue;
            }
            if (stat.isDirectory()) {
                visit(entryPath);
                try {
                    if (entryPath !== rootRealPath) rmdirSync(entryPath);
                } catch {
                    // Directory still has referenced files or concurrent writes.
                }
                continue;
            }

            scanned += 1;
            const relativePath = normalizeAttachmentRelativePath(relative(rootRealPath, entryPath).replace(/\\/g, '/'));
            if (!relativePath || referenced.has(relativePath)) {
                kept += 1;
                continue;
            }
            if (stat.mtimeMs > Date.now() - ORPHAN_ATTACHMENT_GC_GRACE_MS) {
                kept += 1;
                continue;
            }
            try {
                unlinkSync(entryPath);
                deleted += 1;
            } catch (error) {
                errors.push(`${relativePath}: ${(error as Error).message}`);
            }
        }
    };

    visit(rootRealPath);
    return { deleted, errors, kept, scanned };
}

/** Route body for POST/DELETE /v1/attachments/orphans, once withNamespace + the write lock have already run. */
export function handleOrphanAttachmentGcRequest(dataDir: string, key: string, filePath: string): Response {
    const data = loadAppData(filePath);
    const validated = validateAppData(data);
    if (!validated.ok) {
        logWarn('Stored cloud data failed validation before attachment GC', { key, error: validated.error });
        return errorResponse('Stored data failed validation', 500);
    }
    const result = garbageCollectOrphanAttachments(dataDir, key, data);
    return jsonResponse({ ok: result.errors.length === 0, ...result });
}

const normalizeAttachmentContentType = (value: string | null): string => value?.split(';', 1)[0]?.trim().toLowerCase() || '';

const getBlockedAttachmentSignature = (bytes: Uint8Array): string | null => {
    if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
        return 'windows-pe';
    }
    if (bytes.length >= 4) {
        if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
            return 'elf';
        }
        const signature = `${bytes[0].toString(16).padStart(2, '0')}${bytes[1].toString(16).padStart(2, '0')}`
            + `${bytes[2].toString(16).padStart(2, '0')}${bytes[3].toString(16).padStart(2, '0')}`;
        if (signature === 'feedface' || signature === 'feedfacf' || signature === 'cefaedfe' || signature === 'cffaedfe') {
            return 'mach-o';
        }
    }
    return null;
};

/**
 * Route body for GET/PUT/DELETE /v1/attachments/:path, once withNamespace has already
 * resolved and validated the on-disk path (see resolveAttachmentPath in
 * server-storage.ts). Takes the resolved path rather than resolving it itself, so it
 * can be exercised directly against a temp directory without a live server.
 */
export async function handleAttachmentPathRequest(
    req: Request,
    pathname: string,
    resolved: { rootRealPath: string; filePath: string },
    options: { maxAttachmentBytes: number; abortSignal: AbortSignal },
): Promise<Response> {
    const { rootRealPath, filePath } = resolved;

    if (req.method === 'GET') {
        if (!existsSync(filePath)) return errorResponse('Not found', 404);
        try {
            const realFilePath = realpathSync(filePath);
            if (!isPathWithinRoot(realFilePath, rootRealPath)) {
                return errorResponse('Invalid attachment path', 400);
            }
            const file = readFileSync(realFilePath);
            const headers = new Headers();
            headers.set('Access-Control-Allow-Origin', corsOrigin);
            headers.set('Content-Type', 'application/octet-stream');
            return new Response(file, { status: 200, headers });
        } catch {
            return errorResponse('Failed to read attachment', 500);
        }
    }

    if (req.method === 'PUT') {
        // Namespace write cap already enforced by withNamespace's guardMethods
        // override (attachmentPathServerConfig) before this handler runs.
        const contentType = normalizeAttachmentContentType(req.headers.get('content-type'));
        if (contentType) {
            const validation = await validateAttachmentForUpload({
                id: 'attachment-upload',
                kind: 'file',
                title: pathname,
                uri: '',
                createdAt: '1970-01-01T00:00:00.000Z',
                updatedAt: '1970-01-01T00:00:00.000Z',
                mimeType: contentType,
            } satisfies Attachment, 0);
            if (!validation.valid && validation.error === 'mime_type_blocked') {
                return errorResponse(`Blocked attachment content type: ${validation.details}`, 400);
            }
        }
        const body = await readRequestBytes(req, options.maxAttachmentBytes, options.abortSignal);
        if (isBodyReadError(body)) {
            return errorResponse(body.__mindwtrError.message, body.__mindwtrError.status);
        }
        const blockedSignature = getBlockedAttachmentSignature(body);
        if (blockedSignature) {
            return errorResponse(`Blocked executable attachment signature: ${blockedSignature}`, 400);
        }
        throwIfRequestAborted(options.abortSignal);
        const wrote = writeAttachmentFileSafely(rootRealPath, filePath, body);
        if (!wrote) return errorResponse('Invalid attachment path', 400);
        return jsonResponse({ ok: true });
    }

    if (req.method === 'DELETE') {
        if (!existsSync(filePath)) {
            return jsonResponse({ ok: true });
        }
        try {
            const realFilePath = realpathSync(filePath);
            if (!isPathWithinRoot(realFilePath, rootRealPath)) {
                return errorResponse('Invalid attachment path', 400);
            }
            unlinkSync(realFilePath);
            return jsonResponse({ ok: true });
        } catch {
            return errorResponse('Failed to delete attachment', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
}
