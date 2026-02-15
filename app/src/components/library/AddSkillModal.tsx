import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { addCustomSkill, updateCustomSkill } from "@/lib/tauri";
import type { AddSkillRequest, SkillInfo } from "@/lib/types";

export function AddSkillModal({
  onClose,
  editSkill,
}: {
  readonly onClose: () => void;
  readonly editSkill?: SkillInfo;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const isEditing = editSkill !== undefined;

  const [name, setName] = useState(editSkill?.name ?? "");
  const [description, setDescription] = useState(editSkill?.description ?? "");
  const [category, setCategory] = useState(editSkill?.category ?? "");
  const [content, setContent] = useState(editSkill?.content_preview ?? "");

  const mutation = useMutation({
    mutationFn: (req: AddSkillRequest) =>
      isEditing
        ? updateCustomSkill(editSkill.id, req)
        : addCustomSkill(req),
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
  }, [name, description, category, content, mutation, isEditing, editSkill]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground">
          {isEditing ? t("library.editSkill") : t("library.addSkill")}
        </h2>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.description")}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.category")}</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="custom"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.content")}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
            disabled={mutation.isPending || name.trim() === ""}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending
              ? t("common.loading")
              : isEditing
                ? t("library.update")
                : t("library.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
