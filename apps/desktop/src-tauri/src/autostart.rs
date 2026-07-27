use crate::bool_setting_enabled;
use crate::config::{read_config, write_config_files};
#[cfg(target_os = "linux")]
use crate::install::is_flatpak;
#[cfg(target_os = "windows")]
use crate::install::is_windows_store_install;
use crate::storage::{get_config_path, get_secrets_path};
use tauri_plugin_autostart::ManagerExt;

/// Task id declared as <uap5:StartupTask> in the Microsoft Store AppxManifest
/// (generated in .github/workflows/release-windows.yml). Keep both in sync.
#[cfg(target_os = "windows")]
const STORE_STARTUP_TASK_ID: &str = "MindwtrStartup";
const AUTOSTART_MIGRATION_PENDING: &str = "pending";
const AUTOSTART_MIGRATION_COMPLETE: &str = "true";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum AutostartMigrationState {
    NotStarted,
    Pending,
    Complete,
}

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

fn autostart_migration_state(value: Option<&str>) -> AutostartMigrationState {
    if value.is_some_and(|value| {
        value
            .trim()
            .eq_ignore_ascii_case(AUTOSTART_MIGRATION_PENDING)
    }) {
        return AutostartMigrationState::Pending;
    }
    if bool_setting_enabled(value) {
        return AutostartMigrationState::Complete;
    }
    AutostartMigrationState::NotStarted
}

/// Re-register one pre-`--startup` entry using injected OS/config operations.
///
/// `pending` is persisted before disabling the live entry. If enabling then
/// fails, the next launch knows the disabled state came from this migration
/// and retries enable instead of mistaking it for the user's preference.
fn migrate_autostart_entry_with(
    state: AutostartMigrationState,
    mut is_enabled: impl FnMut() -> Option<bool>,
    mut disable: impl FnMut() -> bool,
    mut enable: impl FnMut() -> bool,
    mut persist_state: impl FnMut(&'static str) -> bool,
) -> bool {
    if state == AutostartMigrationState::Complete {
        return true;
    }

    let enabled = is_enabled();
    if state == AutostartMigrationState::NotStarted {
        // Never turn on an entry that the user already had off.
        if enabled != Some(true) {
            return false;
        }
        // Do not risk disabling the only working entry unless the retry intent
        // is already durable.
        if !persist_state(AUTOSTART_MIGRATION_PENDING) {
            return false;
        }
    }

    // A pending migration can arrive here either before disable (for example,
    // after a process interruption) or after a failed enable. Only the former
    // still needs the old entry removed.
    if enabled == Some(true) && !disable() {
        return false;
    }
    if !enable() {
        return false;
    }
    persist_state(AUTOSTART_MIGRATION_COMPLETE)
}

/// One-time migration, run at boot: `tauri_plugin_autostart` only writes the
/// `--startup` command line on `enable()`, so an entry created before that
/// flag existed and left on would otherwise never pick it up, and the
/// tray-start behavior derived from it would never trigger for that install
/// (#928). The existing config marker is a tiny pending/complete state machine:
/// pending is written before disable, and complete only after enable succeeds.
/// This makes an interrupted or failed rewrite retryable without adding a user
/// setting or turning on autostart for someone who already had it off.
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
    let migration_state =
        autostart_migration_state(config.autostart_startup_flag_migrated.as_deref());
    let autostart = app.autolaunch();
    let config_path = get_config_path(app);
    let secrets_path = get_secrets_path(app);
    let _ = migrate_autostart_entry_with(
        migration_state,
        || autostart.is_enabled().ok(),
        || autostart.disable().is_ok(),
        || autostart.enable().is_ok(),
        |value| {
            config.autostart_startup_flag_migrated = Some(value.to_string());
            write_config_files(&config_path, &secrets_path, &config).is_ok()
        },
    );
}

#[cfg(any(target_os = "linux", test))]
fn flatpak_background_autostart_command() -> [&'static str; 2] {
    ["mindwtr", "--startup"]
}

#[cfg(target_os = "linux")]
async fn set_flatpak_launch_at_startup_enabled(enabled: bool) -> Result<bool, String> {
    use ashpd::desktop::background::Background;

    let response = Background::request()
        .reason("Keep reminders and sync running when Mindwtr is in the background")
        .auto_start(enabled)
        .dbus_activatable(false)
        .command(flatpak_background_autostart_command())
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
    fn migration_never_turns_on_an_entry_that_was_already_disabled() {
        let completed = migrate_autostart_entry_with(
            AutostartMigrationState::NotStarted,
            || Some(false),
            || panic!("disabled entry must not be removed"),
            || panic!("disabled entry must not be enabled"),
            |_| panic!("disabled entry must not start a migration"),
        );

        assert!(!completed);
    }

    #[test]
    fn migration_retries_enable_after_its_successful_disable_was_followed_by_failure() {
        let mut disable_calls = 0;
        let mut enable_calls = 0;
        let mut persisted = Vec::new();
        let first_completed = migrate_autostart_entry_with(
            AutostartMigrationState::NotStarted,
            || Some(true),
            || {
                disable_calls += 1;
                true
            },
            || {
                enable_calls += 1;
                false
            },
            |value| {
                persisted.push(value);
                true
            },
        );

        assert!(!first_completed);
        assert_eq!(disable_calls, 1);
        assert_eq!(enable_calls, 1);
        assert_eq!(persisted, [AUTOSTART_MIGRATION_PENDING]);

        let retry_state = autostart_migration_state(persisted.last().copied());
        let mut retry_enable_calls = 0;
        let mut retry_persisted = Vec::new();
        let retry_completed = migrate_autostart_entry_with(
            retry_state,
            || Some(false),
            || panic!("failed enable already left the entry disabled"),
            || {
                retry_enable_calls += 1;
                true
            },
            |value| {
                retry_persisted.push(value);
                true
            },
        );

        assert!(retry_completed);
        assert_eq!(retry_enable_calls, 1);
        assert_eq!(retry_persisted, [AUTOSTART_MIGRATION_COMPLETE]);
    }

    #[test]
    fn migration_does_not_disable_until_pending_state_is_durable() {
        let mut disable_calls = 0;

        let completed = migrate_autostart_entry_with(
            AutostartMigrationState::NotStarted,
            || Some(true),
            || {
                disable_calls += 1;
                true
            },
            || panic!("entry must stay enabled when pending state cannot be saved"),
            |_| false,
        );

        assert!(!completed);
        assert_eq!(disable_calls, 0);
    }

    #[test]
    fn flatpak_background_autostart_runs_the_app_with_startup_semantics() {
        assert_eq!(
            flatpak_background_autostart_command(),
            ["mindwtr", "--startup"]
        );
    }
}
