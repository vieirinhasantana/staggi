export interface McpServerItem {
  id: string;
  name: string;
  type: string;
  transport: string;
  endpoint: string;
  active: boolean;
  desc: string;
  apiKey?: string;
  authHeader?: string;
  lastTestedStatus?: "connected" | "auth_error" | "unreachable" | "untested";
  lastTestedMessage?: string;
}

export interface McpTestResult {
  success: boolean;
  status: "connected" | "auth_error" | "unreachable" | "ready" | "error" | "http_error";
  status_code?: number;
  message: string;
  latency_ms?: number;
}

export interface SkillDefinition {
  id: string;
  name: string;
  slug?: string;
  description: string;
  mcpDependency: string;
  systemPrompt: string;
  active: boolean;
}
