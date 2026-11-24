<script lang="ts">
  import SpotlightBar from "$lib/components/SpotlightBar.svelte";
  import ChatMessageItem from "$lib/components/ChatMessageItem.svelte";
  import SettingsModal from "$lib/components/SettingsModal.svelte";
  import ChatHistoryDrawer from "$lib/components/ChatHistoryDrawer.svelte";
  import { queryGemini, type ChatHistoryTurn } from "$lib/services/geminiService";
  import { 
    loadAllSessions, 
    saveAllSessions, 
    getActiveSessionId, 
    setActiveSessionId, 
    createNewSession, 
    persistSessionMessages, 
    deleteChatSession,
    clearAllSessions
  } from "$lib/services/chatSessionService";
  import type { ChatMessage, ChatSession } from "$lib/types";
  import { tasksStore, type ScheduledTask } from "$lib/services/tasksState.svelte";
  import { updaterStore } from "$lib/services/updaterService.svelte";
  import { renderMarkdown } from "$lib/services/formatMessage";
  import { t } from "$lib/i18n";
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { 
    Plus, 
    History, 
    ChevronDown, 
    MessageSquare, 
    Trash2, 
    Check, 
    X,
    Calendar,
    CheckCircle2,
    AlertTriangle,
    Eye,
    Clock,
    Copy,
    Send,
    Play,
    RefreshCw
  } from "@lucide/svelte";

  let sessions = $state<ChatSession[]>([]);
  let currentSessionId = $state<string>("");
  let messages = $state<ChatMessage[]>([]);
  let showHistoryDrawer = $state(false);

  let chatScrollArea = $state<HTMLDivElement | null>(null);
  let isSettingsOpen = $state(false);
  let settingsInitialTab = $state<"ai" | "gemini" | "mcps" | "skills" | "tasks">("ai");

  let currentSession = $derived(
    sessions.find(s => s.id === currentSessionId) || null
  );

  let currentSessionTitle = $derived(
    currentSession?.title || t("chat.activeSession")
  );

  function scrollToTop() {
    setTimeout(() => {
      if (chatScrollArea) {
        chatScrollArea.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }, 60);
  }

  async function handleSend(userPrompt: string) {
    const trimmed = userPrompt.trim();
    if (!trimmed) return;

    if (!currentSessionId) {
      const newSession = createNewSession();
      currentSessionId = newSession.id;
    }

    const historyTurns: ChatHistoryTurn[] = messages
      .filter(m => !m.isLoading && m.text.trim().length > 0)
      .slice(0, 10)
      .reverse()
      .map(m => ({
        role: m.sender === "user" ? ("user" as const) : ("model" as const),
        text: m.text
      }));

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text: trimmed,
      time: new Date().toLocaleTimeString().slice(0, 5),
    };

    const pendingBotId = String(Date.now() + 1);
    const slashMatch = trimmed.match(/^\/([a-zA-Z0-9_-]+)/);
    const initialStatus = slashMatch ? `Thinking... [/${slashMatch[1]}]` : "Thinking...";

    const pendingBotMessage: ChatMessage = {
      id: pendingBotId,
      sender: "staggi",
      text: initialStatus,
      time: new Date().toLocaleTimeString().slice(0, 5),
      isLoading: true
    };

    messages = [pendingBotMessage, userMessage, ...messages];
    sessions = persistSessionMessages(currentSessionId, messages, trimmed);
    scrollToTop();

    const onProgress = (statusText: string) => {
      messages = messages.map(m => m.id === pendingBotId ? { ...m, text: statusText } : m);
    };

    const geminiResult = await queryGemini(trimmed, historyTurns, onProgress);
    const fullText = geminiResult.text || "";

    const finalBotMessage: ChatMessage = {
      id: pendingBotId,
      sender: "staggi",
      text: fullText,
      time: new Date().toLocaleTimeString().slice(0, 5),
      type: "text",
      isLoading: false,
      isStreaming: false,
      metadata: geminiResult.source ? { source: geminiResult.source } : undefined
    };

    messages = messages.map(m => m.id === pendingBotId ? finalBotMessage : m);
    sessions = persistSessionMessages(currentSessionId, messages);
    scrollToTop();
  }

  function handleNewChat() {
    const newSession = createNewSession("Nova Conversa");
    currentSessionId = newSession.id;
    messages = [];
    sessions = loadAllSessions();
    showHistoryDrawer = false;
  }

  function handleSelectSession(session: ChatSession) {
    currentSessionId = session.id;
    setActiveSessionId(session.id);
    messages = session.messages || [];
    showHistoryDrawer = false;
    scrollToTop();
  }

  function handleDeleteSession(e: MouseEvent, sessionId: string) {
    e.stopPropagation();
    sessions = deleteChatSession(sessionId);
    if (currentSessionId === sessionId) {
      if (sessions.length > 0) {
        handleSelectSession(sessions[0]);
      } else {
        handleNewChat();
      }
    }
  }

  function handleOpenSettings(tab?: "ai" | "gemini" | "mcps" | "skills" | "tasks") {
    if (tab) {
      settingsInitialTab = tab;
    }
    isSettingsOpen = true;
  }

  let copySuccess = $state(false);

  function handleCopyResult(text: string) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      copySuccess = true;
      setTimeout(() => (copySuccess = false), 2000);
    });
  }

  function handleInjectTaskResultIntoChat(task: ScheduledTask) {
    if (!task.lastResult) return;
    if (!currentSessionId) {
      const newSession = createNewSession(`Tarefa: ${task.name}`);
      currentSessionId = newSession.id;
    }
    const promptMsg: ChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text: `[Execution Result: ${task.name}]`,
      time: new Date().toLocaleTimeString().slice(0, 5),
    };
    const resultMsg: ChatMessage = {
      id: String(Date.now() + 1),
      sender: "staggi",
      text: task.lastResult,
      time: new Date().toLocaleTimeString().slice(0, 5),
      type: "text",
      isLoading: false,
    };
    messages = [resultMsg, promptMsg, ...messages];
    sessions = persistSessionMessages(currentSessionId, messages);
    scrollToTop();
    tasksStore.closeTaskResult();
    tasksStore.dismissAlert();
  }

  onMount(() => {
    tasksStore.startScheduler();

    if (updaterStore.autoCheckEnabled) {
      updaterStore.checkForUpdates(true);
    }

    let unlistenUpdates: (() => void) | null = null;
    listen("trigger-check-updates", async () => {
      await updaterStore.checkForUpdates(false);
      if (updaterStore.status === "available") {
        await updaterStore.startDownloadAndInstall();
      }
    }).then(unlisten => {
      unlistenUpdates = unlisten;
    }).catch(() => {});

    const savedSessions = loadAllSessions();
    sessions = savedSessions;

    const activeId = getActiveSessionId();
    if (activeId) {
      const found = savedSessions.find(s => s.id === activeId);
      if (found) {
        currentSessionId = found.id;
        messages = found.messages || [];
      } else if (savedSessions.length > 0) {
        currentSessionId = savedSessions[0].id;
        messages = savedSessions[0].messages || [];
      }
    } else if (savedSessions.length > 0) {
      currentSessionId = savedSessions[0].id;
      messages = savedSessions[0].messages || [];
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isSettingsOpen) {
          isSettingsOpen = false;
          return;
        }
        if (showHistoryDrawer) {
          showHistoryDrawer = false;
          return;
        }
        e.preventDefault();
        invoke("hide_window").catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      if (unlistenUpdates) unlistenUpdates();
    };
  });
</script>

<main
  class="relative w-[800px] h-[600px] flex flex-col items-center justify-start bg-transparent p-4 sm:p-5 m-0 overflow-hidden select-none"
>
  {#if isSettingsOpen}
    <SettingsModal open={isSettingsOpen} initialTab={settingsInitialTab} onClose={() => isSettingsOpen = false} />
  {:else}
    <div class="w-full shrink-0 relative z-30">
      <SpotlightBar onSend={handleSend} onOpenSettings={handleOpenSettings} />
    </div>

    {#if messages.length > 0 || showHistoryDrawer}
      <div class="w-full flex-1 flex flex-col mt-3.5 rounded-[24px] border border-white/[0.12] ring-1 ring-white/[0.05] bg-[#1c1c1c]/95 backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35),0_16px_40px_-6px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden transition-all animate-fade-in relative z-10">
      <div class="w-full flex items-center justify-between px-4 py-2.5 bg-[#141414]/75 border-b border-white/[0.06] text-[11px] shrink-0">
        <button
          type="button"
          onclick={() => showHistoryDrawer = !showHistoryDrawer}
          title="Open conversation history panel"
          class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-200 transition-colors cursor-pointer"
        >
          <History class="w-3.5 h-3.5 text-sky-400" />
          <span class="font-medium max-w-[260px] truncate">{currentSessionTitle}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300">
            {sessions.length}
          </span>
          <ChevronDown class="w-3 h-3 text-zinc-400 transition-transform {showHistoryDrawer ? 'rotate-180' : ''}" />
        </button>

        <button
          type="button"
          onclick={handleNewChat}
          title="Start new conversation while keeping history saved"
          class="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold transition-all cursor-pointer shadow-sm text-[11px]"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{t("chat.newChat")}</span>
        </button>
      </div>

      <ChatHistoryDrawer
        open={showHistoryDrawer}
        {sessions}
        {currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={(id) => {
          sessions = deleteChatSession(id);
          if (id === currentSessionId) {
            if (sessions.length > 0) {
              handleSelectSession(sessions[0]);
            } else {
              handleNewChat();
            }
          }
        }}
        onClearAllSessions={() => {
          sessions = clearAllSessions();
          handleNewChat();
        }}
        onClose={() => showHistoryDrawer = false}
      />

      <div
        bind:this={chatScrollArea}
        class="w-full flex-1 overflow-y-auto p-4 space-y-3.5 scroll-smooth"
      >
        {#each messages as msg (msg.id)}
          <ChatMessageItem message={msg} />
        {/each}
      </div>
    </div>
  {/if}
{/if}

  {#if tasksStore.viewingTaskResult}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        class="w-full max-w-[660px] rounded-2xl border border-sky-500/30 bg-[#212121] shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-5 space-y-4 max-h-[84vh] flex flex-col"
      >
        <div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div class="flex items-center gap-2.5">
            <div class="h-9 w-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 border border-sky-500/30">
              <Clock class="w-4 h-4" />
            </div>
            <div>
              <h4 class="font-semibold text-zinc-100 text-sm">
                {tasksStore.viewingTaskResult.name}
              </h4>
              <span class="text-[11px] text-zinc-400">
                Executed at {tasksStore.viewingTaskResult.lastRun ? new Date(tasksStore.viewingTaskResult.lastRun).toLocaleString('en-US') : t("settings.tasks.never")} • Interval: {tasksStore.viewingTaskResult.intervalMinutes} min
              </span>
            </div>
          </div>
          <button
            type="button"
            onclick={() => tasksStore.closeTaskResult()}
            aria-label={t("common.close")}
            class="h-8 w-8 rounded-xl hover:bg-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-zinc-100 cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div
          class="flex-1 overflow-y-auto pr-1 text-sm text-zinc-200 leading-relaxed select-text space-y-2.5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:my-1 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-bold [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-[#141414] [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto"
        >
          {@html renderMarkdown(tasksStore.viewingTaskResult.lastResult || t("settings.tasks.noResultRecorded"))}
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-white/[0.08] text-xs">
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => handleInjectTaskResultIntoChat(tasksStore.viewingTaskResult!)}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 cursor-pointer transition-colors"
              title="Insert this analysis into active chat"
            >
              <Send class="w-3.5 h-3.5" />
              <span>{t("common.insertIntoChat")}</span>
            </button>

            <button
              type="button"
              onclick={() => handleCopyResult(tasksStore.viewingTaskResult?.lastResult || "")}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 border border-white/[0.06] cursor-pointer transition-colors"
            >
              {#if copySuccess}
                <Check class="w-3.5 h-3.5 text-emerald-400" />
                <span class="text-emerald-400">{t("common.copied")}</span>
              {:else}
                <Copy class="w-3.5 h-3.5" />
                <span>{t("common.copy")}</span>
              {/if}
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => tasksStore.runTaskNow(tasksStore.viewingTaskResult!.id)}
              disabled={tasksStore.viewingTaskResult.lastStatus === 'running'}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 cursor-pointer disabled:opacity-40"
            >
              <RefreshCw class="w-3 h-3 {tasksStore.viewingTaskResult.lastStatus === 'running' ? 'animate-spin text-amber-400' : ''}" />
              <span>{tasksStore.viewingTaskResult.lastStatus === 'running' ? t("common.running") : t("common.reRun")}</span>
            </button>

            <button
              type="button"
              onclick={() => tasksStore.closeTaskResult()}
              class="px-3.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 cursor-pointer transition-colors"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>
