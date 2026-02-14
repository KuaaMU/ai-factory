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

/// Create a Command that suppresses visible console windows on Windows.
/// On non-Windows platforms this is a plain `Command::new()`.
#[cfg(target_os = "windows")]
pub(crate) fn silent_command(program: &str) -> Command {
    use std::os::windows::process::CommandExt;
    let mut cmd = Command::new(program);
    // CREATE_NO_WINDOW = 0x08000000
    cmd.creation_flags(0x08000000);
    cmd
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn silent_command(program: &str) -> Command {
    Command::new(program)
}

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
pub fn get_agent_memory(project_dir: String, role: String) -> Result<String, String> {
    let dir = PathBuf::from(&project_dir);
    let memory_path = dir.join(format!("memories/agents/{}/MEMORY.md", role));
    if !memory_path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&memory_path)
        .map_err(|e| format!("Failed to read agent memory: {}", e))
}

#[command]
pub fn get_handoff_note(project_dir: String) -> Result<String, String> {
    let dir = PathBuf::from(&project_dir);
    let handoff_path = dir.join("memories/HANDOFF.md");
    if !handoff_path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&handoff_path)
        .map_err(|e| format!("Failed to read handoff note: {}", e))
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
    // 1. Try app-level settings (stored providers)
    if let Ok(settings) = load_app_settings() {
        let provider_type = match engine {
            "claude" => "anthropic",
            "openai" | "codex" => "openai",
            other => other,
        };

        if let Some(provider) = settings
            .providers
            .iter()
            .find(|p| p.enabled && (p.provider_type == provider_type || p.provider_type == engine))
        {
            if !provider.api_key.is_empty() {
                let api_base_url = if provider.api_base_url.is_empty() {
                    match engine {
                        "claude" => "https://api.anthropic.com".to_string(),
                        "openai" | "codex" => "https://api.openai.com".to_string(),
                        _ => provider.api_base_url.clone(),
                    }
                } else {
                    provider.api_base_url.clone()
                };

                return Ok(ApiCredentials {
                    engine_type: provider_type.to_string(),
                    api_key: provider.api_key.clone(),
                    api_base_url,
                    model: model.to_string(),
                });
            }
        }
    }

    // 2. Try environment variables
    let env_configs = match engine {
        "claude" => vec![("ANTHROPIC_API_KEY", "anthropic", "https://api.anthropic.com")],
        "openai" | "codex" => vec![("OPENAI_API_KEY", "openai", "https://api.openai.com")],
        _ => vec![
            ("ANTHROPIC_API_KEY", "anthropic", "https://api.anthropic.com"),
            ("OPENAI_API_KEY", "openai", "https://api.openai.com"),
            ("OPENROUTER_API_KEY", "openrouter", "https://openrouter.ai/api/v1"),
        ],
    };

    for (env_var, engine_type, base_url) in &env_configs {
        if let Ok(key) = std::env::var(env_var) {
            if !key.trim().is_empty() {
                return Ok(ApiCredentials {
                    engine_type: engine_type.to_string(),
                    api_key: key.trim().to_string(),
                    api_base_url: base_url.to_string(),
                    model: model.to_string(),
                });
            }
        }
    }

    // 3. Try auto-detected providers
    if let Ok(detected) = crate::commands::provider_detect::detect_providers() {
        let provider_type = match engine {
            "claude" => "anthropic",
            "openai" | "codex" => "openai",
            other => other,
        };
        if let Some(dp) = detected.iter().find(|d| d.provider_type == provider_type) {
            return Ok(ApiCredentials {
                engine_type: dp.provider_type.clone(),
                api_key: dp.api_key.clone(),
                api_base_url: dp.api_base_url.clone(),
                model: model.to_string(),
            });
        }
    }

    Err(format!(
        "No API provider configured for engine '{}'. Add an {} provider with API key in Settings, set the {} env var, or have a config file available.",
        engine,
        match engine {
            "claude" => "Anthropic",
            "openai" | "codex" => "OpenAI",
            _ => engine,
        },
        match engine {
            "claude" => "ANTHROPIC_API_KEY",
            "openai" | "codex" => "OPENAI_API_KEY",
            _ => "API_KEY",
        }
    ))
}

fn load_app_settings() -> Result<AppSettings, String> {
    let path = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("omnihive")
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

    // 3. Load agent memory and handoff note from previous agent
    let agent_memory = load_agent_memory(dir, agent_role);
    let handoff_note = load_handoff(dir);

    // 4. Build focused prompts with memory and handoff context
    let system_prompt = build_system_prompt(&agent_content, agent_role, cycle, &agent_memory);
    let user_prompt = build_user_prompt(&consensus_content, &handoff_note);

    // 5. Call the appropriate API
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

    // 6. Try to extract and apply consensus update
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

    // 7. Extract and save agent's reflection/memory and handoff note
    let reflection = extract_reflection(&response.text);
    let new_handoff = extract_handoff(&response.text);

    if let Some(ref refl) = reflection {
        append_agent_memory(dir, agent_role, cycle, refl);
        append_log(dir, &format!("Agent {} saved reflection to memory", agent_role));
    }

    if let Some(ref handoff) = new_handoff {
        save_handoff(dir, agent_role, cycle, handoff);
        append_log(dir, &format!("Agent {} left handoff note for next agent", agent_role));
    } else {
        // Auto-generate a minimal handoff from the response
        let auto_handoff = truncate_string(&response.text, 500);
        save_handoff(dir, agent_role, cycle, &auto_handoff);
    }

    // 8. Check for skill requests and log them
    let skill_requests = extract_skill_requests(&response.text);
    if !skill_requests.is_empty() {
        append_log(dir, &format!("Agent {} requested skills: {}", agent_role, skill_requests.join(", ")));
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

fn build_system_prompt(agent_content: &str, role: &str, cycle: u32, agent_memory: &str) -> String {
    // Load relevant skills for this agent's role
    let skill_section = load_role_skills(role);

    // Include agent memory if available
    let memory_section = if agent_memory.is_empty() {
        String::new()
    } else {
        format!(
            "\n\n## Your Memory (from previous cycles)\n\n{}\n",
            agent_memory
        )
    };

    format!(
        r#"{agent_content}
{skill_section}{memory_section}
---

You are performing cycle {cycle} of the autonomous company loop.

YOUR TASK:
1. Read the current consensus document and the handoff note from the previous agent
2. From your perspective as the {role}, analyze the current state
3. Decide on actions aligned with the company mission
4. Output the COMPLETE updated consensus.md
5. Leave a REFLECTION about what you learned and a HANDOFF note for the next agent

If you need a specific skill not already provided, you can request it:
<<<SKILL_REQUEST>>>skill-name<<<SKILL_REQUEST_END>>>

OUTPUT FORMAT:
First, briefly state your analysis and decision (2-3 sentences).

Then output the FULL updated consensus.md between these markers:
<<<CONSENSUS_START>>>
[Full updated consensus.md content]
<<<CONSENSUS_END>>>

Then provide your reflection (what you learned, what went well/poorly):
<<<REFLECTION_START>>>
[Brief reflection on this cycle - what you decided and why, what you learned]
<<<REFLECTION_END>>>

Then leave a handoff note for the next agent:
<<<HANDOFF_START>>>
[Brief note about current priorities, blockers, and what the next agent should focus on]
<<<HANDOFF_END>>>

RULES:
- Output the COMPLETE consensus.md between the markers (not partial)
- Set the Cycle number to {cycle}
- Add your decision to the Decision Log table
- Update Current Focus and Next Action as needed
- Preserve all existing sections
- Be concise and actionable
- Your reflection will be saved to your personal memory for future cycles
- Your handoff note will be shown to the next agent in the chain"#,
        agent_content = agent_content,
        skill_section = skill_section,
        memory_section = memory_section,
        cycle = cycle,
        role = role,
    )
}

fn build_user_prompt(consensus_content: &str, handoff_note: &str) -> String {
    if handoff_note.is_empty() {
        format!("Current consensus.md:\n\n{}", consensus_content)
    } else {
        format!(
            "## Handoff from Previous Agent\n\n{}\n\n---\n\nCurrent consensus.md:\n\n{}",
            handoff_note, consensus_content
        )
    }
}

fn extract_consensus_update(response: &str) -> Option<String> {
    let content = extract_between_markers(response, "<<<CONSENSUS_START>>>", "<<<CONSENSUS_END>>>")?;

    // Validate the extracted content has required consensus sections
    if content.contains("## Company State")
        && content.contains("## Current Focus")
        && content.contains("## Decision Log")
        && content.len() > 100
    {
        Some(content)
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
        silent_command("where")
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
        silent_command("which")
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

// ===== Workspace-as-Memory (inspired by nanobot) =====

/// Load the last N reflections from an agent's personal memory file.
fn load_agent_memory(dir: &Path, role: &str) -> String {
    let memory_path = dir.join(format!("memories/agents/{}/MEMORY.md", role));
    if !memory_path.exists() {
        return String::new();
    }

    match std::fs::read_to_string(&memory_path) {
        Ok(content) => {
            // Return only the last 5 entries to keep context manageable
            let entries: Vec<&str> = content.split("\n---\n").collect();
            let start = if entries.len() > 5 { entries.len() - 5 } else { 0 };
            entries[start..].join("\n---\n")
        }
        Err(_) => String::new(),
    }
}

/// Append a reflection entry to the agent's personal memory file.
fn append_agent_memory(dir: &Path, role: &str, cycle: u32, reflection: &str) {
    let memory_dir = dir.join(format!("memories/agents/{}", role));
    let _ = std::fs::create_dir_all(&memory_dir);

    let memory_path = memory_dir.join("MEMORY.md");
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();

    let entry = format!(
        "\n---\n**Cycle {} | {}**\n\n{}\n",
        cycle, timestamp, reflection
    );

    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&memory_path)
    {
        use std::io::Write;
        let _ = file.write_all(entry.as_bytes());
    }
}

/// Load the handoff note left by the previous agent.
fn load_handoff(dir: &Path) -> String {
    let handoff_path = dir.join("memories/HANDOFF.md");
    std::fs::read_to_string(&handoff_path).unwrap_or_default()
}

/// Save a handoff note for the next agent in the chain.
fn save_handoff(dir: &Path, from_role: &str, cycle: u32, note: &str) {
    let handoff_path = dir.join("memories/HANDOFF.md");
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();
    let content = format!(
        "**From: {} | Cycle {} | {}**\n\n{}",
        from_role, cycle, timestamp, note
    );
    let _ = std::fs::write(handoff_path, content);
}

// ===== Reflection/Handoff Extraction =====

/// Extract reflection content from the API response.
fn extract_reflection(response: &str) -> Option<String> {
    let start = "<<<REFLECTION_START>>>";
    let end = "<<<REFLECTION_END>>>";
    extract_between_markers(response, start, end)
}

/// Extract handoff note from the API response.
fn extract_handoff(response: &str) -> Option<String> {
    let start = "<<<HANDOFF_START>>>";
    let end = "<<<HANDOFF_END>>>";
    extract_between_markers(response, start, end)
}

/// Generic marker extraction helper.
fn extract_between_markers(text: &str, start_marker: &str, end_marker: &str) -> Option<String> {
    let start_idx = text.find(start_marker)?;
    let content_start = start_idx + start_marker.len();
    let end_idx = text[content_start..].find(end_marker)?;
    let content = text[content_start..content_start + end_idx].trim();
    if content.is_empty() {
        None
    } else {
        Some(content.to_string())
    }
}

// ===== Phase 3: Skill Injection =====

/// Map agent role to relevant skill IDs for context injection.
fn role_to_skills(role: &str) -> Vec<&'static str> {
    match role {
        "ceo" => vec!["deep-research", "product-strategist", "market-sizing", "startup-financial-modeling", "premortem"],
        "fullstack" => vec!["code-review-security", "tdd-workflow", "frontend-patterns", "backend-patterns", "api-design"],
        "devops" => vec!["devops", "docker-patterns", "security-audit", "deployment-patterns"],
        "critic" => vec!["premortem", "financial-unit-economics", "security-review"],
        "product" => vec!["product-strategist", "deep-research", "market-sizing"],
        "ui" => vec!["frontend-patterns", "product-strategist"],
        "qa" => vec!["senior-qa", "tdd-workflow", "e2e-testing", "verification-loop"],
        "marketing" => vec!["seo-content-strategist", "competitive-intelligence", "content-strategy"],
        "operations" => vec!["micro-saas-launcher", "startup-financial-modeling"],
        "sales" => vec!["competitive-intelligence", "pricing-strategy"],
        "cfo" => vec!["financial-unit-economics", "pricing-strategy", "startup-financial-modeling"],
        "research" => vec!["deep-research", "competitive-intelligence", "market-sizing"],
        _ => vec![],
    }
}

/// Load skill summaries for a given role and format as a prompt section.
fn load_role_skills(role: &str) -> String {
    let skill_ids = role_to_skills(role);
    if skill_ids.is_empty() {
        return String::new();
    }

    let lib_dir = crate::commands::library::get_library_dir_pub();
    let mut skill_sections = Vec::new();

    for skill_id in &skill_ids {
        if let Some(summary) = load_skill_summary(skill_id, lib_dir.as_deref()) {
            skill_sections.push(format!("### {}\n{}", skill_id, summary));
        }
    }

    if skill_sections.is_empty() {
        return String::new();
    }

    format!("\n\n## Available Skills\n\n{}", skill_sections.join("\n\n"))
}

/// Load a brief summary of a skill from disk.
fn load_skill_summary(skill_id: &str, lib_dir: Option<&std::path::Path>) -> Option<String> {
    let lib = lib_dir?;

    // Try library/skills/{id}.yaml first
    let yaml_path = lib.join("skills").join(format!("{}.yaml", skill_id));
    if yaml_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&yaml_path) {
            // Extract description and first few capabilities
            let mut desc = String::new();
            let mut caps = Vec::new();
            let mut in_capabilities = false;

            for line in content.lines() {
                if let Some(rest) = line.strip_prefix("description:") {
                    desc = rest.trim().trim_matches('"').to_string();
                } else if line.trim() == "capabilities:" {
                    in_capabilities = true;
                } else if in_capabilities {
                    if let Some(cap) = line.trim().strip_prefix("- ") {
                        if caps.len() < 3 {
                            caps.push(cap.trim_matches('"').to_string());
                        }
                    } else if !line.starts_with(' ') {
                        in_capabilities = false;
                    }
                }
            }

            if !desc.is_empty() {
                let cap_text = if caps.is_empty() {
                    String::new()
                } else {
                    format!("\nCapabilities: {}", caps.join("; "))
                };
                return Some(format!("{}{}", desc, cap_text));
            }
        }
    }

    // Try real-skills/{id}/SKILL.md (first 5 content lines)
    let real_path = lib.join("real-skills").join(skill_id).join("SKILL.md");
    if real_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&real_path) {
            return Some(extract_skill_md_summary(&content));
        }
    }

    // Try ecc-skills/{id}/SKILL.md
    let ecc_path = lib.join("ecc-skills").join(skill_id).join("SKILL.md");
    if ecc_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&ecc_path) {
            return Some(extract_skill_md_summary(&content));
        }
    }

    None
}

/// Extract a brief summary from a SKILL.md file (frontmatter description + first content paragraph).
fn extract_skill_md_summary(content: &str) -> String {
    let mut description = String::new();

    // Parse frontmatter description
    if content.starts_with("---") {
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() >= 3 {
            for line in parts[1].lines() {
                if let Some(rest) = line.trim().strip_prefix("description:") {
                    description = rest.trim().to_string();
                    break;
                }
            }
        }
    }

    if description.is_empty() {
        // Fallback: first non-empty, non-heading line
        for line in content.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() && !trimmed.starts_with('#') && !trimmed.starts_with("---") {
                description = trimmed.to_string();
                break;
            }
        }
    }

    // Limit to ~300 chars to keep prompt manageable
    if description.len() > 300 {
        format!("{}...", &description[..300])
    } else {
        description
    }
}

/// Extract skill request markers from API response.
fn extract_skill_requests(response: &str) -> Vec<String> {
    let start = "<<<SKILL_REQUEST>>>";
    let end = "<<<SKILL_REQUEST_END>>>";
    let mut requests = Vec::new();

    let mut search_from = 0;
    while let Some(s_idx) = response[search_from..].find(start) {
        let abs_start = search_from + s_idx + start.len();
        if let Some(e_idx) = response[abs_start..].find(end) {
            let skill_name = response[abs_start..abs_start + e_idx].trim().to_string();
            if !skill_name.is_empty() {
                requests.push(skill_name);
            }
            search_from = abs_start + e_idx + end.len();
        } else {
            break;
        }
    }

    requests
}
