import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowRight, LayoutDashboard, FolderPlus, BookOpen, Settings as SettingsIcon } from "lucide-react";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./routes/Dashboard";
import { NewProject } from "./routes/NewProject";
import { ProjectDetail } from "./routes/ProjectDetail";
import { Library } from "./routes/Library";
import { Settings } from "./routes/Settings";
import { loadSettings, listProjects } from "./lib/tauri";
import { cn } from "./lib/utils";

const DARK_THEMES = new Set(["obsidian", "cyber", "ember"]);

interface QuickNavItem {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly icon: typeof LayoutDashboard;
  readonly category: "nav" | "project";
}

const NAV_ITEMS: readonly QuickNavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: LayoutDashboard, category: "nav" },
  { id: "new-project", label: "New Project", path: "/new", icon: FolderPlus, category: "nav" },
  { id: "library", label: "Library", path: "/library", icon: BookOpen, category: "nav" },
  { id: "settings", label: "Settings", path: "/settings", icon: SettingsIcon, category: "nav" },
];

function CommandPalette({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: open,
  });

  // Build items list
  const projectItems: readonly QuickNavItem[] = (projects ?? []).map((p) => ({
    id: `project-${p.id}`,
    label: p.name,
    path: `/project/${p.id}`,
    icon: ArrowRight,
    category: "project" as const,
  }));

  const allItems = [...NAV_ITEMS, ...projectItems];

  const filtered = query.trim() === ""
    ? allItems
    : allItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      );

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Small delay to let the DOM render
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (item: QuickNavItem) => {
      navigate(item.path);
      onClose();
    },
    [navigate, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, handleSelect, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and projects..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden rounded border border-border bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[40vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results found
            </p>
          ) : (
            <>
              {/* Navigation section */}
              {filtered.some((i) => i.category === "nav") && (
                <div className="mb-1">
                  <p className="px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
                    Pages
                  </p>
                  {filtered
                    .filter((i) => i.category === "nav")
                    .map((item) => {
                      const globalIdx = filtered.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            globalIdx === selectedIndex
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-accent",
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Projects section */}
              {filtered.some((i) => i.category === "project") && (
                <div>
                  <p className="px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
                    Projects
                  </p>
                  {filtered
                    .filter((i) => i.category === "project")
                    .map((item) => {
                      const globalIdx = filtered.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            globalIdx === selectedIndex
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-accent",
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>
            <kbd className="rounded border border-border bg-secondary px-1 py-0.5">
              &uarr;&darr;
            </kbd>{" "}
            Navigate
          </span>
          <span>
            <kbd className="rounded border border-border bg-secondary px-1 py-0.5">
              Enter
            </kbd>{" "}
            Open
          </span>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: loadSettings,
  });

  // Apply theme globally on app startup and when settings change
  useEffect(() => {
    const theme = settings?.theme ?? "obsidian";
    const el = document.documentElement;
    el.setAttribute("data-theme", theme);
    if (DARK_THEMES.has(theme)) {
      el.classList.add("dark");
    } else {
      el.classList.remove("dark");
    }
  }, [settings]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";

      // Ctrl/Cmd + K: Command palette (works even in editable fields)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Don't trigger other shortcuts in editable fields
      if (isEditable) return;

      // Ctrl/Cmd + ,: Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
        return;
      }

      // Ctrl/Cmd + N: New project
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        navigate("/new");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewProject />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  );
}
