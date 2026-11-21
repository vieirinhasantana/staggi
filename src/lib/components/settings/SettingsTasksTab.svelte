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
  } from "@lucide/svelte";
  import { tasksStore } from "$lib/services/tasksState.svelte";
  import { toastStore } from "$lib/services/toastService.svelte";
  import type { ScheduledTask } from "$lib/types";
  import { formatRelativeTime, formatMinutesLabel } from "$lib/utils/formatters";
  import { t } from "$lib/i18n";

  interface Props {
    onViewResult: (task: ScheduledTask) => void;
  }

  let { onViewResult }: Props = $props();

  let isCreatingTask = $state(false);
  let editingTaskId = $state<string | null>(null);

  let taskFormName = $state("");
  let taskFormDesc = $state("");
  let taskFormPrompt = $state("");
  let taskFormInterval = $state<number>(60);
  let taskFormActive = $state(true);

  function startCreateTask() {
    isCreatingTask = true;
    editingTaskId = null;
    taskFormName = "";
    taskFormDesc = "";
    taskFormPrompt = "";
    taskFormInterval = 60;
    taskFormActive = true;
  }

  function startEditTask(task: ScheduledTask) {
    isCreatingTask = false;
    editingTaskId = task.id;
    taskFormName = task.name;
    taskFormDesc = task.description;
    taskFormPrompt = task.prompt;
    taskFormInterval = task.intervalMinutes;
    taskFormActive = task.active;
  }

  function handleSaveTask() {
    if (!taskFormName.trim() || !taskFormPrompt.trim()) return;
    const name = taskFormName.trim();

    if (isCreatingTask) {
      tasksStore.addTask({
        name,
        description: taskFormDesc.trim() || "Automated scheduled routine",
        prompt: taskFormPrompt.trim(),
        intervalMinutes: Math.max(1, Number(taskFormInterval) || 60),
        active: taskFormActive,
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
    const name = task ? task.name : "Routine";
    toastStore.info(
      t("toasts.taskRunningTitle"),
      t("toasts.taskRunningDesc", { name })
    );
    await tasksStore.runTaskNow(id);
    const updated = tasksStore.tasks.find((t) => t.id === id);
    if (updated && updated.lastResult) {
      toastStore.success(
        t("toasts.taskSuccessTitle"),
        t("toasts.taskSuccessDesc", { name: updated.name })
      );
      onViewResult(updated);
    } else if (updated && updated.lastStatus === "error") {
      toastStore.error(
        t("toasts.taskErrorTitle"),
        updated.lastError || "Error executing automated task."
      );
    }
  }
</script>

<div class="space-y-4">
  {#if !isCreatingTask && !editingTaskId}
    <button
      type="button"
      onclick={startCreateTask}
      class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/15 via-[#232034] to-[#1c1a28] border border-sky-500/30 hover:border-sky-500/50 flex items-center justify-between text-left transition-all cursor-pointer group shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div
          class="h-9 w-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-300 group-hover:scale-105 transition-transform"
        >
          <Plus class="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h5
            class="text-xs font-semibold text-zinc-100 font-mono flex items-center gap-1.5"
          >
            {t("settings.tasks.createNew")}
          </h5>
          <p class="text-[11px] text-zinc-400 font-sans">
            {t("settings.tasks.createNewDesc")}
          </p>
        </div>
      </div>
      <span
        class="px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-200 text-xs font-mono font-semibold border border-sky-500/35 group-hover:bg-sky-500/30 transition-all shrink-0"
      >
        {t("settings.tasks.scheduleBtn")}
      </span>
    </button>
  {/if}

  {#if isCreatingTask || editingTaskId}
    <div
      class="rounded-2xl bg-[#242232] border border-sky-500/30 p-4 space-y-3.5 animate-fade-in"
    >
      <div
        class="flex items-center justify-between pb-2 border-b border-white/[0.08]"
      >
        <span
          class="text-xs font-semibold text-sky-300 font-mono flex items-center gap-1.5"
        >
          <Clock class="w-4 h-4 text-sky-400" />
          {isCreatingTask
            ? t("settings.tasks.modalTitleCreate")
            : t("settings.tasks.modalTitleEdit")}
        </span>
        <button
          type="button"
          onclick={handleCancelTask}
          class="text-zinc-400 hover:text-zinc-100 text-xs font-mono cursor-pointer"
        >
          {t("common.cancel")}
        </button>
      </div>

      <div class="space-y-3 text-xs font-mono">
        <div class="space-y-1">
          <label for="task-name" class="text-zinc-400">{t("settings.tasks.taskNameLabel")}</label>
          <input
            id="task-name"
            type="text"
            bind:value={taskFormName}
            placeholder={t("settings.tasks.taskNamePlaceholder")}
            class="w-full bg-[#181622] border border-white/[0.1] rounded-xl px-3 py-2 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div class="space-y-1">
          <label for="task-desc" class="text-zinc-400">{t("settings.tasks.taskDescLabel")}</label>
          <input
            id="task-desc"
            type="text"
            bind:value={taskFormDesc}
            placeholder={t("settings.tasks.taskDescPlaceholder")}
            class="w-full bg-[#181622] border border-white/[0.1] rounded-xl px-3 py-2 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div class="space-y-1.5">
          <label for="task-interval" class="text-zinc-400">{t("settings.tasks.intervalLabel")}</label>
          <div class="flex items-center gap-1.5 flex-wrap">
            {#each [15, 30, 60, 240, 720, 1440] as preset}
              <button
                type="button"
                onclick={() => (taskFormInterval = preset)}
                class="px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer {taskFormInterval === preset
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
              class="w-24 bg-[#181622] border border-white/[0.1] rounded-lg px-2.5 py-1 text-zinc-100 text-xs font-mono focus:outline-none focus:border-sky-500/50"
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
            class="w-full bg-[#181622] border border-white/[0.1] rounded-xl p-3 text-zinc-100 text-xs font-mono placeholder:text-zinc-500 focus:outline-none focus:border-sky-500/50 resize-y leading-relaxed"
          ></textarea>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input
            id="task-active"
            type="checkbox"
            bind:checked={taskFormActive}
            class="rounded bg-[#181622] border-white/20 text-sky-500 focus:ring-0 cursor-pointer"
          />
          <label for="task-active" class="text-xs text-zinc-300 font-sans cursor-pointer">
            {t("settings.tasks.activateImmediately")}
          </label>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onclick={handleCancelTask}
            class="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onclick={handleSaveTask}
            disabled={!taskFormName.trim() || !taskFormPrompt.trim()}
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-500 text-white font-semibold text-xs font-mono hover:bg-sky-400 transition-all disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <Save class="w-3.5 h-3.5" />
            <span>{isCreatingTask ? t("settings.tasks.saveSchedule") : t("settings.tasks.updateTask")}</span>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <div class="flex items-center justify-between pt-1">
    <h5 class="text-xs font-semibold text-zinc-300 font-mono">
      {t("settings.tasks.scheduledTasks", { count: tasksStore.tasks.length })}
    </h5>
    <span class="text-[10px] text-zinc-400 font-mono">
      {t("settings.tasks.activeTasksCount", { count: tasksStore.activeCount })}
    </span>
  </div>

  <div class="space-y-3.5">
    {#if tasksStore.tasks.length === 0}
      <div
        class="p-8 text-center space-y-3 rounded-2xl bg-[#1d1b2a]/60 border border-white/[0.06]"
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
          onclick={() => (isCreatingTask = true)}
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-md shadow-sky-500/20 transition-all cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{t("settings.tasks.createFirstTask")}</span>
        </button>
      </div>
    {/if}

    {#each tasksStore.tasks as task (task.id)}
      <div
        class="p-4.5 rounded-2xl bg-[#221f33]/90 hover:bg-[#252238] border transition-all space-y-3 {task.active
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
                  >{task.name}</span
                >
                <span
                  class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/[0.06] text-sky-300 border border-sky-500/25"
                >
                  {t("settings.tasks.every", { label: formatMinutesLabel(task.intervalMinutes) })}
                </span>
                {#if task.lastStatus === "running"}
                  <span
                    class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                  >
                    {t("common.running")}
                  </span>
                {:else if task.lastStatus === "success"}
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-400 flex items-center gap-1"
                  >
                    <CheckCircle2 class="w-3 h-3" /> {t("common.success")}
                  </span>
                {:else if task.lastStatus === "error"}
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono text-rose-400 flex items-center gap-1"
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
              class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/35 text-xs font-mono font-medium transition-all cursor-pointer disabled:opacity-40"
              title="Run task immediately"
            >
              <Play class="w-3 h-3" />
              <span>{t("settings.tasks.run")}</span>
            </button>
            <button
              type="button"
              onclick={() => tasksStore.toggleTask(task.id)}
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer {task.active
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/[0.06] text-zinc-500 border border-white/[0.06]'}"
            >
              {task.active ? t("common.active") : t("common.paused")}
            </button>
            <button
              type="button"
              onclick={() => startEditTask(task)}
              class="px-2 py-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] text-xs font-mono cursor-pointer"
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

        <div
          class="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-white/[0.06]"
        >
          <div class="flex items-center gap-3">
            <span>{t("settings.tasks.lastRun", { time: formatRelativeTime(task.lastRun) })}</span>
            {#if task.active && task.nextRun}
              <span class="text-zinc-500">{t("settings.tasks.nextRun", { time: formatRelativeTime(task.nextRun) })}</span>
            {/if}
          </div>
          {#if task.lastResult}
            <button
              type="button"
              onclick={() => onViewResult(task)}
              class="text-sky-400 hover:text-sky-300 text-xs font-mono flex items-center gap-1 cursor-pointer hover:underline"
            >
              <FileText class="w-3 h-3" />
              <span>{t("settings.tasks.viewResult")}</span>
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
