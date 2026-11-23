<script lang="ts">
  import {
    Brain,
    Plus,
    Search,
    Pin,
    PinOff,
    Trash2,
    Save,
    X,
    Tag,
    RotateCcw,
    Zap,
    Download,
    Upload,
    Check,
  } from "@lucide/svelte";
  import { memoryStore } from "$lib/services/memoryState.svelte";
  import { toastStore } from "$lib/services/toastService.svelte";
  import type { MemoryItem, MemoryCategory } from "$lib/types";

  let searchQuery = $state("");
  let selectedCategory = $state<string>("all");

  let isCreating = $state(false);
  let editingId = $state<string | null>(null);

  let formTitle = $state("");
  let formContent = $state("");
  let formCategory = $state<MemoryCategory>("client");
  let formTags = $state("");
  let formPinned = $state(false);
  let formActive = $state(true);

  const categories: { id: string; label: string; color: string }[] = [
    { id: "all", label: "Todas", color: "text-zinc-300" },
    { id: "client", label: "Clientes", color: "text-emerald-400" },
    { id: "thesis", label: "Teses Macro", color: "text-violet-400" },
    { id: "rule", label: "Regras & Compliance", color: "text-amber-400" },
    { id: "profile", label: "Perfil & Mandato", color: "text-sky-400" },
    { id: "preference", label: "Preferências", color: "text-pink-400" },
    { id: "pinned", label: "Fixadas 📌", color: "text-amber-300" },
  ];

  function getCategoryBadge(category: MemoryCategory) {
    switch (category) {
      case "client":
        return { label: "Cliente", class: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
      case "thesis":
        return { label: "Tese Macro", class: "bg-violet-500/15 text-violet-300 border-violet-500/30" };
      case "rule":
        return { label: "Regra / Compliance", class: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
      case "profile":
        return { label: "Perfil Assessor", class: "bg-sky-500/15 text-sky-300 border-sky-500/30" };
      default:
        return { label: "Preferência", class: "bg-pink-500/15 text-pink-300 border-pink-500/30" };
    }
  }

  const filteredMemories = $derived.by(() => {
    let list = memoryStore.memories;

    if (selectedCategory === "pinned") {
      list = list.filter((m) => m.pinned);
    } else if (selectedCategory !== "all") {
      list = list.filter((m) => m.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  });

  function startCreate() {
    isCreating = true;
    editingId = null;
    formTitle = "";
    formContent = "";
    formCategory = "client";
    formTags = "";
    formPinned = false;
    formActive = true;
  }

  function startEdit(mem: MemoryItem) {
    isCreating = false;
    editingId = mem.id;
    formTitle = mem.title;
    formContent = mem.content;
    formCategory = mem.category;
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
      toastStore.warning("Campo obrigatório", "Informe o conteúdo da diretriz de memória.");
      return;
    }

    const title = formTitle.trim() || formContent.slice(0, 35).trim() + "...";
    const tags = formTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (isCreating) {
      memoryStore.addMemory({
        title,
        content: formContent.trim(),
        category: formCategory,
        tags,
        pinned: formPinned,
        active: formActive,
        source: "user",
      });
      toastStore.success("Memória Registrada", `"${title}" gravada no Second Brain com sucesso.`);
    } else if (editingId) {
      memoryStore.updateMemory(editingId, {
        title,
        content: formContent.trim(),
        category: formCategory,
        tags,
        pinned: formPinned,
        active: formActive,
      });
      toastStore.success("Memória Atualizada", `"${title}" foi atualizada.`);
    }

    cancelForm();
  }

  function handleDelete(id: string, title: string) {
    memoryStore.removeMemory(id);
    toastStore.info("Memória Removida", `"${title}" foi removida do Second Brain.`);
  }

  function handleExport() {
    const json = memoryStore.exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staggi-second-brain-memories-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastStore.success("Exportação Concluída", "Backup de memórias gerado com sucesso.");
  }

  function handleImport(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const result = memoryStore.importJson(String(reader.result || ""));
      if (result.success) {
        toastStore.success("Importação Concluída", `${result.count} memórias importadas com sucesso.`);
      } else {
        toastStore.error("Erro na Importação", result.error || "Arquivo JSON inválido.");
      }
    };
    reader.readAsText(file);
    input.value = "";
  }
</script>

<div class="space-y-4">
  <!-- Stats & Engine Performance Bar -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
    <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
      <div class="p-2 rounded-lg bg-pink-500/15 text-pink-400">
        <Brain class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs text-zinc-400">Total Gravado</div>
        <div class="text-base font-semibold text-zinc-100">{memoryStore.totalCount} fatos</div>
      </div>
    </div>

    <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
      <div class="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
        <Check class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs text-zinc-400">Ativas no Chat</div>
        <div class="text-base font-semibold text-emerald-400">{memoryStore.activeCount} ativas</div>
      </div>
    </div>

    <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
      <div class="p-2 rounded-lg bg-amber-500/15 text-amber-400">
        <Pin class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs text-zinc-400">Fixadas (Global)</div>
        <div class="text-base font-semibold text-amber-300">{memoryStore.pinnedCount} fixas</div>
      </div>
    </div>

    <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
      <div class="p-2 rounded-lg bg-violet-500/15 text-violet-400">
        <Zap class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs text-zinc-400">Recuperação</div>
        <div class="text-base font-semibold text-violet-300">&lt; 0.2 ms</div>
      </div>
    </div>
  </div>

  <!-- Action & Filter Bar -->
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
    <!-- Search Bar -->
    <div class="relative flex-1">
      <Search class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Buscar diretrizes por cliente, tese, ticker, tag ou palavra-chave..."
        class="w-full bg-[#141414] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/40 transition-all"
      />
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onclick={startCreate}
        class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-pink-500/20 text-pink-200 border border-pink-500/35 hover:bg-pink-500/30 transition-all cursor-pointer shadow-sm"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>Nova Memória</span>
      </button>

      <button
        type="button"
        onclick={handleExport}
        title="Exportar memórias em JSON"
        class="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 border border-white/[0.06] transition-all cursor-pointer"
      >
        <Download class="w-3.5 h-3.5" />
      </button>

      <label
        title="Importar memórias JSON"
        class="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 border border-white/[0.06] transition-all cursor-pointer"
      >
        <Upload class="w-3.5 h-3.5" />
        <input type="file" accept=".json" onchange={handleImport} class="hidden" />
      </label>

      <button
        type="button"
        onclick={() => memoryStore.resetToDefault()}
        title="Restaurar diretrizes padrão fiduciárias"
        class="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 border border-white/[0.06] transition-all cursor-pointer"
      >
        <RotateCcw class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>

  <!-- Category Filter Pills -->
  <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
    {#each categories as cat}
      <button
        type="button"
        onclick={() => (selectedCategory = cat.id)}
        class="px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap {selectedCategory === cat.id
          ? 'bg-pink-500/20 text-pink-200 border border-pink-500/35 shadow-sm'
          : 'bg-white/[0.03] text-zinc-400 border border-white/[0.05] hover:text-zinc-200 hover:bg-white/[0.06]'}"
      >
        {cat.label}
      </button>
    {/each}
  </div>

  <!-- Form for Create or Edit -->
  {#if isCreating || editingId}
    <div class="p-4 rounded-xl bg-[#202020] border border-pink-500/35 space-y-3 animate-fade-in shadow-lg">
      <div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div class="flex items-center gap-2">
          <Brain class="w-4 h-4 text-pink-400" />
          <h4 class="text-xs font-semibold text-zinc-100">
            {isCreating ? "Registrar Nova Diretriz no Second Brain" : "Editar Memória de Longo Prazo"}
          </h4>
        </div>
        <button
          type="button"
          onclick={cancelForm}
          class="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-white/[0.06] transition-colors"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label for="form-memory-title" class="block text-[11px] text-zinc-400 mb-1 font-medium">Título da Memória / Fato</label>
          <input
            id="form-memory-title"
            type="text"
            bind:value={formTitle}
            placeholder="Ex: Cliente Família Silveira, Tese NTN-B 2035..."
            class="w-full bg-[#141414] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-pink-500/40"
          />
        </div>

        <div>
          <label for="form-memory-category" class="block text-[11px] text-zinc-400 mb-1 font-medium">Categoria Fiduciária</label>
          <select
            id="form-memory-category"
            bind:value={formCategory}
            class="w-full bg-[#141414] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-pink-500/40"
          >
            <option value="client">Cliente & Restrições de Carteira</option>
            <option value="thesis">Tese de Investimento & Macro</option>
            <option value="rule">Regra Regulatória, Fiscal ou Compliance</option>
            <option value="profile">Perfil & Mandato do Assessor</option>
            <option value="preference">Preferência Geral de Análise</option>
          </select>
        </div>
      </div>

      <div>
        <label for="form-memory-content" class="block text-[11px] text-zinc-400 mb-1 font-medium">
          Diretriz / Fato Permanente (O modelo respeitará com rigor fiduciário)
        </label>
        <textarea
          id="form-memory-content"
          bind:value={formContent}
          rows="3"
          placeholder="Descreva o fato, restrição do cliente ou diretriz de investimento que deve ser memorizada para sempre..."
          class="w-full bg-[#141414] border border-white/[0.08] rounded-lg p-2.5 text-xs text-zinc-100 focus:outline-none focus:border-pink-500/40 resize-none"
        ></textarea>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        <div>
          <label for="form-memory-tags" class="block text-[11px] text-zinc-400 mb-1 font-medium">Tags de Recuperação Rápida (separadas por vírgula)</label>
          <input
            id="form-memory-tags"
            type="text"
            bind:value={formTags}
            placeholder="silveira, estatais, dividendos, b3"
            class="w-full bg-[#141414] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-pink-500/40"
          />
        </div>

        <div class="flex items-center gap-4 pt-4 sm:pt-0">
          <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
            <input type="checkbox" bind:checked={formPinned} class="accent-pink-500 rounded" />
            <span class="flex items-center gap-1">
              <Pin class="w-3 h-3 text-amber-400" /> Fixar em todas as conversas
            </span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
            <input type="checkbox" bind:checked={formActive} class="accent-emerald-500 rounded" />
            <span>Ativa</span>
          </label>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onclick={cancelForm}
          class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onclick={handleSave}
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-pink-500 hover:bg-pink-400 text-white transition-all shadow-sm cursor-pointer"
        >
          <Save class="w-3.5 h-3.5" />
          <span>Salvar Memória</span>
        </button>
      </div>
    </div>
  {/if}

  <!-- Memories List -->
  <div class="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
    {#if filteredMemories.length === 0}
      <div class="py-12 text-center text-zinc-500 text-xs rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01]">
        <Brain class="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p class="font-medium text-zinc-400">Nenhuma memória encontrada</p>
        <p class="text-[11px] text-zinc-500 mt-0.5">
          {searchQuery ? "Nenhum resultado corresponde à sua busca." : "Adicione diretrizes fiduciárias ou use o comando /lembrar no chat."}
        </p>
      </div>
    {:else}
      {#each filteredMemories as mem (mem.id)}
        {@const badge = getCategoryBadge(mem.category)}
        <div
          class="p-3.5 rounded-xl border transition-all {mem.active
            ? 'bg-[#181818]/90 border-white/[0.08] hover:border-white/[0.14]'
            : 'bg-[#141414]/50 border-white/[0.04] opacity-50'}"
        >
          <div class="flex items-start justify-between gap-3 mb-1.5">
            <div class="flex items-center gap-2 flex-wrap min-w-0">
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold border {badge.class}">
                {badge.label}
              </span>
              {#if mem.pinned}
                <span class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Pin class="w-2.5 h-2.5 text-amber-400" /> Fixada
                </span>
              {/if}
              <h4 class="text-xs font-semibold text-zinc-100 truncate">{mem.title}</h4>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <!-- Pin Toggle Button -->
              <button
                type="button"
                onclick={() => memoryStore.togglePinned(mem.id)}
                title={mem.pinned ? "Desafixar" : "Fixar globalmente"}
                class="p-1 rounded text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                {#if mem.pinned}
                  <Pin class="w-3.5 h-3.5 text-amber-400" />
                {:else}
                  <PinOff class="w-3.5 h-3.5 text-zinc-500" />
                {/if}
              </button>

              <!-- Active Toggle -->
              <button
                type="button"
                onclick={() => memoryStore.toggleActive(mem.id)}
                class="px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer {mem.active
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06]'}"
              >
                {mem.active ? "Ativa" : "Inativa"}
              </button>

              <!-- Edit Button -->
              <button
                type="button"
                onclick={() => startEdit(mem)}
                class="px-2 py-0.5 rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                Editar
              </button>

              <!-- Delete Button -->
              <button
                type="button"
                onclick={() => handleDelete(mem.id, mem.title)}
                class="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Excluir memória"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>

          <!-- Content -->
          <p class="text-xs text-zinc-300 leading-relaxed font-normal">{mem.content}</p>

          <!-- Tags & Metadata Footer -->
          <div class="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/[0.04] text-[10px] text-zinc-500">
            <div class="flex items-center gap-1.5 flex-wrap">
              <Tag class="w-3 h-3 text-zinc-500" />
              {#if mem.tags.length > 0}
                {#each mem.tags as tag}
                  <span class="px-1.5 py-0.2 rounded bg-white/[0.04] text-zinc-400 font-mono text-[9px]">
                    #{tag}
                  </span>
                {/each}
              {:else}
                <span class="text-zinc-600">Sem tags</span>
              {/if}
            </div>

            <div class="shrink-0 text-zinc-500">
              {mem.source === "system" ? "Padrão Fiduciário" : "Assessor"} • {mem.updatedAt}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
