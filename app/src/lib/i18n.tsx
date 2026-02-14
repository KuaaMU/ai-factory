import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadSettings, saveSettings } from "@/lib/tauri";
import type { AppSettings } from "@/lib/types";

// ===== Translation dictionaries =====

const en = {
  // Sidebar
  "sidebar.dashboard": "Dashboard",
  "sidebar.newProject": "New Project",
  "sidebar.library": "Library",
  "sidebar.settings": "Settings",
  "sidebar.version": "AI Factory v0.2.1",
  "sidebar.checkUpdate": "Check for Updates",
  "sidebar.checking": "Checking...",
  "sidebar.updateAvailable": "Update Available",
  "sidebar.upToDate": "Up to Date",

  // Common
  "common.start": "Start",
  "common.stop": "Stop",
  "common.delete": "Delete",
  "common.save": "Save",
  "common.saved": "Saved",
  "common.back": "Back",
  "common.next": "Next",
  "common.loading": "Loading...",
  "common.search": "Search",
  "common.agents": "agents",
  "common.cycles": "cycles",
  "common.add": "Add",
  "common.live": "Live",

  // Dashboard
  "dashboard.title": "Dashboard",
  "dashboard.subtitle": "Manage your autonomous AI companies",
  "dashboard.newProject": "New Project",
  "dashboard.noProjects": "No projects yet",
  "dashboard.noProjectsDesc": "Create your first AI company from a seed prompt",
  "dashboard.createProject": "Create Project",

  // NewProject
  "newProject.title": "Create New AI Company",
  "newProject.subtitle": "Bootstrap an autonomous company from a single seed prompt",
  "newProject.step.seed": "Seed Prompt",
  "newProject.step.analysis": "Analysis",
  "newProject.step.roles": "Roles",
  "newProject.step.configure": "Configure",
  "newProject.step.generate": "Generate",
  "newProject.whatToBuild": "What do you want to build?",
  "newProject.placeholder": "Describe your product idea in one sentence...",
  "newProject.quickStart": "Quick start:",
  "newProject.seedAnalysis": "Seed Analysis",
  "newProject.domain": "Domain",
  "newProject.audience": "Audience",
  "newProject.complexity": "Complexity",
  "newProject.teamSize": "Team Size",
  "newProject.detectedFeatures": "Detected Features",
  "newProject.selectRoles": "Select Team Roles",
  "newProject.selected": "selected",
  "newProject.configuration": "Configuration",
  "newProject.outputDir": "Output Directory",
  "newProject.outputDirHint": "All project files (agents, consensus, scripts, logs) will be created here",
  "newProject.creating": "Creating your AI company...",
  "newProject.creatingDesc": "Generating agents, scripts, consensus, and configuration files",
  "newProject.success": "Company created successfully!",
  "newProject.agentsConfigured": "agents configured",
  "newProject.workflowsSetUp": "workflows set up",
  "newProject.output": "Output",
  "newProject.goToDashboard": "Go to Dashboard",
  "newProject.readyToGenerate": "Ready to generate your AI company with",
  "newProject.willCreate": "This will create all project files in",
  "newProject.createCompany": "Create Company",

  // ProjectDetail
  "projectDetail.status": "Status",
  "projectDetail.cycles": "Cycles",
  "projectDetail.agents": "Agents",
  "projectDetail.consensus": "Consensus",
  "projectDetail.running": "Running",
  "projectDetail.stopped": "Stopped",
  "projectDetail.focus": "Focus",
  "projectDetail.next": "Next",
  "projectDetail.revenue": "Revenue",
  "projectDetail.projects": "Projects",
  "projectDetail.notSet": "Not set",
  "projectDetail.consensusNotInit": "Consensus not initialized. Start the loop to begin.",
  "projectDetail.recentCycles": "Recent Cycles",
  "projectDetail.noCycles": "No cycles yet. Start the loop to begin.",
  "projectDetail.logs": "Logs",
  "projectDetail.waitingForLogs": "Waiting for log output... Start the loop to begin.",
  "projectDetail.deleteConfirm": "Delete this project? This cannot be undone.",
  "projectDetail.errors": "errors",
  "projectDetail.goToSettings": "Go to Settings",
  "projectDetail.handoff": "Handoff Note",
  "projectDetail.noHandoff": "No handoff note yet. Start the loop to begin.",
  "projectDetail.agentMemory": "Agent Memory",
  "projectDetail.noMemory": "No memory recorded yet for this agent.",
  "projectDetail.selectAgent": "Select an agent to view its memory.",

  // Library
  "library.title": "Library",
  "library.subtitle": "Browse agents, skills, and workflows",
  "library.agents": "Agents",
  "library.skills": "Skills",
  "library.workflows": "Workflows",
  "library.searchAgents": "Search agents...",
  "library.searchSkills": "Search skills...",
  "library.searchWorkflows": "Search workflows...",
  "library.convergence": "Convergence",

  // Settings
  "settings.title": "Settings",
  "settings.subtitle": "Configure AI Factory defaults",
  "settings.aiProviders": "AI Providers",
  "settings.aiProvidersDesc": "Configure API keys and endpoints for your AI providers",
  "settings.providerType": "Provider Type",
  "settings.displayName": "Display Name",
  "settings.apiKey": "API Key",
  "settings.apiBaseUrl": "API Base URL",
  "settings.defaultModel": "Default Model",
  "settings.addProvider": "Add Provider",
  "settings.noProviders": "No providers configured. Add one to get started.",
  "settings.runtimeDefaults": "Runtime Defaults",
  "settings.defaultEngine": "Default Engine",
  "settings.model": "Default Model",
  "settings.maxDailyBudget": "Max Daily Budget (USD)",
  "settings.alertAt": "Alert At (USD)",
  "settings.loopInterval": "Loop Interval (seconds)",
  "settings.cycleTimeout": "Cycle Timeout (seconds)",
  "settings.projectsDir": "Projects Directory",
  "settings.saveSettings": "Save Settings",
  "settings.saveFailed": "Failed to save settings",
  "settings.language": "Language",
  "settings.languageLabel": "Interface Language",

  // System Environment
  "system.title": "System Environment",
  "system.subtitle": "Detected system configuration and CLI tools",
  "system.os": "Operating System",
  "system.arch": "Architecture",
  "system.shell": "Default Shell",
  "system.nodeVersion": "Node.js",
  "system.npmVersion": "npm",
  "system.shells": "Shells",
  "system.cliTools": "CLI Tools",
  "system.available": "Available",
  "system.notFound": "Not Found",
  "system.version": "Version",
  "system.path": "Path",
  "system.install": "Install",
  "system.installing": "Installing...",
  "system.installSuccess": "Installed successfully",
  "system.installFailed": "Installation failed",
  "system.refresh": "Refresh",
  "system.refreshing": "Detecting...",
  "system.noNode": "Node.js is required to install CLI tools",
  "system.installGuide": "Install Guide",
  "system.engineCheck": "Engine Status",
  "system.engineOk": "Engine found and ready",
  "system.engineMissing": "Engine not found. Install it to start loops.",
  "system.clickRefresh": "Click Refresh to detect your system environment.",

  // Provider Detection
  "settings.quickSetup": "Quick Setup",
  "settings.quickSetupDesc": "Auto-detect existing API configurations from your system",
  "settings.detectProviders": "Detect Configurations",
  "settings.detecting": "Detecting...",
  "settings.noDetected": "No existing configurations found.",
  "settings.detectedFrom": "Source",
  "settings.importProvider": "Import",
  "settings.importAll": "Import All",
  "settings.exportProviders": "Export",
  "settings.importJson": "Import JSON",
  "settings.imported": "Imported",

  // MCP Servers
  "settings.mcpServers": "MCP Servers",
  "settings.mcpDesc": "Connect agents to external services via MCP",
  "settings.mcpPresets": "Quick Add",
  "settings.mcpConfigured": "Configured Servers",
  "settings.mcpNoServers": "No MCP servers configured. Add one from the presets above.",
  "settings.mcpAdded": "Added",

  // Settings Tabs
  "settings.tabGeneral": "General",
  "settings.tabProviders": "AI Providers",
  "settings.tabMcp": "MCP Servers",
  "settings.tabSystem": "System",

  // Library Management
  "library.addAgent": "Add Agent",
  "library.addSkill": "Add Skill",
  "library.scanSkills": "Scan Local Skills",
  "library.scanning": "Scanning...",
  "library.scanResults": "Found Skills",
  "library.noScanResults": "No skills found on your system.",
  "library.import": "Import",
  "library.imported": "Imported",
  "library.custom": "Custom",
  "library.name": "Name",
  "library.role": "Role",
  "library.expertise": "Expertise",
  "library.layer": "Layer",
  "library.mentalModels": "Mental Models",
  "library.coreCapabilities": "Core Capabilities",
  "library.description": "Description",
  "library.category": "Category",
  "library.content": "Content",
  "library.create": "Create",
  "library.cancel": "Cancel",
  "library.source": "Source",
  "library.path": "Path",
  "library.removeConfirm": "Remove this item? This cannot be undone.",
} as const;

const zh: Record<keyof typeof en, string> = {
  // Sidebar
  "sidebar.dashboard": "\u4eea\u8868\u76d8",
  "sidebar.newProject": "\u65b0\u5efa\u9879\u76ee",
  "sidebar.library": "\u8d44\u6e90\u5e93",
  "sidebar.settings": "\u8bbe\u7f6e",
  "sidebar.version": "AI Factory v0.2.1",
  "sidebar.checkUpdate": "\u68c0\u67e5\u66f4\u65b0",
  "sidebar.checking": "\u68c0\u67e5\u4e2d...",
  "sidebar.updateAvailable": "\u65b0\u7248\u672c\u53ef\u7528",
  "sidebar.upToDate": "\u5df2\u662f\u6700\u65b0\u7248",

  // Common
  "common.start": "\u542f\u52a8",
  "common.stop": "\u505c\u6b62",
  "common.delete": "\u5220\u9664",
  "common.save": "\u4fdd\u5b58",
  "common.saved": "\u5df2\u4fdd\u5b58",
  "common.back": "\u8fd4\u56de",
  "common.next": "\u4e0b\u4e00\u6b65",
  "common.loading": "\u52a0\u8f7d\u4e2d...",
  "common.search": "\u641c\u7d22",
  "common.agents": "\u4e2a\u667a\u80fd\u4f53",
  "common.cycles": "\u4e2a\u5faa\u73af",
  "common.add": "\u6dfb\u52a0",
  "common.live": "\u5b9e\u65f6",

  // Dashboard
  "dashboard.title": "\u4eea\u8868\u76d8",
  "dashboard.subtitle": "\u7ba1\u7406\u60a8\u7684\u81ea\u4e3b AI \u516c\u53f8",
  "dashboard.newProject": "\u65b0\u5efa\u9879\u76ee",
  "dashboard.noProjects": "\u8fd8\u6ca1\u6709\u9879\u76ee",
  "dashboard.noProjectsDesc": "\u4ece\u4e00\u4e2a\u79cd\u5b50\u63d0\u793a\u8bcd\u521b\u5efa\u60a8\u7684\u7b2c\u4e00\u4e2a AI \u516c\u53f8",
  "dashboard.createProject": "\u521b\u5efa\u9879\u76ee",

  // NewProject
  "newProject.title": "\u521b\u5efa\u65b0 AI \u516c\u53f8",
  "newProject.subtitle": "\u4ece\u4e00\u4e2a\u79cd\u5b50\u63d0\u793a\u8bcd\u5f15\u5bfc\u751f\u6210\u81ea\u4e3b\u516c\u53f8",
  "newProject.step.seed": "\u79cd\u5b50\u63d0\u793a\u8bcd",
  "newProject.step.analysis": "\u5206\u6790",
  "newProject.step.roles": "\u89d2\u8272",
  "newProject.step.configure": "\u914d\u7f6e",
  "newProject.step.generate": "\u751f\u6210",
  "newProject.whatToBuild": "\u60a8\u60f3\u8981\u6784\u5efa\u4ec0\u4e48\uff1f",
  "newProject.placeholder": "\u7528\u4e00\u53e5\u8bdd\u63cf\u8ff0\u60a8\u7684\u4ea7\u54c1\u521b\u610f...",
  "newProject.quickStart": "\u5feb\u901f\u5f00\u59cb\uff1a",
  "newProject.seedAnalysis": "\u79cd\u5b50\u5206\u6790",
  "newProject.domain": "\u9886\u57df",
  "newProject.audience": "\u76ee\u6807\u7528\u6237",
  "newProject.complexity": "\u590d\u6742\u5ea6",
  "newProject.teamSize": "\u56e2\u961f\u89c4\u6a21",
  "newProject.detectedFeatures": "\u68c0\u6d4b\u5230\u7684\u529f\u80fd",
  "newProject.selectRoles": "\u9009\u62e9\u56e2\u961f\u89d2\u8272",
  "newProject.selected": "\u5df2\u9009\u62e9",
  "newProject.configuration": "\u914d\u7f6e",
  "newProject.outputDir": "\u8f93\u51fa\u76ee\u5f55",
  "newProject.outputDirHint": "\u6240\u6709\u9879\u76ee\u6587\u4ef6\uff08\u667a\u80fd\u4f53\u3001\u5171\u8bc6\u3001\u811a\u672c\u3001\u65e5\u5fd7\uff09\u5c06\u5728\u6b64\u521b\u5efa",
  "newProject.creating": "\u6b63\u5728\u521b\u5efa\u60a8\u7684 AI \u516c\u53f8...",
  "newProject.creatingDesc": "\u6b63\u5728\u751f\u6210\u667a\u80fd\u4f53\u3001\u811a\u672c\u3001\u5171\u8bc6\u548c\u914d\u7f6e\u6587\u4ef6",
  "newProject.success": "\u516c\u53f8\u521b\u5efa\u6210\u529f\uff01",
  "newProject.agentsConfigured": "\u4e2a\u667a\u80fd\u4f53\u5df2\u914d\u7f6e",
  "newProject.workflowsSetUp": "\u4e2a\u5de5\u4f5c\u6d41\u5df2\u8bbe\u7f6e",
  "newProject.output": "\u8f93\u51fa",
  "newProject.goToDashboard": "\u8fd4\u56de\u4eea\u8868\u76d8",
  "newProject.readyToGenerate": "\u51c6\u5907\u597d\u751f\u6210\u60a8\u7684 AI \u516c\u53f8\uff0c\u5305\u542b",
  "newProject.willCreate": "\u5c06\u5728\u6b64\u76ee\u5f55\u521b\u5efa\u6240\u6709\u9879\u76ee\u6587\u4ef6",
  "newProject.createCompany": "\u521b\u5efa\u516c\u53f8",

  // ProjectDetail
  "projectDetail.status": "\u72b6\u6001",
  "projectDetail.cycles": "\u5faa\u73af",
  "projectDetail.agents": "\u667a\u80fd\u4f53",
  "projectDetail.consensus": "\u5171\u8bc6",
  "projectDetail.running": "\u8fd0\u884c\u4e2d",
  "projectDetail.stopped": "\u5df2\u505c\u6b62",
  "projectDetail.focus": "\u5f53\u524d\u7126\u70b9",
  "projectDetail.next": "\u4e0b\u4e00\u6b65",
  "projectDetail.revenue": "\u6536\u5165",
  "projectDetail.projects": "\u9879\u76ee",
  "projectDetail.notSet": "\u672a\u8bbe\u7f6e",
  "projectDetail.consensusNotInit": "\u5171\u8bc6\u672a\u521d\u59cb\u5316\u3002\u542f\u52a8\u5faa\u73af\u4ee5\u5f00\u59cb\u3002",
  "projectDetail.recentCycles": "\u6700\u8fd1\u5faa\u73af",
  "projectDetail.noCycles": "\u8fd8\u6ca1\u6709\u5faa\u73af\u3002\u542f\u52a8\u5faa\u73af\u4ee5\u5f00\u59cb\u3002",
  "projectDetail.logs": "\u65e5\u5fd7",
  "projectDetail.waitingForLogs": "\u7b49\u5f85\u65e5\u5fd7\u8f93\u51fa... \u542f\u52a8\u5faa\u73af\u4ee5\u5f00\u59cb\u3002",
  "projectDetail.deleteConfirm": "\u5220\u9664\u6b64\u9879\u76ee\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002",
  "projectDetail.errors": "\u4e2a\u9519\u8bef",
  "projectDetail.goToSettings": "\u524d\u5f80\u8bbe\u7f6e",
  "projectDetail.handoff": "\u4ea4\u63a5\u7b14\u8bb0",
  "projectDetail.noHandoff": "\u8fd8\u6ca1\u6709\u4ea4\u63a5\u7b14\u8bb0\u3002\u542f\u52a8\u5faa\u73af\u4ee5\u5f00\u59cb\u3002",
  "projectDetail.agentMemory": "\u667a\u80fd\u4f53\u8bb0\u5fc6",
  "projectDetail.noMemory": "\u6b64\u667a\u80fd\u4f53\u8fd8\u6ca1\u6709\u8bb0\u5fc6\u8bb0\u5f55\u3002",
  "projectDetail.selectAgent": "\u9009\u62e9\u4e00\u4e2a\u667a\u80fd\u4f53\u67e5\u770b\u5176\u8bb0\u5fc6\u3002",

  // Library
  "library.title": "\u8d44\u6e90\u5e93",
  "library.subtitle": "\u6d4f\u89c8\u667a\u80fd\u4f53\u3001\u6280\u80fd\u548c\u5de5\u4f5c\u6d41",
  "library.agents": "\u667a\u80fd\u4f53",
  "library.skills": "\u6280\u80fd",
  "library.workflows": "\u5de5\u4f5c\u6d41",
  "library.searchAgents": "\u641c\u7d22\u667a\u80fd\u4f53...",
  "library.searchSkills": "\u641c\u7d22\u6280\u80fd...",
  "library.searchWorkflows": "\u641c\u7d22\u5de5\u4f5c\u6d41...",
  "library.convergence": "\u6536\u655b",

  // Settings
  "settings.title": "\u8bbe\u7f6e",
  "settings.subtitle": "\u914d\u7f6e AI Factory \u9ed8\u8ba4\u53c2\u6570",
  "settings.aiProviders": "AI \u4f9b\u5e94\u5546",
  "settings.aiProvidersDesc": "\u914d\u7f6e AI \u4f9b\u5e94\u5546\u7684 API \u5bc6\u94a5\u548c\u7aef\u70b9",
  "settings.providerType": "\u4f9b\u5e94\u5546\u7c7b\u578b",
  "settings.displayName": "\u663e\u793a\u540d\u79f0",
  "settings.apiKey": "API \u5bc6\u94a5",
  "settings.apiBaseUrl": "API \u57fa\u7840 URL",
  "settings.defaultModel": "\u9ed8\u8ba4\u6a21\u578b",
  "settings.addProvider": "\u6dfb\u52a0\u4f9b\u5e94\u5546",
  "settings.noProviders": "\u672a\u914d\u7f6e\u4f9b\u5e94\u5546\u3002\u6dfb\u52a0\u4e00\u4e2a\u4ee5\u5f00\u59cb\u3002",
  "settings.runtimeDefaults": "\u8fd0\u884c\u65f6\u9ed8\u8ba4\u503c",
  "settings.defaultEngine": "\u9ed8\u8ba4\u5f15\u64ce",
  "settings.model": "\u9ed8\u8ba4\u6a21\u578b",
  "settings.maxDailyBudget": "\u6bcf\u65e5\u9884\u7b97\u4e0a\u9650 (USD)",
  "settings.alertAt": "\u9884\u8b66\u989d\u5ea6 (USD)",
  "settings.loopInterval": "\u5faa\u73af\u95f4\u9694 (\u79d2)",
  "settings.cycleTimeout": "\u5faa\u73af\u8d85\u65f6 (\u79d2)",
  "settings.projectsDir": "\u9879\u76ee\u76ee\u5f55",
  "settings.saveSettings": "\u4fdd\u5b58\u8bbe\u7f6e",
  "settings.saveFailed": "\u4fdd\u5b58\u8bbe\u7f6e\u5931\u8d25",
  "settings.language": "\u8bed\u8a00",
  "settings.languageLabel": "\u754c\u9762\u8bed\u8a00",

  // System Environment
  "system.title": "\u7cfb\u7edf\u73af\u5883",
  "system.subtitle": "\u68c0\u6d4b\u5230\u7684\u7cfb\u7edf\u914d\u7f6e\u548c CLI \u5de5\u5177",
  "system.os": "\u64cd\u4f5c\u7cfb\u7edf",
  "system.arch": "\u67b6\u6784",
  "system.shell": "\u9ed8\u8ba4 Shell",
  "system.nodeVersion": "Node.js",
  "system.npmVersion": "npm",
  "system.shells": "Shell \u73af\u5883",
  "system.cliTools": "CLI \u5de5\u5177",
  "system.available": "\u53ef\u7528",
  "system.notFound": "\u672a\u627e\u5230",
  "system.version": "\u7248\u672c",
  "system.path": "\u8def\u5f84",
  "system.install": "\u5b89\u88c5",
  "system.installing": "\u5b89\u88c5\u4e2d...",
  "system.installSuccess": "\u5b89\u88c5\u6210\u529f",
  "system.installFailed": "\u5b89\u88c5\u5931\u8d25",
  "system.refresh": "\u5237\u65b0",
  "system.refreshing": "\u68c0\u6d4b\u4e2d...",
  "system.noNode": "\u9700\u8981 Node.js \u624d\u80fd\u5b89\u88c5 CLI \u5de5\u5177",
  "system.installGuide": "\u5b89\u88c5\u6307\u5357",
  "system.engineCheck": "\u5f15\u64ce\u72b6\u6001",
  "system.engineOk": "\u5f15\u64ce\u5df2\u627e\u5230\uff0c\u5c31\u7eea",
  "system.engineMissing": "\u672a\u627e\u5230\u5f15\u64ce\u3002\u8bf7\u5148\u5b89\u88c5\u624d\u80fd\u542f\u52a8\u5faa\u73af\u3002",
  "system.clickRefresh": "\u70b9\u51fb\u5237\u65b0\u68c0\u6d4b\u60a8\u7684\u7cfb\u7edf\u73af\u5883\u3002",

  // Provider Detection
  "settings.quickSetup": "\u5feb\u901f\u8bbe\u7f6e",
  "settings.quickSetupDesc": "\u81ea\u52a8\u68c0\u6d4b\u7cfb\u7edf\u4e2d\u5df2\u6709\u7684 API \u914d\u7f6e",
  "settings.detectProviders": "\u68c0\u6d4b\u914d\u7f6e",
  "settings.detecting": "\u68c0\u6d4b\u4e2d...",
  "settings.noDetected": "\u672a\u627e\u5230\u5df2\u6709\u914d\u7f6e\u3002",
  "settings.detectedFrom": "\u6765\u6e90",
  "settings.importProvider": "\u5bfc\u5165",
  "settings.importAll": "\u5168\u90e8\u5bfc\u5165",
  "settings.exportProviders": "\u5bfc\u51fa",
  "settings.importJson": "\u5bfc\u5165 JSON",
  "settings.imported": "\u5df2\u5bfc\u5165",

  // MCP Servers
  "settings.mcpServers": "MCP \u670d\u52a1\u5668",
  "settings.mcpDesc": "\u901a\u8fc7 MCP \u8fde\u63a5\u667a\u80fd\u4f53\u5230\u5916\u90e8\u670d\u52a1",
  "settings.mcpPresets": "\u5feb\u901f\u6dfb\u52a0",
  "settings.mcpConfigured": "\u5df2\u914d\u7f6e\u670d\u52a1\u5668",
  "settings.mcpNoServers": "\u672a\u914d\u7f6e MCP \u670d\u52a1\u5668\u3002\u4ece\u4e0a\u65b9\u9884\u8bbe\u4e2d\u6dfb\u52a0\u3002",
  "settings.mcpAdded": "\u5df2\u6dfb\u52a0",

  // Settings Tabs
  "settings.tabGeneral": "\u5e38\u89c4",
  "settings.tabProviders": "AI \u4f9b\u5e94\u5546",
  "settings.tabMcp": "MCP \u670d\u52a1\u5668",
  "settings.tabSystem": "\u7cfb\u7edf\u73af\u5883",

  // Library Management
  "library.addAgent": "\u6dfb\u52a0\u667a\u80fd\u4f53",
  "library.addSkill": "\u6dfb\u52a0\u6280\u80fd",
  "library.scanSkills": "\u626b\u63cf\u672c\u5730\u6280\u80fd",
  "library.scanning": "\u626b\u63cf\u4e2d...",
  "library.scanResults": "\u53d1\u73b0\u7684\u6280\u80fd",
  "library.noScanResults": "\u672a\u5728\u7cfb\u7edf\u4e2d\u53d1\u73b0\u6280\u80fd\u3002",
  "library.import": "\u5bfc\u5165",
  "library.imported": "\u5df2\u5bfc\u5165",
  "library.custom": "\u81ea\u5b9a\u4e49",
  "library.name": "\u540d\u79f0",
  "library.role": "\u89d2\u8272",
  "library.expertise": "\u4e13\u957f",
  "library.layer": "\u5c42\u7ea7",
  "library.mentalModels": "\u601d\u7ef4\u6a21\u578b",
  "library.coreCapabilities": "\u6838\u5fc3\u80fd\u529b",
  "library.description": "\u63cf\u8ff0",
  "library.category": "\u5206\u7c7b",
  "library.content": "\u5185\u5bb9",
  "library.create": "\u521b\u5efa",
  "library.cancel": "\u53d6\u6d88",
  "library.source": "\u6765\u6e90",
  "library.path": "\u8def\u5f84",
  "library.removeConfirm": "\u5220\u9664\u6b64\u9879\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002",
};

type TranslationKey = keyof typeof en;
type Language = "en" | "zh";

interface I18nContextValue {
  readonly language: Language;
  readonly t: (key: TranslationKey) => string;
  readonly setLanguage: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  t: (key) => en[key],
  setLanguage: () => {},
});

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, zh };

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: loadSettings,
  });

  const [language, setLanguageState] = useState<Language>("en");

  // Sync language from settings
  useEffect(() => {
    if (settings?.language === "zh" || settings?.language === "en") {
      setLanguageState(settings.language as Language);
    }
  }, [settings]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return dictionaries[language][key] ?? en[key] ?? key;
    },
    [language],
  );

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      // Persist to settings
      if (settings) {
        const updated: AppSettings = {
          ...settings,
          language: lang,
        };
        saveSettings(updated).then(() => {
          queryClient.invalidateQueries({ queryKey: ["settings"] });
        });
      }
    },
    [settings, queryClient],
  );

  return (
    <I18nContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
