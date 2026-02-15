import { Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_PALETTE } from "./constants";

interface AgentStats {
  readonly cycles: number;
  readonly errors: number;
  readonly lastAction: string;
}

export function AgentTopologyRing({
  agents,
  activeAgent,
  agentStats,
  isRunning,
  selectedAgent,
  onSelectAgent,
}: {
  readonly agents: readonly string[];
  readonly activeAgent: string | null;
  readonly agentStats: ReadonlyMap<string, AgentStats>;
  readonly isRunning: boolean;
  readonly selectedAgent: string | null;
  readonly onSelectAgent: (agent: string | null) => void;
}) {
  if (agents.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <Users className="h-8 w-8 opacity-30" />
          <span>No agent activity yet</span>
        </div>
      </div>
    );
  }

  const size = 280;
  const center = size / 2;
  const radius = agents.length <= 4 ? 85 : agents.length <= 8 ? 95 : 105;
  const nodeSize = agents.length <= 6 ? 48 : 40;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* SVG connection lines */}
      <svg className="pointer-events-none absolute inset-0" width={size} height={size}>
        {agents.map((agent, i) => {
          const angle = (2 * Math.PI * i) / agents.length - Math.PI / 2;
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);
          const isActive = agent === activeAgent;
          const isSelected = agent === selectedAgent;
          return (
            <line
              key={agent}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeOpacity={isActive || isSelected ? 0.4 : 0.08}
              strokeWidth={isActive || isSelected ? 2 : 1}
              strokeDasharray={isActive || isSelected ? undefined : "4 4"}
              className="text-primary transition-all duration-500"
            />
          );
        })}
      </svg>

      {/* Center hub */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 transition-all duration-300",
          isRunning
            ? "border-primary/40 bg-primary/10 shadow-lg shadow-primary/20"
            : "border-border bg-card",
        )}
        style={{ width: 56, height: 56 }}
      >
        {isRunning && (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
        )}
        <Zap className={cn("h-4 w-4", isRunning ? "text-primary" : "text-muted-foreground")} />
        <span className="text-[10px] font-bold">{agents.length}</span>
      </div>

      {/* Agent nodes */}
      {agents.map((agent, i) => {
        const angle = (2 * Math.PI * i) / agents.length - Math.PI / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        const isActive = agent === activeAgent;
        const isSelected = agent === selectedAgent;
        const color = AGENT_PALETTE[i % AGENT_PALETTE.length];
        const stats = agentStats.get(agent);
        const hasError = stats ? stats.errors > 0 : false;

        return (
          <button
            key={agent}
            onClick={() => onSelectAgent(selectedAgent === agent ? null : agent)}
            className={cn(
              "absolute z-20 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center rounded-full border-2 transition-all duration-500",
              isActive
                ? `${color.bg} ${color.border} scale-110 shadow-lg ring-2 ${color.ring}`
                : isSelected
                  ? `${color.bg} ${color.border} scale-105 ring-2 ${color.ring}`
                  : `${color.bg} ${color.border} hover:scale-105`,
              hasError && !isActive && !isSelected ? "border-red-500/40" : "",
            )}
            style={{ left: x, top: y, width: nodeSize, height: nodeSize }}
            title={`${agent}: ${stats?.cycles ?? 0} cycles${stats?.errors ? `, ${stats.errors} errors` : ""}`}
          >
            {isActive && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
              </span>
            )}
            <span
              className={cn("truncate text-[10px] font-bold leading-tight", color.text)}
              style={{ maxWidth: nodeSize - 8 }}
            >
              {agent.length > 5 ? agent.slice(0, 4) : agent}
            </span>
            {stats && (
              <span className="text-[8px] text-muted-foreground">{stats.cycles}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
