<script lang="ts">
  import {
    Clock,
    Plus,
    Play,
    CheckCircle2,
    AlertCircle,
    Trash2,
    Save,
    FileText,
    Mail,
    Settings,
  } from "@lucide/svelte";
  import { tasksStore } from "$lib/services/tasksState.svelte";
  import { toastStore } from "$lib/services/toastService.svelte";
  import { automationEmailStore } from "$lib/services/automationEmailService.svelte";
  import type { ScheduledTask } from "$lib/types";
  import { formatRelativeTime, formatMinutesLabel } from "$lib/utils/formatters";
  import { t } from "$lib/i18n";

  interface Props {
    onViewResult: (task: ScheduledTask) => void;
  }

  let { onViewResult }: Props = $props();

  let isCreatingTask = $state(false);
  let editingTaskId = $state<string | null>(null);
  let showEmailGlobalSettings = $state(false);

  let taskFormName = $state("");
  let taskFormDesc = $state("");
  let taskFormPrompt = $state("");
  let taskFormInterval = $state<number>(60);
  let taskFormActive = $state(true);
  let taskFormNotifyEmail = $state(true);
  let taskFormEmailRecipient = $state(automationEmailStore.config.defaultRecipient || "advisory@staggi.com.br");
  let taskFormEmailSubject = $state("");

  let globalDefaultRecipient = $state(automationEmailStore.config.defaultRecipient);

  function startCreateTask() {
    isCreatingTask = true;
    editingTaskId = null;
    taskFormName = "";
    taskFormDesc = "";
    taskFormPrompt = "";
    taskFormInterval = 60;
    taskFormActive = true;
    taskFormNotifyEmail = true;
    taskFormEmailRecipient = automationEmailStore.config.defaultRecipient || "advisory@staggi.com.br";
    taskFormEmailSubject = "";
  }

  function startEditTask(task: ScheduledTask) {
    isCreatingTask = false;
    editingTaskId = task.id;
    taskFormName = task.name;
    taskFormDesc = task.description;
    taskFormPrompt = task.prompt;
    taskFormInterval = task.intervalMinutes;
    taskFormActive = task.active;
    taskFormNotifyEmail = true;
    taskFormEmailRecipient = task.emailRecipient || automationEmailStore.config.defaultRecipient || "advisory@staggi.com.br";
    taskFormEmailSubject = task.emailSubject || "";
  }

  function handleSaveTask() {
    if (!taskFormName.trim() || !taskFormPrompt.trim()) return;
    const name = taskFormName.trim();
    const recipient = (taskFormEmailRecipient.trim() || automationEmailStore.config.defaultRecipient || "advisory@staggi.com.br").trim();

    if (isCreatingTask) {
      tasksStore.addTask({
        name,
        description: taskFormDesc.trim() || "Rotina automatizada de inteligência",
        prompt: taskFormPrompt.trim(),
        intervalMinutes: Math.max(1, Number(taskFormInterval) || 60),
        active: taskFormActive,
        notifyEmail: true,
        emailRecipient: recipient,
        emailSubject: taskFormEmailSubject.trim() || undefined,
      });
      toastStore.success(
        t("toasts.taskScheduledTitle"),
        t("toasts.taskScheduledDesc", { name })
      );
    } else if (editingTaskId) {
      tasksStore.updateTask(editingTaskId, {
        name,
        description: taskFormDesc.trim(),
        prompt: taskFormPrompt.trim(),
        intervalMinutes: Math.max(1, Number(taskFormInterval) || 60),
        active: taskFormActive,
        notifyEmail: true,
        emailRecipient: recipient,
        emailSubject: taskFormEmailSubject.trim() || undefined,
      });
      toastStore.success(
        t("toasts.taskUpdatedTitle"),
        t("toasts.taskUpdatedDesc", { name })
      );
    }

    isCreatingTask = false;
    editingTaskId = null;
  }

  function handleCancelTask() {
    isCreatingTask = false;
    editingTaskId = null;
  }

  function handleDeleteTask(id: string) {
    tasksStore.deleteTask(id);
    if (editingTaskId === id) editingTaskId = null;
  }

  async function handleRunTaskNow(id: string) {
    const task = tasksStore.tasks.find((t) => t.id === id);
    const name = task ? task.name : "Rotina";
    toastStore.info(
      "Executando Rotina",
      `Iniciando "${name}" em segundo plano...`
    );
    await tasksStore.runTaskNow(id);
    const updated = tasksStore.tasks.find((t) => t.id === id);
    if (updated && updated.lastResult) {
      onViewResult(updated);
    }
  }
</script>

<div class="space-y-4">
  <!-- Create Button Banner -->
  {#if !isCreatingTask && !editingTaskId}
    <button
      type="button"
      onclick={startCreateTask}
      class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/15 via-[#262626] to-[#232323] border border-sky-500/30 hover:border-sky-500/50 flex items-center justify-between text-left transition-all cursor-pointer group shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div
          class="h-9 w-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-300 group-hover:scale-105 transition-transform"
        >
          <Plus class="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h5
            class="text-xs font-semibold text-zinc-100 flex items-center gap-1.5"
          >
            {t("settings.tasks.createNew")}
          </h5>
          <p class="text-[11px] text-zinc-400 font-sans">
            {t("settings.tasks.createNewDesc")}
          </p>
        </div>
      </div>
      <span
        class="px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-200 text-xs font-semibold border border-sky-500/35 group-hover:bg-sky-500/30 transition-all shrink-0"
      >
        {t("settings.tasks.scheduleBtn")}
      </span>
    </button>
  {/if}

  <!-- Task Form (Create / Edit) -->
  {#if isCreatingTask || editingTaskId}
    <div
      class="rounded-2xl bg-[#262626] border border-sky-500/30 p-4 space-y-3.5 animate-fade-in shadow-lg"
    >
      <div
        class="flex items-center justify-between pb-2 border-b border-white/[0.08]"
      >
        <span
          class="text-xs font-semibold text-sky-300 flex items-center gap-1.5"
        >
          <Clock class="w-4 h-4 text-sky-400" />
          {isCreatingTask
            ? t("settings.tasks.modalTitleCreate")
            : t("settings.tasks.modalTitleEdit")}
        </span>
        <button
          type="button"
          onclick={handleCancelTask}
          class="text-zinc-400 hover:text-zinc-100 text-xs cursor-pointer"
        >
          {t("common.cancel")}
        </button>
      </div>

      <div class="space-y-3 text-xs">
        <div class="space-y-1">
          <label for="task-name" class="text-zinc-400">{t("settings.tasks.taskNameLabel")}</label>
          <input
            id="task-name"
            type="text"
            bind:value={taskFormName}
            placeholder={t("settings.tasks.taskNamePlaceholder")}
            class="w-full bg-[#181818] border border-white/[0.1] rounded-xl px-3 py-2 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div class="space-y-1">
          <label for="task-desc" class="text-zinc-400">{t("settings.tasks.taskDescLabel")}</label>
          <input
            id="task-desc"
            type="text"
            bind:value={taskFormDesc}
            placeholder={t("settings.tasks.taskDescPlaceholder")}
            class="w-full bg-[#181818] border border-white/[0.1] rounded-xl px-3 py-2 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div class="space-y-1.5">
          <label for="task-interval" class="text-zinc-400">{t("settings.tasks.intervalLabel")}</label>
          <div class="flex items-center gap-1.5 flex-wrap">
            {#each [15, 30, 60, 240, 720, 1440] as preset}
              <button
                type="button"
                onclick={() => (taskFormInterval = preset)}
                class="px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer {taskFormInterval === preset
                  ? 'bg-sky-500/30 text-sky-200 border border-sky-500/50 font-semibold'
                  : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]'}"
              >
                {formatMinutesLabel(preset)}
              </button>
            {/each}
          </div>
          <div class="flex items-center gap-2 pt-1">
            <span class="text-[11px] text-zinc-400">{t("settings.tasks.orDefineMinutes")}</span>
            <input
              id="task-interval"
              type="number"
              min="1"
              bind:value={taskFormInterval}
              class="w-24 bg-[#181818] border border-white/[0.1] rounded-lg px-2.5 py-1 text-zinc-100 text-xs focus:outline-none focus:border-sky-500/50"
            />
            <span class="text-[11px] text-zinc-400">{t("settings.tasks.minutes", { label: formatMinutesLabel(taskFormInterval) })}</span>
          </div>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <label for="task-prompt" class="text-zinc-400">{t("settings.tasks.promptLabel")}</label>
            <span class="text-[10px] text-sky-400">{t("settings.tasks.promptHint")}</span>
          </div>
          <textarea
            id="task-prompt"
            rows={4}
            bind:value={taskFormPrompt}
            placeholder={t("settings.tasks.promptPlaceholder")}
            class="w-full bg-[#181818] border border-white/[0.1] rounded-xl p-3 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-sky-500/50 resize-y leading-relaxed"
          ></textarea>
        </div>

        <!-- Automatic Email Dispatch Configuration Section -->
        <div class="p-3.5 rounded-xl bg-[#1d1d1d] border border-sky-500/25 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5 font-medium text-xs text-sky-300">
              <Mail class="w-4 h-4 text-sky-400" />
              Envio Automático do Relatório por E-mail
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-mono">
              Automático a cada execução
            </span>
          </div>

          <p class="text-[11px] text-zinc-400 leading-relaxed font-sans">
            Cada execução desta rotina envia automaticamente o relatório formatado (template institucional) para o e-mail abaixo, sem necessidade de clicar para disparar.
          </p>

          <div class="space-y-2 pt-2 border-t border-white/[0.06]">
            <div class="space-y-1">
              <label for="task-email-recipient" class="text-[10px] text-zinc-400 uppercase font-sans flex items-center justify-between">
                <span>E-mail de Destino *</span>
                <span class="text-sky-400/80 normal-case">Obrigatório pela ferramenta MCP</span>
              </label>
              <input
                id="task-email-recipient"
                type="email"
                required
                bind:value={taskFormEmailRecipient}
                placeholder="Ex: advisory@staggi.com.br"
                class="w-full bg-[#181818] border border-white/[0.1] rounded-xl px-3 py-2 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-sky-500/50 font-mono"
              />
            </div>

            <div class="space-y-1">
              <label for="task-email-subject" class="text-[10px] text-zinc-400 uppercase font-sans">
                Assunto do E-mail (Opcional)
              </label>
              <input
                id="task-email-subject"
                type="text"
                bind:value={taskFormEmailSubject}
                placeholder={`Padrão: Staggi Automation Report: ${taskFormName || 'Nome da Automação'} [SUCCESS]`}
                class="w-full bg-[#181818] border border-white/[0.1] rounded-xl px-3 py-2 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-sky-500/50"
              />
            </div>

            <p class="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-0.5">
              <span class="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0"></span>
              Template institucional formatado com cabeçalho em gradiente, cards de métricas e detalhamento (padrão de Trade Ideas).
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input
            id="task-active"
            type="checkbox"
            bind:checked={taskFormActive}
            class="rounded bg-[#181818] border-white/20 text-sky-500 focus:ring-0 cursor-pointer"
          />
          <label for="task-active" class="text-xs text-zinc-300 font-sans cursor-pointer">
            {t("settings.tasks.activateImmediately")}
          </label>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onclick={handleCancelTask}
            class="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs transition-colors cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onclick={handleSaveTask}
            disabled={!taskFormName.trim() || !taskFormPrompt.trim()}
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-500 text-white font-semibold text-xs hover:bg-sky-400 transition-all disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <Save class="w-3.5 h-3.5" />
            <span>{isCreatingTask ? t("settings.tasks.saveSchedule") : t("settings.tasks.updateTask")}</span>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Header with Global Email Settings Toggle -->
  <div class="flex items-center justify-between pt-1">
    <div class="flex items-center gap-2">
      <h5 class="text-xs font-semibold text-zinc-300">
        {t("settings.tasks.scheduledTasks", { count: tasksStore.tasks.length })}
      </h5>
      <span class="text-[10px] text-zinc-400">
        {t("settings.tasks.activeTasksCount", { count: tasksStore.activeCount })}
      </span>
    </div>

    <button
      type="button"
      onclick={() => (showEmailGlobalSettings = !showEmailGlobalSettings)}
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs transition-all cursor-pointer {showEmailGlobalSettings
        ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40'
        : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 border border-white/[0.06]'}"
    >
      <Mail class="w-3.5 h-3.5 text-sky-400" />
      <span>Configuração de E-mail</span>
    </button>
  </div>

  <!-- Global Email Settings Collapsible -->
  {#if showEmailGlobalSettings}
    <div class="p-4 rounded-2xl bg-[#232323] border border-sky-500/30 space-y-3 text-xs animate-fade-in shadow-md">
      <div class="flex items-center justify-between border-b border-white/[0.08] pb-2 text-sky-300 font-semibold">
        <span class="flex items-center gap-2">
          <Mail class="w-4 h-4 text-sky-400" />
          Configuração de Disparo de E-mail das Automações
        </span>
        <button
          type="button"
          onclick={() => (showEmailGlobalSettings = false)}
          class="text-zinc-400 hover:text-zinc-100 text-xs cursor-pointer"
        >
          Fechar
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label for="global-default-recipient" class="text-[10px] text-zinc-400 uppercase font-sans">E-mail Padrão do Assessor / Mesa</label>
          <input
            id="global-default-recipient"
            type="email"
            bind:value={globalDefaultRecipient}
            placeholder="advisory@staggi.com.br"
            class="w-full bg-[#181818] border border-white/[0.1] rounded-xl px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div class="space-y-1">
          <label for="global-sender-name" class="text-[10px] text-zinc-400 uppercase font-sans">Nome do Remetente Institucional</label>
          <input
            id="global-sender-name"
            type="text"
            value={automationEmailStore.config.senderName}
            oninput={(e) => automationEmailStore.saveConfig({ senderName: (e.target as HTMLInputElement).value })}
            placeholder="Staggi Wealth Management"
            class="w-full bg-[#181818] border border-white/[0.1] rounded-xl px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-sky-500/50"
          />
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-white/[0.06]">
        <div class="text-[11px] text-zinc-400 flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          Disparo automático no padrão institucional de Trade Ideas (gradiente escuro, métricas e tese).
        </div>
        <button
          type="button"
          onclick={() => {
            automationEmailStore.saveConfig({ defaultRecipient: globalDefaultRecipient });
            toastStore.success("Configuração Salva", "E-mail padrão de automações atualizado.");
            showEmailGlobalSettings = false;
          }}
          class="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs cursor-pointer shadow-sm transition-all"
        >
          Salvar Padrão
        </button>
      </div>
    </div>
  {/if}

  <!-- Task List -->
  <div class="space-y-3.5">
    {#if tasksStore.tasks.length === 0}
      <div
        class="p-8 text-center space-y-3 rounded-2xl bg-[#212121]/60 border border-white/[0.06]"
      >
        <div
          class="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-400 mx-auto flex items-center justify-center border border-sky-500/20"
        >
          <Clock class="w-5 h-5" />
        </div>
        <div class="space-y-1">
          <h5 class="text-sm font-semibold text-zinc-200">
            {t("settings.tasks.noTasksTitle")}
          </h5>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">
            {t("settings.tasks.noTasksDesc")}
          </p>
        </div>
        <button
          type="button"
          onclick={startCreateTask}
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-md shadow-sky-500/20 transition-all cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{t("settings.tasks.createFirstTask")}</span>
        </button>
      </div>
    {/if}

    {#each tasksStore.tasks as task (task.id)}
      <div
        class="p-4.5 rounded-2xl bg-[#262626]/90 hover:bg-[#262626] border transition-all space-y-3 {task.active
          ? 'border-white/[0.08] hover:border-sky-500/35 shadow-sm'
          : 'border-white/[0.04] opacity-75'}"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3 min-w-0">
            <div
              class="h-9 w-9 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-300 shrink-0 mt-0.5"
            >
              <Clock class="w-4 h-4 text-sky-400" />
            </div>
            <div class="space-y-1.5 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  class="font-semibold text-zinc-100 text-sm tracking-tight"
                >
                  {task.name}
                </span>
                <span
                  class="px-2 py-0.5 rounded-md text-[10px] bg-white/[0.06] text-sky-300 border border-sky-500/25"
                >
                  {t("settings.tasks.every", { label: formatMinutesLabel(task.intervalMinutes) })}
                </span>
                <span
                  class="px-2 py-0.5 rounded-md text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/25 flex items-center gap-1 font-mono"
                  title={`Envio automático configurado para: ${task.emailRecipient || automationEmailStore.config.defaultRecipient || 'advisory@staggi.com.br'}`}
                >
                  <Mail class="w-2.5 h-2.5" />
                  <span>Envio automático: {task.emailRecipient || automationEmailStore.config.defaultRecipient || 'advisory@staggi.com.br'}</span>
                </span>
                {#if task.lastStatus === "running"}
                  <span
                    class="px-2 py-0.5 rounded-md text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                  >
                    {t("common.running")}
                  </span>
                {:else if task.lastStatus === "success"}
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] text-emerald-400 flex items-center gap-1"
                  >
                    <CheckCircle2 class="w-3 h-3" /> {t("common.success")}
                  </span>
                {:else if task.lastStatus === "error"}
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] text-rose-400 flex items-center gap-1"
                  >
                    <AlertCircle class="w-3 h-3" /> {t("common.failed")}
                  </span>
                {/if}
              </div>
              <p
                class="text-xs text-zinc-300 font-sans leading-relaxed"
              >
                {task.description}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onclick={() => handleRunTaskNow(task.id)}
              disabled={task.lastStatus === "running"}
              class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/35 text-xs font-medium transition-all cursor-pointer disabled:opacity-40"
              title="Run task immediately"
            >
              <Play class="w-3 h-3" />
              <span>{t("settings.tasks.run")}</span>
            </button>
            <button
              type="button"
              onclick={() => tasksStore.toggleTask(task.id)}
              class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer {task.active
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/[0.06] text-zinc-500 border border-white/[0.06]'}"
            >
              {task.active ? t("common.active") : t("common.paused")}
            </button>
            <button
              type="button"
              onclick={() => startEditTask(task)}
              class="px-2 py-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] text-xs cursor-pointer"
            >
              {t("common.edit")}
            </button>
            <button
              type="button"
              onclick={() => handleDeleteTask(task.id)}
              aria-label={`${t("common.delete")} ${task.name}`}
              class="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Task Footer with Last Run, Email Status and Details -->
        <div
          class="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px] text-zinc-400"
        >
          <div class="flex items-center gap-3">
            <span>
              {t("settings.tasks.lastRun")}:{" "}
              <strong class="text-zinc-300 font-sans">{formatRelativeTime(task.lastRun)}</strong>
            </span>
            <span>
              {t("settings.tasks.nextRun")}:{" "}
              <strong class="text-zinc-300 font-sans">{formatRelativeTime(task.nextRun)}</strong>
            </span>
            {#if task.lastEmailStatus}
              <span class="flex items-center gap-1 text-sky-300 font-mono text-[10px]">
                <Mail class="w-3 h-3 text-sky-400" />
                <span>Envio automático: <strong class="uppercase {task.lastEmailStatus === 'sent' ? 'text-emerald-400' : 'text-sky-300'}">{task.lastEmailStatus}</strong></span>
              </span>
            {/if}
          </div>

          {#if task.lastResult}
            <button
              type="button"
              onclick={() => onViewResult(task)}
              class="flex items-center gap-1 text-sky-400 hover:text-sky-300 cursor-pointer font-medium"
            >
              <FileText class="w-3 h-3" />
              <span>Ver Resultado & E-mail</span>
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
