import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { addCustomWorkflow, updateCustomWorkflow } from "@/lib/tauri";
import type { WorkflowInfo } from "@/lib/types";

export function AddWorkflowModal({
  onClose,
  editWorkflow,
}: {
  readonly onClose: () => void;
  readonly editWorkflow?: WorkflowInfo;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const isEditing = editWorkflow !== undefined;

  const [name, setName] = useState(editWorkflow?.name ?? "");
  const [description, setDescription] = useState(editWorkflow?.description ?? "");
  const [chainText, setChainText] = useState(
    editWorkflow?.chain.join(", ") ?? "",
  );
  const [convergenceCycles, setConvergenceCycles] = useState(
    editWorkflow?.convergence_cycles ?? 3,
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        description,
        chain: chainText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        convergence_cycles: convergenceCycles,
      };
      return isEditing
        ? updateCustomWorkflow(editWorkflow.id, payload)
        : addCustomWorkflow(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["custom-workflows"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">
          {isEditing ? t("library.editWorkflow") : t("library.addWorkflow")}
        </h2>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.name")}</label>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Strategic Review"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.description")}</label>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Cross-team strategy alignment"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.agentChain")}</label>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={chainText}
              onChange={(e) => setChainText(e.target.value)}
              placeholder={t("library.chainPlaceholder")}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("library.agentChainHint")}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.convergenceCycles")}</label>
            <input
              type="number"
              min={1}
              max={20}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={convergenceCycles}
              onChange={(e) => setConvergenceCycles(Number(e.target.value) || 3)}
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-500">
            {(mutation.error as Error)?.message ?? "Failed"}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || !chainText.trim() || mutation.isPending}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {mutation.isPending
              ? t("common.loading")
              : isEditing
                ? t("library.update")
                : t("library.create")}
          </button>
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            {t("library.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
