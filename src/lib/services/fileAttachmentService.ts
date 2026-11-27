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
 * Automatically parses PDF files using the backend PDF text extraction engine.
 */
export async function readFileAsAttachment(file: File): Promise<AttachedFile> {
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const sizeFormatted = formatFileSize(file.size);
  const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type.includes("pdf");
  const isTextual = file.type.startsWith("text/") || 
    /\.(csv|tsv|json|txt|md|yaml|yml|xml|html|js|ts|py|sql)$/i.test(file.name);

  // If PDF, extract full textual layer via Tauri command or fallback
  if (isPdf) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));
      
      let extractedText = "";
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        extractedText = await invoke<string>("extract_pdf_text", { bytes });
      } catch (invokeErr) {
        console.warn("Tauri extract_pdf_text invoke failed, attempting fallback:", invokeErr);
      }

      if (extractedText && extractedText.trim().length > 0) {
        return {
          id,
          name: file.name,
          size: file.size,
          sizeFormatted,
          type: "application/pdf",
          content: extractedText.trim(),
          isBinary: false
        };
      }
    } catch (pdfErr) {
      console.error("Error extracting PDF text:", pdfErr);
    }
  }

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
      reader.onerror = () => reject(new Error(`Failed to read text file ${file.name}`));
      reader.readAsText(file);
    } else {
      // Binary (Image, unextracted PDF fallback, etc.) -> Read as Data URL
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
      reader.onerror = () => reject(new Error(`Failed to read binary file ${file.name}`));
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
      return `\n[ATTACHED FILE: ${att.name} (${att.sizeFormatted}) • Format: ${att.type}]:
(Binary file attached for contextual reference)`;
    }
    
    // Truncate excessively huge files to protect token limit
    const cleanContent = att.content.length > 50000
      ? att.content.slice(0, 50000) + "\n...[Remaining document content truncated to respect token window]"
      : att.content;

    const isPdf = att.name.toLowerCase().endsWith(".pdf") || att.type.includes("pdf");

    if (isPdf) {
      return `\n[ATTACHED PDF DOCUMENT: ${att.name} (${att.sizeFormatted})]:
--- BEGIN EXTRACTED DOCUMENT TEXT ---
${cleanContent}
--- END EXTRACTED DOCUMENT TEXT ---`;
    }

    return `\n[ATTACHED FILE CONTENT: ${att.name} (${att.sizeFormatted})]:
\`\`\`
${cleanContent}
\`\`\``;
  }).join("\n\n");

  const promptText = userPrompt.trim()
    ? userPrompt.trim()
    : "Please analyze the attached file(s), extract the key metrics, identify risks and opportunities, and provide a structured executive summary.";

  return `${promptText}\n\n---\n${fileBlocks}\n---`;
}
