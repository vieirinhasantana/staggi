import type { ChatMessage, ChatSession } from "$lib/types";

const SESSIONS_STORAGE_KEY = "staggi_chat_sessions_v1";
const ACTIVE_SESSION_KEY = "staggi_active_session_id_v1";
const MAX_SESSIONS = 50; // Keep up to 50 historical chat sessions
const MAX_MESSAGES_PER_SESSION = 80; // Limit messages stored per session to avoid LocalStorage quota overflow

function getFormattedTime(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function cleanTitle(prompt: string): string {
  let title = prompt.trim();
  title = title.replace(/^(qual|quais|como|apresentar|gerar|mostrar|ver|analise|analisar)\s+/i, "");
  title = title.replace(/[?!.]+$/, "");
  if (title.length > 38) {
    title = title.slice(0, 38) + "...";
  }
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// In-memory cache to eliminate repetitive synchronous JSON.parse calls across components
let sessionsMemoryCache: ChatSession[] | null = null;

export function loadAllSessions(): ChatSession[] {
  if (sessionsMemoryCache !== null) {
    return sessionsMemoryCache;
  }
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) {
      sessionsMemoryCache = [];
      return [];
    }
    const parsed = JSON.parse(raw);
    sessionsMemoryCache = Array.isArray(parsed) ? parsed : [];
    return sessionsMemoryCache;
  } catch {
    sessionsMemoryCache = [];
    return [];
  }
}

export function saveAllSessions(sessions: ChatSession[]): void {
  // Enforce max session count to keep storage lean and prevent LocalStorage quota overflow
  const pruned = sessions.slice(0, MAX_SESSIONS);
  sessionsMemoryCache = pruned;

  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(pruned));
  } catch (err: any) {
    // If quota exceeded, prune older half of sessions and retry gracefully
    if (err?.name === "QuotaExceededError" || String(err).includes("quota")) {
      try {
        const reduced = pruned.slice(0, Math.floor(MAX_SESSIONS / 2)).map(s => ({
          ...s,
          messages: s.messages ? s.messages.slice(0, 20) : []
        }));
        sessionsMemoryCache = reduced;
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(reduced));
      } catch {
        // Fallback: retain in memory
      }
    }
  }
}

export function getActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function setActiveSessionId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
}

export function createNewSession(initialTitle = "Nova Conversa"): ChatSession {
  const now = Date.now();
  const newSession: ChatSession = {
    id: `session-${now}`,
    title: initialTitle,
    createdAt: `${getFormattedDate()} às ${getFormattedTime()}`,
    updatedAt: `${getFormattedTime()}`,
    timestamp: now,
    messages: []
  };

  const sessions = loadAllSessions();
  const updated = [newSession, ...sessions];
  saveAllSessions(updated);
  setActiveSessionId(newSession.id);

  return newSession;
}

export function persistSessionMessages(sessionId: string, messages: ChatMessage[], firstPrompt?: string): ChatSession[] {
  const sessions = loadAllSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  const now = Date.now();

  // Prune messages per session to prevent extreme JSON bloat
  const boundedMessages = messages.length > MAX_MESSAGES_PER_SESSION 
    ? messages.slice(0, MAX_MESSAGES_PER_SESSION)
    : messages;

  if (sessionIndex >= 0) {
    const session = { ...sessions[sessionIndex] };
    session.messages = boundedMessages;
    session.updatedAt = getFormattedTime();
    session.timestamp = now;

    if ((session.title === "Nova Conversa" || !session.title) && firstPrompt) {
      session.title = cleanTitle(firstPrompt);
    }

    const updated = [...sessions];
    updated[sessionIndex] = session;
    saveAllSessions(updated);
    return updated;
  } else {
    const newSession: ChatSession = {
      id: sessionId,
      title: firstPrompt ? cleanTitle(firstPrompt) : "Conversa Consultiva",
      createdAt: `${getFormattedDate()} às ${getFormattedTime()}`,
      updatedAt: getFormattedTime(),
      timestamp: now,
      messages: boundedMessages
    };
    const updated = [newSession, ...sessions];
    saveAllSessions(updated);
    setActiveSessionId(sessionId);
    return updated;
  }
}

export function deleteChatSession(sessionId: string): ChatSession[] {
  const sessions = loadAllSessions().filter(s => s.id !== sessionId);
  saveAllSessions(sessions);
  return sessions;
}

export function clearAllSessions(): ChatSession[] {
  sessionsMemoryCache = [];
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSIONS_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
  return [];
}
