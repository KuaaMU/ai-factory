export const AGENT_PALETTE = [
  { bg: "bg-blue-500/15", border: "border-blue-500/40", text: "text-blue-400", dot: "bg-blue-500", ring: "ring-blue-500/30", hex: "#3b82f6" },
  { bg: "bg-purple-500/15", border: "border-purple-500/40", text: "text-purple-400", dot: "bg-purple-500", ring: "ring-purple-500/30", hex: "#a855f7" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-400", dot: "bg-emerald-500", ring: "ring-emerald-500/30", hex: "#10b981" },
  { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400", dot: "bg-amber-500", ring: "ring-amber-500/30", hex: "#f59e0b" },
  { bg: "bg-rose-500/15", border: "border-rose-500/40", text: "text-rose-400", dot: "bg-rose-500", ring: "ring-rose-500/30", hex: "#f43f5e" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-400", dot: "bg-cyan-500", ring: "ring-cyan-500/30", hex: "#06b6d4" },
  { bg: "bg-indigo-500/15", border: "border-indigo-500/40", text: "text-indigo-400", dot: "bg-indigo-500", ring: "ring-indigo-500/30", hex: "#6366f1" },
  { bg: "bg-orange-500/15", border: "border-orange-500/40", text: "text-orange-400", dot: "bg-orange-500", ring: "ring-orange-500/30", hex: "#f97316" },
  { bg: "bg-teal-500/15", border: "border-teal-500/40", text: "text-teal-400", dot: "bg-teal-500", ring: "ring-teal-500/30", hex: "#14b8a6" },
  { bg: "bg-pink-500/15", border: "border-pink-500/40", text: "text-pink-400", dot: "bg-pink-500", ring: "ring-pink-500/30", hex: "#ec4899" },
  { bg: "bg-lime-500/15", border: "border-lime-500/40", text: "text-lime-400", dot: "bg-lime-500", ring: "ring-lime-500/30", hex: "#84cc16" },
  { bg: "bg-fuchsia-500/15", border: "border-fuchsia-500/40", text: "text-fuchsia-400", dot: "bg-fuchsia-500", ring: "ring-fuchsia-500/30", hex: "#d946ef" },
] as const;

export function getAgentColor(agents: readonly string[], role: string) {
  const idx = agents.indexOf(role);
  return AGENT_PALETTE[(idx >= 0 ? idx : 0) % AGENT_PALETTE.length];
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return dateStr;
  }
}

export const EVENT_COLORS: Record<string, string> = {
  cycle_complete: "text-green-400",
  cycle_error: "text-red-400",
  loop_start: "text-blue-400",
  loop_stop: "text-gray-400",
  consensus_update: "text-amber-400",
  handoff: "text-purple-400",
};

export const EVENT_ICONS: Record<string, string> = {
  cycle_complete: "\u2713",
  cycle_error: "\u2717",
  loop_start: "\u25B6",
  loop_stop: "\u25A0",
  consensus_update: "\u270E",
  handoff: "\u21C4",
};
