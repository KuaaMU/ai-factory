import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Square,
  Activity,
  RefreshCw,
  Users,
  AlertCircle,
  Cpu,
  Settings2,
} from "lucide-react";
import { listProjects, loadSettings } from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import type { Project, AppSettings, AiProvider } from "@/lib/types";

// ===== Config Strip =====

const ENGINE_LABELS: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex CLI",
  opencode: "OpenCode",
  gemini: "Gemini CLI",
};

const ENGINE_COLORS: Record<string, string> = {
  claude: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  codex: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  opencode: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  gemini: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

const ENGINE_DOT_COLORS: Record<string, string> = {
  claude: "bg-purple-500",
  codex: "bg-blue-500",
  opencode: "bg-emerald-500",
  gemini: "bg-amber-500",
};

function ConfigStrip({ settings }: { readonly settings: AppSettings | undefined }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  if (!settings) return null;

  const engine = settings.default_engine;
  const isAuto = engine === "auto" || engine === "";
  const engineLabel = isAuto ? "Auto" : (ENGINE_LABELS[engine] ?? engine);
  const engineColor = isAuto ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : (ENGINE_COLORS[engine] ?? "bg-muted text-muted-foreground");
  const dotColor = isAuto ? "bg-green-500" : (ENGINE_DOT_COLORS[engine] ?? "bg-gray-400");

  const providers: readonly AiProvider[] = settings.providers ?? [];
  const activeProvider = providers.find((p) => p.enabled);
  const activeProviderCount = providers.filter((p) => p.enabled).length;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      <Cpu className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex h-2.5 w-2.5 rounded-full", dotColor)} />
          <span className="text-xs font-medium text-muted-foreground">{t("dashboard.engine")}</span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", engineColor)}>{engineLabel}</span>
        </div>
        <span className="text-muted-foreground/30">|</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("dashboard.model")}</span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
            {settings.default_model}
          </span>
        </div>
        <span className="text-muted-foreground/30">|</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("dashboard.provider")}</span>
          {activeProvider ? (
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-flex h-2 w-2 rounded-full", activeProvider.is_healthy ? "bg-green-500" : "bg-yellow-500")} />
              <span className="text-xs font-medium text-foreground">{activeProvider.name}</span>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{activeProvider.default_model}</span>
              {activeProviderCount > 1 && (
                <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                  +{activeProviderCount - 1}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/70">{t("dashboard.noActiveProvider")}</span>
          )}
        </div>
      </div>
      <button
        onClick={() => navigate("/settings")}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-secondary"
      >
        <Settings2 className="h-3 w-3" />
        {t("dashboard.goToSettings")}
      </button>
    </div>
  );
}

// ===== Stats Bar =====

function StatsBar({ projects }: { readonly projects: readonly Project[] }) {
  const { t } = useI18n();

  const stats = useMemo(() => {
    const running = projects.filter((p) => p.status === "running").length;
    const totalCycles = projects.reduce((sum, p) => sum + p.cycle_count, 0);
    const totalAgents = projects.reduce((sum, p) => sum + p.agent_count, 0);
    const errorCount = projects.filter((p) => p.status === "error").length;
    return { running, totalCycles, totalAgents, errorCount };
  }, [projects]);

  const items = [
    {
      icon: Activity,
      label: t("dashboard.running"),
      value: stats.running,
      accent: stats.running > 0 ? "text-green-500" : "text-muted-foreground",
    },
    {
      icon: RefreshCw,
      label: t("dashboard.totalCycles"),
      value: stats.totalCycles,
      accent: "text-muted-foreground",
    },
    {
      icon: Users,
      label: t("common.agents"),
      value: stats.totalAgents,
      accent: "text-muted-foreground",
    },
  ];

  if (stats.errorCount > 0) {
    items.push({
      icon: AlertCircle,
      label: "Errors",
      value: stats.errorCount,
      accent: "text-red-500",
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ icon: Icon, label, value, accent }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
        >
          <Icon className={cn("h-5 w-5", accent)} />
          <div>
            <p className={cn("text-xl font-bold", accent)}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== Main Dashboard =====

export function Dashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: loadSettings,
  });

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => {
      const aRunning = a.status === "running" ? 0 : 1;
      const bRunning = b.status === "running" ? 0 : 1;
      if (aRunning !== bRunning) return aRunning - bRunning;
      return new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime();
    });
  }, [projects]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <button
          onClick={() => navigate("/new")}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("dashboard.newProject")}
        </button>
      </div>

      {/* Active Config Strip */}
      <ConfigStrip settings={settings} />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20">
          <Square className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">{t("dashboard.noProjects")}</p>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.noProjectsDesc")}
            </p>
          </div>
          <button
            onClick={() => navigate("/new")}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t("dashboard.createProject")}
          </button>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <StatsBar projects={sortedProjects} />

          {/* Project Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
