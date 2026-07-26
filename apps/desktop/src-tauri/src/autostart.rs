#[cfg(target_os = "linux")]
use crate::install::is_flatpak;
#[cfg(target_os = "windows")]
use crate::install::is_windows_store_install;
use crate::bool_setting_enabled;
use crate::config::{read_config, write_config_files};
use crate::storage::{get_config_path, get_secrets_path};
use tauri_plugin_autostart::ManagerExt;

/// Task id declared as <uap5:StartupTask> in the Microsoft Store AppxManifest
/// (generated in .github/workflows/release-windows.yml). Keep both in sync.
#[cfg(target_os = "windows")]
const STORE_STARTUP_TASK_ID: &str = "MindwtrStartup";

fn autostart_error(error: tauri_plugin_autostart::Error) -> String {
    error.to_string()
}

#[tauri::command]
pub(crate) async fn get_launch_at_startup_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    // MSIX virtualizes HKCU writes, so the registry Run key the autostart
    // plugin manages never reaches the real hive in Store installs — Windows
    // ignores it while is_enabled() happily reads it back as on. Store builds
    // must go through the declared StartupTask instead.
    #[cfg(target_os = "windows")]
    if is_windows_store_install() {
        return get_store_launch_at_startup_enabled().await;
    }

    app.autolaunch().is_enabled().map_err(autostart_error)
}

#[tauri::command]
pub(crate) async fn set_launch_at_startup_enabled(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<bool, String> {
    #[cfg(target_os = "linux")]
    if is_flatpak() {
        return set_flatpak_launch_at_startup_enabled(enabled).await;
    }

    #[cfg(target_os = "windows")]
    if is_windows_store_install() {
        return set_store_launch_at_startup_enabled(enabled).await;
    }

    let autostart = app.autolaunch();
    if enabled {
        // Disable first: the plugin only writes the (now --startup-flag-
        // carrying, see run()) command line on enable, so an entry that
        // predates the flag and already reads as "enabled" would otherwise
        // never get rewritten (#928).
        let _ = autostart.disable();
        autostart.enable().map_err(autostart_error)?;
    } else {
        autostart.disable().map_err(autostart_error)?;
    }
    autostart.is_enabled().map_err(autostart_error)
}

/// True exactly once for an entry that predates the --startup flag and is
/// still on: never migrated yet, and the user already asked for autostart.
/// An entry the user has off must never be turned on by this check (#928).
fn should_refresh_autostart_entry(already_migrated: bool, autostart_enabled: bool) -> bool {
    !already_migrated && autostart_enabled
}

/// One-time migration, run at boot: `tauri_plugin_autostart` only writes the
/// `--startup` command line on `enable()`, so an entry created before that
/// flag existed and left on would otherwise never pick it up, and the
/// tray-start behavior derived from it would never trigger for that install
/// (#928). Guarded by a config.toml marker so a normal boot does not repeat
/// the disable()/enable() round trip every launch; the marker is only set
/// after `enable()` reports success; a failure leaves it unset so the next
/// boot retries rather than the migration being silently recorded as done
/// despite leaving the user with no autostart entry at all.
pub(crate) fn migrate_autostart_entry_if_pending(app: &tauri::AppHandle) {
    #[cfg(target_os = "linux")]
    if is_flatpak() {
        return;
    }
    #[cfg(target_os = "windows")]
    if is_windows_store_install() {
        return;
    }
    let mut config = read_config(app);
    let already_migrated = bool_setting_enabled(config.autostart_startup_flag_migrated.as_deref());
    let autostart = app.autolaunch();
    let autostart_enabled = matches!(autostart.is_enabled(), Ok(true));
    if !should_refresh_autostart_entry(already_migrated, autostart_enabled) {
        return;
    }
    // Mirrors set_launch_at_startup_enabled: disable's result is ignored so a
    // quirky OS-level failure there does not block the enable() that actually
    // rewrites the command line.
    let _ = autostart.disable();
    if autostart.enable().is_err() {
        return;
    }
    config.autostart_startup_flag_migrated = Some("true".to_string());
    let _ = write_config_files(&get_config_path(app), &get_secrets_path(app), &config);
}

#[cfg(target_os = "linux")]
async fn set_flatpak_launch_at_startup_enabled(enabled: bool) -> Result<bool, String> {
    use ashpd::desktop::background::Background;

    let response = Background::request()
        .reason("Keep reminders and sync running when Mindwtr is in the background")
        .auto_start(enabled)
        .dbus_activatable(false)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .response()
        .map_err(|error| error.to_string())?;

    Ok(response.auto_start())
}

#[cfg(target_os = "windows")]
fn store_startup_task() -> Result<windows::ApplicationModel::StartupTask, String> {
    use windows::core::HSTRING;

    windows::ApplicationModel::StartupTask::GetAsync(&HSTRING::from(STORE_STARTUP_TASK_ID))
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn store_startup_state_is_enabled(state: windows::ApplicationModel::StartupTaskState) -> bool {
    use windows::ApplicationModel::StartupTaskState;

    state == StartupTaskState::Enabled || state == StartupTaskState::EnabledByPolicy
}

#[cfg(target_os = "windows")]
async fn get_store_launch_at_startup_enabled() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let task = store_startup_task()?;
        let state = task.State().map_err(|error| error.to_string())?;
        Ok(store_startup_state_is_enabled(state))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(target_os = "windows")]
async fn set_store_launch_at_startup_enabled(enabled: bool) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use windows::ApplicationModel::StartupTaskState;

        let task = store_startup_task()?;
        if !enabled {
            task.Disable().map_err(|error| error.to_string())?;
            return Ok(false);
        }
        let state = task
            .RequestEnableAsync()
            .map_err(|error| error.to_string())?
            .get()
            .map_err(|error| error.to_string())?;
        // Windows will not let an app re-enable a task the user disabled in
        // Task Manager / Settings; surface where to flip it back instead of
        // pretending the toggle worked.
        if state == StartupTaskState::DisabledByUser {
            return Err(
                "Startup for Mindwtr is turned off in Windows. Enable it under Settings > Apps > Startup, then try again.".to_string(),
            );
        }
        if state == StartupTaskState::DisabledByPolicy {
            return Err("Startup is disabled by system policy on this device.".to_string());
        }
        Ok(store_startup_state_is_enabled(state))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refreshes_only_a_not_yet_migrated_entry_that_is_already_enabled() {
        assert!(should_refresh_autostart_entry(false, true));
        assert!(!should_refresh_autostart_entry(true, true));
        assert!(!should_refresh_autostart_entry(false, false));
        assert!(!should_refresh_autostart_entry(true, false));
    }
}
