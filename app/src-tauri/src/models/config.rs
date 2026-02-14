use serde::{Deserialize, Serialize};

// ===== Enums =====

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ModelTier {
    Opus,
    Sonnet,
    Haiku,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Engine {
    Claude,
    Codex,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AgentLayer {
    Strategy,
    Engineering,
    Product,
    Business,
    Intelligence,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Complexity {
    Simple,
    Medium,
    Complex,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectStatus {
    Initializing,
    Running,
    Paused,
    Stopped,
    Error,
}

// ===== Config Structs =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaRef {
    pub id: String,
    #[serde(default)]
    pub custom_instructions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub role: String,
    pub persona: PersonaRef,
    #[serde(default)]
    pub skills: Vec<String>,
    pub model: ModelTier,
    pub layer: AgentLayer,
    #[serde(default)]
    pub decides: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub chain: Vec<String>,
    pub convergence_cycles: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub engine: Engine,
    pub model: ModelTier,
    #[serde(default)]
    pub api_key_env: String,
    #[serde(default)]
    pub endpoint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetConfig {
    pub max_daily_usd: f64,
    pub alert_at_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    pub providers: Vec<ProviderConfig>,
    #[serde(default = "default_failover")]
    pub failover: String,
    pub budget: BudgetConfig,
    #[serde(default = "default_loop_interval")]
    pub loop_interval: u32,
    #[serde(default = "default_cycle_timeout")]
    pub cycle_timeout: u32,
    #[serde(default = "default_max_errors")]
    pub max_consecutive_errors: u32,
}

fn default_failover() -> String { "auto".to_string() }
fn default_loop_interval() -> u32 { 30 }
fn default_cycle_timeout() -> u32 { 1800 }
fn default_max_errors() -> u32 { 5 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardrailConfig {
    pub forbidden: Vec<String>,
    #[serde(default = "default_workspace")]
    pub workspace: String,
    #[serde(default)]
    pub require_critic_review: bool,
}

fn default_workspace() -> String { "projects/".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyConfig {
    pub name: String,
    pub mission: String,
    #[serde(default)]
    pub description: String,
    pub seed_prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgConfig {
    pub agents: Vec<AgentConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactoryConfig {
    pub company: CompanyConfig,
    pub org: OrgConfig,
    pub workflows: Vec<WorkflowConfig>,
    pub runtime: RuntimeConfig,
    pub guardrails: GuardrailConfig,
}

// ===== Seed Analysis =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeedAnalysis {
    pub domain: String,
    pub audience: String,
    pub complexity: Complexity,
    pub features: Vec<String>,
    pub suggested_roles: Vec<String>,
    pub team_size: usize,
}

// ===== Runtime State =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeStatus {
    pub is_running: bool,
    pub pid: Option<u32>,
    pub current_cycle: u32,
    pub total_cycles: u32,
    pub consecutive_errors: u32,
    pub last_cycle_at: Option<String>,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CycleResult {
    pub cycle_number: u32,
    pub started_at: String,
    pub completed_at: String,
    pub agent_role: String,
    pub action: String,
    pub outcome: String,
    pub files_changed: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusState {
    pub company_name: String,
    pub mission: String,
    pub status: ProjectStatus,
    pub cycle: u32,
    pub revenue: String,
    pub current_focus: String,
    pub active_projects: Vec<String>,
    pub next_action: String,
    pub raw_content: String,
}

// ===== Library =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaInfo {
    pub id: String,
    pub name: String,
    pub role: String,
    pub expertise: String,
    pub mental_models: Vec<String>,
    pub core_capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub source: String,
    pub content_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub chain: Vec<String>,
    pub convergence_cycles: u32,
}

// ===== Project =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub seed_prompt: String,
    pub output_dir: String,
    pub created_at: String,
    pub last_active_at: String,
    pub status: ProjectStatus,
    pub agent_count: usize,
    pub cycle_count: u32,
}

// ===== Generate Result =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateResult {
    pub output_dir: String,
    pub files_created: Vec<String>,
    pub agent_count: usize,
    pub skill_count: usize,
    pub workflow_count: usize,
}

// ===== App Settings =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_engine: String,
    pub default_model: String,
    pub max_daily_budget: f64,
    pub alert_at_budget: f64,
    pub loop_interval: u32,
    pub cycle_timeout: u32,
    pub projects_dir: String,
    pub providers: Vec<AiProvider>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProvider {
    pub id: String,
    pub name: String,
    pub provider_type: String,
    pub api_key: String,
    pub api_base_url: String,
    pub default_model: String,
    pub enabled: bool,
    pub is_healthy: bool,
    pub last_error: Option<String>,
}

// ===== Log Event =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub agent: String,
    pub message: String,
}
