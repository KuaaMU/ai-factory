import { useQuery } from "@tanstack/react-query";
import { Rss } from "lucide-react";
import { getProjectEvents } from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatTime, EVENT_COLORS, EVENT_ICONS, getAgentColor } from "./constants";
import type { ProjectEvent } from "@/lib/types";

export function ActivityFeed({
  projectDir,
  agents,
  isRunning,
}: {
  readonly projectDir: string;
  readonly agents: readonly string[];
  readonly isRunning: boolean;
}) {
  const { t } = useI18n();

  const { data: events } = useQuery({
    queryKey: ["project-events", projectDir],
    queryFn: () => getProjectEvents(projectDir, 50),
    enabled: !!projectDir,
    refetchInterval: isRunning ? 2000 : 10000,
  });

  const recent = events ? [...events].reverse().slice(0, 30) : [];

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Rss className="h-4 w-4" />
          <h2 className="text-sm font-semibold">{t("projectDetail.activityFeed")}</h2>
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              {t("common.live")}
            </span>
          )}
        </div>
      </div>
      <div className="max-h-[320px] overflow-auto p-3">
        {recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("projectDetail.noEvents")}
          </p>
        ) : (
          <div className="space-y-1">
            {recent.map((event) => (
              <EventRow key={event.id} event={event} agents={agents} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({
  event,
  agents,
}: {
  readonly event: ProjectEvent;
  readonly agents: readonly string[];
}) {
  const eventColor = EVENT_COLORS[event.event_type] ?? "text-muted-foreground";
  const eventIcon = EVENT_ICONS[event.event_type] ?? "\u2022";
  const agentColor = event.agent ? getAgentColor(agents, event.agent) : null;

  return (
    <div className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/50">
      <span className={cn("mt-0.5 shrink-0 font-mono text-sm", eventColor)}>
        {eventIcon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {agentColor && (
            <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", agentColor.bg, agentColor.text)}>
              {event.agent}
            </span>
          )}
          <span className="truncate text-foreground">{event.summary}</span>
        </div>
        {event.details && (
          <p className="mt-0.5 truncate text-muted-foreground">{event.details}</p>
        )}
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {formatTime(event.timestamp)}
      </span>
    </div>
  );
}
