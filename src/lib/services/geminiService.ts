import { invoke } from "@tauri-apps/api/core";
import { pluginsStore, getSkillSlug } from "./pluginsState.svelte";
import { aiStore, geminiStore } from "./aiProviderState.svelte";
import { memoryStore } from "./memoryState.svelte";

const refreshedMcpSchemasInSession = new Set<string>();

interface PlannedMcpCall {
  mcpId: string;
  toolName: string;
  args: Record<string, unknown>;
}

function parsePlannedToolCalls(raw: string): PlannedMcpCall[] {
  if (!raw) return [];
  const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: any) => item && typeof item.toolName === "string")
      .map((item: any) => ({
        mcpId: typeof item.mcpId === "string" ? item.mcpId : "",
        toolName: String(item.toolName).trim(),
        args: item.args && typeof item.args === "object" && !Array.isArray(item.args) ? item.args : {}
      }));
  } catch {
    return [];
  }
}

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
    anthropic: "Anthropic (Claude)",
    bedrock: "AWS Bedrock"
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

  /**
   * Dynamically resolves any arbitrary MCP tool into a clean, human-readable continuous action in English.
   * Completely dynamic for any MCP server, tool, and parameter structure.
   */
  function humanizeMcpToolAction(mcpName: string, toolName: string, skillName?: string | null): string {
    if (!toolName) {
      return skillName ? `Reviewing ${skillName} guidelines...` : "Consulting data sources...";
    }

    const cleanName = toolName
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .trim()
      .toLowerCase();

    const words = cleanName.split(/\s+/).filter(Boolean);
    if (words.length === 0) return "Consulting data sources...";

    const verbMap: Record<string, string> = {
      get: "Reading",
      fetch: "Fetching",
      read: "Reading",
      load: "Loading",
      query: "Querying",
      search: "Searching",
      find: "Finding",
      lookup: "Looking up",
      scan: "Scanning",
      check: "Checking",
      calculate: "Calculating",
      compute: "Computing",
      estimate: "Estimating",
      evaluate: "Evaluating",
      analyze: "Analyzing",
      audit: "Auditing",
      generate: "Structuring",
      build: "Building",
      create: "Creating",
      structure: "Structuring",
      format: "Formatting",
      rebalance: "Balancing",
      balance: "Balancing",
      optimize: "Optimizing",
      send: "Preparing",
      export: "Exporting",
      list: "Listing",
      sync: "Syncing"
    };

    const firstWord = words[0];
    let verb = verbMap[firstWord];
    let nounWords = words.slice(1);

    if (!verb) {
      if (firstWord.endsWith("ing")) {
        verb = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
      } else {
        verb = "Processing";
        nounWords = words;
      }
    }

    let rest = nounWords.join(" ")
      .replace(/\bportfolio positions\b/g, "portfolio positions")
      .replace(/\bpositions\b/g, "portfolio positions")
      .replace(/\brebalance report\b/g, "rebalance proposal")
      .replace(/\bposition report\b/g, "position report")
      .replace(/\bsec\b/g, "SEC filings")
      .replace(/\bquote\b/g, "market quotes")
      .replace(/\bdy\b/g, "dividend yield")
      .replace(/\bmcp\b/g, "")
      .trim();

    if (!rest) {
      rest = mcpName ? `${mcpName.replace(/[-_]/g, " ")} data` : "data";
    }

    const result = `${verb} ${rest}...`;
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

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

  // Match skills via slash command or explicit skill mention
  const allSkills = pluginsStore.skills;
  const availableSkills = activeSkills.length > 0 ? activeSkills : allSkills;
  let explicitSkillDirective = "";
  const slashMatch = cleanPrompt.match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/s);

  if (slashMatch) {
    const requestedSlug = slashMatch[1].toLowerCase();
    const restOfPrompt = slashMatch[2] ? slashMatch[2].trim() : "";

    const targetSkill = availableSkills.find(s => {
      const slug = getSkillSlug(s).toLowerCase();
      const rawSlug = (s.slug || "").toLowerCase();
      return slug === requestedSlug || rawSlug === requestedSlug || s.name.toLowerCase().includes(requestedSlug) || s.id.toLowerCase().includes(requestedSlug);
    });

    if (targetSkill) {
      activeSkillName = targetSkill.name;
      onProgress?.(`Reviewing ${targetSkill.name} guidelines...`);
      explicitSkillDirective = `\n\n[DIRETIVA EXPLÍCITA /${requestedSlug} - EXECUÇÃO PRIORITÁRIA DA SKILL: ${targetSkill.name.toUpperCase()}]:
O usuário acionou especificamente a Skill "${targetSkill.name}" via comando de barra (/${requestedSlug}).
Você DEVE adotar com máxima prioridade e rigor metodológico todas as seguintes regras analíticas, fórmulas e modelo de resposta desta skill:
${targetSkill.systemPrompt}`;

      cleanPrompt = restOfPrompt ? `[Skill: ${targetSkill.name}] ${restOfPrompt}` : `Execute a análise especializada da skill ${targetSkill.name}`;
    } else {
      onProgress?.("Thinking...");
    }
  } else {
    // Check if the prompt mentions any registered skill by name or slug
    const promptLower = cleanPrompt.toLowerCase();
    const matchedSkill = availableSkills.find(s => {
      const slug = getSkillSlug(s).toLowerCase();
      const name = s.name.toLowerCase();
      return (slug.length >= 4 && promptLower.includes(slug)) || promptLower.includes(name);
    });
    if (matchedSkill) {
      activeSkillName = matchedSkill.name;
      explicitSkillDirective = `\n\n[SKILL RELEVANTE IDENTIFICADA: ${matchedSkill.name.toUpperCase()}]:
Aplique as regras e metodologias da skill ${matchedSkill.name}:
${matchedSkill.systemPrompt}`;
    }
    onProgress?.("Thinking...");
  }

  let skillsInstructions = "";
  if (activeSkills.length > 0) {
    skillsInstructions = "\n\nSkills Especializadas Ativas no Staggi (Você tem total autonomia para orquestrar e aplicar as diretrizes de cada uma conforme a pergunta do usuário):\n" +
      activeSkills.map(s => `[Skill: ${s.name}]\nDescription: ${s.description}\nAnalytical Directives:\n${s.systemPrompt}`).join("\n\n");
  }

  // Intelligent Token Optimization: Sliding Window + Semantic Trimming
  // 1. Filter out malformed/raw JSON dumps from history
  // 2. Keep the most recent 12 conversation turns (enough for multi-turn reasoning without context bloat)
  // 3. Compact older assistant turns exceeding 1,200 characters to keep token usage lean
  const rawHistory = (history || [])
    .filter(h => h.text && !(h.text.trim().startsWith("{") && h.text.includes('"candidates"')));

  const windowedHistory = rawHistory.slice(-12);
  const cleanHistory = windowedHistory.map((h, idx) => {
    let text = h.text.trim();
    // Compact earlier assistant responses (except the last 2 turns) to prevent token accumulation
    const isRecent = idx >= windowedHistory.length - 2;
    if (h.role !== "user" && !isRecent && text.length > 1200) {
      text = text.slice(0, 1200) + "\n...[síntese histórica truncada para economia de tokens]";
    }
    return {
      role: h.role === "user" ? ("user" as const) : ("model" as const),
      text
    };
  });

  // Refresh MCP tool schemas only if tools are missing or newly added server tools aren't cached yet
  for (const m of pluginsStore.activeMcps) {
    const needsDiscovery =
      !m.tools ||
      m.tools.length === 0 ||
      (!refreshedMcpSchemasInSession.has(m.id) &&
        m.tools.some(t => t.name === "get_client_portfolios") &&
        !m.tools.some(t => t.name === "screen_firm_transactions"));
    if (needsDiscovery) {
      refreshedMcpSchemasInSession.add(m.id);
      try {
        await pluginsStore.testMcp(m.id);
      } catch {
        // Keep cached tools if endpoint temporarily fails
      }
    }
  }
  const activeMcpsNow = pluginsStore.activeMcps;

  let mcpsContext = "";
  if (activeMcpsNow.length > 0) {
    mcpsContext = "\n\nConnected MCP Servers & Tools in Staggi (Full Protocol Discovery Active):\n" +
      activeMcpsNow.map(m => {
        let text = `- ${m.name} (${m.type}) [Transport: ${m.transport}]: ${m.desc}`;
        if (m.tools && m.tools.length > 0) {
          text += `\n  Available MCP Tools (${m.tools.length}):\n` +
            m.tools.map(t => `    * ${t.name}: ${t.description || "No description provided"}`).join("\n");
        }
        return text;
      }).join("\n\n");
  }

  let liveMcpData = "";
  const isPureGreeting = /^\s*(oi|ol[aá]|bom dia|boa tarde|boa noite|tudo bem\??|obrigad[oa]|valeu)\s*[!?.]*\s*$/i.test(cleanPrompt);
  const availableToolCatalog = activeMcpsNow.flatMap(mcp =>
    mcp.active && mcp.tools && mcp.tools.length > 0
      ? mcp.tools.map(tool => ({
          mcpId: mcp.id,
          mcpName: mcp.name,
          toolName: tool.name,
          description: tool.description || "",
          parameters: (tool.input_schema as Record<string, unknown> | undefined)?.properties || {},
          required: (tool.input_schema as Record<string, unknown> | undefined)?.required || []
        }))
      : []
  );

  if (!isPureGreeting && availableToolCatalog.length > 0) {
    const explicitOutboundIntent = /\b(envi(?:ar|e)|dispar(?:ar|e)|mand(?:ar|e)|registr(?:ar|e)\s+decis[aã]o|propo(?:r|nha)\s+trade|index(?:ar|e))\b/i.test(cleanPrompt);
    const mutationToolNames = new Set([
      "send_portfolio_proposal_email",
      "send_portfolio_position_report_email",
      "send_portfolio_rebalance_proposal_email",
      "send_automation_report_email",
      "propose_trade_idea_to_client",
      "register_client_trade_decision",
      "index_pdf_document"
    ]);

    // Build a compact, low-token signature catalog directly from MCP schemas (~350 tokens vs 8,000 tokens)
    const eligibleCatalog = availableToolCatalog.filter(
      t => explicitOutboundIntent || !mutationToolNames.has(t.toolName)
    );

    const compactCatalogLines = eligibleCatalog.map(t => {
      const props = (t.parameters || {}) as Record<string, any>;
      const reqSet = new Set(Array.isArray(t.required) ? (t.required as string[]) : []);
      const paramSig = Object.entries(props)
        .filter(([k]) => !["name", "client_name"].includes(k)) // hide redundant alias params to keep signature crisp
        .map(([k, v]) => {
          let pType = v?.type || "";
          if (!pType && Array.isArray(v?.anyOf)) {
            pType = v.anyOf.map((x: any) => x?.type).filter((x: any) => x && x !== "null").join("|");
          }
          return `${k}${reqSet.has(k) ? "" : "?"}: ${pType || "any"}`;
        })
        .join(", ");
      const shortDesc = (t.description || "").replace(/\s+/g, " ").trim().slice(0, 220);
      return `- [mcpId="${t.mcpId}"] ${t.toolName}(${paramSig}): ${shortDesc}`;
    });

    const recentTurnsText = cleanHistory
      .slice(-4)
      .map(t => `${t.role === "user" ? "U" : "A"}: ${t.text.slice(0, 500)}`)
      .join("\n");

    const plannerSystemInstruction = `You are the MCP Function-Calling Router for Staggi Wealth Management (Today: ${currentDateStr}).
Output ONLY a valid JSON array of tool calls: [{"mcpId":"...","toolName":"...","args":{...}}] or [] if no MCP tool is needed. No prose.

ROUTING RULES:
1. NEVER pass verbs, phrases, or question words in "client_id" or "search" — ONLY pass a real person's name, email, account code (STG...), or UUID.
2. FIRM-WIDE / CROSS-ADVISOR FLOWS & SCREENING (all clients / all advisors):
   - Cash deposits/inflows ("aportaram", "aportes", "cash", "depósitos"), withdrawals ("resgates", "saques"), buys, sells, or dividends across clients/advisors -> call "screen_firm_transactions" with {"transaction_type": "DEPOSIT"|"WITHDRAWAL"|"BUY"|"SELL"|"DIVIDEND", "days_back": 30 (for last month, 7 for week, 90 for quarter, 365 for year), "limit": 250} (add "advisor_name" only if filtered to one advisor).
   - Clients holding a specific ticker/asset class/sector across the firm -> call "screen_firm_positions".
   - Compare all advisors -> call "get_advisor_book" with {"advisor_name": "ALL"}. Single advisor book -> {"advisor_name": "<name>"}.
3. PARTIAL / FIRST NAME ONLY (e.g. a single first name): call BOTH "list_clients" ({"search":"<name>","limit":50}) AND "get_client_portfolios" ({"client_id":"<name>"}) so all homonym clients and any matching advisor are returned.
4. SPECIFIC CLIENT (full name with surname OR STG... account code):
   - Portfolio/holdings/allocation query -> call "get_client_portfolios", "get_portfolio_positions", "get_asset_allocation", "get_portfolio_metrics" with {"client_id":"<full_name_or_STG>"}.
   - Accounts/registration only -> call "get_client_portfolios" and "get_client_details" with {"client_id":"<full_name_or_STG>"}.
5. INSTITUTIONAL REPORTS (Posição / Extrato de Conta ou Proposta de Rebalanceamento):
   - Generate official positions & holdings report -> call "generate_portfolio_position_report" with {"client_id":"<full_name_or_STG>"}.
   - Generate rebalance & target structure proposal report -> call "generate_portfolio_rebalance_report" with {"client_id":"<full_name_or_STG>"}.
   - Explicit email dispatch requested -> call "send_portfolio_position_report_email" or "send_portfolio_rebalance_proposal_email".`;

    const plannerPrompt = `${recentTurnsText ? `HISTORY:\n${recentTurnsText}\n\n` : ""}TOOLS:\n${compactCatalogLines.join("\n")}\n\nUSER: ${cleanPrompt}\nJSON:`;

    const fastRouterModelByProvider: Record<string, string> = {
      gemini: "gemini-2.0-flash",
      openai: "gpt-4o-mini",
      anthropic: "claude-3-5-haiku-latest"
    };
    const preferredRouterModel = fastRouterModelByProvider[provider] || model.trim();

    let plannedCalls: PlannedMcpCall[] = [];
    onProgress?.(activeSkillName ? `Reviewing ${activeSkillName} guidelines...` : "Consulting data sources...");
    try {
      const rawPlan = await invoke<string>("ask_ai", {
        provider,
        apiKey: apiKey.trim(),
        model: preferredRouterModel,
        prompt: plannerPrompt,
        history: [],
        systemInstruction: plannerSystemInstruction,
        enableSearch: false,
        enforcementLevel: "low"
      });
      plannedCalls = parsePlannedToolCalls(rawPlan);
    } catch {
      if (preferredRouterModel !== model.trim()) {
        try {
          const rawFallbackPlan = await invoke<string>("ask_ai", {
            provider,
            apiKey: apiKey.trim(),
            model: model.trim(),
            prompt: plannerPrompt,
            history: [],
            systemInstruction: plannerSystemInstruction,
            enableSearch: false,
            enforcementLevel: "low"
          });
          plannedCalls = parsePlannedToolCalls(rawFallbackPlan);
        } catch (planErr) {
          console.warn("[MCP Router] Planner failed:", planErr);
          plannedCalls = [];
        }
      }
    }

    // Validate, filter out unintended mutation tools, and deduplicate planned calls
    const seenCallKeys = new Set<string>();
    const validCalls: Array<{ mcpId: string; mcpName: string; toolName: string; args: Record<string, unknown> }> = [];

    for (const call of plannedCalls) {
      if (!explicitOutboundIntent && mutationToolNames.has(call.toolName)) {
        continue;
      }
      const matchedMcp =
        activeMcpsNow.find(m => m.id === call.mcpId && m.tools?.some(t => t.name === call.toolName)) ||
        activeMcpsNow.find(m => m.tools?.some(t => t.name === call.toolName));
      if (!matchedMcp) continue;

      const dedupKey = `${matchedMcp.id}::${call.toolName}::${JSON.stringify(call.args || {})}`;
      if (seenCallKeys.has(dedupKey)) continue;
      seenCallKeys.add(dedupKey);

      validCalls.push({
        mcpId: matchedMcp.id,
        mcpName: matchedMcp.name,
        toolName: call.toolName,
        args: call.args || {}
      });
      if (validCalls.length >= 6) break;
    }

    if (validCalls.length > 0) {
      for (const c of validCalls) {
        executedTools.push({ mcpName: c.mcpName, toolName: c.toolName });
      }
      onProgress?.(humanizeMcpToolAction(validCalls[0].mcpName, validCalls[0].toolName, activeSkillName));

      // Sequential execution avoids concurrent StreamableHTTP initialize session collisions (20s stall)
      const results: string[] = [];
      for (const c of validCalls) {
        try {
          onProgress?.(humanizeMcpToolAction(c.mcpName, c.toolName, activeSkillName));
          const res = await pluginsStore.callTool(c.mcpId, c.toolName, c.args);
          if (!res) continue;
          let contentStr = "";
          if (res.result?.content && Array.isArray(res.result.content)) {
            contentStr = res.result.content
              .map((item: any) => (typeof item === "string" ? item : item?.text || JSON.stringify(item)))
              .join("\n");
          } else if (res.content && Array.isArray(res.content)) {
            contentStr = res.content
              .map((item: any) => (typeof item === "string" ? item : item?.text || JSON.stringify(item)))
              .join("\n");
          } else if (res.result) {
            contentStr = typeof res.result === "string" ? res.result : JSON.stringify(res.result, null, 2);
          } else {
            contentStr = typeof res === "string" ? res : JSON.stringify(res, null, 2);
          }
          // Intelligent payload compacting: trim large outputs, strip redundant whitespace
          let cleanContent = contentStr.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
          const trimmed = cleanContent.length > 16000 ? cleanContent.slice(0, 16000) + "\n...[dados extensos truncados para economia de tokens]" : cleanContent;
          results.push(`\n\n[DADOS AUDITADOS RETORNADOS DO MCP LOCAL: ${c.mcpName} • FERRAMENTA: ${c.toolName} • ARGS: ${JSON.stringify(c.args)}]:\n${trimmed}\nATENÇÃO: Utilize com rigor fiduciário esses dados factuais reais retornados pelo servidor MCP para responder à consulta do usuário.`);
        } catch (e: any) {
          console.warn(`[MCP] Failed to call ${c.toolName}:`, e);
        }
      }
      liveMcpData = results.join("");
    }
  }

  const memoryAndFormattingInstruction = `\n\nDiretrizes Universais de Execução & Padrão de Resposta:
1. DIRETRIZ GERAL & TOM EXECUTIVO:
   - Responda como Staggi, motor analítico e copiloto fiduciário de alta inteligência para assessores de investimento e wealth managers.
   - Linguagem executiva, concisa, matemática e sem prolixidade. Utilize Markdown com tabelas limpas.
   - NUNCA use prefixos técnicos, narrações de processo, metalinguagem ou menções a ferramentas internas (ex: "selecionando ferramenta...", "consultando mcp...", "acessando base...", "usando ferramenta...", "vou buscar..."). Responda diretamente com naturalidade, dados e autoridade.

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

5. FORMATAÇÃO ELEGANTE DE TABELAS & DADOS DE MCP:
   - Ao formatar tabelas Markdown a partir de dados de servidores MCP ou bancos de dados, garanta cabeçalhos concisos e dados limpos.
   - Evite colunas excessivamente largas ou descrições extensas em células de tabelas; prefira números, percentuais, datas ou códigos curtos nas colunas e reserve análises textuais descritivas para parágrafos antes ou depois da tabela.
   - Nunca cuspa blocos brutos de JSON soltos no meio do texto quando responder ao usuário: processe, sintetize e converta os dados em tabelas ou listas executivas limpas.

6. AUDITORIA E CITAÇÃO DE FONTES:
   - Se dados de ferramentas ou servidores MCP locais foram retornados acima ([DADOS AUDITADOS RETORNADOS DO MCP LOCAL: <NomeDoMcp> • FERRAMENTA: <NomeDaTool>]):
     Você DEVE citar EXATAMENTE o servidor MCP e a ferramenta consultada no rodapé da resposta: "Fonte Auditada: <NomeDoMcp> • <NomeDaTool>".
     Exemplo real: se consultou o MCP "staggi-portfolio" com a ferramenta "list_clients", finalize estritamente com: "Fonte Auditada: staggi-portfolio • list_clients".
     É ESTRITAMENTE PROIBIDO inventar fontes como "B3", "SEC EDGAR", "Market Consensus" ou "Consenso Sell-Side" quando os dados vieram de um MCP local do usuário ou ferramenta específica.
   - Se nenhuma ferramenta/MCP foi consultada, NÃO inclua nenhum rodapé de "Fonte Auditada".
 
7. APRESENTAÇÃO DE PORTFÓLIO E DISTRIBUIÇÃO DE CARTEIRA:
   - Ao apresentar o portfólio, posições ou carteira de um cliente, estruture os dados em formato claro com Ativo/Classe, Categoria, Valor e Percentual (%) da carteira.
   - Isso permite ao Staggi renderizar automaticamente o gráfico visual interativo de distribuição de portfólio (Donut Chart & Alocações) em conjunto com a tabela analítica completa.

8. ADERÊNCIA AO SECOND BRAIN & PREFERÊNCIAS MEMORIZADAS:
   - Se diretrizes ou fatos do [SECOND BRAIN & MEMÓRIA DE LONGO PRAZO DO ASSESSOR] estiverem presentes no contexto, aplique-os com rigor fiduciário (ex: respeitar restrições de clientes, diretrizes de governança, teses de alocação e regras fiscais).

9. DESAMBIGUAÇÃO FIDUCIÁRIA OBRIGATÓRIA (ASSESSOR vs. CLIENTE & HOMÔNIMOS):
   - Quando os dados auditados do MCP retornarem "ambiguity_detected": true ou múltiplos clientes correspondentes ("total_matching_in_database" > 1 em list_clients):
     1) NUNCA escolha arbitrariamente uma conta nem diga que existem menos clientes do que "total_matching_in_database".
     2) Informe com precisão executiva o total exato encontrado na base: tanto o(s) Assessor(es) correspondente(s) (com total de clientes e AUM do book, se houver) quanto o total real de Clientes Investidores encontrados (listando os clientes retornados com código da conta STG..., AUM e assessor responsável).
     3) Ao final, pergunte objetivamente ao usuário se deseja aprofundar no Book consolidado do Assessor ou na carteira detalhada de qual Cliente Investidor específico.`;

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

  // Prefix-Stable System Instruction (enables automatic Prompt Caching on Claude, OpenAI & Gemini):
  // Put static, invariant instructions at the start of systemInstruction so token caches hit across turns.
  const staticHeader = `Você é o Staggi, o motor de inteligência e copiloto executivo para assessores de investimento e wealth managers no Brasil. Suas respostas devem ser de alto padrão, numéricas, concisas, sem rodeios desnecessários, com foco em alocação patrimonial, governança offshore, tributação (Lei 14.754/23) e fluxo de proventos.`;
  
  const systemInstruction = `${staticHeader}${memoryAndFormattingInstruction}${enforcementDirective}${skillsInstructions}${mcpsContext}${dateContext}${secondBrainContext}${explicitSkillDirective}${liveMcpData}${portfolioContext ? `\n\nContexto do Portfólio: ${JSON.stringify(portfolioContext)}` : ""}`;

  try {
    const allToolsLabel = formatToolsSummary(executedTools);
    onProgress?.("Synthesizing response...");
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
