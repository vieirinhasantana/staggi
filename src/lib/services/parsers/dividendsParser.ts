import type { ParsedAssetDividends, DividendPayoutItem, AnnualDyHistoryItem } from '$lib/types';

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

