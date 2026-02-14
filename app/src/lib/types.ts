// ===== Enums =====

export type ModelTier = "opus" | "sonnet" | "haiku";
export type Engine = "claude" | "codex";
export type AgentLayer = "strategy" | "engineering" | "product" | "business" | "intelligence";
export type ProjectStatus = "initializing" | "running" | "paused" | "stopped" | "error";

// ===== Core Config Types =====

export interface PersonaRef {
  readonly id: string;
  readonly custom_instructions: string;
}

export interface AgentConfig {
  readonly role: string;
  readonly persona: PersonaRef;
  readonly skills: readonly string[];
  readonly model: ModelTier;
  readonly layer: AgentLayer;
  readonly decides: readonly string[];
}

export interface WorkflowConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly chain: readonly string[];
  readonly convergence_cycles: number;
}

export interface ProviderConfig {
  readonly engine: Engine;
  readonly model: ModelTier;
  readonly api_key_env: string;
  readonly endpoint: string;
}

export interface BudgetConfig {
  readonly max_daily_usd: number;
  readonly alert_at_usd: number;
}

export interface RuntimeConfig {
  readonly providers: readonly ProviderConfig[];
  readonly failover: string;
  readonly budget: BudgetConfig;
  readonly loop_interval: number;
  readonly cycle_timeout: number;
  readonly max_consecutive_errors: number;
}

export interface GuardrailConfig {
  readonly forbidden: readonly string[];
  readonly workspace: string;
  readonly require_critic_review: boolean;
}

export interface CompanyConfig {
  readonly name: string;
  readonly mission: string;
  readonly description: string;
  readonly seed_prompt: string;
}

export interface OrgConfig {
  readonly agents: readonly AgentConfig[];
}

export interface FactoryConfig {
  readonly company: CompanyConfig;
  readonly org: OrgConfig;
  readonly workflows: readonly WorkflowConfig[];
  readonly runtime: RuntimeConfig;
  readonly guardrails: GuardrailConfig;
}

// ===== Seed Analysis =====

export interface SeedAnalysis {
  readonly domain: string;
  readonly audience: string;
  readonly complexity: "simple" | "medium" | "complex";
  readonly features: readonly string[];
  readonly suggested_roles: readonly string[];
  readonly team_size: number;
}

// ===== Runtime State =====

export interface CycleResult {
  readonly cycle_number: number;
  readonly started_at: string;
  readonly completed_at: string;
  readonly agent_role: string;
  readonly action: string;
  readonly outcome: string;
  readonly files_changed: readonly string[];
  readonly error: string | null;
}

export interface RuntimeStatus {
  readonly is_running: boolean;
  readonly pid: number | null;
  readonly current_cycle: number;
  readonly total_cycles: number;
  readonly consecutive_errors: number;
  readonly last_cycle_at: string | null;
  readonly uptime_seconds: number;
}

export interface ConsensusState {
  readonly company_name: string;
  readonly mission: string;
  readonly status: ProjectStatus;
  readonly cycle: number;
  readonly revenue: string;
  readonly current_focus: string;
  readonly active_projects: readonly string[];
  readonly next_action: string;
  readonly raw_content: string;
}

// ===== Library Types =====

export interface PersonaInfo {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly expertise: string;
  readonly mental_models: readonly string[];
  readonly core_capabilities: readonly string[];
}

export interface SkillInfo {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly source: "auto-company" | "ecc" | "custom";
  readonly content_preview: string;
}

export interface WorkflowInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly chain: readonly string[];
  readonly convergence_cycles: number;
}

// ===== Project =====

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly seed_prompt: string;
  readonly output_dir: string;
  readonly created_at: string;
  readonly last_active_at: string;
  readonly status: ProjectStatus;
  readonly agent_count: number;
  readonly cycle_count: number;
}

// ===== Generate Result =====

export interface GenerateResult {
  readonly output_dir: string;
  readonly files_created: readonly string[];
  readonly agent_count: number;
  readonly skill_count: number;
  readonly workflow_count: number;
}

// ===== App Settings =====

export interface AppSettings {
  readonly default_engine: string;
  readonly default_model: string;
  readonly max_daily_budget: number;
  readonly alert_at_budget: number;
  readonly loop_interval: number;
  readonly cycle_timeout: number;
  readonly projects_dir: string;
  readonly providers: readonly AiProvider[];
  readonly language: string;
}

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  readonly provider_type: string;
  readonly api_key: string;
  readonly api_base_url: string;
  readonly default_model: string;
  readonly enabled: boolean;
  readonly is_healthy: boolean;
  readonly last_error: string | null;
}

// ===== Tauri Command Results =====

export interface CommandResult<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}

// ===== System Environment =====

export interface SystemInfo {
  readonly os: string;
  readonly arch: string;
  readonly default_shell: string;
  readonly shells: readonly ShellInfo[];
  readonly tools: readonly ToolInfo[];
  readonly node_version: string | null;
  readonly npm_version: string | null;
}

export interface ShellInfo {
  readonly name: string;
  readonly path: string | null;
  readonly version: string | null;
  readonly available: boolean;
}

export interface ToolInfo {
  readonly name: string;
  readonly display_name: string;
  readonly available: boolean;
  readonly version: string | null;
  readonly path: string | null;
  readonly install_command: string;
  readonly install_url: string;
}
