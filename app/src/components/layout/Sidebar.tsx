import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Plus,
  BookOpen,
  Settings,
  Factory,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function Sidebar() {
  const { t, language, setLanguage } = useI18n();

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: t("sidebar.dashboard") },
    { to: "/new", icon: Plus, label: t("sidebar.newProject") },
    { to: "/library", icon: BookOpen, label: t("sidebar.library") },
    { to: "/settings", icon: Settings, label: t("sidebar.settings") },
  ] as const;

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

      {/* Language toggle + Footer */}
      <div className="border-t px-4 py-3 space-y-2">
        <button
          onClick={() => setLanguage(language === "en" ? "zh" : "en")}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Globe className="h-4 w-4" />
          <span>{language === "en" ? "中文" : "English"}</span>
        </button>
        <p className="text-xs text-muted-foreground">{t("sidebar.version")}</p>
      </div>
    </aside>
  );
}
