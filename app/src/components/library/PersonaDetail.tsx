import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { PersonaInfo } from "@/lib/types";
import { LAYER_COLORS, ROLE_TO_LAYER } from "./constants";

export function PersonaDetail({ persona, onClose }: {
  readonly persona: PersonaInfo;
  readonly onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
            {persona.role[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{persona.name}</h2>
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
            <h3 className="text-xs font-medium uppercase text-muted-foreground">{t("library.mentalModels")}</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {persona.mental_models.map((m) => (
                <span key={m} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{m}</span>
              ))}
            </div>
          </div>
        )}

        {persona.core_capabilities.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">{t("library.coreCapabilities")}</h3>
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
              {persona.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{tag}</span>
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
          className="mt-4 w-full rounded-md border border-border py-2 text-sm hover:bg-accent"
        >
          {t("library.close")}
        </button>
      </div>
    </div>
  );
}
