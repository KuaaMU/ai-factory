import { useState } from "react";
import { Save } from "lucide-react";

export function Settings() {
  const [engine, setEngine] = useState("claude");
  const [defaultModel, setDefaultModel] = useState("sonnet");
  const [maxDailyBudget, setMaxDailyBudget] = useState("50");
  const [loopInterval, setLoopInterval] = useState("30");
  const [outputBase, setOutputBase] = useState("F:/ai-factory/projects");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure AI Factory defaults</p>
      </div>

      <div className="space-y-6 rounded-lg border bg-card p-6">
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

        {/* Output base dir */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Projects Directory
          </label>
          <input
            type="text"
            value={outputBase}
            onChange={(e) => setOutputBase(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Save className="h-4 w-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
}
