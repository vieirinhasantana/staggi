import { invoke } from "@tauri-apps/api/core";
import type { McpServerItem, McpTestResult, SkillDefinition } from "$lib/types";
export type { McpServerItem, McpTestResult, SkillDefinition };

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
    id: "mcp-yahoo", 
    name: "mcp-yahoo-finance", 
    type: "Market Data MCP", 
    transport: "Rust Native / HTTP", 
    endpoint: "query1.finance.yahoo.com", 
    active: true, 
    desc: "Real-time quotes from Yahoo Finance, multiples (P/E, P/B), volume, and declared dividends"
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
    description: "Forecasts dividend cashflows and calculates net yield on cost.", 
    mcpDependency: "mcp-yahoo-finance",
    systemPrompt: `# Dividend & Yield Cashflow Skill Directives
You are Staggi's passive income analytics engine:
1. Query mcp-yahoo-finance for declared distributions, record dates, and ex-dates.
2. Structure output into structured Markdown tables:
   - Recent Declared Distributions Table: | Type | Amount per Share | Ex-Dividend Date | Payment Date |
   - Historical Annual Yield Table: | Year | Total Dividends | Average Price | Annual DY |`,
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
      return parsed.filter(
        (m) =>
          m &&
          m.id !== "mcp-bloomberg" &&
          m.name !== "mcp-bloomberg-terminal" &&
          m.id !== "mcp-investidor10" &&
          m.name !== "mcp-investidor10" &&
          m.id !== "mcp-custodia" &&
          m.name !== "mcp-custodia-offshore"
      );
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
      return parsed.filter(
        (s) =>
          s &&
          s.id !== "skill-bloomberg" &&
          s.name !== "terminal-bloomberg-intelligence" &&
          s.id !== "skill-investidor10" &&
          s.name !== "analise-fundamentalista-investidor10"
      );
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

  async testMcp(id: string): Promise<McpTestResult> {
    const mcp = this.mcps.find(m => m.id === id);
    if (!mcp) {
      throw new Error("MCP not found");
    }

    try {
      const res = await invoke<McpTestResult>("test_mcp_connection", {
        endpoint: mcp.endpoint,
        transport: mcp.transport,
        apiKey: mcp.apiKey ? mcp.apiKey.trim() : null,
        authHeader: mcp.authHeader || "Authorization",
      });

      const testedStatus: McpServerItem["lastTestedStatus"] =
        res.status === "connected" || res.status === "ready"
          ? "connected"
          : res.status === "auth_error"
            ? "auth_error"
            : "unreachable";

      this.updateMcp(id, {
        lastTestedStatus: testedStatus,
        lastTestedMessage: res.message,
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
      };
    }
  }

  toggleSkill(id: string) {
    this.skills = this.skills.map(s => s.id === id ? { ...s, active: !s.active } : s);
    this.saveSkills();
  }

  addMcp(mcp: Omit<McpServerItem, "id">) {
    const newItem: McpServerItem = {
      ...mcp,
      id: `mcp-${Date.now()}`
    };
    this.mcps = [...this.mcps, newItem];
    this.saveMcps();
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
