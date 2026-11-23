import type { MemoryItem, MemoryCategory } from "$lib/types";

const MEMORIES_STORAGE_KEY = "staggi_second_brain_memories_v1";

const DEFAULT_MEMORIES: MemoryItem[] = [
  {
    id: "mem-profile-advisor",
    title: "Mandato & Perfil Fiduciário do Assessor",
    content: "Assessor de investimentos e wealth manager atuando com dever fiduciário estrito. Foco em alocação patrimonial balanceada (B3, Renda Fixa soberana/privada e offshore internacional), preservação de capital real e geração recorrente de proventos.",
    category: "profile",
    tags: ["perfil", "fiduciario", "wealth", "alocacao", "proventos"],
    pinned: true,
    active: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    source: "system"
  },
  {
    id: "mem-rule-irs-estate-tax",
    title: "Regra IRS US Situs Assets (US$ 60k Threshold)",
    content: "Investidores não-residentes fiscais nos EUA (Non-Resident Aliens) possuem isenção de apenas US$ 60.000 para ativos US Situs (ações americanas diretas como AAPL, MSFT e ETFs domiciliados nos EUA como SPY, VOO). Acima desse valor, o US Estate Tax varia de 18% a 40%. Sempre alertar e priorizar alocação via ETFs domiciliados na Irlanda/Luxemburgo (UCITS) para carteiras offshore.",
    category: "rule",
    tags: ["irs", "estate-tax", "offshore", "us-situs", "ucits", "irlanda", "sucessao"],
    pinned: true,
    active: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    source: "system"
  },
  {
    id: "mem-rule-lei-14754",
    title: "Regra Tributária Offshore (Lei 14.754/2023)",
    content: "Aplica alíquota uniforme de 15% de IRPF sobre rendimentos e ganhos de capital no exterior (offshore e entidades controladas), apurada anualmente na Declaração de Ajuste Anual (DAA). Não há mais diferimento fiscal irrestrito para offshores sem tributação periódica.",
    category: "rule",
    tags: ["offshore", "tributacao", "lei-14754", "irpf", "15%", "rendimentos"],
    pinned: false,
    active: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    source: "system"
  },
  {
    id: "mem-thesis-macro-yield",
    title: "Tese Macro: Prêmio de Risco & Renda Fixa Soberana",
    content: "Diante de ciclos de volatilidade e taxas de juros elevadas, manter alocação tática em títulos públicos atrelados à inflação (NTN-B / IPCA+) com vencimento intermediário (2029-2035) para travar juro real atrativo, combinada com LFs/CDBs de liquidez diária para caixa.",
    category: "thesis",
    tags: ["macro", "renda-fixa", "tesouro", "ipca", "ntn-b", "juros", "cdi"],
    pinned: false,
    active: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    source: "system"
  },
  {
    id: "mem-client-sample-silveira",
    title: "Cliente: Família Silveira (Family Office)",
    content: "Patrimônio líquido focado em proventos sustentáveis. Restrição mandatária do conselho familiar: evitar exposição relevante a empresas estatais com risco de governança política (PETR4, BBAS3). Preferência por elétricas privadas, saneamento e exportadoras (ex: EGIE3, CPLE6, SBSP3, WEGE3).",
    category: "client",
    tags: ["cliente", "silveira", "governanca", "estatais", "dividendos", "privadas"],
    pinned: false,
    active: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    source: "user"
  }
];

const STOPWORDS = new Set([
  "de", "a", "o", "que", "e", "do", "da", "em", "um", "para", "com", "nao", "não", "uma", "os", "no", "se", "na",
  "por", "mais", "as", "dos", "como", "mas", "foi", "ao", "ele", "das", "tem", "à", "seu", "sua", "ou", "ser",
  "quando", "muito", "ha", "há", "nos", "ja", "já", "esta", "está", "eu", "tambem", "também", "so", "só", "pelo",
  "pela", "ate", "até", "isso", "ela", "entre", "era", "depois", "sem", "mesmo", "aos", "ter", "seus", "quem",
  "nas", "me", "esse", "eles", "estao", "estão", "voce", "você", "tinha", "foram", "essa", "num", "nem", "suas",
  "meu", "as", "às", "minha", "tem", "têm", "numa", "pelos", "elas", "qual", "quais", "sobre", "qualquer", "onde"
]);

function tokenize(text: string): string[] {
  if (!text) return [];
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, " ");

  const rawTokens = normalized.split(/\s+/).filter(t => t.length > 1);
  const result: string[] = [];

  for (const token of rawTokens) {
    if (!STOPWORDS.has(token)) {
      result.push(token);
    }
  }

  return result;
}

function loadStoredMemories(): MemoryItem[] {
  if (typeof window === "undefined") return DEFAULT_MEMORIES;
  try {
    const raw = localStorage.getItem(MEMORIES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(DEFAULT_MEMORIES));
      return DEFAULT_MEMORIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_MEMORIES;
  } catch {
    return DEFAULT_MEMORIES;
  }
}

class MemoryStore {
  memories = $state<MemoryItem[]>(loadStoredMemories());

  // Inverted token index: token -> Set<memoryId> for sub-millisecond retrieval
  private invertedIndex = new Map<string, Set<string>>();

  constructor() {
    this.rebuildIndex();
  }

  activeMemories = $derived.by(() => this.memories.filter(m => m.active));
  pinnedMemories = $derived.by(() => this.memories.filter(m => m.active && m.pinned));
  totalCount = $derived.by(() => this.memories.length);
  activeCount = $derived.by(() => this.memories.filter(m => m.active).length);
  pinnedCount = $derived.by(() => this.memories.filter(m => m.active && m.pinned).length);

  private rebuildIndex() {
    this.invertedIndex.clear();
    for (const mem of this.memories) {
      if (!mem.active) continue;
      const docTokens = new Set([
        ...tokenize(mem.title),
        ...tokenize(mem.content),
        ...mem.tags.flatMap(t => tokenize(t)),
        mem.category.toLowerCase()
      ]);

      for (const tok of docTokens) {
        let set = this.invertedIndex.get(tok);
        if (!set) {
          set = new Set();
          this.invertedIndex.set(tok, set);
        }
        set.add(mem.id);
      }
    }
  }

  private save() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(this.memories));
      } catch (err) {
        console.error("[MemoryStore] Failed to save memories to localStorage:", err);
      }
    }
    this.rebuildIndex();
  }

  reloadFromStorage() {
    this.memories = loadStoredMemories();
    this.rebuildIndex();
  }

  /**
   * Ultra-fast sub-millisecond memory retrieval based on inverted index and scoring.
   * Execution time typically < 0.2ms.
   */
  retrieveRelevant(query: string, maxItems = 6): MemoryItem[] {
    const queryTokens = tokenize(query);
    const queryLower = query.toLowerCase();

    // Map: memoryId -> score
    const scores = new Map<string, number>();

    // 1. Pinned active memories always get a strong baseline
    for (const pinned of this.pinnedMemories) {
      scores.set(pinned.id, 10);
    }

    // 2. Token scoring via inverted index (O(1) lookups per token)
    for (const tok of queryTokens) {
      const matchIds = this.invertedIndex.get(tok);
      if (matchIds) {
        for (const id of matchIds) {
          const current = scores.get(id) || 0;
          scores.set(id, current + 3);
        }
      }
    }

    // 3. Category & contextual heuristics
    const memMap = new Map(this.memories.map(m => [m.id, m]));
    const isClientQuery = /\b(cliente|clientes|familia|família|investidor|carteira de)\b/i.test(queryLower);
    const isRuleQuery = /\b(regra|regras|lei|tribut|irs|imposto|compliance|situs)\b/i.test(queryLower);
    const isThesisQuery = /\b(tese|teses|macro|juros|alocacao|alocação|cenario|cenário)\b/i.test(queryLower);

    for (const [id, score] of scores.entries()) {
      const mem = memMap.get(id);
      if (!mem || !mem.active) {
        scores.delete(id);
        continue;
      }

      let extra = 0;
      // Tag exact match bonus
      for (const tag of mem.tags) {
        const tagNorm = tag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (queryLower.includes(tagNorm)) {
          extra += 5;
        }
      }

      if (isClientQuery && mem.category === "client") extra += 4;
      if (isRuleQuery && mem.category === "rule") extra += 4;
      if (isThesisQuery && mem.category === "thesis") extra += 4;

      scores.set(id, score + extra);
    }

    // Sort descending by score
    const sorted = Array.from(scores.entries())
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => memMap.get(id)!)
      .filter(Boolean);

    return sorted.slice(0, maxItems);
  }

  addMemory(item: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">): MemoryItem {
    const nowStr = new Date().toISOString().slice(0, 10);
    const newItem: MemoryItem = {
      ...item,
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: nowStr,
      updatedAt: nowStr,
      active: item.active !== undefined ? item.active : true,
      pinned: item.pinned !== undefined ? item.pinned : false,
      tags: Array.isArray(item.tags) ? item.tags.map(t => t.trim().toLowerCase()).filter(Boolean) : []
    };

    this.memories = [newItem, ...this.memories];
    this.save();
    return newItem;
  }

  updateMemory(id: string, updates: Partial<Omit<MemoryItem, "id" | "createdAt">>) {
    const nowStr = new Date().toISOString().slice(0, 10);
    this.memories = this.memories.map(m => {
      if (m.id !== id) return m;
      return {
        ...m,
        ...updates,
        updatedAt: nowStr,
        tags: updates.tags ? updates.tags.map(t => t.trim().toLowerCase()).filter(Boolean) : m.tags
      };
    });
    this.save();
  }

  toggleActive(id: string) {
    this.memories = this.memories.map(m => (m.id === id ? { ...m, active: !m.active } : m));
    this.save();
  }

  togglePinned(id: string) {
    this.memories = this.memories.map(m => (m.id === id ? { ...m, pinned: !m.pinned } : m));
    this.save();
  }

  removeMemory(id: string) {
    this.memories = this.memories.filter(m => m.id !== id);
    this.save();
  }

  resetToDefault() {
    this.memories = DEFAULT_MEMORIES;
    this.save();
  }

  exportJson(): string {
    return JSON.stringify(this.memories, null, 2);
  }

  importJson(rawJson: string): { success: boolean; count: number; error?: string } {
    try {
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        return { success: false, count: 0, error: "Formato inválido: esperado um array de memórias." };
      }
      const valid: MemoryItem[] = parsed.filter(item => item && item.id && item.content && item.category);
      if (valid.length === 0) {
        return { success: false, count: 0, error: "Nenhuma memória válida encontrada no arquivo." };
      }
      this.memories = valid;
      this.save();
      return { success: true, count: valid.length };
    } catch (e: any) {
      return { success: false, count: 0, error: String(e?.message || e) };
    }
  }
}

export const memoryStore = new MemoryStore();
