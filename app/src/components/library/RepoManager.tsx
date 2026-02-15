import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  CheckCircle,
  Check,
  Loader2,
  AlertCircle,
  FolderSearch,
  Trash2,
  Plus,
  ExternalLink,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  addCustomSkill,
  listSkillRepos,
  addSkillRepo,
  removeSkillRepo,
  browseRepoSkills,
  installRepoSkill,
} from "@/lib/tauri";
import type { AddSkillRequest, ScannedSkill, SkillRepo } from "@/lib/types";

// ===== Scan Results Modal =====

export function ScanResultsModal({
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
        className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground">{t("library.scanResults")}</h2>

        {results.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("library.noScanResults")}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {results.map((skill) => {
              const isImported = importedIds.has(skill.id);
              return (
                <div
                  key={skill.id}
                  className="flex items-center justify-between rounded-md border border-input bg-secondary p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{skill.name}</p>
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
          className="mt-5 w-full rounded-md border border-input bg-secondary py-2 text-sm hover:bg-secondary/80"
        >
          {t("library.close")}
        </button>
      </div>
    </div>
  );
}

// ===== Repo Browser =====

function RepoBrowser({
  repoId,
  repoName,
}: {
  readonly repoId: string;
  readonly repoName: string;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [installedPaths, setInstalledPaths] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const {
    data: items,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["repo-skills", repoId],
    queryFn: () => browseRepoSkills(repoId),
  });

  const installMutation = useMutation({
    mutationFn: ({
      rId,
      skillPath,
    }: {
      readonly rId: string;
      readonly skillPath: string;
    }) => installRepoSkill(rId, skillPath),
    onSuccess: (_data, { skillPath }) => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["customSkills"] });
      setInstalledPaths((prev) => new Set([...prev, skillPath]));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("library.browsing")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>{String(error)}</span>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        No skills found in this repository.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        {repoName} — {items.length} skills
      </p>
      {items.map((item) => {
        const isInstalled = installedPaths.has(item.path);
        return (
          <div
            key={item.path}
            className="flex items-center gap-3 rounded-md border border-input bg-secondary p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              {item.description && (
                <p className="truncate text-xs text-muted-foreground">
                  {item.description}
                </p>
              )}
            </div>
            <button
              onClick={() =>
                installMutation.mutate({
                  rId: repoId,
                  skillPath: item.path,
                })
              }
              disabled={isInstalled || installMutation.isPending}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isInstalled
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {isInstalled ? (
                <>
                  <Check className="h-3 w-3" />
                  {t("library.installed")}
                </>
              ) : (
                <>
                  <Download className="h-3 w-3" />
                  {t("library.installSkill")}
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ===== Add Repo Form =====

function AddRepoForm({ onClose }: { readonly onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [path, setPath] = useState("");
  const [repoName, setRepoName] = useState("");

  const mutation = useMutation({
    mutationFn: (r: SkillRepo) => addSkillRepo(r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-repos"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      onClose();
    },
  });

  const handleSubmit = useCallback(() => {
    const trimmedOwner = owner.trim();
    const trimmedRepo = repo.trim();
    if (trimmedOwner === "" || trimmedRepo === "") return;

    const newRepo: SkillRepo = {
      id: `${trimmedOwner}-${trimmedRepo}-${Date.now()}`,
      name: repoName.trim() || `${trimmedOwner}/${trimmedRepo}`,
      owner: trimmedOwner,
      repo: trimmedRepo,
      branch: branch.trim() || "main",
      path: path.trim(),
      enabled: true,
    };
    mutation.mutate(newRepo);
  }, [owner, repo, branch, path, repoName, mutation]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground">
          {t("library.addRepo")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("library.repoHint")}
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase text-muted-foreground">
                {t("library.repoOwner")}
              </label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="anthropics"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-muted-foreground">
                {t("library.repoName")}
              </label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="skills"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase text-muted-foreground">
                {t("library.repoBranch")}
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-muted-foreground">
                {t("library.repoPath")}
              </label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="skills"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">
              {t("library.name")}
            </label>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder={
                owner && repo ? `${owner}/${repo}` : "Display name"
              }
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-500">{String(mutation.error)}</p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-input bg-secondary py-2 text-sm hover:bg-secondary/80"
          >
            {t("library.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              mutation.isPending || owner.trim() === "" || repo.trim() === ""
            }
            className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? t("common.loading") : t("library.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Repo Manager Panel =====

export function RepoManagerPanel() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [browsingRepoId, setBrowsingRepoId] = useState<string | null>(null);

  const { data: repos = [] } = useQuery({
    queryKey: ["skill-repos"],
    queryFn: listSkillRepos,
  });

  const removeMutation = useMutation({
    mutationFn: (repoId: string) => removeSkillRepo(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-repos"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="font-semibold text-foreground">
              {t("library.repos")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("library.reposDesc")}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddRepo(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("library.addRepo")}
        </button>
      </div>

      {repos.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          {t("library.noRepos")}
        </div>
      ) : (
        <div className="space-y-3">
          {repos.map((r) => (
            <div key={r.id} className="space-y-2">
              <div className="flex items-center gap-3 rounded-md border border-input bg-secondary p-3">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{r.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>
                      {r.owner}/{r.repo}
                    </span>
                    {r.branch !== "main" && (
                      <span className="rounded bg-secondary px-1 py-0.5">
                        {r.branch}
                      </span>
                    )}
                    {r.path && (
                      <span className="rounded bg-secondary px-1 py-0.5">
                        /{r.path}
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={`https://github.com/${r.owner}/${r.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() =>
                    setBrowsingRepoId(
                      browsingRepoId === r.id ? null : r.id,
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    browsingRepoId === r.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-input hover:bg-secondary",
                  )}
                >
                  <FolderSearch className="h-3 w-3" />
                  {t("library.browseRepo")}
                </button>
                <button
                  onClick={() => removeMutation.mutate(r.id)}
                  disabled={removeMutation.isPending}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {browsingRepoId === r.id && (
                <div className="ml-6">
                  <RepoBrowser repoId={r.id} repoName={r.name} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddRepo && (
        <AddRepoForm onClose={() => setShowAddRepo(false)} />
      )}
    </div>
  );
}
