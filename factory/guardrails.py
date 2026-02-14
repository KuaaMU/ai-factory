"""Safety guardrail enforcement.

Validates commands, configurations, and generated files against security
rules to prevent destructive or dangerous operations during autonomous
execution.
"""
from __future__ import annotations

import re
from pathlib import Path

from .config import FactoryConfig, GuardrailConfig


DEFAULT_FORBIDDEN: tuple[str, ...] = (
    "gh repo delete",
    "wrangler delete",
    "rm -rf /",
    "rm -rf ~",
    "git push --force main",
    "git push --force master",
    "git reset --hard (on main/master)",
)

DANGEROUS_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"rm\s+-rf\s+/"),
    re.compile(r"rm\s+-rf\s+~"),
    re.compile(r"gh\s+repo\s+delete"),
    re.compile(r"wrangler\s+delete"),
    re.compile(r"git\s+push\s+--force\s+(main|master)"),
    re.compile(
        r"(api[_-]?key|secret|token|password)\s*=\s*['\"][^'\"]+['\"]",
        re.IGNORECASE,
    ),
)

_SECRET_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"(api[_-]?key|secret|token|password|credential)"
        r"\s*[:=]\s*['\"][A-Za-z0-9+/=]{8,}['\"]",
        re.IGNORECASE,
    ),
    re.compile(r"(sk-|pk-|ak-)[A-Za-z0-9]{20,}"),
    re.compile(r"-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----"),
)

_BINARY_SUFFIXES: frozenset[str] = frozenset({
    ".pyc", ".pyo", ".so", ".dll", ".exe",
    ".whl", ".egg", ".zip", ".tar", ".gz",
    ".png", ".jpg", ".jpeg", ".gif", ".ico",
})


def validate_config_guardrails(config: FactoryConfig) -> list[str]:
    """Validate guardrail configuration. Returns list of warnings."""
    warnings: list[str] = []

    if not config.guardrails.forbidden:
        warnings.append(
            "No forbidden actions defined — "
            "this is dangerous for autonomous operation"
        )

    essential = {"gh repo delete", "rm -rf /"}
    configured = set(config.guardrails.forbidden)
    missing = essential - configured
    if missing:
        warnings.append(f"Missing essential guardrails: {missing}")

    if not config.guardrails.workspace:
        warnings.append(
            "No workspace directory defined — agents may write anywhere"
        )

    return warnings


def check_command_safety(
    command: str, guardrails: GuardrailConfig,
) -> tuple[bool, str]:
    """Check if a command is safe to execute.

    Returns:
        A tuple of (safe, reason). When safe is True, reason is empty.
    """
    for pattern in DANGEROUS_PATTERNS:
        if pattern.search(command):
            return False, f"Command matches dangerous pattern: {pattern.pattern}"

    for forbidden in guardrails.forbidden:
        if forbidden.lower() in command.lower():
            return False, f"Command contains forbidden action: {forbidden}"

    return True, ""


def audit_generated_files(output_dir: Path) -> list[str]:
    """Scan generated files for security issues.

    Returns:
        List of human-readable issue descriptions.
    """
    issues: list[str] = []

    for file_path in output_dir.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.suffix in _BINARY_SUFFIXES:
            continue

        issues.extend(_scan_file_for_secrets(file_path, output_dir))

    return issues


def _scan_file_for_secrets(file_path: Path, output_dir: Path) -> list[str]:
    """Scan a single file for secret patterns."""
    issues: list[str] = []

    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return issues

    for pattern in _SECRET_PATTERNS:
        if pattern.search(content):
            rel_path = file_path.relative_to(output_dir)
            issues.append(
                f"Potential secret in {rel_path}: {pattern.pattern}"
            )

    return issues
