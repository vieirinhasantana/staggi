export type AIProvider = "gemini" | "openai" | "anthropic";

export type EnforcementLevel = "low" | "medium" | "high";

export interface AIModelOption {
  id: string;
  name: string;
  provider?: AIProvider;
  description?: string;
  supportsTools?: boolean;
  supportsReasoning?: boolean;
  isRecommended?: boolean;
  contextWindow?: string;
}

export interface AIChatMessagePayload {
  role: "user" | "model" | "assistant" | "system";
  content: string;
}
