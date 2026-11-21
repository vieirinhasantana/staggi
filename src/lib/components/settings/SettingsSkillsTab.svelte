<script lang="ts">
  import {
    Zap,
    Plus,
    Code,
    Save,
    Trash2,
  } from "@lucide/svelte";
  import { pluginsStore } from "$lib/services/pluginsState.svelte";
  import { toastStore } from "$lib/services/toastService.svelte";
  import type { SkillDefinition } from "$lib/types";

  let editingSkillId = $state<string | null>(null);
  let isCreatingSkill = $state(false);

  let editName = $state("");
  let editDesc = $state("");
  let editMcp = $state("mcp-yahoo-finance");
  let editPrompt = $state("");

  function startEditSkill(skill: SkillDefinition) {
    editingSkillId = skill.id;
    isCreatingSkill = false;
    editName = skill.name;
    editDesc = skill.description;
    editMcp = skill.mcpDependency;
    editPrompt = skill.systemPrompt;
  }

  function startCreateSkill() {
    editingSkillId = null;
    isCreatingSkill = true;
    editName = "";
    editDesc = "";
    editMcp = "mcp-yahoo-finance";
    editPrompt = `# Instruções da Nova Skill
Você é o assistente especializado do Staggi.
1. Defina aqui os passos de raciocínio.
2. Defina os critérios e fórmulas analíticas.
3. Formate a resposta executiva para o cliente.`;
  }

  function handleCancelSkill() {
    editingSkillId = null;
    isCreatingSkill = false;
    editName = "";
    editDesc = "";
    editMcp = "";
    editPrompt = "";
  }

  function handleSaveSkill() {
    if (!editName.trim()) return;

    if (isCreatingSkill) {
      pluginsStore.addSkill({
        name: editName.trim(),
        description: editDesc.trim() || "Skill personalizada",
        mcpDependency: editMcp,
        systemPrompt: editPrompt,
        active: true,
      });
      toastStore.success("Nova Skill Criada", `Skill "${editName.trim()}" pronta para uso via /${editName.trim().toLowerCase()}.`);
      isCreatingSkill = false;
      editingSkillId = null;
    } else if (editingSkillId) {
      pluginsStore.updateSkill(editingSkillId, {
        name: editName.trim(),
        description: editDesc.trim(),
        mcpDependency: editMcp,
        systemPrompt: editPrompt,
      });
      toastStore.success("Skill Atualizada", `Instruções da skill "${editName.trim()}" salvas com sucesso.`);
      editingSkillId = null;
    }
  }

  function handleDeleteSkill(id: string) {
    pluginsStore.removeSkill(id);
    if (editingSkillId === id) {
      editingSkillId = null;
    }
  }
</script>

<div class="space-y-4">
  {#if !editingSkillId && !isCreatingSkill}
    <button
      type="button"
      onclick={startCreateSkill}
      class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-violet-500/15 via-[#232034] to-[#1c1a28] border border-violet-500/30 hover:border-violet-500/50 flex items-center justify-between text-left transition-all cursor-pointer group shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div
          class="h-9 w-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 group-hover:scale-105 transition-transform"
        >
          <Plus class="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h5
            class="text-xs font-semibold text-zinc-100 font-mono flex items-center gap-1.5"
          >
            + Escrever Nova Skill Especializada (SKILL.md)
          </h5>
          <p class="text-[11px] text-zinc-400 font-sans">
            Crie prompts analíticos especializados com orquestração autônoma de servidores MCP.
          </p>
        </div>
      </div>
      <span
        class="px-3 py-1.5 rounded-xl bg-violet-500/20 text-violet-200 text-xs font-mono font-semibold border border-violet-500/35 group-hover:bg-violet-500/30 transition-all shrink-0"
      >
        Criar Skill
      </span>
    </button>
  {/if}

  {#if editingSkillId || isCreatingSkill}
    <div
      class="p-4 rounded-2xl bg-[#1e1c2b] border border-violet-500/30 space-y-3 text-xs font-mono animate-fade-in shadow-lg"
    >
      <div
        class="flex items-center justify-between border-b border-white/[0.08] pb-2 text-violet-300 font-semibold"
      >
        <span class="flex items-center gap-2">
          <Code class="w-4 h-4" />
          {isCreatingSkill
            ? "Escrever Nova Skill"
            : `Editando: ${editName}`}
        </span>
        <button
          type="button"
          onclick={handleCancelSkill}
          class="text-zinc-400 hover:text-zinc-100 text-xs font-mono cursor-pointer"
        >
          Cancelar
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="space-y-1">
          <label
            for="edit-skill-name"
            class="text-[10px] text-zinc-400 uppercase"
            >Nome da Skill (Identificador):</label
          >
          <input
            id="edit-skill-name"
            type="text"
            bind:value={editName}
            placeholder="ex: calculadora-irpf-offshore"
            class="w-full rounded-xl bg-[#2a273b] border border-white/[0.1] px-3 py-2 text-zinc-100 focus:outline-none"
          />
        </div>
        <div class="space-y-1">
          <label
            for="edit-skill-mcp"
            class="text-[10px] text-zinc-400 uppercase"
            >MCPs Autorizados:</label
          >
          <input
            id="edit-skill-mcp"
            type="text"
            bind:value={editMcp}
            placeholder="ex: mcp-yahoo-finance, mcp-tributario"
            class="w-full rounded-xl bg-[#2a273b] border border-white/[0.1] px-3 py-2 text-zinc-100 focus:outline-none"
          />
        </div>
      </div>

      <div class="space-y-1">
        <label
          for="edit-skill-prompt"
          class="text-[10px] text-zinc-400 uppercase"
          >Instruções de Sistema & Regras da Skill (Prompt Markdown):</label
        >
        <textarea
          id="edit-skill-prompt"
          bind:value={editPrompt}
          rows={6}
          placeholder="Escreva aqui como o modelo deve analisar os dados, quais fórmulas aplicar e como responder..."
          class="w-full rounded-xl bg-[#181624] border border-white/[0.12] p-3 text-xs text-zinc-200 font-mono focus:outline-none leading-relaxed resize-y"
        ></textarea>
      </div>

      <div class="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onclick={handleCancelSkill}
          class="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onclick={handleSaveSkill}
          disabled={!editName.trim()}
          class="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-violet-500 text-white font-semibold text-xs transition-all hover:bg-violet-600 cursor-pointer disabled:opacity-40 shadow-md"
        >
          <Save class="w-3.5 h-3.5" />
          <span>Salvar Skill</span>
        </button>
      </div>
    </div>
  {/if}

  <div class="flex items-center justify-between pt-1">
    <h5 class="text-xs font-semibold text-zinc-300 font-mono">
      Skills Instaladas & Prontas ({pluginsStore.skills.length})
    </h5>
    <span class="text-[10px] text-zinc-400 font-mono">
      {pluginsStore.activeSkillsCount} ativas
    </span>
  </div>

  <div class="space-y-3.5">
    {#if pluginsStore.skills.length === 0}
      <div
        class="p-8 text-center space-y-3 rounded-2xl bg-[#1d1b2a]/60 border border-white/[0.06]"
      >
        <div
          class="h-10 w-10 rounded-xl bg-violet-500/15 text-violet-400 mx-auto flex items-center justify-center border border-violet-500/20"
        >
          <Zap class="w-5 h-5" />
        </div>
        <div class="space-y-1">
          <h5 class="text-sm font-semibold text-zinc-200">
            Nenhuma skill cadastrada
          </h5>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">
            Crie prompts analíticos especializados para turbinar as análises do Staggi.
          </p>
        </div>
        <button
          type="button"
          onclick={startCreateSkill}
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-medium text-xs shadow-md shadow-violet-500/20 transition-all cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Criar Primeira Skill</span>
        </button>
      </div>
    {/if}

    {#each pluginsStore.skills as skill (skill.id)}
      <div
        class="p-4.5 rounded-2xl bg-[#221f33]/90 hover:bg-[#252238] border transition-all space-y-3 {skill.active
          ? 'border-white/[0.08] hover:border-violet-500/35 shadow-sm'
          : 'border-white/[0.04] opacity-75'}"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3 min-w-0">
            <div
              class="h-9 w-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-300 shrink-0 mt-0.5"
            >
              <Zap class="w-4 h-4 text-violet-400" />
            </div>
            <div class="space-y-1.5 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  class="font-semibold text-zinc-100 text-sm tracking-tight"
                  >{skill.name}</span
                >
                <span
                  class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/[0.06] text-violet-300 border border-violet-500/25"
                >
                  {skill.mcpDependency || "Custom"}
                </span>
              </div>
              <p
                class="text-xs text-zinc-300 font-sans leading-relaxed"
              >
                {skill.description}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onclick={() => startEditSkill(skill)}
              class="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
            >
              Editar Instruções
            </button>
            <button
              type="button"
              onclick={() => pluginsStore.toggleSkill(skill.id)}
              class="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer {skill.active
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-white/[0.06] text-zinc-500 border border-white/[0.06]'}"
            >
              {skill.active ? "Ativa" : "Inativa"}
            </button>
            <button
              type="button"
              onclick={() => handleDeleteSkill(skill.id)}
              aria-label="Excluir skill {skill.name}"
              class="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>
