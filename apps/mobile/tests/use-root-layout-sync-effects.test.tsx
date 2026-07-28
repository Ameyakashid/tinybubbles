import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRootLayoutSyncEffects } from '@/hooks/root-layout/use-root-layout-sync-effects';

const {
  abortMobileSync,
  appState,
  appStateListeners,
  asyncStorageGetItem,
  flushPendingSave,
  getInMemorySyncChangeFingerprint,
  getCalendarPushEnabled,
  hasActiveMobileNotificationFeature,
  performMobileSync,
  storeSubscribe,
  syncMobileBackgroundSyncRegistration,
  subscribeToCloudKitChanges,
  updateMobileWidgetFromStore,
} = vi.hoisted(() => ({
  abortMobileSync: vi.fn(() => true),
  appState: { currentState: 'active' },
  appStateListeners: new Set<(state: 'active' | 'background' | 'inactive') => void>(),
  asyncStorageGetItem: vi.fn(async () => 'cloud'),
  flushPendingSave: vi.fn(async () => undefined),
  getInMemorySyncChangeFingerprint: vi.fn(() => 'sync-change:initial'),
  getCalendarPushEnabled: vi.fn(async () => false),
  hasActiveMobileNotificationFeature: vi.fn(() => false),
  performMobileSync: vi.fn(async (): Promise<{ success: boolean; error?: string }> => ({ success: true })),
  storeSubscribe: vi.fn((..._args: unknown[]) => vi.fn()),
  syncMobileBackgroundSyncRegistration: vi.fn(async () => undefined),
  subscribeToCloudKitChanges: vi.fn(() => vi.fn()),
  updateMobileWidgetFromStore: vi.fn(async () => true),
}));

vi.mock('react-native', async () => {
  const actual = await vi.importActual<typeof import('react-native')>('react-native');
  return {
    ...actual,
    AppState: {
      get currentState() {
        return appState.currentState;
      },
      addEventListener: vi.fn((_event: string, listener: (state: 'active' | 'background' | 'inactive') => void) => {
        appStateListeners.add(listener);
        return {
          remove: () => appStateListeners.delete(listener),
        };
      }),
    },
    Platform: {
      ...actual.Platform,
      OS: 'android',
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageGetItem,
  },
}));

vi.mock('@mindwtr/core', async () => {
  // The real cooldown maths, not a stub: leaving it off the mock meant every
  // failed-sync path threw here, so no test could reach the cooldown at all.
  const { resolveSyncFailureCooldownMs } = await vi.importActual<typeof import('@mindwtr/core')>('@mindwtr/core');
  return {
    flushPendingSave,
    getInMemorySyncChangeFingerprint,
    resolveSyncFailureCooldownMs,
    useTaskStore: {
      getState: () => ({ settings: {} }),
      subscribe: storeSubscribe,
    },
  };
});

vi.mock('@/lib/notification-service', () => ({
  getNotificationPermissionStatus: vi.fn(async () => ({ granted: true })),
  startMobileNotifications: vi.fn(async () => undefined),
  stopMobileNotifications: vi.fn(async () => undefined),
}));

vi.mock('@/lib/calendar-push-sync', () => ({
  getCalendarPushEnabled,
  runFullCalendarSync: vi.fn(async () => undefined),
  startCalendarPushSync: vi.fn(() => vi.fn()),
  stopCalendarPushSync: vi.fn(),
}));

vi.mock('@/lib/sync-service', () => ({
  abortMobileSync,
  performMobileSync,
}));

vi.mock('@/lib/background-sync-task', () => ({
  syncMobileBackgroundSyncRegistration,
}));

vi.mock('@/lib/sync-service-utils', () => ({
  classifySyncFailure: vi.fn(() => 'generic'),
  coerceSupportedBackend: vi.fn((backend: string) => backend),
  isLikelyOfflineSyncError: vi.fn(() => false),
  resolveBackend: vi.fn((backend: string | null) => backend ?? 'off'),
}));

vi.mock('@/lib/cloudkit-sync', () => ({
  isCloudKitAvailable: vi.fn(() => false),
  subscribeToCloudKitChanges,
}));

vi.mock('@/lib/widget-service', () => ({
  updateMobileWidgetFromStore,
}));

vi.mock('@/lib/mobile-notification-settings', () => ({
  hasActiveMobileNotificationFeature,
}));

vi.mock('@/lib/app-log', () => ({
  logError: vi.fn(async () => undefined),
  logWarn: vi.fn(async () => undefined),
}));

function TestHarness() {
  useRootLayoutSyncEffects({
    resolveText: (_key, fallback) => fallback,
    openNotificationsSettings: vi.fn(),
    openSyncSettings: vi.fn(),
    showToast: vi.fn(),
  });
  return null;
}

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('useRootLayoutSyncEffects', () => {
  beforeEach(() => {
    abortMobileSync.mockClear();
    appState.currentState = 'active';
    appStateListeners.clear();
    asyncStorageGetItem.mockClear();
    asyncStorageGetItem.mockResolvedValue('cloud');
    getInMemorySyncChangeFingerprint.mockClear();
    getInMemorySyncChangeFingerprint.mockReturnValue('sync-change:initial');
    flushPendingSave.mockClear();
    getCalendarPushEnabled.mockClear();
    getCalendarPushEnabled.mockResolvedValue(false);
    hasActiveMobileNotificationFeature.mockClear();
    hasActiveMobileNotificationFeature.mockReturnValue(false);
    performMobileSync.mockClear();
    performMobileSync.mockResolvedValue({ success: true });
    storeSubscribe.mockClear();
    storeSubscribe.mockReturnValue(vi.fn());
    syncMobileBackgroundSyncRegistration.mockClear();
    syncMobileBackgroundSyncRegistration.mockResolvedValue(undefined);
    subscribeToCloudKitChanges.mockClear();
    subscribeToCloudKitChanges.mockReturnValue(vi.fn());
    updateMobileWidgetFromStore.mockClear();
    updateMobileWidgetFromStore.mockResolvedValue(true);
  });

  it('aborts the in-flight mobile sync through the AppState background transition', async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TestHarness />);
      await flushMicrotasks();
    });

    const listener = Array.from(appStateListeners)[0];
    expect(listener).toBeTypeOf('function');

    await act(async () => {
      listener('background');
      await flushMicrotasks();
    });

    expect(abortMobileSync).toHaveBeenCalledTimes(1);
    expect(syncMobileBackgroundSyncRegistration).toHaveBeenCalled();
    expect(performMobileSync).toHaveBeenCalled();

    await act(async () => {
      tree.unmount();
    });
  });

  it('does not auto-sync for local-only store changes that leave the sync payload unchanged', async () => {
    vi.useFakeTimers();
    const storeListeners: Array<(state: { lastDataChangeAt: number }, prevState: { lastDataChangeAt: number }) => void> = [];
    storeSubscribe.mockImplementation((...args: unknown[]) => {
      const callback = args[0] as (state: { lastDataChangeAt: number }, prevState: { lastDataChangeAt: number }) => void;
      storeListeners.push(callback);
      return vi.fn();
    });

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TestHarness />);
      await flushMicrotasks();
    });
    performMobileSync.mockClear();
    const storeListener = storeListeners.find((callback) => callback.length >= 2);
    expect(storeListener).toBeTypeOf('function');

    await act(async () => {
      storeListener?.({ lastDataChangeAt: 2 }, { lastDataChangeAt: 1 });
      await vi.advanceTimersByTimeAsync(5_000);
      await flushMicrotasks();
    });

    expect(performMobileSync).not.toHaveBeenCalled();

    await act(async () => {
      tree.unmount();
    });
    vi.useRealTimers();
  });

  it('skips auto-sync when the change fingerprint is unchanged (device-local sync bookkeeping)', async () => {
    vi.useFakeTimers();
    const storeListeners: Array<(state: { lastDataChangeAt: number }, prevState: { lastDataChangeAt: number }) => void> = [];
    storeSubscribe.mockImplementation((...args: unknown[]) => {
      const callback = args[0] as (state: { lastDataChangeAt: number }, prevState: { lastDataChangeAt: number }) => void;
      storeListeners.push(callback);
      return vi.fn();
    });

    // Sync status stamps (lastSyncAt/lastSyncStatus/...) are never part of a sync
    // payload, so the core change fingerprint returns the same value across them;
    // core's own test covers which fields it ignores.
    getInMemorySyncChangeFingerprint.mockReturnValue('sync-change:stable');

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TestHarness />);
      await flushMicrotasks();
    });
    performMobileSync.mockClear();
    const storeListener = storeListeners.find((callback) => callback.length >= 2);
    expect(storeListener).toBeTypeOf('function');

    await act(async () => {
      storeListener?.({ lastDataChangeAt: 2 }, { lastDataChangeAt: 1 });
      await vi.advanceTimersByTimeAsync(5_000);
      await flushMicrotasks();
    });

    expect(performMobileSync).not.toHaveBeenCalled();
    expect(getInMemorySyncChangeFingerprint).toHaveBeenCalled();

    await act(async () => {
      tree.unmount();
    });
    vi.useRealTimers();
  });

  it('auto-syncs when the sync payload fingerprint changes', async () => {
    vi.useFakeTimers();
    const storeListeners: Array<(state: { lastDataChangeAt: number }, prevState: { lastDataChangeAt: number }) => void> = [];
    storeSubscribe.mockImplementation((...args: unknown[]) => {
      const callback = args[0] as (state: { lastDataChangeAt: number }, prevState: { lastDataChangeAt: number }) => void;
      storeListeners.push(callback);
      return vi.fn();
    });

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TestHarness />);
      await flushMicrotasks();
    });
    performMobileSync.mockClear();
    getInMemorySyncChangeFingerprint.mockReturnValue('sync-change:changed');
    const storeListener = storeListeners.find((callback) => callback.length >= 2);
    expect(storeListener).toBeTypeOf('function');

    await act(async () => {
      storeListener?.({ lastDataChangeAt: 2 }, { lastDataChangeAt: 1 });
      await vi.advanceTimersByTimeAsync(5_000);
      await flushMicrotasks();
    });

    expect(performMobileSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree.unmount();
    });
    vi.useRealTimers();
  });

  it('dedupes rapid unchanged app-state sync triggers', async () => {
    vi.useFakeTimers();
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TestHarness />);
      await flushMicrotasks();
    });
    performMobileSync.mockClear();
    const listener = Array.from(appStateListeners)[0];
    expect(listener).toBeTypeOf('function');

    await act(async () => {
      listener('background');
      await flushMicrotasks();
      listener('active');
      await flushMicrotasks();
      listener('background');
      await flushMicrotasks();
      listener('active');
      await flushMicrotasks();
    });

    expect(performMobileSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree.unmount();
    });
    vi.useRealTimers();
  });

  // A throttled device used to fire again on the very next foreground/background
  // switch, because those call requestSync(0) and explicit-0 skipped the failure
  // cooldown. That is what kept re-tripping CloudKit's limit (#948).
  it('holds off app-state sync triggers while a failure cooldown is active', async () => {
    vi.useFakeTimers();
    performMobileSync.mockResolvedValue({
      success: false,
      error: 'CloudKit error: Request Rate Limited [retryAfter=300]',
    });

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TestHarness />);
      await flushMicrotasks();
    });
    const listener = Array.from(appStateListeners)[0];
    expect(listener).toBeTypeOf('function');

    await act(async () => {
      listener('background');
      await flushMicrotasks();
    });
    const attemptsAfterFailure = performMobileSync.mock.calls.length;
    expect(attemptsAfterFailure).toBeGreaterThan(0);

    // Past the app-state dedupe window, but far inside the 300s CloudKit asked for.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      listener('active');
      await flushMicrotasks();
      await vi.advanceTimersByTimeAsync(5_000);
      listener('background');
      await flushMicrotasks();
    });

    expect(performMobileSync).toHaveBeenCalledTimes(attemptsAfterFailure);

    await act(async () => {
      tree.unmount();
    });
    vi.useRealTimers();
  });

  it('skips the payload fingerprint entirely when lastDataChangeAt is unchanged', async () => {
    const storeListeners: Array<(state: { lastDataChangeAt: number }, prevState: { lastDataChangeAt: number }) => void> = [];
    storeSubscribe.mockImplementation((...args: unknown[]) => {
      const callback = args[0] as (state: { lastDataChangeAt: number }, prevState: { lastDataChangeAt: number }) => void;
      storeListeners.push(callback);
      return vi.fn();
    });

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TestHarness />);
      await flushMicrotasks();
    });
    getInMemorySyncChangeFingerprint.mockClear();
    const storeListener = storeListeners.find((callback) => callback.length >= 2);
    expect(storeListener).toBeTypeOf('function');

    await act(async () => {
      storeListener?.({ lastDataChangeAt: 1 }, { lastDataChangeAt: 1 });
      await flushMicrotasks();
    });

    expect(getInMemorySyncChangeFingerprint).not.toHaveBeenCalled();

    await act(async () => {
      tree.unmount();
    });
  });

  it('stretches the auto-sync interval after a slow sync cycle', async () => {
    vi.useFakeTimers();
    const storeListeners: Array<(state: { lastDataChangeAt: number }, prevState: { lastDataChangeAt: number }) => void> = [];
    storeSubscribe.mockImplementation((...args: unknown[]) => {
      const callback = args[0] as (state: { lastDataChangeAt: number }, prevState: { lastDataChangeAt: number }) => void;
      storeListeners.push(callback);
      return vi.fn();
    });
    let fingerprintVersion = 0;
    getInMemorySyncChangeFingerprint.mockImplementation(() => `sync-change:${fingerprintVersion}`);
    // Each sync cycle takes 20s, so the adaptive interval becomes 40s from cycle end.
    performMobileSync.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 20_000)),
    );

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TestHarness />);
      await flushMicrotasks();
    });
    performMobileSync.mockClear();
    const storeListener = storeListeners.find((callback) => callback.length >= 2);
    expect(storeListener).toBeTypeOf('function');

    await act(async () => {
      fingerprintVersion += 1;
      storeListener?.({ lastDataChangeAt: 2 }, { lastDataChangeAt: 1 });
      // Debounce (2s) + throttle to the 5s remote min interval + 20s cycle duration.
      await vi.advanceTimersByTimeAsync(26_000);
      await flushMicrotasks();
    });
    expect(performMobileSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      fingerprintVersion += 1;
      storeListener?.({ lastDataChangeAt: 3 }, { lastDataChangeAt: 2 });
      // Well past the 5s base interval, but within the 40s adaptive interval.
      await vi.advanceTimersByTimeAsync(20_000);
      await flushMicrotasks();
    });
    expect(performMobileSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
      await flushMicrotasks();
    });
    expect(performMobileSync).toHaveBeenCalledTimes(2);

    await act(async () => {
      tree.unmount();
    });
    vi.useRealTimers();
  });

  it('does not queue duplicate foreground syncs for repeated active AppState events', async () => {
    vi.useFakeTimers();
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TestHarness />);
      await flushMicrotasks();
    });
    performMobileSync.mockClear();
    const listener = Array.from(appStateListeners)[0];
    expect(listener).toBeTypeOf('function');

    await act(async () => {
      listener('background');
      await flushMicrotasks();
      listener('active');
      listener('active');
      await vi.advanceTimersByTimeAsync(45_000);
      await flushMicrotasks();
    });

    expect(performMobileSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree.unmount();
    });
    vi.useRealTimers();
  });
});
