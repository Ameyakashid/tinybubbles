import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSettingsMainPage } from './useSettingsMainPage';

const getLaunchAtStartupEnabled = vi.fn();
const isWindowsStoreInstall = vi.fn();
const getStartInTrayEnabled = vi.fn();
const tauriCoreMock = vi.hoisted(() => ({
    invoke: vi.fn().mockResolvedValue('dark'),
}));
const tauriAppMock = vi.hoisted(() => ({
    setTheme: vi.fn().mockResolvedValue(undefined),
}));
const tauriWindowMock = vi.hoisted(() => ({
    setTheme: vi.fn().mockResolvedValue(undefined),
    theme: vi.fn().mockResolvedValue('dark'),
    onThemeChanged: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('@tauri-apps/api/app', () => ({
    setTheme: tauriAppMock.setTheme,
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: tauriCoreMock.invoke,
}));

vi.mock('@tauri-apps/api/window', () => ({
    getCurrentWindow: () => tauriWindowMock,
}));

vi.mock('../../../lib/launch-at-startup', () => ({
    getLaunchAtStartupEnabled: () => getLaunchAtStartupEnabled(),
    setLaunchAtStartupEnabled: vi.fn(),
    isWindowsStoreInstall: () => isWindowsStoreInstall(),
    getStartInTrayEnabled: () => getStartInTrayEnabled(),
    setStartInTrayEnabled: vi.fn(),
}));

type HarnessProps = {
    isFlatpak: boolean;
    isTauri: boolean;
    settings?: Parameters<typeof useSettingsMainPage>[0]['settings'];
};

function Harness({ isFlatpak, isTauri, settings = { window: { launchAtStartup: true } } }: HarnessProps) {
    const page = useSettingsMainPage({
        globalQuickAddShortcut: 'Control+Alt+M',
        isFlatpak,
        isLinux: true,
        isTauri,
        keybindingStyle: 'vim',
        language: 'en',
        openHelp: vi.fn(),
        setGlobalQuickAddShortcut: vi.fn(),
        setKeybindingStyle: vi.fn(),
        setLanguage: vi.fn(),
        settings,
        showSaved: vi.fn(),
        updateSettings: vi.fn(),
    });

    return (
        <output data-testid="settings-main-state">
            {JSON.stringify({
                closeBehavior: page.closeBehavior,
                launchAtStartupEnabled: page.launchAtStartupEnabled,
                showCloseBehavior: page.showCloseBehavior,
                showLaunchAtStartup: page.showLaunchAtStartup,
                showStartInTray: page.showStartInTray,
                showTrayToggle: page.showTrayToggle,
                startInTrayEnabled: page.startInTrayEnabled,
            })}
        </output>
    );
}

const readState = () => JSON.parse(screen.getByTestId('settings-main-state').textContent ?? '{}');

describe('useSettingsMainPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getLaunchAtStartupEnabled.mockResolvedValue(true);
        isWindowsStoreInstall.mockResolvedValue(false);
        getStartInTrayEnabled.mockResolvedValue(false);
        tauriCoreMock.invoke.mockResolvedValue('dark');
        tauriAppMock.setTheme.mockResolvedValue(undefined);
        tauriWindowMock.setTheme.mockResolvedValue(undefined);
        document.documentElement.className = '';
        localStorage.clear();
    });

    it('exposes Flatpak lifecycle controls and defaults close handling to tray', () => {
        render(<Harness isFlatpak isTauri />);

        expect(readState()).toMatchObject({
            closeBehavior: 'tray',
            launchAtStartupEnabled: true,
            showCloseBehavior: true,
            showLaunchAtStartup: true,
            showStartInTray: true,
            showTrayToggle: true,
        });
        expect(getLaunchAtStartupEnabled).not.toHaveBeenCalled();
    });

    it('shows start in tray only once launch at startup is on and it is not a Windows Store install', async () => {
        render(<Harness isFlatpak={false} isTauri settings={{ window: { launchAtStartup: false } }} />);

        await waitFor(() => {
            expect(readState()).toMatchObject({ showStartInTray: false });
        });
    });

    it('hides start in tray on a Windows Store install even with launch at startup on', async () => {
        isWindowsStoreInstall.mockResolvedValue(true);

        render(<Harness isFlatpak={false} isTauri settings={{ window: { launchAtStartup: true } }} />);

        await waitFor(() => {
            expect(readState()).toMatchObject({ showStartInTray: false });
        });
    });

    it('loads the persisted start-in-tray preference from config.toml', async () => {
        getStartInTrayEnabled.mockResolvedValue(true);

        render(<Harness isFlatpak={false} isTauri settings={{ window: { launchAtStartup: true } }} />);

        await waitFor(() => {
            expect(readState()).toMatchObject({ startInTrayEnabled: true });
        });
    });

    it('keeps lifecycle controls hidden outside the Tauri runtime', () => {
        render(<Harness isFlatpak={false} isTauri={false} />);

        expect(readState()).toMatchObject({
            closeBehavior: 'ask',
            showCloseBehavior: false,
            showLaunchAtStartup: false,
            showTrayToggle: false,
        });
    });

    it('applies the resolved Tauri theme to the app and current window', async () => {
        render(<Harness isFlatpak={false} isTauri settings={{ theme: 'dark' }} />);

        await waitFor(() => {
            expect(tauriAppMock.setTheme).toHaveBeenCalledWith('dark');
            expect(tauriWindowMock.setTheme).toHaveBeenCalledWith('dark');
        });
    });

    it('resolves System theme through the native command when webview media is stale', async () => {
        const originalMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn().mockReturnValue({ matches: false } as MediaQueryList);

        try {
            render(<Harness isFlatpak={false} isTauri settings={{ theme: 'system' }} />);

            await waitFor(() => {
                expect(tauriCoreMock.invoke).toHaveBeenCalledWith('get_system_theme_preference');
                expect(document.documentElement.classList.contains('dark')).toBe(true);
            });
        } finally {
            window.matchMedia = originalMatchMedia;
        }
    });
});
