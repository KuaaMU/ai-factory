use std::fs;
use std::path::Path;
use tera::{Tera, Context};
use crate::models::*;

pub fn generate_all(
    config: &FactoryConfig,
    output_dir: &Path,
    templates_dir: &Path,
) -> Result<GenerateResult, String> {
    // Ensure output directories exist
    let dirs = [
        output_dir.join(".claude/agents"),
        output_dir.join("memories"),
        output_dir.join("docs"),
        output_dir.join("projects"),
    ];
    for dir in &dirs {
        fs::create_dir_all(dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    }

    // Create doc dirs for each agent
    for agent in &config.org.agents {
        let doc_dir = output_dir.join(format!("docs/{}", agent.role));
        fs::create_dir_all(&doc_dir).map_err(|e| format!("Failed to create doc dir: {}", e))?;
    }

    let mut files_created = Vec::new();

    // Load templates
    let template_glob = format!("{}/**/*.j2", templates_dir.display());
    let tera = Tera::new(&template_glob)
        .map_err(|e| format!("Template error: {}", e))?;

    let mut ctx = Context::new();
    ctx.insert("company", &config.company);
    ctx.insert("org", &config.org);
    ctx.insert("workflows", &config.workflows);
    ctx.insert("runtime", &config.runtime);
    ctx.insert("guardrails", &config.guardrails);
    ctx.insert("agents", &config.org.agents);

    // Generate CLAUDE.md
    if tera.get_template_names().any(|n| n.contains("claude_md")) {
        let content = tera.render("claude_md.j2", &ctx)
            .map_err(|e| format!("Render CLAUDE.md error: {}", e))?;
        let path = output_dir.join("CLAUDE.md");
        fs::write(&path, &content).map_err(|e| format!("Write error: {}", e))?;
        files_created.push(path.display().to_string());
    }

    // Generate agent files
    for agent in &config.org.agents {
        let mut agent_ctx = Context::new();
        agent_ctx.insert("agent", agent);
        agent_ctx.insert("company", &config.company);

        if tera.get_template_names().any(|n| n.contains("agent")) {
            let content = tera.render("agent.j2", &agent_ctx)
                .map_err(|e| format!("Render agent error: {}", e))?;
            let path = output_dir.join(format!(".claude/agents/{}-{}.md", agent.role, agent.persona.id));
            fs::write(&path, &content).map_err(|e| format!("Write error: {}", e))?;
            files_created.push(path.display().to_string());
        }
    }

    // Generate company.yaml
    let yaml_content = serde_yaml::to_string(config)
        .map_err(|e| format!("YAML serialize error: {}", e))?;
    let config_path = output_dir.join("company.yaml");
    fs::write(&config_path, &yaml_content).map_err(|e| format!("Write error: {}", e))?;
    files_created.push(config_path.display().to_string());

    // Generate consensus.md
    let consensus = format!(
        "# Auto Company Consensus\n\n\
        ## Company State\n\n\
        - **Company**: {}\n\
        - **Mission**: {}\n\
        - **Status**: INITIALIZING\n\
        - **Cycle**: 0\n\
        - **Revenue**: $0\n\n\
        ## Current Focus\n\n\
        Starting up. First cycle should brainstorm product ideas aligned with our mission.\n\n\
        Seed direction: {}\n\n\
        ## Active Projects\n\n\
        None yet. First cycle will identify opportunities.\n\n\
        ## Next Action\n\n\
        **Brainstorm Phase**: Each team member proposes their best product idea based on our mission.\n\n\
        ## Decision Log\n\n\
        | Cycle | Decision | Made By | Outcome |\n\
        |-------|----------|---------|---------|\n\
        | 0 | Company initialized | System | Pending first cycle |\n",
        config.company.name, config.company.mission, config.company.seed_prompt
    );
    let consensus_path = output_dir.join("memories/consensus.md");
    fs::write(&consensus_path, &consensus).map_err(|e| format!("Write error: {}", e))?;
    files_created.push(consensus_path.display().to_string());

    // Generate settings.json
    let settings = serde_json::json!({
        "permissions": {
            "allow": [
                "Bash(npm install:*)",
                "Bash(npm run:*)",
                "Bash(git:*)",
                "Bash(mkdir:*)",
                "Bash(cp:*)",
                "Bash(mv:*)",
                "Bash(curl:*)",
                "WebFetch",
                "WebSearch"
            ],
            "deny": config.guardrails.forbidden
        }
    });
    let settings_path = output_dir.join(".claude/settings.json");
    fs::write(
        &settings_path,
        serde_json::to_string_pretty(&settings).unwrap(),
    ).map_err(|e| format!("Write error: {}", e))?;
    files_created.push(settings_path.display().to_string());

    Ok(GenerateResult {
        output_dir: output_dir.display().to_string(),
        files_created,
        agent_count: config.org.agents.len(),
        skill_count: config.org.agents.iter().flat_map(|a| &a.skills).collect::<std::collections::HashSet<_>>().len(),
        workflow_count: config.workflows.len(),
    })
}
