<script lang="ts">
  import type { ChatSession } from "$lib/types";
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
    Sparkles,
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
  let confirmClearAll = $state(false);

  let filteredSessions = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      if (s.title && s.title.toLowerCase().includes(q)) return true;
      if (s.createdAt && s.createdAt.toLowerCase().includes(q)) return true;
      return s.messages?.some((m) => m.text?.toLowerCase().includes(q));
    });
  });

  interface GroupedSessions {
    label: string;
    items: ChatSession[];
  }

  let groupedSessions = $derived.by((): GroupedSessions[] => {
    if (searchQuery.trim()) {
      return [
        {
          label: `Resultados da Pesquisa (${filteredSessions.length})`,
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
    if (todayItems.length > 0) groups.push({ label: "Hoje", items: todayItems });
    if (yesterdayItems.length > 0) groups.push({ label: "Ontem", items: yesterdayItems });
    if (thisWeekItems.length > 0) groups.push({ label: "Últimos 7 dias", items: thisWeekItems });
    if (olderItems.length > 0) groups.push({ label: "Mais antigas", items: olderItems });

    if (groups.length === 0 && filteredSessions.length > 0) {
      groups.push({ label: "Todas as Conversas", items: filteredSessions });
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
    if (clean.length > 100) clean = clean.slice(0, 100) + "...";
    return clean || "Mensagem de análise";
  }

  function handleSelect(s: ChatSession) {
    onSelectSession(s);
    onClose();
  }

  function handleStartNew() {
    onNewChat();
    onClose();
  }
</script>

{#if open}
  <div
    class="absolute inset-0 z-40 bg-[#161424]/98 backdrop-blur-2xl flex flex-col rounded-[24px] overflow-hidden animate-fade-in text-zinc-100"
  >
    <div
      class="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-[#12101e]/80 shrink-0 font-mono"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onclick={onClose}
          title="Voltar ao chat atual (Esc)"
          class="h-8 w-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-xs text-zinc-100 tracking-wide flex items-center gap-1.5">
              <Clock class="w-3.5 h-3.5 text-sky-400" />
              Histórico de Conversas
            </h3>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30"
            >
              {sessions.length} {sessions.length === 1 ? "salva" : "salvas"}
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onclick={handleStartNew}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Nova Conversa</span>
        </button>

        <button
          type="button"
          onclick={onClose}
          title="Fechar Histórico (Esc)"
          class="h-8 w-8 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <div class="px-5 py-3 border-b border-white/[0.06] bg-[#1a1829]/60 shrink-0">
      <div class="relative flex items-center">
        <Search class="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Pesquisar conversas por ativo, pergunta ou termo (ex: PETR4, Valuation, Lux, Bonds)..."
          class="w-full rounded-xl bg-[#201d32] border border-white/[0.1] pl-9.5 pr-8 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-sky-400/60 font-sans shadow-inner transition-colors"
        />
        {#if searchQuery}
          <button
            type="button"
            onclick={() => (searchQuery = "")}
            class="absolute right-2.5 text-zinc-500 hover:text-zinc-200 p-1 cursor-pointer"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        {/if}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-5 py-3 space-y-4 font-sans">
      {#if filteredSessions.length === 0}
        <div class="py-12 flex flex-col items-center justify-center text-center space-y-2 font-mono">
          <MessageSquare class="w-8 h-8 text-zinc-600 mb-1" />
          <p class="text-xs text-zinc-400">
            {searchQuery
              ? `Nenhuma conversa encontrada para "${searchQuery}"`
              : "Nenhuma conversa armazenada no histórico."}
          </p>
          <span class="text-[11px] text-zinc-500">
            {searchQuery
              ? "Tente buscar por ticker, tema fiscal ou nome de fundo."
              : "Inicie um diálogo no Spotlight para salvar sua primeira conversa."}
          </span>
          {#if searchQuery}
            <button
              type="button"
              onclick={() => (searchQuery = "")}
              class="mt-2 px-3 py-1 rounded-lg bg-white/[0.06] text-zinc-300 text-xs hover:bg-white/[0.1] cursor-pointer"
            >
              Limpar filtro
            </button>
          {/if}
        </div>
      {:else}
        {#each groupedSessions as group}
          <div class="space-y-2">
            <div class="flex items-center gap-2 px-1 text-[11px] font-mono text-zinc-400 font-semibold tracking-wider uppercase">
              <Calendar class="w-3 h-3 text-sky-400/80" />
              <span>{group.label}</span>
              <span class="text-zinc-600 text-[10px]">({group.items.length})</span>
            </div>

            <div class="grid grid-cols-1 gap-2">
              {#each group.items as s (s.id)}
                <div
                  role="button"
                  tabindex="0"
                  onclick={() => handleSelect(s)}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleSelect(s);
                  }}
                  class="group relative w-full p-3 rounded-2xl border transition-all cursor-pointer text-left {s.id ===
                  currentSessionId
                    ? 'bg-sky-500/10 border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.15)] ring-1 ring-sky-500/30'
                    : 'bg-[#1f1d30]/75 hover:bg-[#28253e] border-white/[0.06] hover:border-white/[0.15] shadow-sm'}"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        class="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 {s.id ===
                        currentSessionId
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-white/[0.05] text-zinc-400 border border-white/[0.06] group-hover:text-zinc-200 group-hover:border-white/[0.12]'}"
                      >
                        <MessageSquare class="w-4 h-4" />
                      </div>

                      <div class="min-w-0 flex-1 space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span
                            class="text-xs font-semibold truncate {s.id ===
                            currentSessionId
                              ? 'text-sky-200'
                              : 'text-zinc-100 group-hover:text-white'}"
                          >
                            {s.title || "Conversa Consultiva"}
                          </span>

                          {#if s.id === currentSessionId}
                            <span
                              class="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0 font-medium"
                            >
                              <Check class="w-2.5 h-2.5" /> Ativa Agora
                            </span>
                          {/if}
                        </div>

                        <p class="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                          {getLastPreview(s)}
                        </p>

                        <div
                          class="flex items-center gap-3 text-[10px] text-zinc-500 font-mono pt-0.5"
                        >
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
                      class="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/25 transition-all cursor-pointer shrink-0"
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

    <div
      class="px-5 py-3 border-t border-white/[0.08] bg-[#12101e]/90 flex items-center justify-between text-xs font-mono shrink-0"
    >
      <div class="text-[11px] text-zinc-500">
        <span>Staggi Local Storage • Dados privados no seu computador</span>
      </div>

      {#if sessions.length > 0}
        {#if confirmClearAll}
          <div class="flex items-center gap-2 animate-fade-in">
            <span class="text-[11px] text-rose-300 flex items-center gap-1">
              <AlertTriangle class="w-3 h-3 text-rose-400" />
              Apagar todas as conversas?
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
              Sim, Apagar Tudo
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
            <span>Limpar todo o histórico</span>
          </button>
        {/if}
      {/if}
    </div>
  </div>
{/if}
