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
    Paperclip,
    UploadCloud,
    FileText,
    FileSpreadsheet,
    FileImage,
    FileCode
  } from "@lucide/svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { pluginsStore, getSkillSlug, type SkillDefinition } from "$lib/services/pluginsState.svelte";
  import { aiStore, geminiStore } from "$lib/services/aiProviderState.svelte";
  import { tasksStore } from "$lib/services/tasksState.svelte";
  import { updaterStore } from "$lib/services/updaterService.svelte";
  import { readFileAsAttachment, getFileIconCategory } from "$lib/services/fileAttachmentService";
  import type { AttachedFile } from "$lib/types";
  import { t } from "$lib/i18n";

  interface Props {
    placeholder?: string;
    onSend?: (text: string, attachments?: AttachedFile[]) => void;
    onOpenSettings?: (tab?: "ai" | "gemini" | "mcps" | "skills" | "tasks") => void;
    disabled?: boolean;
  }

  let {
    placeholder = "Ask anything, search tickers or type / for skills...",
    onSend = () => {},
    onOpenSettings = () => {},
    disabled = false
  }: Props = $props();

  let effectivePlaceholder = $derived(placeholder);

  let inputVal = $state("");
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  let attachedFiles = $state<AttachedFile[]>([]);
  let isDraggingOver = $state(false);

  let selectedSlashIndex = $state(0);
  let dismissSlashMenu = $state(false);

  async function handleFilesSelected(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    try {
      const newAttachments: AttachedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const att = await readFileAsAttachment(file);
        newAttachments.push(att);
      }
      attachedFiles = [...attachedFiles, ...newAttachments];
    } catch (err: any) {
      console.error("[SpotlightBar] Error attaching files:", err);
    }
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      handleFilesSelected(input.files);
      input.value = "";
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDraggingOver = false;
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  }

  function removeAttachedFile(id: string) {
    attachedFiles = attachedFiles.filter(f => f.id !== id);
  }

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
    if ((!trimmed && attachedFiles.length === 0) || disabled) return;
    onSend(trimmed, attachedFiles.length > 0 ? [...attachedFiles] : undefined);
    inputVal = "";
    attachedFiles = [];
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
      if (!disabled) {
        handleSend();
      }
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

  </script>

<div 
  role="presentation"
  data-tauri-drag-region
  onmousedown={handleMouseDown}
  ondragover={(e) => { e.preventDefault(); isDraggingOver = true; }}
  ondragenter={(e) => { e.preventDefault(); isDraggingOver = true; }}
  ondragleave={(e) => { e.preventDefault(); isDraggingOver = false; }}
  ondrop={handleDrop}
  class="relative z-30 w-full rounded-[28px] border transition-[box-shadow,border-color,background-color] duration-200 select-none cursor-grab active:cursor-grabbing {isDraggingOver ? 'border-emerald-500/80 ring-2 ring-emerald-500/40 bg-[#16271e]/98' : 'border-white/[0.14] ring-1 ring-white/[0.06] bg-[#212121]/98'} shadow-[0_2px_10px_rgba(0,0,0,0.35),0_12px_32px_-4px_rgba(0,0,0,0.55),0_24px_50px_-6px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-2xl"
>
  {#if isDraggingOver}
    <div class="absolute inset-0 z-40 rounded-[28px] bg-[#12241a]/95 border-2 border-dashed border-emerald-500/80 backdrop-blur-xl flex flex-col items-center justify-center gap-1.5 text-emerald-300 pointer-events-none animate-fade-in">
      <UploadCloud class="w-7 h-7 text-emerald-400 animate-bounce" />
      <span class="text-xs font-bold tracking-tight">Solte os arquivos para carregar no Spotlight</span>
      <span class="text-[10px] text-emerald-400/80 font-sans">PDF, Planilhas, CSV, Imagens ou Relatórios</span>
    </div>
  {/if}

  {#if attachedFiles.length > 0}
    <div class="px-5 pt-3 pb-0 flex items-center gap-1.5 flex-wrap">
      {#each attachedFiles as file (file.id)}
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.07] border border-white/[0.12] text-xs text-zinc-200 animate-fade-in">
          {#if getFileIconCategory(file.name, file.type) === 'pdf'}
            <FileText class="w-3.5 h-3.5 text-rose-400 shrink-0" />
          {:else if getFileIconCategory(file.name, file.type) === 'spreadsheet'}
            <FileSpreadsheet class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          {:else if getFileIconCategory(file.name, file.type) === 'image'}
            <FileImage class="w-3.5 h-3.5 text-sky-400 shrink-0" />
          {:else}
            <FileCode class="w-3.5 h-3.5 text-amber-400 shrink-0" />
          {/if}
          <span class="font-medium truncate max-w-[140px] text-[11px]">{file.name}</span>
          <span class="text-[10px] text-zinc-400 font-sans">{file.sizeFormatted}</span>
          <button
            type="button"
            onclick={() => removeAttachedFile(file.id)}
            class="text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer ml-0.5"
            title="Remover anexo"
          >
            <X class="w-3 h-3" />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <div data-tauri-drag-region class="px-5 pt-3.5 pb-2 flex items-center">
    <textarea
      bind:this={textareaEl}
      bind:value={inputVal}
      onkeydown={handleKeyDown}
      oninput={handleInput}
      placeholder={effectivePlaceholder}
      rows={1}
      class="w-full bg-transparent text-[15px] sm:text-[16px] font-normal text-zinc-100 placeholder:text-zinc-400 focus:outline-none cursor-text select-text resize-none overflow-y-auto min-h-[44px] max-h-[140px] py-1.5 leading-relaxed break-words whitespace-pre-wrap"
    ></textarea>
  </div>

  <div data-tauri-drag-region class="flex items-center justify-between px-4 pt-1 pb-3">
    <div class="flex items-center gap-2">
      {#if pluginsStore.activeMcpsCount > 0}
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] bg-emerald-500/10 border-emerald-500/20 text-emerald-400 select-none">
          <Server class="h-3.5 w-3.5 text-emerald-400" />
          <span class="font-semibold">{pluginsStore.activeMcpsCount} {pluginsStore.activeMcpsCount === 1 ? 'MCP' : 'MCPs'}</span>
        </div>
      {/if}

      {#if pluginsStore.skills.length > 0}
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] bg-violet-500/10 border-violet-500/20 text-violet-400 select-none">
          <Zap class="h-3.5 w-3.5 text-violet-400" />
          <span class="font-semibold">{pluginsStore.activeSkillsCount} {pluginsStore.activeSkillsCount === 1 ? 'Skill' : 'Skills'}</span>
        </div>
      {/if}

      {#if tasksStore.activeCount > 0 || tasksStore.isRunningAny}
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] bg-sky-500/10 border-sky-500/20 text-sky-400 select-none">
          <Clock class="h-3.5 w-3.5 text-sky-400" />
          <span class="font-semibold">{tasksStore.activeCount} {tasksStore.activeCount === 1 ? 'Task' : 'Tasks'}</span>
          {#if tasksStore.isRunningAny}
            <span class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></span>
          {/if}
        </div>
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
      <div 
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] select-none {aiStore.isConfigured
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          : 'bg-rose-500/10 border-rose-500/20 text-rose-300 animate-pulse'}"
      >
        <Bot class="w-3.5 h-3.5 {aiStore.isConfigured ? 'text-amber-400' : 'text-rose-400'}" />
        <span class="font-semibold">{aiStore.currentModelInfo?.name || aiStore.model}</span>
      </div>

      <button 
        type="button"
        onclick={() => fileInputEl?.click()}
        title="Anexar arquivo para análise (PDF, CSV, Planilhas, Imagens ou TXT)"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] transition-colors cursor-pointer relative"
      >
        <Paperclip class="w-4 h-4" />
        {#if attachedFiles.length > 0}
          <span class="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-emerald-500 text-[9px] font-bold text-white flex items-center justify-center shadow-sm">
            {attachedFiles.length}
          </span>
        {/if}
      </button>

      <input
        bind:this={fileInputEl}
        type="file"
        multiple
        accept=".pdf,.csv,.xlsx,.xls,.tsv,.txt,.json,.md,.yaml,.yml,.png,.jpg,.jpeg,.webp"
        onchange={handleFileInputChange}
        class="hidden"
      />

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
        disabled={(!inputVal.trim() && attachedFiles.length === 0) || disabled}
        title={disabled ? "Aguarde a resposta atual..." : "Enviar mensagem"}
        class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:active:scale-100 cursor-pointer"
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

  </div>
