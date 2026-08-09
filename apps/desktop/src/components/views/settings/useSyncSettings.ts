import { useCallback, useEffect, useRef, useState } from 'react';
import {
    SyncService,
    type CloudProvider,
    type DesktopSyncConfigOverride,
} from '../../../lib/sync-service';
import { useUiStore } from '../../../store/ui-store';
import { logError } from '../../../lib/app-log';
import { reportError } from '../../../lib/report-error';
import { markSettingsOpenTrace, measureSettingsOpenStep } from '../../../lib/settings-open-diagnostics';
import { useLanguage } from '../../../contexts/language-context';
import {
    addBreadcrumb,
    CLOCK_SKEW_THRESHOLD_MS,
    createImportDiagnostics,
    formatImportDiagnostic,
    getInMemoryAppDataSnapshot,
    isConnectionAllowed,
    isValidCloudSyncToken,
    safeFormatDate,
    SYNC_LOCAL_INSECURE_URL_OPTIONS,
    summarizeBackupMerge,
    summarizeMergeStats,
    translateWithFallback,
    useTaskStore,
    type AppData,
    type ImportDiagnostic,
    type SyncBackend,
} from '@mindwtr/core';
import {
    importDesktopDgtData,
    exportDesktopBackup,
    importDesktopMindwtrCsvData,
    importDesktopOmniFocusData,
    importDesktopTickTickData,
    importDesktopTodoistData,
    inspectDesktopDgtImport,
    inspectDesktopBackup,
    inspectDesktopMindwtrCsvImport,
    inspectDesktopOmniFocusImport,
    inspectDesktopTickTickImport,
    inspectDesktopTodoistImport,
    mergeDesktopBackup,
    restoreDesktopBackup,
} from '../../../lib/data-transfer';
import { isValidHttpUrl } from './sync/sync-page-utils';
import type {
    SettingsDataTransferProps,
    SettingsSyncPageProps,
    SyncPreferences,
} from './sync/types';

export type { SyncBackend };
export type DropboxTestState = 'idle' | 'success' | 'error';
export type WebDavTestState = 'idle' | 'success' | 'error';

const DROPBOX_CREDENTIAL_CLEANUP_ERROR = 'Pending Dropbox authorization could not be safely cleared. Try again.';

const IMPORT_DIAGNOSTIC_FALLBACKS: Record<string, string> = {
    'settings.importDiagnostics.adjustedRecords': '{{count}} imported record(s) needed an adjustment. Review the imported data.',
    'settings.importDiagnostics.cannotRead': 'Mindwtr could not safely read this export.',
    'settings.importDiagnostics.limitExceeded': 'This export exceeds a safe import limit. Choose a smaller export.',
    'settings.importDiagnostics.missingColumn': 'This export is missing the required column: {{column}}.',
    'settings.importDiagnostics.noImportableRecords': 'No importable records were found in this export.',
    'settings.importDiagnostics.renamedContainer': '“{{from}}” was renamed to “{{to}}” to avoid a duplicate {{kind}} name.',
};

// Restore and merge read the same file and preview it identically; only the sentence about
// what the action does to local data differs.
const buildBackupConfirmation = (
    validation: NonNullable<Awaited<ReturnType<typeof inspectDesktopBackup>>>,
    effect: string,
): string => [
    validation.metadata?.backupAt
        ? `Backup date: ${new Date(validation.metadata.backupAt).toLocaleString()}`
        : validation.metadata?.fileName
            ? `File: ${validation.metadata.fileName}`
            : null,
    `Contains ${validation.metadata?.taskCount ?? 0} tasks and ${validation.metadata?.projectCount ?? 0} projects.`,
    effect,
    ...(validation.warnings.length > 0 ? ['', ...validation.warnings] : []),
].filter(Boolean).join('\n');

const formatClockSkew = (ms: number): string => {
    if (!Number.isFinite(ms) || ms <= 0) return '0 ms';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)} min`;
};

type UseSyncSettingsOptions = {
    appVersion: string;
    isTauri: boolean;
    showSaved: () => void;
    selectSyncFolderTitle: string;
    lastSyncNeverLabel: string;
    requestConfirmation: (options: { title: string; message: string }) => Promise<boolean>;
};

export const useSyncSettings = ({
    appVersion,
    isTauri,
    showSaved,
    selectSyncFolderTitle,
    lastSyncNeverLabel,
    requestConfirmation,
}: UseSyncSettingsOptions) => {
    const [syncPath, setSyncPath] = useState('');
    const [syncStatus, setSyncStatus] = useState(() => SyncService.getSyncStatus());
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncBackend, setSyncBackend] = useState<SyncBackend>('off');
    const [persistedSyncBackend, setPersistedSyncBackend] = useState<SyncBackend>('off');
    const [webdavUrl, setWebdavUrl] = useState('');
    const [webdavUsername, setWebdavUsername] = useState('');
    const [webdavPassword, setWebdavPassword] = useState('');
    const [webdavHasPassword, setWebdavHasPassword] = useState(false);
    const [webdavAllowInsecureHttp, setWebdavAllowInsecureHttp] = useState(false);
    const [isSavingWebDav, setIsSavingWebDav] = useState(false);
    const [isTestingWebDav, setIsTestingWebDav] = useState(false);
    const [webdavTestState, setWebdavTestState] = useState<WebDavTestState>('idle');
    const [cloudUrl, setCloudUrl] = useState('');
    const [cloudToken, setCloudToken] = useState('');
    const [cloudRememberToken, setCloudRememberToken] = useState(false);
    const [cloudAllowInsecureHttp, setCloudAllowInsecureHttp] = useState(false);
    const [cloudProvider, setCloudProvider] = useState<CloudProvider>('selfhosted');
    const [persistedCloudProvider, setPersistedCloudProvider] = useState<CloudProvider>('selfhosted');
    const hasPendingSyncConfiguration = useRef(false);
    const syncConfigurationGeneration = useRef(0);
    const dropboxOperationGeneration = useRef(0);
    const [calendarFeedUrl, setCalendarFeedUrl] = useState<string | null>(null);
    const [calendarFeedBusy, setCalendarFeedBusy] = useState(false);
    const [calendarFeedReloadToken, setCalendarFeedReloadToken] = useState(0);
    const [dropboxAppKey, setDropboxAppKey] = useState('');
    const [dropboxConfigured, setDropboxConfigured] = useState(false);
    const [dropboxConnected, setDropboxConnected] = useState(false);
    const [dropboxCredentialHandle, setDropboxCredentialHandle] = useState<string | null>(
        () => SyncService.getPendingDropboxCredentialHandleForSession(),
    );
    const dropboxCredentialHandleRef = useRef<string | null>(dropboxCredentialHandle);
    const [dropboxBusy, setDropboxBusy] = useState(false);
    const [dropboxAuthInProgress, setDropboxAuthInProgress] = useState(false);
    const [dropboxRedirectUri, setDropboxRedirectUri] = useState('http://127.0.0.1:53682/oauth/dropbox/callback');
    const [dropboxTestState, setDropboxTestState] = useState<DropboxTestState>('idle');
    const [snapshots, setSnapshots] = useState<string[]>([]);
    const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
    const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);
    const [transferAction, setTransferAction] = useState<null | 'export' | 'restore' | 'merge' | 'import'>(null);
    const showToast = useUiStore((state) => state.showToast);
    const settings = useTaskStore((state) => state.settings) ?? ({} as AppData['settings']);
    const updateSettings = useTaskStore((state) => state.updateSettings);
    const { t } = useLanguage();

    const advanceSyncConfigurationGeneration = useCallback((): number => {
        syncConfigurationGeneration.current += 1;
        return syncConfigurationGeneration.current;
    }, []);

    const formatSyncPathError = useCallback((message?: string): string => {
        const normalized = (message || '').toLowerCase();
        if (normalized.includes('must be a directory')) {
            return 'Select a folder for sync, not a backup JSON file.';
        }
        if (normalized.includes('permission denied') || normalized.includes('operation not permitted')) {
            return 'Mindwtr cannot access this folder. Choose a folder you own, then try again.';
        }
        return message || 'Failed to save sync folder.';
    }, []);

    const toErrorMessage = useCallback((error: unknown, fallback: string): string => {
        if (error instanceof Error && error.message.trim()) return error.message.trim();
        const text = String(error || '').trim();
        return text || fallback;
    }, []);

    const resolveText = useCallback((key: string, fallback: string): string => {
        return translateWithFallback(t, key, fallback);
    }, [t]);

    const isManualInsecureOverride = useCallback((url: string, allowInsecureHttp: boolean): boolean => {
        if (!allowInsecureHttp) return false;
        try {
            if (new URL(url).protocol !== 'http:') return false;
        } catch {
            return false;
        }
        return !isConnectionAllowed(url, SYNC_LOCAL_INSECURE_URL_OPTIONS);
    }, []);

    const validateSyncHttpUrl = useCallback((url: string, allowInsecureHttp: boolean): boolean => {
        if (!isValidHttpUrl(url)) {
            const message = 'Enter a valid http(s) URL.';
            setSyncError(message);
            showToast(message, 'error');
            return false;
        }
        if (!isConnectionAllowed(url, {
            ...SYNC_LOCAL_INSECURE_URL_OPTIONS,
            allowInsecureHttp,
        })) {
            const message = 'Public HTTP sync URLs are blocked. Use HTTPS, or enable insecure HTTP only for a trusted private network.';
            setSyncError(message);
            showToast(message, 'error');
            return false;
        }
        if (isManualInsecureOverride(url, allowInsecureHttp)) {
            showToast('Only use insecure HTTP on trusted networks. Sync data will be sent unencrypted.', 'info');
        }
        return true;
    }, [isManualInsecureOverride, showToast]);

    // An empty token field means "unchanged, use keyring" (#899) and must never be
    // validated or blocked; only a non-empty token that fails the shape check is rejected.
    const validateCloudToken = useCallback((token: string): boolean => {
        if (!token) return true;
        if (!isValidCloudSyncToken(token)) {
            const message = 'Sync token must be 20-512 characters using letters, numbers, or . _ ~ + / = -';
            setSyncError(message);
            showToast(message, 'error');
            return false;
        }
        return true;
    }, [showToast]);

    const formatText = useCallback((
        key: string,
        fallback: string,
        replacements: Record<string, string | number>,
    ): string => {
        let text = resolveText(key, fallback);
        Object.entries(replacements).forEach(([name, value]) => {
            text = text.split(`{{${name}}}`).join(String(value));
        });
        return text;
    }, [resolveText]);

    const formatImportDiagnosticText = useCallback((diagnostic: ImportDiagnostic): string => (
        formatImportDiagnostic(diagnostic, (key, values = {}) => formatText(
            key,
            IMPORT_DIAGNOSTIC_FALLBACKS[key] ?? IMPORT_DIAGNOSTIC_FALLBACKS['settings.importDiagnostics.cannotRead'],
            values,
        ))
    ), [formatText]);
    const formatImportMessages = useCallback((messages: readonly string[]): string[] => (
        createImportDiagnostics(messages, 'warning').map(formatImportDiagnosticText)
    ), [formatImportDiagnosticText]);
    const formatImportError = useCallback((diagnostics: readonly ImportDiagnostic[], fallback: string): string => {
        const diagnostic = diagnostics.find((item) => item.severity === 'error');
        return diagnostic ? formatImportDiagnosticText(diagnostic) : fallback;
    }, [formatImportDiagnosticText]);

    useEffect(() => {
        markSettingsOpenTrace('sync-settings-effect');
        const unsubscribe = SyncService.subscribeSyncStatus(setSyncStatus);
        const loadSnapshots = async () => {
            if (!isTauri) return;
            setIsLoadingSnapshots(true);
            try {
                setSnapshots(await measureSettingsOpenStep('sync-load-snapshots', () => SyncService.listDataSnapshots()));
            } finally {
                setIsLoadingSnapshots(false);
            }
        };
        const configurationLoadGeneration = syncConfigurationGeneration.current;
        measureSettingsOpenStep(
            'sync-load-configuration',
            () => SyncService.getPersistedSyncConfigurationSnapshot(),
        )
            .then((configuration) => {
                // Baselines always describe the durable configuration. Editor
                // values are only initialized if the user has not changed them
                // while this queue-serialized snapshot was waiting.
                setPersistedSyncBackend(configuration.backend);
                setPersistedCloudProvider(configuration.cloudProvider);
                if (syncConfigurationGeneration.current !== configurationLoadGeneration) return;
                setSyncPath(configuration.syncPath);
                setSyncBackend(configuration.backend);
                setWebdavUrl(configuration.webdav.url);
                setWebdavUsername(configuration.webdav.username);
                setWebdavPassword(configuration.webdav.password ?? '');
                setWebdavHasPassword(configuration.webdav.hasPassword === true);
                setWebdavAllowInsecureHttp(configuration.webdav.allowInsecureHttp === true);
                setCloudUrl(configuration.cloud.url);
                setCloudToken(configuration.cloud.token ?? '');
                setCloudRememberToken(configuration.cloud.rememberToken === true);
                setCloudAllowInsecureHttp(configuration.cloud.allowInsecureHttp === true);
                setCloudProvider(configuration.cloudProvider);
            })
            .catch((error) => {
                setSyncError('Failed to load sync configuration.');
                void logError(error, { scope: 'sync', step: 'loadConfiguration' });
            });
        measureSettingsOpenStep('sync-load-dropbox-app-key', () => SyncService.getDropboxAppKey())
            .then((value) => {
                const trimmed = value.trim();
                setDropboxAppKey(trimmed);
                setDropboxConfigured(Boolean(trimmed));
            })
            .catch((error) => {
                setDropboxConfigured(false);
                setSyncError('Failed to load Dropbox app key.');
                void logError(error, { scope: 'sync', step: 'loadDropboxAppKey' });
            });
        measureSettingsOpenStep('sync-load-dropbox-redirect-uri', () => SyncService.getDropboxRedirectUri())
            .then(setDropboxRedirectUri)
            .catch((error) => {
                void logError(error, { scope: 'sync', step: 'loadDropboxRedirectUri' });
            });
        loadSnapshots().catch((error) => {
            void logError(error, { scope: 'sync', step: 'loadSnapshots' });
        });
        return unsubscribe;
    }, [isTauri]);

    useEffect(() => {
        let cancelled = false;
        const loadDropboxConnection = async () => {
            if (dropboxCredentialHandle) {
                if (!cancelled) setDropboxConnected(true);
                return;
            }
            const appKey = dropboxAppKey.trim();
            if (!appKey) {
                if (!cancelled) {
                    setDropboxConnected(false);
                    setDropboxTestState('idle');
                }
                return;
            }
            try {
                const connected = await SyncService.isDropboxConnected(appKey);
                if (!cancelled) {
                    setDropboxConnected(connected);
                    if (!connected) {
                        setDropboxTestState('idle');
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    setDropboxConnected(false);
                    setDropboxTestState('idle');
                }
                void logError(error, { scope: 'sync', step: 'loadDropboxConnected' });
            }
        };
        void loadDropboxConnection();
        return () => {
            cancelled = true;
        };
    }, [dropboxAppKey, dropboxCredentialHandle]);

    useEffect(() => {
        const unsubscribe = SyncService.subscribePendingDropboxCredentialHandleForSession((credentialHandle) => {
            dropboxCredentialHandleRef.current = credentialHandle;
            setDropboxCredentialHandle(credentialHandle);
        });
        void SyncService.retryPendingDropboxCredentialFinalizationForSession()
            .catch((error) => {
                void logError(error, { scope: 'sync', step: 'retryDropboxCredentialFinalizationOnMount' });
            });
        return unsubscribe;
    }, []);

    useEffect(() => () => {
        const credentialHandle = dropboxCredentialHandleRef.current;
        if (credentialHandle) {
            void SyncService.resolvePendingDropboxCredentialForSession(credentialHandle)
                .then(() => {
                    // The service owns lifecycle serialization; the explicit
                    // forget remains idempotent for mocked adapters.
                    SyncService.forgetPendingDropboxCredentialHandleForSession(credentialHandle);
                })
                .catch((error) => {
                    // Keep the session-owned handle on uncertain double failure
                    // so a remounted settings view can retry recovery.
                    void logError(error, { scope: 'sync', step: 'resolveDropboxCredentialOnUnmount' });
                });
        }
    }, []);

    useEffect(() => {
        setWebdavTestState('idle');
    }, [webdavUrl, webdavUsername, webdavPassword]);

    // Only the self-hosted server publishes a feed, so this stays off the wire
    // for every other backend. It reads the saved config (not the typed URL), so
    // it must not re-run per keystroke — handleSaveCloud refreshes it instead.
    useEffect(() => {
        if (
            syncBackend !== 'cloud'
            || cloudProvider !== 'selfhosted'
            || persistedSyncBackend !== 'cloud'
            || persistedCloudProvider !== 'selfhosted'
        ) {
            setCalendarFeedUrl(null);
            return;
        }
        let cancelled = false;
        void SyncService.requestCalendarFeed('read')
            .then((result) => {
                if (!cancelled) setCalendarFeedUrl(result.url);
            })
            .catch((error) => {
                // An unreachable or pre-feed server just means "nothing published yet";
                // the explicit Generate action is where a real failure surfaces.
                if (!cancelled) setCalendarFeedUrl(null);
                void logError(error, { scope: 'sync', step: 'loadCalendarFeed' });
            });
        return () => {
            cancelled = true;
        };
    }, [cloudProvider, persistedCloudProvider, persistedSyncBackend, syncBackend, calendarFeedReloadToken]);

    const handleCalendarFeedAction = useCallback(async (action: 'rotate' | 'revoke') => {
        setCalendarFeedBusy(true);
        try {
            const result = await SyncService.requestCalendarFeed(action);
            setCalendarFeedUrl(result.url);
            setSyncError(null);
            showToast(
                action === 'rotate' ? 'Calendar feed URL generated.' : 'Calendar feed revoked.',
                'success',
            );
        } catch (error) {
            const message = toErrorMessage(error, 'Calendar feed request failed.');
            setSyncError(message);
            showToast(message, 'error');
        } finally {
            setCalendarFeedBusy(false);
        }
    }, [showToast, toErrorMessage]);

    const handleCopyCalendarFeedUrl = useCallback(async () => {
        if (!calendarFeedUrl) return;
        try {
            await navigator.clipboard.writeText(calendarFeedUrl);
            showToast('Subscription URL copied.', 'success');
        } catch {
            showToast('Could not copy the subscription URL.', 'error');
        }
    }, [calendarFeedUrl, showToast]);

    const handleSaveSyncPath = useCallback(async () => {
        if (!syncPath.trim()) return;
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setSyncPath(syncPath.trim());
        setSyncError(null);
        showToast('Sync folder ready. Sync now to verify and save it.', 'info');
    }, [advanceSyncConfigurationGeneration, showToast, syncPath]);

    const handleChangeSyncLocation = useCallback(async () => {
        try {
            if (!isTauri) return;

            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({
                directory: true,
                multiple: false,
                title: selectSyncFolderTitle,
            });

            if (selected && typeof selected === 'string') {
                advanceSyncConfigurationGeneration();
                hasPendingSyncConfiguration.current = true;
                setSyncPath(selected);
                setSyncError(null);
                showToast('Sync folder ready. Sync now to verify and save it.', 'info');
            }
        } catch (error) {
            setSyncError('Failed to change sync location.');
            void logError(error, { scope: 'sync', step: 'changeLocation' });
        }
    }, [advanceSyncConfigurationGeneration, isTauri, selectSyncFolderTitle, showToast]);

    const clearLocalDropboxCredentialHandle = useCallback((expectedHandle?: string) => {
        if (expectedHandle && dropboxCredentialHandleRef.current !== expectedHandle) return;
        SyncService.forgetPendingDropboxCredentialHandleForSession(expectedHandle);
        dropboxCredentialHandleRef.current = null;
        setDropboxCredentialHandle(null);
    }, []);

    const discardDropboxCredential = useCallback(async (
        credentialHandle: string | null,
        options: {
            refreshDurableConnection?: boolean;
            expectedGeneration?: number;
        } = {},
    ): Promise<boolean> => {
        let credentialResolved = true;
        if (credentialHandle) {
            try {
                await SyncService.resolvePendingDropboxCredentialForSession(credentialHandle);
                clearLocalDropboxCredentialHandle(credentialHandle);
            } catch (error) {
                credentialResolved = false;
                void logError(error, { scope: 'sync', step: 'resolveDropboxCredential' });
            }
        }
        if (options.refreshDurableConnection) {
            const appKey = dropboxAppKey.trim();
            const connected = appKey
                ? await SyncService.isDropboxConnected(appKey)
                : false;
            if (
                options.expectedGeneration === undefined
                || syncConfigurationGeneration.current === options.expectedGeneration
            ) {
                setDropboxConnected(connected);
            }
        }
        return credentialResolved;
    }, [clearLocalDropboxCredentialHandle, dropboxAppKey]);

    const discardPendingDropboxCredential = useCallback((
        options: {
            refreshDurableConnection?: boolean;
            expectedGeneration?: number;
        } = {},
    ): Promise<boolean> => discardDropboxCredential(
        dropboxCredentialHandleRef.current,
        options,
    ), [discardDropboxCredential]);

    const handleSetSyncBackend = useCallback(async (backend: SyncBackend) => {
        addBreadcrumb(`settings:syncBackend:${backend}`);
        const mutationGeneration = advanceSyncConfigurationGeneration();
        if (backend !== 'cloud' && dropboxCredentialHandleRef.current) {
            const discarded = await discardPendingDropboxCredential({
                refreshDurableConnection: true,
                expectedGeneration: mutationGeneration,
            });
            if (syncConfigurationGeneration.current !== mutationGeneration) return;
            if (!discarded) {
                setSyncError(DROPBOX_CREDENTIAL_CLEANUP_ERROR);
                return;
            }
        }
        if (backend !== 'off') {
            if (backend !== persistedSyncBackend) {
                hasPendingSyncConfiguration.current = true;
            }
            setSyncBackend(backend);
            setSyncError(null);
            return;
        }
        hasPendingSyncConfiguration.current = true;
        try {
            await SyncService.setSyncBackend(backend);
            setPersistedSyncBackend(backend);
            if (syncConfigurationGeneration.current === mutationGeneration) {
                hasPendingSyncConfiguration.current = false;
                setSyncBackend(backend);
                setSyncError(null);
                showSaved();
            }
        } catch (error) {
            setSyncError(toErrorMessage(error, 'Failed to save sync backend.'));
        }
    }, [
        advanceSyncConfigurationGeneration,
        discardPendingDropboxCredential,
        persistedSyncBackend,
        showSaved,
        toErrorMessage,
    ]);

    const handleSaveWebDav = useCallback(async () => {
        const trimmedUrl = webdavUrl.trim();
        const trimmedPassword = webdavPassword.trim();
        if (trimmedUrl && !validateSyncHttpUrl(trimmedUrl, webdavAllowInsecureHttp)) return;
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setIsSavingWebDav(true);
        try {
            setWebdavUrl(trimmedUrl);
            setWebdavUsername(webdavUsername.trim());
            if (!trimmedUrl) {
                setWebdavHasPassword(false);
                setWebdavPassword('');
            } else if (trimmedPassword) {
                setWebdavHasPassword(true);
            }
            setSyncError(null);
            showToast('WebDAV settings ready. Sync now to verify and save them.', 'info');
        } finally {
            setIsSavingWebDav(false);
        }
    }, [
        advanceSyncConfigurationGeneration,
        showToast,
        validateSyncHttpUrl,
        webdavAllowInsecureHttp,
        webdavPassword,
        webdavUrl,
        webdavUsername,
    ]);

    const handleTestWebDavConnection = useCallback(async () => {
        const trimmedUrl = webdavUrl.trim();
        if (!trimmedUrl) {
            const message = 'Enter a WebDAV URL first.';
            setWebdavTestState('error');
            setSyncError(message);
            showToast(message, 'error');
            return;
        }
        if (!validateSyncHttpUrl(trimmedUrl, webdavAllowInsecureHttp)) return;

        setIsTestingWebDav(true);
        try {
            await SyncService.testWebDavConnection({
                url: trimmedUrl,
                username: webdavUsername.trim(),
                password: webdavPassword,
                hasPassword: webdavHasPassword,
                allowInsecureHttp: webdavAllowInsecureHttp,
            });
            setWebdavTestState('success');
            setSyncError(null);
            showToast('WebDAV endpoint is reachable.', 'success');
        } catch (error) {
            const message = toErrorMessage(error, 'WebDAV connection failed.');
            setWebdavTestState('error');
            setSyncError(message);
            showToast(message, 'error');
        } finally {
            setIsTestingWebDav(false);
        }
    }, [showToast, toErrorMessage, validateSyncHttpUrl, webdavAllowInsecureHttp, webdavHasPassword, webdavPassword, webdavUrl, webdavUsername]);

    const handleSaveCloud = useCallback(async () => {
        const trimmedUrl = cloudUrl.trim();
        const trimmedToken = cloudToken.trim();
        if (trimmedUrl && !validateSyncHttpUrl(trimmedUrl, cloudAllowInsecureHttp)) return;
        if (!validateCloudToken(trimmedToken)) return;
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setCloudUrl(trimmedUrl);
        setCloudToken(trimmedToken);
        setSyncError(null);
        showToast('Self-hosted settings ready. Sync now to verify and save them.', 'info');
    }, [
        advanceSyncConfigurationGeneration,
        cloudAllowInsecureHttp,
        cloudUrl,
        cloudToken,
        showToast,
        validateCloudToken,
        validateSyncHttpUrl,
    ]);

    const handleSetCloudProvider = useCallback(async (provider: CloudProvider) => {
        const mutationGeneration = advanceSyncConfigurationGeneration();
        if (provider !== 'dropbox' && dropboxCredentialHandleRef.current) {
            const discarded = await discardPendingDropboxCredential({
                refreshDurableConnection: true,
                expectedGeneration: mutationGeneration,
            });
            if (syncConfigurationGeneration.current !== mutationGeneration) return;
            if (!discarded) {
                setSyncError(DROPBOX_CREDENTIAL_CLEANUP_ERROR);
                return;
            }
        }
        if (provider !== persistedCloudProvider) {
            hasPendingSyncConfiguration.current = true;
        }
        setCloudProvider(provider);
        if (provider !== 'dropbox') {
            setDropboxTestState('idle');
            setDropboxAuthInProgress(false);
        }
    }, [advanceSyncConfigurationGeneration, discardPendingDropboxCredential, persistedCloudProvider]);

    const handleConnectDropbox = useCallback(async () => {
        const appKey = dropboxAppKey.trim();
        if (!appKey) {
            showToast('Dropbox app key is not configured in this build.', 'error');
            return;
        }
        const connectGeneration = advanceSyncConfigurationGeneration();
        const connectOperation = ++dropboxOperationGeneration.current;
        setDropboxAuthInProgress(true);
        setDropboxBusy(true);
        try {
            const discarded = await discardPendingDropboxCredential();
            if (!discarded) throw new Error(DROPBOX_CREDENTIAL_CLEANUP_ERROR);
            if (syncConfigurationGeneration.current !== connectGeneration) return;
            const credentialHandle = await SyncService.connectDropbox(appKey);
            if (syncConfigurationGeneration.current !== connectGeneration) {
                await discardDropboxCredential(credentialHandle, {
                    refreshDurableConnection: true,
                    expectedGeneration: connectGeneration,
                });
                return;
            }
            SyncService.rememberPendingDropboxCredentialHandleForSession(credentialHandle);
            dropboxCredentialHandleRef.current = credentialHandle;
            setDropboxCredentialHandle(credentialHandle);
            setDropboxConnected(true);
            setDropboxTestState('idle');
            hasPendingSyncConfiguration.current = true;
            setSyncError(null);
            showToast('Dropbox authorization ready. Sync now to verify and save it.', 'info');
        } catch (error) {
            if (syncConfigurationGeneration.current !== connectGeneration) return;
            const message = toErrorMessage(error, 'Failed to connect Dropbox.');
            let connected = false;
            try {
                connected = await SyncService.isDropboxConnected(appKey);
            } catch (statusError) {
                void logError(statusError, { scope: 'sync', step: 'refreshDropboxConnectedAfterConnectFailure' });
            }
            if (syncConfigurationGeneration.current !== connectGeneration) return;
            setDropboxConnected(connected);
            setDropboxTestState('error');
            setSyncError(message);
            showToast(message, 'error');
        } finally {
            if (dropboxOperationGeneration.current === connectOperation) {
                setDropboxAuthInProgress(false);
                setDropboxBusy(false);
            }
        }
    }, [
        advanceSyncConfigurationGeneration,
        discardDropboxCredential,
        discardPendingDropboxCredential,
        dropboxAppKey,
        showToast,
        toErrorMessage,
    ]);

    const handleDisconnectDropbox = useCallback(async () => {
        const appKey = dropboxAppKey.trim();
        if (!appKey) {
            setDropboxConnected(false);
            setDropboxTestState('idle');
            return;
        }
        const disconnectGeneration = advanceSyncConfigurationGeneration();
        const disconnectOperation = ++dropboxOperationGeneration.current;
        setDropboxAuthInProgress(false);
        setDropboxBusy(true);
        try {
            await discardPendingDropboxCredential();
            if (syncConfigurationGeneration.current !== disconnectGeneration) return;
            await SyncService.disconnectDropbox(appKey);
            const persisted = await SyncService.getPersistedSyncConfigurationSnapshot();
            // Baselines always follow durable state, even if a newer editor
            // intent arrived while disconnect was queued. Only the editor/UI
            // projection is generation guarded.
            setPersistedSyncBackend(persisted.backend);
            setPersistedCloudProvider(persisted.cloudProvider);
            if (syncConfigurationGeneration.current !== disconnectGeneration) return;
            clearLocalDropboxCredentialHandle();
            setSyncBackend(persisted.backend);
            setCloudProvider(persisted.cloudProvider);
            hasPendingSyncConfiguration.current = false;
            setDropboxConnected(false);
            setDropboxTestState('idle');
            setSyncError(null);
            showToast('Disconnected from Dropbox.', 'success');
        } catch (error) {
            if (syncConfigurationGeneration.current !== disconnectGeneration) return;
            const message = toErrorMessage(error, 'Failed to disconnect Dropbox.');
            setDropboxTestState('error');
            setSyncError(message);
            showToast(message, 'error');
        } finally {
            if (dropboxOperationGeneration.current === disconnectOperation) {
                setDropboxBusy(false);
            }
        }
    }, [
        advanceSyncConfigurationGeneration,
        clearLocalDropboxCredentialHandle,
        discardPendingDropboxCredential,
        dropboxAppKey,
        showToast,
        toErrorMessage,
    ]);

    const handleTestDropboxConnection = useCallback(async () => {
        const appKey = dropboxAppKey.trim();
        if (!appKey) {
            showToast('Dropbox app key is not configured in this build.', 'error');
            return;
        }
        setDropboxBusy(true);
        try {
            const credentialHandle = dropboxCredentialHandleRef.current;
            const connected = credentialHandle
                ? true
                : await SyncService.isDropboxConnected(appKey);
            if (!connected) {
                setDropboxConnected(false);
                setDropboxTestState('error');
                showToast('Connect Dropbox first.', 'error');
                return;
            }
            await SyncService.testDropboxConnection(appKey, {
                credentialHandle: credentialHandle ?? undefined,
            });
            setDropboxConnected(true);
            setDropboxTestState('success');
            showToast('Dropbox account is reachable.', 'success');
        } catch (error) {
            const message = toErrorMessage(error, 'Dropbox connection failed.');
            setDropboxConnected(Boolean(dropboxCredentialHandleRef.current));
            setDropboxTestState('error');
            setSyncError(message);
            showToast(message, 'error');
        } finally {
            setDropboxBusy(false);
        }
    }, [dropboxAppKey, showToast, toErrorMessage]);

    const commitProvenSyncConfiguration = useCallback(async (
        config: DesktopSyncConfigOverride,
        activationGeneration: number,
    ): Promise<boolean> => {
        let commitResult: Awaited<ReturnType<typeof SyncService.commitProvenSyncConfiguration>>;
        try {
            commitResult = await SyncService.commitProvenSyncConfiguration(config);
        } catch (error) {
            if (config.backend === 'file') {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(formatSyncPathError(message));
            }
            throw error;
        }
        if (config.dropboxCredentialHandle && commitResult?.handleFinalized !== false) {
            clearLocalDropboxCredentialHandle(config.dropboxCredentialHandle);
        }
        // These fields describe durable state, even when a newer editor change
        // arrived while the transaction was in flight.
        setPersistedSyncBackend(config.backend);
        if (config.backend === 'cloud') {
            setPersistedCloudProvider(config.cloudProvider ?? 'selfhosted');
        }
        if (syncConfigurationGeneration.current !== activationGeneration) {
            hasPendingSyncConfiguration.current = true;
            return false;
        }
        if (config.backend === 'webdav' && config.webdav) {
            setWebdavHasPassword(Boolean(config.webdav.password?.trim()) || config.webdav.hasPassword === true);
        }
        hasPendingSyncConfiguration.current = false;
        showSaved();
        if (config.backend === 'cloud' && config.cloudProvider === 'selfhosted') {
            setCalendarFeedReloadToken((token) => token + 1);
        }
        return true;
    }, [clearLocalDropboxCredentialHandle, formatSyncPathError, showSaved]);

    const handleSync = useCallback(async () => {
        const activationGeneration = syncConfigurationGeneration.current;
        const activationCredentialHandle = dropboxCredentialHandleRef.current;
        const resolveCapturedCredential = async () => {
            if (!activationCredentialHandle) return;
            await discardDropboxCredential(activationCredentialHandle, {
                refreshDurableConnection: true,
            });
        };
        addBreadcrumb('sync:manual');
        try {
            setSyncError(null);

            if (syncBackend === 'off') {
                return;
            }
            const configOverride: DesktopSyncConfigOverride = { backend: syncBackend };
            if (syncBackend === 'webdav') {
                const url = webdavUrl.trim();
                if (!url || !validateSyncHttpUrl(url, webdavAllowInsecureHttp)) return;
                configOverride.webdav = {
                    url,
                    username: webdavUsername.trim(),
                    password: webdavPassword.trim() || undefined,
                    hasPassword: webdavHasPassword,
                    allowInsecureHttp: webdavAllowInsecureHttp,
                };
            }
            if (syncBackend === 'cloud') {
                configOverride.cloudProvider = cloudProvider;
                if (cloudProvider === 'selfhosted') {
                    const url = cloudUrl.trim();
                    const token = cloudToken.trim();
                    if (!url || !validateSyncHttpUrl(url, cloudAllowInsecureHttp)) return;
                    if (!validateCloudToken(token)) return;
                    configOverride.cloud = {
                        url,
                        token,
                        rememberToken: !isTauri && cloudRememberToken,
                        allowInsecureHttp: cloudAllowInsecureHttp,
                    };
                } else {
                    const appKey = dropboxAppKey.trim();
                    if (!appKey) {
                        const message = 'Dropbox app key is not configured in this build.';
                        setSyncError(message);
                        showToast(message, 'error');
                        return;
                    }
                    const credentialHandle = activationCredentialHandle;
                    if (credentialHandle) {
                        configOverride.dropboxCredentialHandle = credentialHandle;
                    }
                    const connected = credentialHandle
                        ? true
                        : await SyncService.isDropboxConnected(appKey);
                    if (!connected) {
                        const message = 'Connect Dropbox first.';
                        setSyncError(message);
                        showToast(message, 'error');
                        setDropboxConnected(false);
                        return;
                    }
                    setDropboxConnected(true);
                }
            }
            if (syncBackend === 'file') {
                const path = syncPath.trim();
                if (!path) return;
                configOverride.syncPath = path;
            }

            if (syncConfigurationGeneration.current !== activationGeneration) {
                await resolveCapturedCredential();
                return;
            }

            const needsActivationProbe = hasPendingSyncConfiguration.current
                || Boolean(configOverride.dropboxCredentialHandle)
                || configOverride.backend !== persistedSyncBackend
                || (
                    configOverride.backend === 'cloud'
                    && configOverride.cloudProvider !== persistedCloudProvider
                );
            if (needsActivationProbe) {
                const probeResult = await SyncService.performSync({
                    activationProbe: true,
                    configOverride,
                    manual: true,
                });
                if (probeResult.skipped === 'requeued') {
                    if (configOverride.dropboxCredentialHandle) {
                        await resolveCapturedCredential();
                    }
                    showToast('Local changes arrived during sync. Try Sync now again.', 'info');
                    return;
                }
                if (
                    !probeResult.success
                    || probeResult.remoteWriteDeferred
                    || probeResult.skipped === 'offline'
                    || probeResult.skipped === 'pendingRemoteWriteBackoff'
                ) {
                    if (configOverride.dropboxCredentialHandle) {
                        await resolveCapturedCredential();
                    }
                    showToast(probeResult.error || 'Sync setup could not be verified. Your previous sync settings are still active.', 'error');
                    return;
                }
                if (syncConfigurationGeneration.current !== activationGeneration) {
                    await resolveCapturedCredential();
                    return;
                }
                const committedCurrentConfiguration = await commitProvenSyncConfiguration(
                    configOverride,
                    activationGeneration,
                );
                if (!committedCurrentConfiguration) return;
            }

            const result = await SyncService.performSync({
                manual: true,
                ignorePendingRemoteWriteBackoff: needsActivationProbe,
            });
            if (result.skipped === 'requeued') {
                showToast('Local changes arrived during sync. Retry queued.', 'info');
            } else if (
                result.success
                && !result.remoteWriteDeferred
                && result.skipped !== 'offline'
                && result.skipped !== 'pendingRemoteWriteBackoff'
            ) {
                const mergeSummary = summarizeMergeStats(result.stats);
                const maxClockSkewMs = mergeSummary.maxClockSkewMs;
                const timestampAdjustments = mergeSummary.timestampAdjustments;
                showToast('Sync completed', 'success');
                if (maxClockSkewMs > CLOCK_SKEW_THRESHOLD_MS) {
                    showToast(
                        `Large device clock skew detected during sync (${formatClockSkew(maxClockSkewMs)}). Check time settings on each device.`,
                        'info',
                        7000
                    );
                } else if (timestampAdjustments > 0) {
                    showToast(
                        `Adjusted ${timestampAdjustments} future-dated timestamp${timestampAdjustments === 1 ? '' : 's'} during sync. Check device clocks if this repeats.`,
                        'info',
                        7000
                    );
                }
                if (isTauri) {
                    setSnapshots(await SyncService.listDataSnapshots());
                }
            } else {
                showToast(result.error || 'Sync did not complete. Your previous sync settings are still active.', 'error');
            }
        } catch (error) {
            if (activationCredentialHandle) {
                await resolveCapturedCredential();
            }
            void logError(error, { scope: 'sync', step: 'perform' });
            const message = toErrorMessage(error, 'Sync failed');
            setSyncError(message);
            showToast(message, 'error');
        }
    }, [
        cloudProvider,
        cloudAllowInsecureHttp,
        cloudRememberToken,
        cloudToken,
        cloudUrl,
        commitProvenSyncConfiguration,
        discardDropboxCredential,
        discardPendingDropboxCredential,
        dropboxAppKey,
        isTauri,
        persistedCloudProvider,
        persistedSyncBackend,
        showToast,
        syncBackend,
        syncPath,
        toErrorMessage,
        validateCloudToken,
        validateSyncHttpUrl,
        webdavAllowInsecureHttp,
        webdavHasPassword,
        webdavPassword,
        webdavUrl,
        webdavUsername,
    ]);

    const handleSyncPathChange = useCallback((value: string) => {
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setSyncPath(value);
    }, [advanceSyncConfigurationGeneration]);
    const handleWebdavUrlChange = useCallback((value: string) => {
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setWebdavUrl(value);
    }, [advanceSyncConfigurationGeneration]);
    const handleWebdavUsernameChange = useCallback((value: string) => {
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setWebdavUsername(value);
    }, [advanceSyncConfigurationGeneration]);
    const handleWebdavPasswordChange = useCallback((value: string) => {
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setWebdavPassword(value);
    }, [advanceSyncConfigurationGeneration]);
    const handleWebdavAllowInsecureHttpChange = useCallback((value: boolean) => {
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setWebdavAllowInsecureHttp(value);
    }, [advanceSyncConfigurationGeneration]);
    const handleCloudUrlChange = useCallback((value: string) => {
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setCloudUrl(value);
    }, [advanceSyncConfigurationGeneration]);
    const handleCloudTokenChange = useCallback((value: string) => {
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setCloudToken(value);
    }, [advanceSyncConfigurationGeneration]);
    const handleCloudRememberTokenChange = useCallback((value: boolean) => {
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setCloudRememberToken(value);
    }, [advanceSyncConfigurationGeneration]);
    const handleCloudAllowInsecureHttpChange = useCallback((value: boolean) => {
        advanceSyncConfigurationGeneration();
        hasPendingSyncConfiguration.current = true;
        setCloudAllowInsecureHttp(value);
    }, [advanceSyncConfigurationGeneration]);

    const handleRestoreSnapshot = useCallback(async (snapshotFileName: string) => {
        if (!snapshotFileName) return false;
        addBreadcrumb('transfer:restore');
        setIsRestoringSnapshot(true);
        try {
            const result = await SyncService.restoreDataSnapshot(snapshotFileName);
            if (!result.success) {
                showToast(result.error || 'Failed to restore snapshot.', 'error');
                return false;
            }
            showToast('Snapshot restored.', 'success');
            setSnapshots(await SyncService.listDataSnapshots());
            return true;
        } finally {
            setIsRestoringSnapshot(false);
        }
    }, [showToast]);

    const handleExportBackup = useCallback(async () => {
        addBreadcrumb('transfer:export');
        setTransferAction('export');
        try {
            await exportDesktopBackup(getInMemoryAppDataSnapshot());
            showToast('Backup exported.', 'success');
        } catch (error) {
            showToast(toErrorMessage(error, 'Failed to export backup.'), 'error');
        } finally {
            setTransferAction(null);
        }
    }, [showToast, toErrorMessage]);

    const handleRestoreBackup = useCallback(async () => {
        addBreadcrumb('transfer:restore');
        setTransferAction('restore');
        try {
            const validation = await inspectDesktopBackup(appVersion);
            if (!validation) return;
            if (!validation.valid || !validation.data) {
                showToast(validation.errors[0] || 'Selected file is not a valid Mindwtr backup.', 'error');
                return;
            }

            const confirmed = await requestConfirmation({
                title: 'Restore backup?',
                message: buildBackupConfirmation(
                    validation,
                    'This will replace current local data. A recovery snapshot will be saved first when available.',
                ),
            });
            if (!confirmed) return;

            const { snapshotName } = await restoreDesktopBackup(validation.data);
            if (isTauri) {
                setSnapshots(await SyncService.listDataSnapshots());
            }
            showToast(snapshotName ? `Backup restored. Snapshot saved as ${snapshotName}.` : 'Backup restored.', 'success', 6000);
        } catch (error) {
            showToast(toErrorMessage(error, 'Failed to restore backup.'), 'error');
        } finally {
            setTransferAction(null);
        }
    }, [appVersion, isTauri, requestConfirmation, showToast, toErrorMessage]);

    const handleMergeBackup = useCallback(async () => {
        addBreadcrumb('transfer:restore');
        setTransferAction('merge');
        try {
            const validation = await inspectDesktopBackup(appVersion);
            if (!validation) return;
            if (!validation.valid || !validation.data) {
                showToast(validation.errors[0] || 'Selected file is not a valid Mindwtr backup.', 'error');
                return;
            }

            const confirmed = await requestConfirmation({
                title: resolveText('settings.mergeBackup', 'Merge Backup'),
                message: buildBackupConfirmation(
                    validation,
                    resolveText(
                        'settings.mergeBackupConfirm',
                        'Newer items from the backup are combined with your current data. Nothing local is removed, and items you deleted here stay deleted. A recovery snapshot is saved first when available.',
                    ),
                ),
            });
            if (!confirmed) return;

            const { snapshotName, result } = await mergeDesktopBackup(validation.data);
            if (isTauri) {
                setSnapshots(await SyncService.listDataSnapshots());
            }
            const merged = summarizeBackupMerge(result);
            const details = [
                formatText(
                    'settings.mergeBackupSummary',
                    '{{addedCount}} task(s) added, {{updatedCount}} updated.',
                    { addedCount: merged.added, updatedCount: merged.updated },
                ),
                snapshotName ? `Snapshot saved as ${snapshotName}.` : null,
            ].filter(Boolean).join('\n');
            showToast(details, 'success', 6000);
        } catch (error) {
            showToast(toErrorMessage(error, 'Failed to merge backup.'), 'error');
        } finally {
            setTransferAction(null);
        }
    }, [appVersion, formatText, isTauri, requestConfirmation, resolveText, showToast, toErrorMessage]);

    const handleImportTodoist = useCallback(async () => {
        addBreadcrumb('transfer:restore');
        setTransferAction('import');
        try {
            const parseResult = await inspectDesktopTodoistImport();
            if (!parseResult) return;
            if (!parseResult.valid || !parseResult.preview) {
                showToast(formatImportError(parseResult.diagnostics, 'The selected file is not a supported Todoist export.'), 'error');
                return;
            }

            const preview = parseResult.preview;
            const projectLines = preview.projects
                .slice(0, 4)
                .map((project: { name: string; taskCount: number }) => `- ${project.name}: ${project.taskCount}`);
            if (preview.projects.length > 4) {
                projectLines.push(`- ${preview.projects.length - 4} more project(s)...`);
            }

            const confirmed = await requestConfirmation({
                title: 'Import Todoist data?',
                message: [
                    `Import ${preview.taskCount} tasks from ${preview.projectCount} project(s)?`,
                    preview.sectionCount > 0 ? `${preview.sectionCount} section(s) will be preserved.` : null,
                    preview.checklistItemCount > 0 ? `${preview.checklistItemCount} subtask(s) will become checklist items.` : null,
                    'Imported tasks stay in Inbox so you can process them in Mindwtr.',
                    ...(projectLines.length > 0 ? ['', ...projectLines] : []),
                    ...(preview.warnings.length > 0 ? ['', ...formatImportMessages(preview.warnings)] : []),
                ].filter(Boolean).join('\n'),
            });
            if (!confirmed) return;

            const { snapshotName, result } = await importDesktopTodoistData(parseResult.parsedProjects);
            if (isTauri) {
                setSnapshots(await SyncService.listDataSnapshots());
            }
            const details = [
                formatText(
                    'settings.importTodoistSummary',
                    'Imported {{taskCount}} tasks into {{projectCount}} project(s).',
                    {
                        taskCount: result.importedTaskCount,
                        projectCount: result.importedProjectCount,
                    },
                ),
                result.importedChecklistItemCount > 0 ? `${result.importedChecklistItemCount} subtask(s) became checklist items.` : null,
                snapshotName ? `Snapshot saved as ${snapshotName}.` : null,
                ...(result.warnings.length > 0 ? ['', ...formatImportMessages(result.warnings)] : []),
            ].filter(Boolean).join('\n');
            showToast(details, 'success', 7000);
        } catch (error) {
            showToast(toErrorMessage(error, 'Failed to import Todoist data.'), 'error');
        } finally {
            setTransferAction(null);
        }
    }, [formatImportError, formatImportMessages, formatText, isTauri, requestConfirmation, showToast, toErrorMessage]);


    const handleImportTickTick = useCallback(async () => {
        addBreadcrumb('transfer:restore');
        setTransferAction('import');
        try {
            const parseResult = await inspectDesktopTickTickImport();
            if (!parseResult) return;
            if (!parseResult.valid || !parseResult.preview || !parseResult.parsedData) {
                showToast(formatImportError(parseResult.diagnostics, 'The selected file is not a supported TickTick backup.'), 'error');
                return;
            }

            const preview = parseResult.preview;
            const projectLines = preview.projects
                .slice(0, 4)
                .map((project: { areaName?: string; name: string; taskCount: number }) => `- ${project.areaName ? `${project.areaName} / ` : ''}${project.name}: ${project.taskCount}`);
            if (preview.projects.length > 4) {
                projectLines.push(`- ${preview.projects.length - 4} more project(s)...`);
            }

            const confirmed = await requestConfirmation({
                title: 'Import TickTick data?',
                message: [
                    `Import ${preview.taskCount} task(s) from ${preview.fileName}?`,
                    preview.areaCount > 0 ? `${preview.areaCount} area(s) will be created from TickTick folders.` : null,
                    preview.projectCount > 0 ? `${preview.projectCount} project(s) will be created from TickTick lists.` : null,
                    preview.checklistItemCount > 0 ? `${preview.checklistItemCount} checklist item(s) will be preserved.` : null,
                    preview.recurringCount > 0 ? `${preview.recurringCount} recurring task(s) will keep supported repeat rules.` : null,
                    'Imported active tasks stay in Inbox so you can process them in Mindwtr.',
                    ...(projectLines.length > 0 ? ['', ...projectLines] : []),
                    ...(preview.warnings.length > 0 ? ['', ...formatImportMessages(preview.warnings)] : []),
                ].filter(Boolean).join('\n'),
            });
            if (!confirmed) return;

            const { snapshotName, result } = await importDesktopTickTickData(parseResult.parsedData);
            if (isTauri) {
                setSnapshots(await SyncService.listDataSnapshots());
            }
            const details = [
                formatText(
                    'settings.importTickTickSummary',
                    'Imported {{taskCount}} task(s), {{projectCount}} project(s), and {{areaCount}} area(s).',
                    {
                        taskCount: result.importedTaskCount,
                        projectCount: result.importedProjectCount,
                        areaCount: result.importedAreaCount,
                    },
                ),
                result.importedChecklistItemCount > 0 ? `${result.importedChecklistItemCount} checklist item(s) were preserved.` : null,
                snapshotName ? `Snapshot saved as ${snapshotName}.` : null,
                ...(result.warnings.length > 0 ? ['', ...formatImportMessages(result.warnings)] : []),
            ].filter(Boolean).join('\n');
            showToast(details, 'success', 8000);
        } catch (error) {
            showToast(toErrorMessage(error, 'Failed to import TickTick data.'), 'error');
        } finally {
            setTransferAction(null);
        }
    }, [formatImportError, formatImportMessages, formatText, isTauri, requestConfirmation, showToast, toErrorMessage]);

    const handleImportDgt = useCallback(async () => {
        addBreadcrumb('transfer:restore');
        setTransferAction('import');
        try {
            const parseResult = await inspectDesktopDgtImport();
            if (!parseResult) return;
            if (!parseResult.valid || !parseResult.preview || !parseResult.parsedData) {
                showToast(formatImportError(parseResult.diagnostics, 'The selected file is not a supported DGT GTD export.'), 'error');
                return;
            }

            const preview = parseResult.preview;
            const projectLines = preview.projects
                .slice(0, 4)
                .map((project: { areaName?: string; name: string; taskCount: number }) => `- ${project.areaName ? `${project.areaName} / ` : ''}${project.name}: ${project.taskCount}`);
            if (preview.projects.length > 4) {
                projectLines.push(`- ${preview.projects.length - 4} more project(s)...`);
            }

            const confirmed = await requestConfirmation({
                title: 'Import DGT GTD data?',
                message: [
                    `Import ${preview.taskCount} tasks from ${preview.fileName}?`,
                    preview.areaCount > 0 ? `${preview.areaCount} area(s) will be created from DGT folders.` : null,
                    preview.projectCount > 0 ? `${preview.projectCount} project(s) will be created.` : null,
                    preview.checklistItemCount > 0 ? `${preview.checklistItemCount} checklist item(s) will be preserved.` : null,
                    preview.standaloneTaskCount > 0
                        ? `${preview.standaloneTaskCount} task(s) will stay outside projects so you can process them in Mindwtr.`
                        : null,
                    ...(projectLines.length > 0 ? ['', ...projectLines] : []),
                    ...(preview.warnings.length > 0 ? ['', ...formatImportMessages(preview.warnings)] : []),
                ].filter(Boolean).join('\n'),
            });
            if (!confirmed) return;

            const { snapshotName, result } = await importDesktopDgtData(parseResult.parsedData);
            if (isTauri) {
                setSnapshots(await SyncService.listDataSnapshots());
            }
            const details = [
                formatText(
                    'settings.importDgtSummary',
                    'Imported {{taskCount}} task(s), {{projectCount}} project(s), and {{areaCount}} area(s).',
                    {
                        taskCount: result.importedTaskCount,
                        projectCount: result.importedProjectCount,
                        areaCount: result.importedAreaCount,
                    },
                ),
                result.importedChecklistItemCount > 0 ? `${result.importedChecklistItemCount} checklist item(s) were preserved.` : null,
                snapshotName ? `Snapshot saved as ${snapshotName}.` : null,
                ...(result.warnings.length > 0 ? ['', ...formatImportMessages(result.warnings)] : []),
            ].filter(Boolean).join('\n');
            showToast(details, 'success', 8000);
        } catch (error) {
            showToast(toErrorMessage(error, 'Failed to import DGT GTD data.'), 'error');
        } finally {
            setTransferAction(null);
        }
    }, [formatImportError, formatImportMessages, formatText, isTauri, requestConfirmation, showToast, toErrorMessage]);

    const handleImportOmniFocus = useCallback(async () => {
        addBreadcrumb('transfer:restore');
        setTransferAction('import');
        try {
            const parseResult = await inspectDesktopOmniFocusImport();
            if (!parseResult) return;
            if (!parseResult.valid || !parseResult.preview || !parseResult.parsedData) {
                showToast(formatImportError(parseResult.diagnostics, 'The selected file is not a supported OmniFocus export.'), 'error');
                return;
            }

            const preview = parseResult.preview;
            const projectLines = preview.projects
                .slice(0, 4)
                .map((project) => `- ${project.name}: ${project.taskCount}`);
            if (preview.projects.length > 4) {
                projectLines.push(`- ${preview.projects.length - 4} more project(s)...`);
            }

            const confirmed = await requestConfirmation({
                title: 'Import OmniFocus data?',
                message: [
                    `Import ${preview.taskCount} task(s) from ${preview.fileName}?`,
                    preview.projectCount > 0 ? `${preview.projectCount} project(s) will be created when needed.` : null,
                    preview.areaCount > 0 ? `${preview.areaCount} area(s) will be created from OmniFocus folders when needed.` : null,
                    preview.checklistItemCount > 0 ? `${preview.checklistItemCount} nested task(s) will become checklist items when possible.` : null,
                    preview.standaloneTaskCount > 0
                        ? `${preview.standaloneTaskCount} task(s) will stay outside projects so you can process them in Mindwtr.`
                        : null,
                    'Imported tasks keep OmniFocus notes, dates, tags, recurrence, and checklist children when supported.',
                    ...(projectLines.length > 0 ? ['', ...projectLines] : []),
                    ...(preview.warnings.length > 0 ? ['', ...formatImportMessages(preview.warnings)] : []),
                ].filter(Boolean).join('\n'),
            });
            if (!confirmed) return;

            const { snapshotName, result } = await importDesktopOmniFocusData(parseResult.parsedData);
            if (isTauri) {
                setSnapshots(await SyncService.listDataSnapshots());
            }
            const details = [
                formatText(
                    'settings.importOmniFocusSummary',
                    'Imported {{taskCount}} task(s) and {{projectCount}} project(s).',
                    {
                        taskCount: result.importedTaskCount,
                        projectCount: result.importedProjectCount,
                    },
                ),
                result.importedAreaCount > 0 ? `${result.importedAreaCount} area(s) were created from OmniFocus folders.` : null,
                result.importedChecklistItemCount > 0 ? `${result.importedChecklistItemCount} nested task(s) became checklist items.` : null,
                result.importedStandaloneTaskCount > 0 ? `${result.importedStandaloneTaskCount} task(s) stayed outside projects.` : null,
                snapshotName ? `Snapshot saved as ${snapshotName}.` : null,
                ...(result.warnings.length > 0 ? ['', ...formatImportMessages(result.warnings)] : []),
            ].filter(Boolean).join('\n');
            showToast(details, 'success', 8000);
        } catch (error) {
            showToast(toErrorMessage(error, 'Failed to import OmniFocus data.'), 'error');
        } finally {
            setTransferAction(null);
        }
    }, [formatImportError, formatImportMessages, formatText, isTauri, requestConfirmation, showToast, toErrorMessage]);

    const handleImportMindwtrCsv = useCallback(async () => {
        addBreadcrumb('transfer:restore');
        setTransferAction('import');
        try {
            const parseResult = await inspectDesktopMindwtrCsvImport();
            if (!parseResult) return;
            if (!parseResult.valid || !parseResult.preview || !parseResult.parsedData) {
                showToast(formatImportError(parseResult.diagnostics, 'The selected file is not a supported Mindwtr CSV file.'), 'error');
                return;
            }

            const preview = parseResult.preview;
            const projectLines = preview.projects
                .slice(0, 4)
                .map((project) => `- ${project.areaName ? `${project.areaName} / ` : ''}${project.name}: ${project.taskCount}`);
            if (preview.projects.length > 4) {
                projectLines.push(`- ${preview.projects.length - 4} more project(s)...`);
            }

            const confirmed = await requestConfirmation({
                title: 'Import Mindwtr CSV data?',
                message: [
                    `Import ${preview.taskCount} task(s) from ${preview.fileName}?`,
                    preview.areaCount > 0 ? `${preview.areaCount} area(s) will be created from the Area column.` : null,
                    preview.projectCount > 0 ? `${preview.projectCount} project(s) will be created from the Project column.` : null,
                    preview.sectionCount > 0 ? `${preview.sectionCount} section(s) will be created from the Section column.` : null,
                    preview.checklistItemCount > 0 ? `${preview.checklistItemCount} checklist item(s) will be preserved.` : null,
                    preview.standaloneTaskCount > 0
                        ? `${preview.standaloneTaskCount} task(s) will stay outside projects.`
                        : null,
                    ...(projectLines.length > 0 ? ['', ...projectLines] : []),
                    ...(preview.warnings.length > 0 ? ['', ...formatImportMessages(preview.warnings)] : []),
                ].filter(Boolean).join('\n'),
            });
            if (!confirmed) return;

            const { snapshotName, result } = await importDesktopMindwtrCsvData(parseResult.parsedData);
            if (isTauri) {
                setSnapshots(await SyncService.listDataSnapshots());
            }
            const details = [
                formatText(
                    'settings.importMindwtrCsvSummary',
                    'Imported {{taskCount}} task(s), {{projectCount}} project(s), {{sectionCount}} section(s), and {{areaCount}} area(s).',
                    {
                        taskCount: result.importedTaskCount,
                        projectCount: result.importedProjectCount,
                        sectionCount: result.importedSectionCount,
                        areaCount: result.importedAreaCount,
                    },
                ),
                result.importedChecklistItemCount > 0 ? `${result.importedChecklistItemCount} checklist item(s) were preserved.` : null,
                snapshotName ? `Snapshot saved as ${snapshotName}.` : null,
                ...(result.warnings.length > 0 ? ['', ...formatImportMessages(result.warnings)] : []),
            ].filter(Boolean).join('\n');
            showToast(details, 'success', 8000);
        } catch (error) {
            showToast(toErrorMessage(error, 'Failed to import Mindwtr CSV data.'), 'error');
        } finally {
            setTransferAction(null);
        }
    }, [formatImportError, formatImportMessages, formatText, isTauri, requestConfirmation, showToast, toErrorMessage]);

    const syncPreferences = settings?.syncPreferences ?? {};
    const handleUpdateSyncPreferences = useCallback(
        (updates: Partial<SyncPreferences>) => {
            updateSettings({ syncPreferences: { ...syncPreferences, ...updates } })
                .then(showSaved)
                .catch((error) => reportError('Failed to update sync preferences', error));
        },
        [syncPreferences, showSaved, updateSettings],
    );

    const lastSyncAt = settings?.lastSyncAt;
    const lastSyncStats = settings?.lastSyncStats ?? null;
    const lastSyncDisplay = lastSyncAt
        ? safeFormatDate(lastSyncAt, 'PPpp', lastSyncAt)
        : lastSyncNeverLabel;

    // Target validity used to live in SettingsSyncPage; it belongs next to the
    // state it validates so the page stays pure layout.
    const isMacOS = typeof navigator !== 'undefined'
        && /mac/i.test(`${navigator.platform || ''} ${navigator.userAgent || ''}`);
    const webdavUrlError = webdavUrl.trim() ? !isValidHttpUrl(webdavUrl.trim()) : false;
    const cloudUrlError = cloudUrl.trim() ? !isValidHttpUrl(cloudUrl.trim()) : false;
    const webdavConnectionAllowed = !webdavUrlError && webdavUrl.trim()
        ? isConnectionAllowed(webdavUrl.trim(), {
            ...SYNC_LOCAL_INSECURE_URL_OPTIONS,
            allowInsecureHttp: webdavAllowInsecureHttp,
        })
        : !webdavUrl.trim();
    const cloudConnectionAllowed = !cloudUrlError && cloudUrl.trim()
        ? isConnectionAllowed(cloudUrl.trim(), {
            ...SYNC_LOCAL_INSECURE_URL_OPTIONS,
            allowInsecureHttp: cloudAllowInsecureHttp,
        })
        : !cloudUrl.trim();
    const isSyncTargetValid =
        syncBackend === 'file'
            ? !!syncPath.trim()
            : syncBackend === 'cloudkit'
                ? true
                : syncBackend === 'webdav'
                    ? !!webdavUrl.trim() && !webdavUrlError && webdavConnectionAllowed
                    : syncBackend === 'cloud'
                        ? (cloudProvider === 'selfhosted'
                            ? !!cloudUrl.trim() && !cloudUrlError && cloudConnectionAllowed
                            : dropboxConfigured && !!dropboxAppKey.trim() && dropboxConnected)
                        : false;

    return {
        syncPageProps: {
            isTauri,
            isMacOS,
            syncBackend,
            onSetSyncBackend: handleSetSyncBackend,
            syncPath,
            onSyncPathChange: handleSyncPathChange,
            onSaveSyncPath: handleSaveSyncPath,
            onBrowseSyncPath: handleChangeSyncLocation,
            webdavUrl,
            webdavUsername,
            webdavPassword,
            webdavHasPassword,
            webdavAllowInsecureHttp,
            webdavUrlError,
            isSavingWebDav,
            isTestingWebDav,
            webdavTestState,
            onWebdavUrlChange: handleWebdavUrlChange,
            onWebdavUsernameChange: handleWebdavUsernameChange,
            onWebdavPasswordChange: handleWebdavPasswordChange,
            onWebdavAllowInsecureHttpChange: handleWebdavAllowInsecureHttpChange,
            onSaveWebDav: handleSaveWebDav,
            onTestWebDavConnection: handleTestWebDavConnection,
            cloudUrl,
            cloudUrlError,
            cloudToken,
            cloudRememberToken,
            cloudAllowInsecureHttp,
            cloudProvider,
            dropboxConfigured,
            dropboxConnected,
            dropboxBusy,
            dropboxAuthInProgress,
            dropboxRedirectUri,
            dropboxTestState,
            onCloudUrlChange: handleCloudUrlChange,
            onCloudTokenChange: handleCloudTokenChange,
            onCloudRememberTokenChange: handleCloudRememberTokenChange,
            onCloudAllowInsecureHttpChange: handleCloudAllowInsecureHttpChange,
            onCloudProviderChange: handleSetCloudProvider,
            onSaveCloud: handleSaveCloud,
            calendarFeedUrl,
            calendarFeedBusy,
            onCopyCalendarFeedUrl: handleCopyCalendarFeedUrl,
            onGenerateCalendarFeed: () => handleCalendarFeedAction('rotate'),
            onRevokeCalendarFeed: () => handleCalendarFeedAction('revoke'),
            onConnectDropbox: handleConnectDropbox,
            onDisconnectDropbox: handleDisconnectDropbox,
            onTestDropboxConnection: handleTestDropboxConnection,
            isSyncTargetValid,
            syncPreferences,
            onUpdateSyncPreferences: handleUpdateSyncPreferences,
            onSyncNow: handleSync,
            isSyncing: syncStatus.inFlight,
            syncQueued: syncStatus.queued,
            syncLastResult: syncStatus.lastResult,
            syncLastResultAt: syncStatus.lastResultAt,
            syncError,
            lastSyncDisplay,
            lastSyncStatus: settings?.lastSyncStatus,
            lastSyncStats,
            lastSyncHistory: settings?.lastSyncHistory ?? [],
            conflictCount: summarizeMergeStats(lastSyncStats).conflicts,
            lastSyncError: settings?.lastSyncError,
            snapshots,
            isLoadingSnapshots,
            isRestoringSnapshot,
            onRestoreSnapshot: handleRestoreSnapshot,
        } satisfies Omit<SettingsSyncPageProps, 't'>,
        dataTransferProps: {
            transferAction,
            onExportBackup: handleExportBackup,
            onRestoreBackup: handleRestoreBackup,
            onMergeBackup: handleMergeBackup,
            onImportTodoist: handleImportTodoist,
            onImportTickTick: handleImportTickTick,
            onImportDgt: handleImportDgt,
            onImportOmniFocus: handleImportOmniFocus,
            onImportMindwtrCsv: handleImportMindwtrCsv,
        } satisfies SettingsDataTransferProps,
    };
};
