import type { ParsedComparisonTable, ComparisonRow } from '$lib/types';

export function parseComparisonTable(_rawText: string): ParsedComparisonTable | null {
  // Markdown tables are rendered natively and accurately via renderMarkdown
  // without intercepting or replacing generic tabular data (clients, portfolios, products, etc.)
  return null;
}

