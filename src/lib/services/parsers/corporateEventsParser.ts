import type { ParsedCorporateEvents, CorporateEventItem, CorporateEventCategory, EventDetailItem } from '$lib/types';

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

