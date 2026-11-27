import { marked } from "marked";
import { toastStore } from "./toastService.svelte";

export interface MetricItem {
  label: string;
  value: string;
  badge?: string;
  isPositive?: boolean;
}

export interface ExecutiveReportOptions {
  title: string;
  subtitle?: string;
  ticker?: string;
  clientName?: string;
  auditedSource?: string;
  summary?: string;
  metrics?: MetricItem[];
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
 * Escapes characters for PDF WinAnsi / Latin1 strings.
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

/**
 * A clean, self-contained Vector PDF Document Builder (PDF-1.4 standard).
 * Generates pristine A4 documents compatible with Apple Preview, Adobe Acrobat, Edge, and Chrome.
 */
class VectorPdfBuilder {
  private pages: string[][] = [[]];
  private currentPage = 0;
  private width = 595.28; // A4 pt width
  private height = 841.89; // A4 pt height
  private marginLeft = 36;
  private marginRight = 36;
  private contentWidth = 595.28 - 72; // 523.28
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

  public ensureSpace(neededHeight: number, onNewPageHeader?: () => void): void {
    if (this.currentY - neededHeight < 55) {
      this.newPage();
      if (onNewPageHeader) {
        onNewPageHeader();
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
    strokeRgb: [number, number, number] = [0.8, 0.8, 0.8],
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
    const color = options.colorRgb || [0.1, 0.1, 0.1];
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

  public build(): Uint8Array {
    const totalPages = this.pages.length;

    // Add footer to all pages
    for (let p = 0; p < totalPages; p++) {
      const footerY = 22;
      const separatorY = 32;
      // Line
      const lineCmd = `q\n0.5 w\n0.8 0.85 0.9 RG\n${this.marginLeft} ${separatorY} m ${(this.width - this.marginRight)} ${separatorY} l S\nQ`;
      this.pages[p].push(lineCmd);

      // Disclaimer
      const disc = "STAGGI WEALTH INTELLIGENCE • RELATÓRIO EXECUTIVO FIDUCIÁRIO • DOCUMENTO CONFIDENCIAL";
      const discEncoded = encodePdfString(disc);
      this.pages[p].push(`BT\n/F1 6.5 Tf\n0.5 0.55 0.65 rg\n${this.marginLeft} ${footerY} Td\n(${discEncoded}) Tj\nET`);

      // Page numbering
      const pageText = `Página ${p + 1} de ${totalPages}`;
      const pageEncoded = encodePdfString(pageText);
      const pageX = this.width - this.marginRight - 70;
      this.pages[p].push(`BT\n/F2 7 Tf\n0.4 0.45 0.55 rg\n${pageX} ${footerY} Td\n(${pageEncoded}) Tj\nET`);
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
 * Extracts rows and columns from markdown or plain text tables.
 */
function parseTableRows(text: string): string[][] {
  const lines = text.split("\n");
  const rows: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    // Check if separator line (|---|---|)
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
 * Generates a high-quality fiduciary vector PDF from executive report options.
 */
export function generateVectorPdf(options: ExecutiveReportOptions): Uint8Array {
  const pdf = new VectorPdfBuilder();
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const contentWidth = pdf.getUsableWidth();
  const startX = 36;

  // 1. Header Banner (Dark Fiduciary Slate: #0f172a)
  const headerHeight = 75;
  const headerY = 841.89 - headerHeight;
  pdf.drawRect(0, headerY, 595.28, headerHeight, [0.059, 0.090, 0.165]); // #0f172a

  // Brand Logo & Subtitle
  pdf.drawText("STAGGI", startX, headerY + 44, {
    font: "/F2",
    size: 20,
    colorRgb: [1, 1, 1],
  });
  pdf.drawText(".", startX + 78, headerY + 44, {
    font: "/F2",
    size: 20,
    colorRgb: [0.020, 0.750, 0.500], // Emerald dot
  });
  pdf.drawText(
    "FIDUCIARY WEALTH INTELLIGENCE • RELATÓRIO EXECUTIVO",
    startX,
    headerY + 24,
    {
      font: "/F2",
      size: 7.5,
      colorRgb: [0.58, 0.65, 0.75],
    }
  );

  // Meta info on the right
  const metaRightX = 410;
  pdf.drawText(`Data: ${dateStr} às ${timeStr}`, metaRightX, headerY + 48, {
    font: "/F1",
    size: 8,
    colorRgb: [0.85, 0.9, 0.95],
  });
  if (options.clientName) {
    pdf.drawText(`Cliente: ${options.clientName}`, metaRightX, headerY + 34, {
      font: "/F2",
      size: 8,
      colorRgb: [1, 1, 1],
    });
  }
  const sourceText = options.auditedSource || "Auditoria MCP Staggi";
  pdf.drawText(sourceText, metaRightX, headerY + 20, {
    font: "/F1",
    size: 7.5,
    colorRgb: [0.3, 0.8, 0.6],
  });

  // Cursor below header
  let y = headerY - 26;

  // 2. Document Title & Subtitle
  pdf.drawText(options.title, startX, y, {
    font: "/F2",
    size: 15,
    colorRgb: [0.059, 0.090, 0.165],
  });
  y -= 14;

  if (options.subtitle) {
    pdf.drawText(options.subtitle, startX, y, {
      font: "/F1",
      size: 9.5,
      colorRgb: [0.35, 0.45, 0.55],
    });
    y -= 14;
  }

  // Divider
  pdf.drawLine(startX, y, startX + contentWidth, y, [0.85, 0.88, 0.92], 0.75);
  y -= 18;

  // 3. Verdict Banner (if present)
  if (options.verdict) {
    const verdictLines = pdf.wrapText(`Veredito Fiduciário: ${options.verdict}`, contentWidth - 24, 9);
    const boxHeight = verdictLines.length * 12 + 16;
    pdf.drawRect(startX, y - boxHeight + 12, contentWidth, boxHeight, [0.93, 0.98, 0.96], [0.8, 0.92, 0.85], 0.5);
    // Green accent stripe
    pdf.drawRect(startX, y - boxHeight + 12, 4, boxHeight, [0.02, 0.59, 0.41]);

    let vy = y - 4;
    for (let i = 0; i < verdictLines.length; i++) {
      pdf.drawText(verdictLines[i], startX + 14, vy, {
        font: i === 0 ? "/F2" : "/F1",
        size: 9,
        colorRgb: [0.02, 0.38, 0.28],
      });
      vy -= 12;
    }
    y -= boxHeight + 12;
  }

  // 4. Key Metrics Grid
  if (options.metrics && options.metrics.length > 0) {
    const metrics = options.metrics.slice(0, 6);
    const count = metrics.length;
    const cols = Math.min(count, 4);
    const gap = 10;
    const cardWidth = (contentWidth - gap * (cols - 1)) / cols;
    const cardHeight = 52;

    const rows = Math.ceil(count / cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= count) break;
        const m = metrics[idx];
        const cx = startX + c * (cardWidth + gap);
        const cy = y - cardHeight;

        // Card background & border
        pdf.drawRect(cx, cy, cardWidth, cardHeight, [0.97, 0.98, 0.99], [0.85, 0.89, 0.94], 0.5);

        // Metric label
        pdf.drawText(m.label, cx + 8, cy + cardHeight - 16, {
          font: "/F2",
          size: 7.5,
          colorRgb: [0.4, 0.48, 0.58],
        });

        // Metric value
        const valColor: [number, number, number] =
          m.isPositive === true
            ? [0.02, 0.59, 0.41]
            : m.isPositive === false
            ? [0.86, 0.15, 0.15]
            : [0.06, 0.09, 0.16];

        pdf.drawText(m.value, cx + 8, cy + cardHeight - 34, {
          font: "/F2",
          size: 12,
          colorRgb: valColor,
        });

        if (m.badge) {
          pdf.drawText(m.badge, cx + 8, cy + 8, {
            font: "/F1",
            size: 6.5,
            colorRgb: [0.55, 0.6, 0.68],
          });
        }
      }
      y -= cardHeight + 12;
    }
  }

  // Helper for continuation headers on new page
  const handleNewPage = () => {
    pdf.drawRect(0, 841.89 - 30, 595.28, 30, [0.059, 0.090, 0.165]);
    pdf.drawText("STAGGI WEALTH INTELLIGENCE • " + options.title + " (Continuação)", startX, 841.89 - 20, {
      font: "/F2",
      size: 8,
      colorRgb: [0.9, 0.95, 1],
    });
    pdf.setY(841.89 - 48);
  };

  // 5. Check for Markdown Tables
  const rawText = options.rawMarkdown || options.summary || "";
  const tableRows = parseTableRows(rawText);

  // If table exists, render structured table
  if (tableRows.length > 1) {
    pdf.ensureSpace(60, handleNewPage);
    y = pdf.getY();

    pdf.drawText("ALOCAÇÃO DETALHADA & POSICIONAMENTO", startX, y, {
      font: "/F2",
      size: 9.5,
      colorRgb: [0.06, 0.09, 0.16],
    });
    y -= 14;

    const numCols = tableRows[0].length;
    const colWidth = contentWidth / numCols;
    const rowHeight = 18;

    // Table Header
    pdf.drawRect(startX, y - rowHeight + 4, contentWidth, rowHeight, [0.92, 0.94, 0.97], [0.75, 0.8, 0.88], 0.5);
    for (let c = 0; c < numCols; c++) {
      const cellText = tableRows[0][c] || "";
      pdf.drawText(cellText, startX + c * colWidth + 6, y - 9, {
        font: "/F2",
        size: 7.5,
        colorRgb: [0.06, 0.09, 0.16],
      });
    }
    y -= rowHeight;

    // Table Rows
    for (let r = 1; r < tableRows.length; r++) {
      pdf.ensureSpace(rowHeight + 10, handleNewPage);
      y = pdf.getY();

      const bg: [number, number, number] = r % 2 === 0 ? [0.98, 0.99, 1] : [1, 1, 1];
      pdf.drawRect(startX, y - rowHeight + 4, contentWidth, rowHeight, bg, [0.88, 0.9, 0.94], 0.4);

      for (let c = 0; c < numCols; c++) {
        const cellText = tableRows[r][c] || "";
        pdf.drawText(cellText, startX + c * colWidth + 6, y - 9, {
          font: "/F1",
          size: 7.5,
          colorRgb: [0.15, 0.2, 0.28],
        });
      }
      y -= rowHeight;
      pdf.setY(y);
    }
    y -= 14;
    pdf.setY(y);
  }

  // 6. Text Body Analysis (Markdown paragraphs, lists, headers)
  const textLines = rawText.split("\n");
  for (const line of textLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      y -= 6;
      pdf.setY(y);
      continue;
    }

    // Skip table lines already rendered
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) continue;

    // Section Header (## or #)
    if (trimmed.startsWith("# ") || trimmed.startsWith("## ")) {
      pdf.ensureSpace(35, handleNewPage);
      y = pdf.getY();
      const hText = trimmed.replace(/^#+\s*/, "").replace(/[*_`]/g, "");
      y -= 10;
      pdf.drawText(hText, startX, y, {
        font: "/F2",
        size: 11,
        colorRgb: [0.06, 0.09, 0.16],
      });
      y -= 4;
      pdf.drawLine(startX, y, startX + contentWidth, y, [0.88, 0.9, 0.94], 0.5);
      y -= 12;
      pdf.setY(y);
      continue;
    }

    // Sub-header (###)
    if (trimmed.startsWith("### ")) {
      pdf.ensureSpace(24, handleNewPage);
      y = pdf.getY();
      const subText = trimmed.replace(/^###\s*/, "").replace(/[*_`]/g, "");
      y -= 8;
      pdf.drawText(subText, startX, y, {
        font: "/F2",
        size: 9.5,
        colorRgb: [0.15, 0.22, 0.32],
      });
      y -= 10;
      pdf.setY(y);
      continue;
    }

    // Bullet points (- or *)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const bulletContent = trimmed.slice(2).replace(/[*_`]/g, "");
      const wrapped = pdf.wrapText(bulletContent, contentWidth - 18, 8.5);

      pdf.ensureSpace(wrapped.length * 12 + 4, handleNewPage);
      y = pdf.getY();

      for (let i = 0; i < wrapped.length; i++) {
        if (i === 0) {
          pdf.drawText("•", startX + 4, y, {
            font: "/F2",
            size: 9,
            colorRgb: [0.02, 0.59, 0.41],
          });
        }
        pdf.drawText(wrapped[i], startX + 16, y, {
          font: "/F1",
          size: 8.5,
          colorRgb: [0.2, 0.25, 0.35],
        });
        y -= 12;
      }
      pdf.setY(y);
      continue;
    }

    // Standard Paragraph
    const cleanPara = trimmed.replace(/[*_`]/g, "");
    const wrapped = pdf.wrapText(cleanPara, contentWidth, 8.5);
    pdf.ensureSpace(wrapped.length * 12 + 4, handleNewPage);
    y = pdf.getY();

    for (const wLine of wrapped) {
      pdf.drawText(wLine, startX, y, {
        font: "/F1",
        size: 8.5,
        colorRgb: [0.22, 0.28, 0.38],
      });
      y -= 12;
    }
    y -= 4;
    pdf.setY(y);
  }

  // 7. Signature & Final Fiduciary Disclaimer
  pdf.ensureSpace(60, handleNewPage);
  y = pdf.getY();
  y -= 12;
  pdf.drawLine(startX, y, startX + contentWidth, y, [0.85, 0.88, 0.92], 0.75);
  y -= 16;

  pdf.drawText("Staggi Wealth Advisory", startX, y, {
    font: "/F2",
    size: 9,
    colorRgb: [0.06, 0.09, 0.16],
  });
  pdf.drawText("Alocação & Estruturação Patrimonial Fiduciária", startX, y - 11, {
    font: "/F1",
    size: 7.5,
    colorRgb: [0.45, 0.52, 0.62],
  });

  return pdf.build();
}

/**
 * Generates an executive A4-optimized fiduciary report in HTML for browser view/export.
 */
export function generateExecutiveReportHtml(options: ExecutiveReportOptions): string {
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("pt-BR", {
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
        <div class="section-header">Telemetria & Gráfico Executivo</div>
        <div class="chart-wrapper">
          ${options.chartSvg}
        </div>
      </div>
    `
    : "";

  const verdictSection = options.verdict
    ? `
      <div class="verdict-banner">
        <strong>Veredito Fiduciário:</strong> ${options.verdict}
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${options.title} • Staggi Wealth Intelligence</title>
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
        <div class="brand-subtitle">Fiduciary Wealth Intelligence • Relatório Executivo</div>
      </div>
      <div class="header-meta">
        <div><strong>Data:</strong> ${dateStr} às ${timeStr}</div>
        ${options.clientName ? `<div><strong>Cliente:</strong> ${options.clientName}</div>` : ''}
        ${options.auditedSource ? `<div>${options.auditedSource}</div>` : '<div>Auditoria Fiduciária</div>'}
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
        <strong>Nota:</strong> Documento gerado pelo terminal Staggi Wealth Intelligence. As rentabilidades passadas não garantem resultados futuros.
      </div>
      <div>
        <strong>Staggi Wealth Advisory</strong>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Exports the executive report as a vector PDF.
 * Saves natively to ~/Downloads and immediately opens in macOS Preview / system default viewer.
 */
export async function exportReportAsPdf(options: ExecutiveReportOptions): Promise<void> {
  try {
    toastStore.showToast("Gerando relatório fiduciário em PDF...", "info");

    const pdfBytes = generateVectorPdf(options);
    const cleanTitle = (options.ticker || options.title || "Relatorio")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Staggi_${cleanTitle}_${dateStr}.pdf`;

    let saved = false;

    // 1. Try Native Tauri Save & Open (macOS Preview / Windows Viewer)
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const savedPath = await invoke<string>("save_and_open_pdf_report", {
        filename,
        bytes: Array.from(pdfBytes),
      });

      if (savedPath) {
        saved = true;
        toastStore.showToast("Relatório PDF salvo em Downloads e aberto no Visualizador!", "success");
        return;
      }
    } catch (tauriErr) {
      console.warn("[PDFExport] Native Tauri invoke unavailable, falling back to browser download:", tauriErr);
    }

    // 2. Fallback for Web Browser environment
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

      toastStore.showToast("Relatório PDF baixado com sucesso!", "success");
    }
  } catch (err) {
    console.error("[PDFExport] Error:", err);
    toastStore.showToast("Erro ao exportar PDF", "error");
  }
}

/**
 * Downloads a standalone executive HTML report file.
 */
export async function downloadExecutiveReportHtml(options: ExecutiveReportOptions): Promise<void> {
  try {
    const html = generateExecutiveReportHtml(options);
    const cleanTitle = (options.ticker || options.title || "Relatorio")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Staggi_${cleanTitle}_${dateStr}.html`;

    let saved = false;

    // 1. Try Native Tauri Save & Open
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const savedPath = await invoke<string>("save_and_open_html_report", {
        filename,
        htmlContent: html,
      });

      if (savedPath) {
        saved = true;
        toastStore.showToast("Relatório HTML salvo em Downloads e aberto!", "success");
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
      toastStore.showToast("Relatório executivo baixado com sucesso!", "success");
    }
  } catch (err) {
    console.error("[DownloadReport] Error:", err);
    toastStore.showToast("Erro ao baixar relatório", "error");
  }
}

/**
 * Prepares and opens client email via native mailto / opener.
 */
export async function sendClientEmail(options: ClientEmailOptions): Promise<void> {
  const clientName = options.clientName || "Cliente";
  const title = options.ticker ? `Análise Executiva • ${options.ticker}` : options.subject || "Relatório Patrimonial Fiduciário";
  const dateStr = new Date().toLocaleDateString("pt-BR");

  let metricsText = "";
  if (options.metrics && options.metrics.length > 0) {
    metricsText = "\nINDICADORES CHAVE:\n" + options.metrics.map(m => `• ${m.label}: ${m.value}`).join("\n") + "\n";
  }

  const plainSummary = options.summary
    ? options.summary
        .replace(/[*_#`]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .slice(0, 1400)
    : "";

  const emailBody = `Prezado(a) ${clientName},

Segue o resumo executivo e a telemetria financeira atualizada referente a ${options.ticker || 'sua carteira'}:
${metricsText}
RESUMO ANALÍTICO:
${plainSummary}

Este relatório foi gerado através do terminal Staggi Wealth Intelligence em ${dateStr}.
Ficamos à disposição para esclarecimentos ou eventuais ajustes de alocação.

Atenciosamente,
Staggi Wealth Advisory
advisory@staggi.com.br`;

  const subject = `[Staggi Wealth] ${title}`;
  const recipient = options.clientEmail || "";
  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(emailBody).catch(() => {});
  }

  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(mailtoUrl);
    toastStore.showToast("Abrindo cliente de e-mail (resumo copiado!)", "success");
  } catch {
    window.open(mailtoUrl, "_blank");
    toastStore.showToast("Resumo executivo copiado para a área de transferência!", "success");
  }
}
