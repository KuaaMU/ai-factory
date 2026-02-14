"""Consensus memory management.

Provides read, validate, backup, and restore operations on the shared
consensus file (memories/consensus.md) that acts as the single source
of truth for company state across cycles.
"""
from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass(frozen=True)
class ConsensusState:
    """Parsed state from consensus.md."""

    company_state: str
    current_focus: str
    active_projects: str
    next_action: str
    decision_log: str
    raw_content: str


REQUIRED_SECTIONS: tuple[str, ...] = (
    "# Auto Company Consensus",
    "## Company State",
    "## Next Action",
)

_SECTION_PATTERN = re.compile(r"\n## |\Z")


def read_consensus(path: Path) -> ConsensusState:
    """Parse consensus.md into structured data.

    Returns an empty ConsensusState if the file does not exist.
    """
    if not path.exists():
        return ConsensusState("", "", "", "", "", "")

    content = path.read_text(encoding="utf-8")

    return ConsensusState(
        company_state=_extract_section(content, "## Company State"),
        current_focus=_extract_section(content, "## Current Focus"),
        active_projects=_extract_section(content, "## Active Projects"),
        next_action=_extract_section(content, "## Next Action"),
        decision_log=_extract_section(content, "## Decision Log"),
        raw_content=content,
    )


def _extract_section(content: str, header: str) -> str:
    """Extract content between a header and the next header of same or higher level."""
    pattern = re.escape(header) + r"\n(.*?)(?=\n## |\Z)"
    match = re.search(pattern, content, re.DOTALL)
    return match.group(1).strip() if match else ""


def validate_consensus(path: Path) -> tuple[bool, list[str]]:
    """Validate that consensus.md has required sections.

    Returns:
        A tuple of (valid, errors) where valid is True when no errors found.
    """
    errors: list[str] = []

    if not path.exists():
        return False, ["File does not exist"]

    if path.stat().st_size == 0:
        return False, ["File is empty"]

    content = path.read_text(encoding="utf-8")

    for section in REQUIRED_SECTIONS:
        if section not in content:
            errors.append(f"Missing required section: {section}")

    return len(errors) == 0, errors


def backup_consensus(path: Path) -> Path:
    """Create a timestamped backup of consensus.md.

    Returns:
        Path to the backup file.

    Raises:
        FileNotFoundError: If the consensus file does not exist.
    """
    if not path.exists():
        raise FileNotFoundError(f"Consensus file not found: {path}")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_suffix(f".{timestamp}.bak")
    shutil.copy2(path, backup_path)
    return backup_path


def restore_consensus(path: Path, backup_path: Path) -> None:
    """Restore consensus from a backup file.

    Raises:
        FileNotFoundError: If the backup file does not exist.
    """
    if not backup_path.exists():
        raise FileNotFoundError(f"Backup file not found: {backup_path}")
    shutil.copy2(backup_path, path)
