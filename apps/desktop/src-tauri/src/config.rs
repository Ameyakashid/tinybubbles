use crate::obsidian_paths::normalize_obsidian_inbox_file;
use crate::*;
use std::path::PathBuf;

const KEYRING_FALLBACK_WARNING_EVENT: &str = "keyring-fallback-warning";

fn keyring_enabled() -> bool {
    !crate::storage::is_portable_mode()
}

fn emit_keyring_fallback_warning(app: &tauri::AppHandle, secret_name: &str) {
    let message =
        format!("{secret_name} stored in plaintext because the system keyring is unavailable.");
    if let Err(error) = app.emit(KEYRING_FALLBACK_WARNING_EVENT, message) {
        log::warn!("Failed to emit keyring fallback warning: {error}");
    }
}

fn calendar_file_url_to_path(raw: &str) -> Option<PathBuf> {
    let trimmed = raw.trim();
    if !trimmed
        .get(..7)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("file://"))
    {
        return None;
    }

    let path = &trimmed[7..];
    #[cfg(target_os = "windows")]
    let path = {
        let mut path = path;
        let bytes = path.as_bytes();
        if bytes.len() >= 3 && bytes[0] == b'/' && bytes[2] == b':' {
            path = &path[1..];
        }
        path
    };
    let candidate = PathBuf::from(percent_decode_file_path(path)?);
    if !candidate.is_absolute() {
        return None;
    }
    let has_ics_extension = candidate
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("ics"));
    if !has_ics_extension {
        return None;
    }
    Some(candidate)
}

fn percent_decode_file_path(path: &str) -> Option<String> {
    let bytes = path.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hi = bytes.get(index + 1).and_then(|value| hex_value(*value))?;
            let lo = bytes.get(index + 2).and_then(|value| hex_value(*value))?;
            decoded.push((hi << 4) | lo);
            index += 3;
            continue;
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8(decoded).ok()
}

fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

fn is_valid_calendar_url(raw: &str) -> bool {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return false;
    }
    let lower = trimmed.to_ascii_lowercase();
    lower.starts_with("https://")
        || lower.starts_with("http://")
        || lower.starts_with("webcal://")
        || calendar_file_url_to_path(trimmed).is_some()
}

pub(crate) fn expand_external_calendar_file_scopes(app: &tauri::AppHandle, raw: Option<&str>) {
    let Some(raw) = raw else {
        return;
    };
    let Ok(calendars) = serde_json::from_str::<Vec<ExternalCalendarSubscription>>(raw) else {
        return;
    };
    for calendar in calendars {
        let Some(path) = calendar_file_url_to_path(&calendar.url) else {
            continue;
        };
        if let Err(error) = app.fs_scope().allow_file(&path) {
            log::warn!(
                "Failed to expand Tauri fs scope for calendar file {:?}: {error}",
                path
            );
        } else {
            log::info!(
                "Expanded Tauri fs scope to include calendar file {:?}",
                path
            );
        }
    }
}

pub(crate) fn parse_toml_string_value(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(stripped) = trimmed.strip_prefix('"').and_then(|s| s.strip_suffix('"')) {
        return Some(stripped.replace("\\\"", "\"").replace("\\\\", "\\"));
    }
    if let Some(stripped) = trimmed
        .strip_prefix('\'')
        .and_then(|s| s.strip_suffix('\''))
    {
        return Some(stripped.to_string());
    }
    None
}

pub(crate) fn read_config_toml(path: &Path) -> AppConfigToml {
    let Ok(content) = fs::read_to_string(path) else {
        return AppConfigToml::default();
    };
    // A file that isn't valid TOML falls back to default() here — same as a
    // missing file — rather than the old hand-rolled parser's per-line
    // recovery. On its own that would be a silent-loss regression the moment
    // a caller writes the "empty" config back over the real file; see the
    // guard in `write_config_toml_with_header` below, which is what actually
    // keeps that from happening.
    toml::from_str(&content).unwrap_or_default()
}

fn write_config_toml(path: &Path, config: &AppConfigToml) -> Result<(), String> {
    write_config_toml_with_header(path, config, "# Mindwtr desktop config")
}

fn write_secrets_toml(path: &Path, config: &AppConfigToml) -> Result<(), String> {
    write_config_toml_with_header(path, config, "# Mindwtr desktop secrets")
}

fn write_config_toml_with_header(
    path: &Path,
    config: &AppConfigToml,
    header: &str,
) -> Result<(), String> {
    // Refuse to overwrite a file whose current on-disk content this build
    // cannot parse. Every read-modify-write call site reads via
    // `read_config_toml`, which silently falls back to `default()` on a
    // parse failure; without this guard, writing that "empty" config back
    // would permanently erase whatever was actually on disk. A missing file
    // (first write) is not a failure and is not blocked.
    if let Ok(existing) = fs::read_to_string(path) {
        if !existing.trim().is_empty() && toml::from_str::<AppConfigToml>(&existing).is_err() {
            return Err(format!(
                "Refusing to overwrite {}: its current contents could not be parsed. \
                 Fix or remove the file by hand, then retry.",
                path.display()
            ));
        }
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let body = toml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(path, format!("{header}\n{body}")).map_err(|e| e.to_string())
}

/// Converts an `AppConfigToml` to its generic JSON-object view. Both
/// `merge_config` and `split_config_for_secrets` shuffle fields between two
/// `AppConfigToml` values by key name instead of restating the field roster,
/// so a new field only ever needs to be declared once, on the struct itself.
fn config_as_object(config: &AppConfigToml) -> Map<String, Value> {
    match serde_json::to_value(config).expect("AppConfigToml serializes infallibly") {
        Value::Object(map) => map,
        _ => unreachable!("AppConfigToml always serializes to a JSON object"),
    }
}

fn object_as_config(map: Map<String, Value>) -> AppConfigToml {
    serde_json::from_value(Value::Object(map))
        .expect("a subset of AppConfigToml's own fields always deserializes")
}

fn merge_config(base: &mut AppConfigToml, overrides: AppConfigToml) {
    let mut merged = config_as_object(base);
    for (key, value) in config_as_object(&overrides) {
        if !value.is_null() {
            merged.insert(key, value);
        }
    }
    *base = object_as_config(merged);
}

pub(crate) fn read_config(app: &tauri::AppHandle) -> AppConfigToml {
    let mut config = read_config_toml(&get_config_path(app));
    let secrets_path = get_secrets_path(app);
    if secrets_path.exists() {
        let secrets = read_config_toml(&secrets_path);
        merge_config(&mut config, secrets);
    }
    if keyring_enabled() {
        migrate_legacy_secrets(app, &mut config);
    }
    config
}

// The one place to check when adding a credential field: list it here and
// `split_config_for_secrets` keeps it out of the plaintext config.toml. This
// is real policy (which fields may never touch the public file), not
// derivable from the struct itself, so it stays its own table rather than an
// attribute a refactor could quietly drop.
const SECRET_FIELDS: &[&str] = &[
    "webdav_password",
    "cloud_token",
    "dropbox_tokens",
    "external_calendars",
    "ai_key_openai",
    "ai_key_anthropic",
    "ai_key_gemini",
    "email_capture_password",
    "local_api_token",
];

fn split_config_for_secrets(config: &AppConfigToml) -> (AppConfigToml, AppConfigToml) {
    let mut public_map = config_as_object(config);
    let mut secrets_map = Map::new();
    for &field in SECRET_FIELDS {
        if let Some(value) = public_map.remove(field).filter(|value| !value.is_null()) {
            secrets_map.insert(field.to_string(), value);
        }
    }
    (object_as_config(public_map), object_as_config(secrets_map))
}

fn config_has_values(config: &AppConfigToml) -> bool {
    *config != AppConfigToml::default()
}

pub(crate) fn write_config_files(
    config_path: &Path,
    secrets_path: &Path,
    config: &AppConfigToml,
) -> Result<(), String> {
    let (public_config, secrets_config) = split_config_for_secrets(config);
    write_config_toml(config_path, &public_config)?;

    if config_has_values(&secrets_config) {
        write_secrets_toml(secrets_path, &secrets_config)?;
    } else if secrets_path.exists() {
        fs::remove_file(secrets_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn migrate_legacy_secrets(app: &tauri::AppHandle, config: &mut AppConfigToml) {
    if !keyring_enabled() {
        return;
    }
    let mut migrated = false;
    if let Some(value) = config.webdav_password.clone() {
        if set_keyring_secret(app, KEYRING_WEB_DAV_PASSWORD, Some(value)).is_ok() {
            config.webdav_password = None;
            migrated = true;
        }
    }
    if let Some(value) = config.cloud_token.clone() {
        if set_keyring_secret(app, KEYRING_CLOUD_TOKEN, Some(value)).is_ok() {
            config.cloud_token = None;
            migrated = true;
        }
    }
    if let Some(value) = config.dropbox_tokens.clone() {
        if set_keyring_secret(app, KEYRING_DROPBOX_TOKENS, Some(value)).is_ok() {
            config.dropbox_tokens = None;
            migrated = true;
        }
    }
    if let Some(value) = config.ai_key_openai.clone() {
        if set_keyring_secret(app, KEYRING_AI_OPENAI, Some(value)).is_ok() {
            config.ai_key_openai = None;
            migrated = true;
        }
    }
    if let Some(value) = config.ai_key_anthropic.clone() {
        if set_keyring_secret(app, KEYRING_AI_ANTHROPIC, Some(value)).is_ok() {
            config.ai_key_anthropic = None;
            migrated = true;
        }
    }
    if let Some(value) = config.ai_key_gemini.clone() {
        if set_keyring_secret(app, KEYRING_AI_GEMINI, Some(value)).is_ok() {
            config.ai_key_gemini = None;
            migrated = true;
        }
    }
    if let Some(value) = config.email_capture_password.clone() {
        if set_keyring_secret(app, KEYRING_EMAIL_CAPTURE_PASSWORD, Some(value)).is_ok() {
            config.email_capture_password = None;
            migrated = true;
        }
    }
    if migrated {
        let _ = write_config_files(&get_config_path(app), &get_secrets_path(app), config);
    }
}

fn keyring_service(app: &tauri::AppHandle) -> String {
    format!("{}:secrets", app.config().identifier)
}

fn keyring_entry(app: &tauri::AppHandle, key: &str) -> Result<Entry, String> {
    Entry::new(&keyring_service(app), key).map_err(|e| e.to_string())
}

pub(crate) fn get_keyring_secret(
    app: &tauri::AppHandle,
    key: &str,
) -> Result<Option<String>, String> {
    if !keyring_enabled() {
        return Ok(None);
    }
    let entry = keyring_entry(app, key)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub(crate) fn set_keyring_secret(
    app: &tauri::AppHandle,
    key: &str,
    value: Option<String>,
) -> Result<(), String> {
    if !keyring_enabled() {
        return Err("Portable mode stores secrets in secrets.toml".to_string());
    }
    let entry = keyring_entry(app, key)?;
    match value {
        Some(value) if !value.trim().is_empty() => {
            entry.set_password(value.trim()).map_err(|e| e.to_string())
        }
        _ => match entry.delete_password() {
            Ok(_) => Ok(()),
            Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        },
    }
}

#[tauri::command]
pub(crate) fn get_ai_key(app: tauri::AppHandle, provider: String) -> Option<String> {
    let mut config = read_config(&app);
    let (key_name, legacy_value) = match provider.as_str() {
        "openai" => (KEYRING_AI_OPENAI, config.ai_key_openai.clone()),
        "anthropic" => (KEYRING_AI_ANTHROPIC, config.ai_key_anthropic.clone()),
        "gemini" => (KEYRING_AI_GEMINI, config.ai_key_gemini.clone()),
        _ => return None,
    };
    if let Ok(Some(value)) = get_keyring_secret(&app, key_name) {
        return Some(value);
    }
    if let Some(legacy) = legacy_value {
        if set_keyring_secret(&app, key_name, Some(legacy.clone())).is_ok() {
            match provider.as_str() {
                "openai" => config.ai_key_openai = None,
                "anthropic" => config.ai_key_anthropic = None,
                "gemini" => config.ai_key_gemini = None,
                _ => {}
            }
            let _ = write_config_files(&get_config_path(&app), &get_secrets_path(&app), &config);
        }
        return Some(legacy);
    }
    None
}

#[tauri::command]
pub(crate) fn set_ai_key(
    app: tauri::AppHandle,
    provider: String,
    value: Option<String>,
) -> Result<(), String> {
    let next_value = value.and_then(|v| {
        let trimmed = v.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });
    let key_name = match provider.as_str() {
        "openai" => KEYRING_AI_OPENAI,
        "anthropic" => KEYRING_AI_ANTHROPIC,
        "gemini" => KEYRING_AI_GEMINI,
        _ => return Ok(()),
    };
    match set_keyring_secret(&app, key_name, next_value.clone()) {
        Ok(_) => {
            let mut config = read_config(&app);
            match provider.as_str() {
                "openai" => config.ai_key_openai = None,
                "anthropic" => config.ai_key_anthropic = None,
                "gemini" => config.ai_key_gemini = None,
                _ => {}
            }
            let _ = write_config_files(&get_config_path(&app), &get_secrets_path(&app), &config);
            Ok(())
        }
        Err(_) => {
            let mut config = read_config(&app);
            let should_emit_warning = next_value.is_some();
            match provider.as_str() {
                "openai" => config.ai_key_openai = next_value,
                "anthropic" => config.ai_key_anthropic = next_value,
                "gemini" => config.ai_key_gemini = next_value,
                _ => {}
            }
            let label = match provider.as_str() {
                "openai" => "OpenAI API key",
                "anthropic" => "Anthropic API key",
                "gemini" => "Gemini API key",
                _ => "Secret",
            };
            if should_emit_warning {
                emit_keyring_fallback_warning(&app, label);
            }
            write_config_files(&get_config_path(&app), &get_secrets_path(&app), &config)
        }
    }
}

fn normalize_backend(value: &str) -> Option<&str> {
    match value {
        "off" | "file" | "webdav" | "cloud" | "cloudkit" => Some(value),
        _ => None,
    }
}

fn normalize_obsidian_scan_folders(scan_folders: Vec<String>) -> Vec<String> {
    let mut normalized: Vec<String> = Vec::new();
    for raw in scan_folders {
        let trimmed = raw.trim().replace('\\', "/");
        let value = if trimmed.is_empty() || trimmed == "/" {
            "/".to_string()
        } else {
            trimmed
                .trim_start_matches('/')
                .trim_end_matches('/')
                .to_string()
        };
        if value.is_empty() || normalized.iter().any(|existing| existing == &value) {
            continue;
        }
        normalized.push(value);
    }
    if normalized.is_empty() {
        default_obsidian_scan_folders()
    } else {
        normalized
    }
}

fn normalize_obsidian_new_task_format(value: String) -> String {
    match value.trim() {
        "inline" => "inline".to_string(),
        "tasknotes" => "tasknotes".to_string(),
        _ => "auto".to_string(),
    }
}

fn normalize_obsidian_config_payload(payload: ObsidianConfigPayload) -> ObsidianConfigPayload {
    let vault_path = payload.vault_path.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });
    let vault_name = if !payload.vault_name.trim().is_empty() {
        payload.vault_name.trim().to_string()
    } else if let Some(path) = vault_path.as_ref() {
        Path::new(path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .trim()
            .to_string()
    } else {
        String::new()
    };
    let last_scanned_at = payload.last_scanned_at.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    ObsidianConfigPayload {
        enabled: payload.enabled && vault_path.is_some(),
        vault_path,
        vault_name,
        scan_folders: normalize_obsidian_scan_folders(payload.scan_folders),
        inbox_file: normalize_obsidian_inbox_file(&payload.inbox_file),
        task_notes_include_archived: payload.task_notes_include_archived,
        dataview_metadata_enabled: payload.dataview_metadata_enabled,
        new_task_format: normalize_obsidian_new_task_format(payload.new_task_format),
        last_scanned_at,
    }
}

fn read_obsidian_config_payload(config: &AppConfigToml) -> ObsidianConfigPayload {
    let Some(raw) = config.obsidian_config.as_ref() else {
        return ObsidianConfigPayload::default();
    };
    serde_json::from_str::<ObsidianConfigPayload>(raw)
        .map(normalize_obsidian_config_payload)
        .unwrap_or_default()
}

fn expand_obsidian_payload_scope(app: &tauri::AppHandle, payload: &ObsidianConfigPayload) {
    let Some(vault_path) = payload.vault_path.as_ref() else {
        return;
    };
    expand_tauri_fs_scope(app, &PathBuf::from(vault_path));
}

#[tauri::command]
pub(crate) fn get_sync_backend(app: tauri::AppHandle) -> Result<String, String> {
    let config = read_config(&app);
    let raw = config.sync_backend.unwrap_or_else(|| "off".to_string());
    Ok(normalize_backend(raw.trim()).unwrap_or("off").to_string())
}

#[tauri::command]
pub(crate) fn set_sync_backend(app: tauri::AppHandle, backend: String) -> Result<bool, String> {
    let Some(normalized) = normalize_backend(backend.trim()) else {
        return Err("Invalid sync backend".to_string());
    };
    let config_path = get_config_path(&app);
    let mut config = read_config(&app);
    config.sync_backend = Some(normalized.to_string());
    write_config_files(&config_path, &get_secrets_path(&app), &config)?;
    Ok(true)
}

#[tauri::command]
pub(crate) fn get_obsidian_config(app: tauri::AppHandle) -> Result<Value, String> {
    let config = read_config(&app);
    serde_json::to_value(read_obsidian_config_payload(&config)).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn set_obsidian_config(app: tauri::AppHandle, config: Value) -> Result<Value, String> {
    let payload = serde_json::from_value::<ObsidianConfigPayload>(config)
        .map(normalize_obsidian_config_payload)
        .map_err(|e| format!("Invalid Obsidian config: {e}"))?;
    let config_path = get_config_path(&app);
    let mut current = read_config(&app);
    current.obsidian_config = Some(
        serde_json::to_string(&payload)
            .map_err(|e| format!("Failed to encode Obsidian config: {e}"))?,
    );
    write_config_files(&config_path, &get_secrets_path(&app), &current)?;
    expand_obsidian_payload_scope(&app, &payload);
    serde_json::to_value(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn expand_obsidian_vault_scope(
    app: tauri::AppHandle,
    vault_path: String,
) -> Result<bool, String> {
    let trimmed = vault_path.trim();
    if trimmed.is_empty() {
        return Ok(false);
    }
    expand_tauri_fs_scope(&app, &PathBuf::from(trimmed));
    Ok(true)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DetectedObsidianVault {
    name: String,
    path: String,
}

fn obsidian_registry_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    // Obsidian keeps a registry of every vault it has opened in
    // <config-dir>/obsidian/obsidian.json on all three platforms.
    if let Some(config_dir) = dirs::config_dir() {
        paths.push(config_dir.join("obsidian").join("obsidian.json"));
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(home) = dirs::home_dir() {
            // Flatpak-packaged Obsidian keeps its config inside the sandbox home.
            paths.push(home.join(".var/app/md.obsidian.Obsidian/config/obsidian/obsidian.json"));
        }
    }
    paths
}

pub(crate) fn parse_obsidian_vault_registry(contents: &str) -> Vec<String> {
    let Ok(value) = serde_json::from_str::<Value>(contents) else {
        return Vec::new();
    };
    let Some(vaults) = value.get("vaults").and_then(|entry| entry.as_object()) else {
        return Vec::new();
    };
    let mut paths: Vec<String> = vaults
        .values()
        .filter_map(|vault| vault.get("path").and_then(|path| path.as_str()))
        .map(str::to_string)
        .collect();
    paths.sort();
    paths.dedup();
    paths
}

#[tauri::command]
pub(crate) fn list_obsidian_vaults() -> Vec<DetectedObsidianVault> {
    let mut vaults = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for registry in obsidian_registry_paths() {
        let Ok(contents) = fs::read_to_string(&registry) else {
            continue;
        };
        for path in parse_obsidian_vault_registry(&contents) {
            if !seen.insert(path.clone()) {
                continue;
            }
            // The registry can hold stale entries; only offer vaults that still exist.
            if !Path::new(&path).is_dir() {
                continue;
            }
            let name = Path::new(&path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or(path.as_str())
                .to_string();
            vaults.push(DetectedObsidianVault { name, path });
        }
    }
    vaults
}

#[tauri::command]
pub(crate) fn check_obsidian_vault_marker(vault_path: String) -> Result<bool, String> {
    let trimmed = vault_path.trim();
    if trimmed.is_empty() {
        return Ok(false);
    }

    let marker_path = Path::new(trimmed).join(".obsidian");
    match fs::metadata(marker_path) {
        Ok(metadata) => Ok(metadata.is_dir()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub(crate) fn get_webdav_config(app: tauri::AppHandle) -> Result<Value, String> {
    let mut config = read_config(&app);
    let mut password = match get_keyring_secret(&app, KEYRING_WEB_DAV_PASSWORD) {
        Ok(value) => value,
        Err(error) => {
            log::warn!("Failed to read WebDAV password from keyring: {error}");
            None
        }
    };
    if password.is_none() {
        if let Some(legacy) = config.webdav_password.clone() {
            if set_keyring_secret(&app, KEYRING_WEB_DAV_PASSWORD, Some(legacy.clone())).is_ok() {
                config.webdav_password = None;
                write_config_files(&get_config_path(&app), &get_secrets_path(&app), &config)?;
            }
            password = Some(legacy);
        }
    }
    Ok(serde_json::json!({
        "url": config.webdav_url.unwrap_or_default(),
        "username": config.webdav_username.unwrap_or_default(),
        "hasPassword": password.is_some(),
        "allowInsecureHttp": config.webdav_allow_insecure_http.as_deref() == Some("true"),
        "allowWeakFingerprint": config.webdav_allow_weak_fingerprint.as_deref() != Some("false")
    }))
}

#[tauri::command]
pub(crate) fn set_webdav_config(
    app: tauri::AppHandle,
    url: String,
    username: String,
    password: String,
    allow_insecure_http: Option<bool>,
    allow_weak_fingerprint: Option<bool>,
) -> Result<bool, String> {
    let url = url.trim().to_string();
    let config_path = get_config_path(&app);
    let mut config = read_config(&app);

    if url.is_empty() {
        config.webdav_url = None;
        config.webdav_username = None;
        config.webdav_password = None;
        config.webdav_allow_insecure_http = None;
        config.webdav_allow_weak_fingerprint = None;
        let _ = set_keyring_secret(&app, KEYRING_WEB_DAV_PASSWORD, None);
    } else {
        config.webdav_url = Some(url);
        config.webdav_username = Some(username.trim().to_string());
        config.webdav_allow_insecure_http = Some(if allow_insecure_http.unwrap_or(false) {
            "true".to_string()
        } else {
            "false".to_string()
        });
        if let Some(allow_weak_fingerprint) = allow_weak_fingerprint {
            config.webdav_allow_weak_fingerprint = Some(if allow_weak_fingerprint {
                "true".to_string()
            } else {
                "false".to_string()
            });
        }
        if !password.trim().is_empty() {
            let next_password = password.trim().to_string();
            match set_keyring_secret(&app, KEYRING_WEB_DAV_PASSWORD, Some(next_password.clone())) {
                Ok(_) => {
                    config.webdav_password = None;
                }
                Err(_) => {
                    config.webdav_password = Some(next_password);
                    emit_keyring_fallback_warning(&app, "WebDAV password");
                }
            }
        }
    }

    write_config_files(&config_path, &get_secrets_path(&app), &config)?;
    Ok(true)
}

#[tauri::command]
pub(crate) fn get_webdav_password(app: tauri::AppHandle) -> Result<String, String> {
    let config = read_config(&app);
    let password = match get_keyring_secret(&app, KEYRING_WEB_DAV_PASSWORD) {
        Ok(value) => value,
        Err(_) => None,
    }
    .or(config.webdav_password);
    Ok(password.unwrap_or_default())
}

#[tauri::command]
pub(crate) fn get_cloud_config(app: tauri::AppHandle) -> Result<Value, String> {
    let mut config = read_config(&app);
    let mut token = match get_keyring_secret(&app, KEYRING_CLOUD_TOKEN) {
        Ok(value) => value,
        Err(error) => {
            log::warn!("Failed to read cloud token from keyring: {error}");
            None
        }
    };
    if token.is_none() {
        if let Some(legacy) = config.cloud_token.clone() {
            if set_keyring_secret(&app, KEYRING_CLOUD_TOKEN, Some(legacy.clone())).is_ok() {
                config.cloud_token = None;
                write_config_files(&get_config_path(&app), &get_secrets_path(&app), &config)?;
            }
            token = Some(legacy);
        }
    }
    Ok(serde_json::json!({
        "url": config.cloud_url.unwrap_or_default(),
        "token": token.unwrap_or_default(),
        "allowInsecureHttp": config.cloud_allow_insecure_http.as_deref() == Some("true")
    }))
}

#[tauri::command]
pub(crate) fn set_cloud_config(
    app: tauri::AppHandle,
    url: String,
    token: String,
    allow_insecure_http: Option<bool>,
) -> Result<bool, String> {
    let url = url.trim().to_string();
    let config_path = get_config_path(&app);
    let mut config = read_config(&app);
    let next_token = {
        let trimmed = token.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    };

    if url.is_empty() {
        config.cloud_url = None;
        config.cloud_token = None;
        config.cloud_allow_insecure_http = None;
        let _ = set_keyring_secret(&app, KEYRING_CLOUD_TOKEN, None);
    } else {
        config.cloud_url = Some(url);
        config.cloud_allow_insecure_http = Some(if allow_insecure_http.unwrap_or(false) {
            "true".to_string()
        } else {
            "false".to_string()
        });
        match set_keyring_secret(&app, KEYRING_CLOUD_TOKEN, next_token.clone()) {
            Ok(_) => {
                config.cloud_token = None;
            }
            Err(_) => {
                config.cloud_token = next_token;
                if config.cloud_token.is_some() {
                    emit_keyring_fallback_warning(&app, "Cloud token");
                }
            }
        }
    }

    write_config_files(&config_path, &get_secrets_path(&app), &config)?;
    Ok(true)
}

#[tauri::command]
pub(crate) fn set_network_proxy(app: tauri::AppHandle, proxy_url: String) -> Result<bool, String> {
    let trimmed = proxy_url.trim().to_string();
    if !trimmed.is_empty() {
        let parsed =
            reqwest::Url::parse(&trimmed).map_err(|error| format!("Invalid proxy URL: {error}"))?;
        if parsed.scheme() != "http" && parsed.scheme() != "https" {
            return Err("Proxy URL must use http:// or https://".to_string());
        }
    }
    let next = if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    };
    let config_path = get_config_path(&app);
    let mut config = read_config(&app);
    if config.proxy_url == next {
        return Ok(true);
    }
    config.proxy_url = next;
    write_config_files(&config_path, &get_secrets_path(&app), &config)?;
    Ok(true)
}

#[tauri::command]
pub(crate) fn get_external_calendars(
    app: tauri::AppHandle,
) -> Result<Vec<ExternalCalendarSubscription>, String> {
    let config = read_config(&app);
    let raw = config
        .external_calendars
        .unwrap_or_else(|| "[]".to_string());
    let parsed: Vec<ExternalCalendarSubscription> = serde_json::from_str(&raw).unwrap_or_default();
    Ok(parsed
        .into_iter()
        .filter(|c| !c.url.trim().is_empty())
        .map(|mut c| {
            c.url = c.url.trim().to_string();
            c.name = c.name.trim().to_string();
            if c.name.is_empty() {
                c.name = "Calendar".to_string();
            }
            c
        })
        .collect())
}

#[tauri::command]
pub(crate) fn set_external_calendars(
    app: tauri::AppHandle,
    calendars: Vec<ExternalCalendarSubscription>,
) -> Result<bool, String> {
    let config_path = get_config_path(&app);
    let mut config = read_config(&app);
    let sanitized: Vec<ExternalCalendarSubscription> = calendars
        .into_iter()
        .filter(|c| is_valid_calendar_url(&c.url))
        .map(|mut c| {
            c.url = c.url.trim().to_string();
            c.name = c.name.trim().to_string();
            if c.name.is_empty() {
                c.name = "Calendar".to_string();
            }
            c
        })
        .collect();

    config.external_calendars = Some(serde_json::to_string(&sanitized).map_err(|e| e.to_string())?);
    write_config_files(&config_path, &get_secrets_path(&app), &config)?;
    expand_external_calendar_file_scopes(&app, config.external_calendars.as_deref());
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_network_calendar_urls() {
        assert!(is_valid_calendar_url("https://calendar.example/work.ics"));
        assert!(is_valid_calendar_url("http://calendar.example/work.ics"));
        assert!(is_valid_calendar_url("webcal://calendar.example/work.ics"));
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn accepts_absolute_file_calendar_urls() {
        let path = calendar_file_url_to_path("file:///tmp/My%20Calendar.ICS").unwrap();
        assert!(path.is_absolute());
        assert_eq!(
            path.file_name().and_then(|name| name.to_str()),
            Some("My Calendar.ICS")
        );
        assert!(is_valid_calendar_url("file:///tmp/My%20Calendar.ICS"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn accepts_absolute_windows_file_calendar_urls() {
        let path = calendar_file_url_to_path("file:///C:/Users/demo/My%20Calendar.ICS").unwrap();
        assert!(path.is_absolute());
        assert_eq!(
            path.file_name().and_then(|name| name.to_str()),
            Some("My Calendar.ICS")
        );
        assert!(is_valid_calendar_url(
            "file:///C:/Users/demo/My%20Calendar.ICS"
        ));
    }

    #[test]
    fn rejects_invalid_file_calendar_urls() {
        assert!(!is_valid_calendar_url("file://agenda.ics"));
        assert!(!is_valid_calendar_url("file:///tmp/agenda.txt"));
        assert!(!is_valid_calendar_url("file:///tmp/bad%ZZ.ics"));
    }

    #[test]
    fn parses_obsidian_vault_registry_paths() {
        let registry = r#"{
            "vaults": {
                "a1b2": { "path": "/home/user/Vaults/Notes", "ts": 1, "open": true },
                "c3d4": { "path": "/home/user/Vaults/Work", "ts": 2 },
                "dupe": { "path": "/home/user/Vaults/Notes", "ts": 3 }
            }
        }"#;
        assert_eq!(
            super::parse_obsidian_vault_registry(registry),
            vec![
                "/home/user/Vaults/Notes".to_string(),
                "/home/user/Vaults/Work".to_string(),
            ]
        );
        assert!(super::parse_obsidian_vault_registry("not json").is_empty());
        assert!(super::parse_obsidian_vault_registry("{}").is_empty());
    }

    fn fully_populated_config() -> AppConfigToml {
        AppConfigToml {
            sync_path: Some("/home/user/Sync".to_string()),
            sync_path_bookmark: Some("bookmark-data".to_string()),
            sync_backend: Some("webdav".to_string()),
            webdav_url: Some("https://dav.example.com/mindwtr".to_string()),
            webdav_username: Some("demo".to_string()),
            // Embedded quote and backslash exercise the escaping path.
            webdav_password: Some("s3cr3t \"pass\" with \\backslash".to_string()),
            webdav_allow_insecure_http: Some("false".to_string()),
            webdav_allow_weak_fingerprint: Some("true".to_string()),
            cloud_url: Some("https://cloud.example.com".to_string()),
            cloud_token: Some("cloud-token-value".to_string()),
            cloud_allow_insecure_http: Some("false".to_string()),
            proxy_url: Some("http://proxy.example.com:8080".to_string()),
            dropbox_tokens: Some("{\"access_token\":\"abc\"}".to_string()),
            obsidian_config: Some("{\"vaultPath\":\"/vault\"}".to_string()),
            external_calendars: Some("[{\"url\":\"https://cal.example.com/a.ics\"}]".to_string()),
            ai_key_openai: Some("sk-openai".to_string()),
            ai_key_anthropic: Some("sk-anthropic".to_string()),
            ai_key_gemini: Some("sk-gemini".to_string()),
            email_capture_config: Some("{\"host\":\"imap.example.com\"}".to_string()),
            email_capture_password: Some("email-secret".to_string()),
            local_api_enabled: Some("true".to_string()),
            local_api_port: Some("3456".to_string()),
            local_api_token: Some("local-api-token-value".to_string()),
            disable_hardware_acceleration: Some("true".to_string()),
            autostart_startup_flag_migrated: Some("true".to_string()),
        }
    }

    #[test]
    fn config_toml_write_then_read_is_identity_for_every_field() {
        let dir = tempfile::tempdir().expect("should create temp dir");
        let path = dir.path().join("config.toml");
        let original = fully_populated_config();

        write_config_toml(&path, &original).expect("should write config.toml");
        let read_back = read_config_toml(&path);

        assert_eq!(read_back, original);
    }

    #[test]
    fn config_toml_written_by_a_shipped_version_still_parses() {
        // Hand-written in the exact shape the pre-serde `write_config_toml_with_header`
        // emitted: one header comment line, then `key = "value"` lines in the
        // same order it wrote them. New code must keep reading this shape.
        let legacy_config = concat!(
            "# Mindwtr desktop config\n",
            "sync_path = \"/home/user/Sync\"\n",
            "sync_backend = \"webdav\"\n",
            "webdav_url = \"https://dav.example.com/mindwtr\"\n",
            "webdav_allow_insecure_http = \"false\"\n",
            "local_api_port = \"3456\"\n",
            "disable_hardware_acceleration = \"true\"\n",
        );
        let dir = tempfile::tempdir().expect("should create temp dir");
        let path = dir.path().join("config.toml");
        fs::write(&path, legacy_config).expect("should write legacy config.toml");

        let config = read_config_toml(&path);

        assert_eq!(config.sync_path.as_deref(), Some("/home/user/Sync"));
        assert_eq!(config.sync_backend.as_deref(), Some("webdav"));
        assert_eq!(
            config.webdav_url.as_deref(),
            Some("https://dav.example.com/mindwtr")
        );
        assert_eq!(config.webdav_allow_insecure_http.as_deref(), Some("false"));
        assert_eq!(config.local_api_port.as_deref(), Some("3456"));
        assert_eq!(config.disable_hardware_acceleration.as_deref(), Some("true"));
        // Everything the legacy file didn't mention stays None, exactly as the
        // old ad hoc parser left unmatched keys as None.
        assert_eq!(config.cloud_url, None);
        assert_eq!(config.local_api_token, None);
    }

    #[test]
    fn write_config_files_never_leaks_a_secret_field_into_the_public_config() {
        let dir = tempfile::tempdir().expect("should create temp dir");
        let config_path = dir.path().join("config.toml");
        let secrets_path = dir.path().join("secrets.toml");
        let original = fully_populated_config();

        write_config_files(&config_path, &secrets_path, &original)
            .expect("should write config and secrets files");

        let public_config = read_config_toml(&config_path);
        let secrets_config = read_config_toml(&secrets_path);
        let public_raw = fs::read_to_string(&config_path).expect("should read public config");

        for &field in SECRET_FIELDS {
            let secret_value = config_as_object(&original)
                .remove(field)
                .and_then(|value| value.as_str().map(str::to_string))
                .expect("fully populated config sets every secret field");

            // Structural check: the field itself is absent from the public struct...
            assert!(
                config_as_object(&public_config).get(field).is_none(),
                "{field} must not be present in the public config"
            );
            // ...and the raw text never contains the secret value either.
            assert!(
                !public_raw.contains(&secret_value),
                "{field}'s value leaked into the public config.toml text"
            );
            // It must have moved to secrets.toml instead.
            assert_eq!(
                config_as_object(&secrets_config).get(field).and_then(Value::as_str),
                Some(secret_value.as_str()),
                "{field} should have moved to secrets.toml"
            );
        }

        // Non-secret fields still round-trip through the public file.
        assert_eq!(public_config.sync_backend, original.sync_backend);
        assert_eq!(public_config.local_api_port, original.local_api_port);
    }

    #[test]
    fn write_config_files_refuses_to_overwrite_an_unparseable_config_toml() {
        let dir = tempfile::tempdir().expect("should create temp dir");
        let config_path = dir.path().join("config.toml");
        let secrets_path = dir.path().join("secrets.toml");
        // Bare (unquoted) value: syntactically invalid TOML, as if the file
        // were hand-edited or truncated mid-write.
        let corrupt = "# Mindwtr desktop config\nsync_backend = webdav\n";
        fs::write(&config_path, corrupt).expect("should write corrupt config.toml");

        // Reproduces the real read-modify-write flow every setter uses:
        // read (falls back to default() because the file won't parse), set
        // one field, write back.
        let mut config = read_config_toml(&config_path);
        assert_eq!(config.sync_backend, None, "corrupt file reads as empty");
        config.local_api_port = Some("3456".to_string());

        let result = write_config_files(&config_path, &secrets_path, &config);

        assert!(result.is_err(), "write must refuse, not silently succeed");
        let on_disk = fs::read_to_string(&config_path).expect("config.toml should still exist");
        assert_eq!(
            on_disk, corrupt,
            "the original corrupt file must survive completely untouched"
        );
    }
}
