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
  ResolvedRuntimeConfig,
  McpServerConfig,
  McpPreset,
  ScannedSkill,
  AddSkillRequest,
  AddAgentRequest,
  AddWorkflowRequest,
  SkillRepo,
  RepoItem,
  LibraryState,
  ProjectRuntimeOverride,
  ProjectEvent,
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

export async function getSkillContent(skillId: string): Promise<string> {
  return invoke("get_skill_content", { skillId });
}

export async function toggleLibraryItem(
  itemType: string,
  itemId: string,
  enabled: boolean,
): Promise<boolean> {
  return invoke("toggle_library_item", { itemType, itemId, enabled });
}

export async function getLibraryState(): Promise<LibraryState> {
  return invoke("get_library_state");
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

export async function resolveRuntimeConfig(
  engine: string,
  model: string,
): Promise<ResolvedRuntimeConfig> {
  return invoke("resolve_runtime_config", { engine, model });
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

// ===== Skill Manager Commands =====

export async function scanLocalSkills(): Promise<readonly ScannedSkill[]> {
  return invoke("scan_local_skills");
}

export async function addCustomSkill(skill: AddSkillRequest): Promise<SkillInfo> {
  return invoke("add_custom_skill", { skill });
}

export async function removeCustomSkill(skillId: string): Promise<boolean> {
  return invoke("remove_custom_skill", { skillId });
}

export async function addCustomAgent(agent: AddAgentRequest): Promise<PersonaInfo> {
  return invoke("add_custom_agent", { agent });
}

export async function removeCustomAgent(agentId: string): Promise<boolean> {
  return invoke("remove_custom_agent", { agentId });
}

export async function listCustomAgents(): Promise<readonly PersonaInfo[]> {
  return invoke("list_custom_agents");
}

export async function listCustomSkills(): Promise<readonly SkillInfo[]> {
  return invoke("list_custom_skills");
}

export async function addCustomWorkflow(workflow: AddWorkflowRequest): Promise<WorkflowInfo> {
  return invoke("add_custom_workflow", { workflow });
}

export async function removeCustomWorkflow(workflowId: string): Promise<boolean> {
  return invoke("remove_custom_workflow", { workflowId });
}

export async function listCustomWorkflows(): Promise<readonly WorkflowInfo[]> {
  return invoke("list_custom_workflows");
}

// ===== Update Operations =====

export async function updateCustomAgent(agentId: string, agent: AddAgentRequest): Promise<PersonaInfo> {
  return invoke("update_custom_agent", { agentId, agent });
}

export async function updateCustomSkill(skillId: string, skill: AddSkillRequest): Promise<SkillInfo> {
  return invoke("update_custom_skill", { skillId, skill });
}

export async function updateCustomWorkflow(workflowId: string, workflow: AddWorkflowRequest): Promise<WorkflowInfo> {
  return invoke("update_custom_workflow", { workflowId, workflow });
}

// ===== Repo Manager Commands =====

export async function listSkillRepos(): Promise<readonly SkillRepo[]> {
  return invoke("list_skill_repos");
}

export async function addSkillRepo(repo: SkillRepo): Promise<AppSettings> {
  return invoke("add_skill_repo", { repo });
}

export async function removeSkillRepo(repoId: string): Promise<AppSettings> {
  return invoke("remove_skill_repo", { repoId });
}

export async function browseRepo(repoId: string, subpath: string): Promise<readonly RepoItem[]> {
  return invoke("browse_repo", { repoId, subpath });
}

export async function browseRepoSkills(repoId: string): Promise<readonly RepoItem[]> {
  return invoke("browse_repo_skills", { repoId });
}

export async function installRepoSkill(repoId: string, skillPath: string): Promise<SkillInfo> {
  return invoke("install_repo_skill", { repoId, skillPath });
}

// ===== Test API Call =====

export async function testApiCall(engine: string, model: string, message: string): Promise<string> {
  return invoke("test_api_call", { engine, model, message });
}

// ===== Per-Project Runtime Override =====

export async function getProjectRuntimeOverride(projectDir: string): Promise<ProjectRuntimeOverride> {
  return invoke("get_project_runtime_override", { projectDir });
}

export async function setProjectRuntimeOverride(projectDir: string, config: ProjectRuntimeOverride): Promise<boolean> {
  return invoke("set_project_runtime_override", { projectDir, config });
}

// ===== Project Events (Activity Feed) =====

export async function getProjectEvents(projectDir: string, limit?: number): Promise<readonly ProjectEvent[]> {
  return invoke("get_project_events", { projectDir, limit: limit ?? 50 });
}
