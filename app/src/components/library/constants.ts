import type { AgentLayer } from "@/lib/types";

export const LAYER_COLORS: Record<string, string> = {
  strategy: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  engineering: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  product: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  business: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  intelligence: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
};

export const ROLE_TO_LAYER: Record<string, string> = {
  ceo: "strategy",
  critic: "strategy",
  fullstack: "engineering",
  devops: "engineering",
  qa: "engineering",
  product: "product",
  ui: "product",
  marketing: "business",
  operations: "business",
  sales: "business",
  cfo: "business",
  research: "intelligence",
};

export const SOURCE_COLORS: Record<string, string> = {
  "auto-company": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "real-skills": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  ecc: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  custom: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export const MCP_CATEGORY_COLORS: Record<string, string> = {
  search: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  tools: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  data: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  communication: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export const MCP_CATEGORY_DEFAULT_COLOR =
  "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";

export const AGENT_LAYERS: readonly AgentLayer[] = [
  "strategy",
  "engineering",
  "product",
  "business",
  "intelligence",
];
