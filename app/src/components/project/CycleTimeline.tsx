import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { getAgentColor, formatTime } from "./constants";
import type { CycleResult } from "@/lib/types";

export function CycleTimeline({
  cycles,
  agents,
}: {
  readonly cycles: readonly CycleResult[];
  readonly agents: readonly string[];
}) {
  const { t } = useI18n();
  const [expandedCycle, setExpandedCycle] = useState<number | null>(null);

  if (!cycles || cycles.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t("projectDetail.noCycles")}
      </p>
    );
  }

  const recent = [...cycles].reverse().slice(0, 30);

  return (
    <div className="relative space-y-0.5">
      <div className="absolute bottom-0 left-4 top-0 w-px bg-border" />

      {recent.map((cycle) => {
        const color = getAgentColor(agents, cycle.agent_role);
        const isExpanded = expandedCycle === cycle.cycle_number;

        return (
          <div key={cycle.cycle_number} className="relative">
            <button
              onClick={() => setExpandedCycle(isExpanded ? null : cycle.cycle_number)}
              className="relative flex w-full items-start gap-3 py-1.5 pl-2 text-left hover:bg-secondary/30"
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  "relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                  cycle.error ? "bg-red-500" : color.dot,
                )}
              />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    #{cycle.cycle_number}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      color.bg,
                      color.text,
                    )}
                  >
                    {cycle.agent_role}
                  </span>
                  {cycle.error && <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />}
                  <span className="ml-auto">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{cycle.action}</p>
                <span className="text-[10px] text-muted-foreground/60">
                  {formatTime(cycle.completed_at)}
                </span>
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="ml-9 mb-2 space-y-2 rounded-md border border-border bg-secondary/50 p-3">
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground">{t("projectDetail.outcome")}</span>
                  <p className="mt-0.5 text-xs">{cycle.outcome ?? cycle.action}</p>
                </div>

                {cycle.files_changed && cycle.files_changed.length > 0 && (
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground">{t("projectDetail.filesChanged")}</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {cycle.files_changed.map((file) => (
                        <span key={file} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono">
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {cycle.error && (
                  <div>
                    <span className="text-[10px] font-medium text-red-400">{t("projectDetail.errorDetail")}</span>
                    <p className="mt-0.5 text-xs text-red-400">{cycle.error}</p>
                  </div>
                )}

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatTime(cycle.completed_at)}
                  </span>
                  {cycle.duration_secs != null && (
                    <span>{cycle.duration_secs}s</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
