import { marked } from "marked";
import type {
  ParsedAssetQuote,
  EventDetailItem,
  CorporateEventCategory,
  CorporateEventItem,
  ParsedCorporateEvents,
  ParsedValuationProjection,
  DividendPayoutItem,
  AnnualDyHistoryItem,
  ParsedAssetDividends,
  ComparisonRow,
  ParsedComparisonTable,
  AssetProfileField,
  ParsedAssetProfile,
} from "$lib/types";

export type {
  ParsedAssetQuote,
  EventDetailItem,
  CorporateEventCategory,
  CorporateEventItem,
  ParsedCorporateEvents,
  ParsedValuationProjection,
  DividendPayoutItem,
  AnnualDyHistoryItem,
  ParsedAssetDividends,
  ComparisonRow,
  ParsedComparisonTable,
  AssetProfileField,
  ParsedAssetProfile,
};

export function parseSingleAssetProfile(rawText: string): ParsedAssetProfile | null {
  if (!rawText) return null;

  if (
    rawText.includes("Proventos Declarados") ||
    rawText.includes("Dividend Yield (DY)") ||
    rawText.includes("| --- |")
  ) {
    return null;
  }

  const fieldRegex =
    /^\s*(\*{0,2}(?:Tipo de Ativo|Gestora|Emissor|Classe de Ativo|Classe|Foco|Estratégia|Estrategia|Domicílio|Domicilio|Distribuição|Distribuicao|ISIN|Ticker|CUSIP|Vencimento|Cupom|Duration|YTM|Rating|Patrimônio|Patrimonio|Taxa de Administração|Taxa|Moeda|Indexador)\*{0,2})\s*:\s*(.+)$/im;

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  let matchCount = 0;
  for (const line of lines) {
    if (fieldRegex.test(line)) {
      matchCount++;
    }
  }

  if (matchCount < 2) {
    return null;
  }

  let identifier = "";
  let name = "";
  let price: string | undefined;
  let currency: string | undefined;
  let change: string | undefined;
  let assetType: string | undefined;
  let manager: string | undefined;
  let assetClass: string | undefined;
  let focus: string | undefined;
  let domicile: string | undefined;
  let distribution: string | undefined;
  const fields: AssetProfileField[] = [];
  const summaryParagraphs: string[] = [];
  let mcpSource: string | undefined;

  if (/mcp-financedatabase/i.test(rawText)) {
    mcpSource = "FinanceDatabase Global Directory";
  } else if (/mcp-equibles/i.test(rawText)) {
    mcpSource = "Equibles ETF Intelligence";
  } else if (/mcp-bond/i.test(rawText)) {
    mcpSource = "Bond Intelligence";
  } else if (/mcp-treasury/i.test(rawText)) {
    mcpSource = "US Treasury Sovereign Curve";
  } else if (/mcp-tickerinside/i.test(rawText)) {
    mcpSource = "TickerInside Insider Flow";
  }

  const isinMatch = rawText.match(/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/);
  if (isinMatch) {
    identifier = isinMatch[1];
  }

  for (const line of lines) {
    if (/^(?:Consultando|Acessando|Com base)\s+o\s+(?:servidor\s+)?mcp-/i.test(line)) {
      continue;
    }

    const titleWithIdMatch = line.match(
      /^(?:###?\s*)?(?:\d+\.\s*)?\*?\*?([A-Z0-9.]{3,14})\*?\*?(?:\s*[:\-–—]\s*|\s+–\s+|\s+-\s+)\*?\*?([A-Za-zÀ-ÿ0-9\s/&.\-–—()]+)\*?\*?$/
    );
    if (titleWithIdMatch && !name) {
      if (!identifier) identifier = titleWithIdMatch[1];
      name = titleWithIdMatch[2].trim();
      continue;
    }

    const match = line.match(/^\*?\*?([A-Za-zÀ-ÿ\s/()]+)\*?\*?:\s*(.+)$/);
    if (match) {
      const rawLabel = match[1].replace(/\*\*/g, "").trim();
      const value = match[2].trim();

      const lLow = rawLabel.toLowerCase();
      if (
        lLow.includes("cotação") ||
        lLow.includes("cotacao") ||
        lLow.includes("nav") ||
        lLow.includes("preço") ||
        lLow.includes("preco") ||
        lLow.includes("valor da cota")
      ) {
        price = value;
      } else if (lLow === "moeda") {
        currency = value;
      } else if (lLow.includes("variação") || lLow.includes("variacao")) {
        change = value;
      } else if (lLow.includes("tipo de ativo")) {
        assetType = value;
      } else if (lLow.includes("gestora") || lLow.includes("emissor")) {
        manager = value;
      } else if (lLow.includes("classe")) {
        assetClass = value;
      } else if (lLow.includes("foco") || lLow.includes("estratégia") || lLow.includes("estrategia")) {
        focus = value;
      } else if (lLow.includes("domicílio") || lLow.includes("domicilio")) {
        domicile = value;
      } else if (lLow.includes("distribuição") || lLow.includes("distribuicao")) {
        distribution = value;
      } else if (lLow === "isin" || lLow === "ticker" || lLow === "código") {
        if (!identifier) identifier = value;
      } else if (lLow === "nome" || lLow === "ativo") {
        if (!name) name = value;
      }

      fields.push({ label: rawLabel, value });
    } else {
      if (line.length > 25 && !line.startsWith("#")) {
        summaryParagraphs.push(line);
      }
    }
  }

  if (!name) {
    for (const line of lines) {
      if (!line.includes(":") && line.length > 5 && !line.startsWith("Consultando")) {
        name = line.replace(/^###?\s*/, "").trim();
        break;
      }
    }
  }

  if (!identifier) {
    identifier = "ATIVO";
  }
  if (!name) {
    name = identifier;
  }

  return {
    identifier,
    name,
    price,
    currency,
    change,
    assetType,
    manager,
    assetClass,
    focus,
    domicile,
    distribution,
    fields,
    summary: summaryParagraphs.join(" ").trim() || undefined,
    mcpSource: mcpSource || "FinanceDatabase & Yahoo Finance Market Data",
  };
}

export function parseAssetProfiles(rawText: string): ParsedAssetProfile[] {
  if (!rawText) return [];

  if (
    rawText.includes("Proventos Declarados") ||
    rawText.includes("Dividend Yield (DY)") ||
    rawText.includes("| --- |")
  ) {
    return [];
  }

  const isinBoundaryRegex = /(?=(?:^|\n)(?:###?\s*)?[A-Z]{2}[A-Z0-9]{9}\d(?:\s*[:\-–]|\s*\n))/g;
  const parts = rawText.split(isinBoundaryRegex).filter((p) => p.trim().length > 15);

  if (parts.length > 1) {
    const list: ParsedAssetProfile[] = [];
    for (const p of parts) {
      const parsed = parseSingleAssetProfile(p);
      if (parsed) list.push(parsed);
    }
    if (list.length > 0) return list;
  }

  const single = parseSingleAssetProfile(rawText);
  return single ? [single] : [];
}

export function parseAssetProfile(rawText: string): ParsedAssetProfile | null {
  const list = parseAssetProfiles(rawText);
  return list.length > 0 ? list[0] : null;
}

export function detectAuditedSource(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length < 40) return null;

  // Check if it's purely a greeting, casual answer, or conversational exchange
  const isGreetingOrCasual = /^(ol[áa]|bom\s*dia|boa\s*tarde|boa\s*noite|como\s*posso\s*ajudar|ol[áa]!\s*sou\s*o\s*staggi|ol[áa],\s*sou\s*o\s*staggi|tudo\s*bem|obrigad[oa]|de\s*nada|ol[áa]!|ol[áa],)/i.test(trimmed);
  if (isGreetingOrCasual && !text.includes("|") && !text.includes("R$") && !text.includes("US$")) {
    return null;
  }

  // If explicit audited source was provided in the text by the model or MCP
  const explicitMatch = text.match(/(?:Fonte Auditada|Audited Source):\s*([^\n\r.]+)/i);
  if (explicitMatch && explicitMatch[1]) {
    const matched = explicitMatch[1].trim();
    if (matched.length > 2) {
      return matched;
    }
  }

  return null;
}

export function parseAssetQuote(rawText: string): ParsedAssetQuote | null {
  if (!rawText) return null;

  const hasCotacao = /cotação\s*atual/i.test(rawText);
  const hasYahooBullet = /\*\s*\*\*Cotação Atual/i.test(rawText);

  if (!hasCotacao && !hasYahooBullet) {
    return null;
  }

  const priceMatch = rawText.match(/Cotação\s*Atual:?\*?\*?\s*([R$\w\s\d,.]+?)(?:\s*\(([^)]+)\)|\n|$)/i);
  if (!priceMatch) return null;

  const price = priceMatch[1]?.trim() || "";
  const dateInfo = priceMatch[2]?.trim() || "";

  let companyName = "";
  let ticker = "";

  const tickerInParenMatch = rawText.match(/(?:Para\s+)?([A-Za-zÀ-ÿ0-9\s]+?)\s*\(([A-Z0-9.]+)\)/i);
  if (tickerInParenMatch) {
    companyName = tickerInParenMatch[1].replace(/Para\s+/i, "").trim();
    ticker = tickerInParenMatch[2].trim();
  } else {
    const rawTickerMatch = rawText.match(/\b([A-Z]{1,5}(?:\.SA)?|[A-Z]{4}\d{1,2}(?:\.SA)?)\b/);
    if (rawTickerMatch) {
      ticker = rawTickerMatch[1];
      companyName = ticker.replace(".SA", "");
    } else {
      companyName = "Ativo em Análise";
      ticker = "MERCADO";
    }
  }

  const changeMatch = rawText.match(/Variação(?:\s+Diária)?:?\*?\*?\s*([+-]?\s*[\d,.]+\s*%)/i);
  const change = changeMatch ? changeMatch[1].trim() : "0,00%";
  const isPositive = !change.startsWith("-");

  const dyMatch = rawText.match(/Dividend\s*Yield(?:\s*\([^)]*\))?:?\*?\*?\s*([\d,.]+\s*%)/i);
  const dividendYield = dyMatch ? dyMatch[1].trim() : undefined;

  const plMatch = rawText.match(/P\/L(?:\s*\([^)]*\))?:?\*?\*?\s*([\d,.]+\s*x?)/i);
  const pl = plMatch ? plMatch[1].trim() : undefined;

  const pvpMatch = rawText.match(/P\/VP:?\*?\*?\s*([\d,.]+\s*x?)/i);
  const pvp = pvpMatch ? pvpMatch[1].trim() : undefined;

  const factMatch = rawText.match(/Fato\s*Relevante(?:\s*Recente)?:?\*?\*?\s*([\s\S]+?)(?:\n\n[A-Z]|$)/i);
  const relevantFact = factMatch ? factMatch[1].trim().replace(/^\*\s*/, "") : undefined;

  return {
    companyName,
    ticker,
    price,
    dateInfo,
    change,
    isPositive,
    dividendYield,
    pl,
    pvp,
    relevantFact
  };
}

function categorizeEvent(title: string, body: string): CorporateEventCategory {
  const t = title.toLowerCase();
  const b = body.toLowerCase();

  if (/\b(ai|ia|inteligência|azure|cloud|copilot|software|nuvem)\b/i.test(t)) {
    return "Tech & AI";
  }
  if (t.includes("parceria") || t.includes("partnership") || t.includes("acordo") || t.includes("reestrutura") || t.includes("fusão") || t.includes("merger") || t.includes("aquisi") || t.includes("acquisition") || t.includes("separação") || t.includes("desinvest") || t.includes("estratég") || t.includes("strategy")) {
    return "Strategy";
  }
  if (t.includes("interrup") || t.includes("bug") || t.includes("falha") || t.includes("outage") || t.includes("serviço") || t.includes("produção") || t.includes("operac") || t.includes("operations")) {
    return "Operations";
  }
  if (t.includes("resultado") || t.includes("earnings") || t.includes("receita") || t.includes("revenue") || t.includes("lucro") || t.includes("profit") || t.includes("fiscal") || t.includes("ebitda") || t.includes("margem") || /\b[1-4]t\d{2}\b/i.test(t) || /\b[1-4]q\d{2}\b/i.test(t)) {
    return "Earnings";
  }
  if (t.includes("provento") || t.includes("dividendo") || t.includes("dividend") || t.includes("payout") || t.includes("jcp")) {
    return "Dividends";
  }
  if (t.includes("preço") || t.includes("price") || t.includes("pricing") || t.includes("combust")) {
    return "Pricing";
  }

  if (b.includes("receita") || b.includes("revenue") || b.includes("lucro") || b.includes("profit") || b.includes("ebitda") || b.includes("margem líquida") || b.includes("earnings")) {
    return "Earnings";
  }
  if (b.includes("inteligência artificial") || b.includes("artificial intelligence") || b.includes("openai") || b.includes("azure") || b.includes("cloud")) {
    return "Tech & AI";
  }
  if (b.includes("parceria") || b.includes("partnership") || b.includes("acordo") || b.includes("deal") || b.includes("fusão") || b.includes("aquisição")) {
    return "Strategy";
  }
  if (b.includes("interrupção") || b.includes("outage") || b.includes("falha") || b.includes("bug")) {
    return "Operations";
  }
  if (b.includes("dividendo") || b.includes("dividend") || b.includes("payout") || b.includes("jcp")) {
    return "Dividends";
  }

  return "General";
}

function extractKeyMetrics(body: string): EventDetailItem[] {
  const details: EventDetailItem[] = [];

  const subDetailRegex = /\*\s+\*\*([^*]+?):?\*\*\s*([^\n]+)/g;
  let subMatch: RegExpExecArray | null;
  while ((subMatch = subDetailRegex.exec(body)) !== null) {
    details.push({
      label: subMatch[1].trim().replace(/:$/, ""),
      value: subMatch[2].trim()
    });
  }

  if (details.length > 0) return details;

  const metricRegex = /((?:US\$|R\$|€)\s*[\d,.]+\s*(?:bilh[õo]es|milh[õo]es|bi|mi)?|[+-]?\s*\d+(?:,\d+)?%\s*(?:A\/A|a\.a\.|trimestral)?)/gi;
  const matches = body.match(metricRegex);
  if (matches) {
    const unique = [...new Set(matches.map(m => m.trim()))].slice(0, 3);
    for (const val of unique) {
      details.push({
        label: val.includes("%") ? "Variação / Crescimento" : "Volume / Cifra",
        value: val
      });
    }
  }

  return details;
}

export function parseCorporateEvents(rawText: string): ParsedCorporateEvents | null {
  if (!rawText || rawText.trim().length < 20) return null;

  if (/\|[^\n|]+\|[^\n|]+\|/m.test(rawText)) {
    return null;
  }

  const isCorporateEventText = 
    /fatos?\s+relevantes?/i.test(rawText) ||
    /eventos?\s+(?:corporativos?|recentes?)/i.test(rawText) ||
    /not[íi]cias?\s+(?:sobre|recentes?|da|do|corporativas?)/i.test(rawText) ||
    /comunicados?\s+ao\s+mercado/i.test(rawText);

  if (!isCorporateEventText) return null;

  let ticker = "";
  let companyName = "";

  const companyTickerMatch = rawText.match(/(?:sobre\s+(?:a|o)?\s*|Para\s+)?([A-Za-zÀ-ÿ0-9\s]+?)\s*\(([A-Z0-9.]{1,8})\)/i);
  if (companyTickerMatch) {
    companyName = companyTickerMatch[1]
      .replace(/^(?:Os fatos relevantes|Fatos relevantes|Notícias|Noticias)\s+(?:mais recentes\s+)?(?:sobre\s+(?:a|o)?\s*)?/i, "")
      .trim();
    ticker = companyTickerMatch[2].trim();
  }

  if (!ticker) {
    const rawTickerMatch = rawText.match(/\b([A-Z]{1,5}(?:\.SA)?|[A-Z]{4}\d{1,2}(?:\.SA)?)\b/);
    if (rawTickerMatch) {
      ticker = rawTickerMatch[1];
    }
  }

  if (!companyName) {
    const sobreMatch = rawText.match(/sobre\s+(?:a|o)?\s*([A-Za-zÀ-ÿ0-9\s]+?)(?:\s*\(|:|\n)/i);
    if (sobreMatch) {
      companyName = sobreMatch[1].trim();
    } else if (ticker) {
      companyName = ticker.replace(".SA", "");
    } else {
      companyName = "Radar Corporativo";
      ticker = "MERCADO";
    }
  }

  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  let intro = "Fatos relevantes e eventos recentes identificados:";
  const firstLine = lines[0];
  if (firstLine.endsWith(":") || firstLine.length < 120) {
    intro = firstLine;
  }

  const events: CorporateEventItem[] = [];
  let itemCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (i === 0 && (line.endsWith(":") || line.toLowerCase().includes("incluem:"))) {
      continue;
    }

    if (line.includes("|")) continue;

    if (/^(?:Para\s+uma\s+análise|Caso\s+precise|Se\s+desejar|Em\s+caso\s+de)/i.test(line)) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex > 3 && colonIndex < 85) {
      const rawTitle = line.substring(0, colonIndex)
        .replace(/^[\d\.\*\-•\s]+/, "")
        .replace(/\*\*/g, "")
        .trim();

      let rawBody = line.substring(colonIndex + 1).trim();

      while (i + 1 < lines.length && (lines[i + 1].startsWith("*") || lines[i + 1].startsWith("-") || !lines[i + 1].includes(":"))) {
        if (/^(?:Para\s+uma\s+análise|Caso\s+precise|Se\s+desejar)/i.test(lines[i + 1])) break;
        rawBody += "\n" + lines[i + 1];
        i++;
      }

      if (rawTitle.length >= 3 && rawBody.length >= 10) {
        const cat = categorizeEvent(rawTitle, rawBody);
        const details = extractKeyMetrics(rawBody);

        let cleanDesc = rawBody;
        const subIndex = rawBody.search(/\n\s*[\*\-]/);
        if (subIndex !== -1) {
          cleanDesc = rawBody.substring(0, subIndex).trim();
        }

        events.push({
          number: itemCounter++,
          title: rawTitle,
          category: cat,
          description: cleanDesc,
          details
        });
      }
    }
  }

  if (events.length < 2) return null;

  const footerMatch = rawText.match(/\n\n?((?:Para\s+uma\s+análise|Caso\s+precise|Se\s+desejar)[\s\S]+)$/i);
  const footer = footerMatch ? footerMatch[1].trim() : undefined;

  return {
    companyName,
    ticker: ticker || companyName,
    intro,
    events,
    footer
  };
}

export function parseValuationProjection(rawText: string): ParsedValuationProjection | null {
  if (!rawText) return null;

  const hasValuationKeywords = 
    /preço\s*(?:teto|justo|alvo)/i.test(rawText) ||
    /graham/i.test(rawText) ||
    /bazin/i.test(rawText) ||
    /margem\s*de\s*segurança/i.test(rawText) ||
    (/projeç[ãa]o/i.test(rawText) && (rawText.includes("ROE") || rawText.includes("P/L") || rawText.includes("DY") || rawText.includes("Bazin")));

  if (!hasValuationKeywords) return null;

  let ticker = "";
  let companyName = "";

  const companyTickerMatch = rawText.match(/(?:Para\s+)?([A-Za-zÀ-ÿ0-9\s]+?)\s*\(([A-Z0-9.]{1,8})\)/i);
  if (companyTickerMatch) {
    companyName = companyTickerMatch[1].replace(/Para\s+/i, "").trim();
    ticker = companyTickerMatch[2].trim();
  } else {
    const rawTickerMatch = rawText.match(/\b([A-Z]{1,5}(?:\.SA)?|[A-Z]{4}\d{1,2}(?:\.SA)?)\b/);
    if (rawTickerMatch) {
      ticker = rawTickerMatch[1];
      companyName = ticker.replace(".SA", "");
    }
  }

  if (!ticker) return null;

  const priceMatch = rawText.match(/Cotação\s*(?:Atual)?:?\*?\*?\s*([R$\w\s\d,.]+?)(?:\s*\(([^)]+)\)|\n|$)/i);
  const currentPrice = priceMatch ? priceMatch[1].trim() : undefined;

  const bazinMatch = rawText.match(/Preço\s*Teto(?:\s*\([^)]*\))?:?\*?\*?\s*([R$\w\s\d,.]+?)(?:\n|$)/i);
  const bazinCeilingPrice = bazinMatch ? bazinMatch[1].trim() : undefined;

  const grahamMatch = rawText.match(/Preço\s*Justo(?:\s*\([^)]*\))?:?\*?\*?\s*([R$\w\s\d,.]+?)(?:\n|$)/i);
  const grahamPrice = grahamMatch ? grahamMatch[1].trim() : undefined;

  const targetMatch = rawText.match(/Preço[\s-]*Alvo(?:\s*Consenso)?:?\*?\*?\s*([R$\w\s\d,.]+?)(?:\n|$)/i);
  const targetPrice = targetMatch ? targetMatch[1].trim() : undefined;

  const marginMatch = rawText.match(/Margem\s*de\s*Segurança:?\*?\*?\s*([+-]?\s*[\d,.]+\s*%)/i);
  const safetyMargin = marginMatch ? marginMatch[1].trim() : undefined;

  const roeMatch = rawText.match(/ROE:?\*?\*?\s*([\d,.]+\s*%)/i);
  const roe = roeMatch ? roeMatch[1].trim() : undefined;

  const plMatch = rawText.match(/P\/L:?\*?\*?\s*([\d,.]+\s*x?)/i);
  const pl = plMatch ? plMatch[1].trim() : undefined;

  const pvpMatch = rawText.match(/P\/VP:?\*?\*?\s*([\d,.]+\s*x?)/i);
  const pvp = pvpMatch ? pvpMatch[1].trim() : undefined;

  const dyMatch = rawText.match(/(?:DY|Dividend\s*Yield)\s*(?:Projetado|Estimado)?:?\*?\*?\s*([\d,.]+\s*%)/i);
  const projectedDy = dyMatch ? dyMatch[1].trim() : undefined;

  const recMatch = rawText.match(/Recomendaç[ãa]o:?\*?\*?\s*([A-Za-zÀ-ÿ]+)/i);
  const recommendation = recMatch ? recMatch[1].trim() : "Análise Estratégica";

  const metricsCount = [bazinCeilingPrice, grahamPrice, targetPrice, safetyMargin, currentPrice].filter(Boolean).length;
  if (metricsCount < 2) return null;

  const summaryMatch = rawText.match(/(?:Síntese|Conclusão|Racional|Diagnóstico):?\*?\*?\s*([^\n]+)/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : "Projeção fundamentalista consolidada com base em múltiplos históricos e projeções de proventos.";

  return {
    companyName: companyName || ticker,
    ticker,
    currentPrice,
    targetPrice,
    grahamPrice,
    bazinCeilingPrice,
    safetyMargin,
    projectedDy,
    roe,
    pl,
    pvp,
    recommendation,
    summary
  };
}

export function parseAssetDividends(rawText: string): ParsedAssetDividends | null {
  if (!rawText) return null;

  const hasDividendsKeywords = 
    /proventos?\s+(?:declarados|pagos|recentes)/i.test(rawText) ||
    /hist[óo]rico\s+de\s+proventos/i.test(rawText) ||
    /dividend\s*yield\s*\((?:dy\))?\s*hist[óo]rico/i.test(rawText) ||
    (rawText.includes("JCP") && rawText.includes("Data Ex") && (rawText.includes("Dividendo") || rawText.includes("Div.")));

  if (!hasDividendsKeywords) return null;

  let ticker = "";
  let companyName = "";

  const companyTickerMatch = rawText.match(/(?:Para\s+o|sobre\s+(?:o|a)?)\s*([A-Za-zÀ-ÿ0-9\s]+?)\s*\(([A-Z0-9.]{1,8})\)/i);
  if (companyTickerMatch) {
    companyName = companyTickerMatch[1].trim();
    ticker = companyTickerMatch[2].trim();
  } else {
    const rawTickerMatch = rawText.match(/\b([A-Z]{1,5}(?:\.SA)?|[A-Z]{4}\d{1,2}(?:\.SA)?)\b/);
    if (rawTickerMatch) {
      ticker = rawTickerMatch[1];
      companyName = ticker.replace(".SA", "");
    }
  }

  if (!ticker) return null;

  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  let intro = "";
  const firstLine = lines[0];
  if (!firstLine.includes("\t") && !firstLine.includes("|") && firstLine.length > 20) {
    intro = firstLine;
    if (lines.length > 1 && !lines[1].includes("\t") && !lines[1].includes("|") && !lines[1].includes("Proventos Declarados")) {
      intro += " " + lines[1];
    }
  }

  const payouts: DividendPayoutItem[] = [];
  const annualHistory: AnnualDyHistoryItem[] = [];
  let mode: "none" | "payouts" | "history" | "note" = "none";
  let footer: string | undefined;

  for (const line of lines) {
    if (line.includes("Proventos Declarados") || (line.includes("Tipo") && (line.includes("Valor") || line.includes("Data")))) {
      mode = "payouts";
      continue;
    }
    if (line.includes("Dividend Yield (DY)") || (line.includes("Ano") && (line.includes("Dividendos Totais") || line.includes("DY")))) {
      mode = "history";
      continue;
    }
    if (line.startsWith("Nota:") || line.startsWith("Observação:") || line.startsWith("Fonte:")) {
      mode = "note";
      footer = line;
      continue;
    }

    let parts: string[] = [];
    if (line.includes("\t")) {
      parts = line.split("\t").map(p => p.trim());
    } else if (line.includes("|")) {
      parts = line.split("|").map(p => p.trim()).filter(Boolean);
    } else {
      parts = line.split(/\s{2,}/).map(p => p.trim());
    }

    if (mode === "payouts" && parts.length >= 3) {
      const col0 = parts[0].toLowerCase();
      if (col0.includes("tipo") || col0.includes("---")) continue;

      const isJcp = col0.includes("jcp");
      const isDiv = col0.includes("div");
      if (!isJcp && !isDiv) continue;

      payouts.push({
        type: isJcp ? "JCP" : "Dividendo",
        value: parts[1].startsWith("R$") ? parts[1] : `R$ ${parts[1]}`,
        exDate: parts[2] || "-",
        payDate: parts[3] || parts[2] || "-"
      });
    } else if (mode === "history" && parts.length >= 3) {
      const col0 = parts[0].toLowerCase();
      if (col0.includes("ano") || col0.includes("---")) continue;

      if (!/^\d{4}$/.test(parts[0])) continue;

      annualHistory.push({
        year: parts[0],
        totalPaid: parts[1].startsWith("R$") ? parts[1] : `R$ ${parts[1]}`,
        avgPrice: parts[2].startsWith("R$") || parts[2] === "N/D" ? parts[2] : `R$ ${parts[2]}`,
        dy: parts[3] ? (parts[3].endsWith("%") || parts[3] === "N/D" ? parts[3] : `${parts[3]}%`) : "N/D"
      });
    }
  }

  if (payouts.length === 0 && annualHistory.length === 0) {
    return null;
  }

  return {
    companyName: companyName || ticker,
    ticker,
    intro: intro || "Histórico consolidado de proventos distribuídos e evolução de Dividend Yield.",
    payouts,
    annualHistory,
    footer
  };
}

export function parseComparisonTable(_rawText: string): ParsedComparisonTable | null {
  // Markdown tables are rendered natively and accurately via renderMarkdown
  // without intercepting or replacing generic tabular data (clients, portfolios, products, etc.)
  return null;
}

export function renderMarkdown(content: string): string {
  if (!content) return "";
  try {
    let processed = content;

    processed = processed.replace(/^Consultando\s+o\s+mcp-[a-z0-9_-]+[^\n]*:?\s*\n?/gim, "");
    processed = processed.replace(/^Acessando\s+o\s+servidor\s+mcp-[a-z0-9_-]+[^\n]*:?\s*\n?/gim, "");
    processed = processed.replace(/^Com\s+base\s+no\s+mcp-[a-z0-9_-]+[^\n]*:?\s*\n?/gim, "");
    processed = processed.replace(/(?:\n|^)\s*(?:Fonte Auditada|Audited Source):\s*[^\n]+/gi, "");

    processed = processed.replace(/\|\s*\|\s*(?=[A-Za-z0-9\*\_\#])/g, "|\n|");

    const rawLines = processed.split("\n");
    const mergedLines: string[] = [];
    let accumulator = "";

    for (const l of rawLines) {
      const trimmed = l.trim();
      if (!trimmed) {
        if (accumulator) {
          mergedLines.push(accumulator);
          accumulator = "";
        }
        mergedLines.push(l);
        continue;
      }

      if (accumulator) {
        accumulator += " " + trimmed;
        if (accumulator.endsWith("|")) {
          mergedLines.push(accumulator);
          accumulator = "";
        }
      } else if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        mergedLines.push(trimmed);
      } else if (trimmed.startsWith("|")) {
        accumulator = trimmed;
      } else {
        mergedLines.push(l);
      }
    }
    if (accumulator) {
      mergedLines.push(accumulator);
    }
    processed = mergedLines.join("\n");

    if (processed.includes("\t")) {
      const lines = processed.split("\n");
      const convertedLines: string[] = [];
      let inTabTable = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split("\t").map(p => p.trim());
        if (parts.length >= 3) {
          if (!inTabTable) {
            inTabTable = true;
            convertedLines.push("| " + parts.join(" | ") + " |");
            convertedLines.push("| " + parts.map(() => "---").join(" | ") + " |");
          } else {
            convertedLines.push("| " + parts.join(" | ") + " |");
          }
        } else {
          inTabTable = false;
          convertedLines.push(line);
        }
      }
      processed = convertedLines.join("\n");
    }

    const lines = processed.split("\n");
    const fixedLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      fixedLines.push(lines[i]);
      if (
        l.startsWith("|") &&
        l.endsWith("|") &&
        l.split("|").length >= 3 &&
        !l.includes("---") &&
        i + 1 < lines.length &&
        lines[i + 1].trim().startsWith("|") &&
        !lines[i + 1].includes("---")
      ) {
        const colCount = l.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).length;
        fixedLines.push("| " + Array(colCount).fill("---").join(" | ") + " |");
      }
    }
    processed = fixedLines.join("\n");

    return marked.parse(processed, { breaks: true, gfm: true }) as string;
  } catch {
    return content;
  }
}
