import { invoke } from "@tauri-apps/api/core";
import type {
  McpAuthType,
  McpOAuth2Config,
  McpServerItem,
  McpTestResult,
  OAuthDiscoveryResult,
  OAuthTokenResponse,
  SkillDefinition,
} from "$lib/types";
export type {
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
    desc: "Staggi Wealth Core: Clients CRM, Portfolio Analytics, Trade Ideas & Client Communications (Proposal & Automation Email Dispatch)",
    tools: [
      { name: "send_automation_report_email", description: "Dispatches a formal wealth management automation report email with the exact institutional styling of trade ideas" },
      { name: "send_portfolio_proposal_email", description: "Generates and dispatches a formal wealth management investment proposal email to a client" },
      { name: "list_trade_ideas", description: "Lists curated wealth management investment recommendations" },
      { name: "list_clients", description: "Queries and filters wealth management client accounts" },
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
  },
  { 
    id: "mcp-tax", 
    name: "mcp-tax-engine", 
    type: "Tax Engine MCP", 
    transport: "sse (Server-Sent)", 
    endpoint: "http://localhost:3001/mcp", 
    active: true, 
    desc: "Cross-border tax rules, CFC regulations, and US Estate Tax IRS shielding"
  },
  { 
    id: "mcp-financedatabase", 
    name: "mcp-financedatabase", 
    type: "Multi-Asset Screener MCP", 
    transport: "stdio (Python / CLI)", 
    endpoint: "python -m financedatabase_mcp", 
    active: true, 
    desc: "Global directory and screening with 300k+ assets (equities, ETFs, funds, indices, currencies, crypto) categorized by sector, industry, and country (Jeroen Bouma)"
  },
  { 
    id: "mcp-equibles-etf", 
    name: "mcp-equibles-etf-holdings", 
    type: "ETF Transparency MCP", 
    transport: "sse (HTTP / REST)", 
    endpoint: "https://api.equibles.com/v1/etfs/mcp", 
    active: true, 
    desc: "Global ETF transparency: underlying asset weightings, sector breakdown, geographic exposure, and portfolio overlap analysis"
  },
  { 
    id: "mcp-bonds", 
    name: "mcp-bond-intelligence", 
    type: "Fixed Income & Bonds MCP", 
    transport: "stdio (CLI)", 
    endpoint: "npx -y @mcp/bond-server", 
    active: true, 
    desc: "Global sovereign and corporate bond analytics: modified duration, convexity, yield to maturity (YTM), and credit rating"
  },
  { 
    id: "mcp-treasury-yields", 
    name: "mcp-treasury-yields", 
    type: "Macro Sovereign Curve MCP", 
    transport: "sse (Cloudflare Worker)", 
    endpoint: "https://treasury-yields-rates-today-mcp.lipmichal.workers.dev/sse", 
    active: true, 
    desc: "Real-time US Treasury sovereign yield curve (1M to 30Y), current benchmark rates, and 10Y-2Y yield inversion spreads"
  },
  { 
    id: "mcp-tickerinside", 
    name: "mcp-tickerinside-insider", 
    type: "Insider Trading & Smart Money MCP", 
    transport: "sse (HTTP / Agent)", 
    endpoint: "https://api.tickerinside.com/mcp/sse", 
    active: true, 
    desc: "Executive smart money tracking (SEC Form 4), institutional whale positioning, and insider transaction sentiment"
  }
];

const DEFAULT_SKILLS: SkillDefinition[] = [
  { 
    id: "skill-etf-screening", 
    name: "screening-assets-etf-transparency", 
    slug: "screening",
    description: "Cross-references global asset universe (FinanceDatabase) with ETF portfolio holdings and transparency (Equibles).", 
    mcpDependency: "mcp-financedatabase, mcp-equibles-etf-holdings, mcp-yahoo-finance",
    systemPrompt: `# Global Screening & ETF Transparency Skill Directives
You are Staggi's multi-asset portfolio strategist:
1. For ETFs and Index Funds, query mcp-equibles-etf-holdings to inspect underlying fund holdings:
   - Detail top 10 constituents with corresponding weights.
   - Analyze sector and geographic concentration.
   - Detect fund overlap when comparing multiple ETFs.
2. For corporate screening and sector classification, leverage mcp-financedatabase:
   - Filter assets by country, sector, industry, asset class, and market cap.
   - Provide structured markdown tables with selected companies.`,
    active: true 
  },
  { 
    id: "skill-renda-fixa-yield-curve", 
    name: "fixed-income-treasuries-curve", 
    slug: "fixed-income",
    description: "Analyzes US sovereign yield curves (Treasuries) and prices sovereign/corporate bonds (duration, convexity, YTM).", 
    mcpDependency: "mcp-treasury-yields, mcp-bond-intelligence",
    systemPrompt: `# Fixed Income & Sovereign Yield Curve Skill Directives
You are Staggi's senior macro and fixed income analyst:
1. Query mcp-treasury-yields for current US Treasury curve rates (1M, 3M, 6M, 1Y, 2Y, 5Y, 10Y, 20Y, 30Y):
   - Compute critical 10Y - 2Y slope and curve inversion spread.
   - Determine the risk-free rate benchmark for equity valuation.
2. Query mcp-bond-intelligence for government and corporate debt:
   - Report Yield to Maturity (YTM), annual coupon, and maturity.
   - Evaluate modified duration (interest rate sensitivity) and convexity.
   - Assess credit ratings and credit spreads over benchmark Treasuries.`,
    active: true 
  },
  { 
    id: "skill-insider-smart-money", 
    name: "smart-money-insider-flow", 
    slug: "insider",
    description: "Monitors officer/director buys and sells (SEC Form 4) and institutional whale transactions.", 
    mcpDependency: "mcp-tickerinside-insider, mcp-yahoo-finance",
    systemPrompt: `# Insider Trading & Smart Money Flow Directives
You are Staggi's institutional capital flow and corporate governance analyst:
1. Query mcp-tickerinside-insider to audit SEC Form 4 filings:
   - Identify open-market purchases by C-suite executives and board members.
   - Distinguish discretionary market purchases from routine Rule 10b5-1 selling plans or option exercises.
   - Assess aggregate Insider Sentiment Score and transaction volume.
2. Correlate insider signals with underlying valuation and recent price action.`,
    active: true 
  },
  { 
    id: "skill-valuation", 
    name: "fundamental-valuation-analysis", 
    slug: "valuation",
    description: "Audits valuation multiples, ROE, Net Margin, Graham Intrinsic Value, and Bazin ceiling.", 
    mcpDependency: "mcp-yahoo-finance, mcp-financedatabase",
    systemPrompt: `# Fundamental Valuation Skill Directives
You are Staggi's senior equity research analyst:
1. Evaluate verified financial multiples:
   - Valuation: P/E, P/B, EV/EBITDA, P/S, Graham Intrinsic Formula, and Bazin Ceiling Price (DY 6%).
   - Profitability: ROE, ROIC, Gross Margin, EBITDA Margin, and Net Margin.
   - Leverage: Net Debt/EBITDA and Current Ratio.
   - Dividend Consistency: 5-year average Dividend Yield and Payout Ratio.
2. Assess durable competitive advantages (Economic Moats) and corporate governance quality.
3. Deliver a concise executive synthesis with Ceiling Price, Margin of Safety, and Allocation Stance.`,
    active: true 
  },
  { 
    id: "skill-proventos", 
    name: "dividend-cashflow-analysis", 
    slug: "dividends",
    description: "Forecasts dividend cashflows, filters declared distributions, and calculates yield.", 
    mcpDependency: "mcp-yahoo-finance",
    systemPrompt: `# Dividend & Yield Cashflow Skill Directives
You are Staggi's passive income analytics engine:
1. STRICT TEMPORAL FILTERING:
   - When the user asks for dividends of a specific period (e.g. "desse ano", "deste ano", "somente 2024", "último trimestre"), filter and show ONLY distributions for that exact period.
   - Do NOT output multi-year historical tables unless the user explicitly requested "histórico" or multi-year evolution.
2. Structure output into structured Markdown tables:
   - Declared Distributions Table: | Type | Amount per Share | Ex-Dividend Date | Payment Date |
   - Period Total (R$) and Dividend Yield on current price.
   - Only include a Historical Annual Yield Table (| Year | Total Dividends | Average Price | Annual DY |) if explicitly requested.`,
    active: true 
  },
  { 
    id: "skill-report", 
    name: "executive-wealth-advisory", 
    slug: "report",
    description: "Generates executive wealth advisory opinion and consolidated Sharpe ratio analysis.", 
    mcpDependency: "mcp-yahoo-finance, mcp-financedatabase",
    systemPrompt: `# Executive Advisory Directives
You are Staggi's senior private wealth strategist:
1. Assess consolidated portfolio metrics, 12-month volatility, and Sharpe Ratio.
2. Formulate 3 distinct rebalancing recommendations (Increase, Hold, Reduce).
3. Produce a polished executive briefing suitable for family office or client presentation.`,
    active: true 
  },
  { 
    id: "skill-offshore", 
    name: "offshore-us-estate-tax-audit", 
    slug: "offshore",
    description: "Audits direct US Situs Asset exposure against IRS $60,000 threshold.", 
    mcpDependency: "mcp-tax-engine, mcp-financedatabase",
    systemPrompt: `# Offshore & US Estate Tax Audit Directives
You are Staggi's international wealth structuring auditor:
1. Identify US Situs Assets held by non-US resident aliens.
2. Critical Threshold: USD 60,000 (18% to 40% estate tax rates on excess values upon succession).
3. Recommend optimal structuring via Irish/Luxembourg UCITS ETFs or foreign holding vehicles to eliminate US estate tax liability.`,
    active: true 
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
      const filtered = parsed.filter(
        (m) =>
          m &&
          m.id !== "mcp-bloomberg" &&
          m.name !== "mcp-bloomberg-terminal" &&
          m.id !== "mcp-investidor10" &&
          m.name !== "mcp-investidor10" &&
          m.id !== "mcp-custodia" &&
          m.name !== "mcp-custodia-offshore"
      );
      const updated = filtered.map((m) => {
        if (m.id === "mcp-yahoo") {
          return {
            ...m,
            transport: "builtin (Native MCP)",
            endpoint: "builtin://yahoo-finance",
            tools: m.tools && m.tools.length > 0 ? m.tools : (DEFAULT_MCPS[1].tools || []),
          };
        }
        return m;
      });

      const hasStaggiCore = updated.some((m) => m.id === "mcp-staggi-core" || m.name === "staggi-portfolio");
      if (!hasStaggiCore) {
        return [DEFAULT_MCPS[0], ...updated];
      }
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
      return parsed
        .filter(
          (s) =>
            s &&
            s.id !== "skill-bloomberg" &&
            s.name !== "terminal-bloomberg-intelligence" &&
            s.id !== "skill-investidor10" &&
            s.name !== "analise-fundamentalista-investidor10"
        )
        .map((s) => {
          if (s.id === "skill-proventos") {
            const def = DEFAULT_SKILLS.find((d) => d.id === "skill-proventos");
            if (def && (!s.systemPrompt || s.systemPrompt.includes("Historical Annual Yield Table: | Year | Total Dividends | Average Price | Annual DY |"))) {
              return { ...s, systemPrompt: def.systemPrompt, description: def.description };
            }
          }
          return s;
        });
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
    if (!mcp || !mcp.oauth2) {
      throw new Error("Configuração OAuth 2.1 não encontrada para este servidor.");
    }

    const oauth = mcp.oauth2;
    if (!oauth.authorizationUrl || !oauth.clientId) {
      throw new Error("URL de Autorização e Client ID são obrigatórios para o fluxo OAuth 2.1.");
    }

    const { verifier, challenge } = await createPKCEPair();
    const state = generateRandomString(32);
    const redirectUri = oauth.redirectUri || "http://localhost:18420/oauth/callback";

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

      const transport = endpoint.includes("/sse") || v.transport === "sse" ? "sse" : (v.command ? "stdio" : "sse");
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
