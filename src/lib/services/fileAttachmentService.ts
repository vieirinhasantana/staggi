import type { AttachedFile } from "$lib/types";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIconCategory(fileName: string, mimeType: string): "pdf" | "spreadsheet" | "image" | "code" | "doc" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType.includes("pdf")) return "pdf";
  if (lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".tsv")) return "spreadsheet";
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(lower)) return "image";
  if (/\.(json|py|rs|ts|js|html|css|sql|yaml|yml)$/i.test(lower)) return "code";
  return "doc";
}

/**
 * Reads a dropped or picked File object into an AttachedFile structure.
 */
export async function readFileAsAttachment(file: File): Promise<AttachedFile> {
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const sizeFormatted = formatFileSize(file.size);
  const isTextual = file.type.startsWith("text/") || 
    /\.(csv|tsv|json|txt|md|yaml|yml|xml|html|js|ts|py|sql)$/i.test(file.name);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    if (isTextual) {
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        resolve({
          id,
          name: file.name,
          size: file.size,
          sizeFormatted,
          type: file.type || "text/plain",
          content: text,
          isBinary: false
        });
      };
      reader.onerror = () => reject(new Error(`Falha ao ler arquivo de texto ${file.name}`));
      reader.readAsText(file);
    } else {
      // Binary (PDF, Image, etc.) -> Read as Data URL
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        resolve({
          id,
          name: file.name,
          size: file.size,
          sizeFormatted,
          type: file.type || "application/octet-stream",
          content: dataUrl,
          isBinary: true
        });
      };
      reader.onerror = () => reject(new Error(`Falha ao ler arquivo binário ${file.name}`));
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Formats user prompt along with the attached files so LLMs can analyze them comprehensively.
 */
export function buildPromptWithAttachments(userPrompt: string, attachments: AttachedFile[]): string {
  if (!attachments || attachments.length === 0) return userPrompt;

  const fileBlocks = attachments.map(att => {
    if (att.isBinary) {
      return `\n[ARQUIVO ANEXADO: ${att.name} (${att.sizeFormatted}) • Formato: ${att.type}]:
(Arquivo binário anexado pelo usuário para referência contextual)`;
    }
    
    // Truncate excessively huge files to protect token limit
    const cleanContent = att.content.length > 35000
      ? att.content.slice(0, 35000) + "\n...[conteúdo restante truncado para respeitar limites de tokens]"
      : att.content;

    return `\n[CONTEÚDO DO ARQUIVO ANEXADO: ${att.name} (${att.sizeFormatted})]:
\`\`\`
${cleanContent}
\`\`\``;
  }).join("\n\n");

  const promptText = userPrompt.trim()
    ? userPrompt.trim()
    : "Por favor, analise o(s) arquivo(s) anexado(s), extraia as métricas principais, identifique riscos ou oportunidades e forneça um resumo executivo estruturado.";

  return `${promptText}\n\n---\n${fileBlocks}\n---`;
}
