import { useState, useMemo, useRef, useEffect } from "react";
import { Terminal, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function LogViewer({
  logs,
  isRunning,
}: {
  readonly logs: readonly string[] | undefined;
  readonly isRunning: boolean;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!filter) return [...logs];
    const lower = filter.toLowerCase();
    return logs.filter((line) => line.toLowerCase().includes(lower));
  }, [logs, filter]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          <h2 className="text-sm font-semibold">{t("projectDetail.logs")}</h2>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              {t("common.live")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("projectDetail.searchLogs")}
              className="h-7 w-40 rounded-md border border-input bg-secondary pl-7 pr-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => setAutoScroll((v) => !v)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              autoScroll
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80",
            )}
          >
            {t("projectDetail.autoScroll")}
          </button>
        </div>
      </div>
      <div ref={containerRef} className="max-h-80 overflow-auto bg-black/90 p-4">
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
          {filteredLogs.length > 0
            ? filteredLogs.map((line, i) => {
                const isError = /error|failed|panic/i.test(line);
                const isWarn = /warn|warning/i.test(line);
                return (
                  <div
                    key={i}
                    className={cn(
                      isError
                        ? "text-red-400"
                        : isWarn
                          ? "text-yellow-400"
                          : "text-green-400/80",
                    )}
                  >
                    <span className="mr-2 select-none text-green-400/30">
                      {String(i + 1).padStart(3)}
                    </span>
                    {line}
                  </div>
                );
              })
            : (
              <span className="text-green-400/50">{t("projectDetail.waitingForLogs")}</span>
            )}
        </pre>
      </div>
    </div>
  );
}
