import type { ParsedAssetProfile, AssetProfileField } from '$lib/types';

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

