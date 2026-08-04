import { describe, expect, it } from 'vitest';

import type { DropboxAuthTokens } from './dropbox-auth';
import {
    commitProvenMobileSyncConfiguration,
    MobileSyncConfigurationTransactionError,
    type MobileSyncConfigurationTransactionDependencies,
} from './sync-configuration-transaction';
import {
    CLOUD_PROVIDER_KEY,
    SYNC_BACKEND_KEY,
    WEBDAV_ALLOW_INSECURE_HTTP_KEY,
    WEBDAV_PASSWORD_KEY,
    WEBDAV_URL_KEY,
    WEBDAV_USERNAME_KEY,
} from './sync-constants';

type HarnessOptions = {
    failCandidateActivation?: boolean;
    failDropboxRollback?: boolean;
};

const OLD_DROPBOX_TOKENS: DropboxAuthTokens = {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    expiresAt: 4_000_000_000_000,
};
const NEW_DROPBOX_TOKENS: DropboxAuthTokens = {
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    expiresAt: 4_100_000_000_000,
};

const createHarness = (
    initialStorage: Record<string, string>,
    initialSecrets: Record<string, string> = {},
    initialDropboxTokens: DropboxAuthTokens | null = null,
    options: HarnessOptions = {},
) => {
    const storage = new Map(Object.entries(initialStorage));
    const secrets = new Map(Object.entries(initialSecrets));
    const events: string[] = [];
    let dropboxTokens = initialDropboxTokens;
    let candidateActivationFailed = false;

    const dependencies: MobileSyncConfigurationTransactionDependencies = {
        clearConfigCache: () => events.push('clear-cache'),
        clearDropboxTokens: async () => {
            events.push('clear-dropbox');
            dropboxTokens = null;
        },
        deleteSecret: async (key) => {
            events.push(`delete-secret:${key}`);
            secrets.delete(key);
        },
        getDropboxTokens: async () => dropboxTokens,
        getSecret: async (key) => secrets.get(key) ?? null,
        multiGet: async (keys) => keys.map((key) => [key, storage.get(key) ?? null] as const),
        multiSet: async (entries) => {
            events.push(`multi-set:${entries.map(([key]) => key).join(',')}`);
            for (const [key, value] of entries) storage.set(key, value);
        },
        removeItem: async (key) => {
            events.push(`remove:${key}`);
            storage.delete(key);
        },
        saveDropboxTokens: async (tokens) => {
            events.push(`save-dropbox:${tokens.accessToken}`);
            if (options.failDropboxRollback && candidateActivationFailed && tokens.accessToken === OLD_DROPBOX_TOKENS.accessToken) {
                throw new Error('injected Dropbox rollback failure');
            }
            dropboxTokens = { ...tokens };
        },
        setItem: async (key, value) => {
            events.push(`set:${key}:${value}`);
            if (
                options.failCandidateActivation
                && key === SYNC_BACKEND_KEY
                && value === 'cloud'
                && dropboxTokens?.accessToken === NEW_DROPBOX_TOKENS.accessToken
                && !candidateActivationFailed
            ) {
                candidateActivationFailed = true;
                throw new Error('injected activation failure');
            }
            storage.set(key, value);
        },
        setSecret: async (key, value) => {
            events.push(`set-secret:${key}:${value}`);
            if (storage.get(SYNC_BACKEND_KEY) !== 'off') {
                throw new Error('transport secret changed while sync was active');
            }
            secrets.set(key, value);
        },
    };

    return {
        dependencies,
        events,
        getDropboxTokens: () => dropboxTokens,
        secrets,
        storage,
    };
};

describe('commitProvenMobileSyncConfiguration', () => {
    it('disables an active same-backend configuration before changing its transport', async () => {
        const harness = createHarness({
            [SYNC_BACKEND_KEY]: 'webdav',
            [WEBDAV_URL_KEY]: 'https://old.example.test/dav',
            [WEBDAV_USERNAME_KEY]: 'old-user',
            [WEBDAV_ALLOW_INSECURE_HTTP_KEY]: 'false',
        }, {
            [WEBDAV_PASSWORD_KEY]: 'old-password',
        });

        await commitProvenMobileSyncConfiguration({
            backend: 'webdav',
            webdav: {
                url: 'https://new.example.test/dav',
                username: 'new-user',
                password: 'new-password',
                allowInsecureHttp: false,
            },
        }, harness.dependencies);

        expect(harness.storage.get(SYNC_BACKEND_KEY)).toBe('webdav');
        expect(harness.storage.get(WEBDAV_URL_KEY)).toBe('https://new.example.test/dav');
        expect(harness.secrets.get(WEBDAV_PASSWORD_KEY)).toBe('new-password');
        const disabledAt = harness.events.indexOf(`set:${SYNC_BACKEND_KEY}:off`);
        const transportWriteAt = harness.events.findIndex((event) => event.startsWith('multi-set:'));
        const activatedAt = harness.events.lastIndexOf(`set:${SYNC_BACKEND_KEY}:webdav`);
        expect(disabledAt).toBeGreaterThanOrEqual(0);
        expect(transportWriteAt).toBeGreaterThan(disabledAt);
        expect(activatedAt).toBeGreaterThan(transportWriteAt);
    });

    it('restores and reactivates the previous backend when candidate activation fails', async () => {
        const harness = createHarness({
            [SYNC_BACKEND_KEY]: 'cloud',
            [CLOUD_PROVIDER_KEY]: 'dropbox',
        }, {}, OLD_DROPBOX_TOKENS, { failCandidateActivation: true });

        await expect(commitProvenMobileSyncConfiguration({
            backend: 'cloud',
            cloudProvider: 'dropbox',
            dropbox: { tokens: NEW_DROPBOX_TOKENS },
        }, harness.dependencies)).rejects.toThrow('injected activation failure');

        expect(harness.storage.get(SYNC_BACKEND_KEY)).toBe('cloud');
        expect(harness.storage.get(CLOUD_PROVIDER_KEY)).toBe('dropbox');
        expect(harness.getDropboxTokens()).toEqual(OLD_DROPBOX_TOKENS);
        expect(harness.events.lastIndexOf(`set:${SYNC_BACKEND_KEY}:cloud`)).toBeGreaterThan(
            harness.events.lastIndexOf(`save-dropbox:${OLD_DROPBOX_TOKENS.accessToken}`),
        );
    });

    it('leaves sync off and does not reactivate a partially restored configuration', async () => {
        const harness = createHarness({
            [SYNC_BACKEND_KEY]: 'cloud',
            [CLOUD_PROVIDER_KEY]: 'dropbox',
        }, {}, OLD_DROPBOX_TOKENS, {
            failCandidateActivation: true,
            failDropboxRollback: true,
        });

        const error = await commitProvenMobileSyncConfiguration({
            backend: 'cloud',
            cloudProvider: 'dropbox',
            dropbox: { tokens: NEW_DROPBOX_TOKENS },
        }, harness.dependencies).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(MobileSyncConfigurationTransactionError);
        expect((error as MobileSyncConfigurationTransactionError).syncRemainsDisabled).toBe(true);
        expect(String(error)).toContain('sync remains disabled');
        expect(harness.storage.get(SYNC_BACKEND_KEY)).toBe('off');
        expect(harness.getDropboxTokens()).toEqual(NEW_DROPBOX_TOKENS);
        expect(harness.events.at(-2)).toBe(`set:${SYNC_BACKEND_KEY}:off`);
    });
});
