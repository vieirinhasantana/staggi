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
    desc: "Streaming de cotações B3/NYSE, dividend yield, múltiplos e fatos relevantes"
  },
  { 
    id: "mcp-tax", 
    name: "mcp-tributario-cfc", 
    type: "Tax Engine MCP", 
    transport: "sse (Server-Sent)", 
    endpoint: "http://localhost:3001/mcp", 
    active: true, 
    desc: "Motor de regras da Lei 14.754/23 e blindagem do US Estate Tax IRS"
  },
  { 
    id: "mcp-financedatabase", 
    name: "mcp-financedatabase", 
    type: "Multi-Asset Screener MCP", 
    transport: "stdio (Python / CLI)", 
    endpoint: "python -m financedatabase_mcp", 
    active: true, 
    desc: "Diretório e screening global com 300k+ ativos (ações, ETFs, fundos, índices, moedas e cripto) categorizados por setor, indústria e país (Jeroen Bouma)"
  },
  { 
    id: "mcp-equibles-etf", 
    name: "mcp-equibles-etf-holdings", 
    type: "ETF Transparency MCP", 
    transport: "sse (HTTP / REST)", 
    endpoint: "https://api.equibles.com/v1/etfs/mcp", 
    active: true, 
    desc: "Composição e transparência de ETFs globais: ponderação de ativos subjacentes, exposição setorial, geográfica e overlap entre fundos"
  },
  { 
    id: "mcp-bonds", 
    name: "mcp-bond-intelligence", 
    type: "Fixed Income & Bonds MCP", 
    transport: "stdio (CLI)", 
    endpoint: "npx -y @mcp/bond-server", 
    active: true, 
    desc: "Precificação e análise de títulos soberanos e corporativos globais: duration modificada, convexidade, yield to maturity (YTM) e rating de crédito"
  },
  { 
    id: "mcp-treasury-yields", 
    name: "mcp-treasury-yields", 
    type: "Macro Sovereign Curve MCP", 
    transport: "sse (Cloudflare Worker)", 
    endpoint: "https://treasury-yields-rates-today-mcp.lipmichal.workers.dev/sse", 
    active: true, 
    desc: "Curva de juros soberana dos EUA em tempo real (1M a 30Y), taxas hoje e spreads críticos de inversão de curva (10Y-2Y)"
  },
  { 
    id: "mcp-tickerinside", 
    name: "mcp-tickerinside-insider", 
    type: "Insider Trading & Smart Money MCP", 
    transport: "sse (HTTP / Agent)", 
    endpoint: "https://api.tickerinside.com/mcp/sse", 
    active: true, 
    desc: "Rastreamento de compras e vendas de executivos (SEC Form 4), movimentações de grandes investidores institucionais (baleias) e sentimento de insiders"
  }
];

const DEFAULT_SKILLS: SkillDefinition[] = [
  { 
    id: "skill-etf-screening", 
    name: "screening-ativos-etf-transparency", 
    slug: "screening",
    description: "Cruza o universo global de ativos (FinanceDatabase) com a transparência de carteira e composição de ETFs (Equibles).", 
    mcpDependency: "mcp-financedatabase, mcp-equibles-etf-holdings, mcp-yahoo-finance",
    systemPrompt: `# Instruções da Skill de Screening Global & Transparência de ETFs
Você é o estrategista de alocação multiativos do Staggi:
1. Para ETFs e Fundos de Índice, consulte o mcp-equibles-etf-holdings para abrir a carteira interna do fundo:
   - Liste as 10 principais posições em carteira com seus respectivos pesos percentuais.
   - Analise concentração setorial e geográfica dos ativos detidos.
   - Identifique sobreposição de carteira (overlap) caso o usuário pergunte sobre combinar mais de um ETF.
2. Para screening de empresas e classificação setorial, utilize o mcp-financedatabase:
   - Filtre ativos por país, setor, indústria, tipo de ativo e valor de mercado.
   - Apresente tabelas limpas e estruturadas em Markdown com as empresas selecionadas.`,
    active: true 
  },
  { 
    id: "skill-renda-fixa-yield-curve", 
    name: "renda-fixa-e-curva-treasuries", 
    slug: "renda-fixa",
    description: "Analisa a curva de juros soberana americana (Treasuries) e precifica títulos corporativos e soberanos (duration e YTM).", 
    mcpDependency: "mcp-treasury-yields, mcp-bond-intelligence",
    systemPrompt: `# Instruções da Skill de Renda Fixa & Curva de Juros
Você é o analista sênior de renda fixa e macroeconomia do Staggi:
1. Consulte o mcp-treasury-yields para obter as taxas atuais da curva de juros soberana dos EUA (1M, 3M, 6M, 1Y, 2Y, 5Y, 10Y, 20Y, 30Y):
   - Calcule o spread crítico 10Y - 2Y para verificar inclinação ou inversão da curva (sinal de alerta recessivo).
   - Defina o patamar de taxa livre de risco (risk-free rate) para valuation e precificação de ativos globais.
2. Consulte o mcp-bond-intelligence para títulos públicos e corporativos:
   - Apresente o Yield to Maturity (YTM), cupom anual e vencimento.
   - Avalie a duration modificada (sensibilidade a variações de juros) e convexidade.
   - Avalie o rating de crédito e spread de crédito em relação à curva de Treasuries.`,
    active: true 
  },
  { 
    id: "skill-insider-smart-money", 
    name: "smart-money-insider-flow", 
    slug: "insider",
    description: "Monitora compras e vendas de diretores e conselheiros (SEC Form 4) e movimentações de grandes baleias institucionais.", 
    mcpDependency: "mcp-tickerinside-insider, mcp-yahoo-finance",
    systemPrompt: `# Instruções da Skill de Insider Trading & Smart Money Flow
Você é o analista de fluxo de capital institucional e governança corporativa do Staggi:
1. Consulte o mcp-tickerinside-insider para auditar as transações declaradas na SEC (Form 4):
   - Identifique se diretores, CEOs, CFOs ou membros do conselho estão comprando ou vendendo ações da própria empresa.
   - Diferencie compras deliberadas em mercado aberto (sinal forte de convicção) de vendas programadas (Rule 10b5-1) ou exercício de opções.
   - Avalie o Insider Sentiment Score e o volume financeiro transacionado.
2. Cruze o sinal dos insiders com a análise de valuation e cotação recente.`,
    active: true 
  },
  { 
    id: "skill-valuation", 
    name: "analise-fundamentalista-mercado", 
    slug: "valuation",
    description: "Audita valuation, ROE, Margem Líquida, Preço Justo de Graham e Bazin via market data e demonstrações contábeis.", 
    mcpDependency: "mcp-yahoo-finance, mcp-financedatabase",
    systemPrompt: `# Instruções da Skill Fundamentalista
Você é o analista fundamentalista sênior do Staggi:
1. Avalie os indicadores fundamentalistas oficiais de empresas e FIIs:
   - Valuation: P/L, P/VP, EV/EBITDA, PSR, Preço Justo de Graham e Preço Teto Bazin (DY 6%).
   - Eficiência & Rentabilidade: ROE, ROIC, Margem Bruta, Margem EBITDA e Margem Líquida.
   - Endividamento: Dívida Líquida/EBITDA (alerta se > 2.5x) e Liquidez Corrente.
   - Histórico de Proventos: Dividend Yield (DY) dos últimos 5 anos e Payout.
2. Analise vantagens competitivas duráveis (Moats) e governança corporativa (Novo Mercado).
3. Produza uma síntese executiva estruturada com Preço Teto, Margem de Segurança e Recomendação de Alocação.`,
    active: true 
  },
  { 
    id: "skill-proventos", 
    name: "analise-proventos-wm", 
    slug: "proventos",
    description: "Projeta dividendos, JCP e calcula o yield on cost líquido de impostos.", 
    mcpDependency: "mcp-yahoo-finance",
    systemPrompt: `# Instruções da Skill de Proventos
Você é o motor de cálculo de renda passiva do Staggi:
1. Consulte o mcp-yahoo-finance para obter as cotações e proventos anunciados (datas-com).
2. Regras de Tributação:
   - Rendimentos de FIIs: Isentos de IRPF para pessoa física.
   - JCP de Ações: Deduzir 15% de IR retido na fonte.
   - Dividendos de Ações BR: Isentos no Brasil.
3. Estruture a resposta com tabelas limpas em Markdown:
   - Tabela de Proventos Recentes: | Tipo (JCP ou Dividendo) | Valor por Ação | Data Ex-Dividendo | Data de Pagamento |
   - Tabela de Histórico Anual de DY: | Ano | Dividendos Totais (R$) | Cotação Média (R$) | DY Anual |`,
    active: true 
  },
  { 
    id: "skill-report", 
    name: "parecer-executivo-gemini", 
    slug: "report",
    description: "Gera parecer consultivo e cálculo de Sharpe consolidado da carteira.", 
    mcpDependency: "mcp-yahoo-finance, mcp-financedatabase",
    systemPrompt: `# Instruções do Parecer Consultivo
Você é um estrategista sênior de wealth management:
1. Avalie o AUM consolidado, a volatilidade dos últimos 12 meses e o Índice Sharpe.
2. Formule 3 recomendações claras de rebalanceamento (Aumentar, Manter, Reduzir).
3. Produza uma síntese executiva pronta para ser enviada por WhatsApp ou e-mail ao cliente.`,
    active: true 
  },
  { 
    id: "skill-offshore", 
    name: "auditoria-us-estate-tax", 
    slug: "offshore",
    description: "Audita exposição direta a US Situs Assets contra o limite de $60.000 do IRS.", 
    mcpDependency: "mcp-tributario-cfc, mcp-financedatabase",
    systemPrompt: `# Instruções de Auditoria Offshore & US Tax
Você é o auditor tributário internacional do Staggi:
1. Identifique ativos US Situs Assets detidos por não residentes fiscais dos EUA.
2. Limite Crítico: USD 60.000 (alíquotas de 18% a 40% sobre o excedente em sucessão).
3. Recomende a alocação através de ETFs UCITS na Irlanda ou via PIC Cayman para neutralizar o imposto sucessório.`,
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
