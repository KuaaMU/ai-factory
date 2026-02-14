import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Wrench, GitBranch } from "lucide-react";
import { listPersonas, listSkills, listWorkflows } from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Tab = "agents" | "skills" | "workflows";

const LAYER_COLORS: Record<string, string> = {
  strategy: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  engineering: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  product: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  business: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  intelligence: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
};

const ROLE_TO_LAYER: Record<string, string> = {
  ceo: "strategy",
  critic: "strategy",
  fullstack: "engineering",
  devops: "engineering",
  qa: "engineering",
  product: "product",
  ui: "product",
  marketing: "business",
  operations: "business",
  sales: "business",
  cfo: "business",
  research: "intelligence",
};

export function Library() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("agents");
  const [search, setSearch] = useState("");

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: listPersonas,
  });

  const { data: skills } = useQuery({
    queryKey: ["skills"],
    queryFn: listSkills,
  });

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: listWorkflows,
  });

  const filteredPersonas = personas?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.role.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredSkills = skills?.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase()),
  );

  const searchPlaceholder =
    tab === "agents"
      ? t("library.searchAgents")
      : tab === "skills"
        ? t("library.searchSkills")
        : t("library.searchWorkflows");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("library.title")}</h1>
        <p className="text-muted-foreground">
          {t("library.subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        {(
          [
            { id: "agents" as Tab, icon: Users, label: t("library.agents"), count: personas?.length },
            { id: "skills" as Tab, icon: Wrench, label: t("library.skills"), count: skills?.length },
            { id: "workflows" as Tab, icon: GitBranch, label: t("library.workflows"), count: workflows?.length },
          ] as const
        ).map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {count !== undefined && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Content */}
      {tab === "agents" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPersonas?.map((p) => (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {p.role[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {p.role}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        LAYER_COLORS[ROLE_TO_LAYER[p.role] ?? "business"],
                      )}
                    >
                      {ROLE_TO_LAYER[p.role] ?? "business"}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                {p.expertise}
              </p>
              {p.core_capabilities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.core_capabilities.slice(0, 3).map((cap) => (
                    <span
                      key={cap}
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "skills" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredSkills?.map((s) => (
            <div key={s.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{s.name}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    s.source === "auto-company"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      : s.source === "ecc"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
                  )}
                >
                  {s.source}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "workflows" && (
        <div className="space-y-4">
          {workflows?.map((w) => (
            <div key={w.id} className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">{w.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {w.description}
              </p>
              <div className="mt-3 flex items-center gap-2">
                {w.chain.map((role, i) => (
                  <div key={`${role}-${i}`} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        LAYER_COLORS[ROLE_TO_LAYER[role] ?? "business"],
                      )}
                    >
                      {role}
                    </span>
                    {i < w.chain.length - 1 && (
                      <span className="text-muted-foreground">&rarr;</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("library.convergence")}: {w.convergence_cycles} {t("common.cycles")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
