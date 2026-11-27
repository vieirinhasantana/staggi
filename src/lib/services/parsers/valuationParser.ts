import type { ParsedValuationProjection } from '$lib/types';

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

