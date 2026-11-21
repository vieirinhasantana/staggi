export interface DividendItem {
  ticker: string;
  type: "Dividendo" | "JCP" | "Rendimento FII";
  valuePerShare: number;
  totalValue: number;
  dataCom: string;
  paymentDate: string;
  status: "Provisionado" | "Pago";
}

export interface MarketNewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  ticker: string;
  sentiment: "positive" | "negative" | "neutral";
  aiSummary: string;
  impactLevel: "Alta" | "Média" | "Informativa";
  url?: string;
}

export interface StatementEntry {
  id: string;
  date: string;
  description: string;
  asset: string;
  category: "Provento" | "Aplicação" | "Resgate" | "Imposto (IR)";
  value: number;
  isCredit: boolean;
  retentionNote?: string;
}

export interface ExecutiveReportData {
  title: string;
  generatedAt: string;
  aum: string;
  riskScore: string;
  volatility12m: string;
  sharpeRatio: string;
  geminiExecutiveSummary: string;
  keyActionItems: string[];
  rebalanceRecommendations: Array<{
    assetClass: string;
    action: "Aumentar" | "Reduzir" | "Manter";
    targetDelta: string;
    rationale: string;
  }>;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  high52: number;
  low52: number;
  dividendYield: number;
  volume: string;
  source: "mcp-yahoo-finance";
}

export interface ParsedAssetQuote {
  companyName: string;
  ticker: string;
  price: string;
  dateInfo?: string;
  change: string;
  isPositive: boolean;
  dividendYield?: string;
  pl?: string;
  pvp?: string;
  relevantFact?: string;
}

export interface EventDetailItem {
  label: string;
  value: string;
}

export type CorporateEventCategory = 
  | "Earnings"
  | "Tech & AI"
  | "Strategy"
  | "Operations"
  | "Pricing"
  | "Dividends"
  | "General"
  | "Resultados" 
  | "Tecnologia & IA" 
  | "Estratégia" 
  | "Operacional" 
  | "Preços" 
  | "Proventos" 
  | "Geral";

export interface CorporateEventItem {
  number: number;
  title: string;
  category: CorporateEventCategory;
  description: string;
  details: EventDetailItem[];
}

export interface ParsedCorporateEvents {
  companyName: string;
  ticker: string;
  intro: string;
  events: CorporateEventItem[];
  footer?: string;
}

export interface ParsedValuationProjection {
  companyName: string;
  ticker: string;
  currentPrice?: string;
  targetPrice?: string;
  grahamPrice?: string;
  bazinCeilingPrice?: string;
  safetyMargin?: string;
  projectedDy?: string;
  roe?: string;
  pl?: string;
  pvp?: string;
  recommendation?: string;
  summary: string;
}

export interface DividendPayoutItem {
  type: "JCP" | "Dividendo";
  value: string;
  exDate: string;
  payDate: string;
}

export interface AnnualDyHistoryItem {
  year: string;
  totalPaid: string;
  avgPrice: string;
  dy: string;
}

export interface ParsedAssetDividends {
  companyName: string;
  ticker: string;
  intro: string;
  payouts: DividendPayoutItem[];
  annualHistory: AnnualDyHistoryItem[];
  footer?: string;
}

export interface ComparisonRow {
  metric: string;
  values: string[];
}

export interface ParsedComparisonTable {
  title?: string;
  headers: string[];
  rows: ComparisonRow[];
  intro?: string;
  footer?: string;
}

export interface AssetProfileField {
  label: string;
  value: string;
}

export interface ParsedAssetProfile {
  identifier: string;
  name: string;
  price?: string;
  currency?: string;
  change?: string;
  assetType?: string;
  manager?: string;
  assetClass?: string;
  focus?: string;
  domicile?: string;
  distribution?: string;
  fields: AssetProfileField[];
  summary?: string;
  mcpSource?: string;
}
