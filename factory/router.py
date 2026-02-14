"""AI Factory Router - provider selection and failover logic."""

from dataclasses import dataclass
from typing import Optional
import subprocess
import shutil


@dataclass(frozen=True)
class Provider:
    """Immutable provider configuration."""

    engine: str  # claude, codex
    model: str  # opus, sonnet, haiku, gpt-5.3-codex
    api_key_env: str = ""
    endpoint: str = ""
    priority: int = 0


@dataclass(frozen=True)
class RouteDecision:
    """Immutable routing decision with reasoning."""

    provider: Provider
    reason: str


# Model tier mapping for cost optimization
ROLE_MODEL_MAP: dict[str, str] = {
    "strategy": "opus",  # CEO, CTO, Critic
    "product": "sonnet",  # Product, UI, Interaction
    "engineering": "sonnet",  # Fullstack, QA, DevOps
    "business": "sonnet",  # Marketing, Ops, Sales, CFO
    "intelligence": "opus",  # Research
}


def get_optimal_model(role_layer: str) -> str:
    """Get the recommended model tier for a role layer.

    Args:
        role_layer: The role category (strategy, product, engineering, business, intelligence).

    Returns:
        The recommended model name. Falls back to "sonnet" for unknown layers.
    """
    return ROLE_MODEL_MAP.get(role_layer, "sonnet")


def select_provider(
    role_layer: str, providers: list[Provider]
) -> RouteDecision:
    """Select the best provider for a given role layer.

    Selection logic:
    1. Determine the optimal model tier for the role.
    2. Find providers matching that model tier.
    3. Among matches, pick the one with the highest priority.
    4. If no exact match, fall back to the highest-priority healthy provider.

    Args:
        role_layer: The role category for model selection.
        providers: Available provider configurations.

    Returns:
        A RouteDecision with the chosen provider and reasoning.

    Raises:
        ValueError: If providers list is empty.
    """
    if not providers:
        raise ValueError("No providers available")

    optimal_model = get_optimal_model(role_layer)

    # Find providers matching the optimal model
    matching = [p for p in providers if p.model == optimal_model]

    if matching:
        best = _highest_priority(matching)
        return RouteDecision(
            provider=best,
            reason=(
                f"Selected {best.engine}/{best.model} for '{role_layer}' layer "
                f"(optimal tier match, priority={best.priority})"
            ),
        )

    # Fallback: pick highest priority provider regardless of model
    best = _highest_priority(providers)
    return RouteDecision(
        provider=best,
        reason=(
            f"Fallback to {best.engine}/{best.model} for '{role_layer}' layer "
            f"(no {optimal_model} provider available, priority={best.priority})"
        ),
    )


def _highest_priority(providers: list[Provider]) -> Provider:
    """Return the provider with the highest priority value."""
    return max(providers, key=lambda p: p.priority)


def check_provider_health(provider: Provider) -> bool:
    """Check if a provider is accessible.

    For claude: checks if the `claude` CLI is available.
    For codex: checks if the `codex` CLI is available.
    Additionally checks that the required API key env var is set (if specified).

    Args:
        provider: The provider to health-check.

    Returns:
        True if the provider appears healthy, False otherwise.
    """
    # Check CLI availability
    cli_name = provider.engine
    if not shutil.which(cli_name):
        return False

    # Check API key if required
    if provider.api_key_env:
        import os

        if not os.environ.get(provider.api_key_env):
            return False

    return True


def failover(
    current: Provider, providers: list[Provider]
) -> Optional[Provider]:
    """Find the next healthy provider after a failure.

    Tries providers in priority order, skipping the current one and
    any that fail health checks.

    Args:
        current: The provider that just failed.
        providers: All available providers.

    Returns:
        The next healthy provider, or None if no alternatives are available.
    """
    candidates = [
        p
        for p in providers
        if p != current
    ]

    # Sort by priority descending
    sorted_candidates = sorted(candidates, key=lambda p: p.priority, reverse=True)

    for candidate in sorted_candidates:
        if check_provider_health(candidate):
            return candidate

    return None
