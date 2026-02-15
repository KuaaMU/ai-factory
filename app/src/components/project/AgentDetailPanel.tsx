import { useQuery } from "@tanstack/react-query";
import { X, Activity, Brain, RefreshCw } from "lucide-react";
import { getAgentMemory } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { getAgentColor, formatTime } from "./constants";
import type { CycleResult } from "@/lib/types";

interface AgentStats {
  readonly cycles: number;
  readonly errors: number;
  readonly lastAction: string;
}

export function AgentDetailPanel({
  agent,
  agents,
  projectDir,
  agentStats,
  cycles,
  onClose,
}: {
  readonly agent: string;
  readonly agents: readonly string[];
  readonly projectDir: string;
  readonly agentStats: ReadonlyMap<string, AgentStats>;
  readonly cycles: readonly CycleResult[];
  readonly onClose: () => void;
}) {
  const { t } = useI18n();
  const color = getAgentColor(agents, agent);
  const stats = agentStats.get(agent);
  const successRate = stats && stats.cycles > 0
    ? Math.round(((stats.cycles - stats.errors) / stats.cycles) * 100)
    : 100;

  const agentCycles = cycles
    .filter((c) => c.agent_role === agent)
    .slice(-15)
    .reverse();

  const { data: memory } = useQuery({
    queryKey: ["agent-memory", projectDir, agent],
    queryFn: () => getAgentMemory(projectDir, agent),
    enabled: !!projectDir && !!agent,
  });

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-3 w-3 rounded-full", color.dot)} />
          <h2 className="text-sm font-semibold">{agent}</h2>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", color.bg, color.text)}>
            {t("projectDetail.agentDetail")}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-3">
        {/* Performance */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Activity className="h-3 w-3" />
            {t("projectDetail.performance")}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border bg-secondary p-2 text-center">
              <p className="text-lg font-bold">{stats?.cycles ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{t("common.cycles")}</p>
            </div>
            <div className="rounded-md border bg-secondary p-2 text-center">
              <p className={cn("text-lg font-bold", (stats?.errors ?? 0) > 0 ? "text-red-500" : "text-foreground")}>
                {stats?.errors ?? 0}
              </p>
              <p className="text-[10px] text-muted-foreground">Errors</p>
            </div>
            <div className="rounded-md border bg-secondary p-2 text-center">
              <p className={cn("text-lg font-bold", successRate >= 80 ? "text-green-500" : successRate >= 50 ? "text-amber-500" : "text-red-500")}>
                {successRate}%
              </p>
              <p className="text-[10px] text-muted-foreground">{t("projectDetail.successRate")}</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            {t("projectDetail.recentActivity")}
          </h3>
          <div className="max-h-40 space-y-1 overflow-auto">
            {agentCycles.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("projectDetail.noActivity")}</p>
            ) : (
              agentCycles.map((c) => (
                <div key={c.cycle_number} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", c.error ? "bg-red-500" : "bg-green-500")} />
                  <span className="font-mono text-[10px] text-muted-foreground">#{c.cycle_number}</span>
                  <span className="flex-1 truncate">{c.action}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(c.completed_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Memory */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Brain className="h-3 w-3" />
            {t("projectDetail.agentMemory")}
          </h3>
          <div className="max-h-40 overflow-auto rounded-md border bg-secondary p-2">
            {memory && memory.trim() ? (
              <pre className="whitespace-pre-wrap text-[10px] text-muted-foreground">{memory}</pre>
            ) : (
              <p className="text-xs text-muted-foreground">{t("projectDetail.noMemory")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
