"""Generator: FactoryConfig -> .claude/ directory and runtime files.

Reads a FactoryConfig and generates all files needed for the AI Factory:
CLAUDE.md, PROMPT.md, agent definitions, skill files, settings, and
the initial consensus memory.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from jinja2 import Environment, FileSystemLoader

from .config import FactoryConfig


def generate_all(
    config: FactoryConfig,
    output_dir: Path,
    templates_dir: Path | None = None,
    library_dir: Path | None = None,
) -> None:
    """Generate all files from config.

    Args:
        config: The factory configuration to generate from.
        output_dir: Root directory for generated output.
        templates_dir: Path to Jinja2 templates. Defaults to ../templates.
        library_dir: Path to persona/skill library. Defaults to ../library.
    """
    if templates_dir is None:
        templates_dir = Path(__file__).parent.parent / "templates"
    if library_dir is None:
        library_dir = Path(__file__).parent.parent / "library"

    env = _create_jinja_env(templates_dir)

    _create_directories(config, output_dir)
    generate_claude_md(config, output_dir, env)
    generate_prompt_md(config, output_dir, env)
    generate_agents(config, output_dir, env, library_dir)
    generate_skills(config, output_dir, env, library_dir)
    generate_settings(config, output_dir, env)
    generate_consensus(config, output_dir, env)


def _create_jinja_env(templates_dir: Path) -> Environment:
    """Create a Jinja2 environment with the templates directory."""
    return Environment(
        loader=FileSystemLoader(str(templates_dir)),
        keep_trailing_newline=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )


def _create_directories(config: FactoryConfig, output_dir: Path) -> None:
    """Create all required directories."""
    dirs = [
        output_dir / ".claude" / "agents",
        output_dir / ".claude" / "skills",
        output_dir / "memories",
        output_dir / "projects",
        output_dir / "logs",
    ]

    for agent in config.org.agents:
        dirs.append(output_dir / "docs" / agent.role)

    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)


def _load_persona_data(persona_id: str, library_dir: Path) -> dict[str, Any]:
    """Load full persona data from library."""
    path = library_dir / "personas" / f"{persona_id}.yaml"
    if not path.exists():
        return {"id": persona_id, "name": persona_id, "role": persona_id}
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _load_skill_data(skill_id: str, library_dir: Path) -> dict[str, Any]:
    """Load full skill data from library."""
    path = library_dir / "skills" / f"{skill_id}.yaml"
    if not path.exists():
        return {"id": skill_id, "name": skill_id}
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def generate_claude_md(
    config: FactoryConfig, output_dir: Path, env: Environment,
) -> None:
    """Generate the CLAUDE.md file."""
    template = env.get_template("claude_md.j2")
    content = template.render(config=config)
    (output_dir / "CLAUDE.md").write_text(content, encoding="utf-8")


def generate_prompt_md(
    config: FactoryConfig, output_dir: Path, env: Environment,
) -> None:
    """Generate the PROMPT.md file."""
    template = env.get_template("prompt_md.j2")
    content = template.render(config=config)
    (output_dir / "PROMPT.md").write_text(content, encoding="utf-8")


def generate_agents(
    config: FactoryConfig,
    output_dir: Path,
    env: Environment,
    library_dir: Path,
) -> None:
    """Generate agent markdown files from persona data."""
    template = env.get_template("agent.j2")
    agents_dir = output_dir / ".claude" / "agents"

    for agent_config in config.org.agents:
        persona_data = _load_persona_data(agent_config.persona.id, library_dir)
        persona_data["role"] = agent_config.role

        if agent_config.persona.custom_instructions:
            persona_data["custom_instructions"] = (
                agent_config.persona.custom_instructions
            )

        content = template.render(agent=persona_data, config=config)
        filename = f"{agent_config.role}-{agent_config.persona.id}.md"
        (agents_dir / filename).write_text(content, encoding="utf-8")


def generate_skills(
    config: FactoryConfig,
    output_dir: Path,
    env: Environment,
    library_dir: Path,
) -> None:
    """Generate skill markdown files for all unique skills across agents."""
    template = env.get_template("skill.j2")
    skills_dir = output_dir / ".claude" / "skills"

    all_skill_ids: set[str] = set()
    for agent in config.org.agents:
        all_skill_ids.update(agent.skills)

    for skill_id in sorted(all_skill_ids):
        skill_data = _load_skill_data(skill_id, library_dir)
        skill_out_dir = skills_dir / skill_id
        skill_out_dir.mkdir(parents=True, exist_ok=True)

        content = template.render(skill=skill_data)
        (skill_out_dir / "SKILL.md").write_text(content, encoding="utf-8")


def generate_settings(
    config: FactoryConfig, output_dir: Path, env: Environment,
) -> None:
    """Generate .claude/settings.json."""
    template = env.get_template("settings.j2")
    content = template.render(config=config)
    (output_dir / ".claude" / "settings.json").write_text(
        content, encoding="utf-8",
    )


def generate_consensus(
    config: FactoryConfig, output_dir: Path, env: Environment,
) -> None:
    """Generate the initial consensus memory file."""
    template = env.get_template("consensus_init.j2")
    content = template.render(config=config)
    (output_dir / "memories" / "consensus.md").write_text(
        content, encoding="utf-8",
    )
