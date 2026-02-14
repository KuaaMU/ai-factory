# AI Factory - Self-Bootstrapping Factory

## Vision

Seed Prompt -> Bootstrap Agent -> Company Config -> Spawn Agent Team -> Research -> Build -> Deploy -> Self-Evolve

User provides one sentence (e.g., "Build a time-tracking SaaS for freelancers").
The system automatically:
1. Analyzes the domain, selects appropriate expert roles
2. Generates a complete company.yaml configuration
3. Creates all .claude/ agent definitions, skills, and settings
4. Generates CLAUDE.md charter and PROMPT.md execution rules
5. Starts an autonomous loop that runs 24/7
6. Self-evaluates after each cycle and evolves team composition

## Architecture

```
CLI Entry Point: `aifactory up "seed prompt"`
         |
    Bootstrap Agent (analyzes seed, selects roles, generates config)
         |
    Config Generator (company.yaml -> .claude/agents/ + skills/ + CLAUDE.md)
         |
    Agent Runtime (auto-loop.sh -> claude -p -> consensus.md relay)
         |
    Provider Router (Claude <-> Codex <-> Gemini auto-failover)
         |
    Self-Evolution Engine (evaluate cycle -> adjust team/skills/model)
```

## Project Structure

```
ai-factory/
├── factory/                     # Core Python package
│   ├── __init__.py
│   ├── cli.py                   # CLI entry point (Click)
│   ├── bootstrap.py             # Bootstrap agent: seed -> config
│   ├── config.py                # Company config schema (Pydantic)
│   ├── generator.py             # Config -> .claude/ files generator
│   ├── runtime.py               # Manages the execution loop
│   ├── router.py                # Multi-provider routing + failover
│   ├── memory.py                # Consensus memory management
│   ├── guardrails.py            # Safety guardrail enforcement
│   └── evolution.py             # Self-evaluation & team evolution
├── templates/                   # Jinja2 templates
│   ├── claude_md.j2
│   ├── prompt_md.j2
│   ├── agent.j2
│   ├── skill.j2
│   ├── consensus_init.j2
│   └── settings.j2
├── library/                     # Pre-built personas & skills
│   ├── personas/
│   ├── skills/
│   └── workflows/
├── scripts/
│   ├── auto-loop.sh
│   ├── stop-loop.sh
│   └── monitor.sh
├── tests/
├── output/                      # Runtime output (generated)
├── Makefile
├── pyproject.toml
└── README.md
```

## Implementation Phases

### Phase 1: Foundation (Config + Schema + CLI)
- pyproject.toml with dependencies (click, pydantic, jinja2, pyyaml)
- factory/config.py - Pydantic models for company.yaml schema
- factory/cli.py - CLI commands: init, up, stop, status, evolve
- templates/ - All Jinja2 templates
- Makefile with common commands

### Phase 2: Persona & Skill Library
- library/personas/ - 14 expert personas ported from auto-company
- library/skills/ - 30+ skills in portable YAML format
- library/workflows/ - 6 standard workflow chains

### Phase 3: Bootstrap Agent & Generator
- factory/bootstrap.py - Seed prompt -> company config generation
- factory/generator.py - company.yaml -> .claude/ directory generation
- factory/memory.py - Consensus memory initialization
- factory/guardrails.py - Safety guardrail validation

### Phase 4: Runtime & Loop
- scripts/auto-loop.sh - Enhanced from auto-company (multi-engine)
- factory/runtime.py - Python wrapper for loop management
- factory/router.py - Multi-provider routing with failover

### Phase 5: Self-Evolution
- factory/evolution.py - Cycle evaluation + team adjustment
- Dynamic skill selection and model routing per agent

### Phase 6: Tests
- Unit tests for all modules
- Integration test: seed -> config -> generate -> validate
