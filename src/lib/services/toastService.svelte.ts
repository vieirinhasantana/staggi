export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  durationMs: number;
}

export class ToastStore {
  toasts = $state<ToastItem[]>([]);

  show(type: ToastType, title: string, message: string = "", durationMs: number = 4000) {
    const id = Math.random().toString(36).substring(2, 9);
    const item: ToastItem = { id, type, title, message, durationMs };
    this.toasts = [item, ...this.toasts];

    if (durationMs > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, durationMs);
    }
  }

  success(title: string, message: string = "", durationMs: number = 3500) {
    this.show("success", title, message, durationMs);
  }

  error(title: string, message: string = "", durationMs: number = 5000) {
    this.show("error", title, message, durationMs);
  }

  warning(title: string, message: string = "", durationMs: number = 4000) {
    this.show("warning", title, message, durationMs);
  }

  info(title: string, message: string = "", durationMs: number = 3500) {
    this.show("info", title, message, durationMs);
  }

  showToast(title: string, type: ToastType = "info", message: string = "", durationMs: number = 3500) {
    this.show(type, title, message, durationMs);
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}

export const toastStore = new ToastStore();
