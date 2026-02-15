import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { toggleLibraryItem, removeCustomAgent, removeCustomSkill, removeCustomWorkflow } from "@/lib/tauri";

// ===== Toggle Switch =====

export function ToggleSwitch({
  itemType,
  itemId,
  enabled,
  onToggled,
}: {
  readonly itemType: "persona" | "skill" | "workflow";
  readonly itemId: string;
  readonly enabled: boolean;
  readonly onToggled: () => void;
}) {
  const toggleMutation = useMutation({
    mutationFn: () => toggleLibraryItem(itemType, itemId, !enabled),
    onSuccess: onToggled,
  });

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleMutation.mutate();
      }}
      disabled={toggleMutation.isPending}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        enabled ? "bg-green-500" : "bg-gray-600",
        toggleMutation.isPending && "opacity-50",
      )}
      title={enabled ? "Disable" : "Enable"}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

// ===== Delete Button =====

export function DeleteButton({
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

// ===== Workflow Delete Button =====

export function WorkflowDeleteButton({ workflowId }: { readonly workflowId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => removeCustomWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["custom-workflows"] });
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

// ===== Category Filter =====

export function CategoryFilter({
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
