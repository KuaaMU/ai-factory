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
): Promise<number> {
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
