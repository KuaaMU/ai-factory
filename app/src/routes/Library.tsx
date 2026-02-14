import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Users,
  Wrench,
  GitBranch,
  FileText,
  CheckCircle,
  Circle,
  Plus,
  Trash2,
  Download,
  FolderSearch,
} from "lucide-react";
import {
  listPersonas,
  listSkills,
  listWorkflows,
  listCustomAgents,
  listCustomSkills,
  addCustomAgent,
  addCustomSkill,
  removeCustomAgent,
  removeCustomSkill,
  scanLocalSkills,
} from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  PersonaInfo,
  SkillInfo,
  ScannedSkill,
  AddSkillRequest,
  AddAgentRequest,
  AgentLayer,
} from "@/lib/types";

type Tab = "agents" | "skills" | "workflows";

type ModalMode =
  | { readonly kind: "none" }
  | { readonly kind: "addAgent" }
  | { readonly kind: "addSkill" }
  | { readonly kind: "scanResults"; readonly results: readonly ScannedSkill[] };

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

const AGENT_LAYERS: readonly AgentLayer[] = [
  "strategy",
  "engineering",
  "product",
  "business",
  "intelligence",
];

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

// ===== Detail Panel: Persona =====

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

// ===== Detail Panel: Skill =====

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

// ===== Add Agent Modal =====

function AddAgentModal({ onClose }: { readonly onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [expertise, setExpertise] = useState("");
  const [layer, setLayer] = useState<AgentLayer>("engineering");
  const [mentalModels, setMentalModels] = useState("");
  const [coreCapabilities, setCoreCapabilities] = useState("");

  const mutation = useMutation({
    mutationFn: (req: AddAgentRequest) => addCustomAgent(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] });
      queryClient.invalidateQueries({ queryKey: ["customAgents"] });
      onClose();
    },
  });

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (trimmedName === "" || trimmedRole === "") return;

    const request: AddAgentRequest = {
      name: trimmedName,
      role: trimmedRole,
      expertise: expertise.trim(),
      layer,
      mental_models: mentalModels
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== ""),
      core_capabilities: coreCapabilities
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== ""),
    };
    mutation.mutate(request);
  }, [name, role, expertise, layer, mentalModels, coreCapabilities, mutation]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{t("library.addAgent")}</h2>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.role")}</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.expertise")}</label>
            <input
              type="text"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              className="mt-1 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.layer")}</label>
            <select
              value={layer}
              onChange={(e) => setLayer(e.target.value as AgentLayer)}
              className="mt-1 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {AGENT_LAYERS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.mentalModels")}</label>
            <input
              type="text"
              value={mentalModels}
              onChange={(e) => setMentalModels(e.target.value)}
              placeholder="model1, model2, model3"
              className="mt-1 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.coreCapabilities")}</label>
            <input
              type="text"
              value={coreCapabilities}
              onChange={(e) => setCoreCapabilities(e.target.value)}
              placeholder="capability1, capability2"
              className="mt-1 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-500">{String(mutation.error)}</p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 py-2 text-sm hover:bg-zinc-700"
          >
            {t("library.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending || name.trim() === "" || role.trim() === ""}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? t("common.loading") : t("library.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Add Skill Modal =====

function AddSkillModal({ onClose }: { readonly onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");

  const mutation = useMutation({
    mutationFn: (req: AddSkillRequest) => addCustomSkill(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["customSkills"] });
      onClose();
    },
  });

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    if (trimmedName === "") return;

    const request: AddSkillRequest = {
      name: trimmedName,
      description: description.trim(),
      category: category.trim() || "custom",
      content: content.trim(),
    };
    mutation.mutate(request);
  }, [name, description, category, content, mutation]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{t("library.addSkill")}</h2>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.description")}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.category")}</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="custom"
              className="mt-1 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.content")}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-500">{String(mutation.error)}</p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 py-2 text-sm hover:bg-zinc-700"
          >
            {t("library.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending || name.trim() === ""}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? t("common.loading") : t("library.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Scan Results Modal =====

function ScanResultsModal({
  results,
  onClose,
}: {
  readonly results: readonly ScannedSkill[];
  readonly onClose: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [importedIds, setImportedIds] = useState<ReadonlySet<string>>(new Set());

  const importMutation = useMutation({
    mutationFn: (scanned: ScannedSkill) => {
      const request: AddSkillRequest = {
        name: scanned.name,
        description: scanned.description,
        category: scanned.source,
        content: "",
      };
      return addCustomSkill(request);
    },
    onSuccess: (_data, scanned) => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["customSkills"] });
      setImportedIds((prev) => new Set([...prev, scanned.id]));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{t("library.scanResults")}</h2>

        {results.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("library.noScanResults")}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {results.map((skill) => {
              const isImported = importedIds.has(skill.id);
              return (
                <div
                  key={skill.id}
                  className="flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-800 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{skill.name}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {skill.source}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{skill.full_path}</p>
                  </div>
                  <button
                    onClick={() => importMutation.mutate(skill)}
                    disabled={isImported || importMutation.isPending}
                    className={cn(
                      "ml-3 flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      isImported
                        ? "bg-green-900 text-green-200"
                        : "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    {isImported ? (
                      <>
                        <CheckCircle className="h-3 w-3" />
                        {t("library.imported")}
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        {t("library.import")}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-md border border-zinc-700 bg-zinc-800 py-2 text-sm hover:bg-zinc-700"
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

// ===== Delete Button =====

function DeleteButton({
  itemId,
  itemType,
}: {
  readonly itemId: string;
  readonly itemType: "agent" | "skill";
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () =>
      itemType === "agent"
        ? removeCustomAgent(itemId)
        : removeCustomSkill(itemId),
    onSuccess: () => {
      if (itemType === "agent") {
        queryClient.invalidateQueries({ queryKey: ["personas"] });
        queryClient.invalidateQueries({ queryKey: ["customAgents"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["skills"] });
        queryClient.invalidateQueries({ queryKey: ["customSkills"] });
      }
    },
  });

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm(t("library.removeConfirm"))) {
        deleteMutation.mutate();
      }
    },
    [deleteMutation, t],
  );

  return (
    <button
      onClick={handleDelete}
      disabled={deleteMutation.isPending}
      className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-red-900/40 hover:text-red-400"
      title={t("common.delete")}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
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

  // ---- Merged lists ----

  const allPersonas = mergePersonas(personas, customAgents);
  const allSkills = mergeSkills(skills, customSkills);

  // ---- Scan mutation ----

  const scanMutation = useMutation({
    mutationFn: scanLocalSkills,
    onSuccess: (results) => {
      setModal({ kind: "scanResults", results });
    },
  });

  // ---- Filtering ----

  const filteredPersonas = allPersonas.filter(
    (p) =>
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.role.toLowerCase().includes(search.toLowerCase())) &&
      (selectedCategory === "" || ROLE_TO_LAYER[p.role] === selectedCategory),
  );

  const filteredSkills = allSkills.filter(
    (s) =>
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())) &&
      (selectedCategory === "" || s.source === selectedCategory || s.category === selectedCategory),
  );

  // Extract unique categories for the filter
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
        <h1 className="text-2xl font-bold">{t("library.title")}</h1>
        <p className="text-muted-foreground">
          {t("library.subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        {(
          [
            { id: "agents" as Tab, icon: Users, label: t("library.agents"), count: allPersonas.length },
            { id: "skills" as Tab, icon: Wrench, label: t("library.skills"), count: allSkills.length },
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

      {/* Search + Action Buttons + Category Filter */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium hover:bg-zinc-700 disabled:opacity-50"
              >
                <FolderSearch className="h-4 w-4" />
                {scanMutation.isPending ? t("library.scanning") : t("library.scanSkills")}
              </button>
            </>
          )}
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
          {filteredPersonas.map((p) => (
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
                <div className="flex items-center gap-1">
                  {p.file_path && (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                  {p.id.startsWith("custom:") && (
                    <DeleteButton itemId={p.id} itemType="agent" />
                  )}
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
          {filteredSkills.map((s) => (
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
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      SOURCE_COLORS[s.source] ?? SOURCE_COLORS.custom,
                    )}
                  >
                    {s.source}
                  </span>
                  {s.id.startsWith("custom:") && (
                    <DeleteButton itemId={s.id} itemType="skill" />
                  )}
                </div>
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

      {/* Modal Overlays */}
      {modal.kind === "addAgent" && (
        <AddAgentModal onClose={() => setModal({ kind: "none" })} />
      )}
      {modal.kind === "addSkill" && (
        <AddSkillModal onClose={() => setModal({ kind: "none" })} />
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
