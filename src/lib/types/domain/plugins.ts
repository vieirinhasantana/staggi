export interface McpServerItem {
  id: string;
  name: string;
  type: string;
  transport: string;
  endpoint: string;
  active: boolean;
  desc: string;
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
