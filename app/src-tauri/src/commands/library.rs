use std::path::PathBuf;
use tauri::command;
use crate::models::*;

fn get_registry_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ai-factory")
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

// ===== Persona / Skill / Workflow commands (unchanged) =====

#[command]
pub fn list_personas() -> Result<Vec<PersonaInfo>, String> {
    Ok(vec![
        PersonaInfo {
            id: "jeff-bezos".to_string(),
            name: "Jeff Bezos".to_string(),
            role: "ceo".to_string(),
            expertise: "Customer-obsessed leader. Uses PR/FAQ, flywheel thinking, Day 1 mindset.".to_string(),
            mental_models: vec!["PR/FAQ".to_string(), "Flywheel Effect".to_string(), "Day 1 Mindset".to_string(), "Two-Pizza Teams".to_string(), "Regret Minimization".to_string()],
            core_capabilities: vec!["Strategic decisions".to_string(), "Resource allocation".to_string(), "Business model design".to_string()],
        },
        PersonaInfo {
            id: "dhh".to_string(),
            name: "David Heinemeier Hansson".to_string(),
            role: "fullstack".to_string(),
            expertise: "Creator of Ruby on Rails. Pragmatic, opinionated developer who ships fast.".to_string(),
            mental_models: vec!["Convention over Configuration".to_string(), "Majestic Monolith".to_string(), "Boring Technology".to_string()],
            core_capabilities: vec!["Full-stack development".to_string(), "Architecture decisions".to_string(), "Code review".to_string()],
        },
        PersonaInfo {
            id: "kelsey-hightower".to_string(),
            name: "Kelsey Hightower".to_string(),
            role: "devops".to_string(),
            expertise: "Cloud-native expert. Kubernetes, infrastructure as code, reliability engineering.".to_string(),
            mental_models: vec!["Infrastructure as Code".to_string(), "Immutable Infrastructure".to_string(), "12-Factor App".to_string()],
            core_capabilities: vec!["DevOps pipelines".to_string(), "Cloud deployment".to_string(), "Security hardening".to_string()],
        },
        PersonaInfo {
            id: "charlie-munger".to_string(),
            name: "Charlie Munger".to_string(),
            role: "critic".to_string(),
            expertise: "Inversion thinking, mental models, finding flaws before they become failures.".to_string(),
            mental_models: vec!["Inversion".to_string(), "Second-Order Thinking".to_string(), "Circle of Competence".to_string()],
            core_capabilities: vec!["Risk assessment".to_string(), "Pre-mortem analysis".to_string(), "Decision auditing".to_string()],
        },
        PersonaInfo {
            id: "don-norman".to_string(),
            name: "Don Norman".to_string(),
            role: "product".to_string(),
            expertise: "Father of UX design. Human-centered design, usability, cognitive psychology.".to_string(),
            mental_models: vec!["Human-Centered Design".to_string(), "Affordances".to_string(), "Norman Door".to_string()],
            core_capabilities: vec!["User research".to_string(), "Product strategy".to_string(), "UX design".to_string()],
        },
        PersonaInfo {
            id: "matias-duarte".to_string(),
            name: "Matias Duarte".to_string(),
            role: "ui".to_string(),
            expertise: "VP of Design at Google. Material Design creator. Visual systems thinker.".to_string(),
            mental_models: vec!["Material Design".to_string(), "Design Systems".to_string(), "Responsive Design".to_string()],
            core_capabilities: vec!["UI design".to_string(), "Design systems".to_string(), "Visual language".to_string()],
        },
        PersonaInfo {
            id: "james-bach".to_string(),
            name: "James Bach".to_string(),
            role: "qa".to_string(),
            expertise: "Exploratory testing pioneer. Context-driven testing school.".to_string(),
            mental_models: vec!["Exploratory Testing".to_string(), "Risk-Based Testing".to_string(), "Heuristic Test Strategy".to_string()],
            core_capabilities: vec!["Test strategy".to_string(), "Bug hunting".to_string(), "Quality assurance".to_string()],
        },
        PersonaInfo {
            id: "seth-godin".to_string(),
            name: "Seth Godin".to_string(),
            role: "marketing".to_string(),
            expertise: "Permission marketing, Purple Cow, Tribes. Build for the smallest viable audience.".to_string(),
            mental_models: vec!["Purple Cow".to_string(), "Permission Marketing".to_string(), "Smallest Viable Audience".to_string()],
            core_capabilities: vec!["Brand strategy".to_string(), "Content marketing".to_string(), "Growth hacking".to_string()],
        },
        PersonaInfo {
            id: "paul-graham".to_string(),
            name: "Paul Graham".to_string(),
            role: "operations".to_string(),
            expertise: "Y Combinator founder. Do things that don't scale. Make something people want.".to_string(),
            mental_models: vec!["Do Things That Don't Scale".to_string(), "Ramen Profitability".to_string(), "Default Alive".to_string()],
            core_capabilities: vec!["Startup operations".to_string(), "Fundraising".to_string(), "Product-market fit".to_string()],
        },
        PersonaInfo {
            id: "aaron-ross".to_string(),
            name: "Aaron Ross".to_string(),
            role: "sales".to_string(),
            expertise: "Predictable Revenue author. Outbound sales methodology, pipeline building.".to_string(),
            mental_models: vec!["Predictable Revenue".to_string(), "Cold Outreach 2.0".to_string(), "Sales Assembly Line".to_string()],
            core_capabilities: vec!["Sales strategy".to_string(), "Pipeline building".to_string(), "Revenue forecasting".to_string()],
        },
        PersonaInfo {
            id: "patrick-campbell".to_string(),
            name: "Patrick Campbell".to_string(),
            role: "cfo".to_string(),
            expertise: "ProfitWell founder. SaaS metrics, pricing strategy, retention optimization.".to_string(),
            mental_models: vec!["Unit Economics".to_string(), "Value-Based Pricing".to_string(), "Retention Curve Analysis".to_string()],
            core_capabilities: vec!["Financial modeling".to_string(), "Pricing strategy".to_string(), "SaaS metrics".to_string()],
        },
        PersonaInfo {
            id: "ben-thompson".to_string(),
            name: "Ben Thompson".to_string(),
            role: "research".to_string(),
            expertise: "Stratechery author. Aggregation theory, platform dynamics, tech industry analysis.".to_string(),
            mental_models: vec!["Aggregation Theory".to_string(), "Stratechery Framework".to_string(), "Platform Dynamics".to_string()],
            core_capabilities: vec!["Market research".to_string(), "Competitive analysis".to_string(), "Trend forecasting".to_string()],
        },
    ])
}

#[command]
pub fn list_skills() -> Result<Vec<SkillInfo>, String> {
    let mut skills = Vec::new();

    let auto_company_skills = vec![
        ("deep-research", "Research", "Comprehensive research methodology with multi-source validation"),
        ("product-strategist", "Product", "Product strategy framework for feature prioritization"),
        ("market-sizing", "Business", "TAM/SAM/SOM market sizing methodology"),
        ("startup-financial-modeling", "Finance", "Financial modeling for startups"),
        ("micro-saas-launcher", "Operations", "Micro-SaaS launch checklist and playbook"),
        ("premortem", "Strategy", "Pre-mortem analysis to identify failure modes"),
        ("code-review-security", "Engineering", "Security-focused code review checklist"),
        ("devops", "Engineering", "DevOps pipeline setup and CI/CD"),
        ("senior-qa", "Engineering", "Senior QA testing strategy"),
        ("security-audit", "Security", "Comprehensive security audit framework"),
        ("competitive-intelligence", "Business", "Competitive intelligence gathering"),
        ("financial-unit-economics", "Finance", "Unit economics analysis"),
        ("seo-content-strategist", "Marketing", "SEO and content strategy"),
        ("pricing-strategy", "Business", "Pricing strategy framework"),
        ("web-scraping", "Engineering", "Web scraping tools and techniques"),
    ];

    for (id, category, description) in auto_company_skills {
        skills.push(SkillInfo {
            id: id.to_string(),
            name: id.replace('-', " ").to_string(),
            category: category.to_string(),
            description: description.to_string(),
            source: "auto-company".to_string(),
            content_preview: String::new(),
        });
    }

    let ecc_skills = vec![
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

    for (id, category, description) in ecc_skills {
        skills.push(SkillInfo {
            id: id.to_string(),
            name: id.replace('-', " ").to_string(),
            category: category.to_string(),
            description: description.to_string(),
            source: "ecc".to_string(),
            content_preview: String::new(),
        });
    }

    Ok(skills)
}

#[command]
pub fn list_workflows() -> Result<Vec<WorkflowInfo>, String> {
    Ok(vec![
        WorkflowInfo { id: "pricing-monetization".to_string(), name: "Pricing & Monetization".to_string(), description: "End-to-end pricing strategy workflow.".to_string(), chain: vec!["research".to_string(), "cfo".to_string(), "product".to_string(), "marketing".to_string(), "critic".to_string(), "cfo".to_string()], convergence_cycles: 2 },
        WorkflowInfo { id: "product-launch".to_string(), name: "Product Launch".to_string(), description: "Coordinated product launch workflow.".to_string(), chain: vec!["marketing".to_string(), "research".to_string(), "sales".to_string(), "marketing".to_string(), "devops".to_string(), "ceo".to_string()], convergence_cycles: 2 },
        WorkflowInfo { id: "weekly-review".to_string(), name: "Weekly Review".to_string(), description: "Weekly strategic review cycle.".to_string(), chain: vec!["research".to_string(), "cfo".to_string(), "marketing".to_string(), "qa".to_string(), "ceo".to_string(), "critic".to_string()], convergence_cycles: 1 },
        WorkflowInfo { id: "new-product-eval".to_string(), name: "New Product Evaluation".to_string(), description: "Evaluate new product ideas.".to_string(), chain: vec!["research".to_string(), "product".to_string(), "cfo".to_string(), "critic".to_string(), "ceo".to_string()], convergence_cycles: 2 },
        WorkflowInfo { id: "feature-development".to_string(), name: "Feature Development".to_string(), description: "End-to-end feature development.".to_string(), chain: vec!["product".to_string(), "fullstack".to_string(), "qa".to_string(), "devops".to_string()], convergence_cycles: 1 },
        WorkflowInfo { id: "opportunity-discovery".to_string(), name: "Opportunity Discovery".to_string(), description: "Discover and validate market opportunities.".to_string(), chain: vec!["research".to_string(), "marketing".to_string(), "sales".to_string(), "cfo".to_string(), "ceo".to_string()], convergence_cycles: 2 },
    ])
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
