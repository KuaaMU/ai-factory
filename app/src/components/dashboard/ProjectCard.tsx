import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  RefreshCw,
  Clock,
  Play,
  Square,
  Loader2,
  Zap,
} from "lucide-react";
import {
  startLoop,
  stopLoop,
  getStatus,
  getProjectRuntimeOverride,
  loadSettings,
} from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ConfigSelector } from "./ConfigSelector";
import type { Project, ProjectStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { color: string; dotColor: string; label: string }
> = {
  running: { color: "text-green-500", dotColor: "bg-green-500", label: "Running" },
  paused: { color: "text-yellow-500", dotColor: "bg-yellow-500", label: "Paused" },
  stopped: { color: "text-gray-400", dotColor: "bg-gray-400", label: "Stopped" },
  error: { color: "text-red-500", dotColor: "bg-red-500", label: "Error" },
  initializing: { color: "text-blue-500", dotColor: "bg-blue-500", label: "Init" },
};

const ENGINE_COLORS: Record<string, string> = {
  claude: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  codex: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  opencode: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  gemini: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

function formatRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    if (diffMs < 0) return "just now";
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return dateStr;
  }
}

export function ProjectCard({ project }: { readonly project: Project }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.stopped;

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: loadSettings,
  });

  const { data: status } = useQuery({
    queryKey: ["status", project.output_dir],
    queryFn: () => getStatus(project.output_dir),
    refetchInterval: 3000,
  });

  const { data: override } = useQuery({
    queryKey: ["project-override", project.output_dir],
    queryFn: () => getProjectRuntimeOverride(project.output_dir),
  });

  const isRunning = status?.is_running ?? project.status === "running";
  const globalEngine = settings?.default_engine ?? "claude";
  const globalModel = settings?.default_model ?? "sonnet";
  const effectiveEngine = override?.engine ?? globalEngine;
  const effectiveModel = override?.model ?? globalModel;
  const engineColor = ENGINE_COLORS[effectiveEngine] ?? "bg-muted text-muted-foreground";

  const startMutation = useMutation({
    mutationFn: () => startLoop(project.output_dir, effectiveEngine, effectiveModel),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["status", project.output_dir] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => setError(String(err)),
  });

  const stopMutation = useMutation({
    mutationFn: () => stopLoop(project.output_dir),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["status", project.output_dir] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => setError(String(err)),
  });

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 transition-all hover:shadow-md",
        isRunning && "border-green-500/30 ring-1 ring-green-500/10",
      )}
    >
      {/* Header: name + status */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(`/project/${project.id}`)}
          className="min-w-0 flex-1 truncate text-left font-semibold hover:text-primary"
        >
          {project.name}
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "inline-flex h-2 w-2 rounded-full",
              statusCfg.dotColor,
              isRunning && "animate-pulse",
            )}
          />
          <span className={cn("text-xs font-medium", statusCfg.color)}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Engine/Model badges */}
      <div className="flex items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", engineColor)}>
          {effectiveEngine}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground">
          {effectiveModel}
        </span>
        {override && (
          <ConfigSelector
            projectDir={project.output_dir}
            currentOverride={override}
            globalEngine={globalEngine}
            globalModel={globalModel}
          />
        )}
      </div>

      {/* Seed prompt */}
      <p className="text-sm text-muted-foreground line-clamp-2">
        {project.seed_prompt}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {project.agent_count} {t("common.agents")}
        </span>
        <span className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          {status?.total_cycles ?? project.cycle_count} {t("common.cycles")}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(project.last_active_at)}
        </span>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 line-clamp-2">{error}</p>
      )}

      {/* Start/Stop buttons */}
      <div className="flex items-center gap-2 border-t pt-2">
        {isRunning ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              stopMutation.mutate();
            }}
            disabled={stopMutation.isPending}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {stopMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
            {t("common.stop")}
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              startMutation.mutate();
            }}
            disabled={startMutation.isPending}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {startMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            {t("common.start")}
          </button>
        )}
        <button
          onClick={() => navigate(`/project/${project.id}`)}
          className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Zap className="h-3 w-3" />
          {t("dashboard.viewDetail")}
        </button>
      </div>
    </div>
  );
}
