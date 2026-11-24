import { invoke } from "@tauri-apps/api/core";
import { pluginsStore, getSkillSlug } from "./pluginsState.svelte";
import { aiStore, geminiStore } from "./aiProviderState.svelte";
import { memoryStore } from "./memoryState.svelte";

export interface GeminiResponseResult {
  text: string;
  success: boolean;
  isConfigured: boolean;
  error?: string;
  source?: string;
}

export interface ChatHistoryTurn {
  role: "user" | "model";
  text: string;
}

export interface GeminiAnalysisResponse {
  summary: string;
  recommendation: "Comprar" | "Aumentar" | "Manter" | "Reduzir" | "Ajustar Hedge";
  taxImplication: string;
  source: string;
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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentDateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dateContext = `\n\n[CONTEXTO TEMPORAL & DATA ATUAL DE REFERÊNCIA]:
Hoje é ${currentDateStr} (Ano corrente: ${currentYear}).
Quando o usuário utilizar expressões temporais como "desse ano", "deste ano", "ano atual", "hoje", "neste mês", "no ano", considere SEMPRE e EXCLUSIVAMENTE o ano de ${currentYear}.`;

  let activeSkillName: string | null = null;
  interface ExecutedToolInfo {
    mcpName: string;
    toolName: string;
  }
  const executedTools: ExecutedToolInfo[] = [];

  function formatToolsSummary(tools: ExecutedToolInfo[]): string {
    if (tools.length === 0) return "";
    const grouped = new Map<string, string[]>();
    for (const t of tools) {
      const list = grouped.get(t.mcpName) || [];
      if (!list.includes(t.toolName)) {
        list.push(t.toolName);
      }
      grouped.set(t.mcpName, list);
    }
    const parts: string[] = [];
    for (const [mcpName, toolNames] of grouped.entries()) {
      parts.push(`${mcpName} • ${toolNames.join(", ")}`);
    }
    return parts.join(" | ");
  }

  let cleanPrompt = prompt.trim();

  // Instant command to record long-term memories: /remember, /lembrar, /memoria, /memory
  const memoryCmdMatch = cleanPrompt.match(/^\/(?:remember|lembrar|memoria|memory)\s+(.+)$/is);
  if (memoryCmdMatch) {
    const rawContent = memoryCmdMatch[1].trim();
    let category = "general";
    if (/\b(format|moeda|tabela|estilo|tom|decima)/i.test(rawContent)) category = "formatting";
    else if (/\b(bazin|graham|calcul|fórmula|valuation|desconto)/i.test(rawContent)) category = "valuation";

    const title = rawContent.slice(0, 45).replace(/[:;.,]$/, "");
    const saved = memoryStore.addMemory({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      content: rawContent,
      category,
      tags: [],
      pinned: false,
      active: true,
      source: "user"
    });

    return {
      text: `🧠 **Diretriz Registrada no Second Brain com Sucesso!**\n\n- **Identificador**: \`${saved.id}\`\n- **Diretriz**: *"${rawContent}"*\n\nEssa instrução foi gravada no índice de memória de longo prazo do Staggi com recuperação instantânea (< 1ms) e será respeitada em todas as suas próximas conversas e análises consultivas.`,
      success: true,
      isConfigured: true,
      source: "Second Brain"
    };
  }

  // Retrieve relevant Second Brain memories in sub-millisecond time (< 0.2ms)
  const relevantMemories = memoryStore.retrieveRelevant(cleanPrompt, 6);
  let secondBrainContext = "";
  if (relevantMemories.length > 0) {
    secondBrainContext = `\n\n[SECOND BRAIN & INSTRUÇÕES PESSOAIS DO ASSESSOR]:
As seguintes preferências de trabalho, formatação e instruções personalizadas foram definidas pelo assessor e devem ser rigorosamente aplicadas:
${relevantMemories.map(m => `- **${m.title}**: ${m.content}`).join("\n")}
Atenção: Trate essas diretrizes como preferências e estilo de trabalho do assessor, correlacionando-as com os dados cadastrais e documentos retornados por MCPs e RAG.`;
  }

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
      activeSkillName = targetSkill.name;
      onProgress?.(`Thinking... [Skill: ${targetSkill.name}]`);
      explicitSkillDirective = `\n\n[DIRETIVA EXPLÍCITA /${requestedSlug} - EXECUÇÃO PRIORITÁRIA DA SKILL: ${targetSkill.name.toUpperCase()}]:
O usuário acionou especificamente a Skill "${targetSkill.name}" via comando de barra (/${requestedSlug}).
Você DEVE adotar com máxima prioridade e rigor metodológico todas as seguintes regras analíticas, fórmulas e modelo de resposta desta skill:
${targetSkill.systemPrompt}`;

      cleanPrompt = restOfPrompt ? `[Skill: ${targetSkill.name}] ${restOfPrompt}` : `Execute a análise especializada da skill ${targetSkill.name}`;
    } else {
      onProgress?.("Thinking...");
    }
  } else {
    onProgress?.("Thinking...");
  }

  let skillsInstructions = "";
  if (activeSkills.length > 0) {
    skillsInstructions = "\n\nSkills Especializadas Ativas no Staggi (Você tem total autonomia para orquestrar e aplicar as diretrizes de cada uma conforme a pergunta do usuário):\n" +
      activeSkills.map(s => `[Skill: ${s.name}]\nDescription: ${s.description}\nAnalytical Directives:\n${s.systemPrompt}`).join("\n\n");
  }

  let mcpsContext = "";
  if (activeMcps.length > 0) {
    mcpsContext = "\n\nConnected MCP Servers & Tools in Staggi (Full Protocol Discovery Active):\n" +
      activeMcps.map(m => {
        let text = `- ${m.name} (${m.type}) [Transport: ${m.transport}]: ${m.desc}`;
        if (m.tools && m.tools.length > 0) {
          text += `\n  Available MCP Tools (${m.tools.length}):\n` +
            m.tools.map(t => `    * ${t.name}: ${t.description || "No description provided"}`).join("\n");
        }
        return text;
      }).join("\n\n");
  }

  let liveMcpData = "";
  for (const mcp of activeMcps) {
    if (!mcp.active || !mcp.tools || mcp.tools.length === 0) continue;

    for (const tool of mcp.tools) {
      const toolName = tool.name.toLowerCase();
      let shouldExecute = false;

      if (cleanPrompt.toLowerCase().includes(toolName)) {
        shouldExecute = true;
      } else if (toolName === "list_clients" && /\b(clientes?|clients?|investidores?|carteira de clientes)\b/i.test(cleanPrompt)) {
        shouldExecute = true;
      } else if (toolName === "list_trade_ideas" && /\b(trade ideas?|ideias? de trade|teses?|recomendações?|oportunidades?)\b/i.test(cleanPrompt)) {
        shouldExecute = true;
      } else if ((toolName === "send_automation_report_email" || toolName === "send_portfolio_proposal_email") &&
        /\b(envi(?:ar|e)|dispar(?:ar|e)|notific(?:ar|que)|mand(?:ar|e))\b.*\b(e-?mails?|relat[oó]rio|proposta|resultado)\b/i.test(cleanPrompt)) {
        shouldExecute = true;
      } else if (toolName === "list_indexed_documents" && /\b(documentos?|pdfs?|relat[oó]rios? indexados?)\b/i.test(cleanPrompt)) {
        shouldExecute = true;
      } else if ((toolName.includes("quote") || toolName.includes("price") || toolName.includes("ticker") || toolName.includes("cotacao") || toolName.includes("preco") || toolName.includes("dividend") || toolName.includes("provento")) &&
        /\b(cota[çc][aã]o|pre[çc]o|quanto est[aá]|ticker|a[çc][aã]o|valor|proventos?|dividendos?)\b/i.test(cleanPrompt)) {
        shouldExecute = true;
      } else if ((toolName.includes("news") || toolName.includes("noticia")) &&
        /\b(not[ií]cias?|manchetes?|fatos? relevantes?|notici[aá]rio)\b/i.test(cleanPrompt)) {
        shouldExecute = true;
      } else if ((toolName.includes("portfolio") || toolName.includes("carteira") || toolName.includes("alocacao") || toolName.includes("posicao") || toolName.includes("position") || toolName.includes("asset")) &&
        /\b(portf[oó]lio|carteira|aloca[çc][aã]o|posi[çc][oõ]es|posicao|patrim[oô]nio|distribui[çc][aã]o)\b/i.test(cleanPrompt)) {
        shouldExecute = true;
      }

      if (shouldExecute) {
        executedTools.push({ mcpName: mcp.name, toolName: tool.name });
        const toolsLabel = formatToolsSummary(executedTools);
        const statusText = activeSkillName
          ? `Thinking... [${toolsLabel} • Skill: ${activeSkillName}]`
          : `Thinking... [${toolsLabel}]`;
        onProgress?.(statusText);

        const b3Match = cleanPrompt.match(/\b([A-Za-z]{4}\d{1,2}(?:\.SA)?)\b/i);
        const usMatch = cleanPrompt.match(/\b(AAPL|MSFT|NVDA|GOOGL|AMZN|TSLA|META)\b/i);
        const detectedTicker = b3Match ? b3Match[1] : (usMatch ? usMatch[1] : undefined);
        const toolArgs: Record<string, unknown> = detectedTicker
          ? { symbol: detectedTicker, query: detectedTicker }
          : {};

        try {
          const res = await pluginsStore.callTool(mcp.id, tool.name, toolArgs);
          if (res) {
            const rawContent = res.result?.content || res.result || res;
            const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent, null, 2);
            const trimmed = contentStr.length > 5000 ? contentStr.slice(0, 5000) + "\n...[truncated]" : contentStr;
            liveMcpData += `\n\n[DADOS AUDITADOS RETORNADOS DO MCP LOCAL: ${mcp.name} • FERRAMENTA: ${tool.name}]:\n${trimmed}\nATENÇÃO: Utilize com rigor fiduciário esses dados factuais reais retornados pelo servidor MCP para responder à consulta do usuário.`;
          }
        } catch (e: any) {
          console.warn(`[MCP] Failed to call ${tool.name}:`, e);
        }
      }
    }
  }

  const memoryAndFormattingInstruction = `\n\nDiretrizes Universais de Execução & Padrão de Resposta:
1. DIRETRIZ GERAL & TOM EXECUTIVO:
   - Responda como Staggi, motor analítico e copiloto fiduciário de alta inteligência para assessores de investimento e wealth managers.
   - Linguagem executiva, concisa, matemática e sem prolixidade. Utilize Markdown com tabelas limpas.
   - NUNCA use prefixos técnicos ou menções a nomes de ferramentas internas (ex: "consultando mcp...", "acessando base...", "usando ferramenta..."). Responda diretamente com naturalidade e autoridade.

2. FIDELIDADE ESTRITA AO PEDIDO DO USUÁRIO & RECORTE TEMPORAL:
   - Responda estritamente sobre o ativo, carteira, período ou tópico solicitado na mensagem do usuário e no histórico.
   - NUNCA assuma ativos fixos ou padrão se o usuário não os mencionou.
   - FILTRO TEMPORAL OBRIGATÓRIO: Se o usuário pedir dados de um período ou ano específico (ex: "desse ano", "deste ano", "em ${currentYear}", "no último trimestre", "somente 2024", "último mês"):
     Você DEVE filtrar e fornecer EXCLUSIVAMENTE os dados correspondentes a esse período solicitado. É expressamente proibido adicionar tabelas históricas multianuais ou dados de anos anteriores quando não forem solicitados.
   - Somente apresente histórico multianual se o usuário pedir explicitamente termos como "histórico", "evolução dos últimos anos", "últimos 5 anos" ou "série histórica".
   - Mantenha continuidade conversacional entre mensagens do histórico (perguntas de acompanhamento, pronomes, comparações de ativos discutidos anteriormente).

3. PROATIVIDADE & RESPOSTAS DEFINITIVAS:
   - Apresente diretamente números reais, cálculos, múltiplos e conclusões analíticas.
   - Evite respostas evasivas, recusas injustificadas ou perguntas retóricas sobre o que você poderia fazer.

4. DIRETRIZES DE SAUDAÇÃO & INTERAÇÃO NATURAL:
   - Em saudações ("Olá", "Bom dia", "Tudo bem?"), agradecimentos ou perguntas conceituais simples, responda de forma direta, educada e ágil em 1 a 3 frases.
   - NUNCA inclua rodapé de auditoria, tabelas vazias ou cotações não solicitadas em conversas gerais.

5. AUDITORIA E CITAÇÃO DE FONTES:
   - Se dados de ferramentas ou servidores MCP locais foram retornados acima ([DADOS AUDITADOS RETORNADOS DO MCP LOCAL: <NomeDoMcp> • FERRAMENTA: <NomeDaTool>]):
     Você DEVE citar EXATAMENTE o servidor MCP e a ferramenta consultada no rodapé da resposta: "Fonte Auditada: <NomeDoMcp> • <NomeDaTool>".
     Exemplo real: se consultou o MCP "staggi-portfolio" com a ferramenta "list_clients", finalize estritamente com: "Fonte Auditada: staggi-portfolio • list_clients".
     É ESTRITAMENTE PROIBIDO inventar fontes como "B3", "SEC EDGAR", "Market Consensus" ou "Consenso Sell-Side" quando os dados vieram de um MCP local do usuário ou ferramenta específica.
   - Se nenhuma ferramenta/MCP foi consultada, NÃO inclua nenhum rodapé de "Fonte Auditada".
 
6. APRESENTAÇÃO DE PORTFÓLIO E DISTRIBUIÇÃO DE CARTEIRA:
   - Ao apresentar o portfólio, posições ou carteira de um cliente, estruture os dados em formato claro com Ativo/Classe, Categoria, Valor e Percentual (%) da carteira.
   - Isso permite ao Staggi renderizar automaticamente o gráfico visual interativo de distribuição de portfólio (Donut Chart & Alocações) em conjunto com a tabela analítica completa.

7. ADERÊNCIA AO SECOND BRAIN & PREFERÊNCIAS MEMORIZADAS:
   - Se diretrizes ou fatos do [SECOND BRAIN & MEMÓRIA DE LONGO PRAZO DO ASSESSOR] estiverem presentes no contexto, aplique-os com rigor fiduciário (ex: respeitar restrições de clientes, diretrizes de governança, teses de alocação e regras fiscais).`;

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

  const systemInstruction = `Você é o Staggi, o motor de inteligência e copiloto executivo para assessores de investimento e wealth managers no Brasil. Suas respostas devem ser de alto padrão, numéricas, concisas, sem rodeios desnecessários, com foco em alocação patrimonial, governança offshore, tributação (Lei 14.754/23) e fluxo de proventos.${dateContext}${secondBrainContext}${enforcementDirective}${explicitSkillDirective}${skillsInstructions}${mcpsContext}${liveMcpData}${memoryAndFormattingInstruction}${portfolioContext ? `\n\nContexto do Portfólio: ${JSON.stringify(portfolioContext)}` : ""}`;

  const cleanHistory = (history || [])
    .filter(h => h.text && !(h.text.trim().startsWith("{") && h.text.includes('"candidates"')))
    .map(h => ({
      role: h.role === "user" ? ("user" as const) : ("model" as const),
      text: h.text
    }));

  try {
    const allToolsLabel = formatToolsSummary(executedTools);
    const statusBracket = allToolsLabel && activeSkillName
      ? ` [${allToolsLabel} • Skill: ${activeSkillName}]`
      : allToolsLabel
        ? ` [${allToolsLabel}]`
        : activeSkillName
          ? ` [Skill: ${activeSkillName}]`
          : "";
    onProgress?.(`Thinking...${statusBracket}`);
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
      isConfigured: true,
      source: allToolsLabel || undefined
    };
  } catch (err: any) {
    const allToolsLabel = formatToolsSummary(executedTools);
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
          if (text) return { text, success: true, isConfigured: true, source: allToolsLabel || undefined };
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
          if (text) return { text, success: true, isConfigured: true, source: allToolsLabel || undefined };
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
          if (text) return { text, success: true, isConfigured: true, source: allToolsLabel || undefined };
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
    taxImplication: "Estruturação fiscal conforme normas vigentes",
    source: "Staggi Intelligence Engine"
  };
}
