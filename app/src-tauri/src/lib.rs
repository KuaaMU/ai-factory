pub mod commands;
pub mod engine;
pub mod models;

use commands::bootstrap as bootstrap_cmd;
use commands::memory as memory_cmd;
use commands::runtime as runtime_cmd;
use commands::library as library_cmd;
use commands::settings as settings_cmd;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Bootstrap commands
            bootstrap_cmd::analyze_seed,
            bootstrap_cmd::bootstrap,
            bootstrap_cmd::generate,
            bootstrap_cmd::validate_config,
            bootstrap_cmd::save_config,
            // Memory commands
            memory_cmd::read_consensus,
            memory_cmd::update_consensus,
            memory_cmd::backup_consensus,
            // Runtime commands
            runtime_cmd::start_loop,
            runtime_cmd::stop_loop,
            runtime_cmd::get_status,
            runtime_cmd::get_cycle_history,
            runtime_cmd::tail_log,
            // Library commands
            library_cmd::list_personas,
            library_cmd::list_skills,
            library_cmd::list_workflows,
            library_cmd::list_projects,
            library_cmd::get_project,
            library_cmd::delete_project,
            // Settings commands
            settings_cmd::load_settings,
            settings_cmd::save_settings,
            settings_cmd::add_provider,
            settings_cmd::update_provider,
            settings_cmd::remove_provider,
            settings_cmd::test_provider,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
