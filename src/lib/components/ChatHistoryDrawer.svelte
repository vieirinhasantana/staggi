<script lang="ts">
  import type { ChatSession } from "$lib/types";
  import { t } from "$lib/i18n";
  import {
    Search,
    X,
    Plus,
    Trash2,
    MessageSquare,
    Clock,
    Check,
    Calendar,
    ArrowLeft,
    CornerDownLeft,
    AlertTriangle,
  } from "@lucide/svelte";

  interface Props {
    open: boolean;
    sessions: ChatSession[];
    currentSessionId: string;
    onSelectSession: (session: ChatSession) => void;
    onNewChat: () => void;
    onDeleteSession: (sessionId: string) => void;
    onClearAllSessions: () => void;
    onClose: () => void;
  }

  let {
    open = false,
    sessions = [],
    currentSessionId = "",
    onSelectSession = () => {},
    onNewChat = () => {},
    onDeleteSession = () => {},
    onClearAllSessions = () => {},
    onClose = () => {},
  }: Props = $props();

  let searchQuery = $state("");
  let selectedIndex = $state(0);
  let searchInputEl = $state<HTMLInputElement | null>(null);
  let confirmClearAll = $state(false);

  // Auto-focus search input when opening history
  $effect(() => {
    if (open) {
      selectedIndex = 0;
      setTimeout(() => {
        searchInputEl?.focus();
        searchInputEl?.select();
      }, 50);
    } else {
      searchQuery = "";
      confirmClearAll = false;
    }
  });

  let filteredSessions = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      if (s.title && s.title.toLowerCase().includes(q)) return true;
      if (s.createdAt && s.createdAt.toLowerCase().includes(q)) return true;
      return s.messages?.some((m) => m.text?.toLowerCase().includes(q));
    });
  });

  // Keep keyboard index inside safe bounds
  $effect(() => {
    if (selectedIndex >= filteredSessions.length) {
      selectedIndex = Math.max(0, filteredSessions.length - 1);
    }
  });

  interface GroupedSessions {
    label: string;
    items: ChatSession[];
  }

  let groupedSessions = $derived.by((): GroupedSessions[] => {
    if (searchQuery.trim()) {
      return [
        {
          label: `Resultados da busca (${filteredSessions.length})`,
          items: filteredSessions,
        },
      ];
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const last7Days = today - 7 * 24 * 60 * 60 * 1000;

    const todayItems: ChatSession[] = [];
    const yesterdayItems: ChatSession[] = [];
    const thisWeekItems: ChatSession[] = [];
    const olderItems: ChatSession[] = [];

    for (const session of filteredSessions) {
      let ts = session.timestamp;
      if (!ts && session.id && session.id.startsWith("session-")) {
        const parsed = parseInt(session.id.replace("session-", ""), 10);
        if (!isNaN(parsed)) ts = parsed;
      }
      if (!ts) {
        todayItems.push(session);
        continue;
      }

      if (ts >= today) {
        todayItems.push(session);
      } else if (ts >= yesterday) {
        yesterdayItems.push(session);
      } else if (ts >= last7Days) {
        thisWeekItems.push(session);
      } else {
        olderItems.push(session);
      }
    }

    const groups: GroupedSessions[] = [];
    if (todayItems.length > 0) groups.push({ label: t("drawer.today"), items: todayItems });
    if (yesterdayItems.length > 0) groups.push({ label: t("drawer.yesterday"), items: yesterdayItems });
    if (thisWeekItems.length > 0) groups.push({ label: t("drawer.previous7Days"), items: thisWeekItems });
    if (olderItems.length > 0) groups.push({ label: t("drawer.older"), items: olderItems });

    if (groups.length === 0 && filteredSessions.length > 0) {
      groups.push({ label: "Todas as conversas", items: filteredSessions });
    }

    return groups;
  });

  function getLastPreview(s: ChatSession): string {
    if (!s.messages || s.messages.length === 0) {
      return "Nova conversa iniciada (sem mensagens ainda)";
    }
    const last = s.messages[s.messages.length - 1];
    let clean = (last.text || "")
      .replace(/^#+\s+/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\n+/g, " ")
      .trim();
    if (clean.length > 95) clean = clean.slice(0, 95) + "...";
    return clean || "Consulta analítica";
  }

  function handleSelect(s: ChatSession) {
    onSelectSession(s);
    onClose();
  }

  function handleStartNew() {
    onNewChat();
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (filteredSessions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % filteredSessions.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredSessions.length) % filteredSessions.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      const targetSession = filteredSessions[selectedIndex];
      if (targetSession) {
        handleSelect(targetSession);
      }
    }
  }
</script>

{#if open}
  <div
    role="presentation"
    onkeydown={handleKeyDown}
    class="absolute inset-0 z-40 bg-[#161616]/98 backdrop-blur-2xl flex flex-col rounded-[24px] overflow-hidden animate-fade-in text-zinc-100 select-none shadow-[0_8px_32px_rgba(0,0,0,0.7)]"
  >
    <!-- Header with Quick Actions -->
    <div
      class="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#121212]/90 shrink-0"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onclick={onClose}
          title="Voltar ao chat (Esc)"
          class="h-8 w-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <div class="flex items-center gap-2">
          <h3 class="font-semibold text-xs text-zinc-100 tracking-wide flex items-center gap-1.5">
            <Clock class="w-3.5 h-3.5 text-sky-400" />
            {t("drawer.historyTitle")}
          </h3>
          <span
            class="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium"
          >
            {sessions.length} {sessions.length === 1 ? "conversa" : "conversas"}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onclick={handleStartNew}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{t("chat.newChat")}</span>
        </button>

        <button
          type="button"
          onclick={onClose}
          class="h-8 w-8 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Live Search Input (Command Palette style) -->
    <div class="px-4 py-2.5 border-b border-white/[0.06] bg-[#1a1a1a]/80 shrink-0">
      <div class="relative flex items-center">
        <Search class="w-4 h-4 text-sky-400 absolute left-3 pointer-events-none" />
        <input
          bind:this={searchInputEl}
          type="text"
          bind:value={searchQuery}
          placeholder="Buscar por ativo, cliente, tese ou palavra-chave (ex: PETR4, Valuation, Alocação)..."
          class="w-full rounded-xl bg-[#242424] border border-white/[0.1] pl-9.5 pr-20 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-sky-400/70 font-sans shadow-inner transition-colors"
        />
        <div class="absolute right-2.5 flex items-center gap-1.5 pointer-events-none">
          {#if searchQuery}
            <button
              type="button"
              onclick={() => { searchQuery = ""; searchInputEl?.focus(); }}
              class="text-zinc-400 hover:text-zinc-200 p-0.5 pointer-events-auto cursor-pointer mr-1"
            >
              <X class="w-3 h-3" />
            </button>
          {/if}
          <span class="text-[10px] text-zinc-500 font-mono bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.08]">
            ↑↓ Enter
          </span>
        </div>
      </div>
    </div>

    <!-- Scrollable Session Results List -->
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-4 font-sans">
      {#if filteredSessions.length === 0}
        <div class="py-12 flex flex-col items-center justify-center text-center space-y-2">
          <MessageSquare class="w-8 h-8 text-zinc-600 mb-1" />
          <p class="text-xs text-zinc-300 font-medium">
            {searchQuery
              ? `Nenhuma conversa encontrada para "${searchQuery}"`
              : "Nenhuma conversa gravada no histórico."}
          </p>
          <span class="text-[11px] text-zinc-500">
            {searchQuery
              ? "Tente buscar por código de ticker (ex: VALE3), classe de ativo ou tema."
              : "Envie uma mensagem no Spotlight para registrar sua primeira sessão."}
          </span>
          {#if searchQuery}
            <button
              type="button"
              onclick={() => { searchQuery = ""; searchInputEl?.focus(); }}
              class="mt-2 px-3 py-1 rounded-lg bg-white/[0.06] text-zinc-300 text-xs hover:bg-white/[0.1] cursor-pointer"
            >
              Limpar busca
            </button>
          {/if}
        </div>
      {:else}
        {#each groupedSessions as group}
          <div class="space-y-1.5">
            <div class="flex items-center gap-2 px-1 text-[10px] text-zinc-400 font-semibold tracking-wider uppercase">
              <Calendar class="w-3 h-3 text-sky-400/80" />
              <span>{group.label}</span>
              <span class="text-zinc-500 font-normal">({group.items.length})</span>
            </div>

            <div class="grid grid-cols-1 gap-1.5">
              {#each group.items as s (s.id)}
                {@const itemIndex = filteredSessions.findIndex(fs => fs.id === s.id)}
                {@const isHighlighted = itemIndex === selectedIndex}
                <div
                  role="button"
                  tabindex="0"
                  onclick={() => handleSelect(s)}
                  onmouseenter={() => (selectedIndex = itemIndex)}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleSelect(s);
                  }}
                  class="group relative w-full p-2.5 rounded-xl border transition-all cursor-pointer text-left {isHighlighted
                    ? 'bg-sky-500/15 border-sky-500/50 shadow-[0_0_16px_rgba(14,165,233,0.15)] ring-1 ring-sky-500/30'
                    : s.id === currentSessionId
                      ? 'bg-white/[0.05] border-white/[0.12] text-zinc-200'
                      : 'bg-[#202020]/60 hover:bg-[#252525] border-white/[0.04] text-zinc-300'}"
                >
                  <div class="flex items-start justify-between gap-2.5">
                    <div class="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        class="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 {isHighlighted || s.id === currentSessionId
                          ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40'
                          : 'bg-white/[0.05] text-zinc-400 border border-white/[0.06]'}"
                      >
                        <MessageSquare class="w-3.5 h-3.5" />
                      </div>

                      <div class="min-w-0 flex-1 space-y-0.5">
                        <div class="flex items-center justify-between gap-2">
                          <span
                            class="text-xs font-semibold truncate {isHighlighted || s.id === currentSessionId
                              ? 'text-white'
                              : 'text-zinc-200'}"
                          >
                            {s.title || "Conversa Consultiva"}
                          </span>

                          <div class="flex items-center gap-1.5 shrink-0">
                            {#if s.id === currentSessionId}
                              <span
                                class="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium"
                              >
                                <Check class="w-2.5 h-2.5" /> Atual
                              </span>
                            {/if}
                            {#if isHighlighted}
                              <span class="text-[9px] text-sky-300 font-mono flex items-center gap-0.5 bg-sky-500/20 px-1 py-0.2 rounded">
                                <CornerDownLeft class="w-2.5 h-2.5" /> Abrir
                              </span>
                            {/if}
                          </div>
                        </div>

                        <p class="text-[11px] text-zinc-400 line-clamp-1 leading-snug">
                          {getLastPreview(s)}
                        </p>

                        <div class="flex items-center gap-2 text-[10px] text-zinc-500 pt-0.5">
                          <span class="flex items-center gap-1">
                            <Clock class="w-2.5 h-2.5 text-zinc-500" />
                            {s.createdAt}
                          </span>
                          <span>•</span>
                          <span>{s.messages?.length || 0} {s.messages?.length === 1 ? "mensagem" : "mensagens"}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onclick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.id);
                      }}
                      title="Excluir esta conversa"
                      class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/25 transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Bottom Action Footer -->
    <div
      class="px-4 py-2.5 border-t border-white/[0.08] bg-[#121212]/95 flex items-center justify-between text-xs shrink-0"
    >
      <div class="text-[11px] text-zinc-500 flex items-center gap-1.5">
        <span>Staggi Local Storage</span>
        <span>•</span>
        <span class="text-zinc-400">100% privado na máquina</span>
      </div>

      {#if sessions.length > 0}
        {#if confirmClearAll}
          <div class="flex items-center gap-2 animate-fade-in">
            <span class="text-[11px] text-rose-300 flex items-center gap-1">
              <AlertTriangle class="w-3 h-3 text-rose-400" />
              Limpar todas as conversas?
            </span>
            <button
              type="button"
              onclick={() => {
                onClearAllSessions();
                confirmClearAll = false;
                onClose();
              }}
              class="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-semibold text-[10px] hover:bg-rose-600 cursor-pointer shadow-sm"
            >
              Sim, Excluir
            </button>
            <button
              type="button"
              onclick={() => (confirmClearAll = false)}
              class="px-2 py-1 rounded-lg bg-white/[0.06] text-zinc-300 text-[10px] hover:bg-white/[0.1] cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        {:else}
          <button
            type="button"
            onclick={() => (confirmClearAll = true)}
            class="text-[11px] text-zinc-500 hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 class="w-3 h-3" />
            <span>{t("drawer.clearAll")}</span>
          </button>
        {/if}
      {/if}
    </div>
  </div>
{/if}
