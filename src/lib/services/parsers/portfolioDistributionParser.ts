import type { ParsedPortfolioDistribution, PortfolioAllocationItem } from '$lib/types';

export function parsePortfolioDistribution(rawText: string): ParsedPortfolioDistribution | null {
  if (!rawText || rawText.length < 50) return null;

  // Strict keyword matching: must explicitly discuss asset allocation, portfolio breakdown or rebalancing
  const hasKeywords = /\b(aloca[çc][aã]o\s+de\s+ativos|distribui[çc][aã]o\s+da\s+carteira|distribui[çc][aã]o\s+de\s+ativos|classes?\s+de\s+ativos|rebalanceamento|estrutura\s+alvo|p[oó]s-rebalanceamento|composi[çc][aã]o\s+alvo|pesos?\s+alvo|estrat[eé]gia\s+alvo|asset\s+allocation|portfolio\s+distribution|target\s+allocation|target\s+structure)\b/i.test(rawText);
  if (!hasKeywords) return null;

  // Exclude pure account searches, client details lookup, transaction listings or stock quotes
  if (
    /informações\s+da\s+conta|dados\s+cadastrais|detalhes\s+do\s+cliente|extrato\s+de\s+transações|histórico\s+de\s+aportes/i.test(rawText) &&
    !/estrutura\s+alvo|alocação\s+alvo|rebalanceamento/i.test(rawText)
  ) {
    return null;
  }

  // Exclude pure dividend payout histories or single stock analysis if not an asset allocation
  if (/proventos?\s+declarados|dividend\s*yield\s*\(dy\)\s*hist[óo]rico/i.test(rawText)) {
    return null;
  }

  // Detect rebalancing flag
  const isRebalancing = /\b(rebalanceamento|estrutura\s+alvo|p[oó]s-rebalanceamento|pos-rebalanceamento|aloca[çc][aã]o\s+alvo|carteira\s+alvo|proposta\s+de\s+rebalanceamento)\b/i.test(rawText);

  // Extract client name if present
  let clientName: string | undefined;
  const clientMatch = rawText.match(/(?:cliente|investidor|titular|carteira\s+de|portf[oó]lio\s+de)\s*[:\-–—]?\s*\*?\*?((?:(?:Dr[a-z]?\.|Sr[a-z]?\.)\s*)?[A-ZÀ-ÿ][A-Za-zÀ-ÿ\s]{2,35})\*?\*?/i);
  if (clientMatch) {
    const candidate = clientMatch[1].trim();
    if (!/^(total|renda|ativos|ações|fiis|resumo|consolidado|alocação|distribuição|estrutura|alvo|pós)/i.test(candidate)) {
      clientName = candidate;
    }
  }

  // Extract total portfolio value if present
  let totalValue: string | undefined;
  const totalMatch = rawText.match(/(?:patrim[oô]nio\s+total|total\s+da\s+carteira|valor\s+total|patrim[oô]nio|aum(?:\s+total)?|total\s+alvo)\s*[:\-–—]?\s*\*?\*?([R$US€£\s\d.,]+)/i);
  if (totalMatch) {
    const candidate = totalMatch[1].trim();
    if (/\d/.test(candidate) && (candidate.includes("R$") || candidate.includes("$") || candidate.length >= 4)) {
      totalValue = candidate.replace(/\*+/g, "").trim();
    }
  }

  // Color palette for asset classes
  const palette = [
    "#10b981", // emerald
    "#0ea5e9", // sky
    "#8b5cf6", // violet
    "#f59e0b", // amber
    "#14b8a6", // teal
    "#ec4899", // pink
    "#6366f1", // indigo
    "#f97316", // orange
    "#06b6d4", // cyan
    "#a855f7", // purple
    "#84cc16", // lime
    "#3b82f6"  // blue
  ];

  const items: PortfolioAllocationItem[] = [];

  // Parse lines
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

  // Check if we have a markdown table
  const tableLines = lines.filter(l => l.startsWith("|") && l.endsWith("|"));

  if (tableLines.length >= 3) {
    // Process markdown table
    const headerLine = tableLines[0];
    const headerCols = headerLine
      .split("|")
      .map(c => c.trim().toLowerCase().replace(/\*\*/g, ""))
      .filter(Boolean);

    let labelCol = 0;
    let currentCol = -1;
    let targetCol = -1;
    let deltaCol = -1;
    let valueCol = -1;
    let actionCol = -1;
    let genericPctCol = -1;

    headerCols.forEach((col, idx) => {
      // Prioritize value and delta first to avoid "Valor Alvo" or "Ajuste Alvo" matching targetCol
      if (/(?:valor|patrim[oô]nio|saldo|montante|financeiro|r\$|\$)/i.test(col)) {
        valueCol = idx;
      } else if (/(?:ajuste|delta|varia[çc][aã]o|diferen[çc]a|mudan[çc]a|aporte)/i.test(col)) {
        deltaCol = idx;
      } else if (/(?:aloca[çc][aã]o\s+alvo|alvo|p[oó]s[- ]rebalanceamento|propost|meta|sugerid|nova\s+aloca)/i.test(col)) {
        targetCol = idx;
      } else if (/(?:aloca[çc][aã]o\s+atual|atual|hoje|vigente|posi[çc][aã]o\s+atual)/i.test(col)) {
        currentCol = idx;
      } else if (/(?:a[çc][aã]o|sugest[aã]o|movimento|opera[çc][aã]o|decis[aã]o|recomend)/i.test(col)) {
        actionCol = idx;
      } else if (/(?:ativo|classe|categoria|segmento|instrumento|descri[çc]|posi[çc][aã]o)/i.test(col)) {
        labelCol = idx;
      } else if (col.includes("%") || col.includes("alocação") || col.includes("part")) {
        if (genericPctCol === -1) genericPctCol = idx;
      }
    });

    // If both current and target were not distinctly mapped, but we have multiple percentage columns
    if (targetCol === -1 && currentCol === -1) {
      headerCols.forEach((col, idx) => {
        if (col.includes("alvo") || col.includes("pos") || col.includes("pós")) targetCol = idx;
        if (col.includes("atual")) currentCol = idx;
      });
    }

    // Iterate through data rows
    for (let r = 1; r < tableLines.length; r++) {
      const line = tableLines[r];
      if (line.includes("---")) continue;

      const cells = line
        .split("|")
        .map(c => c.trim().replace(/\*\*/g, ""))
        .filter(Boolean);

      if (cells.length < 2) continue;

      const rawLabel = cells[labelCol] || cells[0] || "";
      const label = rawLabel.replace(/^#+\s*/, "").trim();

      // Exclude header repetitions or total rows
      if (!label || label.includes("---")) continue;
      if (/^(total|soma|consolidado|patrim[oô]nio\s+l[íi]quido|total\s+alvo)/i.test(label)) {
        // Try to extract totalValue if not found yet
        if (!totalValue) {
          for (const cell of cells) {
            const vMatch = cell.match(/(?:R\$|US\$|\$)\s*[\d.,]+/i);
            if (vMatch) totalValue = vMatch[0].trim();
          }
        }
        continue;
      }

      // Helper to parse percentage from a specific cell or search line
      const parsePct = (cellText?: string): number | null => {
        if (!cellText) return null;
        const m = cellText.match(/[-+]?\b(\d+(?:[.,]\d+)?)\s*%/);
        if (m) {
          const val = parseFloat(m[1].replace(",", "."));
          return isNaN(val) ? null : val;
        }
        return null;
      };

      let currentPct: number | null = null;
      let targetPct: number | null = null;
      let deltaPct: number | null = null;
      let primaryPct: number | null = null;
      let rowValue: string | undefined;
      let rowAction: string | undefined;

      if (currentCol !== -1 && cells[currentCol]) {
        currentPct = parsePct(cells[currentCol]);
      }
      if (targetCol !== -1 && cells[targetCol]) {
        targetPct = parsePct(cells[targetCol]);
      }
      if (deltaCol !== -1 && cells[deltaCol]) {
        const dMatch = cells[deltaCol].match(/([-+]?\d+(?:[.,]\d+)?)\s*%/);
        if (dMatch) {
          deltaPct = parseFloat(dMatch[1].replace(",", "."));
        }
      }
      if (actionCol !== -1 && cells[actionCol]) {
        rowAction = cells[actionCol].trim();
      }
      if (valueCol !== -1 && cells[valueCol]) {
        const vCell = cells[valueCol].trim();
        if (/(?:R\$|US\$|\$|\d)/.test(vCell)) {
          rowValue = vCell.startsWith("R$") || vCell.startsWith("$") ? vCell : `R$ ${vCell}`;
        }
      }

      // If value wasn't in valueCol, scan any cell for currency
      if (!rowValue) {
        for (const cell of cells) {
          if (/(?:R\$|US\$|\$)\s*[\d.,]+/i.test(cell)) {
            const m = cell.match(/(?:R\$|US\$|\$)\s*[\d.,]+/i);
            if (m) {
              rowValue = m[0].trim();
              break;
            }
          }
        }
      }

      // Determine primary percentage
      if (targetPct !== null && targetPct > 0) {
        primaryPct = targetPct;
      } else if (currentPct !== null && currentPct > 0) {
        primaryPct = currentPct;
      } else if (genericPctCol !== -1 && cells[genericPctCol]) {
        primaryPct = parsePct(cells[genericPctCol]);
      } else {
        // Fallback: search row for any percentage
        const rowPct = parsePct(line);
        if (rowPct !== null) primaryPct = rowPct;
      }

      if (primaryPct === null || primaryPct <= 0 || primaryPct > 100) continue;

      // Calculate delta if not parsed explicitly
      if (deltaPct === null && targetPct !== null && currentPct !== null) {
        deltaPct = Math.round((targetPct - currentPct) * 10) / 10;
      }

      // Auto-assign action label if missing
      if (!rowAction && deltaPct !== null) {
        if (deltaPct > 0.4) rowAction = "Aportar";
        else if (deltaPct < -0.4) rowAction = "Reduzir";
        else rowAction = "Manter";
      }

      items.push({
        label,
        value: rowValue,
        percentage: primaryPct,
        percentageFormatted: `${primaryPct.toFixed(1).replace(".", ",")}%`,
        currentPercentage: currentPct ?? undefined,
        currentPercentageFormatted: currentPct !== null ? `${currentPct.toFixed(1).replace(".", ",")}%` : undefined,
        targetPercentage: targetPct ?? undefined,
        targetPercentageFormatted: targetPct !== null ? `${targetPct.toFixed(1).replace(".", ",")}%` : undefined,
        deltaPercentage: deltaPct ?? undefined,
        deltaFormatted: deltaPct !== null ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1).replace(".", ",")}%` : undefined,
        action: rowAction,
        color: palette[items.length % palette.length]
      });
    }
  }

  // Fallback: If no table items found, try bullet lists
  if (items.length < 2) {
    for (const line of lines) {
      if (line.includes("---")) continue;

      // Matches bullet format like: - **Renda Fixa**: 40% (Atual: 45% -> Alvo: 35%)
      const listMatch = line.match(/^[-*•]\s*\*?\*?([^:*]+?)\*?\*?\s*:\s*.*?\b(\d+(?:[.,]\d+)?)\s*%/);
      if (listMatch) {
        const label = listMatch[1].trim();
        const primaryPct = parseFloat(listMatch[2].replace(",", "."));
        if (!label || isNaN(primaryPct) || primaryPct <= 0 || primaryPct > 100) continue;
        if (/^(total|soma|consolidado)/i.test(label)) continue;

        const valueMatch = line.match(/(?:R\$|US\$|\$)\s*[\d.,]+/i);
        const value = valueMatch ? valueMatch[0].trim() : undefined;

        // Check for target/current patterns in line
        let currentPct: number | undefined;
        let targetPct: number | undefined;
        let deltaPct: number | undefined;

        const currMatch = line.match(/(?:atual|vigente)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*%/i);
        if (currMatch) currentPct = parseFloat(currMatch[1].replace(",", "."));

        const targetMatch = line.match(/(?:alvo|propost[ao]|p[oó]s)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*%/i);
        if (targetMatch) targetPct = parseFloat(targetMatch[1].replace(",", "."));

        const deltaMatch = line.match(/([-+]?\d+(?:[.,]\d+)?)\s*%/);
        if (deltaMatch && (currMatch || targetMatch)) {
          deltaPct = parseFloat(deltaMatch[1].replace(",", "."));
        }

        items.push({
          label,
          value,
          percentage: targetPct ?? primaryPct,
          percentageFormatted: `${(targetPct ?? primaryPct).toFixed(1).replace(".", ",")}%`,
          currentPercentage: currentPct,
          currentPercentageFormatted: currentPct ? `${currentPct.toFixed(1).replace(".", ",")}%` : undefined,
          targetPercentage: targetPct,
          targetPercentageFormatted: targetPct ? `${targetPct.toFixed(1).replace(".", ",")}%` : undefined,
          deltaPercentage: deltaPct,
          deltaFormatted: deltaPct !== undefined ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1).replace(".", ",")}%` : undefined,
          color: palette[items.length % palette.length]
        });
      }
    }
  }

  // Must have at least 2 allocation items and total percentage >= 50%
  if (items.length < 2) return null;

  const totalPercentage = items.reduce((sum, it) => sum + it.percentage, 0);
  if (totalPercentage < 50 || totalPercentage > 115) return null;

  // Build clean, executive title
  let title = "Distribuição e Alocação de Portfólio";
  const titleHeaderMatch = rawText.match(/#{1,3}\s*([^\n]+(?:estrutura\s+alvo|rebalanceamento|aloca[çc][aã]o|distribui[çc][aã]o)[^\n]*)/i);

  if (titleHeaderMatch) {
    title = titleHeaderMatch[1].replace(/\*+/g, "").trim();
  } else if (isRebalancing) {
    title = clientName
      ? `Estrutura Alvo Consolidada (Pós-Rebalanceamento) • ${clientName}`
      : "Estrutura Alvo Consolidada (Pós-Rebalanceamento)";
  } else if (clientName) {
    title = `Distribuição de Carteira • ${clientName}`;
  }

  const hasRebalancingData = isRebalancing || items.some(i => i.currentPercentage !== undefined && i.targetPercentage !== undefined);

  return {
    title,
    clientName,
    totalValue,
    items,
    intro: hasRebalancingData
      ? "Estrutura patrimonial alvo otimizada pós-rebalanceamento conforme mandato de alocação estratégica."
      : "Alocação patrimonial consolidada por classes de ativos e posições estratégicas.",
    isRebalancing: hasRebalancingData
  };
}
