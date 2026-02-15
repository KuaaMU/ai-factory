import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { setProjectRuntimeOverride } from "@/lib/tauri";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import type { ProjectRuntimeOverride } from "@/lib/types";

const ENGINE_OPTIONS = [
  { value: "claude", label: "Claude Code" },
  { value: "codex", label: "Codex CLI" },
  { value: "opencode", label: "OpenCode" },
  { value: "gemini", label: "Gemini CLI" },
] as const;

const MODEL_OPTIONS = [
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku" },
] as const;

export function ConfigSelector({
  projectDir,
  currentOverride,
  globalEngine,
  globalModel,
}: {
  readonly projectDir: string;
  readonly currentOverride: ProjectRuntimeOverride;
  readonly globalEngine: string;
  readonly globalModel: string;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const effectiveEngine = currentOverride.engine ?? globalEngine;
  const effectiveModel = currentOverride.model ?? globalModel;
  const isOverridden = Boolean(currentOverride.engine || currentOverride.model);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSet = async (engine: string | undefined, model: string | undefined) => {
    const updated: ProjectRuntimeOverride = {
      engine: engine ?? currentOverride.engine,
      model: model ?? currentOverride.model,
      provider_id: currentOverride.provider_id,
    };
    await setProjectRuntimeOverride(projectDir, updated);
    queryClient.invalidateQueries({ queryKey: ["project-override", projectDir] });
  };

  const handleReset = async () => {
    await setProjectRuntimeOverride(projectDir, {});
    queryClient.invalidateQueries({ queryKey: ["project-override", projectDir] });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
          isOverridden
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        {effectiveEngine}/{effectiveModel}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-card p-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">{t("dashboard.engine")}</p>
          {ENGINE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSet(opt.value, undefined)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-secondary"
            >
              {opt.label}
              {effectiveEngine === opt.value && <Check className="h-3 w-3 text-primary" />}
            </button>
          ))}

          <hr className="my-1 border-border" />

          <p className="mb-1 text-[10px] font-medium text-muted-foreground">{t("dashboard.model")}</p>
          {MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSet(undefined, opt.value)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-secondary"
            >
              {opt.label}
              {effectiveModel === opt.value && <Check className="h-3 w-3 text-primary" />}
            </button>
          ))}

          {isOverridden && (
            <>
              <hr className="my-1 border-border" />
              <button
                onClick={handleReset}
                className="w-full rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {t("dashboard.resetToGlobal")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
