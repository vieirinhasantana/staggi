<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    X,
    Bot,
    Server,
    Zap,
    Clock,
    Brain,
    ArrowDownCircle,
    RefreshCw,
    CheckCircle2,
  } from "@lucide/svelte";
  import { aiStore } from "$lib/services/aiProviderState.svelte";
  import { pluginsStore } from "$lib/services/pluginsState.svelte";
  import { tasksStore } from "$lib/services/tasksState.svelte";
  import { memoryStore } from "$lib/services/memoryState.svelte";
  import { updaterStore } from "$lib/services/updaterService.svelte";
  import { t } from "$lib/i18n";
  import type { ScheduledTask } from "$lib/types";

  import SettingsAiTab from "./settings/SettingsAiTab.svelte";
  import SettingsMcpsTab from "./settings/SettingsMcpsTab.svelte";
  import SettingsSkillsTab from "./settings/SettingsSkillsTab.svelte";
  import SettingsTasksTab from "./settings/SettingsTasksTab.svelte";
  import SettingsMemoryTab from "./settings/SettingsMemoryTab.svelte";
  import TaskResultModal from "./settings/TaskResultModal.svelte";

  interface Props {
    open: boolean;
    initialTab?: "ai" | "gemini" | "mcps" | "skills" | "tasks" | "memory";
    onClose: () => void;
  }

  let {
    open = false,
    initialTab = "ai",
    onClose = () => {},
  }: Props = $props();

  let activeTab = $state<"ai" | "gemini" | "mcps" | "skills" | "tasks" | "memory">("ai");
  let viewingResultTask = $state<ScheduledTask | null>(null);

  $effect(() => {
    const tab = initialTab === "gemini" ? "ai" : initialTab;
    if (tab) {
      untrack(() => {
        if (activeTab !== tab) {
          activeTab = tab;
        }
      });
    }
  });

  onMount(() => {
    aiStore.reloadFromStorage();
    pluginsStore.reloadFromStorage();
    tasksStore.reloadFromStorage();
    memoryStore.reloadFromStorage();
  });
</script>

{#if open}
  <div
    class="w-full h-full rounded-[24px] border border-white/[0.14] ring-1 ring-white/[0.05] bg-[#1c1c1c]/98 backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35),0_16px_40px_-6px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden flex flex-col animate-fade-in relative z-30 select-none"
  >
    <div
      data-tauri-drag-region
      class="flex items-center justify-between px-6 py-3.5 border-b border-white/[0.08] bg-[#141414]/85 shrink-0 cursor-move"
    >
      <div data-tauri-drag-region class="flex items-center gap-2.5 pointer-events-none">
        <img
          src="/favicon.png"
          alt="Staggi"
          class="h-8 w-8 rounded-xl border border-white/[0.1] object-cover shadow-sm shrink-0"
        />
        <div data-tauri-drag-region>
          <h3 class="text-sm font-semibold text-zinc-100">
            {t("settings.title")}
          </h3>
          <p class="text-[11px] text-zinc-400">
            AI Engine, Model Context Protocol (MCP) & Analytical Skills
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        {#if updaterStore.status === "available"}
          <button
            type="button"
            onclick={() => updaterStore.startDownloadAndInstall()}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium transition-all cursor-pointer shadow-sm animate-pulse"
            title="Nova versão encontrada! Clique para baixar agora"
          >
            <ArrowDownCircle class="w-3.5 h-3.5 text-emerald-400" />
            <span>Baixar v{updaterStore.availableVersion}</span>
          </button>
        {:else if updaterStore.status === "downloading"}
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs">
            <RefreshCw class="w-3.5 h-3.5 animate-spin text-sky-400" />
            <span>Baixando {updaterStore.downloadProgress}%</span>
          </div>
        {:else if updaterStore.status === "downloaded"}
          <button
            type="button"
            onclick={() => updaterStore.relaunch()}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-all cursor-pointer shadow-sm"
            title="Atualização instalada. Clique para reiniciar o Staggi"
          >
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>Reiniciar Staggi</span>
          </button>
        {:else if updaterStore.status === "checking"}
          <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-zinc-400">
            <RefreshCw class="w-3 h-3 animate-spin text-amber-400" />
            <span>Verificando...</span>
          </div>
        {:else}
          <button
            type="button"
            onclick={() => updaterStore.checkForUpdates()}
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.16] text-zinc-400 hover:text-zinc-200 text-xs transition-all cursor-pointer group"
            title="Versão instalada: v{updaterStore.currentVersion}. Clique para verificar atualizações no GitHub."
          >
            <RefreshCw class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform group-hover:rotate-45" />
            <span>v{updaterStore.currentVersion}</span>
          </button>
        {/if}

        <button
          type="button"
          onclick={onClose}
          aria-label="Close settings panel"
          class="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div
      data-tauri-drag-region
      class="flex items-center gap-1.5 px-5 py-2 border-b border-white/[0.06] bg-[#141414]/75 text-[12px] shrink-0 overflow-x-auto scrollbar-none cursor-move"
    >
      <button
        type="button"
        onclick={() => (activeTab = "ai")}
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 {activeTab ===
        'ai' || activeTab === 'gemini'
          ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30 shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <Bot class="w-3.5 h-3.5 text-amber-400" />
        <span>{t("settings.tabs.ai")} {aiStore.isConfigured ? "✓" : ""}</span>
      </button>

      <button
        type="button"
        onclick={() => (activeTab = "mcps")}
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 {activeTab ===
        'mcps'
          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <Server class="w-3.5 h-3.5 text-emerald-400" />
        <span>{t("settings.tabs.mcps")} ({pluginsStore.activeMcpsCount})</span>
      </button>

      <button
        type="button"
        onclick={() => (activeTab = "skills")}
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 {activeTab ===
        'skills'
          ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30 shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <Zap class="w-3.5 h-3.5 text-violet-400" />
        <span>{t("settings.tabs.skills")} ({pluginsStore.activeSkillsCount})</span>
      </button>

      <button
        type="button"
        onclick={() => (activeTab = "tasks")}
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 {activeTab ===
        'tasks'
          ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30 shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <Clock class="w-3.5 h-3.5 text-sky-400" />
        <span>{t("settings.tabs.tasks")} ({tasksStore.activeCount})</span>
        {#if tasksStore.isRunningAny}
          <span class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></span>
        {/if}
      </button>

      <button
        type="button"
        onclick={() => (activeTab = "memory")}
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 {activeTab ===
        'memory'
          ? 'bg-pink-500/20 text-pink-200 border border-pink-500/30 shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <Brain class="w-3.5 h-3.5 text-pink-400" />
        <span>{t("settings.tabs.memory")} ({memoryStore.activeCount})</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-6 space-y-4">
      {#if activeTab === "ai" || activeTab === "gemini"}
        <SettingsAiTab />
      {:else if activeTab === "mcps"}
        <SettingsMcpsTab />
      {:else if activeTab === "skills"}
        <SettingsSkillsTab />
      {:else if activeTab === "tasks"}
        <SettingsTasksTab onViewResult={(task: ScheduledTask) => (viewingResultTask = task)} />
      {:else if activeTab === "memory"}
        <SettingsMemoryTab />
      {/if}
    </div>
  </div>

  <TaskResultModal
    task={viewingResultTask}
    onClose={() => (viewingResultTask = null)}
  />
{/if}
