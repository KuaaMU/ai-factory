import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Wrench, GitBranch, FileText, CheckCircle, Circle } from "lucide-react";
import { listPersonas, listSkills, listWorkflows } from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PersonaInfo, SkillInfo } from "@/lib/types";

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

const SOURCE_COLORS: Record<string, string> = {
  "auto-company": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "real-skills": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  ecc: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  custom: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

// ===== Detail Panel =====

function PersonaDetail({ persona, onClose }: {
  readonly persona: PersonaInfo;
  readonly onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
            {persona.role[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{persona.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{persona.role}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs", LAYER_COLORS[ROLE_TO_LAYER[persona.role] ?? "business"])}>
                {ROLE_TO_LAYER[persona.role] ?? "business"}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{persona.expertise}</p>

        {persona.mental_models.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">Mental Models</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {persona.mental_models.map((m) => (
                <span key={m} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{m}</span>
              ))}
            </div>
          </div>
        )}

        {persona.core_capabilities.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">Core Capabilities</h3>
            <ul className="mt-1 space-y-1">
              {persona.core_capabilities.map((c) => (
                <li key={c} className="text-sm text-muted-foreground">- {c}</li>
              ))}
            </ul>
          </div>
        )}

        {persona.tags.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">Recommended Skills</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {persona.tags.map((t) => (
                <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t}</span>
              ))}
            </div>
          </div>
        )}

        {persona.file_path && (
          <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground/60">
            <FileText className="h-3 w-3" />
            <span className="truncate">{persona.file_path}</span>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-md border py-2 text-sm hover:bg-accent"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function SkillDetail({ skill, onClose }: {
  readonly skill: SkillInfo;
  readonly onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{skill.name}</h2>
          <span className={cn("rounded-full px-2 py-0.5 text-xs", SOURCE_COLORS[skill.source] ?? SOURCE_COLORS.custom)}>
            {skill.source}
          </span>
        </div>

        <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">{skill.category}</span>

        <p className="mt-3 text-sm text-muted-foreground">{skill.description}</p>

        {skill.content_preview && (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">Preview</h3>
            <p className="mt-1 text-xs text-muted-foreground/80">{skill.content_preview}</p>
          </div>
        )}

        {skill.file_path && (
          <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground/60">
            <FileText className="h-3 w-3" />
            <span className="truncate">{skill.file_path}</span>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-md border py-2 text-sm hover:bg-accent"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ===== Category Filter =====

function CategoryFilter({
  categories,
  selected,
  onSelect,
}: {
  readonly categories: readonly string[];
  readonly selected: string;
  readonly onSelect: (cat: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <button
        onClick={() => onSelect("")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
          selected === "" ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80",
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            selected === cat ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80",
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

// ===== Main Library =====

export function Library() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("agents");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<PersonaInfo | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);

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
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.role.toLowerCase().includes(search.toLowerCase())) &&
      (selectedCategory === "" || ROLE_TO_LAYER[p.role] === selectedCategory),
  );

  const filteredSkills = skills?.filter(
    (s) =>
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())) &&
      (selectedCategory === "" || s.source === selectedCategory || s.category === selectedCategory),
  );

  // Extract unique categories for the filter
  const layerCategories = [...new Set(personas?.map((p) => ROLE_TO_LAYER[p.role]).filter(Boolean) ?? [])];
  const skillCategories = [...new Set(skills?.map((s) => s.source) ?? [])];

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
            onClick={() => { setTab(id); setSelectedCategory(""); setSearch(""); }}
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

      {/* Search + Category Filter */}
      <div className="space-y-3">
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
        {tab === "agents" && layerCategories.length > 0 && (
          <CategoryFilter categories={layerCategories} selected={selectedCategory} onSelect={setSelectedCategory} />
        )}
        {tab === "skills" && skillCategories.length > 0 && (
          <CategoryFilter categories={skillCategories} selected={selectedCategory} onSelect={setSelectedCategory} />
        )}
      </div>

      {/* Content */}
      {tab === "agents" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPersonas?.map((p) => (
            <div
              key={p.id}
              className="cursor-pointer rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
              onClick={() => setSelectedPersona(p)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {p.role[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{p.name}</p>
                    {p.enabled ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Circle className="h-3 w-3 text-gray-400" />
                    )}
                  </div>
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
                {p.file_path && (
                  <FileText className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
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
            <div
              key={s.id}
              className="cursor-pointer rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
              onClick={() => setSelectedSkill(s)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{s.name}</p>
                  {s.file_path && (
                    <FileText className="h-3 w-3 text-muted-foreground/40" />
                  )}
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    SOURCE_COLORS[s.source] ?? SOURCE_COLORS.custom,
                  )}
                >
                  {s.source}
                </span>
              </div>
              <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">{s.category}</span>
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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{w.name}</h3>
                {w.file_path && (
                  <FileText className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {w.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
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

      {/* Detail Panels */}
      {selectedPersona && (
        <PersonaDetail persona={selectedPersona} onClose={() => setSelectedPersona(null)} />
      )}
      {selectedSkill && (
        <SkillDetail skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </div>
  );
}
