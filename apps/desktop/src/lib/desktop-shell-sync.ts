import { useEffect } from 'react';
import { logError } from './app-log';
import { isTauriRuntime } from './runtime';
import { invokeNative } from './tauri-invoke';
import type { DesktopCloseBehavior } from './window-behavior';

export type DesktopShellSyncOptions = {
    /** `undefined` until settings hydrate — the tray is left alone until then. */
    showTray: boolean | undefined;
    trayTooltip: string;
    closeBehavior: DesktopCloseBehavior;
};

/**
 * Fires one shell command and reports failures under `scope`/`step` — the
 * strings field logs are grepped by, so they are part of the contract.
 *
 * Returns the effect cleanup. A command that settles after the effect is torn
 * down no longer logs; the send itself is not recalled, which only matters
 * during teardown or a superseded value, and later sends still land in order.
 */
function runShellCommand(
    command: string,
    args: Record<string, unknown>,
    scope: string,
    step: string,
): () => void {
    let cancelled = false;
    void invokeNative(command, args).catch((error) => {
        if (cancelled) return;
        void logError(error, { scope, step });
    });
    return () => {
        cancelled = true;
    };
}

/**
 * Mirrors settings out to the OS shell: tray icon, tray tooltip, macOS dock.
 *
 * One effect per command on purpose — each re-runs on its own inputs, and the
 * tray icon must exist before its tooltip is set.
 */
export function useDesktopShellSync({ showTray, trayTooltip, closeBehavior }: DesktopShellSyncOptions): void {
    useEffect(() => {
        if (!isTauriRuntime()) return;
        if (showTray === undefined) return;
        return runShellCommand('set_tray_visible', { visible: showTray !== false }, 'tray', 'setVisible');
    }, [showTray]);

    // Hovering the tray icon showed an empty rectangle because no tooltip was
    // ever set. Fill it with today's Focus so the list can be glanced at without
    // opening the window (#935). Linux ignores this natively — Tauri does not
    // support tray tooltips there — so the command is a no-op on that platform.
    useEffect(() => {
        if (!isTauriRuntime()) return;
        if (showTray === false) return;
        return runShellCommand('set_tray_tooltip', { tooltip: trayTooltip }, 'tray', 'setTooltip');
    }, [showTray, trayTooltip]);

    useEffect(() => {
        if (!isTauriRuntime()) return;
        const hideFromDock = closeBehavior === 'tray' && showTray !== false;
        return runShellCommand(
            'set_macos_activation_policy',
            { accessory: hideFromDock },
            'window',
            'setActivationPolicy',
        );
    }, [closeBehavior, showTray]);
}
