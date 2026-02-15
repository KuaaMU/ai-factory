import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search,
  Users,
  Wrench,
  GitBranch,
  FileText,
  Plus,
  FolderSearch,
  Server,
  Pencil,
} from "lucide-react";
import {
  listPersonas,
  listSkills,
  listWorkflows,
  listCustomAgents,
  listCustomSkills,
  listCustomWorkflows,
  listMcpServers,
  scanLocalSkills,
  getLibraryState,
} from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  PersonaInfo,
  SkillInfo,
  WorkflowInfo,
  ScannedSkill,
} from "@/lib/types";
import {
  PersonaDetail,
  SkillDetail,
  AddAgentModal,
  AddSkillModal,
  AddWorkflowModal,
  ScanResultsModal,
  RepoManagerPanel,
  McpTabContent,
  ToggleSwitch,
  DeleteButton,
  WorkflowDeleteButton,
  CategoryFilter,
  LAYER_COLORS,
  ROLE_TO_LAYER,
  SOURCE_COLORS,
} from "@/components/library";

type Tab = "agents" | "skills" | "workflows" | "mcp";

type ModalMode =
  | { readonly kind: "none" }
  | { readonly kind: "addAgent" }
  | { readonly kind: "addSkill" }
  | { readonly kind: "addWorkflow" }
  | { readonly kind: "editAgent"; readonly agent: PersonaInfo }
  | { readonly kind: "editSkill"; readonly skill: SkillInfo }
  | { readonly kind: "editWorkflow"; readonly workflow: WorkflowInfo }
  | { readonly kind: "scanResults"; readonly results: readonly ScannedSkill[] };

// ===== Helpers =====

function mergePersonas(
  base: readonly PersonaInfo[] | undefined,
  custom: readonly PersonaInfo[] | undefined,
): readonly PersonaInfo[] {
  const baseList = base ?? [];
  const customList = custom ?? [];
  const baseIds = new Set(baseList.map((p) => p.id));
  const merged = [...baseList];
  for (const c of customList) {
    if (!baseIds.has(c.id)) {
      merged.push(c);
    }
  }
  return merged;
}

function mergeSkills(
  base: readonly SkillInfo[] | undefined,
  custom: readonly SkillInfo[] | undefined,
): readonly SkillInfo[] {
  const baseList = base ?? [];
  const customList = custom ?? [];
  const baseIds = new Set(baseList.map((s) => s.id));
  const merged = [...baseList];
  for (const c of customList) {
    if (!baseIds.has(c.id)) {
      merged.push(c);
    }
  }
  return merged;
}

// ===== Main Library =====

export function Library() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("agents");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<PersonaInfo | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [modal, setModal] = useState<ModalMode>({ kind: "none" });

  // ---- Base queries ----

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

  // ---- Custom item queries ----

  const { data: customAgents } = useQuery({
    queryKey: ["customAgents"],
    queryFn: listCustomAgents,
  });

  const { data: customSkills } = useQuery({
    queryKey: ["customSkills"],
    queryFn: listCustomSkills,
  });

  const { data: customWorkflows } = useQuery({
    queryKey: ["custom-workflows"],
    queryFn: listCustomWorkflows,
  });

  // ---- MCP server count for tab badge ----

  const { data: mcpServers } = useQuery({
    queryKey: ["mcp-servers"],
    queryFn: listMcpServers,
  });

  // ---- Library toggle state ----

  const { data: libraryState, refetch: refetchLibraryState } = useQuery({
    queryKey: ["library-state"],
    queryFn: getLibraryState,
  });

  const isPersonaDisabled = useCallback(
    (id: string) => libraryState?.disabled_personas.includes(id) ?? false,
    [libraryState],
  );

  const isSkillDisabled = useCallback(
    (id: string) => libraryState?.disabled_skills.includes(id) ?? false,
    [libraryState],
  );

  const isWorkflowDisabled = useCallback(
    (id: string) => libraryState?.disabled_workflows.includes(id) ?? false,
    [libraryState],
  );

  const handleToggled = useCallback(() => {
    refetchLibraryState();
  }, [refetchLibraryState]);

  // ---- Merged lists ----

  const allPersonas = mergePersonas(personas, customAgents);
  const allSkills = mergeSkills(skills, customSkills);
  const allWorkflows = [
    ...(workflows ?? []),
    ...(customWorkflows ?? []),
  ];

  // ---- Scan mutation ----

  const scanMutation = useMutation({
    mutationFn: scanLocalSkills,
    onSuccess: (results) => {
      setModal({ kind: "scanResults", results });
    },
  });

  // ---- Filtering ----

  const lowerSearch = search.toLowerCase();

  const filteredPersonas = allPersonas.filter(
    (p) =>
      (p.name.toLowerCase().includes(lowerSearch) ||
        p.role.toLowerCase().includes(lowerSearch)) &&
      (selectedCategory === "" || ROLE_TO_LAYER[p.role] === selectedCategory),
  );

  const filteredSkills = allSkills.filter(
    (s) =>
      (s.name.toLowerCase().includes(lowerSearch) ||
        s.category.toLowerCase().includes(lowerSearch) ||
        s.description.toLowerCase().includes(lowerSearch)) &&
      (selectedCategory === "" || s.source === selectedCategory || s.category === selectedCategory),
  );

  const filteredWorkflows = allWorkflows.filter(
    (w) =>
      w.name.toLowerCase().includes(lowerSearch) ||
      w.description.toLowerCase().includes(lowerSearch) ||
      w.chain.some((role) => role.toLowerCase().includes(lowerSearch)),
  );

  // Extract unique categories for filters
  const layerCategories = [...new Set(allPersonas.map((p) => ROLE_TO_LAYER[p.role]).filter(Boolean))];
  const skillCategories = [...new Set(allSkills.map((s) => s.source))];

  const searchPlaceholder =
    tab === "agents"
      ? t("library.searchAgents")
      : tab === "skills"
        ? t("library.searchSkills")
        : t("library.searchWorkflows");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("library.title")}</h1>
        <p className="text-muted-foreground">{t("library.subtitle")}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border">
        {(
          [
            { id: "agents" as Tab, icon: Users, label: t("library.agents"), count: allPersonas.length },
            { id: "skills" as Tab, icon: Wrench, label: t("library.skills"), count: allSkills.length },
            { id: "workflows" as Tab, icon: GitBranch, label: t("library.workflows"), count: allWorkflows.length },
            { id: "mcp" as Tab, icon: Server, label: t("settings.mcpServers"), count: mcpServers?.length },
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
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Action Buttons + Category Filter */}
      {tab !== "mcp" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-border bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {tab === "agents" && (
              <button
                onClick={() => setModal({ kind: "addAgent" })}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                {t("library.addAgent")}
              </button>
            )}

            {tab === "skills" && (
              <>
                <button
                  onClick={() => setModal({ kind: "addSkill" })}
                  className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  {t("library.addSkill")}
                </button>
                <button
                  onClick={() => scanMutation.mutate()}
                  disabled={scanMutation.isPending}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-secondary px-3 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
                >
                  <FolderSearch className="h-4 w-4" />
                  {scanMutation.isPending ? t("library.scanning") : t("library.scanSkills")}
                </button>
              </>
            )}

            {tab === "workflows" && (
              <button
                onClick={() => setModal({ kind: "addWorkflow" })}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                {t("library.addWorkflow")}
              </button>
            )}
          </div>

          {tab === "agents" && layerCategories.length > 0 && (
            <CategoryFilter categories={layerCategories} selected={selectedCategory} onSelect={setSelectedCategory} />
          )}
          {tab === "skills" && skillCategories.length > 0 && (
            <CategoryFilter categories={skillCategories} selected={selectedCategory} onSelect={setSelectedCategory} />
          )}
        </div>
      )}

      {/* Agents Tab */}
      {tab === "agents" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPersonas.map((p) => {
            const disabled = isPersonaDisabled(p.id);
            const isCustom = p.id.startsWith("custom:");
            return (
              <div
                key={p.id}
                className={cn(
                  "cursor-pointer rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md",
                  disabled && "opacity-50",
                )}
                onClick={() => setSelectedPersona(p)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    {p.role[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{p.role}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", LAYER_COLORS[ROLE_TO_LAYER[p.role] ?? "business"])}>
                        {ROLE_TO_LAYER[p.role] ?? "business"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ToggleSwitch itemType="persona" itemId={p.id} enabled={!disabled} onToggled={handleToggled} />
                    {p.file_path && <FileText className="h-3.5 w-3.5 text-muted-foreground/40" />}
                    {isCustom && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setModal({ kind: "editAgent", agent: p }); }}
                          className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                          title={t("library.editAgent")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <DeleteButton itemId={p.id} itemType="agent" />
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{p.expertise}</p>
                {p.core_capabilities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.core_capabilities.slice(0, 3).map((cap) => (
                      <span key={cap} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{cap}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Skills Tab */}
      {tab === "skills" && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredSkills.map((s) => {
              const disabled = isSkillDisabled(s.id);
              const isCustom = s.id.startsWith("custom:");
              return (
                <div
                  key={s.id}
                  className={cn(
                    "cursor-pointer rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md",
                    disabled && "opacity-50",
                  )}
                  onClick={() => setSelectedSkill(s)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{s.name}</p>
                      {s.file_path && <FileText className="h-3 w-3 text-muted-foreground/40" />}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ToggleSwitch itemType="skill" itemId={s.id} enabled={!disabled} onToggled={handleToggled} />
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", SOURCE_COLORS[s.source] ?? SOURCE_COLORS.custom)}>
                        {s.source}
                      </span>
                      {isCustom && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setModal({ kind: "editSkill", skill: s }); }}
                            className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                            title={t("library.editSkill")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <DeleteButton itemId={s.id} itemType="skill" />
                        </>
                      )}
                    </div>
                  </div>
                  <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">{s.category}</span>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                </div>
              );
            })}
          </div>
          <RepoManagerPanel />
        </div>
      )}

      {/* Workflows Tab */}
      {tab === "workflows" && (
        <div className="space-y-4">
          {filteredWorkflows.map((w) => {
            const disabled = isWorkflowDisabled(w.id);
            const isCustom = w.id.startsWith("custom:");
            return (
              <div key={w.id} className={cn("rounded-lg border border-border bg-card p-4", disabled && "opacity-50")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{w.name}</h3>
                    {isCustom && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">custom</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch itemType="workflow" itemId={w.id} enabled={!disabled} onToggled={handleToggled} />
                    {w.file_path && <FileText className="h-3.5 w-3.5 text-muted-foreground/40" />}
                    {isCustom && (
                      <>
                        <button
                          onClick={() => setModal({ kind: "editWorkflow", workflow: w })}
                          className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                          title={t("library.editWorkflow")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <WorkflowDeleteButton workflowId={w.id} />
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{w.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {w.chain.map((role, i) => (
                    <div key={`${role}-${i}`} className="flex items-center gap-2">
                      <span className={cn("rounded-full px-3 py-1 text-xs font-medium", LAYER_COLORS[ROLE_TO_LAYER[role] ?? "business"])}>
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
            );
          })}
        </div>
      )}

      {/* MCP Tab */}
      {tab === "mcp" && (
        <div className="space-y-6">
          <McpTabContent />
          <RepoManagerPanel />
        </div>
      )}

      {/* Detail Panels */}
      {selectedPersona && (
        <PersonaDetail persona={selectedPersona} onClose={() => setSelectedPersona(null)} />
      )}
      {selectedSkill && (
        <SkillDetail skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}

      {/* Modal Overlays */}
      {modal.kind === "addAgent" && (
        <AddAgentModal onClose={() => setModal({ kind: "none" })} />
      )}
      {modal.kind === "editAgent" && (
        <AddAgentModal onClose={() => setModal({ kind: "none" })} editAgent={modal.agent} />
      )}
      {modal.kind === "addSkill" && (
        <AddSkillModal onClose={() => setModal({ kind: "none" })} />
      )}
      {modal.kind === "editSkill" && (
        <AddSkillModal onClose={() => setModal({ kind: "none" })} editSkill={modal.skill} />
      )}
      {modal.kind === "addWorkflow" && (
        <AddWorkflowModal onClose={() => setModal({ kind: "none" })} />
      )}
      {modal.kind === "editWorkflow" && (
        <AddWorkflowModal onClose={() => setModal({ kind: "none" })} editWorkflow={modal.workflow} />
      )}
      {modal.kind === "scanResults" && (
        <ScanResultsModal
          results={modal.results}
          onClose={() => setModal({ kind: "none" })}
        />
      )}
    </div>
  );
}
