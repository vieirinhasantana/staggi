export type MessageSender = "user" | "staggi";

export type MessageType =
  | "text"
  | "allocation"
  | "liquidity"
  | "maturity"
  | "tax"
  | "dividends"
  | "news"
  | "statement"
  | "report";

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  type: string;
  content: string;
  isBinary?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  time: string;
  type?: MessageType;
  metadata?: Record<string, unknown>;
  attachments?: AttachedFile[];
  isLoading?: boolean;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  timestamp?: number;
  messages: ChatMessage[];
}

export interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  category?: "portfolio" | "market" | "tax" | "dividends";
}
