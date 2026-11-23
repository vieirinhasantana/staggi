import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { toastStore } from "./toastService.svelte";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "downloaded"
  | "error";

const STORAGE_KEY_AUTO_CHECK = "staggi_updater_auto_check";
const STORAGE_KEY_LAST_CHECKED = "staggi_updater_last_checked";

class UpdaterService {
  status = $state<UpdateStatus>("idle");
  currentVersion = $state<string>("0.1.0");
  availableVersion = $state<string>("");
  releaseDate = $state<string>("");
  releaseNotes = $state<string>("");
  downloadProgress = $state<number>(0);
  downloadedBytes = $state<number>(0);
  totalBytes = $state<number>(0);
  errorMessage = $state<string>("");
  lastChecked = $state<string | null>(null);
  autoCheckEnabled = $state<boolean>(true);

  private activeUpdate: Update | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadConfig();
      this.initVersion();
    }
  }

  private loadConfig() {
    try {
      const savedAuto = localStorage.getItem(STORAGE_KEY_AUTO_CHECK);
      if (savedAuto !== null) {
        this.autoCheckEnabled = savedAuto === "true";
      }
      this.lastChecked = localStorage.getItem(STORAGE_KEY_LAST_CHECKED);
    } catch {
    }
  }

  private async initVersion() {
    try {
      const v = await getVersion();
      if (v) this.currentVersion = v;
    } catch {
    }
  }

  toggleAutoCheck(enabled?: boolean) {
    this.autoCheckEnabled = enabled ?? !this.autoCheckEnabled;
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_CHECK, String(this.autoCheckEnabled));
    } catch {
    }
  }

  async checkForUpdates(silent = false) {
    if (this.status === "checking" || this.status === "downloading") return;

    this.status = "checking";
    this.errorMessage = "";
    if (this.activeUpdate) {
      try {
        await this.activeUpdate.close();
      } catch {
      }
      this.activeUpdate = null;
    }

    try {
      const update = await check();
      const nowStr = new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      this.lastChecked = nowStr;
      try {
        localStorage.setItem(STORAGE_KEY_LAST_CHECKED, nowStr);
      } catch {
      }

      if (update) {
        this.activeUpdate = update;
        this.availableVersion = update.version;
        this.currentVersion = update.currentVersion || this.currentVersion;
        this.releaseDate = update.date || "";
        this.releaseNotes = update.body || "";
        this.status = "available";
        toastStore.info(
          "Atualização Disponível",
          `A versão v${update.version} está disponível no GitHub para download.`
        );
      } else {
        this.status = "up-to-date";
        if (!silent) {
          toastStore.success(
            "Staggi Atualizado",
            `Você já está utilizando a versão mais recente (v${this.currentVersion}).`
          );
        }
      }
    } catch (err: any) {
      console.warn("[Updater] Verificação de atualização falhou:", err);
      this.errorMessage =
        err?.message ||
        "Não foi possível verificar atualizações no momento. Verifique a conexão com a internet.";
      this.status = silent ? "idle" : "error";
      if (!silent) {
        toastStore.warning(
          "Verificação de Atualização",
          this.errorMessage
        );
      }
    }
  }

  async startDownloadAndInstall() {
    if (!this.activeUpdate || this.status === "downloading") return;

    this.status = "downloading";
    this.downloadProgress = 0;
    this.downloadedBytes = 0;
    this.totalBytes = 0;
    this.errorMessage = "";

    try {
      let accumulated = 0;
      let total = 0;

      await this.activeUpdate.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          this.totalBytes = total;
        } else if (event.event === "Progress") {
          accumulated += event.data.chunkLength;
          this.downloadedBytes = accumulated;
          if (total > 0) {
            this.downloadProgress = Math.min(100, Math.round((accumulated / total) * 100));
          }
        } else if (event.event === "Finished") {
          this.downloadProgress = 100;
        }
      });

      this.status = "downloaded";
    } catch (err: any) {
      console.error("[Updater] Erro ao baixar ou instalar atualização:", err);
      this.errorMessage =
        err?.message || "Falha ao baixar os arquivos da nova versão.";
      this.status = "error";
    }
  }

  async relaunch() {
    try {
      await invoke("restart_app");
    } catch (err: any) {
      console.error("[Updater] Falha ao reiniciar aplicativo:", err);
      window.location.reload();
    }
  }

  dismiss() {
    this.status = "idle";
    this.errorMessage = "";
    if (this.activeUpdate) {
      this.activeUpdate.close().catch(() => {});
      this.activeUpdate = null;
    }
  }
}

export const updaterStore = new UpdaterService();
