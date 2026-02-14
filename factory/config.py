"""Configuration models and utilities for AI Factory.

All models use frozen=True for immutability. Configuration is loaded
from YAML files and validated against the schema defined here.
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


class ModelTier(str, Enum):
    """Supported AI model tiers."""

    OPUS = "opus"
    SONNET = "sonnet"
    HAIKU = "haiku"


class Engine(str, Enum):
    """Supported AI engine providers."""

    CLAUDE = "claude"
    CODEX = "codex"


class PersonaRef(BaseModel, frozen=True):
    """Reference to a persona from the library."""

    id: str
    custom_instructions: str = ""


class AgentConfig(BaseModel, frozen=True):
    """Configuration for a single AI agent."""

    role: str
    persona: PersonaRef
    skills: list[str] = Field(default_factory=list)
    model: ModelTier = ModelTier.SONNET
    layer: str = "engineering"
    decides: list[str] = Field(default_factory=list)


class WorkflowConfig(BaseModel, frozen=True):
    """Configuration for a workflow chain of agents."""

    id: str
    name: str
    description: str = ""
    chain: list[str]
    convergence_cycles: int = 3


class ProviderConfig(BaseModel, frozen=True):
    """Configuration for an AI provider."""

    engine: Engine = Engine.CLAUDE
    model: str = "opus"
    api_key_env: str = ""
    endpoint: str = ""


class BudgetConfig(BaseModel, frozen=True):
    """Budget limits and alerting thresholds."""

    max_daily_usd: float = 50.0
    alert_at_usd: float = 30.0


class RuntimeConfig(BaseModel, frozen=True):
    """Runtime behavior configuration."""

    providers: list[ProviderConfig] = Field(
        default_factory=lambda: [ProviderConfig()]
    )
    failover: str = "auto"
    budget: BudgetConfig = BudgetConfig()
    loop_interval: int = 30
    cycle_timeout: int = 1800
    max_consecutive_errors: int = 5


class GuardrailConfig(BaseModel, frozen=True):
    """Safety guardrails configuration."""

    forbidden: list[str] = Field(
        default_factory=lambda: [
            "gh repo delete",
            "wrangler delete",
            "rm -rf /",
            "git push --force main",
            "git push --force master",
            "git reset --hard (on main/master)",
        ]
    )
    workspace: str = "projects/"
    require_critic_review: bool = True


class CompanyConfig(BaseModel, frozen=True):
    """Core company identity configuration."""

    name: str
    mission: str
    description: str = ""
    seed_prompt: str = ""


class OrgConfig(BaseModel, frozen=True):
    """Organization structure with agents."""

    agents: list[AgentConfig] = Field(default_factory=list)


class FactoryConfig(BaseModel, frozen=True):
    """Top-level configuration for an AI Factory company."""

    company: CompanyConfig
    org: OrgConfig = OrgConfig()
    workflows: list[WorkflowConfig] = Field(default_factory=list)
    runtime: RuntimeConfig = RuntimeConfig()
    guardrails: GuardrailConfig = GuardrailConfig()


def load_config(path: str | Path) -> FactoryConfig:
    """Load a FactoryConfig from a YAML file.

    Args:
        path: Path to the YAML configuration file.

    Returns:
        Parsed and validated FactoryConfig.

    Raises:
        FileNotFoundError: If the config file does not exist.
        yaml.YAMLError: If the file contains invalid YAML.
        pydantic.ValidationError: If the data does not match the schema.
    """
    config_path = Path(path)
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    raw_text = config_path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw_text)

    if not isinstance(data, dict):
        raise ValueError(f"Expected a YAML mapping at top level, got {type(data).__name__}")

    return FactoryConfig(**data)


def save_config(config: FactoryConfig, path: str | Path) -> None:
    """Save a FactoryConfig to a YAML file.

    Args:
        config: The configuration to save.
        path: Destination file path.
    """
    config_path = Path(path)
    config_path.parent.mkdir(parents=True, exist_ok=True)

    data = config.model_dump(mode="python")
    yaml_text = yaml.dump(
        _serialize_for_yaml(data),
        default_flow_style=False,
        sort_keys=False,
        allow_unicode=True,
    )
    config_path.write_text(yaml_text, encoding="utf-8")


def _serialize_for_yaml(obj: Any) -> Any:
    """Recursively convert enums and other non-serializable types for YAML output."""
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, dict):
        return {k: _serialize_for_yaml(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize_for_yaml(item) for item in obj]
    return obj


def validate_config(config: FactoryConfig) -> list[str]:
    """Validate a FactoryConfig beyond schema rules.

    Returns a list of warning messages. An empty list means no issues found.

    Args:
        config: The configuration to validate.

    Returns:
        List of human-readable warning strings.
    """
    warnings: list[str] = []

    if not config.org.agents:
        warnings.append("No agents defined in org.agents")

    agent_roles = _collect_agent_roles(config)
    warnings.extend(_validate_workflows(config.workflows, agent_roles))
    warnings.extend(_validate_budget(config.runtime.budget))
    warnings.extend(_validate_providers(config.runtime.providers))

    return warnings


def _collect_agent_roles(config: FactoryConfig) -> set[str]:
    """Extract the set of all agent role IDs from the config."""
    return {agent.role for agent in config.org.agents}


def _validate_workflows(
    workflows: list[WorkflowConfig], agent_roles: set[str]
) -> list[str]:
    """Check that workflow chains reference valid agent roles."""
    warnings: list[str] = []

    workflow_ids: list[str] = []
    for wf in workflows:
        workflow_ids.append(wf.id)
        for step_role in wf.chain:
            if step_role not in agent_roles:
                warnings.append(
                    f"Workflow '{wf.id}' references unknown agent role: '{step_role}'"
                )
        if not wf.chain:
            warnings.append(f"Workflow '{wf.id}' has an empty chain")
        if wf.convergence_cycles < 1:
            warnings.append(
                f"Workflow '{wf.id}' has invalid convergence_cycles: {wf.convergence_cycles}"
            )

    seen: set[str] = set()
    for wid in workflow_ids:
        if wid in seen:
            warnings.append(f"Duplicate workflow id: '{wid}'")
        seen.add(wid)

    return warnings


def _validate_budget(budget: BudgetConfig) -> list[str]:
    """Check budget configuration for logical consistency."""
    warnings: list[str] = []

    if budget.alert_at_usd >= budget.max_daily_usd:
        warnings.append(
            f"Budget alert threshold (${budget.alert_at_usd}) should be below "
            f"max daily budget (${budget.max_daily_usd})"
        )

    if budget.max_daily_usd <= 0:
        warnings.append("Budget max_daily_usd must be positive")

    return warnings


def _validate_providers(providers: list[ProviderConfig]) -> list[str]:
    """Check provider configuration for potential issues."""
    warnings: list[str] = []

    if not providers:
        warnings.append("No providers configured")

    for provider in providers:
        if provider.api_key_env == "" and provider.endpoint == "":
            warnings.append(
                f"Provider ({provider.engine.value}/{provider.model}) has no "
                f"api_key_env or endpoint configured"
            )

    return warnings
