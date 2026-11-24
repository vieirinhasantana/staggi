<script lang="ts">
  import { 
    Server, 
    Zap, 
    Sparkles, 
    ArrowUp, 
    Settings, 
    X, 
    ExternalLink,
    Clock,
    Play,
    RefreshCw,
    Eye,
    ArrowDownCircle,
    CheckCircle2,
    Bot,
  } from "@lucide/svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { pluginsStore, getSkillSlug, type SkillDefinition } from "$lib/services/pluginsState.svelte";
  import { aiStore, geminiStore } from "$lib/services/aiProviderState.svelte";
  import { tasksStore } from "$lib/services/tasksState.svelte";
  import { updaterStore } from "$lib/services/updaterService.svelte";
  import { t } from "$lib/i18n";

  interface Props {
    placeholder?: string;
    onSend?: (text: string) => void;
    onOpenSettings?: (tab?: "ai" | "gemini" | "mcps" | "skills" | "tasks") => void;
    disabled?: boolean;
  }

  let {
    placeholder,
    onSend = () => {},
    onOpenSettings = () => {},
    disabled = false
  }: Props = $props();

  let effectivePlaceholder = $derived(placeholder || t("chat.inputPlaceholder"));

  let inputVal = $state("");
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let activePopover = $state<"none" | "mcp" | "skills" | "tasks">("none");

  let selectedSlashIndex = $state(0);
  let dismissSlashMenu = $state(false);

  let isSlashCommandActive = $derived.by(() => {
    if (dismissSlashMenu) return false;
    return inputVal.startsWith("/") && !inputVal.includes(" ");
  });

  let slashQuery = $derived.by(() => {
    if (!inputVal.startsWith("/")) return "";
    return inputVal.slice(1).trim().toLowerCase();
  });

  let matchingSkills = $derived.by(() => {
    if (!isSlashCommandActive) return [];
    const q = slashQuery;
    const skills = pluginsStore.activeSkills.length > 0 ? pluginsStore.activeSkills : pluginsStore.skills;
    if (!q) return skills;
    return skills.filter(s => {
      const slug = getSkillSlug(s).toLowerCase();
      return slug.includes(q) || s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
    });
  });

  function selectSkill(skill: SkillDefinition) {
    const slug = getSkillSlug(skill);
    inputVal = `/${slug} `;
    dismissSlashMenu = false;
    adjustHeight();
    setTimeout(() => {
      if (textareaEl) {
        textareaEl.focus();
        textareaEl.setSelectionRange(inputVal.length, inputVal.length);
      }
    }, 10);
  }

  function adjustHeight() {
    if (textareaEl) {
      textareaEl.style.height = "auto";
      textareaEl.style.height = Math.max(42, Math.min(textareaEl.scrollHeight, 140)) + "px";
    }
  }

  function handleInput() {
    dismissSlashMenu = false;
    selectedSlashIndex = 0;
    adjustHeight();
  }

  function handleSend() {
    const trimmed = inputVal.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    inputVal = "";
    activePopover = "none";
    dismissSlashMenu = false;
    if (textareaEl) {
      textareaEl.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (isSlashCommandActive && matchingSkills.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedSlashIndex = (selectedSlashIndex + 1) % matchingSkills.length;
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedSlashIndex = (selectedSlashIndex - 1 + matchingSkills.length) % matchingSkills.length;
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectSkill(matchingSkills[selectedSlashIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        dismissSlashMenu = true;
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, button, a, [role='button']")) return;
    try {
      const win = getCurrentWindow();
      await win.startDragging();
    } catch {
    }
  }

  function togglePopover(type: "mcp" | "skills" | "tasks") {
    activePopover = activePopover === type ? "none" : type;
  }
</script>

<div 
  role="presentation"
  data-tauri-drag-region
  class="relative z-30 w-full rounded-[28px] border border-white/[0.14] ring-1 ring-white/[0.06] bg-[#212121]/98 shadow-[0_2px_10px_rgba(0,0,0,0.35),0_12px_32px_-4px_rgba(0,0,0,0.55),0_24px_50px_-6px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-2xl transition-[box-shadow,border-color] duration-200 select-none cursor-grab active:cursor-grabbing"
>
  <div data-tauri-drag-region class="px-5 pt-4 pb-2 flex items-center">
    <textarea
      bind:this={textareaEl}
      bind:value={inputVal}
      onkeydown={handleKeyDown}
      oninput={handleInput}
      placeholder={effectivePlaceholder}
      {disabled}
      rows={1}
      class="w-full bg-transparent text-[15px] sm:text-[16px] font-normal text-zinc-100 placeholder:text-zinc-400 focus:outline-none cursor-text select-text resize-none overflow-y-auto min-h-[44px] max-h-[140px] py-1.5 leading-relaxed break-words whitespace-pre-wrap"
    ></textarea>
  </div>

  <div data-tauri-drag-region class="flex items-center justify-between px-4 pt-1 pb-3">
    <div class="flex items-center gap-2">
      {#if pluginsStore.activeMcpsCount > 0}
        <button 
          type="button"
          onclick={() => togglePopover("mcp")}
          title="Click to view {pluginsStore.activeMcpsCount} Connected MCP Servers"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-[11px] {activePopover === 'mcp' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'}"
        >
          <Server class="h-3.5 w-3.5 text-emerald-400" />
          <span class="font-semibold">{pluginsStore.activeMcpsCount} {pluginsStore.activeMcpsCount === 1 ? 'MCP' : 'MCPs'}</span>
        </button>
      {/if}

      {#if pluginsStore.skills.length > 0}
        <button 
          type="button"
          onclick={() => togglePopover("skills")}
          title="Click to view {pluginsStore.activeSkillsCount} Active Specialized Skills ({pluginsStore.skills.length} registered)"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-[11px] {activePopover === 'skills' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.25)]' : 'bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/15'}"
        >
          <Zap class="h-3.5 w-3.5 text-violet-400" />
          <span class="font-semibold">{pluginsStore.activeSkillsCount} {pluginsStore.activeSkillsCount === 1 ? 'Skill' : 'Skills'}</span>
        </button>
      {/if}

      {#if tasksStore.totalCount > 0 || tasksStore.isRunningAny}
        <button 
          type="button"
          onclick={() => togglePopover("tasks")}
          title="Click to view {tasksStore.totalCount} Scheduled Background Automations"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-[11px] {activePopover === 'tasks' ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.25)]' : 'bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/15'}"
        >
          <Clock class="h-3.5 w-3.5 text-sky-400" />
          <span class="font-semibold">{tasksStore.activeCount}/{tasksStore.totalCount} {tasksStore.totalCount === 1 ? 'Task' : 'Tasks'}</span>
          {#if tasksStore.isRunningAny}
            <span class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" title="Running task..."></span>
          {/if}
        </button>
      {/if}

      {#if updaterStore.status === "available" || updaterStore.status === "downloaded" || updaterStore.status === "downloading"}
        <button
          type="button"
          onclick={() => {
            if (updaterStore.status === "downloaded") {
              updaterStore.relaunch();
            } else if (updaterStore.status === "available") {
              updaterStore.startDownloadAndInstall();
            }
          }}
          title={updaterStore.status === 'downloaded' ? 'Update downloaded! Click to restart' : updaterStore.status === 'downloading' ? `Downloading update (${updaterStore.downloadProgress}%)...` : `New version v${updaterStore.availableVersion} available! Click to update`}
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-[11px] bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse"
        >
          {#if updaterStore.status === "downloading"}
            <RefreshCw class="h-3.5 w-3.5 text-emerald-400 animate-spin" />
            <span class="font-semibold">{updaterStore.downloadProgress}%</span>
          {:else if updaterStore.status === "downloaded"}
            <CheckCircle2 class="h-3.5 w-3.5 text-emerald-400" />
            <span class="font-semibold">Restart</span>
          {:else}
            <ArrowDownCircle class="h-3.5 w-3.5 text-emerald-400" />
            <span class="font-semibold">Download v{updaterStore.availableVersion}</span>
          {/if}
        </button>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={() => onOpenSettings("ai")}
        title="Provider: {aiStore.provider.toUpperCase()} • Model: {aiStore.currentModelInfo?.name || aiStore.model}. Click to configure."
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-[11px]  {aiStore.isConfigured
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20'
          : 'bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/20 animate-pulse'}"
      >
        <Bot class="w-3.5 h-3.5 {aiStore.isConfigured ? 'text-amber-400' : 'text-rose-400'}" />
        <span class="font-semibold">{aiStore.currentModelInfo?.name || aiStore.model}</span>
      </button>

      <button 
        type="button"
        onclick={() => onOpenSettings("ai")}
        title="Open Settings (AI Providers, Models, MCPs, Skills)"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] transition-colors cursor-pointer"
      >
        <Settings class="w-4 h-4" />
      </button>

      <button
        type="button"
        onclick={handleSend}
        disabled={!inputVal.trim() && !disabled}
        class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-40 cursor-pointer"
      >
        <ArrowUp class="h-4 w-4 stroke-[2.6]" />
      </button>
    </div>
  </div>

  {#if isSlashCommandActive && matchingSkills.length > 0}
    <div
      class="absolute left-3 right-3 top-[102%] z-50 rounded-2xl border border-violet-500/35 bg-[#1c1c1c]/98 p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl space-y-1.5 animate-fade-in text-xs select-none"
    >
      <div class="flex items-center justify-between px-2 py-1 border-b border-white/[0.08] text-[11px] text-zinc-400">
        <span class="flex items-center gap-1.5 text-violet-300 font-semibold">
          <Zap class="w-3.5 h-3.5 text-violet-400" />
          Trigger Analytical Skill ({matchingSkills.length})
        </span>
        <span class="text-[10px] text-zinc-500 font-sans">
          Navigate with ↑↓ • Enter or Tab to select
        </span>
      </div>

      <div class="max-h-60 overflow-y-auto space-y-1 p-1">
        {#each matchingSkills as skill, idx}
          {@const slug = getSkillSlug(skill)}
          <div
            role="button"
            tabindex="0"
            onclick={() => selectSkill(skill)}
            onmouseenter={() => (selectedSlashIndex = idx)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") selectSkill(skill);
            }}
            class="flex items-start justify-between p-2.5 rounded-xl transition-all cursor-pointer {selectedSlashIndex === idx
              ? 'bg-violet-500/20 border border-violet-500/40 text-violet-100 shadow-sm'
              : 'hover:bg-white/[0.05] border border-transparent text-zinc-300'}"
          >
            <div class="space-y-0.5 min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-md text-[11px] font-bold {selectedSlashIndex === idx ? 'bg-violet-500 text-white shadow-sm' : 'bg-white/[0.08] text-violet-300'}">
                  /{slug}
                </span>
                <span class="font-semibold text-xs text-zinc-200 truncate">{skill.name}</span>
                {#if skill.mcpDependency}
                  <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                    {skill.mcpDependency}
                  </span>
                {/if}
              </div>
              <p class="text-[11px] text-zinc-400 font-sans truncate pl-0.5">
                {skill.description}
              </p>
            </div>
            {#if selectedSlashIndex === idx}
              <span class="text-[10px] text-violet-400 font-sans self-center pl-2 shrink-0">
                ↵ Enter
              </span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if activePopover === "mcp" && pluginsStore.activeMcpsCount > 0}
    <div class="absolute left-4 top-[102%] z-50 w-72 rounded-xl border border-white/[0.12] bg-[#1c1c1c]/95 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-2xl space-y-2 animate-fade-in">
      <div class="flex items-center justify-between pb-1.5 border-b border-white/[0.08] text-[11px] text-zinc-300">
        <span class="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <Server class="w-3.5 h-3.5" /> Active MCP Servers ({pluginsStore.activeMcpsCount})
        </span>
        <button type="button" onclick={() => activePopover = 'none'} class="text-zinc-500 hover:text-zinc-200 cursor-pointer">
          <X class="h-3 w-3" />
        </button>
      </div>
      <div class="space-y-1.5 text-[11px]">
        {#each pluginsStore.activeMcps as mcp}
          <div class="p-1.5 rounded-lg bg-[#282828]/50 border border-white/[0.04] space-y-0.5">
            <div class="flex items-center justify-between text-zinc-200 font-semibold">
              <span>{mcp.name}</span>
              <span class="flex items-center gap-1 text-[9px] text-emerald-400 font-normal">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> active
              </span>
            </div>
            <p class="text-[10px] text-zinc-400 font-sans leading-tight">{mcp.desc}</p>
          </div>
        {/each}
      </div>
      <button
        type="button"
        onclick={() => { activePopover = 'none'; onOpenSettings("mcps"); }}
        class="w-full mt-1 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
      >
        <span>Manage MCP Servers</span>
        <ExternalLink class="w-3 h-3" />
      </button>
    </div>
  {/if}

  {#if activePopover === "skills" && pluginsStore.skills.length > 0}
    <div class="absolute left-24 top-[102%] z-50 w-80 rounded-xl border border-white/[0.12] bg-[#1c1c1c]/95 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-2xl space-y-2 animate-fade-in">
      <div class="flex items-center justify-between pb-1.5 border-b border-white/[0.08] text-[11px] text-zinc-300">
        <span class="flex items-center gap-1.5 text-violet-400 font-semibold">
          <Zap class="w-3.5 h-3.5" /> Registered Skills ({pluginsStore.activeSkillsCount}/{pluginsStore.totalSkillsCount})
        </span>
        <button type="button" onclick={() => activePopover = 'none'} class="text-zinc-500 hover:text-zinc-200 cursor-pointer">
          <X class="h-3 w-3" />
        </button>
      </div>
      <div class="grid grid-cols-1 gap-1 text-[11px] max-h-60 overflow-y-auto">
        {#each pluginsStore.skills as skill}
          {@const slug = getSkillSlug(skill)}
          <div class="p-1.5 rounded-lg bg-[#282828]/50 border border-white/[0.04] flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 truncate">
              <span class="px-1 py-0.2 rounded text-[9px] bg-violet-500/20 text-violet-300 font-bold">/{slug}</span>
              <span class="text-zinc-200 truncate">{skill.name}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              {#if !skill.active}
                <span class="text-[9px] px-1 py-0.2 rounded bg-zinc-700/50 text-zinc-400 font-sans">Inativo</span>
              {/if}
              <span class="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.06] text-violet-300 border border-violet-500/20">{skill.mcpDependency || 'Custom'}</span>
            </div>
          </div>
        {/each}
      </div>
      <button
        type="button"
        onclick={() => { activePopover = 'none'; onOpenSettings("skills"); }}
        class="w-full mt-1 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
      >
        <span>Manage Analytical Skills</span>
        <ExternalLink class="w-3 h-3" />
      </button>
    </div>
  {/if}

  {#if activePopover === "tasks"}
    <div class="absolute left-40 top-[102%] z-50 w-96 rounded-xl border border-white/[0.12] bg-[#1c1c1c]/95 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-2xl space-y-2 animate-fade-in">
      <div class="flex items-center justify-between pb-1.5 border-b border-white/[0.08] text-[11px] text-zinc-300">
        <span class="flex items-center gap-1.5 text-sky-400 font-semibold">
          <Clock class="w-3.5 h-3.5" /> Scheduled Automations ({tasksStore.activeCount}/{tasksStore.totalCount})
        </span>
        <button type="button" onclick={() => activePopover = 'none'} class="text-zinc-500 hover:text-zinc-200 cursor-pointer">
          <X class="h-3 w-3" />
        </button>
      </div>

      {#if tasksStore.tasks.length === 0}
        <div class="py-4 text-center space-y-2 text-[11px] text-zinc-400">
          <p>No scheduled tasks found.</p>
          <button
            type="button"
            onclick={() => { activePopover = 'none'; onOpenSettings("tasks"); }}
            class="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] cursor-pointer"
          >
            + Create New Task
          </button>
        </div>
      {:else}
        <div class="space-y-1.5 max-h-64 overflow-y-auto pr-1 text-[11px]">
          {#each tasksStore.tasks as task}
            <div class="p-2 rounded-lg bg-[#282828]/50 border border-white/[0.04] space-y-1.5">
              <div class="flex items-center justify-between text-zinc-200 font-semibold gap-2">
                <span class="truncate">{task.name}</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] bg-sky-500/15 text-sky-300 border border-sky-500/20 shrink-0">
                  {task.intervalMinutes < 60 ? `${task.intervalMinutes}m` : `${task.intervalMinutes / 60}h`}
                </span>
              </div>
              
              <div class="flex items-center justify-between text-[10px] text-zinc-400 font-sans">
                <span>Last: {task.lastRun ? new Date(task.lastRun).toLocaleTimeString().slice(0, 5) : 'Pending'}</span>
                {#if task.lastStatus === 'running'}
                  <span class="text-amber-400 animate-pulse text-[9px] flex items-center gap-1">
                    <RefreshCw class="w-2.5 h-2.5 animate-spin" /> Running...
                  </span>
                {:else if task.lastStatus === 'success'}
                  <span class="text-emerald-400 text-[9px]">✓ Ok</span>
                {:else if task.lastStatus === 'error'}
                  <span class="text-rose-400 text-[9px]">✗ Error</span>
                {/if}
              </div>

              <div class="flex items-center justify-end gap-1.5 pt-1 border-t border-white/[0.04]">
                {#if task.lastResult}
                  <button
                    type="button"
                    onclick={() => { activePopover = 'none'; tasksStore.openTaskResult(task); }}
                    title="View execution report"
                    class="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[10px] border border-sky-500/25 cursor-pointer transition-colors"
                  >
                    <Eye class="w-2.5 h-2.5" />
                    <span>View Report</span>
                  </button>
                {/if}
                <button
                  type="button"
                  onclick={() => tasksStore.runTaskNow(task.id)}
                  disabled={task.lastStatus === 'running'}
                  title="Run now"
                  class="flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 text-[10px] border border-white/[0.06] cursor-pointer transition-colors disabled:opacity-40"
                >
                  <Play class="w-2.5 h-2.5 text-zinc-400 fill-current" />
                  <span>Run</span>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <button
        type="button"
        onclick={() => { activePopover = 'none'; onOpenSettings("tasks"); }}
        class="w-full mt-1 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
      >
        <span>Full Automations Panel</span>
        <ExternalLink class="w-3 h-3" />
      </button>
    </div>
  {/if}
</div>
