export interface TaskExecutionLog {
  id: string;
  timestamp: string;
  status: "success" | "error";
  summary: string;
  error?: string;
  durationMs?: number;
  emailSent?: boolean;
  emailRecipient?: string;
  emailStatus?: "sent" | "simulated" | "failed";
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
  // Email dispatch configuration
  notifyEmail?: boolean;
  emailRecipient?: string;
  emailSubject?: string;
  lastEmailStatus?: "sent" | "simulated" | "failed";
  lastEmailTimestamp?: string;
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
