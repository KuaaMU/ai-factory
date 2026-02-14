import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Play, Square, Clock } from "lucide-react";
import { listProjects } from "@/lib/tauri";
import type { Project } from "@/lib/types";

function ProjectCard({ project }: { readonly project: Project }) {
  const navigate = useNavigate();

  const statusColor: Record<string, string> = {
    running: "bg-green-500",
    paused: "bg-yellow-500",
    stopped: "bg-gray-400",
    error: "bg-red-500",
    initializing: "bg-blue-500",
  };

  return (
    <button
      onClick={() => navigate(`/project/${project.id}`)}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{project.name}</h3>
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${statusColor[project.status] ?? "bg-gray-400"}`}
        />
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">
        {project.seed_prompt}
      </p>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Play className="h-3 w-3" />
          {project.agent_count} agents
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {project.cycle_count} cycles
        </span>
      </div>
    </button>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your autonomous AI companies
          </p>
        </div>
        <button
          onClick={() => navigate("/new")}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20">
          <Square className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first AI company from a seed prompt
            </p>
          </div>
          <button
            onClick={() => navigate("/new")}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
