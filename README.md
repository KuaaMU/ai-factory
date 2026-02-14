<p align="center">
  <img src="app/src-tauri/icons/icon.png" width="120" alt="AI Factory Logo" />
</p>

<h1 align="center">AI Factory</h1>

<p align="center">
  <strong>One sentence in, an autonomous AI company out.</strong><br/>
  Seed Prompt &rarr; Agent Team &rarr; Autonomous Loop &rarr; Self-Evolving Company
</p>

<p align="center">
  <a href="https://github.com/KuaaMU/ai-factory/releases"><img src="https://img.shields.io/github/v/release/KuaaMU/ai-factory?style=flat-square&color=blue" alt="Release" /></a>
  <a href="https://github.com/KuaaMU/ai-factory/blob/main/LICENSE"><img src="https://img.shields.io/github/license/KuaaMU/ai-factory?style=flat-square" alt="License" /></a>
  <a href="https://github.com/KuaaMU/ai-factory/stargazers"><img src="https://img.shields.io/github/stars/KuaaMU/ai-factory?style=flat-square" alt="Stars" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/built%20with-Tauri%202%20%2B%20React-orange?style=flat-square" alt="Tech" />
</p>

---

## What is AI Factory?

AI Factory is a **desktop application** that bootstraps fully autonomous AI companies from a single seed prompt. It orchestrates multi-agent teams powered by Claude Code, Codex CLI, or OpenCode, running 24/7 autonomous loops with shared consensus memory.

**Think of it as:** a visual control tower for spawning and managing AI agent swarms that build real software products.

```
"Build a time-tracking SaaS for freelancers"
                    |
        AI Factory analyzes domain
                    |
   Generates 12-agent team (CEO, CTO, Fullstack, DevOps, QA...)
                    |
     Starts autonomous build loop with consensus
                    |
   Agents collaborate, review, deploy, self-evolve
```

## Key Features

### Agent Orchestration
- **One-click bootstrap** - describe your idea, get a complete AI company with agents, skills, and workflows
- **12+ specialized roles** - CEO, CTO, Fullstack, DevOps, QA, Marketing, Design, and more
- **Multi-engine support** - Claude Code, Codex CLI, OpenCode with automatic failover
- **Consensus-driven** - agents share state through a consensus memory document
- **Cycle history & logs** - real-time monitoring of agent activity

### Resource Library
- **40+ built-in skills** - from coding standards to deployment patterns
- **Pre-built personas** - battle-tested agent configurations for every role
- **Workflow chains** - coordinated multi-agent execution sequences
- **MCP integration** - connect agents to external services (GitHub, Slack, databases, web search)
- **Remote repositories** - browse and install skills from any GitHub repo

### Developer Experience
- **6 color themes** - 3 dark (Obsidian, Cyber, Ember) + 3 light (Daylight, Paper, Lavender)
- **Auto-detect providers** - scans your system for existing API keys (Anthropic, OpenAI, OpenRouter)
- **System diagnostics** - detects installed CLI tools, shells, and environments
- **Bilingual UI** - English & Chinese
- **Auto-update** - built-in update checker with one-click download

## Screenshots

| Dashboard | Project Detail | Library |
|:---------:|:--------------:|:-------:|
| Manage all projects | Real-time agent monitoring | Browse skills & agents |

| Settings | Theme Selector | Repo Browser |
|:--------:|:--------------:|:------------:|
| Provider management | 6 themes (dark + light) | Install from GitHub |

## Quick Start

### Download

Grab the latest release from [GitHub Releases](https://github.com/KuaaMU/ai-factory/releases):

- **Windows**: `AI Factory_x.x.x_x64-setup.exe` (NSIS) or `.msi`
- **macOS**: `.dmg` (Apple Silicon + Intel) - via CI/CD
- **Linux**: `.AppImage` / `.deb` - via CI/CD

### Prerequisites

You need at least one AI coding CLI installed:

| Engine | Install | Required? |
|--------|---------|-----------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `npm install -g @anthropic-ai/claude-code` | Recommended |
| [Codex CLI](https://github.com/openai/codex) | `npm install -g @openai/codex` | Optional |
| [OpenCode](https://github.com/opencode-ai/opencode) | `go install github.com/opencode-ai/opencode@latest` | Optional |

### First Run

1. Open AI Factory
2. Go to **Settings > AI Providers** > click "Detect Configurations" to auto-import your API keys
3. Go to **Settings > System** > click "Refresh" to verify your CLI tools are detected
4. Click **New Project**, enter your seed prompt, and follow the wizard
5. Hit **Start** on the project detail page to begin the autonomous loop

## Architecture

```
                    +-------------------+
                    |   Tauri Desktop   |
                    |   (Rust + React)  |
                    +--------+----------+
                             |
              +--------------+--------------+
              |              |              |
        +-----+----+  +-----+----+  +------+-----+
        | Bootstrap |  | Runtime  |  |  Library   |
        |  Engine   |  |  Loop    |  |  Manager   |
        +-----+----+  +-----+----+  +------+-----+
              |              |              |
         Seed Analysis   Agent Cycle    Skills/MCP/
         Config Gen      Consensus      Repo Browser
         File Gen        Log/Monitor    GitHub API
              |              |
        +-----+--------------+-----+
        |     Provider Router      |
        | Claude | Codex | OpenCode|
        +--------------------------+
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Tauri 2 |
| Backend | Rust (serde, ureq, chrono) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS + CSS Variables |
| State Management | TanStack Query |
| Build | Vite + Cargo |
| Packaging | NSIS / MSI / DMG |

## Project Structure

```
ai-factory/
├── .github/                       # CI/CD & community
│   ├── workflows/build.yml        # Cross-platform build (Windows/macOS/Linux)
│   └── FUNDING.yml                # GitHub Sponsors
├── app/                           # Tauri desktop application
│   ├── src/                       # React frontend
│   │   ├── routes/                # Pages: Dashboard, NewProject, Library, Settings
│   │   ├── components/            # Layout, Sidebar
│   │   ├── lib/                   # Types, Tauri bindings, i18n, utils
│   │   └── styles/                # Global CSS with 6 themes
│   ├── src-tauri/                 # Rust backend
│   │   ├── src/
│   │   │   ├── commands/          # Tauri commands
│   │   │   │   ├── bootstrap.rs   # Seed analysis & config generation
│   │   │   │   ├── runtime.rs     # Agent loop management
│   │   │   │   ├── library.rs     # Persona/skill/workflow listing
│   │   │   │   ├── settings.rs    # App settings CRUD
│   │   │   │   ├── mcp.rs         # MCP server management
│   │   │   │   ├── repo_manager.rs# GitHub repo browser & installer
│   │   │   │   ├── skill_manager.rs# Local skill scanner
│   │   │   │   ├── provider_detect.rs # Auto-detect API configs
│   │   │   │   └── system.rs      # System environment detection
│   │   │   ├── engine/            # Bootstrap & generator engines
│   │   │   └── models/            # Shared data structures
│   │   └── Cargo.toml
│   └── package.json
├── library/                       # Built-in resource library
│   ├── personas/                  # 14 expert persona YAMLs
│   ├── skills/                    # Skill definitions (YAML)
│   ├── real-skills/               # Community skills (SKILL.md format)
│   ├── ecc-skills/                # ECC skills collection
│   ├── real-agents/               # Agent prompt templates (Markdown)
│   └── workflows/                 # Workflow chain YAMLs
├── CONTRIBUTING.md                # Contribution guide
├── LICENSE                        # MIT
└── README.md
```

## Contributing

Contributions are welcome! Here are some areas where help is needed:

- **macOS / Linux builds** - CI/CD for cross-platform releases
- **New personas & skills** - expand the built-in library
- **MCP server integrations** - add more preset MCP configurations
- **UI/UX improvements** - better data visualization for agent activity
- **Internationalization** - add more languages

### Development Setup

```bash
# Clone the repo
git clone https://github.com/KuaaMU/ai-factory.git
cd ai-factory/app

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

**Requirements:** Node.js 18+, Rust 1.70+, system dependencies for [Tauri 2](https://v2.tauri.app/start/prerequisites/).

## Roadmap

- [x] Tauri desktop app with React UI
- [x] Multi-engine support (Claude Code, Codex, OpenCode)
- [x] Auto-detect existing API configurations
- [x] 6 color themes (dark + light)
- [x] MCP server integration
- [x] Remote skill repository browser
- [x] macOS & Linux builds (CI/CD)
- [ ] Agent performance analytics dashboard
- [ ] Cost tracking & budget visualization
- [ ] Plugin system for custom engines
- [ ] Skill marketplace (community-driven)
- [ ] Real-time agent collaboration view

## Star History

<a href="https://star-history.com/#KuaaMU/ai-factory&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=KuaaMU/ai-factory&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=KuaaMU/ai-factory&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=KuaaMU/ai-factory&type=Date" />
 </picture>
</a>

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built with Tauri, React, and a lot of autonomous agents.</sub><br/>
  <sub>If this project is useful to you, please consider giving it a <a href="https://github.com/KuaaMU/ai-factory">star</a>.</sub>
</p>
