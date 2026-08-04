import type { DropboxAuthTokens } from './dropbox-auth';
import {
    CLOUD_ALLOW_INSECURE_HTTP_KEY,
    CLOUD_PROVIDER_KEY,
    CLOUD_TOKEN_KEY,
    CLOUD_URL_KEY,
    SYNC_BACKEND_KEY,
    SYNC_PATH_BOOKMARK_KEY,
    SYNC_PATH_KEY,
    WEBDAV_ALLOW_INSECURE_HTTP_KEY,
    WEBDAV_PASSWORD_KEY,
    WEBDAV_URL_KEY,
    WEBDAV_USERNAME_KEY,
} from './sync-constants';
import type { MobileSyncConfigOverride } from './sync-service';

type StorageEntry = readonly [string, string];
type StorageSnapshotEntry = readonly [string, string | null];

export type MobileSyncConfigurationTransactionDependencies = {
    clearConfigCache: () => void;
    clearDropboxTokens: () => Promise<void>;
    deleteSecret: (key: string) => Promise<void>;
    getDropboxTokens: () => Promise<DropboxAuthTokens | null>;
    getSecret: (key: string) => Promise<string | null>;
    multiGet: (keys: string[]) => Promise<readonly StorageSnapshotEntry[]>;
    multiSet: (entries: StorageEntry[]) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    saveDropboxTokens: (tokens: DropboxAuthTokens) => Promise<void>;
    setItem: (key: string, value: string) => Promise<void>;
    setSecret: (key: string, value: string) => Promise<void>;
};

export class MobileSyncConfigurationTransactionError extends Error {
    readonly syncRemainsDisabled: boolean;

    constructor(message: string, syncRemainsDisabled: boolean) {
        super(message);
        this.name = 'MobileSyncConfigurationTransactionError';
        this.syncRemainsDisabled = syncRemainsDisabled;
    }
}

type CandidateWrites = {
    dropboxTokens: DropboxAuthTokens | null;
    secret: StorageEntry | null;
    storageEntries: StorageEntry[];
    storageKeysToRemove: string[];
};

type ConfigurationSnapshot = {
    backend: string | null;
    dropboxTokens: DropboxAuthTokens | null | undefined;
    secret: StorageSnapshotEntry | null;
    storage: readonly StorageSnapshotEntry[];
};

const serializeBool = (value: boolean): string => (value ? 'true' : 'false');

const errorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    const text = String(error ?? '').trim();
    return text || 'Unknown sync configuration error';
};

const tokensMatch = (actual: DropboxAuthTokens | null, expected: DropboxAuthTokens | null): boolean => (
    actual?.accessToken === expected?.accessToken
    && actual?.refreshToken === expected?.refreshToken
    && actual?.expiresAt === expected?.expiresAt
);

const buildCandidateWrites = (candidate: MobileSyncConfigOverride): CandidateWrites => {
    const storageEntries: StorageEntry[] = [];
    const storageKeysToRemove: string[] = [];
    let secret: StorageEntry | null = null;

    if (candidate.backend === 'file') {
        storageEntries.push([SYNC_PATH_KEY, candidate.syncPath ?? '']);
        if (candidate.syncPathBookmark) {
            storageEntries.push([SYNC_PATH_BOOKMARK_KEY, candidate.syncPathBookmark]);
        } else {
            storageKeysToRemove.push(SYNC_PATH_BOOKMARK_KEY);
        }
    } else if (candidate.backend === 'webdav') {
        if (!candidate.webdav) throw new Error('WebDAV configuration is required');
        storageEntries.push(
            [WEBDAV_URL_KEY, candidate.webdav.url],
            [WEBDAV_USERNAME_KEY, candidate.webdav.username],
            [WEBDAV_ALLOW_INSECURE_HTTP_KEY, serializeBool(candidate.webdav.allowInsecureHttp === true)],
        );
        secret = [WEBDAV_PASSWORD_KEY, candidate.webdav.password];
    } else if (candidate.backend === 'cloudkit') {
        storageEntries.push([CLOUD_PROVIDER_KEY, 'cloudkit']);
    } else if (candidate.backend === 'cloud') {
        const provider = candidate.cloudProvider ?? 'selfhosted';
        storageEntries.push([CLOUD_PROVIDER_KEY, provider]);
        if (provider === 'selfhosted') {
            if (!candidate.cloud) throw new Error('Self-hosted configuration is required');
            storageEntries.push(
                [CLOUD_URL_KEY, candidate.cloud.url],
                [CLOUD_ALLOW_INSECURE_HTTP_KEY, serializeBool(candidate.cloud.allowInsecureHttp === true)],
            );
            secret = [CLOUD_TOKEN_KEY, candidate.cloud.token];
        }
    }

    return {
        dropboxTokens: candidate.backend === 'cloud'
            && candidate.cloudProvider === 'dropbox'
            && candidate.dropbox
            ? candidate.dropbox.tokens
            : null,
        secret,
        storageEntries,
        storageKeysToRemove,
    };
};

const readStorageMap = async (
    keys: string[],
    dependencies: MobileSyncConfigurationTransactionDependencies,
): Promise<Map<string, string | null>> => new Map(await dependencies.multiGet(keys));

const assertStorageValues = async (
    expected: readonly StorageSnapshotEntry[],
    dependencies: MobileSyncConfigurationTransactionDependencies,
): Promise<void> => {
    const actual = await readStorageMap(expected.map(([key]) => key), dependencies);
    for (const [key, expectedValue] of expected) {
        if ((actual.get(key) ?? null) !== expectedValue) {
            throw new Error(`Persisted sync setting ${key} did not match the expected value`);
        }
    }
};

const snapshotConfiguration = async (
    writes: CandidateWrites,
    dependencies: MobileSyncConfigurationTransactionDependencies,
): Promise<ConfigurationSnapshot> => {
    const storageKeys = [...new Set([
        SYNC_BACKEND_KEY,
        ...writes.storageEntries.map(([key]) => key),
        ...writes.storageKeysToRemove,
    ])];
    const storage = await dependencies.multiGet(storageKeys);
    const backend = storage.find(([key]) => key === SYNC_BACKEND_KEY)?.[1] ?? null;
    return {
        backend,
        dropboxTokens: writes.dropboxTokens ? await dependencies.getDropboxTokens() : undefined,
        secret: writes.secret
            ? [writes.secret[0], await dependencies.getSecret(writes.secret[0])]
            : null,
        storage: storage.filter(([key]) => key !== SYNC_BACKEND_KEY),
    };
};

const writeBackend = async (
    backend: string,
    dependencies: MobileSyncConfigurationTransactionDependencies,
): Promise<void> => {
    await dependencies.setItem(SYNC_BACKEND_KEY, backend);
    dependencies.clearConfigCache();
};

const assertBackend = async (
    expected: string,
    dependencies: MobileSyncConfigurationTransactionDependencies,
): Promise<void> => {
    await assertStorageValues([[SYNC_BACKEND_KEY, expected]], dependencies);
};

const writeCandidate = async (
    writes: CandidateWrites,
    dependencies: MobileSyncConfigurationTransactionDependencies,
): Promise<void> => {
    if (writes.storageEntries.length > 0) {
        await dependencies.multiSet(writes.storageEntries);
    }
    for (const key of writes.storageKeysToRemove) {
        await dependencies.removeItem(key);
    }
    if (writes.secret) {
        await dependencies.setSecret(writes.secret[0], writes.secret[1]);
    }
    if (writes.dropboxTokens) {
        await dependencies.saveDropboxTokens(writes.dropboxTokens);
    }
    dependencies.clearConfigCache();
};

const assertCandidate = async (
    writes: CandidateWrites,
    dependencies: MobileSyncConfigurationTransactionDependencies,
): Promise<void> => {
    await assertBackend('off', dependencies);
    await assertStorageValues([
        ...writes.storageEntries,
        ...writes.storageKeysToRemove.map((key): StorageSnapshotEntry => [key, null]),
    ], dependencies);
    if (writes.secret) {
        const actualSecret = await dependencies.getSecret(writes.secret[0]);
        if (actualSecret !== writes.secret[1]) {
            throw new Error('Persisted sync secret did not match the proven candidate');
        }
    }
    if (writes.dropboxTokens) {
        const actualTokens = await dependencies.getDropboxTokens();
        if (!tokensMatch(actualTokens, writes.dropboxTokens)) {
            throw new Error('Persisted Dropbox credentials did not match the proven candidate');
        }
    }
};

const restoreSnapshot = async (
    snapshot: ConfigurationSnapshot,
    dependencies: MobileSyncConfigurationTransactionDependencies,
): Promise<void> => {
    const failures: string[] = [];
    const attempt = async (label: string, operation: () => Promise<unknown>): Promise<boolean> => {
        try {
            await operation();
            return true;
        } catch (error) {
            failures.push(`${label}: ${errorMessage(error)}`);
            return false;
        }
    };

    const disabled = await attempt('disable sync', async () => {
        await writeBackend('off', dependencies);
        await assertBackend('off', dependencies);
    });

    if (disabled) {
        const values = snapshot.storage.filter(
            (entry): entry is readonly [string, string] => entry[1] !== null,
        );
        const missingKeys = snapshot.storage
            .filter(([, value]) => value === null)
            .map(([key]) => key);
        if (values.length > 0) {
            await attempt('restore transport settings', () => dependencies.multiSet(values));
        }
        for (const key of missingKeys) {
            await attempt(`clear ${key}`, () => dependencies.removeItem(key));
        }
        if (snapshot.secret) {
            const secretSnapshot = snapshot.secret;
            await attempt('restore sync secret', () => secretSnapshot[1] === null
                ? dependencies.deleteSecret(secretSnapshot[0])
                : dependencies.setSecret(secretSnapshot[0], secretSnapshot[1]));
        }
        if (snapshot.dropboxTokens) {
            await attempt('restore Dropbox credentials', () => dependencies.saveDropboxTokens(snapshot.dropboxTokens!));
        } else if (snapshot.dropboxTokens === null) {
            await attempt('clear Dropbox credentials', () => dependencies.clearDropboxTokens());
        }
        dependencies.clearConfigCache();

        if (failures.length === 0) {
            await attempt('verify restored transport settings', async () => {
                await assertBackend('off', dependencies);
                await assertStorageValues(snapshot.storage, dependencies);
                if (snapshot.secret) {
                    const actualSecret = await dependencies.getSecret(snapshot.secret[0]);
                    if (actualSecret !== snapshot.secret[1]) {
                        throw new Error('restored secret does not match the previous value');
                    }
                }
                if (snapshot.dropboxTokens !== undefined) {
                    const actualTokens = await dependencies.getDropboxTokens();
                    if (!tokensMatch(actualTokens, snapshot.dropboxTokens)) {
                        throw new Error('restored Dropbox credentials do not match the previous value');
                    }
                }
            });
        }
    }

    const previousBackend = snapshot.backend ?? 'off';
    if (failures.length === 0 && previousBackend !== 'off') {
        await attempt('reactivate previous backend', async () => {
            await writeBackend(previousBackend, dependencies);
            await assertBackend(previousBackend, dependencies);
        });
    }

    if (failures.length > 0) {
        await attempt('keep sync disabled', async () => {
            await writeBackend('off', dependencies);
            await assertBackend('off', dependencies);
        });
        throw new MobileSyncConfigurationTransactionError(
            `Previous sync settings could not be fully restored; sync remains disabled. ${failures.join('; ')}`,
            true,
        );
    }
};

/**
 * Persist a configuration already proven by an activation probe. The backend
 * key is the activation flag: transport settings and credentials are changed
 * only while that flag is durably off, then verified before one final write.
 */
export async function commitProvenMobileSyncConfiguration(
    candidate: MobileSyncConfigOverride,
    dependencies: MobileSyncConfigurationTransactionDependencies,
): Promise<void> {
    const writes = buildCandidateWrites(candidate);
    const snapshot = await snapshotConfiguration(writes, dependencies);

    try {
        await writeBackend('off', dependencies);
        await assertBackend('off', dependencies);
        await writeCandidate(writes, dependencies);
        await assertCandidate(writes, dependencies);
        await writeBackend(candidate.backend, dependencies);
        await assertBackend(candidate.backend, dependencies);
    } catch (commitError) {
        try {
            await restoreSnapshot(snapshot, dependencies);
        } catch (rollbackError) {
            throw new MobileSyncConfigurationTransactionError(
                `${errorMessage(commitError)}. ${errorMessage(rollbackError)}`,
                true,
            );
        }
        throw commitError;
    }
}
