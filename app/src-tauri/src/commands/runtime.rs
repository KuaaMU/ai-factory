use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::collections::HashMap;
use tauri::command;
use crate::models::*;

// Track running processes globally
static RUNNING_PROCESSES: std::sync::LazyLock<Mutex<HashMap<String, u32>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

#[command]
pub fn start_loop(project_dir: String, engine: String, model: String) -> Result<u32, String> {
    let dir = PathBuf::from(&project_dir);

    // Validate project exists
    if !dir.join("company.yaml").exists() {
        return Err("Not a valid project directory (missing company.yaml)".to_string());
    }

    // Check if already running
    {
        let procs = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
        if procs.contains_key(&project_dir) {
            return Err("Loop is already running for this project".to_string());
        }
    }

    // Ensure log directory exists
    let _ = std::fs::create_dir_all(dir.join("logs"));

    // Write initial log entry
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let log_file = dir.join("logs/auto-loop.log");
    let init_log = format!("[{}] Starting auto-loop | Engine: {} | Model: {}\n", timestamp, engine, model);
    let _ = std::fs::write(&log_file, &init_log);

    // Update state to running
    write_state(&dir, "running", 0, 0, 0)?;

    // Start the process
    let script_path = dir.join("scripts/auto-loop.sh");
    let child = if script_path.exists() {
        // Use the generated script
        Command::new("bash")
            .arg(script_path.to_str().unwrap_or_default())
            .env("ENGINE", &engine)
            .env("MODEL", &model)
            .current_dir(&dir)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start loop: {}. Make sure bash is available.", e))?
    } else {
        // Direct claude invocation as fallback
        let prompt = "Read memories/consensus.md and perform your designated role. Update consensus with your findings.";
        Command::new(&engine)
            .args(["--print", "--model", &model, prompt])
            .current_dir(&dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start {}: {}", engine, e))?
    };

    let pid = child.id();

    // Write PID file
    std::fs::write(dir.join(".loop.pid"), pid.to_string())
        .map_err(|e| format!("Failed to write PID: {}", e))?;

    // Track in our process map
    {
        let mut procs = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
        procs.insert(project_dir, pid);
    }

    Ok(pid)
}

#[command]
pub fn stop_loop(project_dir: String) -> Result<bool, String> {
    let dir = PathBuf::from(&project_dir);

    // Get PID from file or process map
    let pid = {
        let mut procs = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
        let pid = procs.remove(&project_dir);
        pid
    }.or_else(|| {
        let pid_file = dir.join(".loop.pid");
        std::fs::read_to_string(&pid_file)
            .ok()
            .and_then(|s| s.trim().parse().ok())
    });

    let Some(pid) = pid else {
        return Ok(false);
    };

    // Kill the process tree
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .output();
    }

    // Clean up files
    let _ = std::fs::remove_file(dir.join(".loop.pid"));

    // Update state
    write_state(&dir, "stopped", 0, 0, 0).ok();

    // Log the stop
    append_log(&dir, "Loop stopped by user");

    Ok(true)
}

#[command]
pub fn get_status(project_dir: String) -> Result<RuntimeStatus, String> {
    let dir = PathBuf::from(&project_dir);
    let pid_file = dir.join(".loop.pid");
    let state_file = dir.join(".loop.state");

    // Check if PID file exists and process is alive
    let (is_running, pid) = if pid_file.exists() {
        let pid_str = std::fs::read_to_string(&pid_file).unwrap_or_default();
        let pid: Option<u32> = pid_str.trim().parse().ok();
        if let Some(p) = pid {
            let alive = is_process_alive(p);
            if !alive {
                // Process died, clean up
                let _ = std::fs::remove_file(&pid_file);
                (false, None)
            } else {
                (true, Some(p))
            }
        } else {
            (false, None)
        }
    } else {
        (false, None)
    };

    // Parse state file
    let (current_cycle, total_cycles, consecutive_errors, last_cycle_at) = if state_file.exists() {
        let content = std::fs::read_to_string(&state_file).unwrap_or_default();
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
    } else {
        (0, 0, 0, None)
    };

    Ok(RuntimeStatus {
        is_running,
        pid,
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
    let history_file = dir.join(".cycle_history.json");

    if !history_file.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&history_file)
        .map_err(|e| format!("Failed to read history: {}", e))?;

    if content.trim().is_empty() || content.trim() == "[]" {
        return Ok(Vec::new());
    }

    let cycles: Vec<CycleResult> = serde_json::from_str(&content)
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(cycles)
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

// ===== Helper functions =====

fn write_state(dir: &PathBuf, status: &str, cycle: u32, total: u32, errors: u32) -> Result<(), String> {
    let timestamp = chrono::Local::now().format("%+").to_string();
    let content = format!(
        "current_cycle={}\ntotal_cycles={}\nconsecutive_errors={}\nstatus={}\nlast_cycle_at={}\n",
        cycle, total, errors, status, timestamp
    );
    std::fs::write(dir.join(".loop.state"), content)
        .map_err(|e| format!("Failed to write state: {}", e))
}

fn append_log(dir: &PathBuf, message: &str) {
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

fn is_process_alive(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/NH"])
            .output()
            .map(|o| {
                let stdout = String::from_utf8_lossy(&o.stdout);
                stdout.contains(&pid.to_string())
            })
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}
