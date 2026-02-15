import { FileText, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { getSkillContent } from "@/lib/tauri";
import type { SkillInfo } from "@/lib/types";
import { SOURCE_COLORS } from "./constants";

export function SkillDetail({ skill, onClose }: {
  readonly skill: SkillInfo;
  readonly onClose: () => void;
}) {
  const { t } = useI18n();

  const { data: fullContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ["skill-content", skill.id],
    queryFn: () => getSkillContent(skill.id),
    enabled: !!skill.file_path,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{skill.name}</h2>
          <span className={cn("rounded-full px-2 py-0.5 text-xs", SOURCE_COLORS[skill.source] ?? SOURCE_COLORS.custom)}>
            {skill.source}
          </span>
        </div>

        <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">{skill.category}</span>

        <p className="mt-3 text-sm text-muted-foreground">{skill.description}</p>

        {skill.file_path && (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">{t("library.fullContent")}</h3>
            {isLoadingContent ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : fullContent ? (
              <pre className="mt-2 max-h-[40vh] overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-foreground/80">
                {fullContent}
              </pre>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground/80">{skill.content_preview}</p>
            )}
          </div>
        )}

        {!skill.file_path && skill.content_preview && (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">{t("library.preview")}</h3>
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
          className="mt-4 w-full rounded-md border border-border py-2 text-sm hover:bg-accent"
        >
          {t("library.close")}
        </button>
      </div>
    </div>
  );
}
