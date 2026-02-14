import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play,
  Square,
  RefreshCw,
  Users,
  Activity,
  FileText,
  Terminal,
  ArrowLeft,
  Trash2,
  AlertCircle,
  Loader2,
  FolderOpen,
} from "lucide-react";
import {
  getProject,
  getStatus,
  readConsensus,
  getCycleHistory,
  tailLog,
  startLoop,
  stopLoop,
  deleteProject,
  loadSettings,
} from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: loadSettings,
  });

  const { data: status } = useQuery({
    queryKey: ["status", project?.output_dir],
    queryFn: () => getStatus(project!.output_dir),
    enabled: !!project?.output_dir,
    refetchInterval: 2000,
  });

  const { data: consensus } = useQuery({
    queryKey: ["consensus", project?.output_dir],
    queryFn: () => readConsensus(project!.output_dir),
    enabled: !!project?.output_dir,
    refetchInterval: 5000,
  });

  const { data: cycles } = useQuery({
    queryKey: ["cycles", project?.output_dir],
    queryFn: () => getCycleHistory(project!.output_dir),
    enabled: !!project?.output_dir,
    refetchInterval: 3000,
  });

  const { data: logs } = useQuery({
    queryKey: ["logs", project?.output_dir],
    queryFn: () => tailLog(project!.output_dir, 200),
    enabled: !!project?.output_dir,
    refetchInterval: 1500,
  });

  const startMutation = useMutation({
    mutationFn: () => {
      const engine = settings?.default_engine ?? "claude";
      const model = settings?.default_model ?? "sonnet";
      return startLoop(project!.output_dir, engine, model);
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["status", project?.output_dir] });
    },
    onError: (err) => setError(String(err)),
  });

  const stopMutation = useMutation({
    mutationFn: () => stopLoop(project!.output_dir),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["status", project?.output_dir] });
    },
    onError: (err) => setError(String(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(project!.id),
    onSuccess: () => navigate("/"),
  });

  if (projectLoading || !project) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/")}
            className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.seed_prompt}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <FolderOpen className="h-3 w-3" />
              {project.output_dir}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {status?.is_running ? (
            <button
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {stopMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {t("common.stop")}
            </button>
          ) : (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {t("common.start")}
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm(t("projectDetail.deleteConfirm"))) {
                deleteMutation.mutate();
              }
            }}
            className="rounded-md border p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span className="text-sm">{t("projectDetail.status")}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-2 w-2 rounded-full",
                status?.is_running ? "bg-green-500 animate-pulse" : "bg-gray-400",
              )}
            />
            <p className="font-semibold capitalize">
              {status?.is_running ? t("projectDetail.running") : t("projectDetail.stopped")}
            </p>
          </div>
          {status?.pid && (
            <p className="mt-1 text-xs text-muted-foreground">PID: {status.pid}</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm">{t("projectDetail.cycles")}</span>
          </div>
          <p className="mt-1 font-semibold">{status?.total_cycles ?? 0}</p>
          {(status?.consecutive_errors ?? 0) > 0 && (
            <p className="mt-1 text-xs text-red-500">
              {status?.consecutive_errors} {t("projectDetail.errors")}
            </p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">{t("projectDetail.agents")}</span>
          </div>
          <p className="mt-1 font-semibold">{project.agent_count}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-sm">{t("projectDetail.consensus")}</span>
          </div>
          <p className="mt-1 font-semibold capitalize">
            {consensus?.status ?? "unknown"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cycle {consensus?.cycle ?? 0}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Consensus panel */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">{t("projectDetail.consensus")}</h2>
          </div>
          <div className="p-4">
            {consensus ? (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">{t("projectDetail.focus")}: </span>
                  <span>{consensus.current_focus || t("projectDetail.notSet")}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">{t("projectDetail.next")}: </span>
                  <span>{consensus.next_action || t("projectDetail.notSet")}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">{t("projectDetail.revenue")}: </span>
                  <span>{consensus.revenue}</span>
                </div>
                {consensus.active_projects.length > 0 && (
                  <div>
                    <span className="font-medium text-muted-foreground">{t("projectDetail.projects")}: </span>
                    <span>{consensus.active_projects.join(", ")}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("projectDetail.consensusNotInit")}
              </p>
            )}
          </div>
        </div>

        {/* Cycle history */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">{t("projectDetail.recentCycles")}</h2>
          </div>
          <div className="max-h-64 overflow-auto p-4">
            {cycles && cycles.length > 0 ? (
              <div className="space-y-2">
                {[...cycles].reverse().slice(0, 20).map((cycle) => (
                  <div
                    key={cycle.cycle_number}
                    className={cn(
                      "flex items-center gap-3 rounded-md border p-2 text-sm",
                      cycle.error
                        ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                        : "",
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      #{cycle.cycle_number}
                    </span>
                    <span className="font-medium">{cycle.agent_role}</span>
                    <span className="flex-1 truncate text-muted-foreground">
                      {cycle.action}
                    </span>
                    {cycle.error && (
                      <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("projectDetail.noCycles")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Log viewer */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <h2 className="font-semibold">{t("projectDetail.logs")}</h2>
          </div>
          {status?.is_running && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              {t("common.live")}
            </span>
          )}
        </div>
        <div className="max-h-96 overflow-auto bg-zinc-950 p-4">
          <pre className="whitespace-pre-wrap font-mono text-xs text-green-400">
            {logs && logs.length > 0
              ? logs.join("\n")
              : t("projectDetail.waitingForLogs")}
          </pre>
        </div>
      </div>
    </div>
  );
}
