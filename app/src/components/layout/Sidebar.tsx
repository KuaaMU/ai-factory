import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Plus,
  BookOpen,
  Settings,
  Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/new", icon: Plus, label: "New Project" },
  { to: "/library", icon: BookOpen, label: "Library" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export function Sidebar() {
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
      <div className="border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">AI Factory v0.1.0</p>
      </div>
    </aside>
  );
}
