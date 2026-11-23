export type MemoryCategory = "general" | string;

export interface MemoryItem {
  id: string;
  title: string;
  content: string;
  category?: MemoryCategory;
  tags: string[];
  pinned: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  source: "user" | "ai" | "system";
}

export interface MemoryRetrievalResult {
  memory: MemoryItem;
  score: number;
}
