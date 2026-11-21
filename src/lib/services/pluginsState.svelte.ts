import type { McpServerItem, SkillDefinition } from "$lib/types";
export type { McpServerItem, SkillDefinition };

export function getSkillSlug(skill: SkillDefinition): string {
  if (skill.slug) return skill.slug;
  if (skill.id === "skill-valuation" || skill.name.includes("valuation") || skill.name.includes("fundamentalista")) return "valuation";
  if (skill.id === "skill-proventos" || skill.name.includes("proventos") || skill.name.includes("dividendo")) return "proventos";
  if (skill.id === "skill-etf-screening" || skill.name.includes("screening") || skill.name.includes("etf")) return "screening";
  if (skill.id === "skill-renda-fixa-yield-curve" || skill.name.includes("renda-fixa") || skill.name.includes("bond")) return "renda-fixa";
  if (skill.id === "skill-insider-smart-money" || skill.name.includes("insider") || skill.name.includes("smart-money")) return "insider";
  if (skill.id === "skill-report" || skill.name.includes("parecer") || skill.name.includes("report")) return "report";
  if (skill.id === "skill-offshore" || skill.name.includes("offshore") || skill.name.includes("tax")) return "offshore";
  return skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
    if (!raw) return DEFAULT_MCPS;
    const parsed: McpServerItem[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let changed = false;
      let current = parsed.filter(
        (m) =>
          m.id !== "mcp-bloomberg" &&
          m.name !== "mcp-bloomberg-terminal" &&
          m.id !== "mcp-investidor10" &&
          m.name !== "mcp-investidor10" &&
          m.id !== "mcp-custodia" &&
          m.name !== "mcp-custodia-offshore"
      );
      if (current.length !== parsed.length) {
        changed = true;
      }
      for (const def of DEFAULT_MCPS) {
        if (!current.some((m) => m.id === def.id || m.name === def.name)) {
          current.push(def);
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(MCPS_STORAGE_KEY, JSON.stringify(current));
      }
      return current;
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
    if (!raw) return DEFAULT_SKILLS;
    const parsed: SkillDefinition[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let changed = false;
      let current = parsed.filter(
        (s) =>
          s.id !== "skill-bloomberg" &&
          s.name !== "terminal-bloomberg-intelligence" &&
          s.id !== "skill-investidor10" &&
          s.name !== "analise-fundamentalista-investidor10"
      );
      if (current.length !== parsed.length) {
        changed = true;
      }
      for (const s of current) {
        if ("triggers" in s) {
          delete (s as any).triggers;
          changed = true;
        }
      }
      for (const def of DEFAULT_SKILLS) {
        if (!current.some((s) => s.id === def.id || s.name === def.name)) {
          current.push(def);
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(current));
      }
      return current;
    }
    return DEFAULT_SKILLS;
  } catch {
    return DEFAULT_SKILLS;
  }
}

class PluginsStore {
  mcps = $state<McpServerItem[]>(loadStoredMcps());
  skills = $state<SkillDefinition[]>(loadStoredSkills());

  get activeMcps(): McpServerItem[] {
    return this.mcps.filter(m => m.active);
  }

  get activeSkills(): SkillDefinition[] {
    return this.skills.filter(s => s.active);
  }

  get activeMcpsCount(): number {
    return this.mcps.filter(m => m.active).length;
  }

  get activeSkillsCount(): number {
    return this.skills.filter(s => s.active).length;
  }

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
    const newItem: SkillDefinition = {
      ...skill,
      id: `skill-${Date.now()}`
    };
    this.skills = [newItem, ...this.skills];
    this.saveSkills();
  }

  updateSkill(id: string, updated: Partial<SkillDefinition>) {
    this.skills = this.skills.map(s => s.id === id ? { ...s, ...updated } : s);
    this.saveSkills();
  }

  removeSkill(id: string) {
    this.skills = this.skills.filter(s => s.id !== id);
    this.saveSkills();
  }
}

export const pluginsStore = new PluginsStore();
