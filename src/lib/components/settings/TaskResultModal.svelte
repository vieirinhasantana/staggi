<script lang="ts">
  import {
    X,
    CheckCircle2,
    AlertCircle,
    Mail,
    Send,
    Eye,
    FileText,
    Copy,
    Check,
  } from "@lucide/svelte";
  import type { ScheduledTask } from "$lib/types";
  import { renderMarkdown } from "$lib/services/formatMessage";
  import { formatRelativeTime } from "$lib/utils/formatters";
  import { automationEmailStore } from "$lib/services/automationEmailService";
  import { toastStore } from "$lib/services/toastService.svelte";
  import { t } from "$lib/i18n";

  interface Props {
    task: ScheduledTask | null;
    onClose: () => void;
  }

  let { task = null, onClose }: Props = $props();

  let viewMode = $state<"markdown" | "email">("markdown");
  let isSendingEmail = $state(false);
  let hasCopied = $state(false);

  let emailRecipient = $derived(
    task?.emailRecipient || automationEmailStore.config.defaultRecipient || "advisory@staggi.com.br"
  );

  let emailHtmlPreview = $derived.by(() => {
    if (!task) return "";
    return automationEmailStore.generateHtml(
      task,
      task.lastResult || "Nenhum resultado registrado.",
      emailRecipient
    );
  });

  async function handleSendEmail() {
    if (!task || !task.lastResult) {
      toastStore.warning("Sem Resultado", "Esta rotina ainda não possui resultado para envio.");
      return;
    }

    isSendingEmail = true;
    try {
      const res = await automationEmailStore.dispatchAutomationEmail(task, task.lastResult, {
        overrideRecipient: emailRecipient,
      });

      if (res.success) {
        toastStore.success(
          "Relatório Disparado",
          `E-mail formatado (${res.status === 'sent' ? 'via MCP' : 'modo simulado'}) para ${res.recipient}.`
        );
      } else {
        toastStore.error("Falha no Envio", res.error || "Não foi possível disparar o e-mail.");
      }
    } catch (e: any) {
      toastStore.error("Erro no Envio", e?.message || "Falha inesperada ao disparar o e-mail.");
    } finally {
      isSendingEmail = false;
    }
  }

  function handleCopyContent() {
    if (!task?.lastResult) return;
    navigator.clipboard.writeText(task.lastResult);
    hasCopied = true;
    toastStore.info("Copiado", "Conteúdo do relatório copiado para a área de transferência.");
    setTimeout(() => {
      hasCopied = false;
    }, 2000);
  }
</script>

{#if task}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
  >
    <div
      class="w-full max-w-3xl max-h-[88vh] rounded-3xl bg-[#212121] border border-white/[0.14] shadow-2xl flex flex-col p-6 space-y-4"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between pb-3 border-b border-white/[0.08]"
      >
        <div class="flex items-center gap-3">
          <div
            class="h-9 w-9 rounded-xl {task.lastStatus === 'error'
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
            <h4 class="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              {t("settings.tasks.resultModalTitle", { name: task.name })}
              {#if task.notifyEmail}
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/25 flex items-center gap-1">
                  <Mail class="w-2.5 h-2.5" /> E-mail Ativo
                </span>
              {/if}
            </h4>
            <span class="text-[11px] text-zinc-400">
              {t("settings.tasks.executedAt", { time: formatRelativeTime(task.lastRun) })}
              {#if task.lastEmailStatus}
                • Último disparo: <span class="text-sky-300 uppercase text-[10px]">{task.lastEmailStatus}</span>
              {/if}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- View Mode Toggle -->
          <div class="flex items-center rounded-xl bg-white/[0.04] border border-white/[0.08] p-0.5 text-xs">
            <button
              type="button"
              onclick={() => (viewMode = "markdown")}
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer {viewMode === 'markdown'
                ? 'bg-sky-500/25 text-sky-200 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'}"
            >
              <FileText class="w-3.5 h-3.5" />
              <span>Relatório</span>
            </button>
            <button
              type="button"
              onclick={() => (viewMode = "email")}
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer {viewMode === 'email'
                ? 'bg-sky-500/25 text-sky-200 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'}"
            >
              <Eye class="w-3.5 h-3.5" />
              <span>Template E-mail</span>
            </button>
          </div>

          <button
            type="button"
            onclick={onClose}
            aria-label={t("common.close")}
            class="h-8 w-8 rounded-xl hover:bg-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-zinc-100 cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Body -->
      {#if viewMode === "markdown"}
        <div
          class="flex-1 overflow-y-auto pr-1 text-sm text-zinc-200 leading-relaxed font-normal select-text space-y-2.5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:my-1 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-bold [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-[#181818] [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto"
        >
          {@html renderMarkdown(
            task.lastResult || t("settings.tasks.noResultRecorded")
          )}
        </div>
      {:else}
        <div class="flex-1 overflow-hidden rounded-2xl border border-white/[0.1] bg-white">
          <iframe
            title="Preview do Template de E-mail"
            srcdoc={emailHtmlPreview}
            class="w-full h-full border-none"
          ></iframe>
        </div>
      {/if}

      <!-- Footer -->
      <div
        class="flex items-center justify-between pt-3 border-t border-white/[0.08] text-xs"
      >
        <div class="flex items-center gap-3 text-zinc-400">
          <span>
            {t("common.totalExecutions", { count: task.executionCount })}
          </span>
          <span class="text-zinc-600">•</span>
          <span class="flex items-center gap-1 text-zinc-400">
            <Mail class="w-3.5 h-3.5 text-sky-400" />
            <span>Destinatário: <strong class="text-zinc-300 font-mono text-[11px]">{emailRecipient}</strong></span>
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={handleCopyContent}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 transition-colors cursor-pointer"
          >
            {#if hasCopied}
              <Check class="w-3.5 h-3.5 text-emerald-400" />
              <span>Copiado</span>
            {:else}
              <Copy class="w-3.5 h-3.5" />
              <span>Copiar</span>
            {/if}
          </button>

          <button
            type="button"
            onclick={handleSendEmail}
            disabled={isSendingEmail || !task.lastResult}
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-40"
          >
            <Send class="w-3.5 h-3.5" />
            <span>{isSendingEmail ? "Disparando..." : "Disparar por E-mail"}</span>
          </button>

          <button
            type="button"
            onclick={onClose}
            class="px-4 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-zinc-200 cursor-pointer"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
