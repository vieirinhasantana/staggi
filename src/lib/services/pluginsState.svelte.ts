import { invoke } from "@tauri-apps/api/core";
import type {
  DynamicClientRegistrationResult,
  McpAuthType,
  McpOAuth2Config,
  McpServerItem,
  McpTestResult,
  OAuthDiscoveryResult,
  OAuthTokenResponse,
  SkillDefinition,
} from "$lib/types";
export type {
  DynamicClientRegistrationResult,
  McpAuthType,
  McpOAuth2Config,
  McpServerItem,
  McpTestResult,
  OAuthDiscoveryResult,
  OAuthTokenResponse,
  SkillDefinition,
};

function generateRandomString(length: number = 64): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  if (typeof window !== "undefined" && window.crypto) {
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += charset[Math.floor(Math.random() * charset.length)];
    }
  }
  return result;
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await window.crypto.subtle.digest("SHA-256", data);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createPKCEPair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(64);
  const hash = await sha256(verifier);
  const challenge = base64UrlEncode(hash);
  return { verifier, challenge };
}

export function getSkillSlug(skill: SkillDefinition): string {
  if (skill.slug && skill.slug.trim()) {
    return skill.slug
      .trim()
      .toLowerCase()
      .replace(/^\/+/, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  return skill.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "skill";
}

const MCPS_STORAGE_KEY = "staggi_mcps_config_v1";
const SKILLS_STORAGE_KEY = "staggi_skills_config_v1";

const DEFAULT_MCPS: McpServerItem[] = [
  { 
    id: "mcp-staggi-core", 
    name: "staggi-portfolio", 
    type: "Wealth Management & Advisory Core MCP", 
    transport: "sse (Server-Sent)", 
    endpoint: "http://localhost:8000/sse", 
    active: true, 
    apiKey: "staggi-secret-api-key-2026",
    desc: "Staggi Wealth Core: Clients CRM, Portfolio Analytics, Trade Ideas & Client Communications (Institutional Position Reports & Proposal Dispatch)",
    tools: [
      { name: "generate_portfolio_position_report", description: "Generates the standardized institutional report for client account positions and asset holdings" },
      { name: "send_portfolio_position_report_email", description: "Dispatches the formal account holdings report email to the client in Staggi's institutional standard" },
      { name: "generate_portfolio_rebalance_report", description: "Generates the standardized institutional report for portfolio rebalancing proposals" },
      { name: "send_portfolio_rebalance_proposal_email", description: "Dispatches the formal portfolio rebalancing proposal email to the client in Staggi's institutional standard" },
      { name: "send_portfolio_proposal_email", description: "Generates and dispatches a formal wealth management investment proposal email to a client" },
      { name: "send_automation_report_email", description: "Dispatches a formal wealth management automation report email with the exact institutional styling of trade ideas" },
      { name: "list_trade_ideas", description: "Lists curated wealth management investment recommendations" },
      { name: "list_clients", description: "Queries and filters wealth management client accounts" },
      { name: "get_client_portfolios", description: "Lists all investment portfolios and accounts associated with a client" },
      { name: "get_portfolio_positions", description: "Retrieves active positions and metrics for a portfolio" },
      { name: "get_asset_allocation", description: "Calculates current allocation percentages across asset classes" },
      { name: "get_portfolio_metrics", description: "Calculates Sharpe ratio, volatility, and maximum drawdown" }
    ]
  },
  { 
    id: "mcp-yahoo", 
    name: "mcp-yahoo-finance", 
    type: "Market Data MCP", 
    transport: "builtin (Native MCP)", 
    endpoint: "builtin://yahoo-finance", 
    active: true, 
    desc: "Real-time quotes, multiples (P/E, P/B), volume, historical prices and dividends via MCP",
    tools: [
      { name: "get_stock_quote", description: "Real-time quotes and fundamentals (price, multiples, volume)" },
      { name: "get_historical_dividends", description: "Historical dividend & JCP payments by ticker" },
      { name: "get_market_news", description: "Market news and sentiment analysis" }
    ]
  }
];

const DEFAULT_SKILLS: SkillDefinition[] = [
  {
    id: "skill-pitchbook",
    name: "One-Pager & Pitchbook Institucional",
    slug: "pitchbook",
    mcpDependency: "Yahoo Finance / MCP",
    active: true,
    description: "Estrutura um relatório executivo One-Pager de tese de investimento (Tese Central, Catalisadores, Riscos e Múltiplos) pronto para apresentação ao cliente.",
    systemPrompt: `DIRETIVA DA SKILL /pitchbook — ONE-PAGER INSTITUCIONAL:
Quando o usuário acionar /pitchbook ou solicitar um pitchbook/one-pager para um ativo ou carteira:
1. Estruture a resposta estritamente no padrão executivo de One-Pager de Investment Banking / Wealth Management:
   - **Tese Central de Investimento**: Resumo conciso de 2 a 3 frases explicando por que alocar capital neste ativo.
   - **Vantagens Competitivas & Moat**: Posicionamento de mercado, barreiras de entrada e diferencial do emissor.
   - **Catalisadores de Curto/Médio Prazo**: Gatilhos concretos de valorização (ex: novos projetos, redução de capex, desinvestimentos, proventos extraordinários).
   - **Principais Riscos & Sensibilidade**: Riscos regulatórios, cambiais, de commodities ou de execução operacional.
   - **Métricas de Valuation & Múltiplos**: Tabela concisa com P/L, EV/EBITDA, P/VP, ROE e Dividend Yield atual vs. histórico.
   - **Veredito Fiduciário**: Alocação recomendada (Sobreponderar / Neutro / Subponderar) e perfil de investidor indicado (Conservador, Moderado ou Agressivo).
2. Mantenha linguagem matemática, formal e concisa sem prolixidade.`
  }
];

function loadStoredMcps(): McpServerItem[] {
  if (typeof window === "undefined") return DEFAULT_MCPS;
  try {
    const raw = localStorage.getItem(MCPS_STORAGE_KEY);
    if (raw === null) {
      localStorage.setItem(MCPS_STORAGE_KEY, JSON.stringify(DEFAULT_MCPS));
      return DEFAULT_MCPS;
    }
    const parsed: McpServerItem[] = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const obsoleteIds = new Set([
        "mcp-tax",
        "mcp-financedatabase",
        "mcp-equibles-etf",
        "mcp-bonds",
        "mcp-treasury-yields",
        "mcp-tickerinside",
        "mcp-bloomberg",
        "mcp-investidor10",
        "mcp-custodia",
      ]);
      const obsoleteNames = new Set([
        "mcp-tax-engine",
        "mcp-financedatabase",
        "mcp-equibles-etf-holdings",
        "mcp-bond-intelligence",
        "mcp-treasury-yields",
        "mcp-tickerinside-insider",
        "mcp-bloomberg-terminal",
        "mcp-investidor10",
        "mcp-custodia-offshore",
      ]);

      const filtered = parsed.filter(
        (m) => m && !obsoleteIds.has(m.id) && !obsoleteNames.has(m.name)
      );

      const hasYahoo = filtered.some((m) => m.id === "mcp-yahoo" || m.name === "mcp-yahoo-finance");
      const hasStaggiCore = filtered.some((m) => m.id === "mcp-staggi-core" || m.name === "staggi-portfolio");

      let result = [...filtered];
      if (!hasStaggiCore) {
        result.unshift(DEFAULT_MCPS[0]);
      }
      if (!hasYahoo) {
        result.push(DEFAULT_MCPS[1]);
      }

      const updated = result.map((m) => {
        if (m.id === "mcp-yahoo" || m.name === "mcp-yahoo-finance") {
          return {
            ...m,
            id: "mcp-yahoo",
            name: "mcp-yahoo-finance",
            transport: "builtin (Native MCP)",
            endpoint: "builtin://yahoo-finance",
            tools: DEFAULT_MCPS[1].tools || [],
          };
        }
        if (m.id === "mcp-staggi-core" || m.name === "staggi-portfolio") {
          return {
            ...m,
            id: "mcp-staggi-core",
            name: "staggi-portfolio",
            tools: DEFAULT_MCPS[0].tools || [],
          };
        }
        // Normalize legacy transport: if set to sse but endpoint is not an SSE route, switch to http
        if (m.transport === "sse" && m.endpoint && !m.endpoint.includes("/sse")) {
          return {
            ...m,
            transport: "http",
          };
        }
        return m;
      });

      localStorage.setItem(MCPS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    }
    return DEFAULT_MCPS;
  } catch {
    return DEFAULT_MCPS;
  }
}

function loadStoredSkills(): SkillDefinition[] {
  if (typeof window === "undefined") return DEFAULT_SKILLS;
  try {
    const raw = localStorage.getItem(SKILLS_STORAGE_KEY);
    if (raw === null) {
      localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(DEFAULT_SKILLS));
      return DEFAULT_SKILLS;
    }
    const parsed: SkillDefinition[] = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const obsoleteSkillIds = new Set([
        "skill-vapi-voice",
        "skill-etf-screening",
        "skill-renda-fixa-yield-curve",
        "skill-insider-smart-money",
        "skill-valuation",
        "skill-proventos",
        "skill-report",
        "skill-offshore",
        "skill-bloomberg",
        "skill-investidor10",
      ]);

      const filtered = parsed.filter((s) => s && !obsoleteSkillIds.has(s.id));
      // Ensure default skills (like pitchbook) are present if user doesn't already have them
      const existingIds = new Set(filtered.map(s => s.id));
      const merged = [...filtered];
      for (const def of DEFAULT_SKILLS) {
        if (!existingIds.has(def.id)) {
          merged.push(def);
        }
      }
      localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
    return DEFAULT_SKILLS;
  } catch {
    return DEFAULT_SKILLS;
  }
}

class PluginsStore {
  mcps = $state<McpServerItem[]>(loadStoredMcps());
  skills = $state<SkillDefinition[]>(loadStoredSkills());

  activeMcps = $derived.by(() => this.mcps.filter(m => m.active));
  activeSkills = $derived.by(() => this.skills.filter(s => s.active));
  activeMcpsCount = $derived.by(() => this.mcps.filter(m => m.active).length);
  activeSkillsCount = $derived.by(() => this.skills.filter(s => s.active).length);
  totalSkillsCount = $derived.by(() => this.skills.length);
  totalMcpsCount = $derived.by(() => this.mcps.length);

  reloadFromStorage() {
    this.mcps = loadStoredMcps();
    this.skills = loadStoredSkills();
  }

  saveMcps() {
    if (typeof window !== "undefined") {
      localStorage.setItem(MCPS_STORAGE_KEY, JSON.stringify(this.mcps));
    }
  }

  saveSkills() {
    if (typeof window !== "undefined") {
      localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(this.skills));
    }
  }

  toggleMcp(id: string) {
    this.mcps = this.mcps.map(m => m.id === id ? { ...m, active: !m.active } : m);
    this.saveMcps();
  }

  updateMcp(id: string, updated: Partial<McpServerItem>) {
    this.mcps = this.mcps.map(m => m.id === id ? { ...m, ...updated } : m);
    this.saveMcps();
  }

  async ensureValidAuth(mcp: McpServerItem): Promise<{ token?: string; header?: string }> {
    if (mcp.authType === "oauth2" && mcp.oauth2) {
      const oauth = mcp.oauth2;
      const now = Date.now();
      // Auto-refresh token if it expires in less than 60 seconds
      if (oauth.expiresAt && now >= oauth.expiresAt - 60000 && oauth.refreshToken) {
        try {
          await this.refreshOAuth2Token(mcp.id);
        } catch (e) {
          console.warn("[PluginsStore] Falha ao renovar token OAuth 2.1 automaticamente:", e);
        }
      }
      const updated = this.mcps.find(m => m.id === mcp.id);
      return {
        token: updated?.oauth2?.accessToken || oauth.accessToken,
        header: "Authorization",
      };
    }

    if (mcp.apiKey && mcp.apiKey.trim()) {
      return {
        token: mcp.apiKey.trim(),
        header: mcp.authHeader || "Authorization",
      };
    }

    return { token: undefined, header: mcp.authHeader || "Authorization" };
  }

  async startOAuth2Flow(mcpId: string): Promise<boolean> {
    const mcp = this.mcps.find(m => m.id === mcpId);
    if (!mcp) {
      throw new Error("Servidor MCP não encontrado.");
    }

    const oauth: McpOAuth2Config = { ...(mcp.oauth2 || {}) } as McpOAuth2Config;
    if (!oauth.redirectUri) {
      oauth.redirectUri = "http://127.0.0.1:18420/oauth/callback";
    }

    // Determine base URL / issuer from endpoint
    let baseUrl = oauth.issuerUrl || mcp.endpoint;
    try {
      const u = new URL(mcp.endpoint);
      baseUrl = oauth.issuerUrl || u.origin;
    } catch {}

    // Auto-discover endpoints if authorizationUrl or tokenUrl are missing
    if (!oauth.authorizationUrl || !oauth.tokenUrl) {
      try {
        const disc = await invoke<OAuthDiscoveryResult>("mcp_discover_oauth_endpoints", {
          issuerUrl: baseUrl,
        });
        if (disc.success) {
          if (disc.authorization_endpoint) oauth.authorizationUrl = disc.authorization_endpoint;
          if (disc.token_endpoint) oauth.tokenUrl = disc.token_endpoint;
          if ((!oauth.scopes || oauth.scopes.length === 0) && disc.scopes_supported && disc.scopes_supported.length > 0) {
            oauth.scopes = disc.scopes_supported;
          }
          // If server supports Dynamic Client Registration (RFC 7591) and no clientId is set
          if (disc.registration_endpoint && !oauth.clientId) {
            try {
              const regResult = await invoke<DynamicClientRegistrationResult>("mcp_register_oauth_client", {
                registrationUrl: disc.registration_endpoint,
                clientName: "Staggi Desktop",
                redirectUris: [oauth.redirectUri],
              });
              if (regResult.success && regResult.client_id) {
                oauth.clientId = regResult.client_id;
                if (regResult.client_secret) oauth.clientSecret = regResult.client_secret;
              }
            } catch (e) {
              console.warn("[PluginsStore] Falha no registro dinâmico via RFC 7591:", e);
            }
          }
        }
      } catch (e) {
        console.warn("[PluginsStore] Auto-descoberta OAuth 2.1:", e);
      }
    }

    // Fallbacks if not discovered
    const cleanBase = baseUrl.replace(/\/$/, "");
    if (!oauth.authorizationUrl) {
      oauth.authorizationUrl = `${cleanBase}/authorize`;
    }
    if (!oauth.tokenUrl) {
      oauth.tokenUrl = `${cleanBase}/token`;
    }
    if (!oauth.clientId) {
      // Try direct dynamic registration on /register
      try {
        const regResult = await invoke<DynamicClientRegistrationResult>("mcp_register_oauth_client", {
          registrationUrl: `${cleanBase}/register`,
          clientName: "Staggi Desktop",
          redirectUris: [oauth.redirectUri],
        });
        if (regResult.success && regResult.client_id) {
          oauth.clientId = regResult.client_id;
          if (regResult.client_secret) oauth.clientSecret = regResult.client_secret;
        }
      } catch {}
      if (!oauth.clientId) {
        oauth.clientId = "staggi";
      }
    }

    // Persist discovered config on mcp
    this.updateMcp(mcpId, {
      authType: "oauth2",
      oauth2: { ...oauth },
    });

    const { verifier, challenge } = await createPKCEPair();
    const state = generateRandomString(32);
    const redirectUri = oauth.redirectUri;

    let port = 18420;
    try {
      const u = new URL(redirectUri);
      if (u.port) port = parseInt(u.port, 10);
    } catch {}

    // Store in-flight verifier and state
    this.updateMcp(mcpId, {
      oauth2: {
        ...oauth,
        codeVerifier: verifier,
        state,
      },
    });

    // Form OAuth 2.1 compliant authorization URL with S256 PKCE
    const authUrlObj = new URL(oauth.authorizationUrl);
    authUrlObj.searchParams.set("response_type", "code");
    authUrlObj.searchParams.set("client_id", oauth.clientId);
    authUrlObj.searchParams.set("redirect_uri", redirectUri);
    authUrlObj.searchParams.set("code_challenge", challenge);
    authUrlObj.searchParams.set("code_challenge_method", "S256");
    authUrlObj.searchParams.set("state", state);
    if (oauth.scopes && oauth.scopes.length > 0) {
      authUrlObj.searchParams.set("scope", oauth.scopes.join(" "));
    }

    const fullAuthUrl = authUrlObj.toString();

    // Start background loopback listener in Rust
    const loopbackPromise = invoke<any>("mcp_start_oauth_loopback", {
      port,
      timeoutSecs: 120,
    });

    // Open browser with system opener
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(fullAuthUrl);
    } catch {
      if (typeof window !== "undefined") {
        window.open(fullAuthUrl, "_blank");
      }
    }

    // Wait for the browser redirect callback
    const callbackResult = await loopbackPromise;

    if (!callbackResult.success || !callbackResult.code) {
      const err = callbackResult.error_description || callbackResult.error || "Nenhum código de autorização retornado.";
      throw new Error(err);
    }

    if (callbackResult.state && callbackResult.state !== state) {
      throw new Error("Parâmetro 'state' inválido retornado pelo provedor OAuth (CSRF mismatch).");
    }

    // Exchange authorization code for tokens using PKCE verifier
    const tokenResult = await invoke<OAuthTokenResponse>("mcp_exchange_oauth_code", {
      tokenUrl: oauth.tokenUrl,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret || null,
      code: callbackResult.code,
      redirectUri,
      codeVerifier: verifier,
    });

    if (!tokenResult.success || !tokenResult.access_token) {
      throw new Error(tokenResult.error_description || tokenResult.error || "Falha ao obter tokens.");
    }

    const expiresAt = tokenResult.expires_in
      ? Date.now() + tokenResult.expires_in * 1000
      : undefined;

    this.updateMcp(mcpId, {
      authType: "oauth2",
      oauth2: {
        ...oauth,
        accessToken: tokenResult.access_token,
        refreshToken: tokenResult.refresh_token || oauth.refreshToken,
        tokenType: tokenResult.token_type || "Bearer",
        expiresAt,
        scopeGranted: tokenResult.scope,
        codeVerifier: undefined,
        state: undefined,
      },
    });

    // Test connection immediately to discover tools and confirm authentication
    await this.testMcp(mcpId);
    return true;
  }

  async submitManualOAuth2Code(mcpId: string, codeOrUrl: string): Promise<boolean> {
    const mcp = this.mcps.find(m => m.id === mcpId);
    if (!mcp || !mcp.oauth2) {
      throw new Error("Configuração OAuth 2.1 não encontrada.");
    }

    const oauth = mcp.oauth2;
    let code = codeOrUrl.trim();

    if (code.includes("code=")) {
      try {
        const u = new URL(code.startsWith("http") ? code : `http://localhost/?${code}`);
        code = u.searchParams.get("code") || code;
      } catch {}
    }

    const redirectUri = oauth.redirectUri || "http://localhost:18420/oauth/callback";
    const verifier = oauth.codeVerifier || "";

    const tokenResult = await invoke<OAuthTokenResponse>("mcp_exchange_oauth_code", {
      tokenUrl: oauth.tokenUrl,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret || null,
      code,
      redirectUri,
      codeVerifier: verifier,
    });

    if (!tokenResult.success || !tokenResult.access_token) {
      throw new Error(tokenResult.error_description || tokenResult.error || "Falha ao trocar código de autorização.");
    }

    const expiresAt = tokenResult.expires_in
      ? Date.now() + tokenResult.expires_in * 1000
      : undefined;

    this.updateMcp(mcpId, {
      authType: "oauth2",
      oauth2: {
        ...oauth,
        accessToken: tokenResult.access_token,
        refreshToken: tokenResult.refresh_token || oauth.refreshToken,
        tokenType: tokenResult.token_type || "Bearer",
        expiresAt,
        scopeGranted: tokenResult.scope,
      },
    });

    await this.testMcp(mcpId);
    return true;
  }

  async refreshOAuth2Token(mcpId: string): Promise<boolean> {
    const mcp = this.mcps.find(m => m.id === mcpId);
    if (!mcp || !mcp.oauth2?.refreshToken) {
      throw new Error("Nenhum refresh token disponível para este servidor.");
    }

    const oauth = mcp.oauth2;
    const tokenResult = await invoke<OAuthTokenResponse>("mcp_refresh_oauth_token", {
      tokenUrl: oauth.tokenUrl,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret || null,
      refreshToken: oauth.refreshToken,
    });

    if (!tokenResult.success || !tokenResult.access_token) {
      throw new Error(tokenResult.error_description || tokenResult.error || "Falha ao renovar access token.");
    }

    const expiresAt = tokenResult.expires_in
      ? Date.now() + tokenResult.expires_in * 1000
      : undefined;

    this.updateMcp(mcpId, {
      oauth2: {
        ...oauth,
        accessToken: tokenResult.access_token,
        refreshToken: tokenResult.refresh_token || oauth.refreshToken,
        tokenType: tokenResult.token_type || "Bearer",
        expiresAt,
        scopeGranted: tokenResult.scope || oauth.scopeGranted,
      },
    });

    return true;
  }

  disconnectOAuth2(mcpId: string) {
    const mcp = this.mcps.find(m => m.id === mcpId);
    if (!mcp || !mcp.oauth2) return;
    this.updateMcp(mcpId, {
      oauth2: {
        ...mcp.oauth2,
        accessToken: undefined,
        refreshToken: undefined,
        expiresAt: undefined,
        scopeGranted: undefined,
        codeVerifier: undefined,
        state: undefined,
      },
      lastTestedStatus: "untested",
      lastTestedMessage: "Desconectado do provedor OAuth 2.1.",
    });
  }

  async discoverOAuth2Endpoints(issuerUrl: string): Promise<OAuthDiscoveryResult> {
    return await invoke<OAuthDiscoveryResult>("mcp_discover_oauth_endpoints", {
      issuerUrl: issuerUrl.trim(),
    });
  }

  async testMcp(id: string): Promise<McpTestResult> {
    const mcp = this.mcps.find(m => m.id === id);
    if (!mcp) {
      throw new Error("MCP not found");
    }

    const auth = await this.ensureValidAuth(mcp);

    try {
      let res = await invoke<McpTestResult>("test_mcp_connection", {
        endpoint: mcp.endpoint,
        transport: mcp.transport,
        apiKey: auth.token ? auth.token.trim() : null,
        authHeader: auth.header || "Authorization",
      });

      // If auth_error and OAuth2 refresh token is available, attempt auto-refresh and retry once
      if (res.status === "auth_error" && mcp.authType === "oauth2" && mcp.oauth2?.refreshToken) {
        try {
          await this.refreshOAuth2Token(id);
          const refreshedAuth = await this.ensureValidAuth(mcp);
          res = await invoke<McpTestResult>("test_mcp_connection", {
            endpoint: mcp.endpoint,
            transport: mcp.transport,
            apiKey: refreshedAuth.token ? refreshedAuth.token.trim() : null,
            authHeader: refreshedAuth.header || "Authorization",
          });
        } catch {}
      }

      const testedStatus: McpServerItem["lastTestedStatus"] =
        res.status === "connected" || res.status === "ready"
          ? "connected"
          : res.status === "auth_error"
            ? "auth_error"
            : "unreachable";

      const updatedTools = res.tools && res.tools.length > 0 ? res.tools : (mcp.tools || []);

      this.updateMcp(id, {
        lastTestedStatus: testedStatus,
        lastTestedMessage: res.message,
        tools: updatedTools,
      });

      return res;
    } catch (e: any) {
      const msg = String(e || "Connection failed");
      this.updateMcp(id, {
        lastTestedStatus: "unreachable",
        lastTestedMessage: msg,
      });
      return {
        success: false,
        status: "unreachable",
        message: msg,
        tools: mcp.tools || [],
      };
    }
  }

  async callTool(mcpId: string, toolName: string, args: Record<string, unknown> = {}) {
    const mcp = this.mcps.find(m => m.id === mcpId);
    if (!mcp) throw new Error("MCP server not found");

    const auth = await this.ensureValidAuth(mcp);

    try {
      return await invoke<any>("call_mcp_tool", {
        endpoint: mcp.endpoint,
        transport: mcp.transport,
        toolName,
        arguments: args,
        apiKey: auth.token ? auth.token.trim() : null,
        authHeader: auth.header || "Authorization",
      });
    } catch (err: any) {
      const errMsg = String(err?.message || err || "");
      if (
        (errMsg.includes("401") || errMsg.includes("AUTH_ERROR")) &&
        mcp.authType === "oauth2" &&
        mcp.oauth2?.refreshToken
      ) {
        await this.refreshOAuth2Token(mcpId);
        const refreshedAuth = await this.ensureValidAuth(mcp);
        return await invoke<any>("call_mcp_tool", {
          endpoint: mcp.endpoint,
          transport: mcp.transport,
          toolName,
          arguments: args,
          apiKey: refreshedAuth.token ? refreshedAuth.token.trim() : null,
          authHeader: refreshedAuth.header || "Authorization",
        });
      }
      throw err;
    }
  }

  toggleSkill(id: string) {
    this.skills = this.skills.map(s => s.id === id ? { ...s, active: !s.active } : s);
    this.saveSkills();
  }

  addMcp(mcp: Omit<McpServerItem, "id">): McpServerItem {
    const newItem: McpServerItem = {
      ...mcp,
      id: `mcp-${Date.now()}`
    };
    this.mcps = [...this.mcps, newItem];
    this.saveMcps();
    return newItem;
  }

  importMcpJson(rawJson: string): McpServerItem[] {
    const parsed = JSON.parse(rawJson);
    const added: McpServerItem[] = [];

    const serversObj = parsed.mcpServers || parsed;
    for (const [key, val] of Object.entries(serversObj)) {
      if (typeof val !== "object" || val === null) continue;
      const v = val as any;
      const endpoint = v.url || v.endpoint || "";
      if (!endpoint) continue;

      let apiKey = "";
      let authHeader = "Authorization";
      if (v.headers && typeof v.headers === "object") {
        for (const [hKey, hVal] of Object.entries(v.headers)) {
          if (typeof hVal === "string") {
            authHeader = hKey;
            apiKey = hVal.replace(/^Bearer\s+/i, "");
            break;
          }
        }
      }

      let authType: McpAuthType = apiKey ? "api_key" : "none";
      let oauth2Config: McpOAuth2Config | undefined = undefined;

      const rawOauth = v.oauth2 || v.oauth;
      if (rawOauth && typeof rawOauth === "object") {
        authType = "oauth2";
        oauth2Config = {
          issuerUrl: rawOauth.issuer || rawOauth.issuerUrl,
          authorizationUrl: rawOauth.authorizationUrl || rawOauth.auth_url || rawOauth.authorization_endpoint || "",
          tokenUrl: rawOauth.tokenUrl || rawOauth.token_url || rawOauth.token_endpoint || "",
          clientId: rawOauth.clientId || rawOauth.client_id || "",
          clientSecret: rawOauth.clientSecret || rawOauth.client_secret,
          scopes: Array.isArray(rawOauth.scopes)
            ? rawOauth.scopes
            : typeof rawOauth.scope === "string"
              ? rawOauth.scope.split(" ")
              : [],
          redirectUri: rawOauth.redirectUri || rawOauth.redirect_uri || "http://localhost:18420/oauth/callback",
          accessToken: rawOauth.accessToken || rawOauth.access_token,
          refreshToken: rawOauth.refreshToken || rawOauth.refresh_token,
          expiresAt: rawOauth.expiresAt || rawOauth.expires_at,
        };
      }

      const transport = v.command || v.transport === "stdio"
        ? "stdio"
        : (endpoint.includes("/sse") || v.transport === "sse" ? "sse" : "http");
      const name = key || "mcp-server";

      const existing = this.mcps.find(m => m.name === name || m.endpoint === endpoint);
      if (existing) {
        this.updateMcp(existing.id, {
          name,
          endpoint,
          transport,
          authType: authType !== "none" ? authType : existing.authType,
          apiKey: apiKey || existing.apiKey,
          authHeader: authHeader || existing.authHeader,
          oauth2: oauth2Config || existing.oauth2,
        });
        added.push(existing);
      } else {
        const newItem = this.addMcp({
          name,
          type: "Custom MCP Server",
          transport,
          endpoint,
          active: true,
          desc: `Configured via MCP JSON (${name})`,
          authType,
          apiKey: apiKey || undefined,
          authHeader,
          oauth2: oauth2Config,
        });
        added.push(newItem);
      }
    }
    return added;
  }

  removeMcp(id: string) {
    this.mcps = this.mcps.filter(m => m.id !== id);
    this.saveMcps();
  }

  addSkill(skill: Omit<SkillDefinition, "id">) {
    const cleanSlug = skill.slug && skill.slug.trim()
      ? skill.slug.trim().toLowerCase().replace(/^\/+/, "").replace(/[^a-z0-9_-]+/g, "-")
      : getSkillSlug(skill as SkillDefinition);

    const newItem: SkillDefinition = {
      ...skill,
      slug: cleanSlug,
      id: `skill-${Date.now()}`
    };
    this.skills = [newItem, ...this.skills];
    this.saveSkills();
    return newItem;
  }

  updateSkill(id: string, updated: Partial<SkillDefinition>) {
    this.skills = this.skills.map(s => {
      if (s.id !== id) return s;
      const merged = { ...s, ...updated };
      if (updated.slug !== undefined || updated.name !== undefined) {
        merged.slug = merged.slug && merged.slug.trim()
          ? merged.slug.trim().toLowerCase().replace(/^\/+/, "").replace(/[^a-z0-9_-]+/g, "-")
          : getSkillSlug(merged);
      }
      return merged;
    });
    this.saveSkills();
  }

  removeSkill(id: string) {
    this.skills = this.skills.filter(s => s.id !== id);
    this.saveSkills();
  }

  restoreDefaultSkills() {
    const defaultIds = new Set(DEFAULT_SKILLS.map(d => d.id));
    const userCustomSkills = this.skills.filter(s => !defaultIds.has(s.id));
    this.skills = [...userCustomSkills, ...DEFAULT_SKILLS];
    this.saveSkills();
  }
}

export const pluginsStore = new PluginsStore();
