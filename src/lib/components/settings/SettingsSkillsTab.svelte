<script lang="ts">
  import {
    Zap,
    Plus,
    Code,
    Save,
    Trash2,
    RotateCcw,
  } from "@lucide/svelte";
  import { pluginsStore, getSkillSlug } from "$lib/services/pluginsState.svelte";
  import { toastStore } from "$lib/services/toastService.svelte";
  import type { SkillDefinition } from "$lib/types";
  import { t } from "$lib/i18n";

  let editingSkillId = $state<string | null>(null);
  let isCreatingSkill = $state(false);

  let editName = $state("");
  let editSlug = $state("");
  let editDesc = $state("");
  let editMcp = $state("mcp-yahoo-finance");
  let editPrompt = $state("");

  function startEditSkill(skill: SkillDefinition) {
    editingSkillId = skill.id;
    isCreatingSkill = false;
    editName = skill.name;
    editSlug = skill.slug || getSkillSlug(skill);
    editDesc = skill.description;
    editMcp = skill.mcpDependency;
    editPrompt = skill.systemPrompt;
  }

  function startCreateSkill() {
    editingSkillId = null;
    isCreatingSkill = true;
    editName = "";
    editSlug = "";
    editDesc = "";
    editMcp = "mcp-yahoo-finance";
    editPrompt = `# Specialized Skill Directives
You are Staggi's specialized financial intelligence advisor.
1. Outline reasoning steps and verified data checkpoints here.
2. Define formulas, valuation metrics, and fiduciary guardrails.
3. Structure output in executive markdown tables and summaries.`;
  }

  function handleCancelSkill() {
    editingSkillId = null;
    isCreatingSkill = false;
    editName = "";
    editSlug = "";
    editDesc = "";
    editMcp = "";
    editPrompt = "";
  }

  function handleSaveSkill() {
    if (!editName.trim()) return;
    const name = editName.trim();
    const cleanSlug = editSlug.trim()
      ? editSlug.trim().toLowerCase().replace(/^\/+/, "").replace(/[^a-z0-9_-]+/g, "-")
      : name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");

    if (isCreatingSkill) {
      pluginsStore.addSkill({
        name,
        slug: cleanSlug,
        description: editDesc.trim() || "Custom analytical skill",
        mcpDependency: editMcp,
        systemPrompt: editPrompt,
        active: true,
      });
      toastStore.success(
        t("toasts.skillCreatedTitle"),
        t("toasts.skillCreatedDesc", { name, command: cleanSlug })
      );
      isCreatingSkill = false;
      editingSkillId = null;
    } else if (editingSkillId) {
      pluginsStore.updateSkill(editingSkillId, {
        name,
        slug: cleanSlug,
        description: editDesc.trim(),
        mcpDependency: editMcp,
        systemPrompt: editPrompt,
      });
      toastStore.success(
        t("toasts.skillUpdatedTitle"),
        t("toasts.skillUpdatedDesc", { name })
      );
      editingSkillId = null;
    }
  }

  function handleDeleteSkill(id: string) {
    pluginsStore.removeSkill(id);
    if (editingSkillId === id) {
      editingSkillId = null;
    }
  }

  function handleRestoreDefaults() {
    if (confirm(t("settings.skills.restoreDefaultsConfirm"))) {
      pluginsStore.restoreDefaultSkills();
    }
  }
</script>

<div class="space-y-4">
  {#if !editingSkillId && !isCreatingSkill}
    <button
      type="button"
      onclick={startCreateSkill}
      class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-violet-500/15 via-[#262626] to-[#232323] border border-violet-500/30 hover:border-violet-500/50 flex items-center justify-between text-left transition-all cursor-pointer group shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div
          class="h-9 w-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 group-hover:scale-105 transition-transform"
        >
          <Plus class="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h5
            class="text-xs font-semibold text-zinc-100 flex items-center gap-1.5"
          >
            {t("settings.skills.createNew")}
          </h5>
          <p class="text-[11px] text-zinc-400 font-sans">
            {t("settings.skills.createNewDesc")}
          </p>
        </div>
      </div>
      <span
        class="px-3 py-1.5 rounded-xl bg-violet-500/20 text-violet-200 text-xs font-semibold border border-violet-500/35 group-hover:bg-violet-500/30 transition-all shrink-0"
      >
        {t("settings.skills.createBtn")}
      </span>
    </button>
  {/if}

  {#if editingSkillId || isCreatingSkill}
    <div
      class="p-4 rounded-2xl bg-[#232323] border border-violet-500/30 space-y-3 text-xs animate-fade-in shadow-lg"
    >
      <div
        class="flex items-center justify-between border-b border-white/[0.08] pb-2 text-violet-300 font-semibold"
      >
        <span class="flex items-center gap-2">
          <Code class="w-4 h-4" />
          {isCreatingSkill
            ? t("settings.skills.modalTitle")
            : t("settings.skills.editing", { name: editName })}
        </span>
        <button
          type="button"
          onclick={handleCancelSkill}
          class="text-zinc-400 hover:text-zinc-100 text-xs cursor-pointer"
        >
          {t("common.cancel")}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="space-y-1">
          <label
            for="edit-skill-name"
            class="text-[10px] text-zinc-400 uppercase"
            >{t("settings.skills.skillNameLabel")}</label
          >
          <input
            id="edit-skill-name"
            type="text"
            bind:value={editName}
            placeholder={t("settings.skills.skillNamePlaceholder")}
            class="w-full rounded-xl bg-[#282828] border border-white/[0.1] px-3 py-2 text-zinc-100 focus:outline-none"
          />
        </div>
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <label
              for="edit-skill-slug"
              class="text-[10px] text-zinc-400 uppercase"
              >{t("settings.skills.slugLabel")}</label
            >
            <span class="text-[9px] text-violet-400">
              /{editSlug.trim() ? editSlug.trim().toLowerCase().replace(/^\/+/, '') : (editName ? editName.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') : 'command')}
            </span>
          </div>
          <input
            id="edit-skill-slug"
            type="text"
            bind:value={editSlug}
            placeholder={t("settings.skills.slugPlaceholder")}
            class="w-full rounded-xl bg-[#282828] border border-white/[0.1] px-3 py-2 text-zinc-100 focus:outline-none"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="space-y-1">
          <label
            for="edit-skill-desc"
            class="text-[10px] text-zinc-400 uppercase"
            >{t("settings.skills.descriptionLabel")}</label
          >
          <input
            id="edit-skill-desc"
            type="text"
            bind:value={editDesc}
            placeholder={t("settings.skills.descriptionPlaceholder")}
            class="w-full rounded-xl bg-[#282828] border border-white/[0.1] px-3 py-2 text-zinc-100 focus:outline-none"
          />
        </div>
        <div class="space-y-1">
          <label
            for="edit-skill-mcp"
            class="text-[10px] text-zinc-400 uppercase"
            >{t("settings.skills.authorizedMcpsLabel")}</label
          >
          <input
            id="edit-skill-mcp"
            type="text"
            bind:value={editMcp}
            placeholder={t("settings.skills.authorizedMcpsPlaceholder")}
            class="w-full rounded-xl bg-[#282828] border border-white/[0.1] px-3 py-2 text-zinc-100 focus:outline-none"
          />
        </div>
      </div>

      <div class="space-y-1">
        <label
          for="edit-skill-prompt"
          class="text-[10px] text-zinc-400 uppercase"
          >{t("settings.skills.systemPromptLabel")}</label
        >
        <textarea
          id="edit-skill-prompt"
          bind:value={editPrompt}
          rows={6}
          placeholder={t("settings.skills.systemPromptPlaceholder")}
          class="w-full rounded-xl bg-[#181818] border border-white/[0.12] p-3 text-xs text-zinc-200 focus:outline-none leading-relaxed resize-y"
        ></textarea>
      </div>

      <div class="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onclick={handleCancelSkill}
          class="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs transition-colors cursor-pointer"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onclick={handleSaveSkill}
          disabled={!editName.trim()}
          class="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-violet-500 text-white font-semibold text-xs transition-all hover:bg-violet-600 cursor-pointer disabled:opacity-40 shadow-md"
        >
          <Save class="w-3.5 h-3.5" />
          <span>{t("settings.skills.saveSkill")}</span>
        </button>
      </div>
    </div>
  {/if}

  <div class="flex items-center justify-between pt-1">
    <div class="flex items-center gap-2">
      <h5 class="text-xs font-semibold text-zinc-300">
        {t("settings.skills.installedSkills", { count: pluginsStore.skills.length })}
      </h5>
      <span class="text-[10px] text-zinc-400">
        • {t("settings.skills.activeSkillsCount", { count: pluginsStore.activeSkillsCount })}
      </span>
    </div>
    <button
      type="button"
      onclick={handleRestoreDefaults}
      title="Restore original built-in reference skills"
      class="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-violet-300 transition-colors cursor-pointer"
    >
      <RotateCcw class="w-3 h-3" />
      <span>{t("settings.skills.restoreDefaults")}</span>
    </button>
  </div>

  <div class="space-y-3.5">
    {#if pluginsStore.skills.length === 0}
      <div
        class="p-8 text-center space-y-3 rounded-2xl bg-[#212121]/60 border border-white/[0.06]"
      >
        <div
          class="h-10 w-10 rounded-xl bg-violet-500/15 text-violet-400 mx-auto flex items-center justify-center border border-violet-500/20"
        >
          <Zap class="w-5 h-5" />
        </div>
        <div class="space-y-1">
          <h5 class="text-sm font-semibold text-zinc-200">
            {t("settings.skills.noSkillsTitle")}
          </h5>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">
            {t("settings.skills.noSkillsDesc")}
          </p>
        </div>
        <button
          type="button"
          onclick={startCreateSkill}
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-medium text-xs shadow-md shadow-violet-500/20 transition-all cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{t("settings.skills.createFirstSkill")}</span>
        </button>
      </div>
    {/if}

    {#each pluginsStore.skills as skill (skill.id)}
      {@const slug = getSkillSlug(skill)}
      <div
        class="p-4 rounded-2xl bg-[#262626]/90 hover:bg-[#262626] border transition-all space-y-3 {skill.active
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
                  class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30"
                >
                  /{slug}
                </span>
                {#if skill.mcpDependency}
                  <span
                    class="px-2 py-0.5 rounded-md text-[10px] bg-white/[0.06] text-zinc-300 border border-white/[0.08]"
                  >
                    {skill.mcpDependency}
                  </span>
                {/if}
              </div>
              <p
                class="text-xs text-zinc-300 font-sans leading-relaxed"
              >
                {skill.description || "Custom analytical skill"}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onclick={() => startEditSkill(skill)}
              class="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 text-xs transition-colors cursor-pointer"
            >
              {t("settings.skills.editDirectives")}
            </button>
            <button
              type="button"
              onclick={() => pluginsStore.toggleSkill(skill.id)}
              class="px-3 py-1.5 rounded-xl text-xs  font-semibold transition-all cursor-pointer {skill.active
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-white/[0.06] text-zinc-500 border border-white/[0.06]'}"
            >
              {skill.active ? t("common.active") : t("common.inactive")}
            </button>
            <button
              type="button"
              onclick={() => handleDeleteSkill(skill.id)}
              aria-label={`${t("common.delete")} ${skill.name}`}
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
