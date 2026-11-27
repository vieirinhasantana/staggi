import { marked } from "marked";

/**
 * Sanitizes raw HTML output against Cross-Site Scripting (XSS).
 * Strips script tags, unsafe frames/objects/forms, and all inline DOM event handlers.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  let clean = html;

  // 1. Strip active code execution tags (script, style, iframe, object, embed, form controls)
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  clean = clean.replace(/<embed\b[^>]*>/gi, "");
  clean = clean.replace(/<applet\b[^>]*>/gi, "");
  clean = clean.replace(/<base\b[^>]*>/gi, "");
  clean = clean.replace(/<meta\b[^>]*>/gi, "");
  clean = clean.replace(/<link\b[^>]*>/gi, "");
  clean = clean.replace(/<\/?(?:form|input|button|textarea|select|option)\b[^>]*>/gi, "");

  // 2. Strip all inline DOM event handlers (onerror, onload, onclick, onfocus, etc.)
  clean = clean.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "");

  // 3. Neutralize dangerous pseudo-protocols (javascript:, vbscript:, data:text/html)
  clean = clean.replace(/\s+(?:href|src)\s*=\s*(['"])\s*(?:javascript:|vbscript:|data:\s*text\/html)[^'"]*\1/gi, ' href="#"');

  // 4. Secure external hyperlinks with noopener, noreferrer, and target="_blank"
  clean = clean.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1([^>]*)>/gi, (_match, _q, href, rest) => {
    const trimmedHref = href.trim();
    const isSafe = /^https?:\/\//i.test(trimmedHref) || /^mailto:/i.test(trimmedHref);
    const safeHref = isSafe ? trimmedHref : "#";
    const cleanRest = rest.replace(/\s+(?:target|rel)\s*=\s*(['"]).*?\1/gi, "");
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${cleanRest}>`;
  });

  return clean;
}

// High-performance LRU cache for rendered markdown output
const RENDER_CACHE_MAX = 100;
const renderCache = new Map<string, string>();

/**
 * Preprocesses markdown text (cleaning LLM metadata banners, fixing malformed markdown tables)
 * and renders it safely to sanitized HTML with LRU caching.
 */
export function renderMarkdown(content: string): string {
  if (!content) return "";

  // Check cache first for instant retrieval on re-renders
  const cached = renderCache.get(content);
  if (cached !== undefined) {
    return cached;
  }

  try {
    let processed = content;

    // Clean internal MCP logs / banners
    processed = processed.replace(/^Consultando\s+o\s+mcp-[a-z0-9_-]+[^\n]*:?\s*\n?/gim, "");
    processed = processed.replace(/^Acessando\s+o\s+servidor\s+mcp-[a-z0-9_-]+[^\n]*:?\s*\n?/gim, "");
    processed = processed.replace(/^Com\s+base\s+no\s+mcp-[a-z0-9_-]+[^\n]*:?\s*\n?/gim, "");
    processed = processed.replace(/(?:\n|^)\s*(?:Fonte Auditada|Audited Source):\s*[^\n]+/gi, "");

    processed = processed.replace(/\|\s*\|\s*(?=[A-Za-z0-9\*\_\#])/g, "|\n|");

    const rawLines = processed.split("\n");
    const mergedLines: string[] = [];
    let accumulator = "";

    for (const l of rawLines) {
      const trimmed = l.trim();
      if (!trimmed) {
        if (accumulator) {
          mergedLines.push(accumulator);
          accumulator = "";
        }
        mergedLines.push(l);
        continue;
      }

      if (accumulator) {
        accumulator += " " + trimmed;
        if (accumulator.endsWith("|")) {
          mergedLines.push(accumulator);
          accumulator = "";
        }
      } else if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        mergedLines.push(trimmed);
      } else if (trimmed.startsWith("|")) {
        accumulator = trimmed;
      } else {
        mergedLines.push(l);
      }
    }
    if (accumulator) {
      mergedLines.push(accumulator);
    }
    processed = mergedLines.join("\n");

    // Convert tab-delimited tables to markdown tables if present
    if (processed.includes("\t")) {
      const lines = processed.split("\n");
      const convertedLines: string[] = [];
      let inTabTable = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split("\t").map(p => p.trim());
        if (parts.length >= 3) {
          if (!inTabTable) {
            inTabTable = true;
            convertedLines.push("| " + parts.join(" | ") + " |");
            convertedLines.push("| " + parts.map(() => "---").join(" | ") + " |");
          } else {
            convertedLines.push("| " + parts.join(" | ") + " |");
          }
        } else {
          inTabTable = false;
          convertedLines.push(line);
        }
      }
      processed = convertedLines.join("\n");
    }

    // Auto-repair missing table separator rows
    const lines = processed.split("\n");
    const fixedLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      fixedLines.push(lines[i]);
      if (
        l.startsWith("|") &&
        l.endsWith("|") &&
        l.split("|").length >= 3 &&
        !l.includes("---") &&
        i + 1 < lines.length &&
        lines[i + 1].trim().startsWith("|") &&
        !lines[i + 1].includes("---")
      ) {
        const colCount = l.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).length;
        fixedLines.push("| " + Array(colCount).fill("---").join(" | ") + " |");
      }
    }
    processed = fixedLines.join("\n");

    // Format raw JSON code blocks or bare JSON dumps returned directly by tools/MCP
    if (processed.trim().startsWith("{") && processed.trim().endsWith("}") && !processed.includes("```")) {
      try {
        const parsed = JSON.parse(processed.trim());
        processed = "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
      } catch {
        // Not pure JSON, keep as is
      }
    } else if (processed.trim().startsWith("[") && processed.trim().endsWith("]") && !processed.includes("```")) {
      try {
        const parsed = JSON.parse(processed.trim());
        processed = "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
      } catch {
        // Not pure JSON array, keep as is
      }
    }

    const rawHtml = marked.parse(processed, { breaks: true, gfm: true }) as string;
    let sanitized = sanitizeHtml(rawHtml);

    // Wrap all <table> elements in responsive, horizontally-scrollable containers
    sanitized = sanitized.replace(/<table\b[^>]*>(?:(?!<\/table>)<[^<]*)*<\/table>/gi, (tableHtml) => {
      return `<div class="table-wrapper custom-scrollbar">${tableHtml}</div>`;
    });

    if (renderCache.size >= RENDER_CACHE_MAX) {
      const firstKey = renderCache.keys().next().value;
      if (firstKey !== undefined) {
        renderCache.delete(firstKey);
      }
    }
    renderCache.set(content, sanitized);

    return sanitized;
  } catch {
    return content;
  }
}
