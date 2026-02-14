import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Plus,
  BookOpen,
  Settings,
  Factory,
  Globe,
  Github,
  RefreshCw,
  Download,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { check } from "@tauri-apps/plugin-updater";
import { open } from "@tauri-apps/plugin-shell";

type UpdateState = "idle" | "checking" | "available" | "upToDate" | "error";

export function Sidebar() {
  const { t, language, setLanguage } = useI18n();
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateVersion, setUpdateVersion] = useState<string>("");

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: t("sidebar.dashboard") },
    { to: "/new", icon: Plus, label: t("sidebar.newProject") },
    { to: "/library", icon: BookOpen, label: t("sidebar.library") },
    { to: "/settings", icon: Settings, label: t("sidebar.settings") },
  ] as const;

  const handleCheckUpdate = async () => {
    setUpdateState("checking");
    try {
      const update = await check();
      if (update) {
        setUpdateState("available");
        setUpdateVersion(update.version);
      } else {
        setUpdateState("upToDate");
        setTimeout(() => setUpdateState("idle"), 3000);
      }
    } catch {
      setUpdateState("error");
      setTimeout(() => setUpdateState("idle"), 3000);
    }
  };

  const handleDownloadUpdate = () => {
    open(`https://github.com/KuaaMU/ai-factory/releases/tag/v${updateVersion}`);
  };

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <Factory className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">AI Factory</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t px-4 py-3 space-y-2">
        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === "en" ? "zh" : "en")}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Globe className="h-4 w-4" />
          <span>{language === "en" ? "中文" : "English"}</span>
        </button>

        {/* GitHub link */}
        <button
          onClick={() => open("https://github.com/KuaaMU/ai-factory")}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Github className="h-4 w-4" />
          <span>GitHub</span>
        </button>

        {/* Check for updates */}
        <button
          onClick={updateState === "available" ? handleDownloadUpdate : handleCheckUpdate}
          disabled={updateState === "checking"}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            updateState === "available"
              ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {updateState === "checking" ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : updateState === "available" ? (
            <Download className="h-4 w-4" />
          ) : updateState === "upToDate" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span>
            {updateState === "checking"
              ? t("sidebar.checking")
              : updateState === "available"
                ? `${t("sidebar.updateAvailable")} v${updateVersion}`
                : updateState === "upToDate"
                  ? t("sidebar.upToDate")
                  : t("sidebar.checkUpdate")}
          </span>
        </button>

        <p className="text-xs text-muted-foreground">{t("sidebar.version")}</p>
      </div>
    </aside>
  );
}
