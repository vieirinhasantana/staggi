<script lang="ts">
  import { X, CheckCircle2, AlertCircle } from "@lucide/svelte";
  import type { ScheduledTask } from "$lib/types";
  import { renderMarkdown } from "$lib/services/formatMessage";
  import { formatRelativeTime } from "$lib/utils/formatters";
  import { t } from "$lib/i18n";

  interface Props {
    task: ScheduledTask | null;
    onClose: () => void;
  }

  let { task = null, onClose }: Props = $props();
</script>

{#if task}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
  >
    <div
      class="w-full max-w-2xl max-h-[85vh] rounded-3xl bg-[#212121] border border-white/[0.14] shadow-2xl flex flex-col p-6 space-y-4"
    >
      <div
        class="flex items-center justify-between pb-3 border-b border-white/[0.08]"
      >
        <div class="flex items-center gap-3">
          <div
            class="h-8 w-8 rounded-xl {task.lastStatus === 'error'
              ? 'bg-rose-500/20 text-rose-300'
              : 'bg-emerald-500/20 text-emerald-300'} flex items-center justify-center"
          >
            {#if task.lastStatus === "error"}
              <AlertCircle class="w-4 h-4" />
            {:else}
              <CheckCircle2 class="w-4 h-4" />
            {/if}
          </div>
          <div>
            <h4 class="text-sm font-semibold text-zinc-100">
              {t("settings.tasks.resultModalTitle", { name: task.name })}
            </h4>
            <span class="text-[11px] text-zinc-400">
              {t("settings.tasks.executedAt", { time: formatRelativeTime(task.lastRun) })}
            </span>
          </div>
        </div>
        <button
          type="button"
          onclick={onClose}
          aria-label={t("common.close")}
          class="h-7 w-7 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-zinc-100 cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div
        class="flex-1 overflow-y-auto pr-1 text-sm text-zinc-200 leading-relaxed font-normal select-text space-y-2.5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:my-1 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-bold [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-[#181818] [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto"
      >
        {@html renderMarkdown(
          task.lastResult || t("settings.tasks.noResultRecorded")
        )}
      </div>

      <div
        class="flex items-center justify-between pt-3 border-t border-white/[0.08] text-xs"
      >
        <span class="text-zinc-400">
          {t("common.totalExecutions", { count: task.executionCount })}
        </span>
        <button
          type="button"
          onclick={onClose}
          class="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-zinc-200 cursor-pointer"
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  </div>
{/if}
