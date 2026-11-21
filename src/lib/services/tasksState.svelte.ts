import { queryGemini } from "./geminiService";
import type { TaskExecutionLog, ScheduledTask, TaskAlert } from "$lib/types";
export type { TaskExecutionLog, ScheduledTask, TaskAlert };

const STORAGE_KEY = "staggi_scheduled_tasks_v1";

const DEFAULT_TASKS: ScheduledTask[] = [];

const LEGACY_TASK_IDS = [
  "task-consenso-bloomberg",
  "task-auditoria-fundamentalista",
  "task-radar-fatos-relevantes",
  "task-monitor-proventos",
  "task-cross-asset-radar"
];

class TasksStore {
  tasks = $state<ScheduledTask[]>([]);
  isInitialized = $state(false);
  activeAlert = $state<TaskAlert | null>(null);
  viewingTaskResult = $state<ScheduledTask | null>(null);
  runningTaskId = $state<string | null>(null);
  private schedulerInterval: any = null;

  constructor() {
    this.reloadFromStorage();
    if (typeof window !== "undefined") {
      this.startScheduler();
    }
  }

  get activeCount(): number {
    return this.tasks.filter(t => t.active).length;
  }

  get totalCount(): number {
    return this.tasks.length;
  }

  get isRunningAny(): boolean {
    return this.tasks.some(t => t.lastStatus === "running") || this.runningTaskId !== null;
  }

  get activeTasks(): ScheduledTask[] {
    return this.tasks.filter(t => t.active);
  }

  reloadFromStorage() {
    if (typeof window === "undefined") {
      this.tasks = DEFAULT_TASKS;
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(t => !LEGACY_TASK_IDS.includes(t.id));
          if (cleaned.length !== parsed.length) {
            this.tasks = cleaned;
            this.saveToStorage();
          } else {
            this.tasks = parsed;
          }
          this.isInitialized = true;
          return;
        }
      }
    } catch {
    }

    this.tasks = DEFAULT_TASKS;
    this.saveToStorage();
    this.isInitialized = true;
  }

  private saveToStorage() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
    } catch {
    }
  }

  addTask(task: Omit<ScheduledTask, "id" | "createdAt" | "executionCount" | "logs">) {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newTask: ScheduledTask = {
      ...task,
      id,
      createdAt: new Date().toISOString(),
      executionCount: 0,
      logs: [],
      nextRun: new Date(Date.now() + task.intervalMinutes * 60 * 1000).toISOString()
    };
    this.tasks = [newTask, ...this.tasks];
    this.saveToStorage();
    return newTask;
  }

  updateTask(id: string, updates: Partial<ScheduledTask>) {
    this.tasks = this.tasks.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        if (updates.intervalMinutes && updates.intervalMinutes !== t.intervalMinutes) {
          const baseTime = t.lastRun ? new Date(t.lastRun).getTime() : Date.now();
          updated.nextRun = new Date(baseTime + updates.intervalMinutes * 60 * 1000).toISOString();
        }
        return updated;
      }
      return t;
    });
    this.saveToStorage();
  }

  toggleTask(id: string) {
    this.tasks = this.tasks.map(t => {
      if (t.id === id) {
        const nextActive = !t.active;
        return {
          ...t,
          active: nextActive,
          nextRun: nextActive ? new Date(Date.now() + t.intervalMinutes * 60 * 1000).toISOString() : undefined
        };
      }
      return t;
    });
    this.saveToStorage();
  }

  deleteTask(id: string) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    if (this.viewingTaskResult?.id === id) {
      this.viewingTaskResult = null;
    }
    if (this.activeAlert?.taskId === id) {
      this.activeAlert = null;
    }
    this.saveToStorage();
  }

  clearLogs(id: string) {
    this.tasks = this.tasks.map(t => {
      if (t.id === id) {
        return { ...t, logs: [] };
      }
      return t;
    });
    this.saveToStorage();
  }

  dismissAlert() {
    this.activeAlert = null;
  }

  openTaskResult(taskOrId: ScheduledTask | string) {
    const found = typeof taskOrId === "string" ? this.tasks.find(t => t.id === taskOrId) : taskOrId;
    if (found) {
      this.viewingTaskResult = found;
    }
  }

  closeTaskResult() {
    this.viewingTaskResult = null;
  }

  async runTaskNow(id: string): Promise<boolean> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return false;
    if (task.lastStatus === "running") return false;

    this.runningTaskId = id;
    this.tasks = this.tasks.map(t => t.id === id ? { ...t, lastStatus: "running", lastError: undefined } : t);
    this.saveToStorage();

    const startTime = Date.now();

    try {
      const result = await queryGemini(task.prompt);
      const durationMs = Date.now() - startTime;
      const nowIso = new Date().toISOString();
      const nextRunIso = new Date(Date.now() + task.intervalMinutes * 60 * 1000).toISOString();

      if (result.success) {
        const newLog: TaskExecutionLog = {
          id: String(Date.now()),
          timestamp: nowIso,
          status: "success",
          summary: result.text.slice(0, 250) + (result.text.length > 250 ? "..." : ""),
          durationMs
        };

        let updatedTask: ScheduledTask | undefined;

        this.tasks = this.tasks.map(t => {
          if (t.id === id) {
            updatedTask = {
              ...t,
              lastRun: nowIso,
              nextRun: nextRunIso,
              lastStatus: "success",
              lastResult: result.text,
              lastError: undefined,
              executionCount: (t.executionCount || 0) + 1,
              logs: [newLog, ...(t.logs || []).slice(0, 29)]
            };
            return updatedTask;
          }
          return t;
        });
        this.runningTaskId = null;
        this.saveToStorage();

        const summarySnippet = result.text.replace(/\s+/g, " ").trim().slice(0, 160) + (result.text.length > 160 ? "..." : "");
        this.activeAlert = {
          id: `alert-${Date.now()}`,
          taskId: task.id,
          taskName: task.name,
          status: "success",
          summary: summarySnippet,
          result: result.text,
          timestamp: nowIso,
          durationMs
        };

        if (this.viewingTaskResult?.id === id && updatedTask) {
          this.viewingTaskResult = updatedTask;
        }

        if (typeof window !== "undefined" && "Notification" in window) {
          try {
            if (Notification.permission === "granted") {
              new Notification(`Staggi: Tarefa Executada`, {
                body: `${task.name} concluída com sucesso. Clique para ver o resultado.`,
              });
            } else if (Notification.permission === "default") {
              Notification.requestPermission().catch(() => {});
            }
          } catch {
          }
        }

        return true;
      } else {
        const errorMsg = result.error || result.text || "Falha na execução da tarefa";
        const newLog: TaskExecutionLog = {
          id: String(Date.now()),
          timestamp: nowIso,
          status: "error",
          summary: "Falha na execução pelo Gemini",
          error: errorMsg,
          durationMs
        };

        this.tasks = this.tasks.map(t => {
          if (t.id === id) {
            return {
              ...t,
              lastRun: nowIso,
              lastStatus: "error",
              lastError: errorMsg,
              logs: [newLog, ...(t.logs || []).slice(0, 29)]
            };
          }
          return t;
        });
        this.runningTaskId = null;
        this.saveToStorage();

        this.activeAlert = {
          id: `alert-${Date.now()}`,
          taskId: task.id,
          taskName: task.name,
          status: "error",
          summary: "Erro ao executar tarefa agendada.",
          error: errorMsg,
          timestamp: nowIso,
          durationMs
        };

        return false;
      }
    } catch (err: any) {
      const errorMsg = String(err?.message || err || "Erro desconhecido na tarefa");
      const durationMs = Date.now() - startTime;
      const nowIso = new Date().toISOString();

      const newLog: TaskExecutionLog = {
        id: String(Date.now()),
        timestamp: nowIso,
        status: "error",
        summary: "Erro fatal ao invocar o Gemini",
        error: errorMsg,
        durationMs
      };

      this.tasks = this.tasks.map(t => {
        if (t.id === id) {
          return {
            ...t,
            lastRun: nowIso,
            lastStatus: "error",
            lastError: errorMsg,
            logs: [newLog, ...(t.logs || []).slice(0, 29)]
          };
        }
        return t;
      });
      this.runningTaskId = null;
      this.saveToStorage();

      this.activeAlert = {
        id: `alert-${Date.now()}`,
        taskId: task.id,
        taskName: task.name,
        status: "error",
        summary: "Erro fatal ao invocar IA na tarefa.",
        error: errorMsg,
        timestamp: nowIso,
        durationMs
      };

      return false;
    }
  }

  startScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    this.schedulerInterval = setInterval(() => {
      this.checkAndRunPendingTasks();
    }, 30000);
  }

  private async checkAndRunPendingTasks() {
    const now = Date.now();

    for (const task of this.tasks) {
      if (!task.active || task.lastStatus === "running") continue;

      let shouldRun = false;

      if (!task.lastRun) {
        const createdTime = new Date(task.createdAt).getTime();
        if (now - createdTime >= 60000) {
          shouldRun = true;
        }
      } else {
        const lastRunTime = new Date(task.lastRun).getTime();
        const intervalMs = task.intervalMinutes * 60 * 1000;
        if (now - lastRunTime >= intervalMs) {
          shouldRun = true;
        }
      }

      if (shouldRun) {
        this.runTaskNow(task.id);
      }
    }
  }
}

export const tasksStore = new TasksStore();
