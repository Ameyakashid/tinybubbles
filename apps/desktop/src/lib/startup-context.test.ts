import { describe, expect, it, vi } from 'vitest';

const logInfo = vi.fn(() => Promise.resolve());

vi.mock('./app-log', () => ({
    isDiagnosticsEnabled: () => false,
    logInfo,
}));

vi.mock('./runtime', () => ({
    isTauriRuntime: () => false,
}));

vi.mock('./analytics-heartbeat', () => ({
    detectDesktopPlatform: () => 'linux',
    getDesktopChannel: async () => 'appimage',
    getDesktopLocale: () => 'en-US',
    getDesktopOsMajor: () => '6',
    getDesktopVersion: async () => '1.2.0',
}));

describe('desktop startup context', () => {
    it('logs from the already-hydrated diagnostics setting without reading storage', async () => {
        logInfo.mockClear();
        const { logDesktopStartupContext } = await import('./startup-context');

        await logDesktopStartupContext(true);

        expect(logInfo).toHaveBeenCalledWith('App started', expect.objectContaining({
            scope: 'startup',
            force: true,
            extra: expect.objectContaining({ loggingReason: 'user-enabled' }),
        }));
    });
});
