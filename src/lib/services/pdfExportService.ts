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
 * Generates an executive A4-optimized fiduciary report ready for PDF export or printing.
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
    .header-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      background-color: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
      margin-top: 4px;
    }
    .document-title-row {
      margin-bottom: 14px;
    }
    .document-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px 0;
      letter-spacing: -0.02em;
    }
    .document-subtitle {
      font-size: 9.5pt;
      color: #64748b;
      margin: 0;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .metric-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .metric-label {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
    }
    .metric-value {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
    }
    .metric-value.positive { color: #059669; }
    .metric-value.negative { color: #dc2626; }
    .metric-badge {
      font-size: 7pt;
      font-weight: 600;
      color: #64748b;
      margin-top: 2px;
    }
    .section-card {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .section-header {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .chart-wrapper {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 8px 0;
    }
    .chart-wrapper svg {
      max-width: 100%;
      height: auto;
    }
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
    .content-body h1, .content-body h2 {
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 14px;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .content-body h3 {
      font-size: 9.5pt;
      font-weight: 700;
      color: #1e293b;
      margin-top: 10px;
      margin-bottom: 4px;
    }
    .content-body p {
      margin: 6px 0;
    }
    .content-body ul, .content-body ol {
      padding-left: 18px;
      margin: 6px 0;
    }
    .content-body li {
      margin-bottom: 3px;
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
      line-height: 1.4;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .advisor-signature {
      text-align: right;
      font-size: 7.5pt;
      color: #64748b;
    }
    .advisor-signature strong {
      display: block;
      color: #0f172a;
      font-size: 8.5pt;
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
        ${options.auditedSource ? `<div class="header-badge">${options.auditedSource}</div>` : '<div class="header-badge">Auditoria Fiduciária</div>'}
      </div>
    </div>

    <div class="document-title-row">
      <h1 class="document-title">${options.title}</h1>
      ${options.subtitle ? `<p class="document-subtitle">${options.subtitle}</p>` : ''}
    </div>

    ${verdictSection}
    ${metricsHtml}
    ${chartSection}

    <div class="content-body">
      ${parsedBody}
      ${options.tableHtml || ''}
    </div>

    <div class="footer-disclaimer">
      <div style="max-width: 550px;">
        <strong>Nota de Confidencialidade e Isenção:</strong> Este documento foi elaborado exclusivamente para suporte à tomada de decisão de investimentos fiduciários. As rentabilidades passadas não garantem resultados futuros. Fontes auditadas via Model Context Protocol (MCP) e terminal de inteligência Staggi.
      </div>
      <div class="advisor-signature">
        <strong>Staggi Wealth Advisory</strong>
        Alocação & Estruturação Patrimonial
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers native system PDF print dialog for pristine vector PDF generation.
 */
export function exportReportAsPdf(options: ExecutiveReportOptions): void {
  try {
    const html = generateExecutiveReportHtml(options);
    
    // Create an invisible iframe to print cleanly without changing the main app view
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      toastStore.showToast("Falha ao inicializar renderizador de PDF", "error");
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    toastStore.showToast("Gerando PDF... Selecione 'Salvar como PDF' na janela", "info");

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 3000);
    }, 400);
  } catch (err) {
    console.error("[PDFExport] Error:", err);
    toastStore.showToast("Erro ao gerar PDF", "error");
  }
}

/**
 * Downloads a standalone executive HTML report file.
 */
export function downloadExecutiveReportHtml(options: ExecutiveReportOptions): void {
  try {
    const html = generateExecutiveReportHtml(options);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const cleanTitle = (options.ticker || options.title || "Relatorio")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `Staggi_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toastStore.showToast("Relatório executivo baixado com sucesso!", "success");
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

  // Copy plain text to clipboard for convenience
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
