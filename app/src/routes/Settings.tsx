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
  Globe,
  Monitor,
  RefreshCw,
  Download,
  CheckCircle,
  XCircle,
  ExternalLink,
  Terminal,
  Search,
  Upload,
  Sparkles,
  Settings2,
  Cpu,
  Palette,
} from "lucide-react";
import {
  loadSettings,
  saveSettings as saveSettingsApi,
  addProvider,
  removeProvider,
  detectProviders,
  exportProviders,
  importProviders,
  detectSystem,
  installTool,
} from "@/lib/tauri";
import { useI18n } from "@/lib/i18n";
import type {
  AppSettings,
  AiProvider,
  ToolInfo,
  DetectedProvider,
} from "@/lib/types";

// ===== Constants =====

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

type SettingsTab = "general" | "providers" | "system";

type ThemeId = "obsidian" | "cyber" | "ember" | "daylight" | "paper" | "lavender";

const DARK_THEMES = new Set<ThemeId>(["obsidian", "cyber", "ember"]);

interface ThemeOption {
  readonly id: ThemeId;
  readonly nameEn: string;
  readonly nameZh: string;
  readonly bgClass: string;
  readonly accentClass: string;
  readonly borderClass: string;
  readonly isDark: boolean;
}

const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: "obsidian",
    nameEn: "Obsidian",
    nameZh: "\u9ed1\u66dc\u77f3",
    bgClass: "bg-zinc-900",
    accentClass: "bg-blue-500",
    borderClass: "border-blue-500",
    isDark: true,
  },
  {
    id: "cyber",
    nameEn: "Cyber",
    nameZh: "\u8d5b\u535a",
    bgClass: "bg-slate-900",
    accentClass: "bg-cyan-400",
    borderClass: "border-cyan-400",
    isDark: true,
  },
  {
    id: "ember",
    nameEn: "Ember",
    nameZh: "\u7425\u73c0",
    bgClass: "bg-stone-900",
    accentClass: "bg-amber-500",
    borderClass: "border-amber-500",
    isDark: true,
  },
  {
    id: "daylight",
    nameEn: "Daylight",
    nameZh: "\u65e5\u5149",
    bgClass: "bg-white",
    accentClass: "bg-blue-600",
    borderClass: "border-blue-600",
    isDark: false,
  },
  {
    id: "paper",
    nameEn: "Paper",
    nameZh: "\u7eb8\u58a8",
    bgClass: "bg-amber-50",
    accentClass: "bg-teal-600",
    borderClass: "border-teal-600",
    isDark: false,
  },
  {
    id: "lavender",
    nameEn: "Lavender",
    nameZh: "\u85b0\u8863\u8349",
    bgClass: "bg-gray-100",
    accentClass: "bg-violet-500",
    borderClass: "border-violet-500",
    isDark: false,
  },
];

// ===== Tab Bar =====

function TabBar({
  activeTab,
  onTabChange,
}: {
  readonly activeTab: SettingsTab;
  readonly onTabChange: (tab: SettingsTab) => void;
}) {
  const { t } = useI18n();

  const tabs: readonly { readonly id: SettingsTab; readonly label: string; readonly icon: React.ReactNode }[] = [
    { id: "general", label: t("settings.tabGeneral"), icon: <Settings2 className="h-4 w-4" /> },
    { id: "providers", label: t("settings.tabProviders"), icon: <Cpu className="h-4 w-4" /> },
    { id: "system", label: t("settings.tabSystem"), icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="flex gap-1 rounded-lg bg-secondary p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ===== Theme Selector =====

function ThemeSelector({
  currentTheme,
  onThemeChange,
}: {
  readonly currentTheme: ThemeId;
  readonly onThemeChange: (theme: ThemeId) => void;
}) {
  const { t, language } = useI18n();

  const darkThemes = THEME_OPTIONS.filter((th) => th.isDark);
  const lightThemes = THEME_OPTIONS.filter((th) => !th.isDark);

  const renderThemeButton = (theme: ThemeOption) => {
    const isSelected = currentTheme === theme.id;
    return (
      <button
        key={theme.id}
        onClick={() => onThemeChange(theme.id)}
        className={`group relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
          isSelected
            ? `${theme.borderClass} bg-card shadow-md`
            : "border-border bg-card hover:border-input"
        }`}
      >
        {/* Theme preview */}
        <div className={`flex h-12 w-full items-center justify-center rounded-md ${theme.bgClass}`}>
          <div className={`h-3 w-3 rounded-full ${theme.accentClass}`} />
        </div>
        {/* Theme name */}
        <span className="text-sm font-medium text-foreground">
          {language === "zh"
            ? `${theme.nameEn} (${theme.nameZh})`
            : theme.nameEn}
        </span>
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute -right-1.5 -top-1.5 rounded-full bg-primary p-0.5">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-semibold">{t("settings.themeLabel")}</h2>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {language === "zh" ? "\u6df1\u8272\u4e3b\u9898" : "Dark"}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {darkThemes.map(renderThemeButton)}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {language === "zh" ? "\u6d45\u8272\u4e3b\u9898" : "Light"}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {lightThemes.map(renderThemeButton)}
        </div>
      </div>
    </div>
  );
}

// ===== Tab 1: General =====

function GeneralTab({
  settings,
}: {
  readonly settings: AppSettings | undefined;
}) {
  const { t, language, setLanguage } = useI18n();
  const queryClient = useQueryClient();

  const [engine, setEngine] = useState("claude");
  const [defaultModel, setDefaultModel] = useState("sonnet");
  const [maxDailyBudget, setMaxDailyBudget] = useState("50");
  const [alertAtBudget, setAlertAtBudget] = useState("30");
  const [loopInterval, setLoopInterval] = useState("30");
  const [cycleTimeout, setCycleTimeout] = useState("1800");
  const [projectsDir, setProjectsDir] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeId>("obsidian");

  useEffect(() => {
    if (settings) {
      setEngine(settings.default_engine);
      setDefaultModel(settings.default_model);
      setMaxDailyBudget(String(settings.max_daily_budget));
      setAlertAtBudget(String(settings.alert_at_budget));
      setLoopInterval(String(settings.loop_interval));
      setCycleTimeout(String(settings.cycle_timeout));
      setProjectsDir(settings.projects_dir);
      const theme = settings.theme as ThemeId | undefined;
      if (theme && THEME_OPTIONS.some((t) => t.id === theme)) {
        setCurrentTheme(theme);
      }
    }
  }, [settings]);

  // Apply theme to document
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", currentTheme);
    if (DARK_THEMES.has(currentTheme)) {
      el.classList.add("dark");
    } else {
      el.classList.remove("dark");
    }
  }, [currentTheme]);

  const saveMutation = useMutation({
    mutationFn: (s: AppSettings) => saveSettingsApi(s),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
  });

  const handleThemeChange = (theme: ThemeId) => {
    setCurrentTheme(theme);
    const el = document.documentElement;
    el.setAttribute("data-theme", theme);
    if (DARK_THEMES.has(theme)) {
      el.classList.add("dark");
    } else {
      el.classList.remove("dark");
    }
    // Persist theme to settings
    if (settings) {
      const updated: AppSettings = {
        ...settings,
        theme,
      };
      saveSettingsApi(updated).then(() => {
        queryClient.invalidateQueries({ queryKey: ["settings"] });
      });
    }
  };

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
      language,
      theme: currentTheme,
      mcp_servers: settings?.mcp_servers ?? [],
      skill_repos: settings?.skill_repos ?? [],
    };
    saveMutation.mutate(updated);
  };

  return (
    <div className="space-y-6">
      {/* Language */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{t("settings.languageLabel")}</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setLanguage("en")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              language === "en"
                ? "bg-primary text-primary-foreground"
                : "border border-input hover:bg-secondary"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage("zh")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              language === "zh"
                ? "bg-primary text-primary-foreground"
                : "border border-input hover:bg-secondary"
            }`}
          >
            中文
          </button>
        </div>
      </div>

      {/* Theme */}
      <ThemeSelector
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
      />

      {/* Runtime Defaults */}
      <div className="space-y-6 rounded-lg border border-border bg-card p-6">
        <h2 className="font-semibold">{t("settings.runtimeDefaults")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.defaultEngine")}
            </label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="claude">Claude Code</option>
              <option value="codex">Codex CLI</option>
              <option value="opencode">OpenCode</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.model")}
            </label>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="opus">Opus (deepest reasoning)</option>
              <option value="sonnet">Sonnet (best coding)</option>
              <option value="haiku">Haiku (fastest)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.maxDailyBudget")}
            </label>
            <input
              type="number"
              value={maxDailyBudget}
              onChange={(e) => setMaxDailyBudget(e.target.value)}
              className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.alertAt")}
            </label>
            <input
              type="number"
              value={alertAtBudget}
              onChange={(e) => setAlertAtBudget(e.target.value)}
              className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.loopInterval")}
            </label>
            <input
              type="number"
              value={loopInterval}
              onChange={(e) => setLoopInterval(e.target.value)}
              className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("settings.cycleTimeout")}
            </label>
            <input
              type="number"
              value={cycleTimeout}
              onChange={(e) => setCycleTimeout(e.target.value)}
              className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            {t("settings.projectsDir")}
          </label>
          <input
            type="text"
            value={projectsDir}
            onChange={(e) => setProjectsDir(e.target.value)}
            className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
            {saveSuccess ? t("common.saved") : t("settings.saveSettings")}
          </button>
          {saveMutation.isError && (
            <span className="text-sm text-destructive">
              {t("settings.saveFailed")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Tab 2: AI Providers =====

function QuickSetupPanel({
  onImport,
  isImporting,
}: {
  readonly onImport: (provider: AiProvider) => void;
  readonly isImporting: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [detected, setDetected] = useState<readonly DetectedProvider[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [hasDetected, setHasDetected] = useState(false);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());
  const [showExportImport, setShowExportImport] = useState(false);
  const [importJson, setImportJson] = useState("");

  const handleDetect = async () => {
    setIsDetecting(true);
    try {
      const result = await detectProviders();
      setDetected(result);
      setHasDetected(true);
    } catch {
      setDetected([]);
      setHasDetected(true);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleImportOne = (dp: DetectedProvider) => {
    const provider: AiProvider = {
      id: `${dp.provider_type}-${Date.now()}`,
      name: dp.suggested_name,
      provider_type: dp.provider_type,
      api_key: dp.api_key,
      api_base_url: dp.api_base_url,
      default_model: dp.suggested_model,
      enabled: true,
      is_healthy: true,
      last_error: null,
    };
    onImport(provider);
    setImportedKeys((prev) => new Set([...prev, dp.api_key]));
  };

  const handleImportAll = () => {
    for (const dp of detected) {
      if (!importedKeys.has(dp.api_key)) {
        handleImportOne(dp);
      }
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportProviders([]);
      await navigator.clipboard.writeText(json);
    } catch {
      // Fallback: silent
    }
  };

  const handleImportJson = async () => {
    if (!importJson.trim()) return;
    try {
      await importProviders(importJson);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setImportJson("");
      setShowExportImport(false);
    } catch {
      // Error handled by UI
    }
  };

  const sourceIcon = (source: string) => {
    if (source.startsWith("env:")) return "ENV";
    if (source.includes("claude")) return "CC";
    if (source.includes("codex")) return "CDX";
    return "CFG";
  };

  const sourceColor = (source: string) => {
    if (source.startsWith("env:"))
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (source.includes("claude"))
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    if (source.includes("codex"))
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">{t("settings.quickSetup")}</p>
            <p className="text-xs text-muted-foreground">
              {t("settings.quickSetupDesc")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportImport((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary"
          >
            <Upload className="h-3 w-3" />
            {t("settings.importJson")}
          </button>
          <button
            onClick={handleDetect}
            disabled={isDetecting}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isDetecting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            {isDetecting
              ? t("settings.detecting")
              : t("settings.detectProviders")}
          </button>
        </div>
      </div>

      {showExportImport && (
        <div className="space-y-2 rounded-md border border-input bg-secondary p-3">
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"id":"...", "name":"...", "provider_type":"...", "api_key":"...", ...}]'
            className="h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleImportJson}
              disabled={!importJson.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Download className="h-3 w-3" />
              {t("settings.importJson")}
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1 text-xs hover:bg-secondary"
            >
              <Upload className="h-3 w-3" />
              {t("settings.exportProviders")}
            </button>
          </div>
        </div>
      )}

      {hasDetected && detected.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {t("settings.noDetected")}
        </p>
      )}

      {detected.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <button
              onClick={handleImportAll}
              disabled={isImporting}
              className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary"
            >
              <Plus className="h-3 w-3" />
              {t("settings.importAll")}
            </button>
          </div>
          {detected.map((dp, idx) => {
            const isImported = importedKeys.has(dp.api_key);
            return (
              <div
                key={`${dp.source}-${idx}`}
                className="flex items-center gap-3 rounded-md border border-input bg-secondary p-3"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${sourceColor(dp.source)}`}
                >
                  {sourceIcon(dp.source)}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{dp.suggested_name}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {dp.provider_type}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{dp.api_key_preview}</span>
                    <span>|</span>
                    <span>{dp.suggested_model}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    {dp.source}
                  </p>
                </div>
                <button
                  onClick={() => handleImportOne(dp)}
                  disabled={isImported || isImporting}
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                    isImported
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  } disabled:opacity-70`}
                >
                  {isImported ? (
                    <>
                      <Check className="h-3 w-3" />
                      {t("settings.imported")}
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      {t("settings.importProvider")}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  onRemove,
}: {
  readonly provider: AiProvider;
  readonly onRemove: (id: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="flex items-center gap-4 rounded-md border border-input bg-secondary p-4">
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
  const { t } = useI18n();
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
    <div className="space-y-3 rounded-md border border-dashed border-input p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">
            {t("settings.providerType")}
          </label>
          <select
            value={providerType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
            {t("settings.displayName")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">
          {t("settings.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">
            {t("settings.apiBaseUrl")}
          </label>
          <input
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">
            {t("settings.defaultModel")}
          </label>
          <input
            type="text"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
        {t("settings.addProvider")}
      </button>
    </div>
  );
}

function ProvidersTab({
  settings,
}: {
  readonly settings: AppSettings | undefined;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [showAddProvider, setShowAddProvider] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Quick Setup */}
      <QuickSetupPanel
        onImport={(p) => addProviderMutation.mutate(p)}
        isImporting={addProviderMutation.isPending}
      />

      {/* Provider List */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{t("settings.aiProviders")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("settings.aiProvidersDesc")}
            </p>
          </div>
          <button
            onClick={() => setShowAddProvider((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-secondary"
          >
            <Plus className="h-4 w-4" />
            {t("common.add")}
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
            <div className="flex items-center gap-2 rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              {t("settings.noProviders")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Tab 3: System =====

function ToolRow({
  tool,
  isInstalling,
  installResult,
  hasNpm,
  onInstall,
}: {
  readonly tool: ToolInfo;
  readonly isInstalling: boolean;
  readonly installResult: {
    success: boolean;
    message: string;
  } | null;
  readonly hasNpm: boolean;
  readonly onInstall: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-3 rounded-md border border-input bg-secondary p-3">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
          tool.available
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {tool.available ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{tool.display_name}</span>
          {tool.available && tool.version && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
              v{tool.version}
            </span>
          )}
        </div>
        {tool.available && tool.path && (
          <p className="text-xs text-muted-foreground">{tool.path}</p>
        )}
        {!tool.available && (
          <p className="text-xs text-muted-foreground">
            {tool.install_command}
          </p>
        )}
        {installResult && (
          <p
            className={`mt-1 text-xs ${installResult.success ? "text-green-600" : "text-red-500"}`}
          >
            {installResult.success
              ? t("system.installSuccess")
              : installResult.message}
          </p>
        )}
      </div>
      {!tool.available && (
        <div className="flex items-center gap-2">
          <a
            href={tool.install_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary"
          >
            <ExternalLink className="h-3 w-3" />
            {t("system.installGuide")}
          </a>
          {hasNpm && tool.install_command.startsWith("npm") && (
            <button
              onClick={onInstall}
              disabled={isInstalling}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isInstalling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {isInstalling ? t("system.installing") : t("system.install")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SystemTab() {
  const { t } = useI18n();
  const [installingTool, setInstallingTool] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<{
    tool: string;
    success: boolean;
    message: string;
  } | null>(null);

  const {
    data: systemInfo,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["system-info"],
    queryFn: detectSystem,
    enabled: false,
    staleTime: Infinity,
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleInstall = async (tool: ToolInfo) => {
    setInstallingTool(tool.name);
    setInstallResult(null);
    try {
      const result = await installTool(tool.name);
      setInstallResult({ tool: tool.name, success: true, message: result });
      refetch();
    } catch (err) {
      setInstallResult({
        tool: tool.name,
        success: false,
        message: String(err),
      });
    } finally {
      setInstallingTool(null);
    }
  };

  if (isLoading || isRefetching) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{t("system.title")}</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">
            {t("system.refreshing")}
          </span>
        </div>
      </div>
    );
  }

  if (!systemInfo) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">{t("system.title")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("system.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-secondary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("system.refresh")}
          </button>
        </div>
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("system.clickRefresh")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">{t("system.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("system.subtitle")}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefetching}
          className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`}
          />
          {t("system.refresh")}
        </button>
      </div>

      {/* System Info Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-input bg-secondary p-3">
          <p className="text-xs text-muted-foreground">{t("system.os")}</p>
          <p className="font-medium capitalize">{systemInfo.os}</p>
        </div>
        <div className="rounded-md border border-input bg-secondary p-3">
          <p className="text-xs text-muted-foreground">{t("system.arch")}</p>
          <p className="font-medium">{systemInfo.arch}</p>
        </div>
        <div className="rounded-md border border-input bg-secondary p-3">
          <p className="text-xs text-muted-foreground">
            {t("system.nodeVersion")}
          </p>
          <p className="font-medium">
            {systemInfo.node_version ?? (
              <span className="text-red-500">{t("system.notFound")}</span>
            )}
          </p>
        </div>
        <div className="rounded-md border border-input bg-secondary p-3">
          <p className="text-xs text-muted-foreground">
            {t("system.npmVersion")}
          </p>
          <p className="font-medium">
            {systemInfo.npm_version ?? (
              <span className="text-red-500">{t("system.notFound")}</span>
            )}
          </p>
        </div>
      </div>

      {/* Shells */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{t("system.shells")}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {systemInfo.shells.map((shell) => (
            <div
              key={shell.name}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                shell.available
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {shell.available ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {shell.name}
              {shell.version && (
                <span className="opacity-70">
                  {shell.version.slice(0, 20)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CLI Tools */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-medium">{t("system.cliTools")}</h3>
        </div>
        <div className="space-y-2">
          {systemInfo.tools.map((tool) => (
            <ToolRow
              key={tool.name}
              tool={tool}
              isInstalling={installingTool === tool.name}
              installResult={
                installResult?.tool === tool.name ? installResult : null
              }
              hasNpm={systemInfo.npm_version !== null}
              onInstall={() => handleInstall(tool)}
            />
          ))}
        </div>
      </div>

      {/* Node.js warning */}
      {!systemInfo.node_version && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{t("system.noNode")}</span>
          <a
            href="https://nodejs.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 font-medium underline"
          >
            nodejs.org
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// ===== Main Settings Page =====

export function Settings() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: loadSettings,
  });

  // Initialize theme from settings on load
  useEffect(() => {
    const theme = (settings?.theme ?? "obsidian") as ThemeId;
    const el = document.documentElement;
    el.setAttribute("data-theme", theme);
    if (DARK_THEMES.has(theme)) {
      el.classList.add("dark");
    } else {
      el.classList.remove("dark");
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "general" && <GeneralTab settings={settings} />}
      {activeTab === "providers" && <ProvidersTab settings={settings} />}
      {activeTab === "system" && <SystemTab />}
    </div>
  );
}
