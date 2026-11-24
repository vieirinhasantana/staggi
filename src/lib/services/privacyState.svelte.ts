import { invoke } from "@tauri-apps/api/core";
import { toastStore } from "./toastService.svelte";

const STORAGE_KEY = "staggi_screen_protection_enabled";

export class PrivacyStore {
  isProtected = $state<boolean>(false);
  isLoading = $state<boolean>(false);

  async init() {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const shouldProtect = saved === "true";
      if (shouldProtect) {
        await this.setProtection(true, false);
      }
    } catch (err) {
      console.error("Failed to initialize screen protection state:", err);
    }
  }

  async setProtection(enabled: boolean, notify: boolean = true) {
    this.isLoading = true;
    try {
      await invoke("set_content_protected", { protected: enabled });
      this.isProtected = enabled;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
      }
      if (notify) {
        if (enabled) {
          toastStore.success(
            "Anti-Captura Ativado",
            "A janela do Staggi está protegida contra prints e compartilhamento de tela."
          );
        } else {
          toastStore.info(
            "Anti-Captura Desativado",
            "A janela do Staggi voltou a ser visível em capturas e compartilhamentos."
          );
        }
      }
    } catch (err) {
      console.error("Error setting window content protection:", err);
      if (notify) {
        toastStore.error(
          "Erro ao alterar proteção de tela",
          err instanceof Error ? err.message : String(err)
        );
      }
    } finally {
      this.isLoading = false;
    }
  }

  async toggle() {
    await this.setProtection(!this.isProtected, true);
  }
}

export const privacyStore = new PrivacyStore();
