export interface McpTool {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
}

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
  tools?: McpTool[];
  lastTestedStatus?: "connected" | "auth_error" | "unreachable" | "untested";
  lastTestedMessage?: string;
}

export interface McpTestResult {
  success: boolean;
  status: "connected" | "auth_error" | "unreachable" | "ready" | "error" | "http_error";
  status_code?: number;
  message: string;
  latency_ms?: number;
  tools?: McpTool[];
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
