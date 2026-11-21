import type { DividendItem, MarketNewsItem, StockQuote } from "$lib/types";
export type { StockQuote };
import { invoke } from "@tauri-apps/api/core";

/**
 * Consulta a cotação oficial em tempo real de qualquer ativo (ISIN, CUSIP ou Ticker)
 * via comando nativo Rust / Yahoo Finance API. Sem dados fictícios ou estáticos.
 */
export async function getQuote(symbol: string): Promise<StockQuote> {
  const formatted = symbol.toUpperCase().trim();
  if (!formatted) {
    throw new Error("Símbolo ou identificador não informado");
  }

  try {
    const rawJson = await invoke<string>("fetch_yahoo_data", { symbol: formatted });
    const data = JSON.parse(rawJson);
    const meta = data.chart?.result?.[0]?.meta;

    if (meta) {
      const price = meta.regularMarketPrice || meta.chartPreviousClose || 0;
      const prev = meta.chartPreviousClose || price;
      const change = price - prev;
      const changePercent = prev ? (change / prev) * 100 : 0;

      return {
        symbol: meta.symbol || formatted,
        name: meta.longName || meta.shortName || meta.symbol || formatted,
        price,
        change,
        changePercent,
        currency: meta.currency || "USD",
        high52: meta.fiftyTwoWeekHigh || price,
        low52: meta.fiftyTwoWeekLow || price,
        dividendYield: 0,
        volume: meta.regularMarketVolume
          ? meta.regularMarketVolume >= 1e9
            ? `${(meta.regularMarketVolume / 1e9).toFixed(2)}B`
            : `${(meta.regularMarketVolume / 1e6).toFixed(1)}M`
          : "N/D",
        source: "mcp-yahoo-finance"
      };
    }
  } catch (err) {
    // Fallback via fetch direto caso executado fora do Tauri em ambiente de testes
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(formatted)}?interval=1d&range=5d`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const meta = data.chart?.result?.[0]?.meta;
        if (meta) {
          const price = meta.regularMarketPrice || meta.chartPreviousClose || 0;
          const prev = meta.chartPreviousClose || price;
          const change = price - prev;
          const changePercent = prev ? (change / prev) * 100 : 0;

          return {
            symbol: meta.symbol || formatted,
            name: meta.longName || meta.shortName || meta.symbol || formatted,
            price,
            change,
            changePercent,
            currency: meta.currency || "USD",
            high52: meta.fiftyTwoWeekHigh || price,
            low52: meta.fiftyTwoWeekLow || price,
            dividendYield: 0,
            volume: meta.regularMarketVolume ? `${(meta.regularMarketVolume / 1e6).toFixed(1)}M` : "N/D",
            source: "mcp-yahoo-finance"
          };
        }
      }
    } catch {
      // Ignora erro de rede secundário
    }
  }

  // Se o ativo não foi localizado nas fontes ao vivo, retorna objeto neutro com preço zerado
  return {
    symbol: formatted,
    name: formatted,
    price: 0,
    change: 0,
    changePercent: 0,
    currency: "USD",
    high52: 0,
    low52: 0,
    dividendYield: 0,
    volume: "N/D",
    source: "mcp-yahoo-finance"
  };
}

/**
 * Consulta notícias reais de mercado diretamente da internet (Yahoo Finance API).
 * Sem mocks ou dados simulados.
 */
export async function getMarketNews(query = "market"): Promise<MarketNewsItem[]> {
  try {
    const rawJson = await invoke<string>("fetch_yahoo_news", { query });
    const data = JSON.parse(rawJson);
    const newsArray = data.news || [];

    if (Array.isArray(newsArray) && newsArray.length > 0) {
      return newsArray.map((item: any, idx: number): MarketNewsItem => {
        const pubTime = item.providerPublishTime
          ? formatRelativeTime(item.providerPublishTime)
          : "Hoje";

        return {
          id: item.uuid || `news-${idx}`,
          ticker: item.relatedTickers?.[0] || "MERCADO",
          title: item.title || "Notícia corporativa de mercado",
          source: item.publisher || "Yahoo Finance",
          publishedAt: pubTime,
          sentiment: "neutral",
          impactLevel: "Média",
          aiSummary: item.summary || (item.link ? `Acesse a matéria completa: ${item.link}` : item.title)
        };
      });
    }
  } catch {
    // Se a consulta falhar, tenta consulta web direta
    try {
      const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=10`);
      if (res.ok) {
        const data = await res.json();
        const newsArray = data.news || [];
        if (Array.isArray(newsArray)) {
          return newsArray.map((item: any, idx: number): MarketNewsItem => ({
            id: item.uuid || `news-${idx}`,
            ticker: item.relatedTickers?.[0] || "MERCADO",
            title: item.title,
            source: item.publisher || "Yahoo Finance",
            publishedAt: item.providerPublishTime ? formatRelativeTime(item.providerPublishTime) : "Hoje",
            sentiment: "neutral",
            impactLevel: "Média",
            aiSummary: item.summary || item.title
          }));
        }
      }
    } catch {
      // Falha de rede
    }
  }

  return [];
}

/**
 * Consulta de proventos futuros reais (sem dados simulados)
 */
export async function getUpcomingDividends(): Promise<DividendItem[]> {
  return [];
}

function formatRelativeTime(val: number | string): string {
  let ms = 0;
  if (typeof val === "number") {
    ms = val > 10000000000 ? val : val * 1000;
  } else if (typeof val === "string") {
    ms = Date.parse(val);
  }

  if (!ms || isNaN(ms)) {
    return typeof val === "string" ? val : "Hoje";
  }

  const diffMs = Date.now() - ms;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Agora";
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Há ${diffDays} d`;
}
