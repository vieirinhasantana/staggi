import type { ChatMessage, QuickPrompt, MessageType } from "$lib/types";

// Pílulas de acesso rápido no Spotlight
export const quickPrompts: QuickPrompt[] = [
  { id: "dividends", label: "💰 Proventos & JCP", prompt: "Qual o fluxo de dividendos e proventos previstos?" },
  { id: "news", label: "🔔 Notícias & Yahoo Finance", prompt: "Quais as notícias e fatos relevantes de hoje com análise Gemini?" },
  { id: "statement", label: "📑 Extrato & Retenções", prompt: "Apresentar o extrato consolidado e retenções de IR" },
  { id: "report", label: "📋 Relatório Executivo Gemini", prompt: "Gerar parecer e relatório executivo da carteira" },
  { id: "allocation", label: "📊 Alocação de Ativos", prompt: "Qual a alocação consolidada da carteira?" },
  { id: "liquidity", label: "💧 Liquidez & Resgates", prompt: "Qual a liquidez imediata disponível?" },
  { id: "maturity", label: "⏳ Próximos Vencimentos", prompt: "Quais os títulos e vencimentos nos próximos 30 dias?" },
  { id: "tax", label: "🌐 Offshore & US Tax", prompt: "Como está a blindagem do US Estate Tax?" }
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

// Fallback caso a API do Gemini não esteja configurada
export function generateAdvisorResponse(userPrompt: string): ChatMessage {
  const time = new Date().toLocaleTimeString().slice(0, 5);
  const id = String(Date.now());

  return {
    id,
    sender: "staggi",
    text: `⚠️ Chave do Google Gemini não configurada.\n\nPara consultar dados em tempo real sobre "${userPrompt}" cruzando servidores MCP e cotações de mercado ao vivo, adicione sua chave de API nas Configurações (⚙).`,
    time,
    type: "text"
  };
}
