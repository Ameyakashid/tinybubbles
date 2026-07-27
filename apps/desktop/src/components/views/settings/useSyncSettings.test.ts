import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/app-log', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../lib/app-log')>();
    return {
        ...actual,
        logError: vi.fn(),
    };
});

vi.mock('../../../lib/settings-open-diagnostics', () => ({
    markSettingsOpenTrace: vi.fn(),
    measureSettingsOpenStep: vi.fn(async (_step: string, fn: () => unknown) => fn()),
}));

vi.mock('../../../contexts/language-context', () => ({
    useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));

import { isConnectionAllowed, SYNC_LOCAL_INSECURE_URL_OPTIONS, type SyncBackend } from '@mindwtr/core';
import { SyncService } from '../../../lib/sync-service';
import { useUiStore } from '../../../store/ui-store';
import { isValidHttpUrl } from './sync/sync-page-utils';
import { useSyncSettings } from './useSyncSettings';

const initialUiState = useUiStore.getState();

type TargetInputs = {
    syncBackend: SyncBackend;
    syncPath: string;
    webdavUrl: string;
    webdavAllowInsecureHttp: boolean;
    cloudUrl: string;
    cloudAllowInsecureHttp: boolean;
    cloudProvider: 'selfhosted' | 'dropbox';
    dropboxAppKey: string;
    dropboxConfigured: boolean;
    dropboxConnected: boolean;
};

/**
 * The pre-move expression, copied verbatim from SettingsSyncPage before
 * `isSyncTargetValid` was folded into useSyncSettings. Pinned here on purpose:
 * asserting the hook against the old predicate over a fixed candidate list
 * catches a branch quietly going missing, which a test that only re-derives the
 * new implementation would not.
 */
const legacyIsSyncTargetValid = (p: TargetInputs): boolean => {
    const webdavUrlError = p.webdavUrl.trim() ? !isValidHttpUrl(p.webdavUrl.trim()) : false;
    const cloudUrlError = p.cloudUrl.trim() ? !isValidHttpUrl(p.cloudUrl.trim()) : false;
    const webdavConnectionAllowed = !webdavUrlError && p.webdavUrl.trim()
        ? isConnectionAllowed(p.webdavUrl.trim(), {
            ...SYNC_LOCAL_INSECURE_URL_OPTIONS,
            allowInsecureHttp: p.webdavAllowInsecureHttp,
        })
        : !p.webdavUrl.trim();
    const cloudConnectionAllowed = !cloudUrlError && p.cloudUrl.trim()
        ? isConnectionAllowed(p.cloudUrl.trim(), {
            ...SYNC_LOCAL_INSECURE_URL_OPTIONS,
            allowInsecureHttp: p.cloudAllowInsecureHttp,
        })
        : !p.cloudUrl.trim();
    return p.syncBackend === 'file'
        ? !!p.syncPath.trim()
        : p.syncBackend === 'cloudkit'
            ? true
            : p.syncBackend === 'webdav'
                ? !!p.webdavUrl.trim() && !webdavUrlError && webdavConnectionAllowed
                : p.syncBackend === 'cloud'
                    ? (p.cloudProvider === 'selfhosted'
                        ? !!p.cloudUrl.trim() && !cloudUrlError && cloudConnectionAllowed
                        : p.dropboxConfigured && !!p.dropboxAppKey.trim() && p.dropboxConnected)
                    : false;
};

const NO_TARGET: TargetInputs = {
    syncBackend: 'off',
    syncPath: '',
    webdavUrl: '',
    webdavAllowInsecureHttp: false,
    cloudUrl: '',
    cloudAllowInsecureHttp: false,
    cloudProvider: 'selfhosted',
    dropboxAppKey: '',
    dropboxConfigured: false,
    dropboxConnected: false,
};

describe('useSyncSettings cloud token validation', () => {
    beforeEach(() => {
        act(() => {
            useUiStore.setState(initialUiState, true);
        });
        vi.spyOn(SyncService, 'getSyncPath').mockResolvedValue('');
        vi.spyOn(SyncService, 'getSyncBackend').mockResolvedValue('off');
        vi.spyOn(SyncService, 'getWebDavConfig').mockResolvedValue({
            url: '',
            username: '',
            password: '',
            hasPassword: false,
            allowInsecureHttp: false,
        });
        vi.spyOn(SyncService, 'getCloudConfig').mockResolvedValue({
            url: '',
            token: '',
            rememberToken: false,
            allowInsecureHttp: false,
        });
        vi.spyOn(SyncService, 'getCloudProvider').mockResolvedValue('selfhosted');
        vi.spyOn(SyncService, 'getDropboxAppKey').mockResolvedValue('');
        vi.spyOn(SyncService, 'getDropboxRedirectUri').mockResolvedValue('http://127.0.0.1:53682/oauth/dropbox/callback');
        vi.spyOn(SyncService, 'listDataSnapshots').mockResolvedValue([]);
        vi.spyOn(SyncService, 'subscribeSyncStatus').mockImplementation(() => () => {});
        vi.spyOn(SyncService, 'setCloudConfig').mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const setup = () => renderHook(() => useSyncSettings({
        appVersion: '1.0.0',
        isTauri: false,
        showSaved: vi.fn(),
        selectSyncFolderTitle: 'Select folder',
        lastSyncNeverLabel: 'Never',
        requestConfirmation: vi.fn().mockResolvedValue(true),
    }));

    it('rejects a short cloud token and does not save', async () => {
        const { result } = setup();
        await waitFor(() => expect(SyncService.getCloudConfig).toHaveBeenCalled());

        act(() => {
            result.current.syncPageProps.onCloudUrlChange('https://example.com');
            result.current.syncPageProps.onCloudTokenChange('short-token');
        });

        await act(async () => {
            await result.current.syncPageProps.onSaveCloud();
        });

        expect(SyncService.setCloudConfig).not.toHaveBeenCalled();
        expect(result.current.syncPageProps.syncError).toBe(
            'Sync token must be 20-512 characters using letters, numbers, or . _ ~ + / = -'
        );
    });

    it('treats an empty token as "unchanged, use keyring" and saves', async () => {
        const { result } = setup();
        await waitFor(() => expect(SyncService.getCloudConfig).toHaveBeenCalled());

        act(() => {
            result.current.syncPageProps.onCloudUrlChange('https://example.com');
            result.current.syncPageProps.onCloudTokenChange('');
        });

        await act(async () => {
            await result.current.syncPageProps.onSaveCloud();
        });

        expect(SyncService.setCloudConfig).toHaveBeenCalledWith(
            expect.objectContaining({ token: '' })
        );
    });

    it('saves a valid cloud token', async () => {
        const { result } = setup();
        await waitFor(() => expect(SyncService.getCloudConfig).toHaveBeenCalled());

        const validToken = 'a'.repeat(24);
        act(() => {
            result.current.syncPageProps.onCloudUrlChange('https://example.com');
            result.current.syncPageProps.onCloudTokenChange(validToken);
        });

        await act(async () => {
            await result.current.syncPageProps.onSaveCloud();
        });

        expect(SyncService.setCloudConfig).toHaveBeenCalledWith(
            expect.objectContaining({ token: validToken })
        );
    });
});

describe('useSyncSettings sync target validity', () => {
    const CASES: Array<Omit<TargetInputs, 'dropboxConfigured'>> = [
        { ...NO_TARGET, syncBackend: 'off' },
        { ...NO_TARGET, syncBackend: 'file' },
        { ...NO_TARGET, syncBackend: 'file', syncPath: '/home/user/sync' },
        { ...NO_TARGET, syncBackend: 'file', syncPath: '   ' },
        { ...NO_TARGET, syncBackend: 'cloudkit' },
        { ...NO_TARGET, syncBackend: 'webdav' },
        { ...NO_TARGET, syncBackend: 'webdav', webdavUrl: 'https://dav.example.com/remote.php' },
        { ...NO_TARGET, syncBackend: 'webdav', webdavUrl: 'not a url' },
        { ...NO_TARGET, syncBackend: 'webdav', webdavUrl: 'http://public.example.com/dav' },
        {
            ...NO_TARGET,
            syncBackend: 'webdav',
            webdavUrl: 'http://public.example.com/dav',
            webdavAllowInsecureHttp: true,
        },
        { ...NO_TARGET, syncBackend: 'webdav', webdavUrl: 'http://127.0.0.1:8080/dav' },
        { ...NO_TARGET, syncBackend: 'cloud' },
        { ...NO_TARGET, syncBackend: 'cloud', cloudUrl: 'https://cloud.example.com' },
        { ...NO_TARGET, syncBackend: 'cloud', cloudUrl: 'http://public.example.com' },
        {
            ...NO_TARGET,
            syncBackend: 'cloud',
            cloudUrl: 'http://public.example.com',
            cloudAllowInsecureHttp: true,
        },
        { ...NO_TARGET, syncBackend: 'cloud', cloudProvider: 'dropbox' },
        {
            ...NO_TARGET,
            syncBackend: 'cloud',
            cloudProvider: 'dropbox',
            dropboxAppKey: 'app-key',
            dropboxConnected: false,
        },
        {
            ...NO_TARGET,
            syncBackend: 'cloud',
            cloudProvider: 'dropbox',
            dropboxAppKey: 'app-key',
            dropboxConnected: true,
        },
    ];

    const setupCase = (input: Omit<TargetInputs, 'dropboxConfigured'>) => {
        act(() => {
            useUiStore.setState(initialUiState, true);
        });
        vi.spyOn(SyncService, 'getSyncPath').mockResolvedValue(input.syncPath);
        vi.spyOn(SyncService, 'getSyncBackend').mockResolvedValue(input.syncBackend);
        vi.spyOn(SyncService, 'getWebDavConfig').mockResolvedValue({
            url: input.webdavUrl,
            username: '',
            password: '',
            hasPassword: false,
            allowInsecureHttp: input.webdavAllowInsecureHttp,
        });
        vi.spyOn(SyncService, 'getCloudConfig').mockResolvedValue({
            url: input.cloudUrl,
            token: '',
            rememberToken: false,
            allowInsecureHttp: input.cloudAllowInsecureHttp,
        });
        vi.spyOn(SyncService, 'getCloudProvider').mockResolvedValue(input.cloudProvider);
        vi.spyOn(SyncService, 'getDropboxAppKey').mockResolvedValue(input.dropboxAppKey);
        vi.spyOn(SyncService, 'getDropboxRedirectUri').mockResolvedValue('http://127.0.0.1:53682/oauth/dropbox/callback');
        vi.spyOn(SyncService, 'isDropboxConnected').mockResolvedValue(input.dropboxConnected);
        vi.spyOn(SyncService, 'listDataSnapshots').mockResolvedValue([]);
        vi.spyOn(SyncService, 'subscribeSyncStatus').mockImplementation(() => () => {});

        return renderHook(() => useSyncSettings({
            appVersion: '1.0.0',
            isTauri: false,
            showSaved: vi.fn(),
            selectSyncFolderTitle: 'Select folder',
            lastSyncNeverLabel: 'Never',
            requestConfirmation: vi.fn().mockResolvedValue(true),
        }));
    };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps the pre-move SettingsSyncPage verdict for every backend shape', async () => {
        const verdicts: boolean[] = [];

        for (const input of CASES) {
            // `dropboxConfigured` is not stored; the hook derives it from the app key.
            const expected = legacyIsSyncTargetValid({
                ...input,
                dropboxConfigured: Boolean(input.dropboxAppKey.trim()),
            });
            const { result, unmount } = setupCase(input);

            await waitFor(() => {
                expect(result.current.syncPageProps.syncBackend).toBe(input.syncBackend);
                expect(result.current.syncPageProps.dropboxConnected).toBe(input.dropboxConnected);
            });

            expect(
                result.current.syncPageProps.isSyncTargetValid,
                `backend=${input.syncBackend} webdav=${input.webdavUrl || '-'} cloud=${input.cloudUrl || '-'} provider=${input.cloudProvider} insecure=${input.webdavAllowInsecureHttp || input.cloudAllowInsecureHttp}`,
            ).toBe(expected);

            verdicts.push(expected);
            unmount();
            vi.restoreAllMocks();
        }

        // Guards against a candidate list that has collapsed to one verdict and
        // would then agree with any implementation.
        expect(verdicts).toContain(true);
        expect(verdicts).toContain(false);
    });
});
