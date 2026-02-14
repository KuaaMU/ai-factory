use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::thread;
use std::time::{Duration, Instant};
use tauri::command;
use crate::models::*;

// Track running loops: project_dir -> stop_flag
static RUNNING_LOOPS: std::sync::LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

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
            // Previous loop was stopped but entry not cleaned up yet — allow restart
        }
    }

    // Resolve engine binary before spawning thread
    let engine_path = resolve_engine_binary(&engine)?;

    // Ensure log directory exists
    let _ = std::fs::create_dir_all(dir.join("logs"));

    // Write initial log
    append_log(&dir, &format!(
        "Starting loop | Engine: {} ({}) | Model: {}",
        engine, engine_path, model
    ));

    // Load project config for agent list and runtime settings
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

    // Spawn background thread for the loop
    let project_dir_clone = project_dir.clone();
    let engine_clone = engine.clone();
    thread::spawn(move || {
        run_loop(
            dir,
            project_dir_clone,
            engine_clone,
            engine_path,
            model,
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
        loops.get(&project_dir)
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
                write_state(&dir, "stopped", current_cycle, total_cycles, consecutive_errors).ok();
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
        return Ok(vec!["No log file yet. Start the loop to begin.".to_string()]);
    }

    let content = std::fs::read_to_string(&log_file)
        .map_err(|e| format!("Failed to read log: {}", e))?;

    if content.is_empty() {
        return Ok(vec!["Log file is empty. Waiting for activity...".to_string()]);
    }

    let all_lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let start = if all_lines.len() > lines { all_lines.len() - lines } else { 0 };

    Ok(all_lines[start..].to_vec())
}

// ===== Background loop logic =====

fn run_loop(
    dir: PathBuf,
    project_dir: String,
    engine_type: String,
    engine_path: String,
    model: String,
    agent_roles: Vec<String>,
    loop_interval: u32,
    cycle_timeout: u32,
    max_errors: u32,
    stop_flag: Arc<AtomicBool>,
) {
    let mut cycle: u32 = 0;
    let mut errors: u32 = 0;
    let mut history: Vec<CycleResult> = load_cycle_history(&dir);

    append_log(&dir, &format!(
        "Loop started | {} agents: [{}] | interval={}s timeout={}s max_errors={}",
        agent_roles.len(),
        agent_roles.join(", "),
        loop_interval,
        cycle_timeout,
        max_errors,
    ));

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            append_log(&dir, "Loop stopped by user");
            write_state(&dir, "stopped", cycle, cycle, errors).ok();
            break;
        }

        cycle += 1;
        let agent_idx = ((cycle - 1) as usize) % agent_roles.len();
        let current_agent = &agent_roles[agent_idx];

        append_log(&dir, &format!("=== Cycle {} | Agent: {} ===", cycle, current_agent));

        let started_at = chrono::Local::now().format("%+").to_string();
        write_state(&dir, "running", cycle, cycle, errors).ok();

        // Build the prompt for this agent
        let prompt = format!(
            "You are the {} agent. Read memories/consensus.md, perform your role, and update consensus with your findings.",
            current_agent
        );

        // Run the engine cycle with timeout
        let result = run_engine_cycle(&dir, &engine_type, &engine_path, &model, &prompt, cycle_timeout);

        let completed_at = chrono::Local::now().format("%+").to_string();

        match result {
            Ok(output) => {
                errors = 0;
                let preview = truncate_string(&output, 200);
                append_log(&dir, &format!("Cycle {} completed | Output: {}", cycle, preview));

                history.push(CycleResult {
                    cycle_number: cycle,
                    started_at,
                    completed_at,
                    agent_role: current_agent.clone(),
                    action: format!("Executed {} agent cycle", current_agent),
                    outcome: preview,
                    files_changed: vec![],
                    error: None,
                });
            }
            Err(err) => {
                errors += 1;
                append_log(&dir, &format!(
                    "ERROR: Cycle {} failed: {} (consecutive: {})",
                    cycle, err, errors
                ));

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
                    append_log(&dir, &format!(
                        "FATAL: Max consecutive errors ({}) reached. Stopping loop.",
                        max_errors
                    ));
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

fn run_engine_cycle(
    dir: &Path,
    engine_type: &str,
    engine_path: &str,
    model: &str,
    prompt: &str,
    timeout_secs: u32,
) -> Result<String, String> {
    let mut child = spawn_engine(dir, engine_type, engine_path, model, prompt)?;

    // Wait with timeout using try_wait polling
    let start = Instant::now();
    let timeout = Duration::from_secs(timeout_secs as u64);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let stdout = child.stdout.take()
                    .map(|mut s| {
                        let mut buf = String::new();
                        s.read_to_string(&mut buf).ok();
                        buf
                    })
                    .unwrap_or_default();

                let stderr = child.stderr.take()
                    .map(|mut s| {
                        let mut buf = String::new();
                        s.read_to_string(&mut buf).ok();
                        buf
                    })
                    .unwrap_or_default();

                if status.success() {
                    return Ok(stdout);
                } else {
                    let err_msg = if stderr.is_empty() {
                        format!("Process exited with status: {}", status)
                    } else {
                        truncate_string(&stderr, 500)
                    };
                    return Err(err_msg);
                }
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    return Err(format!("Cycle timed out after {} seconds", timeout_secs));
                }
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => {
                return Err(format!("Wait error: {}", e));
            }
        }
    }
}

fn spawn_engine(
    dir: &Path,
    engine_type: &str,
    engine_path: &str,
    model: &str,
    prompt: &str,
) -> Result<std::process::Child, String> {
    let mut args: Vec<String> = Vec::new();

    match engine_type {
        "claude" => {
            args.extend([
                "-p".to_string(),
                "--model".to_string(),
                model.to_string(),
                prompt.to_string(),
            ]);
        }
        "codex" => {
            args.extend([
                "--quiet".to_string(),
                prompt.to_string(),
            ]);
        }
        "opencode" => {
            args.push(prompt.to_string());
        }
        _ => {
            args.push(prompt.to_string());
        }
    }

    // On Windows, .cmd/.bat files must be run through cmd.exe
    #[cfg(target_os = "windows")]
    let mut cmd = if engine_path.ends_with(".cmd") || engine_path.ends_with(".bat") {
        let mut c = Command::new("cmd");
        c.arg("/C").arg(engine_path);
        c
    } else {
        Command::new(engine_path)
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new(engine_path);

    cmd.args(&args)
        .current_dir(dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    cmd.spawn()
        .map_err(|e| format!("Failed to start {} ({}): {}", engine_type, engine_path, e))
}

// ===== Engine binary resolution =====

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

// ===== Helper functions =====

fn load_project_config(dir: &Path) -> Result<FactoryConfig, String> {
    let config_path = dir.join("company.yaml");
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read company.yaml: {}", e))?;
    serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse company.yaml: {}", e))
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

fn write_state(dir: &Path, status: &str, cycle: u32, total: u32, errors: u32) -> Result<(), String> {
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
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
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
