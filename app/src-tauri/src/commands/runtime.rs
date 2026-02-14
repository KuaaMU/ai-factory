use std::path::PathBuf;
use std::process::Command;
use tauri::command;
use crate::models::*;

#[command]
pub fn start_loop(project_dir: String, engine: String, model: String) -> Result<u32, String> {
    let dir = PathBuf::from(&project_dir);

    // Check if already running
    let pid_file = dir.join(".loop.pid");
    if pid_file.exists() {
        let pid_str = std::fs::read_to_string(&pid_file).unwrap_or_default();
        if !pid_str.trim().is_empty() {
            return Err("Loop is already running".to_string());
        }
    }

    // Start the auto-loop process
    let script = if cfg!(target_os = "windows") {
        // On Windows, use bash through Git Bash or WSL
        let script_path = dir.join("scripts/auto-loop.sh");
        if script_path.exists() {
            Command::new("bash")
                .arg(script_path.to_str().unwrap())
                .env("ENGINE", &engine)
                .env("MODEL", &model)
                .current_dir(&dir)
                .spawn()
                .map_err(|e| format!("Failed to start loop: {}", e))?
        } else {
            // Use claude directly
            Command::new(&engine)
                .args(["--print", "--model", &model])
                .current_dir(&dir)
                .spawn()
                .map_err(|e| format!("Failed to start loop: {}", e))?
        }
    } else {
        let script_path = dir.join("scripts/auto-loop.sh");
        Command::new("bash")
            .arg(script_path.to_str().unwrap())
            .env("ENGINE", &engine)
            .env("MODEL", &model)
            .current_dir(&dir)
            .spawn()
            .map_err(|e| format!("Failed to start loop: {}", e))?
    };

    let pid = script.id();

    // Write PID file
    std::fs::write(&pid_file, pid.to_string())
        .map_err(|e| format!("Failed to write PID: {}", e))?;

    Ok(pid)
}

#[command]
pub fn stop_loop(project_dir: String) -> Result<bool, String> {
    let dir = PathBuf::from(&project_dir);
    let pid_file = dir.join(".loop.pid");

    if !pid_file.exists() {
        return Ok(false);
    }

    let pid_str = std::fs::read_to_string(&pid_file)
        .map_err(|e| format!("Failed to read PID: {}", e))?;
    let pid: u32 = pid_str.trim().parse()
        .map_err(|_| "Invalid PID".to_string())?;

    // Kill the process
    #[cfg(target_os = "windows")]
    {
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .map_err(|e| format!("Failed to stop: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("kill")
            .arg(pid.to_string())
            .output()
            .map_err(|e| format!("Failed to stop: {}", e))?;
    }

    // Remove PID file
    let _ = std::fs::remove_file(&pid_file);

    Ok(true)
}

#[command]
pub fn get_status(project_dir: String) -> Result<RuntimeStatus, String> {
    let dir = PathBuf::from(&project_dir);
    let pid_file = dir.join(".loop.pid");
    let state_file = dir.join(".loop.state");

    let is_running = pid_file.exists();
    let pid = if is_running {
        std::fs::read_to_string(&pid_file)
            .ok()
            .and_then(|s| s.trim().parse().ok())
    } else {
        None
    };

    // Parse state file if it exists
    let (current_cycle, total_cycles, consecutive_errors) = if state_file.exists() {
        let content = std::fs::read_to_string(&state_file).unwrap_or_default();
        let mut cc = 0u32;
        let mut tc = 0u32;
        let mut ce = 0u32;
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
        }
        (cc, tc, ce)
    } else {
        (0, 0, 0)
    };

    Ok(RuntimeStatus {
        is_running,
        pid,
        current_cycle,
        total_cycles,
        consecutive_errors,
        last_cycle_at: None,
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
    let cycles: Vec<CycleResult> = serde_json::from_str(&content)
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(cycles)
}

#[command]
pub fn tail_log(project_dir: String, lines: usize) -> Result<Vec<String>, String> {
    let dir = PathBuf::from(&project_dir);
    let log_file = dir.join("logs/auto-loop.log");

    if !log_file.exists() {
        return Ok(vec!["No log file found. Start the loop first.".to_string()]);
    }

    let content = std::fs::read_to_string(&log_file)
        .map_err(|e| format!("Failed to read log: {}", e))?;

    let all_lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let start = if all_lines.len() > lines { all_lines.len() - lines } else { 0 };

    Ok(all_lines[start..].to_vec())
}
