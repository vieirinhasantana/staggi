import type { ChatMessage, ChatSession } from "$lib/types";

const SESSIONS_STORAGE_KEY = "staggi_chat_sessions_v1";
const ACTIVE_SESSION_KEY = "staggi_active_session_id_v1";

function getFormattedTime(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function cleanTitle(prompt: string): string {
  let title = prompt.trim();
  // Remove pontos de interrogação ou introduções longas
  title = title.replace(/^(qual|quais|como|apresentar|gerar|mostrar|ver)\s+/i, "");
  title = title.replace(/[?!.]+$/, "");
  if (title.length > 38) {
    title = title.slice(0, 38) + "...";
  }
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function loadAllSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveAllSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore storage quota
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

  if (sessionIndex >= 0) {
    const session = sessions[sessionIndex];
    session.messages = messages;
    session.updatedAt = getFormattedTime();
    session.timestamp = now;

    // Se o título ainda for "Nova Conversa" e tivermos o prompt, atualiza
    if ((session.title === "Nova Conversa" || !session.title) && firstPrompt) {
      session.title = cleanTitle(firstPrompt);
    }

    sessions[sessionIndex] = session;
    saveAllSessions(sessions);
    return sessions;
  } else {
    // Cria sessão se não existia
    const newSession: ChatSession = {
      id: sessionId,
      title: firstPrompt ? cleanTitle(firstPrompt) : "Conversa Consultiva",
      createdAt: `${getFormattedDate()} às ${getFormattedTime()}`,
      updatedAt: getFormattedTime(),
      timestamp: now,
      messages
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
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSIONS_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
  return [];
}
