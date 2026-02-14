import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Play,
  Square,
  RefreshCw,
  Users,
  Activity,
  FileText,
  Terminal,
} from "lucide-react";
import {
  getProject,
  getStatus,
  readConsensus,
  getCycleHistory,
  tailLog,
  startLoop,
  stopLoop,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const { data: status } = useQuery({
    queryKey: ["status", project?.output_dir],
    queryFn: () => getStatus(project!.output_dir),
    enabled: !!project?.output_dir,
    refetchInterval: 3000,
  });

  const { data: consensus } = useQuery({
    queryKey: ["consensus", project?.output_dir],
    queryFn: () => readConsensus(project!.output_dir),
    enabled: !!project?.output_dir,
    refetchInterval: 10000,
  });

  const { data: cycles } = useQuery({
    queryKey: ["cycles", project?.output_dir],
    queryFn: () => getCycleHistory(project!.output_dir),
    enabled: !!project?.output_dir,
    refetchInterval: 5000,
  });

  const { data: logs } = useQuery({
    queryKey: ["logs", project?.output_dir],
    queryFn: () => tailLog(project!.output_dir, 100),
    enabled: !!project?.output_dir,
    refetchInterval: 2000,
  });

  if (!project) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">{project.seed_prompt}</p>
        </div>
        <div className="flex gap-2">
          {status?.is_running ? (
            <button
              onClick={() => stopLoop(project.output_dir)}
              className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={() => startLoop(project.output_dir, "claude", "sonnet")}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Play className="h-4 w-4" />
              Start
            </button>
          )}
        </div>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span className="text-sm">Status</span>
          </div>
          <p className="mt-1 font-semibold capitalize">
            {status?.is_running ? "Running" : "Stopped"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm">Cycles</span>
          </div>
          <p className="mt-1 font-semibold">{status?.total_cycles ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Agents</span>
          </div>
          <p className="mt-1 font-semibold">{project.agent_count}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-sm">Consensus</span>
          </div>
          <p className="mt-1 font-semibold capitalize">
            {consensus?.status ?? "Unknown"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Consensus panel */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Consensus</h2>
          </div>
          <div className="p-4">
            {consensus ? (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Focus: </span>
                  <span>{consensus.current_focus}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Next: </span>
                  <span>{consensus.next_action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Revenue: </span>
                  <span>{consensus.revenue}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </div>
        </div>

        {/* Cycle history */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Recent Cycles</h2>
          </div>
          <div className="max-h-64 overflow-auto p-4">
            {cycles && cycles.length > 0 ? (
              <div className="space-y-2">
                {cycles.slice(-10).map((cycle) => (
                  <div
                    key={cycle.cycle_number}
                    className={cn(
                      "flex items-center gap-3 rounded-md border p-2 text-sm",
                      cycle.error ? "border-red-300 bg-red-50 dark:bg-red-950" : "",
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      #{cycle.cycle_number}
                    </span>
                    <span className="font-medium">{cycle.agent_role}</span>
                    <span className="flex-1 truncate text-muted-foreground">
                      {cycle.action}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No cycles yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Log viewer */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Terminal className="h-4 w-4" />
          <h2 className="font-semibold">Logs</h2>
        </div>
        <div className="max-h-80 overflow-auto bg-black p-4">
          <pre className="text-xs text-green-400">
            {logs?.join("\n") ?? "No logs available"}
          </pre>
        </div>
      </div>
    </div>
  );
}
