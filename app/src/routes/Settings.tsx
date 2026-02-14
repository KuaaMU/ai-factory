import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import {
  loadSettings,
  saveSettings as saveSettingsApi,
  addProvider,
  removeProvider,
} from "@/lib/tauri";
import type { AppSettings, AiProvider } from "@/lib/types";

const PROVIDER_PRESETS: Record<
  string,
  { name: string; api_base_url: string; default_model: string }
> = {
  claude: {
    name: "Anthropic (Claude)",
    api_base_url: "https://api.anthropic.com",
    default_model: "claude-sonnet-4-20250514",
  },
  openai: {
    name: "OpenAI",
    api_base_url: "https://api.openai.com/v1",
    default_model: "gpt-4o",
  },
  openrouter: {
    name: "OpenRouter",
    api_base_url: "https://openrouter.ai/api/v1",
    default_model: "anthropic/claude-sonnet-4-20250514",
  },
  custom: {
    name: "Custom Provider",
    api_base_url: "",
    default_model: "",
  },
};

function ProviderCard({
  provider,
  onRemove,
}: {
  readonly provider: AiProvider;
  readonly onRemove: (id: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="flex items-center gap-4 rounded-md border p-4">
      <div
        className={`h-3 w-3 rounded-full ${provider.enabled ? (provider.is_healthy ? "bg-green-500" : "bg-yellow-500") : "bg-gray-400"}`}
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{provider.name}</p>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
            {provider.provider_type}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Model: {provider.default_model}</span>
          <span>|</span>
          <button
            onClick={() => setShowKey((v) => !v)}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            {showKey ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            {showKey
              ? provider.api_key
              : `${provider.api_key.slice(0, 8)}...`}
          </button>
        </div>
        {provider.last_error && (
          <p className="mt-1 text-xs text-red-500">{provider.last_error}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(provider.id)}
        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function AddProviderForm({
  onAdd,
  isPending,
}: {
  readonly onAdd: (provider: AiProvider) => void;
  readonly isPending: boolean;
}) {
  const [providerType, setProviderType] = useState("claude");
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(
    PROVIDER_PRESETS.claude.api_base_url,
  );
  const [defaultModel, setDefaultModel] = useState(
    PROVIDER_PRESETS.claude.default_model,
  );
  const [name, setName] = useState(PROVIDER_PRESETS.claude.name);

  const handleTypeChange = (type: string) => {
    setProviderType(type);
    const preset = PROVIDER_PRESETS[type];
    if (preset) {
      setName(preset.name);
      setApiBaseUrl(preset.api_base_url);
      setDefaultModel(preset.default_model);
    }
  };

  const handleSubmit = () => {
    if (!apiKey.trim()) return;
    onAdd({
      id: `${providerType}-${Date.now()}`,
      name,
      provider_type: providerType,
      api_key: apiKey,
      api_base_url: apiBaseUrl,
      default_model: defaultModel,
      enabled: true,
      is_healthy: true,
      last_error: null,
    });
    setApiKey("");
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">
            Provider Type
          </label>
          <select
            value={providerType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">
            Display Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">
            API Base URL
          </label>
          <input
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">
            Default Model
          </label>
          <input
            type="text"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={!apiKey.trim() || isPending}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Add Provider
      </button>
    </div>
  );
}

export function Settings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: loadSettings,
  });

  const [engine, setEngine] = useState("claude");
  const [defaultModel, setDefaultModel] = useState("sonnet");
  const [maxDailyBudget, setMaxDailyBudget] = useState("50");
  const [alertAtBudget, setAlertAtBudget] = useState("30");
  const [loopInterval, setLoopInterval] = useState("30");
  const [cycleTimeout, setCycleTimeout] = useState("1800");
  const [projectsDir, setProjectsDir] = useState("");
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load settings into form state
  useEffect(() => {
    if (settings) {
      setEngine(settings.default_engine);
      setDefaultModel(settings.default_model);
      setMaxDailyBudget(String(settings.max_daily_budget));
      setAlertAtBudget(String(settings.alert_at_budget));
      setLoopInterval(String(settings.loop_interval));
      setCycleTimeout(String(settings.cycle_timeout));
      setProjectsDir(settings.projects_dir);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (s: AppSettings) => saveSettingsApi(s),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
  });

  const addProviderMutation = useMutation({
    mutationFn: (provider: AiProvider) => addProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setShowAddProvider(false);
    },
  });

  const removeProviderMutation = useMutation({
    mutationFn: (providerId: string) => removeProvider(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleSave = () => {
    const updated: AppSettings = {
      default_engine: engine,
      default_model: defaultModel,
      max_daily_budget: parseFloat(maxDailyBudget) || 50,
      alert_at_budget: parseFloat(alertAtBudget) || 30,
      loop_interval: parseInt(loopInterval) || 30,
      cycle_timeout: parseInt(cycleTimeout) || 1800,
      projects_dir: projectsDir,
      providers: settings?.providers ?? [],
    };
    saveMutation.mutate(updated);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure AI Factory defaults</p>
      </div>

      {/* AI Providers */}
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">AI Providers</h2>
            <p className="text-sm text-muted-foreground">
              Configure API keys and endpoints for your AI providers
            </p>
          </div>
          <button
            onClick={() => setShowAddProvider((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {showAddProvider && (
          <AddProviderForm
            onAdd={(p) => addProviderMutation.mutate(p)}
            isPending={addProviderMutation.isPending}
          />
        )}

        <div className="space-y-2">
          {settings?.providers && settings.providers.length > 0 ? (
            settings.providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                onRemove={(id) => removeProviderMutation.mutate(id)}
              />
            ))
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              No providers configured. Add one to get started.
            </div>
          )}
        </div>
      </div>

      {/* General Settings */}
      <div className="space-y-6 rounded-lg border bg-card p-6">
        <h2 className="font-semibold">Runtime Defaults</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Engine */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Default Engine
            </label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="claude">Claude Code</option>
              <option value="codex">Codex CLI</option>
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Default Model
            </label>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="opus">Opus (deepest reasoning)</option>
              <option value="sonnet">Sonnet (best coding)</option>
              <option value="haiku">Haiku (fastest)</option>
            </select>
          </div>

          {/* Budget */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Max Daily Budget (USD)
            </label>
            <input
              type="number"
              value={maxDailyBudget}
              onChange={(e) => setMaxDailyBudget(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Alert budget */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Alert At (USD)
            </label>
            <input
              type="number"
              value={alertAtBudget}
              onChange={(e) => setAlertAtBudget(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Loop Interval */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Loop Interval (seconds)
            </label>
            <input
              type="number"
              value={loopInterval}
              onChange={(e) => setLoopInterval(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Cycle Timeout */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Cycle Timeout (seconds)
            </label>
            <input
              type="number"
              value={cycleTimeout}
              onChange={(e) => setCycleTimeout(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Projects dir - full width */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Projects Directory
          </label>
          <input
            type="text"
            value={projectsDir}
            onChange={(e) => setProjectsDir(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveSuccess ? "Saved" : "Save Settings"}
          </button>
          {saveMutation.isError && (
            <span className="text-sm text-destructive">
              Failed to save settings
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
