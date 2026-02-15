import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Plus,
  Sparkles,
  Server,
  Power,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  listMcpServers,
  getMcpPresets,
  addMcpServer,
  removeMcpServer,
} from "@/lib/tauri";
import type { McpServerConfig, McpPreset } from "@/lib/types";
import { MCP_CATEGORY_COLORS, MCP_CATEGORY_DEFAULT_COLOR } from "./constants";

function getMcpCategoryColor(category: string): string {
  return MCP_CATEGORY_COLORS[category] ?? MCP_CATEGORY_DEFAULT_COLOR;
}

// ===== MCP Preset Card =====

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

  return (
    <div className="flex flex-col gap-2 rounded-md border border-input bg-secondary p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{preset.name}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                getMcpCategoryColor(preset.category),
              )}
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
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-70",
            isAdded
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
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

// ===== MCP Server Row =====

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
    <div className="space-y-2 rounded-md border border-input bg-secondary p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-3 w-3 rounded-full",
            server.enabled ? "bg-green-500" : "bg-gray-400",
          )}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{server.name}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                typeColor(server.server_type),
              )}
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
          className={cn(
            "rounded-md p-2 transition-colors",
            server.enabled
              ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
              : "text-muted-foreground hover:bg-accent",
          )}
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

// ===== MCP Tab Content =====

export function McpTabContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [addedPresetIds, setAddedPresetIds] = useState<ReadonlySet<string>>(
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

  const handleAddPreset = useCallback(
    (preset: McpPreset) => {
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
    },
    [addServerMutation],
  );

  const handleRemoveServer = useCallback(
    (serverId: string) => {
      removeServerMutation.mutate(serverId);
    },
    [removeServerMutation],
  );

  const handleToggleServer = useCallback(
    (serverId: string, enabled: boolean) => {
      const server = mcpServers.find((s) => s.id === serverId);
      if (!server) return;
      const updated: McpServerConfig = {
        ...server,
        enabled,
      };
      addServerMutation.mutate(updated);
    },
    [mcpServers, addServerMutation],
  );

  return (
    <div className="space-y-6">
      {mcpPresets.length > 0 && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">{t("settings.mcpPresets")}</h2>
          </div>
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

      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="font-semibold text-foreground">{t("settings.mcpConfigured")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("settings.mcpDesc")}
            </p>
          </div>
        </div>
        {mcpServers.length > 0 ? (
          <div className="space-y-2">
            {mcpServers.map((server) => (
              <McpServerRow
                key={server.id}
                server={server}
                onRemove={handleRemoveServer}
                onToggle={handleToggleServer}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            {t("settings.mcpNoServers")}
          </div>
        )}
      </div>
    </div>
  );
}
