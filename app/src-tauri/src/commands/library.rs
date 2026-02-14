use std::path::PathBuf;
use tauri::command;
use crate::models::*;

fn get_registry_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("omnihive")
        .join("projects.json")
}

fn load_registry() -> ProjectRegistry {
    let path = get_registry_path();
    if !path.exists() {
        return ProjectRegistry::default();
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

fn save_registry(registry: &ProjectRegistry) -> Result<(), String> {
    let path = get_registry_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create registry dir: {}", e))?;
    }
    let json = serde_json::to_string_pretty(registry)
        .map_err(|e| format!("Serialize error: {}", e))?;
    std::fs::write(&path, &json)
        .map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

pub fn register_project(name: &str, output_dir: &str) -> Result<(), String> {
    let mut registry = load_registry();

    // Remove any existing entry with same output_dir
    registry.projects.retain(|p| p.output_dir != output_dir);

    let id = PathBuf::from(output_dir)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    registry.projects.push(ProjectRegistryEntry {
        id,
        name: name.to_string(),
        output_dir: output_dir.to_string(),
        created_at: chrono::Local::now().format("%+").to_string(),
    });

    save_registry(&registry)
}

// ===== Library base path =====

/// Public accessor for library directory resolution (used by runtime.rs skill injection).
pub fn get_library_dir_pub() -> Option<PathBuf> {
    get_library_dir()
}

/// Resolve the library directory. Checks for a local `library/` folder next to
/// the executable first, then falls back to a `library/` relative to CWD or
/// the omnihive source root.
fn get_library_dir() -> Option<PathBuf> {
    // Check relative to executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let lib = parent.join("library");
            if lib.exists() {
                return Some(lib);
            }
            // Tauri dev mode: exe is in target/debug, library is at project root
            let dev_lib = parent
                .parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
                .map(|p| p.join("library"));
            if let Some(ref dl) = dev_lib {
                if dl.exists() {
                    return dev_lib;
                }
            }
        }
    }

    // Check CWD
    let cwd_lib = PathBuf::from("library");
    if cwd_lib.exists() {
        return Some(cwd_lib);
    }

    // Known absolute paths (dev environment)
    let known = PathBuf::from("F:/omnihive/library");
    if known.exists() {
        return Some(known);
    }

    None
}

// ===== Persona loading =====

#[derive(serde::Deserialize)]
struct PersonaYaml {
    id: String,
    name: String,
    #[serde(default)]
    role: String,
    #[serde(default)]
    layer: String,
    #[serde(default)]
    mental_models: Vec<String>,
    #[serde(default)]
    core_capabilities: Vec<String>,
    #[serde(default)]
    communication_style: String,
    #[serde(default)]
    recommended_skills: Vec<String>,
}

fn load_personas_from_files() -> Option<Vec<PersonaInfo>> {
    let lib_dir = get_library_dir()?;
    let personas_dir = lib_dir.join("personas");
    if !personas_dir.exists() {
        return None;
    }

    let mut personas = Vec::new();
    let entries = std::fs::read_dir(&personas_dir).ok()?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name()?.to_string_lossy().to_string();

        // Skip index files
        if name.starts_with('_') || !name.ends_with(".yaml") {
            continue;
        }

        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(yaml) = serde_yaml::from_str::<PersonaYaml>(&content) {
                // Build a concise expertise string from communication_style or capabilities
                let expertise = if !yaml.communication_style.is_empty() {
                    yaml.communication_style.lines().next().unwrap_or("").trim().to_string()
                } else {
                    yaml.core_capabilities.first().cloned().unwrap_or_default()
                };

                // Extract short mental model names (before the " - " description)
                let short_models: Vec<String> = yaml
                    .mental_models
                    .iter()
                    .map(|m| {
                        m.split(" - ").next().unwrap_or(m).trim().to_string()
                    })
                    .collect();

                // Extract short capability names
                let short_caps: Vec<String> = yaml
                    .core_capabilities
                    .iter()
                    .map(|c| {
                        // Take just the first phrase/sentence
                        c.split('.').next().unwrap_or(c)
                            .split(',').next().unwrap_or(c)
                            .trim()
                            .to_string()
                    })
                    .take(4)
                    .collect();

                let tags = yaml.recommended_skills.clone();

                personas.push(PersonaInfo {
                    id: yaml.id,
                    name: yaml.name,
                    role: yaml.role,
                    expertise,
                    mental_models: short_models,
                    core_capabilities: short_caps,
                    enabled: true,
                    file_path: Some(path.display().to_string()),
                    tags,
                });
            }
        }
    }

    if personas.is_empty() {
        None
    } else {
        Some(personas)
    }
}

// ===== Skill loading =====

#[derive(serde::Deserialize)]
struct SkillYaml {
    id: String,
    name: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    capabilities: Vec<String>,
}

fn load_skills_from_files() -> Option<Vec<SkillInfo>> {
    let lib_dir = get_library_dir()?;
    let mut skills = Vec::new();

    // 1. Load from library/skills/*.yaml (auto-company skills)
    let skills_dir = lib_dir.join("skills");
    if skills_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&skills_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if name.starts_with('_') || !name.ends_with(".yaml") {
                    continue;
                }
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(yaml) = serde_yaml::from_str::<SkillYaml>(&content) {
                        skills.push(SkillInfo {
                            id: yaml.id.clone(),
                            name: yaml.name,
                            category: yaml.category,
                            description: yaml.description,
                            source: "auto-company".to_string(),
                            content_preview: yaml.capabilities.first().cloned().unwrap_or_default(),
                            enabled: true,
                            file_path: Some(path.display().to_string()),
                            tags: vec![],
                        });
                    }
                }
            }
        }
    }

    // 2. Load from library/real-skills/*/SKILL.md
    let real_skills_dir = lib_dir.join("real-skills");
    if real_skills_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&real_skills_dir) {
            for entry in entries.flatten() {
                let dir_path = entry.path();
                if !dir_path.is_dir() {
                    continue;
                }
                let skill_md = dir_path.join("SKILL.md");
                if !skill_md.exists() {
                    continue;
                }
                let dir_name = dir_path.file_name().unwrap_or_default().to_string_lossy().to_string();

                // Already loaded from yaml?
                if skills.iter().any(|s| s.id == dir_name) {
                    // Update the existing entry with file path
                    if let Some(existing) = skills.iter_mut().find(|s| s.id == dir_name) {
                        existing.file_path = Some(skill_md.display().to_string());
                    }
                    continue;
                }

                // Parse SKILL.md frontmatter for name and description
                if let Ok(content) = std::fs::read_to_string(&skill_md) {
                    let (name, desc) = parse_skill_md_frontmatter(&content);
                    let preview = content.lines()
                        .filter(|l| !l.starts_with('#') && !l.starts_with("---") && !l.trim().is_empty())
                        .take(1)
                        .collect::<Vec<_>>()
                        .join("");
                    skills.push(SkillInfo {
                        id: dir_name,
                        name,
                        category: "General".to_string(),
                        description: desc,
                        source: "real-skills".to_string(),
                        content_preview: truncate(&preview, 150),
                        enabled: true,
                        file_path: Some(skill_md.display().to_string()),
                        tags: vec![],
                    });
                }
            }
        }
    }

    // 3. Load from library/ecc-skills/*/SKILL.md
    let ecc_skills_dir = lib_dir.join("ecc-skills");
    if ecc_skills_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&ecc_skills_dir) {
            for entry in entries.flatten() {
                let dir_path = entry.path();
                if !dir_path.is_dir() {
                    continue;
                }
                let skill_md = dir_path.join("SKILL.md");
                if !skill_md.exists() {
                    continue;
                }
                let dir_name = dir_path.file_name().unwrap_or_default().to_string_lossy().to_string();

                if skills.iter().any(|s| s.id == dir_name) {
                    continue;
                }

                if let Ok(content) = std::fs::read_to_string(&skill_md) {
                    let (name, desc) = parse_skill_md_frontmatter(&content);
                    let preview = content.lines()
                        .filter(|l| !l.starts_with('#') && !l.starts_with("---") && !l.trim().is_empty())
                        .take(1)
                        .collect::<Vec<_>>()
                        .join("");
                    skills.push(SkillInfo {
                        id: dir_name,
                        name,
                        category: "Engineering".to_string(),
                        description: desc,
                        source: "ecc".to_string(),
                        content_preview: truncate(&preview, 150),
                        enabled: true,
                        file_path: Some(skill_md.display().to_string()),
                        tags: vec![],
                    });
                }
            }
        }
    }

    if skills.is_empty() {
        None
    } else {
        Some(skills)
    }
}

/// Parse SKILL.md YAML frontmatter for name and description.
fn parse_skill_md_frontmatter(content: &str) -> (String, String) {
    let mut name = String::new();
    let mut desc = String::new();

    if content.starts_with("---") {
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() >= 3 {
            let frontmatter = parts[1];
            for line in frontmatter.lines() {
                let trimmed = line.trim();
                if let Some(rest) = trimmed.strip_prefix("name:") {
                    name = rest.trim().to_string();
                } else if let Some(rest) = trimmed.strip_prefix("description:") {
                    desc = rest.trim().to_string();
                }
            }
        }
    }

    // Fallback: use first H1 heading as name
    if name.is_empty() {
        for line in content.lines() {
            if let Some(heading) = line.strip_prefix("# ") {
                name = heading.trim().to_string();
                break;
            }
        }
    }

    if name.is_empty() {
        name = "Unnamed Skill".to_string();
    }

    (name, desc)
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}...", &s[..max])
    }
}

// ===== Workflow loading =====

#[derive(serde::Deserialize)]
struct WorkflowYaml {
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    chain: Vec<WorkflowStepYaml>,
    #[serde(default = "default_convergence")]
    convergence_cycles: u32,
}

#[derive(serde::Deserialize)]
struct WorkflowStepYaml {
    role: String,
    #[serde(default)]
    persona: String,
}

fn default_convergence() -> u32 { 1 }

fn load_workflows_from_files() -> Option<Vec<WorkflowInfo>> {
    let lib_dir = get_library_dir()?;
    let workflows_dir = lib_dir.join("workflows");
    if !workflows_dir.exists() {
        return None;
    }

    let mut workflows = Vec::new();
    let entries = std::fs::read_dir(&workflows_dir).ok()?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name()?.to_string_lossy().to_string();
        if !name.ends_with(".yaml") {
            continue;
        }

        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(yaml) = serde_yaml::from_str::<WorkflowYaml>(&content) {
                let chain: Vec<String> = yaml.chain.iter().map(|s| s.role.clone()).collect();
                workflows.push(WorkflowInfo {
                    id: yaml.id,
                    name: yaml.name,
                    description: yaml.description,
                    chain,
                    convergence_cycles: yaml.convergence_cycles,
                    enabled: true,
                    file_path: Some(path.display().to_string()),
                    tags: vec![],
                });
            }
        }
    }

    if workflows.is_empty() {
        None
    } else {
        Some(workflows)
    }
}

// ===== Tauri Commands =====

#[command]
pub fn list_personas() -> Result<Vec<PersonaInfo>, String> {
    if let Some(personas) = load_personas_from_files() {
        return Ok(personas);
    }
    // Fallback to hardcoded defaults
    Ok(fallback_personas())
}

#[command]
pub fn list_skills() -> Result<Vec<SkillInfo>, String> {
    if let Some(skills) = load_skills_from_files() {
        return Ok(skills);
    }
    Ok(fallback_skills())
}

#[command]
pub fn list_workflows() -> Result<Vec<WorkflowInfo>, String> {
    if let Some(workflows) = load_workflows_from_files() {
        return Ok(workflows);
    }
    Ok(fallback_workflows())
}

// ===== Hardcoded Fallbacks =====

fn default_lib_fields() -> (bool, Option<String>, Vec<String>) {
    (true, None, vec![])
}

fn fallback_personas() -> Vec<PersonaInfo> {
    let (enabled, file_path, tags) = default_lib_fields();
    vec![
        PersonaInfo { id: "jeff-bezos".into(), name: "Jeff Bezos".into(), role: "ceo".into(), expertise: "Customer-obsessed leader. Uses PR/FAQ, flywheel thinking, Day 1 mindset.".into(), mental_models: vec!["PR/FAQ".into(), "Flywheel Effect".into(), "Day 1 Mindset".into()], core_capabilities: vec!["Strategic decisions".into(), "Resource allocation".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "dhh".into(), name: "David Heinemeier Hansson".into(), role: "fullstack".into(), expertise: "Creator of Ruby on Rails. Pragmatic, opinionated developer.".into(), mental_models: vec!["Convention over Configuration".into(), "Majestic Monolith".into()], core_capabilities: vec!["Full-stack development".into(), "Architecture decisions".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "kelsey-hightower".into(), name: "Kelsey Hightower".into(), role: "devops".into(), expertise: "Cloud-native expert. Kubernetes, infrastructure as code.".into(), mental_models: vec!["Infrastructure as Code".into(), "12-Factor App".into()], core_capabilities: vec!["DevOps pipelines".into(), "Cloud deployment".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "charlie-munger".into(), name: "Charlie Munger".into(), role: "critic".into(), expertise: "Inversion thinking, mental models, finding flaws.".into(), mental_models: vec!["Inversion".into(), "Second-Order Thinking".into()], core_capabilities: vec!["Risk assessment".into(), "Pre-mortem analysis".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "don-norman".into(), name: "Don Norman".into(), role: "product".into(), expertise: "Father of UX design. Human-centered design, usability.".into(), mental_models: vec!["Human-Centered Design".into(), "Affordances".into()], core_capabilities: vec!["User research".into(), "Product strategy".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "matias-duarte".into(), name: "Matias Duarte".into(), role: "ui".into(), expertise: "Material Design creator. Visual systems thinker.".into(), mental_models: vec!["Material Design".into(), "Design Systems".into()], core_capabilities: vec!["UI design".into(), "Design systems".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "james-bach".into(), name: "James Bach".into(), role: "qa".into(), expertise: "Exploratory testing pioneer.".into(), mental_models: vec!["Exploratory Testing".into(), "Risk-Based Testing".into()], core_capabilities: vec!["Test strategy".into(), "Bug hunting".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "seth-godin".into(), name: "Seth Godin".into(), role: "marketing".into(), expertise: "Permission marketing, Purple Cow, Tribes.".into(), mental_models: vec!["Purple Cow".into(), "Permission Marketing".into()], core_capabilities: vec!["Brand strategy".into(), "Content marketing".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "paul-graham".into(), name: "Paul Graham".into(), role: "operations".into(), expertise: "Y Combinator founder. Do things that don't scale.".into(), mental_models: vec!["Do Things That Don't Scale".into(), "Ramen Profitability".into()], core_capabilities: vec!["Startup operations".into(), "Product-market fit".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "aaron-ross".into(), name: "Aaron Ross".into(), role: "sales".into(), expertise: "Predictable Revenue author.".into(), mental_models: vec!["Predictable Revenue".into(), "Sales Assembly Line".into()], core_capabilities: vec!["Sales strategy".into(), "Pipeline building".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "patrick-campbell".into(), name: "Patrick Campbell".into(), role: "cfo".into(), expertise: "ProfitWell founder. SaaS metrics, pricing strategy.".into(), mental_models: vec!["Unit Economics".into(), "Value-Based Pricing".into()], core_capabilities: vec!["Financial modeling".into(), "Pricing strategy".into()], enabled, file_path: file_path.clone(), tags: tags.clone() },
        PersonaInfo { id: "ben-thompson".into(), name: "Ben Thompson".into(), role: "research".into(), expertise: "Stratechery author. Aggregation theory, platform dynamics.".into(), mental_models: vec!["Aggregation Theory".into(), "Platform Dynamics".into()], core_capabilities: vec!["Market research".into(), "Competitive analysis".into()], enabled, file_path, tags },
    ]
}

fn fallback_skills() -> Vec<SkillInfo> {
    let (enabled, file_path, tags) = default_lib_fields();
    let mut skills = Vec::new();

    let auto_company = vec![
        ("deep-research", "Research", "Comprehensive research methodology"),
        ("product-strategist", "Product", "Product strategy framework"),
        ("market-sizing", "Business", "TAM/SAM/SOM market sizing"),
        ("startup-financial-modeling", "Finance", "Financial modeling for startups"),
        ("micro-saas-launcher", "Operations", "Micro-SaaS launch playbook"),
        ("premortem", "Strategy", "Pre-mortem analysis"),
        ("code-review-security", "Engineering", "Security-focused code review"),
        ("devops", "Engineering", "DevOps pipeline setup"),
        ("senior-qa", "Engineering", "Senior QA testing strategy"),
        ("security-audit", "Security", "Security audit framework"),
        ("competitive-intelligence", "Business", "Competitive intelligence"),
        ("financial-unit-economics", "Finance", "Unit economics analysis"),
        ("seo-content-strategist", "Marketing", "SEO and content strategy"),
        ("pricing-strategy", "Business", "Pricing strategy framework"),
        ("web-scraping", "Engineering", "Web scraping tools"),
    ];

    for (id, category, description) in auto_company {
        skills.push(SkillInfo { id: id.into(), name: id.replace('-', " "), category: category.into(), description: description.into(), source: "auto-company".into(), content_preview: String::new(), enabled, file_path: file_path.clone(), tags: tags.clone() });
    }

    let ecc = vec![
        ("tdd-workflow", "Engineering", "Test-driven development workflow"),
        ("security-review", "Security", "Security vulnerability review"),
        ("security-scan", "Security", "Automated security scanning"),
        ("python-patterns", "Engineering", "Python design patterns"),
        ("golang-patterns", "Engineering", "Go design patterns"),
        ("postgres-patterns", "Engineering", "PostgreSQL query patterns"),
        ("docker-patterns", "Engineering", "Docker containerization patterns"),
        ("api-design", "Engineering", "REST API design best practices"),
        ("frontend-patterns", "Engineering", "Frontend architecture patterns"),
        ("backend-patterns", "Engineering", "Backend architecture patterns"),
        ("e2e-testing", "Engineering", "End-to-end testing strategies"),
        ("coding-standards", "Engineering", "Code quality standards"),
        ("verification-loop", "Engineering", "Verification loop for code changes"),
    ];

    for (id, category, description) in ecc {
        skills.push(SkillInfo { id: id.into(), name: id.replace('-', " "), category: category.into(), description: description.into(), source: "ecc".into(), content_preview: String::new(), enabled, file_path: file_path.clone(), tags: tags.clone() });
    }

    skills
}

fn fallback_workflows() -> Vec<WorkflowInfo> {
    let (enabled, file_path, tags) = default_lib_fields();
    vec![
        WorkflowInfo { id: "pricing-monetization".into(), name: "Pricing & Monetization".into(), description: "End-to-end pricing strategy workflow.".into(), chain: vec!["research".into(), "cfo".into(), "product".into(), "marketing".into(), "critic".into(), "cfo".into()], convergence_cycles: 2, enabled, file_path: file_path.clone(), tags: tags.clone() },
        WorkflowInfo { id: "product-launch".into(), name: "Product Launch".into(), description: "Coordinated product launch workflow.".into(), chain: vec!["marketing".into(), "research".into(), "sales".into(), "marketing".into(), "devops".into(), "ceo".into()], convergence_cycles: 2, enabled, file_path: file_path.clone(), tags: tags.clone() },
        WorkflowInfo { id: "weekly-review".into(), name: "Weekly Review".into(), description: "Weekly strategic review cycle.".into(), chain: vec!["research".into(), "cfo".into(), "marketing".into(), "qa".into(), "ceo".into(), "critic".into()], convergence_cycles: 1, enabled, file_path: file_path.clone(), tags: tags.clone() },
        WorkflowInfo { id: "new-product-eval".into(), name: "New Product Evaluation".into(), description: "Evaluate new product ideas.".into(), chain: vec!["research".into(), "product".into(), "cfo".into(), "critic".into(), "ceo".into()], convergence_cycles: 2, enabled, file_path: file_path.clone(), tags: tags.clone() },
        WorkflowInfo { id: "feature-development".into(), name: "Feature Development".into(), description: "End-to-end feature development.".into(), chain: vec!["product".into(), "fullstack".into(), "qa".into(), "devops".into()], convergence_cycles: 1, enabled, file_path: file_path.clone(), tags: tags.clone() },
        WorkflowInfo { id: "opportunity-discovery".into(), name: "Opportunity Discovery".into(), description: "Discover and validate market opportunities.".into(), chain: vec!["research".into(), "marketing".into(), "sales".into(), "cfo".into(), "ceo".into()], convergence_cycles: 2, enabled, file_path, tags },
    ]
}

// ===== Project Management (registry-based) =====

#[command]
pub fn list_projects() -> Result<Vec<Project>, String> {
    let registry = load_registry();
    let mut projects = Vec::new();

    for entry in &registry.projects {
        let path = PathBuf::from(&entry.output_dir);
        let config_path = path.join("company.yaml");

        if !config_path.exists() {
            continue;
        }

        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if let Ok(config) = serde_yaml::from_str::<crate::models::FactoryConfig>(&content) {
                let status = if path.join(".loop.pid").exists() {
                    ProjectStatus::Running
                } else if path.join(".loop.state").exists() {
                    let state = std::fs::read_to_string(path.join(".loop.state")).unwrap_or_default();
                    if state.contains("status=error") {
                        ProjectStatus::Error
                    } else {
                        ProjectStatus::Stopped
                    }
                } else {
                    ProjectStatus::Initializing
                };

                let cycle_count = path.join(".cycle_history.json")
                    .pipe(|p| std::fs::read_to_string(p).ok())
                    .and_then(|c| serde_json::from_str::<Vec<serde_json::Value>>(&c).ok())
                    .map(|v| v.len() as u32)
                    .unwrap_or(0);

                projects.push(Project {
                    id: entry.id.clone(),
                    name: config.company.name,
                    seed_prompt: config.company.seed_prompt,
                    output_dir: entry.output_dir.clone(),
                    created_at: entry.created_at.clone(),
                    last_active_at: entry.created_at.clone(),
                    status,
                    agent_count: config.org.agents.len(),
                    cycle_count,
                });
            }
        }
    }

    Ok(projects)
}

#[command]
pub fn get_project(id: String) -> Result<Project, String> {
    let projects = list_projects()?;
    projects.into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("Project not found: {}", id))
}

#[command]
pub fn delete_project(id: String) -> Result<bool, String> {
    let mut registry = load_registry();

    let entry = registry.projects.iter().find(|p| p.id == id).cloned();

    if let Some(entry) = entry {
        let path = PathBuf::from(&entry.output_dir);
        if path.exists() {
            std::fs::remove_dir_all(&path)
                .map_err(|e| format!("Failed to delete: {}", e))?;
        }
        registry.projects.retain(|p| p.id != id);
        save_registry(&registry)?;
        Ok(true)
    } else {
        Ok(false)
    }
}

// Helper trait for pipe
trait Pipe: Sized {
    fn pipe<F, R>(self, f: F) -> R where F: FnOnce(Self) -> R {
        f(self)
    }
}
impl<T> Pipe for T {}
