# Contributing to AI Factory

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.70+
- System dependencies for [Tauri 2](https://v2.tauri.app/start/prerequisites/)

### Setup

```bash
git clone https://github.com/KuaaMU/ai-factory.git
cd ai-factory/app
npm install
npm run tauri dev
```

## Ways to Contribute

### Good First Issues

Check out issues labeled [`good first issue`](https://github.com/KuaaMU/ai-factory/labels/good%20first%20issue) for beginner-friendly tasks.

### Add a Persona

1. Browse existing personas in `library/personas/`
2. Create a new YAML file following the same format
3. Include: name, role, description, system prompt, skills, priority
4. Submit a PR

### Add a Skill

1. Browse existing skills in `library/skills/`
2. Create a new directory with a `SKILL.md` file
3. Include: title, description, content
4. Submit a PR

### Add a Language

1. Open `app/src/lib/i18n.tsx`
2. Copy the `en` translations
3. Translate all values
4. Add your language to the selector
5. Submit a PR

### Add an MCP Preset

1. Check `app/src-tauri/src/commands/mcp.rs` for the format
2. Add a new preset with: name, description, command, args, env
3. Test with Claude Code
4. Submit a PR

## Code Style

- **Frontend**: TypeScript + React, functional components, TanStack Query for data fetching
- **Backend**: Rust, serde for serialization, Tauri commands as the API layer
- **CSS**: Tailwind + CSS variables for theming

## Pull Request Process

1. Fork the repo and create a feature branch
2. Make your changes
3. Test with `npm run tauri dev`
4. Verify the build with `npm run tauri build`
5. Submit a PR with a clear description

## Reporting Bugs

Use [GitHub Issues](https://github.com/KuaaMU/ai-factory/issues) with:
- OS and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
