export interface TaskExecutionLog {
  id: string;
  timestamp: string;
  status: "success" | "error";
  summary: string;
  error?: string;
  durationMs?: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  prompt: string;
  intervalMinutes: number;
  active: boolean;
  createdAt: string;
  lastRun?: string;
  nextRun?: string;
  lastStatus?: "idle" | "running" | "success" | "error";
  lastResult?: string;
  lastError?: string;
  executionCount: number;
  logs: TaskExecutionLog[];
}

export interface TaskAlert {
  id: string;
  taskId: string;
  taskName: string;
  status: "success" | "error";
  summary: string;
  result?: string;
  error?: string;
  timestamp: string;
  durationMs?: number;
}
