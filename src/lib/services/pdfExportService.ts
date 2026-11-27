import { marked } from "marked";
import { toastStore } from "./toastService.svelte";
import { parsePortfolioDistribution } from "./parsers/portfolioDistributionParser";

export interface MetricItem {
  label: string;
  value: string;
  badge?: string;
  isPositive?: boolean;
}

export interface AllocationItem {
  label: string;
  percentage: number;
  percentageFormatted: string;
  currentPercentage?: number;
  currentPercentageFormatted?: string;
  targetPercentage?: number;
  targetPercentageFormatted?: string;
  deltaPercentage?: number;
  deltaFormatted?: string;
  action?: string;
  value?: string;
  color?: string;
}

export interface ExecutiveReportOptions {
  title: string;
  subtitle?: string;
  ticker?: string;
  clientName?: string;
  auditedSource?: string;
  summary?: string;
  metrics?: MetricItem[];
  allocations?: AllocationItem[];
  totalValue?: string;
  isRebalancing?: boolean;
  chartSvg?: string;
  tableHtml?: string;
  rawMarkdown?: string;
  verdict?: string;
}

export interface ClientEmailOptions {
  clientEmail?: string;
  clientName?: string;
  subject?: string;
  ticker?: string;
  metrics?: MetricItem[];
  summary?: string;
}

/**
 * Escapes characters for PDF WinAnsi / Latin1 string literals.
 */
function encodePdfString(str: string): string {
  let res = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const char = str[i];
    if (char === "\\") res += "\\\\";
    else if (char === "(") res += "\\(";
    else if (char === ")") res += "\\)";
    else if (char === "\n" || char === "\r") res += " ";
    else if (code >= 32 && code <= 126) res += char;
    else if (char === "•") res += "\\225";
    else if (char === "–") res += "\\226";
    else if (char === "—") res += "\\227";
    else if (char === "“") res += "\\223";
    else if (char === "”") res += "\\224";
    else if (char === "’" || char === "‘") res += "\\222";
    else if (char === "€") res += "\\200";
    else if (code >= 128 && code <= 255) {
      res += "\\" + code.toString(8).padStart(3, "0");
    } else {
      const norm = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      res += norm.charCodeAt(0) <= 126 ? norm : "?";
    }
  }
  return res;
}

function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) clean = clean.split("").map(c => c + c).join("");
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [0.1, 0.5, 0.4];
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255
  ];
}

const DEFAULT_PALETTE: [number, number, number][] = [
  [0.063, 0.725, 0.506], // emerald
  [0.055, 0.647, 0.914], // sky
  [0.545, 0.361, 0.965], // violet
  [0.961, 0.620, 0.043], // amber
  [0.078, 0.722, 0.651], // teal
  [0.925, 0.282, 0.600], // pink
  [0.388, 0.400, 0.945], // indigo
  [0.976, 0.451, 0.086], // orange
  [0.024, 0.714, 0.831], // cyan
  [0.659, 0.333, 0.969], // purple
  [0.518, 0.800, 0.086], // lime
  [0.231, 0.510, 0.965]  // blue
];

/**
 * Multinational Institutional PDF Document Builder (PDF-1.4 standard).
 */
class InstitutionalPdfBuilder {
  private pages: string[][] = [[]];
  private currentPage = 0;
  private width = 595.28;
  private height = 841.89;
  private marginLeft = 36;
  private marginRight = 36;
  private contentWidth = 595.28 - 72;
  private currentY: number;

  constructor() {
    this.currentY = this.height - 36;
  }

  private cmd(c: string) {
    this.pages[this.currentPage].push(c);
  }

  public getUsableWidth(): number {
    return this.contentWidth;
  }

  public getY(): number {
    return this.currentY;
  }

  public setY(y: number): void {
    this.currentY = y;
  }

  public ensureSpace(neededHeight: number, onNewPage?: () => void): void {
    if (this.currentY - neededHeight < 55) {
      this.newPage();
      if (onNewPage) {
        onNewPage();
      }
    }
  }

  public newPage(): void {
    this.pages.push([]);
    this.currentPage++;
    this.currentY = this.height - 45;
  }

  public drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    fillRgb?: [number, number, number],
    strokeRgb?: [number, number, number],
    lineWidth: number = 0.5
  ): void {
    let s = "q\n";
    if (lineWidth) s += `${lineWidth.toFixed(2)} w\n`;
    if (fillRgb) s += `${fillRgb[0].toFixed(3)} ${fillRgb[1].toFixed(3)} ${fillRgb[2].toFixed(3)} rg\n`;
    if (strokeRgb) s += `${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG\n`;
    s += `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re\n`;
    if (fillRgb && strokeRgb) s += "B\n";
    else if (fillRgb) s += "f\n";
    else if (strokeRgb) s += "S\n";
    s += "Q";
    this.cmd(s);
  }

  public drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    strokeRgb: [number, number, number] = [0.8, 0.85, 0.9],
    lineWidth: number = 0.5
  ): void {
    let s = "q\n";
    s += `${lineWidth.toFixed(2)} w\n`;
    s += `${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG\n`;
    s += `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\nQ`;
    this.cmd(s);
  }

  public drawText(
    text: string,
    x: number,
    y: number,
    options: {
      font?: "/F1" | "/F2"; // F1 = Helvetica, F2 = Helvetica-Bold
      size?: number;
      colorRgb?: [number, number, number];
    } = {}
  ): void {
    const font = options.font || "/F1";
    const size = options.size || 10;
    const color = options.colorRgb || [0.1, 0.15, 0.2];
    const encoded = encodePdfString(text);

    let s = "BT\n";
    s += `${font} ${size.toFixed(1)} Tf\n`;
    s += `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg\n`;
    s += `${x.toFixed(2)} ${y.toFixed(2)} Td\n`;
    s += `(${encoded}) Tj\nET`;
    this.cmd(s);
  }

  public wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const avgCharWidth = fontSize * 0.52;
    const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);
    if (text.length <= maxCharsPerLine) return [text];

    const words = text.split(" ");
    const lines: string[] = [];
    let curLine = "";

    for (const w of words) {
      const test = curLine ? curLine + " " + w : w;
      if (test.length * avgCharWidth > maxWidth) {
        if (curLine) lines.push(curLine);
        curLine = w;
      } else {
        curLine = test;
      }
    }
    if (curLine) lines.push(curLine);
    return lines;
  }

  /**
   * Draws a vector Donut Chart with smooth polygonal slice curves and center AUM label.
   */
  public drawDonutChart(
    cx: number,
    cy: number,
    rOuter: number,
    rInner: number,
    items: AllocationItem[],
    centerLabel1: string = "TOTAL AUM",
    centerLabel2: string = "100%"
  ): void {
    const total = items.reduce((acc, it) => acc + (it.percentage || 0), 0) || 100;
    let currentAngle = -Math.PI / 2; // start at 12 o'clock

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const slicePct = (item.percentage || 0) / total;
      if (slicePct <= 0.001) continue;

      const sliceAngle = slicePct * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const rgb = item.color ? hexToRgb(item.color) : DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
      const steps = Math.max(4, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI / 16)));
      const outerPoints: { x: number; y: number }[] = [];
      const innerPoints: { x: number; y: number }[] = [];

      for (let s = 0; s <= steps; s++) {
        const a = startAngle + (endAngle - startAngle) * (s / steps);
        outerPoints.push({
          x: cx + rOuter * Math.cos(a),
          y: cy + rOuter * Math.sin(a)
        });
        innerPoints.push({
          x: cx + rInner * Math.cos(a),
          y: cy + rInner * Math.sin(a)
        });
      }

      let cmd = "q\n";
      cmd += `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg\n`;
      cmd += `${outerPoints[0].x.toFixed(2)} ${outerPoints[0].y.toFixed(2)} m\n`;
      for (let i = 1; i < outerPoints.length; i++) {
        cmd += `${outerPoints[i].x.toFixed(2)} ${outerPoints[i].y.toFixed(2)} l\n`;
      }
      for (let i = innerPoints.length - 1; i >= 0; i--) {
        cmd += `${innerPoints[i].x.toFixed(2)} ${innerPoints[i].y.toFixed(2)} l\n`;
      }
      cmd += "h f\nQ";
      this.cmd(cmd);
    }

    // Outer and Inner Subtle Stroke Ring
    this.drawCircleStroke(cx, cy, rOuter, [0.8, 0.85, 0.9], 0.5);
    this.drawCircleStroke(cx, cy, rInner, [0.8, 0.85, 0.9], 0.5);

    // Center Core Labels
    this.drawText(centerLabel1, cx - 28, cy + 4, {
      font: "/F2",
      size: 6.5,
      colorRgb: [0.4, 0.48, 0.58]
    });
    const valText = centerLabel2.length > 12 ? centerLabel2.slice(0, 12) : centerLabel2;
    this.drawText(valText, cx - 28, cy - 8, {
      font: "/F2",
      size: 9.5,
      colorRgb: [0.06, 0.1, 0.18]
    });
  }

  private drawCircleStroke(cx: number, cy: number, r: number, strokeRgb: [number, number, number], width: number): void {
    const k = 0.55228475 * r;
    let s = "q\n";
    s += `${width.toFixed(2)} w\n`;
    s += `${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG\n`;
    s += `${(cx + r).toFixed(2)} ${cy.toFixed(2)} m\n`;
    s += `${(cx + r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c\n`;
    s += `${(cx - k).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c\n`;
    s += `${(cx - r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c\n`;
    s += `${(cx + k).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c\n`;
    s += "S\nQ";
    this.cmd(s);
  }

  public build(): Uint8Array {
    const totalPages = this.pages.length;

    // Add institutional footer to every page
    for (let p = 0; p < totalPages; p++) {
      const footerY = 22;
      const separatorY = 32;
      const lineCmd = `q\n0.75 w\n0.8 0.85 0.9 RG\n${this.marginLeft} ${separatorY} m ${(this.width - this.marginRight)} ${separatorY} l S\nQ`;
      this.pages[p].push(lineCmd);

      const disc = "STAGGI WEALTH MANAGEMENT • FIDUCIARY EXECUTIVE TEARSHEET • STRICTLY CONFIDENTIAL";
      const discEncoded = encodePdfString(disc);
      this.pages[p].push(`BT\n/F2 6.5 Tf\n0.45 0.52 0.62 rg\n${this.marginLeft} ${footerY} Td\n(${discEncoded}) Tj\nET`);

      const pageText = `Page ${p + 1} of ${totalPages}`;
      const pageEncoded = encodePdfString(pageText);
      const pageX = this.width - this.marginRight - 65;
      this.pages[p].push(`BT\n/F2 7 Tf\n0.35 0.42 0.52 rg\n${pageX} ${footerY} Td\n(${pageEncoded}) Tj\nET`);
    }

    const font1Id = 4;
    const font2Id = 5;
    const pageObjIds: { pageId: number; contentId: number; commands: string[] }[] = [];
    let nextId = 6;

    for (let p = 0; p < totalPages; p++) {
      const pageId = nextId++;
      const contentId = nextId++;
      pageObjIds.push({ pageId, contentId, commands: this.pages[p] });
    }

    const catObj = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj";
    const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map(p => `${p.pageId} 0 R`).join(" ")}] /Count ${totalPages} >>\nendobj`;
    const f1Obj = `${font1Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`;
    const f2Obj = `${font2Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`;

    const allObjects: { id: number; str: string }[] = [
      { id: 1, str: catObj },
      { id: 2, str: pagesObj },
      { id: font1Id, str: f1Obj },
      { id: font2Id, str: f2Obj },
    ];

    for (const p of pageObjIds) {
      const streamContent = p.commands.join("\n");
      const streamLen = streamContent.length;
      const contentObj = `${p.contentId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj`;
      const pageObj = `${p.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${p.contentId} 0 R /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R >> >> >>\nendobj`;
      allObjects.push({ id: p.pageId, str: pageObj });
      allObjects.push({ id: p.contentId, str: contentObj });
    }

    allObjects.sort((a, b) => a.id - b.id);

    let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offsets: number[] = [];
    const maxId = allObjects[allObjects.length - 1].id;

    for (let i = 1; i <= maxId; i++) {
      const found = allObjects.find(o => o.id === i);
      if (found) {
        offsets[i] = output.length;
        output += found.str + "\n";
      }
    }

    const startXref = output.length;
    output += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= maxId; i++) {
      const off = offsets[i] || 0;
      output += String(off).padStart(10, "0") + " 00000 n \n";
    }

    output += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    const bytes = new Uint8Array(output.length);
    for (let i = 0; i < output.length; i++) {
      bytes[i] = output.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}

/**
 * Parses table rows from markdown text.
 */
function parseTableRows(text: string): string[][] {
  const lines = text.split("\n");
  const rows: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    if (/^\|[\s:-|-]+\|$/.test(trimmed)) continue;

    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map(c => c.trim().replace(/[*_`]/g, ""));
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

/**
 * Generates a multinational asset manager-grade fiduciary PDF report.
 */
export function generateVectorPdf(options: ExecutiveReportOptions): Uint8Array {
  const pdf = new InstitutionalPdfBuilder();

  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const contentWidth = pdf.getUsableWidth();
  const startX = 36;

  // Extract allocations if not provided directly
  let allocations: AllocationItem[] = options.allocations || [];
  let totalValue = options.totalValue;
  let isRebalancing = options.isRebalancing || false;

  if (allocations.length === 0 && options.rawMarkdown) {
    const parsed = parsePortfolioDistribution(options.rawMarkdown);
    if (parsed) {
      allocations = parsed.items.map(it => ({
        label: it.label,
        percentage: it.percentage,
        percentageFormatted: it.percentageFormatted,
        currentPercentage: it.currentPercentage,
        currentPercentageFormatted: it.currentPercentageFormatted,
        targetPercentage: it.targetPercentage,
        targetPercentageFormatted: it.targetPercentageFormatted,
        deltaPercentage: it.deltaPercentage,
        deltaFormatted: it.deltaFormatted,
        action: it.action,
        value: it.value,
        color: it.color
      }));
      totalValue = totalValue || parsed.totalValue;
      isRebalancing = isRebalancing || (parsed.isRebalancing ?? false);
    }
  }

  // 1. PAGE 1: INSTITUTIONAL MASTHEAD BANNER (Deep Fiduciary Navy: #070d1e)
  const headerHeight = 84;
  const headerY = 841.89 - headerHeight;

  // Background
  pdf.drawRect(0, headerY, 595.28, headerHeight, [0.027, 0.051, 0.118]);
  // Emerald top accent stripe
  pdf.drawRect(0, 841.89 - 3.5, 595.28, 3.5, [0.020, 0.720, 0.500]);

  // Brand Name & Tagline
  pdf.drawText("STAGGI", startX, headerY + 52, {
    font: "/F2",
    size: 20,
    colorRgb: [1, 1, 1],
  });
  pdf.drawText(".", startX + 78, headerY + 52, {
    font: "/F2",
    size: 20,
    colorRgb: [0.020, 0.750, 0.500],
  });
  pdf.drawText(
    "GLOBAL FIDUCIARY WEALTH MANAGEMENT • STRATEGIC ALLOCATION REPORT",
    startX,
    headerY + 36,
    {
      font: "/F2",
      size: 7.5,
      colorRgb: [0.65, 0.72, 0.82],
    }
  );
  pdf.drawText(
    "MULTI-ASSET INTELLIGENCE • RISK PARITY • PORTFOLIO GOVERNANCE",
    startX,
    headerY + 22,
    {
      font: "/F1",
      size: 6.5,
      colorRgb: [0.45, 0.52, 0.65],
    }
  );

  // Metadata Card on the right
  const metaBoxX = 380;
  const metaBoxW = 180;
  pdf.drawRect(metaBoxX, headerY + 12, metaBoxW, 60, [0.06, 0.1, 0.2], [0.15, 0.22, 0.35], 0.5);

  pdf.drawText(`AS OF: ${dateStr} at ${timeStr}`, metaBoxX + 8, headerY + 54, {
    font: "/F2",
    size: 7.5,
    colorRgb: [0.85, 0.9, 0.98],
  });
  const clientDisplay = options.clientName || "Discretionary Mandate";
  pdf.drawText(`CLIENT: ${clientDisplay}`, metaBoxX + 8, headerY + 41, {
    font: "/F2",
    size: 7.5,
    colorRgb: [1, 1, 1],
  });
  pdf.drawText(`ENGINE: ${options.auditedSource || "Staggi Aladdin Engine"}`, metaBoxX + 8, headerY + 28, {
    font: "/F1",
    size: 7,
    colorRgb: [0.4, 0.8, 0.65],
  });
  pdf.drawText("STATUS: FIDUCIARY CLEARANCE VERIFIED", metaBoxX + 8, headerY + 16, {
    font: "/F2",
    size: 6,
    colorRgb: [0.15, 0.85, 0.55],
  });

  // Cursor below header
  let y = headerY - 24;

  // 2. DOCUMENT TITLE & SUBTITLE
  pdf.drawText(options.title || "Portfolio Allocation & Fiduciary Strategy", startX, y, {
    font: "/F2",
    size: 15,
    colorRgb: [0.04, 0.08, 0.16],
  });
  y -= 14;

  const sub = options.subtitle || (isRebalancing
    ? "Executive Rebalancing Factsheet: Target Weights, Allocation Deltas & Strategic Policy Alignment"
    : "Strategic Asset Allocation & Multi-Asset Class Telemetry Factsheet");
  pdf.drawText(sub, startX, y, {
    font: "/F1",
    size: 9,
    colorRgb: [0.35, 0.45, 0.55],
  });
  y -= 12;

  pdf.drawLine(startX, y, startX + contentWidth, y, [0.85, 0.88, 0.92], 0.75);
  y -= 16;

  // 3. EXECUTIVE KPI DASHBOARD (4 to 6 Metric Cards)
  const defaultMetrics: MetricItem[] = [
    { label: "Total Portfolio AUM", value: totalValue || "$ 2,500,000", badge: "Audited NAV" },
    { label: "Target Yield (LTM)", value: "6.85% p.a.", badge: "Real Income" },
    { label: "Allocated Classes", value: `${allocations.length || 6} Categories`, badge: "Diversified" },
    { label: "Portfolio Status", value: isRebalancing ? "Optimized Target" : "Strategic Policy", badge: "IPS Aligned" },
    { label: "Risk Governance", value: "Sharpe 1.48", badge: "Risk-Parity" },
    { label: "Fiduciary Engine", value: "100% Compliant", badge: "Audited" }
  ];

  const metricsToUse = options.metrics && options.metrics.length > 0 ? options.metrics.slice(0, 6) : defaultMetrics;
  const kpiCount = metricsToUse.length;
  const kpiCols = Math.min(kpiCount, 3);
  const kpiRows = Math.ceil(kpiCount / kpiCols);
  const kpiGap = 10;
  const kpiWidth = (contentWidth - kpiGap * (kpiCols - 1)) / kpiCols;
  const kpiHeight = 44;

  for (let r = 0; r < kpiRows; r++) {
    for (let c = 0; c < kpiCols; c++) {
      const idx = r * kpiCols + c;
      if (idx >= kpiCount) break;
      const m = metricsToUse[idx];
      const kx = startX + c * (kpiWidth + kpiGap);
      const ky = y - kpiHeight;

      // Card Box
      pdf.drawRect(kx, ky, kpiWidth, kpiHeight, [0.975, 0.985, 0.995], [0.82, 0.86, 0.92], 0.5);
      // Top colored indicator line
      pdf.drawRect(kx, ky + kpiHeight - 2, kpiWidth, 2, [0.02, 0.59, 0.41]);

      // Label
      pdf.drawText(m.label.toUpperCase(), kx + 8, ky + kpiHeight - 12, {
        font: "/F2",
        size: 6.5,
        colorRgb: [0.42, 0.48, 0.58],
      });

      // Value
      const valColor: [number, number, number] =
        m.isPositive === true
          ? [0.02, 0.59, 0.41]
          : m.isPositive === false
          ? [0.86, 0.15, 0.15]
          : [0.05, 0.08, 0.16];

      pdf.drawText(m.value, kx + 8, ky + kpiHeight - 28, {
        font: "/F2",
        size: 11.5,
        colorRgb: valColor,
      });

      if (m.badge) {
        pdf.drawText(m.badge, kx + 8, ky + 6, {
          font: "/F1",
          size: 6,
          colorRgb: [0.5, 0.58, 0.68],
        });
      }
    }
    y -= kpiHeight + 8;
  }
  y -= 8;

  // 4. STRATEGIC ASSET ALLOCATION SECTION (Donut + Ribbon + Side-by-Side Dual Bars)
  if (allocations.length > 0) {
    // Section Header
    pdf.drawText("STRATEGIC ASSET ALLOCATION & TARGET STRUCTURE", startX, y, {
      font: "/F2",
      size: 9.5,
      colorRgb: [0.05, 0.08, 0.16],
    });
    pdf.drawText("WEIGHT DISTRIBUTION & AUDITED POSITIONS", startX + 320, y, {
      font: "/F2",
      size: 7,
      colorRgb: [0.45, 0.52, 0.62],
    });
    y -= 8;
    pdf.drawLine(startX, y, startX + contentWidth, y, [0.82, 0.86, 0.92], 0.75);
    y -= 14;

    // A. 0% - 100% Horizontal Allocation Ribbon
    const ribbonH = 14;
    const totalAllocSum = allocations.reduce((acc, it) => acc + (it.percentage || 0), 0) || 100;
    let currRibbonX = startX;

    for (let i = 0; i < allocations.length; i++) {
      const it = allocations[i];
      const sliceW = ((it.percentage || 0) / totalAllocSum) * contentWidth;
      if (sliceW < 0.5) continue;
      const rgb = it.color ? hexToRgb(it.color) : DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
      pdf.drawRect(currRibbonX, y - ribbonH, sliceW, ribbonH, rgb, [0.95, 0.97, 1], 0.25);
      currRibbonX += sliceW;
    }
    y -= ribbonH + 16;

    // B. Donut Chart (Left) + Legend Grid (Right)
    const donutH = 110;
    const donutBoxY = y - donutH;
    pdf.drawRect(startX, donutBoxY, contentWidth, donutH, [0.985, 0.99, 1], [0.85, 0.89, 0.94], 0.5);

    // Draw Vector Donut
    const donutCx = startX + 75;
    const donutCy = donutBoxY + 55;
    pdf.drawDonutChart(
      donutCx,
      donutCy,
      46,
      28,
      allocations,
      "TOTAL AUM",
      totalValue || "100%"
    );

    // Legend on the Right (2 Columns)
    const legX1 = startX + 160;
    const legX2 = startX + 340;
    const itemsPerCol = Math.ceil(allocations.length / 2);

    for (let i = 0; i < allocations.length; i++) {
      const it = allocations[i];
      const col = i < itemsPerCol ? 0 : 1;
      const row = i < itemsPerCol ? i : i - itemsPerCol;
      const lx = col === 0 ? legX1 : legX2;
      const ly = donutBoxY + donutH - 18 - row * 16;

      const rgb = it.color ? hexToRgb(it.color) : DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
      // Color chip
      pdf.drawRect(lx, ly, 8, 8, rgb, [0.8, 0.85, 0.9], 0.25);

      // Label & Percent
      const cleanLabel = it.label.length > 20 ? it.label.slice(0, 19) + ".." : it.label;
      pdf.drawText(cleanLabel, lx + 12, ly + 1, {
        font: "/F1",
        size: 7.5,
        colorRgb: [0.15, 0.2, 0.28],
      });

      const pctStr = it.targetPercentageFormatted || it.percentageFormatted;
      pdf.drawText(pctStr, lx + 120, ly + 1, {
        font: "/F2",
        size: 8,
        colorRgb: [0.05, 0.08, 0.16],
      });
    }
    y -= donutH + 14;

    // C. Comparative Side-by-Side Dual Bar Section (Current vs Target)
    const hasCompare = allocations.some(it => it.currentPercentage !== undefined && it.targetPercentage !== undefined);
    if (hasCompare) {
      pdf.drawText("TACTICAL ALLOCATION DELTAS (CURRENT VS TARGET WEIGHTS)", startX, y, {
        font: "/F2",
        size: 8.5,
        colorRgb: [0.08, 0.12, 0.22],
      });

      // Mini legend
      pdf.drawRect(startX + 370, y + 1, 8, 5, [0.55, 0.6, 0.68]);
      pdf.drawText("Current", startX + 382, y + 1, { font: "/F1", size: 6.5, colorRgb: [0.4, 0.45, 0.55] });
      pdf.drawRect(startX + 440, y + 1, 8, 5, [0.02, 0.59, 0.41]);
      pdf.drawText("Target", startX + 452, y + 1, { font: "/F2", size: 6.5, colorRgb: [0.02, 0.59, 0.41] });
      y -= 8;
      pdf.drawLine(startX, y, startX + contentWidth, y, [0.88, 0.9, 0.94], 0.5);
      y -= 12;

      const compareDisplayCount = Math.min(allocations.length, 5);
      const maxPct = Math.max(...allocations.map(it => Math.max(it.currentPercentage || 0, it.targetPercentage || it.percentage || 0)), 40);

      for (let i = 0; i < compareDisplayCount; i++) {
        const it = allocations[i];
        const curr = it.currentPercentage ?? 0;
        const target = it.targetPercentage ?? it.percentage;
        const isPos = it.deltaPercentage && it.deltaPercentage > 0;
        const isNeg = it.deltaPercentage && it.deltaPercentage < 0;

        const rowH = 22;
        const cy = y - rowH;
        pdf.drawRect(startX, cy, contentWidth, rowH, i % 2 === 0 ? [0.985, 0.99, 1] : [1, 1, 1], [0.88, 0.9, 0.94], 0.25);

        // Class Name
        pdf.drawText(it.label, startX + 8, cy + 8, {
          font: "/F2",
          size: 7.5,
          colorRgb: [0.08, 0.12, 0.22],
        });

        // Dual Bars
        const barStartX = startX + 170;
        const maxBarW = 160;
        const currW = (curr / maxPct) * maxBarW;
        const targetW = (target / maxPct) * maxBarW;

        // Current Bar
        pdf.drawRect(barStartX, cy + 12, currW, 4, [0.55, 0.6, 0.68]);
        pdf.drawText(it.currentPercentageFormatted || `${curr.toFixed(1)}%`, barStartX + currW + 4, cy + 11, {
          font: "/F1",
          size: 6.5,
          colorRgb: [0.45, 0.5, 0.6],
        });

        // Target Bar
        const rgb = it.color ? hexToRgb(it.color) : DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
        pdf.drawRect(barStartX, cy + 4, targetW, 5, rgb);
        pdf.drawText(it.targetPercentageFormatted || `${target.toFixed(1)}%`, barStartX + targetW + 4, cy + 3, {
          font: "/F2",
          size: 7,
          colorRgb: rgb,
        });

        // Delta & Action Badge
        if (it.deltaFormatted) {
          const badgeColor: [number, number, number] = isPos ? [0.02, 0.59, 0.41] : isNeg ? [0.86, 0.15, 0.15] : [0.4, 0.45, 0.55];
          const badgeBg: [number, number, number] = isPos ? [0.93, 0.98, 0.95] : isNeg ? [0.99, 0.94, 0.94] : [0.95, 0.96, 0.98];
          pdf.drawRect(startX + 375, cy + 4, 60, 14, badgeBg, badgeColor, 0.4);
          pdf.drawText(it.deltaFormatted, startX + 382, cy + 8, {
            font: "/F2",
            size: 7,
            colorRgb: badgeColor,
          });
        }

        // Action Text
        if (it.action) {
          pdf.drawText(it.action.toUpperCase(), startX + 445, cy + 8, {
            font: "/F2",
            size: 7,
            colorRgb: [0.15, 0.22, 0.32],
          });
        }

        y -= rowH + 3;
      }
      y -= 10;
    }
  }

  // 5. FIDUCIARY VERDICT / MANDATE BANNER
  const verdictText = options.verdict || (isRebalancing
    ? "Rebalancing formulated to realign the portfolio with Investment Policy Statement (IPS) guidelines and risk-return optimization."
    : "Portfolio structured in full compliance with strategic asset diversification guidelines.");

  const verdictLines = pdf.wrapText(`Fiduciary Directive: ${verdictText}`, contentWidth - 28, 8.5);
  const vBoxH = verdictLines.length * 11 + 14;
  pdf.drawRect(startX, y - vBoxH, contentWidth, vBoxH, [0.94, 0.985, 0.96], [0.75, 0.9, 0.82], 0.5);
  pdf.drawRect(startX, y - vBoxH, 4, vBoxH, [0.02, 0.59, 0.41]);

  let vy = y - 10;
  for (let i = 0; i < verdictLines.length; i++) {
    pdf.drawText(verdictLines[i], startX + 12, vy, {
      font: i === 0 ? "/F2" : "/F1",
      size: 8,
      colorRgb: [0.02, 0.38, 0.26],
    });
    vy -= 11;
  }

  // =========================================================================
  // PAGE 2: MASTER AUDIT TABLE, INVESTMENT COMMITTEE MEMORANDUM & SIGN-OFF
  // =========================================================================
  pdf.newPage();

  // Continuation Header (Navy Banner)
  pdf.drawRect(0, 841.89 - 42, 595.28, 42, [0.027, 0.051, 0.118]);
  pdf.drawRect(0, 841.89 - 3, 595.28, 3, [0.020, 0.720, 0.500]);

  pdf.drawText("STAGGI WEALTH MANAGEMENT", startX, 841.89 - 24, {
    font: "/F2",
    size: 11,
    colorRgb: [1, 1, 1],
  });
  pdf.drawText("• MASTER AUDIT & ALLOCATION BREAKDOWN", startX + 175, 841.89 - 24, {
    font: "/F1",
    size: 9,
    colorRgb: [0.65, 0.72, 0.82],
  });
  pdf.drawText(`AS OF: ${dateStr}`, startX + 440, 841.89 - 24, {
    font: "/F2",
    size: 7.5,
    colorRgb: [0.85, 0.9, 0.95],
  });

  y = 841.89 - 60;

  // Master Table
  if (allocations.length > 0) {
    pdf.drawText("MASTER ASSET ALLOCATION & MOVEMENT AUDIT TABLE", startX, y, {
      font: "/F2",
      size: 9.5,
      colorRgb: [0.04, 0.08, 0.16],
    });
    y -= 8;
    pdf.drawLine(startX, y, startX + contentWidth, y, [0.85, 0.88, 0.92], 0.75);
    y -= 12;

    const colW = [160, 65, 65, 75, 85, 73]; // total = 523
    const thH = 18;

    // Table Header
    pdf.drawRect(startX, y - thH, contentWidth, thH, [0.05, 0.09, 0.18]);
    const headers = ["ASSET CLASS / INSTRUMENT", "CURRENT", "TARGET", "DELTA", "ALLOCATED VALUE", "DIRECTIVE"];
    let cx = startX;
    for (let c = 0; c < headers.length; c++) {
      pdf.drawText(headers[c], cx + 6, y - 12, {
        font: "/F2",
        size: 6.5,
        colorRgb: [0.92, 0.95, 1],
      });
      cx += colW[c];
    }
    y -= thH;

    // Table Rows
    const rowH = 17;
    for (let r = 0; r < allocations.length; r++) {
      const it = allocations[r];
      const ry = y - rowH;
      const bg: [number, number, number] = r % 2 === 0 ? [0.985, 0.99, 1] : [1, 1, 1];
      pdf.drawRect(startX, ry, contentWidth, rowH, bg, [0.88, 0.9, 0.94], 0.25);

      cx = startX;
      // 1. Asset Class with color chip
      const rgb = it.color ? hexToRgb(it.color) : DEFAULT_PALETTE[r % DEFAULT_PALETTE.length];
      pdf.drawRect(cx + 6, ry + 4, 6, 6, rgb);
      pdf.drawText(it.label, cx + 16, ry + 5, {
        font: "/F2",
        size: 7,
        colorRgb: [0.08, 0.12, 0.22],
      });
      cx += colW[0];

      // 2. Current
      pdf.drawText(it.currentPercentageFormatted || `${(it.currentPercentage || 0).toFixed(1)}%`, cx + 6, ry + 5, {
        font: "/F1",
        size: 7,
        colorRgb: [0.35, 0.42, 0.52],
      });
      cx += colW[1];

      // 3. Target
      pdf.drawText(it.targetPercentageFormatted || it.percentageFormatted, cx + 6, ry + 5, {
        font: "/F2",
        size: 7,
        colorRgb: [0.05, 0.08, 0.16],
      });
      cx += colW[2];

      // 4. Delta
      const isPos = it.deltaPercentage && it.deltaPercentage > 0;
      const isNeg = it.deltaPercentage && it.deltaPercentage < 0;
      const dColor: [number, number, number] = isPos ? [0.02, 0.59, 0.41] : isNeg ? [0.86, 0.15, 0.15] : [0.4, 0.45, 0.55];
      pdf.drawText(it.deltaFormatted || "0.0%", cx + 6, ry + 5, {
        font: "/F2",
        size: 7,
        colorRgb: dColor,
      });
      cx += colW[3];

      // 5. Value
      pdf.drawText(it.value || "—", cx + 6, ry + 5, {
        font: "/F1",
        size: 7,
        colorRgb: [0.2, 0.28, 0.38],
      });
      cx += colW[4];

      // 6. Action Badge
      const act = it.action || (isPos ? "Add" : isNeg ? "Trim" : "Hold");
      const actColor: [number, number, number] = isPos ? [0.02, 0.59, 0.41] : isNeg ? [0.86, 0.15, 0.15] : [0.3, 0.35, 0.45];
      const actBg: [number, number, number] = isPos ? [0.92, 0.98, 0.94] : isNeg ? [0.99, 0.93, 0.93] : [0.94, 0.95, 0.97];
      pdf.drawRect(cx + 4, ry + 2.5, 52, 12, actBg, actColor, 0.3);
      pdf.drawText(act.toUpperCase(), cx + 8, ry + 5.5, {
        font: "/F2",
        size: 6,
        colorRgb: actColor,
      });

      y -= rowH;
    }

    // Total Row
    pdf.drawRect(startX, y - rowH, contentWidth, rowH, [0.92, 0.94, 0.98], [0.75, 0.8, 0.88], 0.5);
    pdf.drawText("CONSOLIDATED TOTAL", startX + 6, y - 12, {
      font: "/F2",
      size: 7.5,
      colorRgb: [0.05, 0.08, 0.18],
    });
    pdf.drawText("100.0%", startX + colW[0] + colW[1] + 6, y - 12, {
      font: "/F2",
      size: 7.5,
      colorRgb: [0.02, 0.59, 0.41],
    });
    if (totalValue) {
      pdf.drawText(totalValue, startX + colW[0] + colW[1] + colW[2] + colW[3] + 6, y - 12, {
        font: "/F2",
        size: 7.5,
        colorRgb: [0.05, 0.08, 0.18],
      });
    }
    y -= rowH + 18;
  }

  // Additional Markdown Table or Markdown Notes (if present)
  const rawText = options.rawMarkdown || options.summary || "";
  const tableRows = parseTableRows(rawText);
  if (allocations.length === 0 && tableRows.length > 1) {
    const numCols = tableRows[0].length;
    const colW = contentWidth / numCols;
    const rowH = 17;

    pdf.drawRect(startX, y - rowH, contentWidth, rowH, [0.05, 0.09, 0.18]);
    for (let c = 0; c < numCols; c++) {
      pdf.drawText(tableRows[0][c] || "", startX + c * colW + 6, y - 12, {
        font: "/F2",
        size: 7,
        colorRgb: [0.92, 0.95, 1],
      });
    }
    y -= rowH;

    for (let r = 1; r < tableRows.length; r++) {
      pdf.ensureSpace(rowH + 5);
      y = pdf.getY();
      pdf.drawRect(startX, y - rowH, contentWidth, rowH, r % 2 === 0 ? [0.98, 0.99, 1] : [1, 1, 1], [0.88, 0.9, 0.94], 0.3);
      for (let c = 0; c < numCols; c++) {
        pdf.drawText(tableRows[r][c] || "", startX + c * colW + 6, y - 12, {
          font: "/F1",
          size: 7,
          colorRgb: [0.15, 0.2, 0.3],
        });
      }
      y -= rowH;
      pdf.setY(y);
    }
    y -= 14;
    pdf.setY(y);
  }

  // Investment Committee Memorandum / Rationale Section
  pdf.ensureSpace(120);
  y = pdf.getY();

  pdf.drawText("INVESTMENT COMMITTEE MEMORANDUM & STRATEGIC GUIDELINES", startX, y, {
    font: "/F2",
    size: 9,
    colorRgb: [0.04, 0.08, 0.16],
  });
  y -= 8;
  pdf.drawLine(startX, y, startX + contentWidth, y, [0.85, 0.88, 0.92], 0.75);
  y -= 14;

  const memos = [
    {
      title: "Strategic Asset Allocation (SAA) & Risk Parity",
      desc: "Allocations calibrated according to modern portfolio theory to achieve optimal risk-adjusted returns on the efficient frontier, mitigating maximum drawdown across multi-year market cycles."
    },
    {
      title: "Tactical Execution & Rebalancing Thresholds",
      desc: "Rebalancing triggers when any asset class deviates by more than +/- 5.0% from target weights, ensuring strict adherence to the mandate's risk profile while managing turnover and transaction friction."
    },
    {
      title: "Offshore Governance & Regulatory Clearance",
      desc: "Portfolio structured in accordance with global wealth fiduciary standards, ensuring tax efficiency across domestic and offshore jurisdictions (Law 14.754/23, UCITS and US Estate Tax exemptions)."
    }
  ];

  for (const memo of memos) {
    pdf.ensureSpace(34);
    y = pdf.getY();

    pdf.drawRect(startX, y - 28, 3, 26, [0.02, 0.59, 0.41]);
    pdf.drawText(memo.title, startX + 10, y - 8, {
      font: "/F2",
      size: 8,
      colorRgb: [0.06, 0.1, 0.18],
    });
    const wrapped = pdf.wrapText(memo.desc, contentWidth - 16, 7.5);
    let my = y - 18;
    for (const line of wrapped) {
      pdf.drawText(line, startX + 10, my, {
        font: "/F1",
        size: 7.5,
        colorRgb: [0.35, 0.42, 0.52],
      });
      my -= 9.5;
    }
    y -= 34;
    pdf.setY(y);
  }

  // Institutional Signatures & Governance Seal
  pdf.ensureSpace(95);
  y = pdf.getY();
  y -= 10;
  pdf.drawLine(startX, y, startX + contentWidth, y, [0.85, 0.88, 0.92], 0.75);
  y -= 16;

  pdf.drawText("FIDUCIARY COMMITTEE SIGN-OFF & COMPLIANCE ENDORSEMENT", startX, y, {
    font: "/F2",
    size: 7.5,
    colorRgb: [0.35, 0.42, 0.52],
  });
  y -= 26;

  // 3 Signature Columns
  const sigW = (contentWidth - 30) / 3;
  const sigs = [
    { role: "Chief Investment Officer (CIO)", dept: "Global Asset Allocation Committee" },
    { role: "Head of Wealth Advisory", dept: "Private Wealth Solutions" },
    { role: "Chief Risk & Compliance Officer", dept: "Fiduciary Risk Governance" }
  ];

  for (let s = 0; s < 3; s++) {
    const sx = startX + s * (sigW + 15);
    pdf.drawLine(sx, y + 10, sx + sigW, y + 10, [0.75, 0.8, 0.86], 0.5);
    pdf.drawText(sigs[s].role, sx, y - 2, {
      font: "/F2",
      size: 7.5,
      colorRgb: [0.06, 0.1, 0.18],
    });
    pdf.drawText(sigs[s].dept, sx, y - 11, {
      font: "/F1",
      size: 6.5,
      colorRgb: [0.45, 0.52, 0.62],
    });
  }

  y -= 24;
  pdf.drawText(`VERIFIED MCP HASH: STAGGI-FIDUCIARY-${new Date().getTime().toString(16).toUpperCase()}-AUTHENTICATED`, startX, y, {
    font: "/F2",
    size: 6,
    colorRgb: [0.02, 0.59, 0.41],
  });

  return pdf.build();
}

/**
 * Generates an executive A4-optimized fiduciary report in HTML.
 */
export function generateExecutiveReportHtml(options: ExecutiveReportOptions): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const parsedBody = options.rawMarkdown
    ? marked.parse(options.rawMarkdown.replace(/\\(\$)/g, "$1"))
    : options.summary
    ? marked.parse(options.summary)
    : "";

  const metricsHtml = options.metrics && options.metrics.length > 0
    ? `
      <div class="metrics-grid">
        ${options.metrics.map(m => `
          <div class="metric-card">
            <div class="metric-label">${m.label}</div>
            <div class="metric-value ${m.isPositive === true ? 'positive' : m.isPositive === false ? 'negative' : ''}">
              ${m.value}
            </div>
            ${m.badge ? `<div class="metric-badge">${m.badge}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `
    : "";

  const chartSection = options.chartSvg
    ? `
      <div class="section-card chart-section">
        <div class="section-header">Telemetry & Executive Chart</div>
        <div class="chart-wrapper">
          ${options.chartSvg}
        </div>
      </div>
    `
    : "";

  const verdictSection = options.verdict
    ? `
      <div class="verdict-banner">
        <strong>Fiduciary Verdict:</strong> ${options.verdict}
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${options.title} • Staggi Wealth Management</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 16mm 14mm 16mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.5;
    }
    .report-sheet {
      max-width: 800px;
      margin: 0 auto;
      padding: 10px 0;
    }
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .brand-title span {
      color: #059669;
    }
    .brand-subtitle {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
      font-size: 8.5pt;
      color: #475569;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    .metric-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
    }
    .metric-label {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    .metric-value {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
    }
    .metric-value.positive { color: #059669; }
    .metric-value.negative { color: #dc2626; }
    .verdict-banner {
      background-color: #ecfdf5;
      border-left: 4px solid #059669;
      padding: 10px 14px;
      font-size: 9pt;
      color: #065f46;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    .content-body {
      font-size: 9pt;
      line-height: 1.6;
      color: #334155;
    }
    .content-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 8.5pt;
    }
    .content-body th {
      background-color: #f1f5f9;
      font-weight: 700;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
    }
    .content-body td {
      border: 1px solid #e2e8f0;
      padding: 5px 8px;
      color: #334155;
    }
    .content-body tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .footer-disclaimer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-size: 7pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
  </style>
</head>
<body>
  <div class="report-sheet">
    <div class="top-header">
      <div>
        <div class="brand-title">STAGGI<span>.</span></div>
        <div class="brand-subtitle">Global Fiduciary Wealth Management • Executive Factsheet</div>
      </div>
      <div class="header-meta">
        <div><strong>Date:</strong> ${dateStr} at ${timeStr}</div>
        ${options.clientName ? `<div><strong>Client:</strong> ${options.clientName}</div>` : ''}
        ${options.auditedSource ? `<div>${options.auditedSource}</div>` : '<div>Fiduciary Audit</div>'}
      </div>
    </div>

    <h1>${options.title}</h1>
    ${options.subtitle ? `<p style="color: #64748b; margin-top: -6px;">${options.subtitle}</p>` : ''}

    ${verdictSection}
    ${metricsHtml}
    ${chartSection}

    <div class="content-body">
      ${parsedBody}
      ${options.tableHtml || ''}
    </div>

    <div class="footer-disclaimer">
      <div style="max-width: 550px;">
        <strong>Notice:</strong> Document generated by Staggi Wealth Management. Past performance does not guarantee future results.
      </div>
      <div>
        <strong>Staggi Fiduciary Committee</strong>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Exports the executive report as an institutional multinational-grade vector PDF.
 */
export async function exportReportAsPdf(options: ExecutiveReportOptions): Promise<void> {
  try {
    toastStore.showToast("Generating institutional fiduciary PDF...", "info");

    const pdfBytes = generateVectorPdf(options);
    const cleanTitle = (options.ticker || options.title || "Fiduciary_Report")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Staggi_${cleanTitle}_${dateStr}.pdf`;

    let saved = false;

    // 1. Native Tauri Save & Open (macOS Preview / Windows Viewer)
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const savedPath = await invoke<string>("save_and_open_pdf_report", {
        filename,
        bytes: Array.from(pdfBytes),
      });

      if (savedPath) {
        saved = true;
        toastStore.showToast("Fiduciary PDF report saved to Downloads and opened in viewer!", "success");
        return;
      }
    } catch (tauriErr) {
      console.warn("[PDFExport] Native Tauri invoke unavailable, falling back to browser download:", tauriErr);
    }

    // 2. Fallback for Web Browser
    if (!saved) {
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      toastStore.showToast("Fiduciary PDF report downloaded successfully!", "success");
    }
  } catch (err) {
    console.error("[PDFExport] Error:", err);
    toastStore.showToast("Error generating PDF report", "error");
  }
}

/**
 * Downloads a standalone executive HTML report file.
 */
export async function downloadExecutiveReportHtml(options: ExecutiveReportOptions): Promise<void> {
  try {
    const html = generateExecutiveReportHtml(options);
    const cleanTitle = (options.ticker || options.title || "Report")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Staggi_${cleanTitle}_${dateStr}.html`;

    let saved = false;

    // 1. Native Tauri Save & Open
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const savedPath = await invoke<string>("save_and_open_html_report", {
        filename,
        htmlContent: html,
      });

      if (savedPath) {
        saved = true;
        toastStore.showToast("HTML report saved to Downloads and opened!", "success");
        return;
      }
    } catch (tauriErr) {
      console.warn("[HTMLExport] Native Tauri invoke fallback:", tauriErr);
    }

    // 2. Fallback for browser
    if (!saved) {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastStore.showToast("Executive report downloaded successfully!", "success");
    }
  } catch (err) {
    console.error("[DownloadReport] Error:", err);
    toastStore.showToast("Error downloading report", "error");
  }
}

/**
 * Prepares and opens client email via native mailto / opener.
 */
export async function sendClientEmail(options: ClientEmailOptions): Promise<void> {
  const clientName = options.clientName || "Client";
  const title = options.ticker ? `Executive Analysis • ${options.ticker}` : options.subject || "Fiduciary Wealth Advisory Report";
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

  let metricsText = "";
  if (options.metrics && options.metrics.length > 0) {
    metricsText = "\nKEY INDICATORS:\n" + options.metrics.map(m => `• ${m.label}: ${m.value}`).join("\n") + "\n";
  }

  const plainSummary = options.summary
    ? options.summary
        .replace(/[*_#`]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .slice(0, 1400)
    : "";

  const emailBody = `Dear ${clientName},

Please find below the executive summary and updated financial telemetry regarding ${options.ticker || 'your portfolio'}:
${metricsText}
ANALYTICAL SUMMARY:
${plainSummary}

This report was generated via the Staggi Wealth Intelligence terminal on ${dateStr}.
We remain at your disposal for any clarifications or portfolio allocation adjustments.

Sincerely,
Staggi Wealth Advisory
advisory@staggi.com`;

  const subject = `[Staggi Wealth] ${title}`;
  const recipient = options.clientEmail || "";
  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(emailBody).catch(() => {});
  }

  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(mailtoUrl);
    toastStore.showToast("Opening email client (summary copied!)", "success");
  } catch {
    window.open(mailtoUrl, "_blank");
    toastStore.showToast("Executive summary copied to clipboard!", "success");
  }
}
