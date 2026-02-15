import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { addCustomAgent, updateCustomAgent } from "@/lib/tauri";
import type { AddAgentRequest, AgentLayer, PersonaInfo } from "@/lib/types";
import { AGENT_LAYERS } from "./constants";

export function AddAgentModal({
  onClose,
  editAgent,
}: {
  readonly onClose: () => void;
  readonly editAgent?: PersonaInfo;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const isEditing = editAgent !== undefined;

  const [name, setName] = useState(editAgent?.name ?? "");
  const [role, setRole] = useState(editAgent?.role ?? "");
  const [expertise, setExpertise] = useState(editAgent?.expertise ?? "");
  const [layer, setLayer] = useState<AgentLayer>(
    (editAgent?.tags[0] as AgentLayer) ?? "engineering",
  );
  const [mentalModels, setMentalModels] = useState(
    editAgent?.mental_models.join(", ") ?? "",
  );
  const [coreCapabilities, setCoreCapabilities] = useState(
    editAgent?.core_capabilities.join(", ") ?? "",
  );

  const mutation = useMutation({
    mutationFn: (req: AddAgentRequest) =>
      isEditing
        ? updateCustomAgent(editAgent.id, req)
        : addCustomAgent(req),
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
  }, [name, role, expertise, layer, mentalModels, coreCapabilities, mutation, isEditing, editAgent]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground">
          {isEditing ? t("library.editAgent") : t("library.addAgent")}
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
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.role")}</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.expertise")}</label>
            <input
              type="text"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.layer")}</label>
            <select
              value={layer}
              onChange={(e) => setLayer(e.target.value as AgentLayer)}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">{t("library.coreCapabilities")}</label>
            <input
              type="text"
              value={coreCapabilities}
              onChange={(e) => setCoreCapabilities(e.target.value)}
              placeholder="capability1, capability2"
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
            disabled={mutation.isPending || name.trim() === "" || role.trim() === ""}
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
