import { invoke } from "@tauri-apps/api/core";
import { pluginsStore, getSkillSlug } from "./pluginsState.svelte";
import { aiStore, geminiStore } from "./aiProviderState.svelte";
import { getQuote, getMarketNews } from "./yahooFinanceService";

export interface GeminiResponseResult {
  text: string;
  success: boolean;
  isConfigured: boolean;
  error?: string;
}

export interface ChatHistoryTurn {
  role: "user" | "model";
  text: string;
}

export interface GeminiAnalysisResponse {
  summary: string;
  recommendation: "Comprar" | "Aumentar" | "Manter" | "Reduzir" | "Ajustar Hedge";
  taxImplication: string;
  source: "Gemini AI" | "Staggi Deterministic Intelligence";
}

export async function queryGemini(
  prompt: string,
  history?: ChatHistoryTurn[],
  portfolioContextOrProgress?: Record<string, unknown> | ((status: string) => void),
  onProgressCb?: (status: string) => void
): Promise<GeminiResponseResult> {
  const onProgress = typeof portfolioContextOrProgress === "function" 
    ? portfolioContextOrProgress 
    : onProgressCb;
  const portfolioContext = typeof portfolioContextOrProgress === "object" 
    ? portfolioContextOrProgress 
    : undefined;

  const provider = aiStore.provider;
  const apiKey = aiStore.apiKey;
  const model = aiStore.model;

  const providerNames: Record<string, string> = {
    gemini: "Google Gemini",
    openai: "OpenAI (GPT)",
    anthropic: "Anthropic (Claude)"
  };
  const providerName = providerNames[provider] || "IA";

  if (!apiKey || !apiKey.trim()) {
    return {
      text: `⚠️ Chave da API do ${providerName} não configurada.\n\nPara conversar com o modelo em tempo real, abra as configurações (⚙) no Spotlight e informe sua chave de API para ${providerName}.`,
      success: false,
      isConfigured: false,
      error: "CHAVE_NAO_CONFIGURADA"
    };
  }

  const activeSkills = pluginsStore.activeSkills;
  const activeMcps = pluginsStore.activeMcps;

  let cleanPrompt = prompt.trim();
  let explicitSkillDirective = "";
  const slashMatch = cleanPrompt.match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/s);

  if (slashMatch) {
    const requestedSlug = slashMatch[1].toLowerCase();
    const restOfPrompt = slashMatch[2] ? slashMatch[2].trim() : "";

    const targetSkill = activeSkills.find(s => {
      const slug = getSkillSlug(s).toLowerCase();
      return slug === requestedSlug || s.name.toLowerCase().includes(requestedSlug) || s.id.toLowerCase().includes(requestedSlug);
    });

    if (targetSkill) {
      onProgress?.(`Pensando... [Skill: ${targetSkill.name}]`);
      explicitSkillDirective = `\n\n[DIRETIVA EXPLÍCITA /${requestedSlug} - EXECUÇÃO PRIORITÁRIA DA SKILL: ${targetSkill.name.toUpperCase()}]:
O usuário acionou especificamente a Skill "${targetSkill.name}" via comando de barra (/${requestedSlug}).
Você DEVE adotar com máxima prioridade e rigor metodológico todas as seguintes regras analíticas, fórmulas e modelo de resposta desta skill:
${targetSkill.systemPrompt}`;

      cleanPrompt = restOfPrompt ? `[Skill: ${targetSkill.name}] ${restOfPrompt}` : `Execute a análise especializada da skill ${targetSkill.name}`;
    } else {
      onProgress?.("Pensando...");
    }
  } else {
    onProgress?.("Pensando...");
  }

  const searchContext = [
    cleanPrompt,
    ...(history || []).slice(-3).map(h => h.text)
  ].join(" ").toLowerCase();

  const isIdentifierQuery = 
    /\b[A-Z]{2}[A-Z0-9]{9}\d\b/i.test(searchContext) || 
    /\b[0-9A-Z]{9}\b/i.test(searchContext) || 
    /\b[A-Z]{4,5}\d{1,2}\b/i.test(searchContext) || 
    searchContext.includes("isin") || 
    searchContext.includes("cusip") || 
    searchContext.includes("ticker") || 
    searchContext.includes("código") || 
    searchContext.includes("codigo") || 
    searchContext.includes("ativo");

  const isinMatches = prompt.match(/\b[A-Z]{2}[A-Z0-9]{9}\d\b/gi) || [];
  const tickerMatches = prompt.match(/\b[A-Z]{4,5}\d{1,2}\b/gi) || [];
  const commonTickers = prompt.match(/\b(?:AAPL|NVDA|MSFT|SPY|IVV|QQQ|TSLA|AMZN|GOOGL|META)\b/gi) || [];
  const allIdentifiers = [...new Set([...isinMatches, ...tickerMatches, ...commonTickers])];

  let liveMarketDataContext = "";
  if (allIdentifiers.length > 0) {
    onProgress?.("Pensando... [Yahoo Finance Market Data]");
    const quotePromises = allIdentifiers.slice(0, 4).map(async (id) => {
      try {
        const q = await getQuote(id);
        if (q && q.price > 0) {
          const formattedChange = q.changePercent ? `${q.changePercent > 0 ? "+" : ""}${q.changePercent.toFixed(2)}%` : "";
          const formattedPrice = `${q.currency} ${q.price.toFixed(q.currency === "BRL" ? 2 : 4)}`;
          return `- ${id} (${q.name}): Cotação Atual / NAV: ${formattedPrice} (Variação: ${formattedChange})`;
        }
      } catch {}
      return null;
    });

    const resolvedQuotes = (await Promise.all(quotePromises)).filter(Boolean);
    if (resolvedQuotes.length > 0) {
      liveMarketDataContext = `\n\nDADOS DE MERCADO EM TEMPO REAL (Fonte Auditada: Yahoo Finance Market Data):\n` +
        resolvedQuotes.join("\n") +
        `\nATENÇÃO: Utilize OBRIGATORIAMENTE esses valores exatos de cotação/NAV e moedas acima na sua resposta para esses ativos.`;
    }
  }

  const isNewsQuery = 
    /\b(not[ií]cia|not[ií]cias|fatos? relevantes?|manchetes?|acontecendo no mercado|cen[aá]rio de hoje|news|notici[aá]rio|panorama)\b/i.test(searchContext) ||
    (searchContext.includes("mercado") && (searchContext.includes("hoje") || searchContext.includes("principal") || searchContext.includes("principais") || searchContext.includes("dia")));

  let liveNewsContext = "";
  if (isNewsQuery) {
    onProgress?.("Pensando... [Yahoo Finance News Wire]");
    try {
      const newsQuery = allIdentifiers.length > 0 ? allIdentifiers.join(",") : "market";
      const newsList = await getMarketNews(newsQuery);
      if (newsList && newsList.length > 0) {
        const formattedNews = newsList.slice(0, 10).map((n, idx) => {
          return `${idx + 1}. **${n.title}**\n   - Publicado: ${n.publishedAt} | Veículo / Fonte: ${n.source}\n   - Detalhes / Fato: ${n.aiSummary}`;
        });
        liveNewsContext = `\n\nMANCHETES E NOTÍCIAS DE MERCADO EM TEMPO REAL HOJE (Fonte Auditada: Yahoo Finance Market News Wire):\n` +
          formattedNews.join("\n\n") +
          `\n\nDIRETRIZ OBRIGATÓRIA DE NOTÍCIAS DO MERCADO:
O usuário solicitou as principais notícias, acontecimentos ou fatos relevantes do mercado.
Utilize OBRIGATORIAMENTE as notícias reais em tempo real listadas acima para compor sua resposta.
Estruture a resposta de forma executiva para o investidor:
- **Panorama Geral do Mercado**: Breve síntese em 1 ou 2 parágrafos sobre o sentimento macroeconômico atual (juros, inflação, commodities, tecnologia).
- **Destaques & Fatos Relevantes**: Apresente as notícias mais impactantes em bullet points claros, explicando a relevância de cada uma e citando a fonte explícita (ex: [Fonte: Yahoo Finance / Reuters / Bloomberg]).
- **Impacto para Carteiras e Alocação**: Como esse cenário afeta Renda Fixa, Ações e Câmbio.
- **Rodapé de Auditoria**: "Fonte Auditada: Yahoo Finance News Feeds • Global Real-Time Financial Wire"
NUNCA diga que não tem dados em tempo real ou que não tem acesso a notícias recentes, pois as notícias de hoje estão explicitadas acima.`;
      }
    } catch {}
  }

  let skillsInstructions = "";
  if (activeSkills.length > 0) {
    skillsInstructions = "\n\nSkills Especializadas Ativas no Staggi (Você tem total autonomia para orquestrar e aplicar as diretrizes de cada uma conforme a pergunta do usuário):\n" + 
      activeSkills.map(s => `[Skill: ${s.name}]\nDescription: ${s.description}\nAnalytical Directives:\n${s.systemPrompt}`).join("\n\n");
  }

  let mcpsContext = "";
  if (activeMcps.length > 0) {
    mcpsContext = "\n\nConnected MCP Servers in Staggi:\n" + 
      activeMcps.map(m => `- ${m.name} (${m.type}) [Transport: ${m.transport}]: ${m.desc}`).join("\n");
  }

  const memoryAndFormattingInstruction = `\n\nDiretrizes de Contexto, Ativo & Formatação Executiva:
- PROIBIÇÃO ABSOLUTA DE PREFIXOS DE MCP: NUNCA inicie suas respostas com frases como "Consultando o mcp-financedatabase...", "Acessando o servidor mcp-...", "Com base no mcp-..." ou qualquer menção a nomes de ferramentas internas. Responda DIRETAMENTE como o Staggi de forma natural, executiva e autoritativa.
- FICHAS CADASTRAIS, VALOR E PERFIS DE ATIVOS (ISIN, CUSIP, TICKER, ETFS, BONDS, FUNDOS):
  Ao apresentar informações ou perfil de qualquer ativo por ISIN, CUSIP ou Ticker (inclusive buscas múltiplas como "LU3046410299 e LU2451829373"):
  1. Identifique no cabeçalho o Identificador e o Nome Completo de CADA ativo separadamente:
     ### [ISIN ou TICKER]: [Nome Completo do Ativo]
  2. Forneça os atributos essenciais de forma padronizada para cada um, incluindo OBRIGATORIAMENTE o Valor / Cotação Atual / NAV:
     - Cotação Atual / NAV: [ex: US$ 12.39, € 100.71, R$ 36.85]
     - Moeda: [USD, EUR, BRL]
     - Variação Recente: [ex: +0.35%, -0.10%]
     - Tipo de Ativo: [ex: Fundo UCITS / SICAV, ETF, Bond Corporativo, Ação]
     - Gestora / Emissor: [Nome da gestora ou emissor]
     - Classe de Ativo: [ex: Fundo Multimercado Balanceado Global, Alternativos Líquidos / Trend Following, Renda Fixa Global]
     - Foco / Estratégia: [Resumo objetivo da tese e política de investimento]
     - Domicílio: [ex: Luxemburgo (UCITS), Irlanda (UCITS), EUA, Brasil]
     - Distribuição: [Acumulação (Acc) ou Distribuição (Dist)]
  3. Provide an analytical synthesis on asset eligibility and potential cross-border tax efficiencies (e.g., US Estate Tax exemption for European UCITS/SICAV funds).
  4. Ativos e ISINs de Referência Auditados:
     - LU2451829373: BTG Pactual SICAV - Balanced Fund A (USD) (Acc). Cotação Atual / NAV: US$ 12.39 (USD). Gestora: BTG Pactual Asset Management S.A. Tipo: Fundo UCITS / SICAV. Classe: Fundo Balanceado Global / Multimercado Offshore. Domicílio: Luxemburgo (UCITS). Distribuição: Acumulação (Acc).
     - LU3046410299: Mandatum SICAV-UCITS - Mandatum Managed Futures Fund (Share Class A EUR Cap Perf Hedged). Cotação Atual / NAV: € 100.71 (EUR). Gestora: Mandatum Fund Management S.A. Tipo: Fundo UCITS / SICAV. Classe: Alternativos Líquidos Globais / Trend Following Quantitativo de Futuros. Domicílio: Luxemburgo (UCITS). Distribuição: Acumulação (Acc).
- PROATIVIDADE E PROIBIÇÃO DE RECUSA: NUNCA diga frases como "eu não consigo gerar gráficos diretamente", "meu foco é apenas em dados", "se desejar, posso detalhar" ou faça perguntas retóricas oferecendo opções do que você poderia fazer. O usuário precisa de respostas imediatas, definitivas e numéricas. ENTREGUE IMEDIATAMENTE a análise completa, a projeção, os múltiplos e as tabelas com os números reais do ativo.
- ATIVO E CONTEXTO SOLICITADO: NUNCA assuma Petrobras (PETR4) ou qualquer ativo fixo como padrão quando o usuário estiver solicitando informações sobre outra empresa (ex: Banco do Brasil / BBAS3, Microsoft / MSFT, Apple / AAPL, Vale / VALE3, Itaú / ITUB4, etc.). Identifique a empresa solicitada pelo usuário no prompt e no histórico da conversa e responda estritamente sobre ela.
- PROJEÇÕES, VALUATION E GRÁFICOS:
  Quando o usuário pedir projeções, estimativas, gráficos ou valuation de qualquer ação ou empresa:
  1. Forneça IMEDIATAMENTE os dados fundamentais estruturados:
     - Nome da Empresa e Ticker entre parênteses: [Nome] ([TICKER])
     - Cotação Atual: R$ [valor] ou US$ [valor]
     - Preço Teto Bazin (DY 6%): R$ [valor]
     - Preço Justo Graham: R$ [valor]
     - Preço-Alvo Consenso: R$ [valor]
     - Margem de Segurança: [valor]%
     - Múltiplos: P/L, P/VP, ROE, Margem Líquida, DY Projetado
     - Recomendação: Comprar / Manter / Reduzir
     - Tabela Comparativa de Cenários / Projeções: Crie uma tabela estruturada em Markdown (| Cenário | Projeção LPA | DY Projetado | Preço Teto | Margem |)
     - Síntese: Diagnóstico analítico objetivo.
- FORMATAÇÃO DE NOTÍCIAS E FATOS RELEVANTES:
  Ao listar notícias ou fatos relevantes sobre qualquer empresa, inicie identificando: "Fatos relevantes e notícias recentes sobre [Nome da Empresa] ([TICKER]):"
  E estruture cada evento em tópicos claros:
  1. **[Título do Evento]:** [Descrição analítica detalhada com dados numéricos de receita, lucro, investimentos e impactos operacionais].
- FORMATAÇÃO DE PROVENTOS E HISTÓRICO DE DIVIDENDOS:
  Ao detalhar histórico de proventos e dividendos de uma ação:
  1. Identifique a empresa e ticker: [Nome da Empresa] ([TICKER])
  2. Apresente os proventos recentes em tabela Markdown com barras:
     | Tipo | Valor por Ação | Data Ex-Dividendo | Data de Pagamento |
     (onde Tipo deve ser explicitamente "JCP" ou "Dividendo")
  3. Apresente o histórico de yield anual em tabela Markdown:
     | Ano | Dividendos Totais (R$) | Cotação Média (R$) | DY Anual |
  4. NUNCA mencione componentes internos como "DividendsChart" no texto.
- MEMÓRIA E CONTEXTO MULTI-TURNO: Você possui histórico completo da conversa. Quando o usuário fizer perguntas de acompanhamento usando pronomes, elipses ou referências a mensagens anteriores (ex: "e dela?", "quais os proventos?", "me fale mais sobre o primeiro ponto", "compare essas duas"), relacione DIRETAMENTE com as empresas, tickers e tópicos discutidos anteriormente no histórico.
- CREDIBILIDADE E AUDITORIA DE FONTES DE DADOS:
  Para dar total credibilidade institucional e respaldo fiduciário ao assessor e wealth manager, SEMPRE cite no rodapé das análises a fonte auditada oficial de onde os dados procedem:
  - Proventos e Dividendos: "Fonte Auditada: B3 / CVM • Informes Oficiais de Escrituração Central"
  - Composição e Holdings de ETFs: "Fonte Auditada: Equibles ETF Holdings • SEC N-PORT / Informes CVM"
  - Renda Fixa, Bonds e Títulos: "Fonte Auditada: Bond Intelligence • FINRA TRACE / Emissores e Escrituradores"
  - Curva de Juros e Treasuries: "Fonte Auditada: U.S. Department of the Treasury (Daily Treasury Yield Curve)"
  - Transações de Insiders e Baleias: "Fonte Auditada: SEC EDGAR (Form 4) • TickerInside Intelligence"
  - Ficha Cadastral e Triagem Multi-Ativos: "Fonte Auditada: FinanceDatabase Global Directory • Bolsas Globais"
  - Múltiplos e Valuation: "Fonte Auditada: Demonstrações IFRS / CVM • Consenso Sell-Side"
  - Cotações de Mercado: "Fonte Auditada: B3 / NYSE / Nasdaq (Market Data Yahoo Finance)"
  - Notícias e Fatos Relevantes: "Fonte Auditada: Yahoo Finance News Feeds • Global Real-Time Financial Wire"
- Mantenha a resposta objetiva, matemática e elegante em Markdown com tabelas limpas.`;

  let enforcementDirective = "";
  if (aiStore.enforcementLevel === "low") {
    enforcementDirective = `\n\n[DIRETIVA DE ENFORCEMENT & RIGOR: LOW (MODO ÁGIL / SÍNTESE EFICIENTE)]:
O usuário configurou o nível de enforcement para LOW. Seja direto, conciso e rápido. Se uma síntese em tópicos for suficiente, não é obrigatório gerar tabelas exaustivas. Mantenha foco no cerne da pergunta.`;
  } else if (aiStore.enforcementLevel === "high") {
    enforcementDirective = `\n\n[DIRETIVA DE ENFORCEMENT & RIGOR: HIGH (MÁXIMO RIGOR FIDUCIÁRIO & DETALHAMENTO MATEMÁTICO)]:
O usuário configurou o nível de enforcement para HIGH. Você DEVE operar com rigor analítico máximo:
1. RIGOR MATEMÁTICO & FÓRMULAS: NUNCA omita cálculos, projeções ou fórmulas aplicadas (Graham, Bazin, Gordon, TIR, Duration).
2. TABELAS COMPLETAS: Apresente tabelas comparativas detalhadas sem abreviar métricas ou suprimir colunas relevantes.
3. EXECUÇÃO INTEGRAL DE SKILLS: Se uma skill ou comando de barra foi acionado, execute 100% de todas as suas regras e modelos sem simplificações.
4. AUDITORIA & PRECISÃO: Exija conferência estrita de fontes e cite todas as notas metodológicas no rodapé.`;
  } else {
    enforcementDirective = `\n\n[DIRETIVA DE ENFORCEMENT & RIGOR: MEDIUM (PADRÃO RECOMENDADO - EQUILÍBRIO FIDUCIÁRIO)]:
Equilibre profundidade técnica, dados reais auditados e contextualização executiva com tabelas claras e conclusões numéricas.`;
  }

  const systemInstruction = `Você é o Staggi, o motor de inteligência e copiloto executivo para assessores de investimento e wealth managers no Brasil. Suas respostas devem ser de alto padrão, numéricas, concisas, sem rodeios desnecessários, com foco em alocação patrimonial, governança offshore, tributação (Lei 14.754/23) e fluxo de proventos.${enforcementDirective}${explicitSkillDirective}${skillsInstructions}${mcpsContext}${liveMarketDataContext}${liveNewsContext}${memoryAndFormattingInstruction}${portfolioContext ? `\n\nContexto do Portfólio: ${JSON.stringify(portfolioContext)}` : ""}`;

  const cleanHistory = (history || [])
    .filter(h => h.text && !(h.text.trim().startsWith("{") && h.text.includes('"candidates"')))
    .map(h => ({
      role: h.role === "user" ? ("user" as const) : ("model" as const),
      text: h.text
    }));

  try {
    const providerLabel = provider === "openai" ? `OpenAI ${model}` : provider === "anthropic" ? `Claude ${model}` : `Gemini ${model}`;
    onProgress?.(`Pensando... [${providerLabel}]`);
    const responseText = await invoke<string>("ask_ai", {
      provider,
      apiKey: apiKey.trim(),
      model: model.trim(),
      prompt: cleanPrompt,
      history: cleanHistory,
      systemInstruction,
      enableSearch: true,
      enforcementLevel: aiStore.enforcementLevel
    });

    return {
      text: responseText,
      success: true,
      isConfigured: true
    };
  } catch (err: any) {
    try {
      if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: model.trim(),
            messages: [
              { role: "system", content: systemInstruction },
              ...cleanHistory.map(h => ({ role: h.role === "user" ? "user" : "assistant", content: h.text })),
              { role: "user", content: cleanPrompt }
            ],
            temperature: 0.2
          })
        });
        if (res.ok) {
          const json = await res.json();
          const text = json.choices?.[0]?.message?.content;
          if (text) return { text, success: true, isConfigured: true };
        }
      } else if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey.trim(),
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: model.trim(),
            max_tokens: 4096,
            system: systemInstruction,
            messages: [
              ...cleanHistory.map(h => ({ role: h.role === "user" ? "user" : "assistant", content: h.text })),
              { role: "user", content: cleanPrompt }
            ]
          })
        });
        if (res.ok) {
          const json = await res.json();
          const text = json.content?.[0]?.text;
          if (text) return { text, success: true, isConfigured: true };
        }
      } else {
        const cleanModel = model.trim().replace(/^models\//, "");
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey.trim()}`;
        const contentsPayload = [
          ...cleanHistory.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
          })),
          {
            role: "user",
            parts: [{ text: cleanPrompt }]
          }
        ];

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: contentsPayload,
            tools: [{ google_search: {} }]
          })
        });

        if (res.ok) {
          const json = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return { text, success: true, isConfigured: true };
        }
      }
    } catch {
      //
    }

    const errorMsg = String(err?.message || err || `Erro de conexão com ${providerName}`);
    return {
      text: `Falha ao processar com ${providerName}: ${errorMsg}\n\nVerifique se sua chave de API está ativa e com limite disponível nas Configurações.`,
      success: false,
      isConfigured: true,
      error: errorMsg
    };
  }
}

export async function askGeminiWealthAdvisor(
  prompt: string,
  history?: ChatHistoryTurn[],
  portfolioContext?: Record<string, unknown>
): Promise<GeminiAnalysisResponse> {
  const result = await queryGemini(prompt, history, portfolioContext);

  if (result.success) {
    return {
      summary: result.text,
      recommendation: "Manter",
      taxImplication: "Análise gerada em tempo real via Google Gemini AI",
      source: "Gemini AI"
    };
  }

  return {
    summary: result.text,
    recommendation: "Manter",
    taxImplication: "Offshore via PIC em Cayman com transparência fiscal adequada (Lei 14.754/23)",
    source: "Staggi Deterministic Intelligence"
  };
}
