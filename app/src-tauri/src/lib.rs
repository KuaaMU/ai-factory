pub mod commands;
pub mod engine;
pub mod models;

use commands::bootstrap as bootstrap_cmd;
use commands::memory as memory_cmd;
use commands::runtime as runtime_cmd;
use commands::library as library_cmd;
use commands::settings as settings_cmd;
use commands::system as system_cmd;
use commands::provider_detect as provider_detect_cmd;
use commands::mcp as mcp_cmd;
use commands::skill_manager as skill_mgr_cmd;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            runtime_cmd::get_agent_memory,
            runtime_cmd::get_handoff_note,
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
            // Provider detection commands
            provider_detect_cmd::detect_providers,
            provider_detect_cmd::export_providers,
            provider_detect_cmd::import_providers,
            // System commands
            system_cmd::detect_system,
            system_cmd::install_tool,
            system_cmd::check_engine,
            // MCP commands
            mcp_cmd::list_mcp_servers,
            mcp_cmd::add_mcp_server,
            mcp_cmd::update_mcp_server,
            mcp_cmd::remove_mcp_server,
            mcp_cmd::get_mcp_presets,
            // Skill manager commands
            skill_mgr_cmd::scan_local_skills,
            skill_mgr_cmd::add_custom_skill,
            skill_mgr_cmd::remove_custom_skill,
            skill_mgr_cmd::add_custom_agent,
            skill_mgr_cmd::remove_custom_agent,
            skill_mgr_cmd::list_custom_agents,
            skill_mgr_cmd::list_custom_skills,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
