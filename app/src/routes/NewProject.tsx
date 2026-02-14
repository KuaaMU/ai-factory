import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  FolderOpen,
  AlertCircle,
} from "lucide-react";
import { analyzeSeed, bootstrap, loadSettings, listPersonas } from "@/lib/tauri";
import type { SeedAnalysis, AgentLayer, FactoryConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "Build a time-tracking SaaS for freelancers",
  "Create an AI-powered code review tool",
  "Build a personal finance dashboard",
  "Create a project management tool for remote teams",
] as const;

const STEPS = [
  "Seed Prompt",
  "Analysis",
  "Roles",
  "Configure",
  "Generate",
] as const;

const LAYER_COLORS: Record<AgentLayer, string> = {
  strategy: "border-purple-500 bg-purple-50 dark:bg-purple-950",
  engineering: "border-blue-500 bg-blue-50 dark:bg-blue-950",
  product: "border-green-500 bg-green-50 dark:bg-green-950",
  business: "border-orange-500 bg-orange-50 dark:bg-orange-950",
  intelligence: "border-cyan-500 bg-cyan-50 dark:bg-cyan-950",
};

const ROLE_TO_LAYER: Record<string, AgentLayer> = {
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

export function NewProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [seedPrompt, setSeedPrompt] = useState("");
  const [analysis, setAnalysis] = useState<SeedAnalysis | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<readonly string[]>([]);
  const [outputDir, setOutputDir] = useState("");
  const [generatedConfig, setGeneratedConfig] = useState<FactoryConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: listPersonas,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: loadSettings,
  });

  const analyzeMutation = useMutation({
    mutationFn: (prompt: string) => analyzeSeed(prompt),
    onSuccess: (data) => {
      setAnalysis(data);
      setSelectedRoles(data.suggested_roles);
      setError(null);
      setStep(1);
    },
    onError: (err) => setError(String(err)),
  });

  const bootstrapMutation = useMutation({
    mutationFn: () => bootstrap(seedPrompt, outputDir),
    onSuccess: (config) => {
      setGeneratedConfig(config);
      setError(null);
      setStep(4);
    },
    onError: (err) => setError(String(err)),
  });

  const toggleRole = useCallback(
    (role: string) => {
      setSelectedRoles((prev) =>
        prev.includes(role)
          ? prev.filter((r) => r !== role)
          : [...prev, role],
      );
    },
    [],
  );

  // Auto-populate output dir from settings
  const handleConfigStep = () => {
    if (!outputDir && settings?.projects_dir) {
      const slug = seedPrompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40);
      setOutputDir(`${settings.projects_dir}/${slug}`);
    }
    setStep(3);
  };

  const canProceed =
    step === 0
      ? seedPrompt.trim().length > 10
      : step === 1
        ? analysis !== null
        : step === 2
          ? selectedRoles.length >= 3
          : step === 3
            ? outputDir.trim().length > 0
            : false;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create New AI Company</h1>
        <p className="text-muted-foreground">
          Bootstrap an autonomous company from a single seed prompt
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "border-2 border-primary text-primary"
                    : "border border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden text-sm sm:inline",
                i === step ? "font-medium" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step content */}
      <div className="rounded-lg border bg-card p-6">
        {step === 0 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              What do you want to build?
            </label>
            <textarea
              value={seedPrompt}
              onChange={(e) => setSeedPrompt(e.target.value)}
              placeholder="Describe your product idea in one sentence..."
              className="w-full rounded-md border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              rows={3}
            />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Quick start:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setSeedPrompt(prompt)}
                    className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && analysis && (
          <div className="space-y-4">
            <h3 className="font-medium">Seed Analysis</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Domain</p>
                <p className="font-medium">{analysis.domain}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Audience</p>
                <p className="font-medium">{analysis.audience}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Complexity</p>
                <p className="font-medium capitalize">{analysis.complexity}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Team Size</p>
                <p className="font-medium">{analysis.team_size} agents</p>
              </div>
            </div>
            {analysis.features.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Detected Features
                </p>
                <div className="flex flex-wrap gap-1">
                  {analysis.features.map((f) => (
                    <span
                      key={f}
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Select Team Roles</h3>
              <span className="text-sm text-muted-foreground">
                {selectedRoles.length} selected
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {personas?.map((p) => {
                const isSelected = selectedRoles.includes(p.role);
                const layer = ROLE_TO_LAYER[p.role] ?? "business";
                const layerColor = LAYER_COLORS[layer];
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleRole(p.role)}
                    className={cn(
                      "flex items-start gap-3 rounded-md border-2 p-3 text-left transition-colors",
                      isSelected ? layerColor : "border-transparent bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p.role[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.role}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-medium">Configuration</h3>
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                <FolderOpen className="h-4 w-4" />
                Output Directory
              </label>
              <input
                type="text"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder="F:/ai-factory/projects/my-company"
                className="w-full rounded-md border bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                All project files (agents, consensus, scripts, logs) will be created here
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center gap-4 py-8">
            {bootstrapMutation.isPending ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="font-medium">Creating your AI company...</p>
                <p className="text-sm text-muted-foreground">
                  Generating agents, scripts, consensus, and configuration files
                </p>
              </>
            ) : generatedConfig ? (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="font-medium">Company created successfully!</p>
                <div className="text-center text-sm text-muted-foreground">
                  <p>{generatedConfig.org.agents.length} agents configured</p>
                  <p>{generatedConfig.workflows.length} workflows set up</p>
                  <p>Output: {outputDir}</p>
                </div>
                <button
                  onClick={() => navigate("/")}
                  className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Go to Dashboard
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Sparkles className="h-12 w-12 text-primary" />
                <p className="text-center">
                  Ready to generate your AI company with{" "}
                  <strong>{selectedRoles.length} agents</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  This will create all project files in {outputDir}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => {
            setError(null);
            setStep(Math.max(0, step - 1));
          }}
          disabled={step === 0 || bootstrapMutation.isPending}
          className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        {step < 4 && (
          <button
            onClick={() => {
              setError(null);
              if (step === 0) {
                analyzeMutation.mutate(seedPrompt);
              } else if (step === 2) {
                handleConfigStep();
              } else if (step === 3) {
                bootstrapMutation.mutate();
              } else {
                setStep(step + 1);
              }
            }}
            disabled={!canProceed || analyzeMutation.isPending || bootstrapMutation.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {analyzeMutation.isPending || bootstrapMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step === 3 ? (
              <>
                <Sparkles className="h-4 w-4" />
                Create Company
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
