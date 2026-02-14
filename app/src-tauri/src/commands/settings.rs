use std::path::PathBuf;
use tauri::command;
use crate::models::*;

fn get_settings_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ai-factory")
        .join("settings.json")
}

fn default_settings() -> AppSettings {
    AppSettings {
        default_engine: "claude".to_string(),
        default_model: "sonnet".to_string(),
        max_daily_budget: 50.0,
        alert_at_budget: 30.0,
        loop_interval: 30,
        cycle_timeout: 1800,
        projects_dir: dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("ai-factory")
            .join("projects")
            .display()
            .to_string(),
        providers: vec![],
    }
}

#[command]
pub fn load_settings() -> Result<AppSettings, String> {
    let path = get_settings_path();
    if !path.exists() {
        let settings = default_settings();
        // Create parent dir and save defaults
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let json = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Serialize error: {}", e))?;
        let _ = std::fs::write(&path, &json);
        return Ok(settings);
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    let settings: AppSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Parse error: {}", e))?;
    Ok(settings)
}

#[command]
pub fn save_settings(settings: AppSettings) -> Result<bool, String> {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings dir: {}", e))?;
    }
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Serialize error: {}", e))?;
    std::fs::write(&path, &json)
        .map_err(|e| format!("Write error: {}", e))?;
    Ok(true)
}

// ===== Provider Management =====

#[command]
pub fn add_provider(provider: AiProvider) -> Result<AppSettings, String> {
    let mut settings = load_settings()?;

    // Check for duplicate
    if settings.providers.iter().any(|p| p.id == provider.id) {
        return Err(format!("Provider with id '{}' already exists", provider.id));
    }

    settings.providers.push(provider);
    save_settings(settings.clone())?;
    Ok(settings)
}

#[command]
pub fn update_provider(provider: AiProvider) -> Result<AppSettings, String> {
    let mut settings = load_settings()?;

    let idx = settings.providers.iter().position(|p| p.id == provider.id)
        .ok_or_else(|| format!("Provider '{}' not found", provider.id))?;

    settings.providers[idx] = provider;
    save_settings(settings.clone())?;
    Ok(settings)
}

#[command]
pub fn remove_provider(provider_id: String) -> Result<AppSettings, String> {
    let mut settings = load_settings()?;
    settings.providers.retain(|p| p.id != provider_id);
    save_settings(settings.clone())?;
    Ok(settings)
}

#[command]
pub fn test_provider(provider: AiProvider) -> Result<bool, String> {
    // Basic validation
    if provider.api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    if provider.api_base_url.is_empty() && provider.provider_type != "claude" {
        return Err("API base URL is required for non-Claude providers".to_string());
    }

    // For now, just validate the fields are present.
    // A full test would make an HTTP request to the provider's API.
    Ok(true)
}
