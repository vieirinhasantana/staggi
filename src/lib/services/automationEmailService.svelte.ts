import { marked } from "marked";
import { pluginsStore } from "./pluginsState.svelte";
import type { ScheduledTask } from "$lib/types";

export interface AutomationEmailConfig {
  enabled: boolean;
  defaultRecipient: string;
  senderName: string;
  senderEmail: string;
}

const STORAGE_KEY = "staggi_automation_email_config_v1";

const DEFAULT_CONFIG: AutomationEmailConfig = {
  enabled: true,
  defaultRecipient: "advisory@staggi.com.br",
  senderName: "Staggi Wealth Management",
  senderEmail: "advisory@staggi.com.br",
};

export interface EmailDispatchResult {
  success: boolean;
  status: "sent" | "simulated" | "failed";
  recipient: string;
  mode: "mcp" | "simulated" | "direct";
  message: string;
  error?: string;
  htmlContent?: string;
}

class AutomationEmailService {
  config = $state<AutomationEmailConfig>(DEFAULT_CONFIG);

  constructor() {
    if (typeof window !== "undefined") {
      this.loadConfig();
    }
  }

  loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
        return;
      }
    } catch {
      // Fallback
    }
    this.config = { ...DEFAULT_CONFIG };
  }

  saveConfig(updates: Partial<AutomationEmailConfig>) {
    this.config = { ...this.config, ...updates };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch (err) {
        console.error("[AutomationEmailService] Error saving config:", err);
      }
    }
  }

  generateHtml(
    task: ScheduledTask,
    resultText: string,
    recipientEmail: string,
    status: "SUCCESS" | "WARNING" | "ALERT" = "SUCCESS"
  ): string {
    const dateStr = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const nextRunStr = task.nextRun
      ? new Date(task.nextRun).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Conforme agendamento";

    const statusMap = {
      SUCCESS: {
        badge_bg: "#dcfce7",
        badge_text: "#16a34a",
        label: "MONITORAMENTO ATIVO",
      },
      WARNING: {
        badge_bg: "#fef3c7",
        badge_text: "#d97706",
        label: "AÇÃO RECOMENDADA",
      },
      ALERT: {
        badge_bg: "#fee2e2",
        badge_text: "#dc2626",
        label: "ALERTA DE RISCO DETECTADO",
      },
    };
    const stInfo = statusMap[status] || statusMap.SUCCESS;

    // Convert full markdown to sanitized HTML after cleaning LaTeX escapes (e.g. '\$' -> '$')
    const cleanResult = (resultText || "").replace(/\\(\$)/g, "$1");
    const renderedResultHtml = marked.parse(cleanResult) as string;

    const emailTitle =
      status === "ALERT" || status === "WARNING"
        ? `[${status === "ALERT" ? "ALERTA" : "ATENÇÃO"}] Staggi Wealth • ${task.name}`
        : `Staggi Wealth • ${task.name}`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f9;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 660px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 32px 40px;
      color: #ffffff;
      text-align: left;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #ffffff;
    }
    .header .subtitle {
      margin: 0;
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
    }
    .content {
      padding: 36px 40px;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background-color: ${stInfo.badge_bg};
      color: ${stInfo.badge_text};
      margin-bottom: 20px;
    }
    .greeting {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 20px;
    }
    .card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 18px 22px;
      margin: 20px 0;
    }
    .card-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: #0284c7;
      letter-spacing: 0.05em;
      margin-top: 0;
      margin-bottom: 8px;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 26px;
      margin-bottom: 12px;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 6px;
    }
    .report-body {
      font-size: 14px;
      line-height: 1.7;
      color: #334155;
    }
    .report-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-size: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background-color: #ffffff;
    }
    .report-body th {
      background-color: #f1f5f9;
      padding: 10px 12px;
      text-align: left;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid #e2e8f0;
      color: #0f172a;
      white-space: nowrap;
    }
    .report-body td {
      padding: 9px 12px;
      border: 1px solid #e2e8f0;
      color: #334155;
      font-size: 12px;
      line-height: 1.4;
    }
    .report-body tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .report-body ul, .report-body ol {
      padding-left: 20px;
      margin: 12px 0;
    }
    .report-body li {
      margin-bottom: 6px;
    }
    .report-body strong {
      color: #0f172a;
      font-weight: 600;
    }
    .report-body p {
      margin: 10px 0;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 16px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 13px 30px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      box-shadow: 0 2px 8px rgba(2, 132, 199, 0.25);
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 40px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
      border-top: 1px solid #e2e8f0;
    }
    .footer strong {
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="subtitle">Staggi Wealth Management • Relatório de Acompanhamento</div>
      <h1>${task.name}</h1>
    </div>
    <div class="content">
      <div class="status-badge">${stInfo.label}</div>
      <p class="greeting">
        Relatório de monitoramento patrimonial atualizado em <strong>${dateStr}</strong> para <strong>${recipientEmail}</strong>.
      </p>

      ${
        task.description && task.description.trim()
          ? `
      <div class="card">
        <div class="card-title">Objetivo do Monitoramento</div>
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #334155;">
          ${task.description}
        </p>
      </div>`
          : ""
      }

      <div class="section-title">Resultados do Monitoramento</div>
      <div class="report-body">
        ${renderedResultHtml}
      </div>

      <div class="section-title">Próximos Passos & Alocação</div>
      <p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
        Os parâmetros de risco e oportunidades identificadas permanecem sob monitoramento ativo.
        Para estruturar estratégias de rebalanceamento ou consultar detalhes operacionais, contate sua assessoria de investimentos.
      </p>

      <div class="btn-container">
        <a href="mailto:advisory@staggi.com.br?subject=FEEDBACK%20MONITORAMENTO%20${encodeURIComponent(task.name)}" class="btn">
          Acessar Terminal Staggi
        </a>
      </div>
    </div>
    <div class="footer">
      <strong>Staggi Wealth Management</strong> • Inteligência e Gestão Patrimonial Offshore<br>
      Comunicação confidencial para acompanhamento de carteiras e suporte à tomada de decisão de investimentos.
    </div>
  </div>
</body>
</html>`;
  }

  generatePlainText(
    task: ScheduledTask,
    resultText: string,
    recipientEmail: string,
    status: string = "SUCCESS"
  ): string {
    const dateStr = new Date().toLocaleString("pt-BR");
    return `=======================================================
STAGGI WEALTH MANAGEMENT - RELATÓRIO DE MONITORAMENTO
=======================================================
Assunto: ${task.name}
Data/Hora: ${dateStr}
Destinatário: ${recipientEmail}

${task.description ? `=======================================================\nOBJETIVO DO MONITORAMENTO\n=======================================================\n${task.description}\n` : ""}
=======================================================
RESULTADOS DO MONITORAMENTO
=======================================================
${resultText}

=======================================================
Staggi Wealth Management • advisory@staggi.com.br
`;
  }

  /**
   * Dispatches the automation report via the MCP tool `send_automation_report_email` if available,
   * or records a simulated dispatch.
   */
  async dispatchAutomationEmail(
    task: ScheduledTask,
    resultText: string,
    options?: {
      overrideRecipient?: string;
      overrideSubject?: string;
      status?: "SUCCESS" | "WARNING" | "ALERT";
    }
  ): Promise<EmailDispatchResult> {
    const recipient = (
      (options?.overrideRecipient && options.overrideRecipient.trim()) ||
      (task.emailRecipient && task.emailRecipient.trim()) ||
      (this.config.defaultRecipient && this.config.defaultRecipient.trim()) ||
      "advisory@staggi.com.br"
    ).trim();

    const status = options?.status || "SUCCESS";
    const subject =
      options?.overrideSubject ||
      task.emailSubject ||
      (status === "ALERT" || status === "WARNING"
        ? `[${status === "ALERT" ? "ALERTA" : "ATENÇÃO"}] Staggi Wealth • ${task.name}`
        : `Staggi Wealth • ${task.name}`);

    const htmlContent = this.generateHtml(task, resultText, recipient, status);
    const plainText = this.generatePlainText(task, resultText, recipient, status);

    // 1. Try MCP tool `send_automation_report_email` if any active MCP provides it
    const mcpWithEmail = pluginsStore.mcps.find(
      (m) =>
        m.active &&
        m.tools &&
        m.tools.some((t) => t.name === "send_automation_report_email")
    );

    if (mcpWithEmail) {
      try {
        const mcpResult = await pluginsStore.callTool(
          mcpWithEmail.id,
          "send_automation_report_email",
          {
            automation_name: task.name,
            summary: task.description || `Relatório de acompanhamento patrimonial: ${task.name}`,
            details: resultText,
            recipient_email: recipient,
            status,
          }
        );

        if (mcpResult?.error) {
          throw new Error(mcpResult.error.message || JSON.stringify(mcpResult.error));
        }
        if (mcpResult?.result?.isError) {
          const errText = mcpResult.result.content?.[0]?.text || "Erro retornado pela ferramenta de e-mail";
          throw new Error(errText);
        }

        return {
          success: true,
          status: "sent",
          recipient,
          mode: "mcp",
          message: `E-mail formal enviado com sucesso via ${mcpWithEmail.name} para ${recipient}.`,
          htmlContent,
        };
      } catch (err: any) {
        console.warn(
          "[AutomationEmailService] MCP send_automation_report_email failed, fallback to local:",
          err
        );
      }
    }

    // 2. Local simulated dispatch (or when MCP is not available)
    console.info(
      `[AutomationEmailService] Relatório formatado pronto para ${recipient} (Modo Simulado / Registro Interno).`
    );

    return {
      success: true,
      status: "simulated",
      recipient,
      mode: "simulated",
      message: `Relatório de ${task.name} preparado e formatado no padrão institucional para ${recipient}.`,
      htmlContent,
    };
  }
}

export const automationEmailStore = new AutomationEmailService();
