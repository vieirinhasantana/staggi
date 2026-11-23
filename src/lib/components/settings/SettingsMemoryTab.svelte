<script lang="ts">
  import {
    Brain,
    Plus,
    Pin,
    PinOff,
    Trash2,
    Save,
    Tag,
  } from "@lucide/svelte";
  import { memoryStore } from "$lib/services/memoryState.svelte";
  import { toastStore } from "$lib/services/toastService.svelte";
  import type { MemoryItem } from "$lib/types";

  let isCreating = $state(false);
  let editingId = $state<string | null>(null);

  let formTitle = $state("");
  let formContent = $state("");
  let formTags = $state("");
  let formPinned = $state(false);
  let formActive = $state(true);

  function startCreate() {
    isCreating = true;
    editingId = null;
    formTitle = "";
    formContent = "";
    formTags = "";
    formPinned = false;
    formActive = true;
  }

  function startEdit(mem: MemoryItem) {
    isCreating = false;
    editingId = mem.id;
    formTitle = mem.title;
    formContent = mem.content;
    formTags = mem.tags.join(", ");
    formPinned = mem.pinned;
    formActive = mem.active;
  }

  function cancelForm() {
    isCreating = false;
    editingId = null;
  }

  function handleSave() {
    if (!formContent.trim()) {
      toastStore.warning("Campo obrigatório", "Informe o que o Staggi deve lembrar.");
      return;
    }

    const title = formTitle.trim() || formContent.slice(0, 40).trim() + "...";
    const tags = formTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (isCreating) {
      memoryStore.addMemory({
        title,
        content: formContent.trim(),
        tags,
        pinned: formPinned,
        active: formActive,
        source: "user",
      });
      toastStore.success("Diretriz Registrada", `"${title}" gravada no Second Brain com sucesso.`);
    } else if (editingId) {
      memoryStore.updateMemory(editingId, {
        title,
        content: formContent.trim(),
        tags,
        pinned: formPinned,
        active: formActive,
      });
      toastStore.success("Diretriz Atualizada", `"${title}" foi atualizada.`);
    }

    cancelForm();
  }

  function handleDelete(id: string, title: string) {
    memoryStore.removeMemory(id);
    toastStore.info("Diretriz Removida", `"${title}" foi removida do Second Brain.`);
  }
</script>

<div class="space-y-4">
  <!-- Gradient Action Header (Exact match with Skills & Tasks tabs) -->
  {#if !isCreating && !editingId}
    <button
      type="button"
      onclick={startCreate}
      class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-pink-500/15 via-[#262626] to-[#232323] border border-pink-500/30 hover:border-pink-500/50 flex items-center justify-between text-left transition-all cursor-pointer group shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div
          class="h-9 w-9 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-300 group-hover:scale-105 transition-transform"
        >
          <Plus class="w-5 h-5 text-pink-400" />
        </div>
        <div>
          <h5 class="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
            Nova Diretriz de Memória
          </h5>
          <p class="text-[11px] text-zinc-400 font-sans">
            Ensine preferências de formatação, estilo de resposta ou instruções personalizadas
          </p>
        </div>
      </div>
      <span
        class="px-3 py-1.5 rounded-xl bg-pink-500/20 text-pink-200 text-xs font-semibold border border-pink-500/35 group-hover:bg-pink-500/30 transition-all shrink-0"
      >
        Adicionar
      </span>
    </button>
  {/if}

  <!-- Form for Create or Edit (Exact match with Skills & Tasks tabs) -->
  {#if isCreating || editingId}
    <div
      class="p-4 rounded-2xl bg-[#232323] border border-pink-500/30 space-y-3.5 text-xs animate-fade-in shadow-lg"
    >
      <div
        class="flex items-center justify-between border-b border-white/[0.08] pb-2 text-pink-300 font-semibold"
      >
        <span class="flex items-center gap-2">
          <Brain class="w-4 h-4" />
          {isCreating ? "Nova Diretriz de Memória" : `Editando: ${formTitle}`}
        </span>
        <button
          type="button"
          onclick={cancelForm}
          class="text-zinc-400 hover:text-zinc-100 text-xs cursor-pointer"
        >
          Cancelar
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="space-y-1">
          <label
            for="form-memory-title"
            class="text-[10px] text-zinc-400 uppercase font-sans"
          >
            Título (opcional)
          </label>
          <input
            id="form-memory-title"
            type="text"
            bind:value={formTitle}
            placeholder="Ex: Formato de Relatório, Preço Teto..."
            class="w-full rounded-xl bg-[#282828] border border-white/[0.1] px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-pink-500/50"
          />
        </div>

        <div class="space-y-1">
          <label
            for="form-memory-tags"
            class="text-[10px] text-zinc-400 uppercase font-sans"
          >
            Palavras-chave / Tags (opcional)
          </label>
          <input
            id="form-memory-tags"
            type="text"
            bind:value={formTags}
            placeholder="Ex: estilo, valuation, dividendos"
            class="w-full rounded-xl bg-[#282828] border border-white/[0.1] px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-pink-500/50"
          />
        </div>
      </div>

      <div class="space-y-1">
        <label
          for="form-memory-content"
          class="text-[10px] text-zinc-400 uppercase font-sans"
        >
          O que o Staggi deve lembrar?
        </label>
        <textarea
          id="form-memory-content"
          bind:value={formContent}
          rows={4}
          placeholder="Ex: Sempre responder com resumos executivos diretos em tópicos, priorizando análise de risco antes da recomendação."
          class="w-full rounded-xl bg-[#282828] border border-white/[0.1] p-3 text-xs text-zinc-100 focus:outline-none focus:border-pink-500/50 leading-relaxed resize-y"
        ></textarea>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-white/[0.08]">
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
            <input
              type="checkbox"
              bind:checked={formPinned}
              class="rounded bg-[#181818] border-white/20 text-pink-500 focus:ring-0 cursor-pointer"
            />
            <span class="flex items-center gap-1 font-sans">
              <Pin class="w-3 h-3 text-amber-400" /> Fixar em todas as conversas
            </span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
            <input
              type="checkbox"
              bind:checked={formActive}
              class="rounded bg-[#181818] border-white/20 text-emerald-500 focus:ring-0 cursor-pointer"
            />
            <span class="font-sans">Ativa</span>
          </label>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={cancelForm}
            class="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onclick={handleSave}
            disabled={!formContent.trim()}
            class="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-pink-500 text-white font-semibold text-xs transition-all hover:bg-pink-600 cursor-pointer disabled:opacity-40 shadow-md"
          >
            <Save class="w-3.5 h-3.5" />
            <span>Salvar</span>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Single Unified List (Exact match with Skills & Tasks tabs) -->
  <div class="space-y-3">
    {#if memoryStore.memories.length === 0}
      <div
        class="p-8 text-center space-y-3 rounded-2xl bg-[#212121]/60 border border-white/[0.06]"
      >
        <div
          class="h-10 w-10 rounded-xl bg-pink-500/15 text-pink-400 mx-auto flex items-center justify-center border border-pink-500/20"
        >
          <Brain class="w-5 h-5" />
        </div>
        <div class="space-y-1">
          <h5 class="text-sm font-semibold text-zinc-200">
            Second Brain Vazio
          </h5>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">
            Nenhuma diretriz cadastrada ainda. Adicione preferências de resposta, estilo ou regras de trabalho.
          </p>
        </div>
        <button
          type="button"
          onclick={startCreate}
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-medium text-xs shadow-md shadow-pink-500/20 transition-all cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Criar Primeira Diretriz</span>
        </button>
      </div>
    {:else}
      {#each memoryStore.memories as mem (mem.id)}
        <div
          class="p-4 rounded-2xl bg-[#262626]/90 hover:bg-[#262626] border transition-all space-y-3 {mem.active
            ? 'border-white/[0.08] hover:border-pink-500/35 shadow-sm'
            : 'border-white/[0.04] opacity-75'}"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3 min-w-0">
              <div
                class="h-9 w-9 rounded-xl bg-pink-500/15 border border-pink-500/25 flex items-center justify-center text-pink-300 shrink-0 mt-0.5"
              >
                <Brain class="w-4 h-4 text-pink-400" />
              </div>
              <div class="space-y-1.5 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="font-semibold text-zinc-100 text-sm tracking-tight"
                  >
                    {mem.title}
                  </span>
                  {#if mem.pinned}
                    <span
                      class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                    >
                      <Pin class="w-2.5 h-2.5 text-amber-400" /> Fixada
                    </span>
                  {/if}
                </div>
                <p
                  class="text-xs text-zinc-300 font-sans leading-relaxed"
                >
                  {mem.content}
                </p>
                {#if mem.tags && mem.tags.length > 0}
                  <div class="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px] text-zinc-500">
                    <Tag class="w-3 h-3 text-zinc-500" />
                    {#each mem.tags as tag}
                      <span class="px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 font-mono text-[9px]">
                        #{tag}
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onclick={() => memoryStore.togglePinned(mem.id)}
                title={mem.pinned ? "Desafixar" : "Fixar em todas as conversas"}
                class="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                {#if mem.pinned}
                  <Pin class="w-4 h-4 text-amber-400" />
                {:else}
                  <PinOff class="w-4 h-4 text-zinc-500" />
                {/if}
              </button>

              <button
                type="button"
                onclick={() => startEdit(mem)}
                class="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 text-xs transition-colors cursor-pointer"
              >
                Editar
              </button>

              <button
                type="button"
                onclick={() => memoryStore.toggleActive(mem.id)}
                class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer {mem.active
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/[0.06] text-zinc-500 border border-white/[0.06]'}"
              >
                {mem.active ? "Ativa" : "Pausada"}
              </button>

              <button
                type="button"
                onclick={() => handleDelete(mem.id, mem.title)}
                aria-label={`Excluir ${mem.title}`}
                class="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
