"""AI Factory Runtime - manages the auto-loop lifecycle."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Optional
import os
import subprocess
import re

if TYPE_CHECKING:
    from factory.config import FactoryConfig


@dataclass(frozen=True)
class RuntimeStatus:
    """Immutable snapshot of the auto-loop state."""

    loop_count: int
    error_count: int
    status: str  # running, idle, stopped, waiting_limit, circuit_break
    model: str
    engine: str
    last_run: str


@dataclass(frozen=True)
class CycleResult:
    """Immutable record of a single cycle's outcome."""

    cycle_number: int
    status: str  # ok, fail, timeout
    cost_usd: Optional[float]
    summary: str
    timestamp: str


def _scripts_dir() -> Path:
    """Return the path to the scripts directory."""
    return Path(__file__).resolve().parent.parent / "scripts"


def _parse_state_file(state_path: Path) -> dict[str, str]:
    """Parse a key=value state file into a dictionary."""
    result: dict[str, str] = {}
    if not state_path.is_file():
        return result
    content = state_path.read_text(encoding="utf-8")
    for line in content.strip().splitlines():
        line = line.strip()
        if "=" in line:
            key, _, value = line.partition("=")
            result[key.strip()] = value.strip()
    return result


def _parse_cycle_log(log_path: Path) -> Optional[CycleResult]:
    """Parse a cycle log file into a CycleResult."""
    if not log_path.is_file():
        return None
    content = log_path.read_text(encoding="utf-8")
    lines = content.strip().splitlines()

    fields: dict[str, str] = {}
    summary_lines: list[str] = []
    past_separator = False

    for line in lines:
        if line.strip() == "---":
            past_separator = True
            continue
        if past_separator:
            summary_lines.append(line)
        elif ":" in line:
            key, _, value = line.partition(":")
            fields[key.strip()] = value.strip()

    cost_str = fields.get("cost", "")
    cost_usd: Optional[float] = None
    if cost_str:
        try:
            cost_usd = float(cost_str)
        except ValueError:
            cost_usd = None

    cycle_str = fields.get("cycle", "0")
    try:
        cycle_number = int(cycle_str)
    except ValueError:
        cycle_number = 0

    return CycleResult(
        cycle_number=cycle_number,
        status=fields.get("status", "unknown"),
        cost_usd=cost_usd,
        summary="\n".join(summary_lines),
        timestamp=fields.get("timestamp", ""),
    )


def _build_env_from_config(config: FactoryConfig, output_dir: Path) -> dict[str, str]:
    """Build environment variables from a FactoryConfig."""
    runtime = config.runtime
    providers = runtime.providers
    primary = providers[0] if providers else None

    env: dict[str, str] = {
        **os.environ,
        "OUTPUT_DIR": str(output_dir),
        "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
        "LOOP_INTERVAL": str(runtime.loop_interval),
        "CYCLE_TIMEOUT_SECONDS": str(runtime.cycle_timeout),
        "MAX_CONSECUTIVE_ERRORS": str(runtime.max_consecutive_errors),
    }

    if primary is not None:
        env["ENGINE"] = primary.engine.value
        env["MODEL"] = primary.model

    return env


def start_loop(
    output_dir: Path,
    engine: str = "claude",
    model: str = "opus",
    foreground: bool = True,
    config: Optional[FactoryConfig] = None,
) -> int:
    """Start the auto-loop script. Returns the process PID.

    If a FactoryConfig is provided, environment variables are derived from
    the config's runtime section. Otherwise, engine/model are used directly.

    Args:
        output_dir: Directory for loop state, logs, and consensus.
        engine: AI engine to use ("claude" or "codex"). Ignored when config is provided.
        model: Model name (e.g. "opus", "sonnet"). Ignored when config is provided.
        foreground: If True, block until the loop exits. If False, run in background.
        config: Optional FactoryConfig to derive all settings from.

    Returns:
        The PID of the launched process.

    Raises:
        FileNotFoundError: If the auto-loop script is missing.
        RuntimeError: If the loop is already running.
    """
    script_path = _scripts_dir() / "auto-loop.sh"
    if not script_path.is_file():
        raise FileNotFoundError(f"Auto-loop script not found: {script_path}")

    if is_running(output_dir):
        raise RuntimeError("Auto-loop is already running")

    if config is not None:
        env = _build_env_from_config(config, output_dir)
    else:
        env = {
            **os.environ,
            "ENGINE": engine,
            "MODEL": model,
            "OUTPUT_DIR": str(output_dir),
            "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
        }

    if foreground:
        process = subprocess.Popen(
            ["bash", str(script_path)],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        return process.pid
    else:
        process = subprocess.Popen(
            ["bash", str(script_path)],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return process.pid


def stop_loop(output_dir: Path, force: bool = False) -> None:
    """Stop the running loop.

    Args:
        output_dir: Directory containing the loop state files.
        force: If True, use SIGKILL after graceful timeout.

    Raises:
        FileNotFoundError: If no PID file exists.
    """
    script_path = _scripts_dir() / "stop-loop.sh"
    args = ["bash", str(script_path), "--output-dir", str(output_dir)]
    if force:
        args.append("--force")

    result = subprocess.run(args, capture_output=True, text=True, timeout=90)
    if result.returncode != 0:
        raise RuntimeError(
            f"Failed to stop loop: {result.stderr.strip() or result.stdout.strip()}"
        )


def get_status(output_dir: Path) -> Optional[RuntimeStatus]:
    """Read state file and return the current runtime status.

    Returns None if no state file exists.
    """
    state_path = output_dir / ".auto-loop-state"
    fields = _parse_state_file(state_path)
    if not fields:
        return None

    try:
        loop_count = int(fields.get("cycle_count", "0"))
    except ValueError:
        loop_count = 0

    try:
        error_count = int(fields.get("error_count", "0"))
    except ValueError:
        error_count = 0

    return RuntimeStatus(
        loop_count=loop_count,
        error_count=error_count,
        status=fields.get("status", "unknown"),
        model=fields.get("model", ""),
        engine=fields.get("engine", ""),
        last_run=fields.get("last_run", ""),
    )


def get_latest_cycle(output_dir: Path) -> Optional[CycleResult]:
    """Parse the latest cycle log file.

    Scans the logs directory for cycle-*.log files and returns the
    one with the highest cycle number.
    """
    log_dir = output_dir / "logs"
    if not log_dir.is_dir():
        return None

    cycle_logs = sorted(
        log_dir.glob("cycle-*.log"),
        key=lambda p: _extract_cycle_number(p.name),
        reverse=True,
    )
    if not cycle_logs:
        return None

    return _parse_cycle_log(cycle_logs[0])


def _extract_cycle_number(filename: str) -> int:
    """Extract the cycle number from a filename like 'cycle-42.log'."""
    match = re.search(r"cycle-(\d+)\.log$", filename)
    if match:
        return int(match.group(1))
    return 0


def is_running(output_dir: Path) -> bool:
    """Check if the auto-loop is currently running.

    Verifies both that a PID file exists and that the process is alive.
    """
    pid_file = output_dir / ".auto-loop.pid"
    if not pid_file.is_file():
        return False

    pid_str = pid_file.read_text(encoding="utf-8").strip()
    try:
        pid = int(pid_str)
    except ValueError:
        return False

    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False
    except OSError:
        return False
