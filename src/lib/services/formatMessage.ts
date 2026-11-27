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
  PortfolioAllocationItem,
  ParsedPortfolioDistribution,
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
  PortfolioAllocationItem,
  ParsedPortfolioDistribution,
};

// Re-export modular parser functions
export {
  parseSingleAssetProfile,
  parseAssetProfiles,
  parseAssetProfile,
  detectAuditedSource,
} from "./parsers/profileParser";

export { parseAssetQuote } from "./parsers/quoteParser";

export { parseCorporateEvents } from "./parsers/corporateEventsParser";

export { parseValuationProjection } from "./parsers/valuationParser";

export { parseAssetDividends } from "./parsers/dividendsParser";

export { parseComparisonTable } from "./parsers/comparisonTableParser";

export { parsePortfolioDistribution } from "./parsers/portfolioDistributionParser";

export { sanitizeHtml, renderMarkdown } from "./markdownRenderer";
