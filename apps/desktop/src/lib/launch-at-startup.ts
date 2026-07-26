import { invoke } from '@tauri-apps/api/core';

export const getLaunchAtStartupEnabled = async (): Promise<boolean> => (
    invoke<boolean>('get_launch_at_startup_enabled' as never)
);

export const setLaunchAtStartupEnabled = async (enabled: boolean): Promise<boolean> => (
    invoke<boolean>('set_launch_at_startup_enabled' as never, { enabled } as never)
);

// Microsoft Store autostart is declared in the AppxManifest <uap5:StartupTask>,
// which cannot carry arguments, so the "start in tray" flag never reaches a
// Store-launched process (#928) — the settings UI hides that checkbox there.
export const isWindowsStoreInstall = async (): Promise<boolean> => (
    invoke<boolean>('is_windows_store_install' as never)
);

export const getStartInTrayEnabled = async (): Promise<boolean> => (
    invoke<boolean>('get_start_in_tray_enabled' as never)
);

export const setStartInTrayEnabled = async (enabled: boolean): Promise<boolean> => (
    invoke<boolean>('set_start_in_tray_enabled' as never, { enabled } as never)
);
