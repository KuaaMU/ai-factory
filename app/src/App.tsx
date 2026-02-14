import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./routes/Dashboard";
import { NewProject } from "./routes/NewProject";
import { ProjectDetail } from "./routes/ProjectDetail";
import { Library } from "./routes/Library";
import { Settings } from "./routes/Settings";
import { loadSettings } from "./lib/tauri";

const DARK_THEMES = new Set(["obsidian", "cyber", "ember"]);

export function App() {
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

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<NewProject />} />
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/library" element={<Library />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
