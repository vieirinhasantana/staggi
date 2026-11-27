import type { ParsedAssetQuote } from '$lib/types';

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

  const highMatch = rawText.match(/Máxima\s*do\s*Dia:?\*?\*?\s*([R$\w\s\d,.]+?)(?:\n|$)/i);
  const dayHigh = highMatch ? highMatch[1].trim() : undefined;

  const lowMatch = rawText.match(/Mínima\s*do\s*Dia:?\*?\*?\s*([R$\w\s\d,.]+?)(?:\n|$)/i);
  const dayLow = lowMatch ? lowMatch[1].trim() : undefined;

  const volMatch = rawText.match(/Volume:?\*?\*?\s*([\d,.]+)/i);
  const volume = volMatch ? volMatch[1].trim() : undefined;

  const historyMatch = rawText.match(/Histórico\s*Recente\s*\([^)]*\):?\*?\*?\s*([0-9.,\s]+)/i);
  let historyPrices: number[] | undefined;
  if (historyMatch) {
    historyPrices = historyMatch[1]
      .split(",")
      .map(p => parseFloat(p.trim().replace(",", ".")))
      .filter(n => !isNaN(n));
  }

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
    relevantFact,
    dayHigh,
    dayLow,
    volume,
    historyPrices
  };
}

