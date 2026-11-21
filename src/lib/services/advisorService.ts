import type { ChatMessage, QuickPrompt, MessageType } from "$lib/types";

export const quickPrompts: QuickPrompt[] = [
  { id: "dividends", label: "💰 Dividends & Yield", prompt: "What is the projected dividend schedule and 5-year yield history for PETR4 / BBAS3?" },
  { id: "news", label: "🔔 Market Wire & News", prompt: "What are today's top market news and macroeconomic highlights?" },
  { id: "valuation", label: "📈 Valuation & Graham", prompt: "Provide an analytical valuation of BBAS3 with Graham model and Bazin ceiling price." },
  { id: "allocation", label: "📊 Asset Allocation", prompt: "What is the recommended multi-asset fiduciary allocation for a conservative wealth portfolio?" },
  { id: "etfs", label: "🌐 Global ETFs & Holdings", prompt: "Show top holdings, sector weightings, and expense ratios of ETF IVVB11 / SPY." },
  { id: "rates", label: "⚡ Treasury Yields", prompt: "What are the current US Treasury yield curve rates across all maturities today?" }
];

export function detectMessageType(userPrompt: string): MessageType | undefined {
  const lower = userPrompt.toLowerCase();

  if (lower.includes("provento") || lower.includes("dividendo") || lower.includes("jcp") || lower.includes("rendimento") || lower.includes("yield")) {
    return "dividends";
  }

  if (lower.includes("notici") || lower.includes("notíci") || lower.includes("notific") || lower.includes("notifica") || lower.includes("mercado") || lower.includes("fato relevante") || lower.includes("news") || lower.includes("yahoo")) {
    return "news";
  }

  if (lower.includes("extrato") || lower.includes("movimenta") || lower.includes("saldo") || lower.includes("lançamento") || lower.includes("lancamento") || lower.includes("reten")) {
    return "statement";
  }

  if (lower.includes("relatorio") || lower.includes("relatório") || lower.includes("parecer") || lower.includes("executivo") || lower.includes("comite") || lower.includes("comitê") || lower.includes("diagnostico") || lower.includes("diagnóstico")) {
    return "report";
  }

  if (lower.includes("aloca") || lower.includes("carteira") || lower.includes("gráfico") || lower.includes("grafico") || lower.includes("raio-x")) {
    return "allocation";
  }

  if (lower.includes("liquid") || lower.includes("resgate") || lower.includes("imóvel") || lower.includes("imovel") || lower.includes("d+")) {
    return "liquidity";
  }

  if (lower.includes("venc") || lower.includes("ntn") || lower.includes("rolagem") || lower.includes("debênture") || lower.includes("debenture")) {
    return "maturity";
  }

  if (lower.includes("tax") || lower.includes("tribut") || lower.includes("estate") || lower.includes("eua") || lower.includes("irs") || lower.includes("cayman") || lower.includes("offshore")) {
    return "tax";
  }

  return undefined;
}

export function generateAdvisorResponse(userPrompt: string): ChatMessage {
  const time = new Date().toLocaleTimeString().slice(0, 5);
  const id = String(Date.now());

  return {
    id,
    sender: "staggi",
    text: `⚠️ AI API Key not configured.\n\nTo query real-time market data, run valuation models, and invoke MCP tools for "${userPrompt}", please add and validate your API key in Settings (⚙).`,
    time,
    type: "text"
  };
}
