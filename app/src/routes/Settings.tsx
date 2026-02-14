import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Globe,
  Monitor,
  RefreshCw,
  Download,
  CheckCircle,
  XCircle,
  ExternalLink,
  Terminal,
  Search,
  Upload,
  Sparkles,
  Server,
  Power,
} from "lucide-react";
import {
  loadSettings,
  saveSettings as saveSettingsApi,
  addProvider,
  removeProvider,
  detectSystem,
  installTool,
  detectProviders,
  exportProviders,
  importProviders,
  listMcpServers,
  addMcpServer,
  removeMcpServer,
  getMcpPresets,
} from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import type { AppSettings, AiProvider, ToolInfo, DetectedProvider, McpServerConfig, McpPreset } from "@/lib/types";

const PROVIDER_PRESETS: Record<
  string,
  { name: string; api_base_url: string; default_model: string }
> = {
  claude: {
    name: "Anthropic (Claude)",
    api_base_url: "https://api.anthropic.com",
    default_model: "claude-sonnet-4-20250514",
  },
  openai: {
    name: "OpenAI",
    api_base_url: "https://api.openai.com/v1",
    default_model: "gpt-4o",
  },
  openrouter: {
    name: "OpenRouter",
    api_base_url: "https://openrouter.ai/api/v1",
    default_model: "anthropic/claude-sonnet-4-20250514",
  },
  custom: {
    name: "Custom Provider",
    api_base_url: "",
    default_model: "",
  },
};

// ===== MCP Servers Panel =====

function McpPresetCard({
  preset,
  isAdded,
  onAdd,
}: {
  readonly preset: McpPreset;
  readonly isAdded: boolean;
  readonly onAdd: () => void;
}) {
  const { t } = useI18n();

  const categoryColor = (category: string) => {
    switch (category) {
      case "search":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "database":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "cloud":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "dev":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{preset.name}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor(preset.category)}`}
            >
              {preset.category}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {preset.description}
          </p>
        </div>
        <button
          onClick={onAdd}
          disabled={isAdded}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
            isAdded
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          } disabled:opacity-70`}
        >
          {isAdded ? (
            <>
              <Check className="h-3 w-3" />
              {t("settings.mcpAdded")}
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" />
              {t("common.add")}
            </>
          )}
        </button>
      </div>
      {preset.env_keys.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {preset.env_keys.map((key) => (
            <span
              key={key}
              className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
            >
              {key}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function McpServerRow({
  server,
  onRemove,
  onToggle,
}: {
  readonly server: McpServerConfig;
  readonly onRemove: (id: string) => void;
  readonly onToggle: (id: string, enabled: boolean) => void;
}) {
  const typeColor = (serverType: string) => {
    switch (serverType) {
      case "stdio":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "sse":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const envEntries = Object.entries(server.env);

  return (
    <div className="space-y-2 rounded-md border p-4">
      <div className="flex items-center gap-3">
        <div
          className={`h-3 w-3 rounded-full ${server.enabled ? "bg-green-500" : "bg-gray-400"}`}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{server.name}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColor(server.server_type)}`}
            >
              {server.server_type}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {server.command} {server.args.join(" ")}
          </p>
        </div>
        <button
          onClick={() => onToggle(server.id, !server.enabled)}
          className={`rounded-md p-2 transition-colors ${
            server.enabled
              ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
              : "text-muted-foreground hover:bg-accent"
          }`}
          title={server.enabled ? "Disable" : "Enable"}
        >
          <Power className="h-4 w-4" />
        </button>
        <button
          onClick={() => onRemove(server.id)}
          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {envEntries.length > 0 && (
        <div className="ml-6 space-y-1">
          {envEntries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-muted-foreground">
                {key}
              </span>
              <span className="truncate text-muted-foreground">
                {value || "(not set)"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function McpServersPanel() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [addedPresetIds, setAddedPresetIds] = useState<Set<string>>(
    new Set(),
  );

  const { data: mcpServers = [] } = useQuery({
    queryKey: ["mcp-servers"],
    queryFn: listMcpServers,
  });

  const { data: mcpPresets = [] } = useQuery({
    queryKey: ["mcp-presets"],
    queryFn: getMcpPresets,
  });

  const addServerMutation = useMutation({
    mutationFn: (server: McpServerConfig) => addMcpServer(server),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const removeServerMutation = useMutation({
    mutationFn: (serverId: string) => removeMcpServer(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleAddPreset = (preset: McpPreset) => {
    const envRecord: Record<string, string> = {};
    for (const key of preset.env_keys) {
      envRecord[key] = "";
    }
    const server: McpServerConfig = {
      id: crypto.randomUUID(),
      name: preset.name,
      server_type: preset.server_type,
      command: preset.command,
      args: [...preset.args],
      url: "",
      env: envRecord,
      enabled: true,
      tools: [],
    };
    addServerMutation.mutate(server);
    setAddedPresetIds((prev) => new Set([...prev, preset.id]));
  };

  const handleRemoveServer = (serverId: string) => {
    removeServerMutation.mutate(serverId);
  };

  const handleToggleServer = (serverId: string, enabled: boolean) => {
    const server = mcpServers.find((s) => s.id === serverId);
    if (!server) return;
    const updated: McpServerConfig = {
      ...server,
      enabled,
    };
    addServerMutation.mutate(updated);
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2">
        <Server className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="font-semibold">{t("settings.mcpServers")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("settings.mcpDesc")}
          </p>
        </div>
      </div>

      {/* Presets - Quick Add */}
      {mcpPresets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("settings.mcpPresets")}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {mcpPresets.map((preset) => (
              <McpPresetCard
                key={preset.id}
                preset={preset}
                isAdded={addedPresetIds.has(preset.id)}
                onAdd={() => handleAddPreset(preset)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Configured Servers */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t("settings.mcpConfigured")}</h3>
        {mcpServers.length > 0 ? (
          mcpServers.map((server) => (
            <McpServerRow
              key={server.id}
              server={server}
              onRemove={handleRemoveServer}
              onToggle={handleToggleServer}
            />
          ))
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            {t("settings.mcpNoServers")}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== System Environment Panel =====

function SystemEnvironmentPanel() {
  const { t } = useI18n();
  const [installingTool, setInstallingTool] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<{
    tool: string;
    success: boolean;
    message: string;
  } | null>(null);

  const {
    data: systemInfo,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["system-info"],
    queryFn: detectSystem,
    enabled: false,
    staleTime: Infinity,
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleInstall = async (tool: ToolInfo) => {
    setInstallingTool(tool.name);
    setInstallResult(null);
    try {
      const result = await installTool(tool.name);
      setInstallResult({ tool: tool.name, success: true, message: result });
      // Refresh system info after installation
      refetch();
    } catch (err) {
      setInstallResult({
        tool: tool.name,
        success: false,
        message: String(err),
      });
    } finally {
      setInstallingTool(null);
    }
  };

  if (isLoading || isRefetching) {
    return (
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{t("system.title")}</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">
            {t("system.refreshing")}
          </span>
        </div>
      </div>
    );
  }

  if (!systemInfo) {
    return (
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">{t("system.title")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("system.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("system.refresh")}
          </button>
        </div>
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("system.clickRefresh")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">{t("system.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("system.subtitle")}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefetching}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`}
          />
          {t("system.refresh")}
        </button>
      </div>

      {systemInfo && (
        <>
          {/* System Info Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t("system.os")}</p>
              <p className="font-medium capitalize">{systemInfo.os}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                {t("system.arch")}
              </p>
              <p className="font-medium">{systemInfo.arch}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                {t("system.nodeVersion")}
              </p>
              <p className="font-medium">
                {systemInfo.node_version ?? (
                  <span className="text-red-500">{t("system.notFound")}</span>
                )}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                {t("system.npmVersion")}
              </p>
              <p className="font-medium">
                {systemInfo.npm_version ?? (
                  <span className="text-red-500">{t("system.notFound")}</span>
                )}
              </p>
            </div>
          </div>

          {/* Shells */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">{t("system.shells")}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {systemInfo.shells.map((shell) => (
                <div
                  key={shell.name}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    shell.available
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {shell.available ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {shell.name}
                  {shell.version && (
                    <span className="opacity-70">
                      {shell.version.slice(0, 20)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CLI Tools */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-medium">{t("system.cliTools")}</h3>
            </div>
            <div className="space-y-2">
              {systemInfo.tools.map((tool) => (
                <ToolRow
                  key={tool.name}
                  tool={tool}
                  isInstalling={installingTool === tool.name}
                  installResult={
                    installResult?.tool === tool.name ? installResult : null
                  }
                  hasNpm={systemInfo.npm_version !== null}
                  onInstall={() => handleInstall(tool)}
                />
              ))}
            </div>
          </div>

          {/* Node.js warning */}
          {!systemInfo.node_version && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{t("system.noNode")}</span>
              <a
                href="https://nodejs.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 font-medium underline"
              >
                nodejs.org
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ToolRow({
  tool,
  isInstalling,
  installResult,
  hasNpm,
  onInstall,
}: {
  readonly tool: ToolInfo;
  readonly isInstalling: boolean;
  readonly installResult: {
    success: boolean;
    message: string;
  } | null;
  readonly hasNpm: boolean;
  readonly onInstall: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
          tool.available
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-gray-100 text-gray-400 dark:bg-gray-800"
        }`}
      >
        {tool.available ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{tool.display_name}</span>
          {tool.available && tool.version && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
              v{tool.version}
            </span>
          )}
        </div>
        {tool.available && tool.path && (
          <p className="text-xs text-muted-foreground">{tool.path}</p>
        )}
        {!tool.available && (
          <p className="text-xs text-muted-foreground">
            {tool.install_command}
          </p>
        )}
        {installResult && (
          <p
            className={`mt-1 text-xs ${installResult.success ? "text-green-600" : "text-red-500"}`}
          >
            {installResult.success
              ? t("system.installSuccess")
              : installResult.message}
          </p>
        )}
      </div>
      {!tool.available && (
        <div className="flex items-center gap-2">
          <a
            href={tool.install_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
          >
            <ExternalLink className="h-3 w-3" />
            {t("system.installGuide")}
          </a>
          {hasNpm && tool.install_command.startsWith("npm") && (
            <button
              onClick={onInstall}
              disabled={isInstalling}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isInstalling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {isInstalling ? t("system.installing") : t("system.install")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Quick Setup Panel =====

function QuickSetupPanel({
  onImport,
  isImporting,
}: {
  readonly onImport: (provider: AiProvider) => void;
  readonly isImporting: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [detected, setDetected] = useState<readonly DetectedProvider[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [hasDetected, setHasDetected] = useState(false);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());
  const [showExportImport, setShowExportImport] = useState(false);
  const [importJson, setImportJson] = useState("");

  const handleDetect = async () => {
    setIsDetecting(true);
    try {
      const result = await detectProviders();
      setDetected(result);
      setHasDetected(true);
    } catch {
      setDetected([]);
      setHasDetected(true);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleImportOne = (dp: DetectedProvider) => {
    const provider: AiProvider = {
      id: `${dp.provider_type}-${Date.now()}`,
      name: dp.suggested_name,
      provider_type: dp.provider_type,
      api_key: dp.api_key,
      api_base_url: dp.api_base_url,
      default_model: dp.suggested_model,
      enabled: true,
      is_healthy: true,
      last_error: null,
    };
    onImport(provider);
    setImportedKeys((prev) => new Set([...prev, dp.api_key]));
  };

  const handleImportAll = () => {
    for (const dp of detected) {
      if (!importedKeys.has(dp.api_key)) {
        handleImportOne(dp);
      }
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportProviders([]);
      // Copy to clipboard
      await navigator.clipboard.writeText(json);
    } catch {
      // Fallback: show in text area
    }
  };

  const handleImportJson = async () => {
    if (!importJson.trim()) return;
    try {
      await importProviders(importJson);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setImportJson("");
      setShowExportImport(false);
    } catch {
      // Error handled by UI
    }
  };

  const sourceIcon = (source: string) => {
    if (source.startsWith("env:")) return "ENV";
    if (source.includes("claude")) return "CC";
    if (source.includes("codex")) return "CDX";
    return "CFG";
  };

  const sourceColor = (source: string) => {
    if (source.startsWith("env:"))
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (source.includes("claude"))
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    if (source.includes("codex"))
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">{t("settings.quickSetup")}</p>
            <p className="text-xs text-muted-foreground">
              {t("settings.quickSetupDesc")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportImport((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
          >
            <Upload className="h-3 w-3" />
            {t("settings.importJson")}
          </button>
          <button
            onClick={handleDetect}
            disabled={isDetecting}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isDetecting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            {isDetecting
              ? t("settings.detecting")
              : t("settings.detectProviders")}
          </button>
        </div>
      </div>

      {/* Export / Import JSON area */}
      {showExportImport && (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"id":"...", "name":"...", "provider_type":"...", "api_key":"...", ...}]'
            className="h-24 w-full rounded-md border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleImportJson}
              disabled={!importJson.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Download className="h-3 w-3" />
              {t("settings.importJson")}
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs hover:bg-accent"
            >
              <Upload className="h-3 w-3" />
              {t("settings.exportProviders")}
            </button>
          </div>
        </div>
      )}

      {/* Detected Providers */}
      {hasDetected && detected.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {t("settings.noDetected")}
        </p>
      )}

      {detected.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <button
              onClick={handleImportAll}
              disabled={isImporting}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
            >
              <Plus className="h-3 w-3" />
              {t("settings.importAll")}
            </button>
          </div>
          {detected.map((dp, idx) => {
            const isImported = importedKeys.has(dp.api_key);
            return (
              <div
                key={`${dp.source}-${idx}`}
                className="flex items-center gap-3 rounded-md border bg-background p-3"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${sourceColor(dp.source)}`}
                >
                  {sourceIcon(dp.source)}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{dp.suggested_name}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {dp.provider_type}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{dp.api_key_preview}</span>
                    <span>|</span>
                    <span>{dp.suggested_model}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    {dp.source}
                  </p>
                </div>
                <button
                  onClick={() => handleImportOne(dp)}
                  disabled={isImported || isImporting}
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                    isImported
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  } disabled:opacity-70`}
                >
                  {isImported ? (
                    <>
                      <Check className="h-3 w-3" />
                      {t("settings.imported")}
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      {t("settings.importProvider")}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== Provider Card =====

function ProviderCard({
  provider,
  onRemove,
}: {
  readonly provider: AiProvider;
  readonly onRemove: (id: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="flex items-center gap-4 rounded-md border p-4">
      <div
        className={`h-3 w-3 rounded-full ${provider.enabled ? (provider.is_healthy ? "bg-green-500" : "bg-yellow-500") : "bg-gray-400"}`}
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{provider.name}</p>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
            {provider.provider_type}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Model: {provider.default_model}</span>
          <span>|</span>
          <button
            onClick={() => setShowKey((v) => !v)}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            {showKey ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            {showKey
              ? provider.api_key
              : `${provider.api_key.slice(0, 8)}...`}
          </button>
        </div>
        {provider.last_error && (
          <p className="mt-1 text-xs text-red-500">{provider.last_error}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(provider.id)}
        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ===== Add Provider Form =====

function AddProviderForm({
  onAdd,
  isPending,
}: {
  readonly onAdd: (provider: AiProvider) => void;
  readonly isPending: boolean;
}) {
  const { t } = useI18n();
  const [providerType, setProviderType] = useState("claude");
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(
    PROVIDER_PRESETS.claude.api_base_url,
  );
  const [defaultModel, setDefaultModel] = useState(
    PROVIDER_PRESETS.claude.default_model,
  );
  const [name, setName] = useState(PROVIDER_PRESETS.claude.name);

  const handleTypeChange = (type: string) => {
    setProviderType(type);
    const preset = PROVIDER_PRESETS[type];
    if (preset) {
      setName(preset.name);
      setApiBaseUrl(preset.api_base_url);
      setDefaultModel(preset.default_model);
    }
  };

  const handleSubmit = () => {
    if (!apiKey.trim()) return;
    onAdd({
      id: `${providerType}-${Date.now()}`,
      name,
      provider_type: providerType,
      api_key: apiKey,
      api_base_url: apiBaseUrl,
      default_model: defaultModel,
      enabled: true,
      is_healthy: true,
      last_error: null,
    });
    setApiKey("");
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">
            {t("settings.providerType")}
          </label>
          <select
            value={providerType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">
            {t("settings.displayName")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">
          {t("settings.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">
            {t("settings.apiBaseUrl")}
          </label>
          <input
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">
            {t("settings.defaultModel")}
          </label>
          <input
            type="text"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={!apiKey.trim() || isPending}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {t("settings.addProvider")}
      </button>
    </div>
  );
}

// ===== Main Settings Page =====

export function Settings() {
  const queryClient = useQueryClient();
  const { t, language, setLanguage } = useI18n();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: loadSettings,
  });

  const [engine, setEngine] = useState("claude");
  const [defaultModel, setDefaultModel] = useState("sonnet");
  const [maxDailyBudget, setMaxDailyBudget] = useState("50");
  const [alertAtBudget, setAlertAtBudget] = useState("30");
  const [loopInterval, setLoopInterval] = useState("30");
  const [cycleTimeout, setCycleTimeout] = useState("1800");
  const [projectsDir, setProjectsDir] = useState("");
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load settings into form state
  useEffect(() => {
    if (settings) {
      setEngine(settings.default_engine);
      setDefaultModel(settings.default_model);
      setMaxDailyBudget(String(settings.max_daily_budget));
      setAlertAtBudget(String(settings.alert_at_budget));
      setLoopInterval(String(settings.loop_interval));
      setCycleTimeout(String(settings.cycle_timeout));
      setProjectsDir(settings.projects_dir);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (s: AppSettings) => saveSettingsApi(s),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
  });

  const addProviderMutation = useMutation({
    mutationFn: (provider: AiProvider) => addProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setShowAddProvider(false);
    },
  });

  const removeProviderMutation = useMutation({
    mutationFn: (providerId: string) => removeProvider(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleSave = () => {
    const updated: AppSettings = {
      default_engine: engine,
      default_model: defaultModel,
      max_daily_budget: parseFloat(maxDailyBudget) || 50,
      alert_at_budget: parseFloat(alertAtBudget) || 30,
      loop_interval: parseInt(loopInterval) || 30,
      cycle_timeout: parseInt(cycleTimeout) || 1800,
      projects_dir: projectsDir,
      providers: settings?.providers ?? [],
      language,
      mcp_servers: settings?.mcp_servers ?? [],
    };
    saveMutation.mutate(updated);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      {/* MCP Servers */}
      <McpServersPanel />

      {/* System Environment - First section for visibility */}
      <SystemEnvironmentPanel />

      {/* Language */}
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{t("settings.languageLabel")}</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setLanguage("en")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              language === "en"
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-accent"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage("zh")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              language === "zh"
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-accent"
            }`}
          >
            中文
          </button>
        </div>
      </div>

      {/* AI Providers */}
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{t("settings.aiProviders")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("settings.aiProvidersDesc")}
            </p>
          </div>
          <button
            onClick={() => setShowAddProvider((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            {t("common.add")}
          </button>
        </div>

        {/* Quick Setup - auto-detect providers */}
        <QuickSetupPanel
          onImport={(p) => addProviderMutation.mutate(p)}
          isImporting={addProviderMutation.isPending}
        />

        {showAddProvider && (
          <AddProviderForm
            onAdd={(p) => addProviderMutation.mutate(p)}
            isPending={addProviderMutation.isPending}
          />
        )}

        <div className="space-y-2">
          {settings?.providers && settings.providers.length > 0 ? (
            settings.providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                onRemove={(id) => removeProviderMutation.mutate(id)}
              />
            ))
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              {t("settings.noProviders")}
            </div>
          )}
        </div>
      </div>

      {/* General Settings */}
      <div className="space-y-6 rounded-lg border bg-card p-6">
        <h2 className="font-semibold">{t("settings.runtimeDefaults")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Engine */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.defaultEngine")}
            </label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="claude">Claude Code</option>
              <option value="codex">Codex CLI</option>
              <option value="opencode">OpenCode</option>
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.model")}
            </label>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="opus">Opus (deepest reasoning)</option>
              <option value="sonnet">Sonnet (best coding)</option>
              <option value="haiku">Haiku (fastest)</option>
            </select>
          </div>

          {/* Budget */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.maxDailyBudget")}
            </label>
            <input
              type="number"
              value={maxDailyBudget}
              onChange={(e) => setMaxDailyBudget(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Alert budget */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.alertAt")}
            </label>
            <input
              type="number"
              value={alertAtBudget}
              onChange={(e) => setAlertAtBudget(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Loop Interval */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.loopInterval")}
            </label>
            <input
              type="number"
              value={loopInterval}
              onChange={(e) => setLoopInterval(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Cycle Timeout */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.cycleTimeout")}
            </label>
            <input
              type="number"
              value={cycleTimeout}
              onChange={(e) => setCycleTimeout(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Projects dir - full width */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            {t("settings.projectsDir")}
          </label>
          <input
            type="text"
            value={projectsDir}
            onChange={(e) => setProjectsDir(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveSuccess ? t("common.saved") : t("settings.saveSettings")}
          </button>
          {saveMutation.isError && (
            <span className="text-sm text-destructive">
              {t("settings.saveFailed")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
