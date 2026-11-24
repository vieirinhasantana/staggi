export interface McpTool {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
}

export type McpAuthType = "none" | "api_key" | "oauth2";

export interface McpOAuth2Config {
  issuerUrl?: string;
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes?: string[];
  redirectUri?: string;

  // In-flight authorization state
  codeVerifier?: string;
  state?: string;

  // Active tokens
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number; // timestamp in ms
  scopeGranted?: string;
}

export interface OAuthDiscoveryResult {
  success: boolean;
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  registration_endpoint?: string;
  revocation_endpoint?: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  error?: string;
}

export interface DynamicClientRegistrationResult {
  success: boolean;
  client_id?: string;
  client_secret?: string;
  error?: string;
}

export interface OAuthTokenResponse {
  success: boolean;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface McpServerItem {
  id: string;
  name: string;
  type: string;
  transport: string;
  endpoint: string;
  active: boolean;
  desc: string;
  authType?: McpAuthType;
  apiKey?: string;
  authHeader?: string;
  oauth2?: McpOAuth2Config;
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
