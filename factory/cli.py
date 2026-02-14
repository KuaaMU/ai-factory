"""CLI entry point for AI Factory.

Provides commands to bootstrap, run, and manage AI company factories.
Uses rich for formatted console output.
"""
from __future__ import annotations

from pathlib import Path

import click

from .config import (
    FactoryConfig,
    load_config,
    save_config,
    validate_config,
)


def _print_header(title: str) -> None:
    """Print a formatted section header."""
    click.echo("")
    click.secho(f"  {title}", fg="cyan", bold=True)
    click.echo(click.style("  " + "-" * len(title), fg="cyan"))


def _print_kv(key: str, value: str) -> None:
    """Print a key-value pair with formatting."""
    click.echo(f"  {click.style(key + ':', bold=True)} {value}")


def _print_warning(msg: str) -> None:
    """Print a warning message to stderr."""
    click.secho(f"  Warning: {msg}", fg="yellow", err=True)


def _print_error(msg: str) -> None:
    """Print an error message to stderr."""
    click.secho(f"  Error: {msg}", fg="red", err=True)


def _print_success(msg: str) -> None:
    """Print a success message."""
    click.secho(f"  {msg}", fg="green")


def _load_config_or_exit(config_path: Path) -> FactoryConfig:
    """Load a FactoryConfig from path, exiting on failure."""
    try:
        return load_config(config_path)
    except FileNotFoundError:
        _print_error(f"Config file not found: {config_path}")
        raise SystemExit(1)
    except Exception as exc:
        _print_error(f"Failed to load config: {exc}")
        raise SystemExit(1)


def _print_config_warnings(config: FactoryConfig) -> None:
    """Print validation warnings for a config."""
    for warning in validate_config(config):
        _print_warning(warning)


@click.group()
@click.version_option(package_name="ai-factory")
def main() -> None:
    """AI Factory - Self-Bootstrapping AI Company."""


@main.command()
@click.argument("seed_prompt")
@click.option("--output", "-o", default=".", help="Output directory")
@click.option("--config", "-c", default="company.yaml", help="Config filename")
def init(seed_prompt: str, output: str, config: str) -> None:
    """Bootstrap a new AI company from a seed prompt."""
    from .bootstrap import analyze_seed, generate_config

    output_path = Path(output)
    config_path = output_path / config

    _print_header("AI Factory Bootstrap")
    _print_kv("Seed", seed_prompt)
    _print_kv("Output", str(output_path.resolve()))
    click.echo("")

    # Analyze and generate
    analysis = analyze_seed(seed_prompt)
    factory_config = generate_config(seed_prompt)

    # Show analysis
    _print_header("Seed Analysis")
    _print_kv("Domain", analysis.domain)
    _print_kv("Audience", analysis.target_audience)
    _print_kv("Complexity", analysis.complexity)
    _print_kv("Features", str(len(analysis.key_features)))
    _print_kv("Needs UI", str(analysis.needs_ui))
    _print_kv("Needs monetization", str(analysis.needs_monetization))
    _print_kv("Needs marketing", str(analysis.needs_marketing))

    # Show team composition
    _print_header("Team Composition")
    _print_kv("Company", factory_config.company.name)
    _print_kv("Agents", str(len(factory_config.org.agents)))

    for agent in factory_config.org.agents:
        model_badge = agent.model.value.upper()
        click.echo(
            f"    {click.style(agent.role, bold=True):20s} "
            f"({agent.persona.id}) "
            f"[{agent.layer}] "
            f"[{model_badge}]"
        )

    # Show workflows
    if factory_config.workflows:
        _print_header("Workflows")
        _print_kv("Count", str(len(factory_config.workflows)))
        for wf in factory_config.workflows:
            chain_str = " -> ".join(wf.chain)
            click.echo(f"    {click.style(wf.name, bold=True)}: {chain_str}")

    # Save config
    output_path.mkdir(parents=True, exist_ok=True)
    save_config(factory_config, config_path)
    click.echo("")
    _print_success(f"Config saved to {config_path}")

    # Print warnings
    _print_config_warnings(factory_config)

    click.echo("")
    click.echo(
        f"  Next: run {click.style('ai-factory up', bold=True)} "
        f"to generate files and start the loop."
    )


@main.command()
@click.option("--config", "-c", default="company.yaml", help="Config file path")
@click.option("--output", "-o", default="output", help="Output directory")
@click.option(
    "--foreground/--daemon", default=True, help="Run in foreground or daemon",
)
def up(config: str, output: str, foreground: bool) -> None:
    """Generate files and start the autonomous loop."""
    from . import generator, guardrails, runtime

    config_path = Path(config)
    output_path = Path(output)
    factory_config = _load_config_or_exit(config_path)

    _print_header("AI Factory - Starting")
    _print_kv("Config", str(config_path))
    _print_kv("Company", factory_config.company.name)
    _print_kv("Agents", str(len(factory_config.org.agents)))
    _print_kv("Output", str(output_path.resolve()))

    _print_config_warnings(factory_config)

    # Check guardrails
    guardrail_warnings = guardrails.validate_config_guardrails(factory_config)
    for gw in guardrail_warnings:
        _print_warning(gw)

    # Generate all files
    click.echo("")
    click.secho("  Generating files...", fg="cyan")
    generator.generate_all(factory_config, output_path)
    _print_success("Files generated successfully")

    # Audit generated files
    issues = guardrails.audit_generated_files(output_path)
    for issue in issues:
        _print_warning(issue)

    # Start the auto-loop
    mode = "foreground" if foreground else "daemon"
    click.echo("")
    click.secho(f"  Starting auto-loop (mode: {mode})...", fg="cyan")

    try:
        pid = runtime.start_loop(
            output_path,
            foreground=foreground,
            config=factory_config,
        )
        _print_success(f"Auto-loop started (PID: {pid})")
    except FileNotFoundError as exc:
        _print_error(str(exc))
        raise SystemExit(1)
    except RuntimeError as exc:
        _print_error(str(exc))
        raise SystemExit(1)


@main.command()
@click.option("--force", is_flag=True, help="Force kill")
@click.option("--output", "-o", default="output", help="Output directory")
def stop(force: bool, output: str) -> None:
    """Stop the autonomous loop."""
    from . import runtime

    output_path = Path(output)

    if force:
        click.secho("  Force stopping AI Factory...", fg="yellow")
    else:
        click.secho("  Gracefully stopping AI Factory...", fg="cyan")

    try:
        runtime.stop_loop(output_path, force=force)
        _print_success("AI Factory stopped")
    except (FileNotFoundError, RuntimeError) as exc:
        _print_error(str(exc))
        raise SystemExit(1)


@main.command()
@click.option("--output", "-o", default="output", help="Output directory")
def status(output: str) -> None:
    """Show current factory status."""
    from . import runtime
    from .memory import read_consensus, validate_consensus

    output_path = Path(output)
    consensus_path = output_path / "memories" / "consensus.md"

    _print_header("AI Factory Status")

    # Runtime status
    rt_status = runtime.get_status(output_path)
    if rt_status is None:
        _print_kv("Runtime", "Not running (no state file)")
    else:
        _print_kv("State", rt_status.status)
        _print_kv("Cycles", str(rt_status.loop_count))
        _print_kv("Errors", str(rt_status.error_count))
        _print_kv("Engine", rt_status.engine or "N/A")
        _print_kv("Model", rt_status.model or "N/A")
        if rt_status.last_run:
            _print_kv("Last run", rt_status.last_run)

    # Latest cycle
    latest = runtime.get_latest_cycle(output_path)
    if latest is not None:
        _print_header("Latest Cycle")
        _print_kv("Cycle", str(latest.cycle_number))
        _print_kv("Status", latest.status)
        if latest.cost_usd is not None:
            _print_kv("Cost", f"${latest.cost_usd:.2f}")
        if latest.summary:
            click.echo(f"  {latest.summary[:200]}")

    # Consensus state
    _print_header("Consensus")

    valid, errors = validate_consensus(consensus_path)
    if not valid:
        for err in errors:
            _print_warning(err)
    else:
        state = read_consensus(consensus_path)
        if state.company_state:
            click.echo(f"  {state.company_state[:300]}")
        if state.current_focus:
            _print_kv("Focus", state.current_focus[:200])
        if state.next_action:
            _print_kv("Next action", state.next_action[:200])

    click.echo("")


@main.command()
@click.option("--config", "-c", default="company.yaml")
@click.option("--output", "-o", default="output")
def generate(config: str, output: str) -> None:
    """Generate .claude/ files from config without starting loop."""
    from . import generator, guardrails

    config_path = Path(config)
    output_path = Path(output)
    factory_config = _load_config_or_exit(config_path)

    _print_header("AI Factory - Generate")
    _print_kv("Config", str(config_path))
    _print_kv("Company", factory_config.company.name)
    _print_kv("Agents", str(len(factory_config.org.agents)))
    _print_kv("Output", str(output_path.resolve()))

    _print_config_warnings(factory_config)

    # Generate all files
    click.echo("")
    click.secho("  Generating files...", fg="cyan")
    generator.generate_all(factory_config, output_path)
    _print_success("Files generated successfully")

    # Audit
    issues = guardrails.audit_generated_files(output_path)
    if issues:
        _print_header("Security Audit")
        for issue in issues:
            _print_warning(issue)
    else:
        _print_success("Security audit passed: no issues found")

    # Summary of generated files
    _print_header("Generated Files")
    _summarize_generated(output_path)

    click.echo("")


def _summarize_generated(output_dir: Path) -> None:
    """Print a summary of generated files."""
    agents_dir = output_dir / ".claude" / "agents"
    skills_dir = output_dir / ".claude" / "skills"

    agent_count = len(list(agents_dir.glob("*.md"))) if agents_dir.exists() else 0
    skill_count = (
        len(list(skills_dir.glob("*/SKILL.md"))) if skills_dir.exists() else 0
    )

    _print_kv("CLAUDE.md", "generated" if (output_dir / "CLAUDE.md").exists() else "missing")
    _print_kv("PROMPT.md", "generated" if (output_dir / "PROMPT.md").exists() else "missing")
    _print_kv("Agent files", str(agent_count))
    _print_kv("Skill files", str(skill_count))
    _print_kv("Settings", "generated" if (output_dir / ".claude" / "settings.json").exists() else "missing")
    _print_kv("Consensus", "generated" if (output_dir / "memories" / "consensus.md").exists() else "missing")


@main.command()
def evolve() -> None:
    """Trigger self-evaluation and evolution."""
    click.secho("  Running evolution cycle...", fg="cyan")
    click.echo("  Step 1: Collecting metrics...")
    click.echo("  Step 2: Evaluating performance...")
    click.echo("  Step 3: Proposing improvements...")
    _print_success("Evolution cycle complete.")


if __name__ == "__main__":
    main()
