"""AI Factory Evolution - cycle evaluation, trend analysis, and self-improvement."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Optional
from collections import Counter

if TYPE_CHECKING:
    from factory.config import FactoryConfig


@dataclass(frozen=True)
class CycleEvaluation:
    """Immutable evaluation of a single cycle."""

    cycle_number: int
    success: bool
    cost_usd: float
    consensus_changed: bool
    progress_score: float  # 0.0 to 1.0
    issues: tuple[str, ...] = ()


@dataclass(frozen=True)
class Adjustment:
    """Immutable suggested adjustment to the factory configuration."""

    type: str  # upgrade_model, downgrade_model, add_skill, remove_agent, change_workflow
    target: str  # Agent role or skill ID
    old_value: str
    new_value: str
    reason: str


def evaluate_cycle(
    cycle_log_path: Path,
    consensus_path: Path,
    previous_consensus: Optional[str] = None,
) -> CycleEvaluation:
    """Evaluate a single cycle's performance.

    Reads the cycle log to determine success/failure and cost,
    then compares consensus to the previous version to detect changes.

    Args:
        cycle_log_path: Path to the cycle-N.log file.
        consensus_path: Path to the current consensus.md.
        previous_consensus: Text of consensus before this cycle ran.

    Returns:
        A CycleEvaluation with all metrics populated.

    Raises:
        FileNotFoundError: If cycle_log_path does not exist.
    """
    if not cycle_log_path.is_file():
        raise FileNotFoundError(f"Cycle log not found: {cycle_log_path}")

    log_content = cycle_log_path.read_text(encoding="utf-8")
    fields, summary = _parse_cycle_log_content(log_content)

    status = fields.get("status", "unknown")
    success = status == "ok"

    cost_usd = 0.0
    cost_str = fields.get("cost", "")
    if cost_str:
        try:
            cost_usd = float(cost_str)
        except ValueError:
            cost_usd = 0.0

    cycle_number = 0
    cycle_str = fields.get("cycle", "0")
    try:
        cycle_number = int(cycle_str)
    except ValueError:
        cycle_number = 0

    # Check if consensus changed
    consensus_changed = False
    current_consensus = ""
    if consensus_path.is_file():
        current_consensus = consensus_path.read_text(encoding="utf-8")
    if previous_consensus is not None:
        consensus_changed = current_consensus != previous_consensus

    # Compute progress score
    progress_score = _compute_progress_score(
        success=success,
        consensus_changed=consensus_changed,
        summary=summary,
    )

    # Collect issues
    issues = _extract_issues(status, summary)

    return CycleEvaluation(
        cycle_number=cycle_number,
        success=success,
        cost_usd=cost_usd,
        consensus_changed=consensus_changed,
        progress_score=progress_score,
        issues=tuple(issues),
    )


def analyze_trends(
    evaluations: list[CycleEvaluation], window: int = 5
) -> dict[str, object]:
    """Analyze trends over recent cycles.

    Args:
        evaluations: List of cycle evaluations, ordered by cycle number.
        window: Number of recent cycles to consider.

    Returns:
        Dictionary with keys:
        - success_rate: float (0.0-1.0)
        - avg_cost: float
        - progress_trend: str ("improving", "stagnant", "declining")
        - repeated_issues: list of (issue, count) tuples
    """
    if not evaluations:
        return {
            "success_rate": 0.0,
            "avg_cost": 0.0,
            "progress_trend": "stagnant",
            "repeated_issues": [],
        }

    recent = evaluations[-window:]
    total = len(recent)

    success_count = sum(1 for e in recent if e.success)
    success_rate = success_count / total

    costs = [e.cost_usd for e in recent if e.cost_usd > 0]
    avg_cost = sum(costs) / len(costs) if costs else 0.0

    progress_trend = _determine_progress_trend(recent)

    # Count repeated issues
    issue_counter: Counter[str] = Counter()
    for evaluation in recent:
        for issue in evaluation.issues:
            issue_counter[issue] += 1
    repeated_issues = [
        (issue, count) for issue, count in issue_counter.most_common() if count > 1
    ]

    return {
        "success_rate": success_rate,
        "avg_cost": avg_cost,
        "progress_trend": progress_trend,
        "repeated_issues": repeated_issues,
    }


def suggest_adjustments(
    evaluations: list[CycleEvaluation],
) -> list[Adjustment]:
    """Suggest team/config adjustments based on evaluation trends.

    Rules applied:
    - 3+ consecutive failures -> suggest model upgrade
    - High cost with low progress -> suggest model downgrade for non-critical roles
    - No consensus changes for 5+ cycles -> suggest new skills or workflow change
    - Repeated same error -> suggest adding relevant skill

    Args:
        evaluations: List of cycle evaluations, ordered by cycle number.

    Returns:
        List of suggested Adjustment objects.
    """
    if not evaluations:
        return []

    adjustments: list[Adjustment] = []

    # Rule 1: consecutive failures -> model upgrade
    consecutive_failures = _count_trailing_failures(evaluations)
    if consecutive_failures >= 3:
        adjustments = [
            *adjustments,
            Adjustment(
                type="upgrade_model",
                target="primary",
                old_value="sonnet",
                new_value="opus",
                reason=(
                    f"{consecutive_failures} consecutive failures detected. "
                    f"Upgrading model may improve success rate."
                ),
            ),
        ]

    # Rule 2: high cost, low progress -> downgrade non-critical
    recent = evaluations[-5:]
    avg_cost = (
        sum(e.cost_usd for e in recent) / len(recent) if recent else 0.0
    )
    avg_progress = (
        sum(e.progress_score for e in recent) / len(recent) if recent else 0.0
    )
    if avg_cost > 0.5 and avg_progress < 0.3:
        adjustments = [
            *adjustments,
            Adjustment(
                type="downgrade_model",
                target="business",
                old_value="opus",
                new_value="sonnet",
                reason=(
                    f"High avg cost (${avg_cost:.2f}) with low progress ({avg_progress:.1%}). "
                    f"Downgrade non-critical roles to reduce spend."
                ),
            ),
        ]

    # Rule 3: no consensus changes for 5+ cycles -> workflow change
    no_change_streak = _count_trailing_no_consensus_change(evaluations)
    if no_change_streak >= 5:
        adjustments = [
            *adjustments,
            Adjustment(
                type="change_workflow",
                target="consensus",
                old_value="current",
                new_value="restructured",
                reason=(
                    f"No consensus changes for {no_change_streak} cycles. "
                    f"Consider adding new skills or restructuring the workflow."
                ),
            ),
        ]

    # Rule 4: repeated same error -> add skill
    issue_counter: Counter[str] = Counter()
    for evaluation in recent:
        for issue in evaluation.issues:
            issue_counter[issue] += 1

    for issue, count in issue_counter.most_common():
        if count >= 3:
            adjustments = [
                *adjustments,
                Adjustment(
                    type="add_skill",
                    target=issue,
                    old_value="none",
                    new_value=f"skill-for-{issue}",
                    reason=(
                        f"Issue '{issue}' occurred {count} times in recent cycles. "
                        f"Adding a targeted skill may resolve it."
                    ),
                ),
            ]
            break  # Only suggest one skill addition at a time

    return adjustments


def apply_adjustments(
    config: FactoryConfig,
    adjustments: list[Adjustment],
) -> FactoryConfig:
    """Apply suggested adjustments to a config, returning a new immutable config.

    Supports adjustment types:
    - upgrade_model / downgrade_model: changes the model tier for matching agents
    - add_skill: appends a skill to matching agents
    - remove_agent: removes an agent by role
    - change_workflow: updates convergence cycles on all workflows

    Args:
        config: The current immutable FactoryConfig.
        adjustments: List of Adjustment objects to apply.

    Returns:
        A new FactoryConfig with the adjustments applied.
    """
    from factory.config import (
        AgentConfig,
        FactoryConfig,
        ModelTier,
        OrgConfig,
        WorkflowConfig,
    )

    current_agents = list(config.org.agents)
    current_workflows = list(config.workflows)

    for adj in adjustments:
        if adj.type in ("upgrade_model", "downgrade_model"):
            new_tier = _resolve_model_tier(adj.new_value)
            if new_tier is None:
                continue
            current_agents = [
                _with_model(agent, new_tier) if _agent_matches_target(agent, adj.target) else agent
                for agent in current_agents
            ]

        elif adj.type == "add_skill":
            current_agents = [
                _with_added_skill(agent, adj.new_value) if _agent_matches_target(agent, adj.target) else agent
                for agent in current_agents
            ]

        elif adj.type == "remove_agent":
            current_agents = [
                agent for agent in current_agents
                if agent.role != adj.target
            ]

        elif adj.type == "change_workflow":
            current_workflows = [
                wf.model_copy(update={"convergence_cycles": max(1, wf.convergence_cycles + 1)})
                for wf in current_workflows
            ]

    new_org = config.org.model_copy(update={"agents": current_agents})
    return config.model_copy(update={
        "org": new_org,
        "workflows": current_workflows,
    })


def _resolve_model_tier(value: str) -> Optional[object]:
    """Resolve a string to a ModelTier enum value."""
    from factory.config import ModelTier

    tier_map = {
        "opus": ModelTier.OPUS,
        "sonnet": ModelTier.SONNET,
        "haiku": ModelTier.HAIKU,
    }
    return tier_map.get(value.lower())


def _agent_matches_target(agent: object, target: str) -> bool:
    """Check if an agent matches an adjustment target."""
    # Target can be a role name, layer name, or "primary" (matches all)
    if target == "primary":
        return True
    role = getattr(agent, "role", "")
    layer = getattr(agent, "layer", "")
    return role == target or layer == target


def _with_model(agent: object, new_tier: object) -> object:
    """Return a copy of the agent with an updated model tier."""
    return agent.model_copy(update={"model": new_tier})  # type: ignore[union-attr]


def _with_added_skill(agent: object, skill_id: str) -> object:
    """Return a copy of the agent with an additional skill."""
    current_skills: list[str] = list(getattr(agent, "skills", []))
    if skill_id not in current_skills:
        new_skills = [*current_skills, skill_id]
        return agent.model_copy(update={"skills": new_skills})  # type: ignore[union-attr]
    return agent


def evolution_report(
    evaluations: list[CycleEvaluation],
    adjustments: list[Adjustment],
) -> str:
    """Generate a human-readable evolution report.

    Args:
        evaluations: List of cycle evaluations.
        adjustments: List of suggested adjustments.

    Returns:
        A formatted markdown string with the report.
    """
    lines: list[str] = [
        "# Evolution Report",
        "",
    ]

    # Summary stats
    trends = analyze_trends(evaluations)
    lines.extend([
        "## Summary",
        "",
        f"- **Cycles evaluated:** {len(evaluations)}",
        f"- **Success rate:** {trends['success_rate']:.1%}",
        f"- **Avg cost per cycle:** ${trends['avg_cost']:.4f}",
        f"- **Progress trend:** {trends['progress_trend']}",
        "",
    ])

    # Repeated issues
    repeated = trends.get("repeated_issues", [])
    if repeated:
        lines.extend(["## Recurring Issues", ""])
        for issue, count in repeated:
            lines.append(f"- `{issue}` (x{count})")
        lines.append("")

    # Recent cycles
    lines.extend(["## Recent Cycles", ""])
    recent = evaluations[-10:]
    for ev in recent:
        status_icon = "OK" if ev.success else "FAIL"
        consensus_tag = " [consensus changed]" if ev.consensus_changed else ""
        lines.append(
            f"- Cycle #{ev.cycle_number}: {status_icon} | "
            f"cost=${ev.cost_usd:.4f} | "
            f"progress={ev.progress_score:.0%}"
            f"{consensus_tag}"
        )
    lines.append("")

    # Adjustments
    if adjustments:
        lines.extend(["## Suggested Adjustments", ""])
        for adj in adjustments:
            lines.extend([
                f"### {adj.type}: {adj.target}",
                "",
                f"- **Change:** `{adj.old_value}` -> `{adj.new_value}`",
                f"- **Reason:** {adj.reason}",
                "",
            ])
    else:
        lines.extend([
            "## Suggested Adjustments",
            "",
            "No adjustments suggested at this time.",
            "",
        ])

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_cycle_log_content(content: str) -> tuple[dict[str, str], str]:
    """Parse cycle log content into fields dict and summary text."""
    fields: dict[str, str] = {}
    summary_lines: list[str] = []
    past_separator = False

    for line in content.strip().splitlines():
        if line.strip() == "---":
            past_separator = True
            continue
        if past_separator:
            summary_lines.append(line)
        elif ":" in line:
            key, _, value = line.partition(":")
            fields[key.strip()] = value.strip()

    return fields, "\n".join(summary_lines)


def _compute_progress_score(
    success: bool, consensus_changed: bool, summary: str
) -> float:
    """Compute a simple progress score from 0.0 to 1.0."""
    score = 0.0
    if success:
        score += 0.5
    if consensus_changed:
        score += 0.3
    # Bonus for non-empty summary indicating substantive work
    if summary and len(summary.strip()) > 50:
        score += 0.2
    return min(score, 1.0)


def _extract_issues(status: str, summary: str) -> list[str]:
    """Extract issue keywords from the cycle status and summary."""
    issues: list[str] = []
    if status == "timeout":
        issues.append("timeout")
    elif status == "fail":
        # Try to categorize the failure from the summary
        lower_summary = summary.lower()
        if "rate limit" in lower_summary or "429" in lower_summary:
            issues.append("rate_limit")
        elif "auth" in lower_summary or "permission" in lower_summary:
            issues.append("auth_error")
        elif "timeout" in lower_summary:
            issues.append("timeout")
        else:
            issues.append("general_failure")
    return issues


def _count_trailing_failures(evaluations: list[CycleEvaluation]) -> int:
    """Count consecutive failures from the end of the list."""
    count = 0
    for evaluation in reversed(evaluations):
        if not evaluation.success:
            count += 1
        else:
            break
    return count


def _count_trailing_no_consensus_change(
    evaluations: list[CycleEvaluation],
) -> int:
    """Count consecutive cycles with no consensus change from the end."""
    count = 0
    for evaluation in reversed(evaluations):
        if not evaluation.consensus_changed:
            count += 1
        else:
            break
    return count


def _determine_progress_trend(
    recent: list[CycleEvaluation],
) -> str:
    """Determine if progress is improving, stagnant, or declining."""
    if len(recent) < 2:
        return "stagnant"

    midpoint = len(recent) // 2
    first_half = recent[:midpoint]
    second_half = recent[midpoint:]

    avg_first = (
        sum(e.progress_score for e in first_half) / len(first_half)
        if first_half
        else 0.0
    )
    avg_second = (
        sum(e.progress_score for e in second_half) / len(second_half)
        if second_half
        else 0.0
    )

    delta = avg_second - avg_first
    if delta > 0.1:
        return "improving"
    elif delta < -0.1:
        return "declining"
    else:
        return "stagnant"
