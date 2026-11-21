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
    currentSession?.title || "Conversa Ativa"
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
    let initialStatus = "Pensando...";
    const slashMatch = trimmed.match(/^\/([a-zA-Z0-9_-]+)/);
    if (slashMatch) {
      initialStatus = `Pensando... [/${slashMatch[1]}]`;
    }

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

    if (geminiResult.success && fullText.length > 0) {
      const tokens = fullText.match(/\S+|\s+/g) || [fullText];
      let accumulated = "";

      messages = messages.map(m => m.id === pendingBotId ? {
        ...m,
        isLoading: false,
        isStreaming: true,
        text: ""
      } : m);

      const chunkSize = 3;
      for (let i = 0; i < tokens.length; i += chunkSize) {
        accumulated += tokens.slice(i, i + chunkSize).join("");
        messages = messages.map(m => m.id === pendingBotId ? {
          ...m,
          text: accumulated
        } : m);
        scrollToTop();
        await new Promise(r => setTimeout(r, 16));
      }
    }

    const finalBotMessage: ChatMessage = {
      id: pendingBotId,
      sender: "staggi",
      text: fullText,
      time: new Date().toLocaleTimeString().slice(0, 5),
      type: "text",
      isLoading: false,
      isStreaming: false
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
      text: `[Resultado da Execução: ${task.name}]`,
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
      <div class="w-full flex-1 flex flex-col mt-3.5 rounded-[24px] border border-white/[0.12] ring-1 ring-white/[0.05] bg-[#1a1926]/95 backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35),0_16px_40px_-6px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden transition-all animate-fade-in relative z-10">
      <div class="w-full flex items-center justify-between px-4 py-2.5 bg-[#141320]/75 border-b border-white/[0.06] text-[11px] font-mono shrink-0">
        <button
          type="button"
          onclick={() => showHistoryDrawer = !showHistoryDrawer}
          title="Abrir painel completo de histórico de conversas (busca e agrupamento temporal)"
          class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-200 transition-colors cursor-pointer"
        >
          <History class="w-3.5 h-3.5 text-sky-400" />
          <span class="font-medium max-w-[260px] truncate">{currentSessionTitle}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">
            {sessions.length}
          </span>
          <ChevronDown class="w-3 h-3 text-zinc-400 transition-transform {showHistoryDrawer ? 'rotate-180' : ''}" />
        </button>

        <button
          type="button"
          onclick={handleNewChat}
          title="Iniciar nova conversa mantendo o histórico salvo"
          class="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold transition-all cursor-pointer shadow-sm text-[11px]"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Novo Chat</span>
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

  {#if tasksStore.activeAlert}
    <div
      class="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[620px] rounded-2xl border p-3 shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-3 animate-fade-in font-sans {tasksStore.activeAlert.status === 'success' ? 'bg-[#182124]/95 border-emerald-500/40 text-emerald-200 shadow-[0_8px_30px_rgba(16,185,129,0.2)]' : 'bg-[#25171e]/95 border-rose-500/40 text-rose-200 shadow-[0_8px_30px_rgba(244,63,94,0.2)]'}"
    >
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <div class="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 {tasksStore.activeAlert.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
          {#if tasksStore.activeAlert.status === 'success'}
            <CheckCircle2 class="w-4 h-4" />
          {:else}
            <AlertTriangle class="w-4 h-4" />
          {/if}
        </div>
        <div class="truncate text-left min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-xs text-zinc-100 truncate">{tasksStore.activeAlert.taskName}</span>
            <span class="text-[10px] font-mono opacity-75">{tasksStore.activeAlert.status === 'success' ? 'Finalizada com sucesso' : 'Falha na execução'}</span>
          </div>
          <p class="text-[11px] text-zinc-300 font-normal truncate opacity-90">{tasksStore.activeAlert.summary}</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        {#if tasksStore.activeAlert.result}
          <button
            type="button"
            onclick={() => {
              const taskId = tasksStore.activeAlert!.taskId;
              tasksStore.dismissAlert();
              tasksStore.openTaskResult(taskId);
            }}
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium cursor-pointer transition-colors"
          >
            <Eye class="w-3.5 h-3.5" />
            <span>Ver Resultado</span>
          </button>
        {/if}
        <button
          type="button"
          onclick={() => tasksStore.dismissAlert()}
          class="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-zinc-100 cursor-pointer"
          title="Fechar alerta"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>
  {/if}

  {#if tasksStore.viewingTaskResult}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        class="w-full max-w-[660px] rounded-2xl border border-sky-500/30 bg-[#1e1c2e] shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-5 space-y-4 max-h-[84vh] flex flex-col"
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
              <span class="text-[11px] text-zinc-400 font-mono">
                Executado em {tasksStore.viewingTaskResult.lastRun ? new Date(tasksStore.viewingTaskResult.lastRun).toLocaleString('pt-BR') : 'Nunca'} • Intervalo: {tasksStore.viewingTaskResult.intervalMinutes} min
              </span>
            </div>
          </div>
          <button
            type="button"
            onclick={() => tasksStore.closeTaskResult()}
            class="h-8 w-8 rounded-xl hover:bg-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-zinc-100 cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div
          class="flex-1 overflow-y-auto pr-1 text-sm text-zinc-200 leading-relaxed select-text space-y-2.5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:my-1 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-bold [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-[#141320] [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto"
        >
          {@html renderMarkdown(tasksStore.viewingTaskResult.lastResult || "Nenhum resultado registrado.")}
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-white/[0.08] font-mono text-xs">
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => handleInjectTaskResultIntoChat(tasksStore.viewingTaskResult!)}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 cursor-pointer transition-colors"
              title="Inserir esta análise no chat atual para continuar a conversa"
            >
              <Send class="w-3.5 h-3.5" />
              <span>Inserir na Conversa</span>
            </button>

            <button
              type="button"
              onclick={() => handleCopyResult(tasksStore.viewingTaskResult?.lastResult || "")}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 border border-white/[0.06] cursor-pointer transition-colors"
            >
              {#if copySuccess}
                <Check class="w-3.5 h-3.5 text-emerald-400" />
                <span class="text-emerald-400">Copiado!</span>
              {:else}
                <Copy class="w-3.5 h-3.5" />
                <span>Copiar</span>
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
              <span>{tasksStore.viewingTaskResult.lastStatus === 'running' ? 'Rodando...' : 'Re-executar'}</span>
            </button>

            <button
              type="button"
              onclick={() => tasksStore.closeTaskResult()}
              class="px-3.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 cursor-pointer transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>
