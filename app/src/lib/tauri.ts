import { invoke } from "@tauri-apps/api/core";
import type {
  SeedAnalysis,
  FactoryConfig,
  GenerateResult,
  RuntimeStatus,
  CycleResult,
  ConsensusState,
  PersonaInfo,
  SkillInfo,
  WorkflowInfo,
  Project,
  AppSettings,
  AiProvider,
  SystemInfo,
  DetectedProvider,
  McpServerConfig,
  McpPreset,
} from "./types";

// ===== Bootstrap Commands =====

export async function analyzeSeed(prompt: string): Promise<SeedAnalysis> {
  return invoke("analyze_seed", { prompt });
}

export async function bootstrap(
  prompt: string,
  outputDir: string,
): Promise<FactoryConfig> {
  return invoke("bootstrap", { prompt, outputDir });
}

// ===== Generator Commands =====

export async function generate(configPath: string): Promise<GenerateResult> {
  return invoke("generate", { configPath });
}

// ===== Runtime Commands =====

export async function startLoop(
  projectDir: string,
  engine: string,
  model: string,
): Promise<boolean> {
  return invoke("start_loop", { projectDir, engine, model });
}

export async function stopLoop(projectDir: string): Promise<boolean> {
  return invoke("stop_loop", { projectDir });
}

export async function getStatus(projectDir: string): Promise<RuntimeStatus> {
  return invoke("get_status", { projectDir });
}

export async function getCycleHistory(
  projectDir: string,
): Promise<readonly CycleResult[]> {
  return invoke("get_cycle_history", { projectDir });
}

export async function tailLog(
  projectDir: string,
  lines: number,
): Promise<readonly string[]> {
  return invoke("tail_log", { projectDir, lines });
}

export async function getAgentMemory(
  projectDir: string,
  role: string,
): Promise<string> {
  return invoke("get_agent_memory", { projectDir, role });
}

export async function getHandoffNote(
  projectDir: string,
): Promise<string> {
  return invoke("get_handoff_note", { projectDir });
}

// ===== Memory Commands =====

export async function readConsensus(
  projectDir: string,
): Promise<ConsensusState> {
  return invoke("read_consensus", { projectDir });
}

export async function updateConsensus(
  projectDir: string,
  content: string,
): Promise<boolean> {
  return invoke("update_consensus", { projectDir, content });
}

// ===== Library Commands =====

export async function listPersonas(): Promise<readonly PersonaInfo[]> {
  return invoke("list_personas");
}

export async function listSkills(): Promise<readonly SkillInfo[]> {
  return invoke("list_skills");
}

export async function listWorkflows(): Promise<readonly WorkflowInfo[]> {
  return invoke("list_workflows");
}

// ===== Project Commands =====

export async function listProjects(): Promise<readonly Project[]> {
  return invoke("list_projects");
}

export async function getProject(id: string): Promise<Project> {
  return invoke("get_project", { id });
}

export async function deleteProject(id: string): Promise<boolean> {
  return invoke("delete_project", { id });
}

// ===== Config Commands =====

export async function validateConfig(
  config: FactoryConfig,
): Promise<readonly string[]> {
  return invoke("validate_config", { config });
}

export async function saveConfig(
  config: FactoryConfig,
  path: string,
): Promise<boolean> {
  return invoke("save_config", { config, path });
}

// ===== Settings Commands =====

export async function loadSettings(): Promise<AppSettings> {
  return invoke("load_settings");
}

export async function saveSettings(settings: AppSettings): Promise<boolean> {
  return invoke("save_settings", { settings });
}

export async function addProvider(provider: AiProvider): Promise<AppSettings> {
  return invoke("add_provider", { provider });
}

export async function updateProvider(
  provider: AiProvider,
): Promise<AppSettings> {
  return invoke("update_provider", { provider });
}

export async function removeProvider(providerId: string): Promise<AppSettings> {
  return invoke("remove_provider", { providerId });
}

export async function testProvider(provider: AiProvider): Promise<boolean> {
  return invoke("test_provider", { provider });
}

// ===== System Commands =====

export async function detectSystem(): Promise<SystemInfo> {
  return invoke("detect_system");
}

export async function installTool(
  toolName: string,
  installDir?: string,
): Promise<string> {
  return invoke("install_tool", { toolName, installDir: installDir ?? null });
}

export async function checkEngine(engine: string): Promise<string> {
  return invoke("check_engine", { engine });
}

// ===== Provider Detection Commands =====

export async function detectProviders(): Promise<readonly DetectedProvider[]> {
  return invoke("detect_providers");
}

export async function exportProviders(providerIds: readonly string[]): Promise<string> {
  return invoke("export_providers", { providerIds });
}

export async function importProviders(json: string): Promise<AppSettings> {
  return invoke("import_providers", { json });
}

// ===== MCP Commands =====

export async function listMcpServers(): Promise<readonly McpServerConfig[]> {
  return invoke("list_mcp_servers");
}

export async function addMcpServer(server: McpServerConfig): Promise<AppSettings> {
  return invoke("add_mcp_server", { server });
}

export async function updateMcpServer(server: McpServerConfig): Promise<AppSettings> {
  return invoke("update_mcp_server", { server });
}

export async function removeMcpServer(serverId: string): Promise<AppSettings> {
  return invoke("remove_mcp_server", { serverId });
}

export async function getMcpPresets(): Promise<readonly McpPreset[]> {
  return invoke("get_mcp_presets");
}
