import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play,
  Square,
  RefreshCw,
  Users,
  Activity,
  FileText,
  ArrowLeft,
  Trash2,
  AlertCircle,
  Loader2,
  FolderOpen,
  ArrowRightLeft,
  Zap,
  Clock,
  Timer,
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
  getHandoffNote,
  getProjectRuntimeOverride,
} from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AGENT_PALETTE, getAgentColor, formatUptime } from "@/components/project/constants";
import { AgentTopologyRing } from "@/components/project/AgentTopologyRing";
import { CycleTimeline } from "@/components/project/CycleTimeline";
import { AgentDetailPanel } from "@/components/project/AgentDetailPanel";
import { ActivityFeed } from "@/components/project/ActivityFeed";
import { LogViewer } from "@/components/project/LogViewer";

// ===== Main Component =====

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // ===== Queries =====
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: loadSettings,
  });

  const { data: override } = useQuery({
    queryKey: ["project-override", project?.output_dir],
    queryFn: () => getProjectRuntimeOverride(project!.output_dir),
    enabled: !!project?.output_dir,
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

  const { data: handoff } = useQuery({
    queryKey: ["handoff", project?.output_dir],
    queryFn: () => getHandoffNote(project!.output_dir),
    enabled: !!project?.output_dir,
    refetchInterval: 5000,
  });

  // ===== Derived Data =====
  const agents = useMemo((): readonly string[] => {
    if (!cycles || cycles.length === 0) return [];
    return [...new Set(cycles.map((c) => c.agent_role))];
  }, [cycles]);

  const activeAgent = useMemo((): string | null => {
    if (!status?.is_running || !cycles || cycles.length === 0) return null;
    return cycles[cycles.length - 1].agent_role;
  }, [status, cycles]);

  const agentStats = useMemo(() => {
    const stats = new Map<string, { cycles: number; errors: number; lastAction: string }>();
    if (!cycles) return stats;
    for (const c of cycles) {
      const prev = stats.get(c.agent_role) ?? { cycles: 0, errors: 0, lastAction: "" };
      stats.set(c.agent_role, {
        cycles: prev.cycles + 1,
        errors: prev.errors + (c.error ? 1 : 0),
        lastAction: c.action,
      });
    }
    return stats;
  }, [cycles]);

  const totalErrors = useMemo(() => {
    if (!cycles) return 0;
    return cycles.filter((c) => c.error).length;
  }, [cycles]);

  const isRunning = status?.is_running ?? false;
  const effectiveEngine = override?.engine ?? settings?.default_engine ?? "claude";
  const effectiveModel = override?.model ?? settings?.default_model ?? "sonnet";

  // ===== Mutations =====
  const startMutation = useMutation({
    mutationFn: () => startLoop(project!.output_dir, effectiveEngine, effectiveModel),
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

  // ===== Loading =====
  if (projectLoading || !project) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
          {isRunning ? (
            <button
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {stopMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              {t("common.stop")}
            </button>
          ) : (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          {error.includes("not found") && (
            <button
              onClick={() => navigate("/settings")}
              className="shrink-0 rounded-md border border-destructive/30 px-3 py-1 text-xs font-medium hover:bg-destructive/20"
            >
              {t("projectDetail.goToSettings")}
            </button>
          )}
        </div>
      )}

      {/* Status Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span className="text-xs">{t("projectDetail.status")}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("inline-flex h-2.5 w-2.5 rounded-full", isRunning ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
            <p className="font-semibold capitalize">
              {isRunning ? t("projectDetail.running") : t("projectDetail.stopped")}
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
            <span className="text-xs">{t("projectDetail.cycles")}</span>
          </div>
          <p className="mt-1 font-semibold">{status?.total_cycles ?? 0}</p>
          {totalErrors > 0 && (
            <p className="text-xs text-red-500">{totalErrors} {t("projectDetail.totalErrors")}</p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span className="text-xs">{t("projectDetail.activeAgent")}</span>
          </div>
          <div className="mt-1">
            {activeAgent ? (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", getAgentColor(agents, activeAgent).bg, getAgentColor(agents, activeAgent).text)}>
                <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                {activeAgent}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{t("projectDetail.noActiveAgent")}</span>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs">{t("projectDetail.agents")}</span>
          </div>
          <p className="mt-1 font-semibold">{project.agent_count}</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Timer className="h-4 w-4" />
            <span className="text-xs">{t("projectDetail.uptime")}</span>
          </div>
          <p className="mt-1 font-semibold">{formatUptime(status?.uptime_seconds ?? 0)}</p>
        </div>
      </div>

      {/* Main content: Left (2/3) + Right (1/3) */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="space-y-5 lg:col-span-2">
          {/* Agent Topology */}
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">{t("projectDetail.topology")}</h2>
            </div>
            <div className="flex items-center justify-center p-4">
              <AgentTopologyRing
                agents={agents}
                activeAgent={activeAgent}
                agentStats={agentStats}
                isRunning={isRunning}
                selectedAgent={selectedAgent}
                onSelectAgent={setSelectedAgent}
              />
            </div>
            {/* Agent legend */}
            {agents.length > 0 && (
              <div className="border-t px-4 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {agents.map((agent, i) => {
                    const color = AGENT_PALETTE[i % AGENT_PALETTE.length];
                    const stats = agentStats.get(agent);
                    return (
                      <button
                        key={agent}
                        onClick={() => setSelectedAgent(selectedAgent === agent ? null : agent)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                          selectedAgent === agent
                            ? `${color.bg} ${color.text} ring-1 ${color.ring}`
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80",
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                        {agent}
                        {stats && <span className="opacity-60">({stats.cycles})</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Cycle Timeline */}
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <h2 className="text-sm font-semibold">{t("projectDetail.cycleTimeline")}</h2>
              </div>
            </div>
            <div className="max-h-[400px] overflow-auto p-4">
              <CycleTimeline cycles={cycles ?? []} agents={agents} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          {/* Activity Feed */}
          <ActivityFeed
            projectDir={project.output_dir}
            agents={agents}
            isRunning={isRunning}
          />

          {/* Consensus */}
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <h2 className="text-sm font-semibold">{t("projectDetail.consensus")}</h2>
              </div>
            </div>
            <div className="p-4">
              {consensus ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">{t("projectDetail.focus")}</span>
                    <p className="mt-0.5">{consensus.current_focus || t("projectDetail.notSet")}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">{t("projectDetail.next")}</span>
                    <p className="mt-0.5">{consensus.next_action || t("projectDetail.notSet")}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">{t("projectDetail.revenue")}</span>
                    <p className="mt-0.5">{consensus.revenue}</p>
                  </div>
                  {consensus.active_projects.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">{t("projectDetail.projects")}</span>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {consensus.active_projects.map((p) => (
                          <span key={p} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">{t("projectDetail.consensusNotInit")}</p>
              )}
            </div>
          </div>

          {/* Handoff */}
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                <h2 className="text-sm font-semibold">{t("projectDetail.handoff")}</h2>
              </div>
            </div>
            <div className="max-h-48 overflow-auto p-4">
              {handoff && handoff.trim() ? (
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{handoff}</pre>
              ) : (
                <p className="text-sm text-muted-foreground">{t("projectDetail.noHandoff")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Detail Panel (full width, when selected) */}
      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          agents={agents}
          projectDir={project.output_dir}
          agentStats={agentStats}
          cycles={cycles ?? []}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* Log Viewer (full width) */}
      <LogViewer logs={logs} isRunning={isRunning} />
    </div>
  );
}
