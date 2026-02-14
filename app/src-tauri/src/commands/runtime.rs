use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::thread;
use std::time::Duration;
use tauri::command;
use crate::models::*;
use crate::engine::api_client;

// Track running loops: project_dir -> stop_flag
static RUNNING_LOOPS: std::sync::LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

/// API credentials resolved at loop start
struct ApiCredentials {
    engine_type: String,
    api_key: String,
    api_base_url: String,
    model: String,
}

// ===== Tauri Commands =====

#[command]
pub fn start_loop(project_dir: String, engine: String, model: String) -> Result<bool, String> {
    let dir = PathBuf::from(&project_dir);

    // Validate project exists
    if !dir.join("company.yaml").exists() {
        return Err("Not a valid project directory (missing company.yaml)".to_string());
    }

    // Check if already running
    {
        let loops = RUNNING_LOOPS.lock().map_err(|e| e.to_string())?;
        if let Some(flag) = loops.get(&project_dir) {
            if !flag.load(Ordering::Relaxed) {
                return Err("Loop is already running for this project".to_string());
            }
        }
    }

    // Resolve API credentials from settings
    let credentials = resolve_api_credentials(&engine, &model)?;

    // Ensure log directory exists
    let _ = std::fs::create_dir_all(dir.join("logs"));

    append_log(
        &dir,
        &format!(
            "Starting loop | Engine: {} | Model: {} | Mode: Direct API ({})",
            engine, model, credentials.api_base_url
        ),
    );

    // Load project config
    let config = load_project_config(&dir)?;
    let agent_roles: Vec<String> = config.org.agents.iter().map(|a| a.role.clone()).collect();
    let loop_interval = config.runtime.loop_interval;
    let cycle_timeout = config.runtime.cycle_timeout;
    let max_errors = config.runtime.max_consecutive_errors;

    // Update state to running
    write_state(&dir, "running", 0, 0, 0)?;

    // Create stop flag
    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_clone = Arc::clone(&stop_flag);

    // Store in running loops
    {
        let mut loops = RUNNING_LOOPS.lock().map_err(|e| e.to_string())?;
        loops.insert(project_dir.clone(), Arc::clone(&stop_flag));
    }

    // Spawn background thread
    let project_dir_clone = project_dir.clone();
    thread::spawn(move || {
        run_loop(
            dir,
            project_dir_clone,
            credentials,
            agent_roles,
            loop_interval,
            cycle_timeout,
            max_errors,
            stop_clone,
        );
    });

    Ok(true)
}

#[command]
pub fn stop_loop(project_dir: String) -> Result<bool, String> {
    let dir = PathBuf::from(&project_dir);

    let stopped = {
        let loops = RUNNING_LOOPS.lock().map_err(|e| e.to_string())?;
        if let Some(flag) = loops.get(&project_dir) {
            flag.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    };

    if stopped {
        append_log(&dir, "Stop signal sent by user");
        Ok(true)
    } else {
        // Clean up stale state if no loop is tracked
        write_state(&dir, "stopped", 0, 0, 0).ok();
        Ok(false)
    }
}

#[command]
pub fn get_status(project_dir: String) -> Result<RuntimeStatus, String> {
    let dir = PathBuf::from(&project_dir);
    let state_file = dir.join(".loop.state");

    // Check if loop is tracked as running
    let is_running = {
        let loops = RUNNING_LOOPS.lock().map_err(|e| e.to_string())?;
        loops
            .get(&project_dir)
            .map(|flag| !flag.load(Ordering::Relaxed))
            .unwrap_or(false)
    };

    // Parse state file for cycle info
    let (current_cycle, total_cycles, consecutive_errors, last_cycle_at) =
        parse_state_file(&state_file);

    // Clean up stale "running" state when loop is not actually tracked
    if !is_running {
        if let Ok(content) = std::fs::read_to_string(&state_file) {
            if content.contains("status=running") {
                write_state(
                    &dir,
                    "stopped",
                    current_cycle,
                    total_cycles,
                    consecutive_errors,
                )
                .ok();
            }
        }
        // Remove stale entries from the map
        if let Ok(mut loops) = RUNNING_LOOPS.lock() {
            if let Some(flag) = loops.get(&project_dir) {
                if flag.load(Ordering::Relaxed) {
                    loops.remove(&project_dir);
                }
            }
        }
    }

    Ok(RuntimeStatus {
        is_running,
        pid: None,
        current_cycle,
        total_cycles,
        consecutive_errors,
        last_cycle_at,
        uptime_seconds: 0,
    })
}

#[command]
pub fn get_cycle_history(project_dir: String) -> Result<Vec<CycleResult>, String> {
    let dir = PathBuf::from(&project_dir);
    Ok(load_cycle_history(&dir))
}

#[command]
pub fn tail_log(project_dir: String, lines: usize) -> Result<Vec<String>, String> {
    let dir = PathBuf::from(&project_dir);
    let log_file = dir.join("logs/auto-loop.log");

    if !log_file.exists() {
        return Ok(vec![
            "No log file yet. Start the loop to begin.".to_string()
        ]);
    }

    let content = std::fs::read_to_string(&log_file)
        .map_err(|e| format!("Failed to read log: {}", e))?;

    if content.is_empty() {
        return Ok(vec![
            "Log file is empty. Waiting for activity...".to_string()
        ]);
    }

    let all_lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let start = if all_lines.len() > lines {
        all_lines.len() - lines
    } else {
        0
    };

    Ok(all_lines[start..].to_vec())
}

// ===== API Credential Resolution =====

fn resolve_api_credentials(engine: &str, model: &str) -> Result<ApiCredentials, String> {
    let settings = load_app_settings()?;

    let provider_type = match engine {
        "claude" => "anthropic",
        "openai" | "codex" => "openai",
        other => other,
    };

    let provider = settings
        .providers
        .iter()
        .find(|p| p.enabled && (p.provider_type == provider_type || p.provider_type == engine))
        .ok_or_else(|| {
            format!(
                "No API provider configured for engine '{}'. Add an {} provider with API key in Settings.",
                engine,
                match engine {
                    "claude" => "Anthropic",
                    "openai" | "codex" => "OpenAI",
                    _ => engine,
                }
            )
        })?;

    if provider.api_key.is_empty() {
        return Err(format!(
            "API key is empty for provider '{}'. Configure it in Settings.",
            provider.name
        ));
    }

    let api_base_url = if provider.api_base_url.is_empty() {
        match engine {
            "claude" => "https://api.anthropic.com".to_string(),
            "openai" | "codex" => "https://api.openai.com".to_string(),
            _ => return Err("API base URL is required".to_string()),
        }
    } else {
        provider.api_base_url.clone()
    };

    Ok(ApiCredentials {
        engine_type: provider_type.to_string(),
        api_key: provider.api_key.clone(),
        api_base_url,
        model: model.to_string(),
    })
}

fn load_app_settings() -> Result<AppSettings, String> {
    let path = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ai-factory")
        .join("settings.json");

    if !path.exists() {
        return Err("Settings file not found. Please configure settings first.".to_string());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))
}

// ===== Background Loop =====

fn run_loop(
    dir: PathBuf,
    project_dir: String,
    credentials: ApiCredentials,
    agent_roles: Vec<String>,
    loop_interval: u32,
    cycle_timeout: u32,
    max_errors: u32,
    stop_flag: Arc<AtomicBool>,
) {
    let mut cycle: u32 = 0;
    let mut errors: u32 = 0;
    let mut history: Vec<CycleResult> = load_cycle_history(&dir);

    append_log(
        &dir,
        &format!(
            "Loop started | {} agents: [{}] | interval={}s timeout={}s max_errors={}",
            agent_roles.len(),
            agent_roles.join(", "),
            loop_interval,
            cycle_timeout,
            max_errors,
        ),
    );

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            append_log(&dir, "Loop stopped by user");
            write_state(&dir, "stopped", cycle, cycle, errors).ok();
            break;
        }

        cycle += 1;
        let agent_idx = ((cycle - 1) as usize) % agent_roles.len();
        let current_agent = &agent_roles[agent_idx];

        append_log(
            &dir,
            &format!("=== Cycle {} | Agent: {} ===", cycle, current_agent),
        );

        let started_at = chrono::Local::now().format("%+").to_string();
        write_state(&dir, "running", cycle, cycle, errors).ok();

        // Execute API cycle
        let result = run_api_cycle(&dir, &credentials, current_agent, cycle, cycle_timeout);

        let completed_at = chrono::Local::now().format("%+").to_string();

        match result {
            Ok((output, input_tokens, output_tokens)) => {
                errors = 0;
                let preview = truncate_string(&output, 200);
                append_log(
                    &dir,
                    &format!(
                        "Cycle {} completed | Tokens: {}in/{}out | Output: {}",
                        cycle, input_tokens, output_tokens, preview
                    ),
                );

                history.push(CycleResult {
                    cycle_number: cycle,
                    started_at,
                    completed_at,
                    agent_role: current_agent.clone(),
                    action: format!(
                        "{} analysis ({}+{} tokens)",
                        current_agent, input_tokens, output_tokens
                    ),
                    outcome: preview,
                    files_changed: vec![],
                    error: None,
                });
            }
            Err(err) => {
                errors += 1;
                append_log(
                    &dir,
                    &format!(
                        "ERROR: Cycle {} failed: {} (consecutive: {})",
                        cycle, err, errors
                    ),
                );

                history.push(CycleResult {
                    cycle_number: cycle,
                    started_at,
                    completed_at,
                    agent_role: current_agent.clone(),
                    action: format!("Attempted {} agent cycle", current_agent),
                    outcome: String::new(),
                    files_changed: vec![],
                    error: Some(err),
                });

                if errors >= max_errors {
                    append_log(
                        &dir,
                        &format!(
                            "FATAL: Max consecutive errors ({}) reached. Stopping loop.",
                            max_errors
                        ),
                    );
                    write_state(&dir, "error", cycle, cycle, errors).ok();
                    save_cycle_history(&dir, &history);
                    cleanup_loop(&project_dir);
                    return;
                }
            }
        }

        write_state(&dir, "running", cycle, cycle, errors).ok();
        save_cycle_history(&dir, &history);

        // Sleep with periodic stop-flag checks
        sleep_with_stop_check(loop_interval, &stop_flag);
    }

    // Clean up on normal exit
    cleanup_loop(&project_dir);
}

// ===== API Cycle Execution =====

fn run_api_cycle(
    dir: &Path,
    credentials: &ApiCredentials,
    agent_role: &str,
    cycle: u32,
    timeout_secs: u32,
) -> Result<(String, u32, u32), String> {
    // 1. Read agent file
    let agent_content = read_agent_file(dir, agent_role)?;

    // 2. Read current consensus
    let consensus_content = std::fs::read_to_string(dir.join("memories/consensus.md"))
        .map_err(|e| format!("Failed to read consensus: {}", e))?;

    // 3. Build focused prompts
    let system_prompt = build_system_prompt(&agent_content, agent_role, cycle);
    let user_prompt = build_user_prompt(&consensus_content);

    // 4. Call the appropriate API
    let response = match credentials.engine_type.as_str() {
        "anthropic" => api_client::call_anthropic(
            &credentials.api_key,
            &credentials.api_base_url,
            &credentials.model,
            &system_prompt,
            &user_prompt,
            timeout_secs,
        )?,
        "openai" => api_client::call_openai(
            &credentials.api_key,
            &credentials.api_base_url,
            &credentials.model,
            &system_prompt,
            &user_prompt,
            timeout_secs,
        )?,
        other => return Err(format!("Unsupported engine type: {}", other)),
    };

    // 5. Try to extract and apply consensus update
    if let Some(updated_consensus) = extract_consensus_update(&response.text) {
        // Backup existing consensus
        let backup_path = dir.join("memories/consensus.md.bak");
        let _ = std::fs::copy(dir.join("memories/consensus.md"), &backup_path);

        // Write updated consensus
        std::fs::write(dir.join("memories/consensus.md"), &updated_consensus)
            .map_err(|e| format!("Failed to write consensus: {}", e))?;

        append_log(dir, &format!("Consensus updated by {} agent", agent_role));
    } else {
        append_log(dir, "No structured consensus update in response (logged only)");
    }

    Ok((response.text, response.input_tokens, response.output_tokens))
}

fn read_agent_file(dir: &Path, role: &str) -> Result<String, String> {
    let agents_dir = dir.join(".claude/agents");
    let prefix = format!("{}-", role);

    if let Ok(entries) = std::fs::read_dir(&agents_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(&prefix) && name.ends_with(".md") {
                return std::fs::read_to_string(entry.path())
                    .map_err(|e| format!("Failed to read agent file: {}", e));
            }
        }
    }

    // Fallback: generate a basic prompt for the role
    Ok(format!(
        "# Agent: {role}\n\nYou are the {role} agent. Analyze the company state and provide recommendations from your area of expertise.",
        role = role
    ))
}

fn build_system_prompt(agent_content: &str, role: &str, cycle: u32) -> String {
    format!(
        r#"{agent_content}

---

You are performing cycle {cycle} of the autonomous company loop.

YOUR TASK:
1. Read the current consensus document provided below
2. From your perspective as the {role}, analyze the current state
3. Decide on actions aligned with the company mission
4. Output the COMPLETE updated consensus.md

OUTPUT FORMAT:
First, briefly state your analysis and decision (2-3 sentences).
Then output the FULL updated consensus.md between these markers:

<<<CONSENSUS_START>>>
[Full updated consensus.md content]
<<<CONSENSUS_END>>>

RULES:
- Output the COMPLETE consensus.md between the markers (not partial)
- Set the Cycle number to {cycle}
- Add your decision to the Decision Log table
- Update Current Focus and Next Action as needed
- Preserve all existing sections
- Be concise and actionable"#,
        agent_content = agent_content,
        cycle = cycle,
        role = role,
    )
}

fn build_user_prompt(consensus_content: &str) -> String {
    format!("Current consensus.md:\n\n{}", consensus_content)
}

fn extract_consensus_update(response: &str) -> Option<String> {
    let start_marker = "<<<CONSENSUS_START>>>";
    let end_marker = "<<<CONSENSUS_END>>>";

    let start_idx = response.find(start_marker)?;
    let end_idx = response.find(end_marker)?;

    if end_idx <= start_idx {
        return None;
    }

    let content = response[start_idx + start_marker.len()..end_idx].trim();

    // Validate the extracted content has required consensus sections
    if content.contains("## Company State")
        && content.contains("## Current Focus")
        && content.contains("## Decision Log")
        && content.len() > 100
    {
        Some(content.to_string())
    } else {
        None
    }
}

// ===== Engine Binary Resolution (used by system.rs) =====

pub fn resolve_engine_binary(engine: &str) -> Result<String, String> {
    let candidates: &[&str] = match engine {
        "claude" => &["claude"],
        "codex" => &["codex"],
        "opencode" => &["opencode"],
        _ => return Err(format!("Unknown engine: {}", engine)),
    };

    for candidate in candidates {
        if let Some(path) = find_binary(candidate) {
            return Ok(path);
        }
    }

    let install_hint = match engine {
        "claude" => "npm install -g @anthropic-ai/claude-code",
        "codex" => "npm install -g @openai/codex",
        "opencode" => "go install github.com/opencode-ai/opencode@latest",
        _ => "See documentation",
    };

    Err(format!(
        "{} CLI not found in PATH. Install with: {}",
        engine, install_hint
    ))
}

pub fn find_binary(name: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("where")
            .arg(name)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| {
                let out = String::from_utf8_lossy(&o.stdout);
                out.lines().next().map(|l| l.trim().to_string())
            })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("which")
            .arg(name)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| {
                let out = String::from_utf8_lossy(&o.stdout);
                out.lines().next().map(|l| l.trim().to_string())
            })
    }
}

// ===== Helper Functions =====

fn load_project_config(dir: &Path) -> Result<FactoryConfig, String> {
    let config_path = dir.join("company.yaml");
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read company.yaml: {}", e))?;
    serde_yaml::from_str(&content).map_err(|e| format!("Failed to parse company.yaml: {}", e))
}

fn load_cycle_history(dir: &Path) -> Vec<CycleResult> {
    let path = dir.join(".cycle_history.json");
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

fn save_cycle_history(dir: &Path, history: &[CycleResult]) {
    let path = dir.join(".cycle_history.json");
    if let Ok(json) = serde_json::to_string_pretty(history) {
        let _ = std::fs::write(path, json);
    }
}

fn write_state(
    dir: &Path,
    status: &str,
    cycle: u32,
    total: u32,
    errors: u32,
) -> Result<(), String> {
    let timestamp = chrono::Local::now().format("%+").to_string();
    let content = format!(
        "current_cycle={}\ntotal_cycles={}\nconsecutive_errors={}\nstatus={}\nlast_cycle_at={}\n",
        cycle, total, errors, status, timestamp
    );
    std::fs::write(dir.join(".loop.state"), content)
        .map_err(|e| format!("Failed to write state: {}", e))
}

fn parse_state_file(state_file: &Path) -> (u32, u32, u32, Option<String>) {
    let content = std::fs::read_to_string(state_file).unwrap_or_default();
    let mut cc = 0u32;
    let mut tc = 0u32;
    let mut ce = 0u32;
    let mut lca = None;

    for line in content.lines() {
        if let Some(val) = line.strip_prefix("current_cycle=") {
            cc = val.parse().unwrap_or(0);
        }
        if let Some(val) = line.strip_prefix("total_cycles=") {
            tc = val.parse().unwrap_or(0);
        }
        if let Some(val) = line.strip_prefix("consecutive_errors=") {
            ce = val.parse().unwrap_or(0);
        }
        if let Some(val) = line.strip_prefix("last_cycle_at=") {
            lca = Some(val.to_string());
        }
    }

    (cc, tc, ce, lca)
}

fn append_log(dir: &Path, message: &str) {
    let timestamp = chrono::Local::now()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    let entry = format!("[{}] {}\n", timestamp, message);
    let log_path = dir.join("logs/auto-loop.log");
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        use std::io::Write;
        let _ = file.write_all(entry.as_bytes());
    }
}

fn cleanup_loop(project_dir: &str) {
    if let Ok(mut loops) = RUNNING_LOOPS.lock() {
        loops.remove(project_dir);
    }
}

fn sleep_with_stop_check(seconds: u32, stop_flag: &Arc<AtomicBool>) {
    let total = Duration::from_secs(seconds as u64);
    let check = Duration::from_secs(1);
    let mut elapsed = Duration::ZERO;
    while elapsed < total {
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }
        thread::sleep(check);
        elapsed += check;
    }
}

fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}
