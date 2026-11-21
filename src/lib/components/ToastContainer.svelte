<script lang="ts">
  import { toastStore } from "$lib/services/toastService.svelte";
  import {
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Info,
    X,
  } from "@lucide/svelte";
</script>

{#if toastStore.toasts.length > 0}
  <aside
    aria-label="Notificações do sistema"
    class="fixed top-5 right-5 z-[9999] pointer-events-none flex flex-col gap-2.5 max-w-sm w-full select-none"
  >
    {#each toastStore.toasts as toast (toast.id)}
      <div
        class="pointer-events-auto rounded-2xl p-4 shadow-2xl backdrop-blur-xl border flex items-start gap-3 transition-all duration-300 animate-slide-in-right {toast.type ===
        'success'
          ? 'bg-[#182320]/95 border-emerald-500/40 text-emerald-200 shadow-emerald-950/40'
          : toast.type === 'error'
            ? 'bg-[#261922]/95 border-rose-500/40 text-rose-200 shadow-rose-950/40'
            : toast.type === 'warning'
              ? 'bg-[#262118]/95 border-amber-500/40 text-amber-200 shadow-amber-950/40'
              : 'bg-[#191b2b]/95 border-sky-500/40 text-sky-200 shadow-sky-950/40'}"
      >
        <div class="shrink-0 mt-0.5">
          {#if toast.type === "success"}
            <CheckCircle2 class="w-5 h-5 text-emerald-400" />
          {:else if toast.type === "error"}
            <AlertCircle class="w-5 h-5 text-rose-400" />
          {:else if toast.type === "warning"}
            <AlertTriangle class="w-5 h-5 text-amber-400" />
          {:else}
            <Info class="w-5 h-5 text-sky-400" />
          {/if}
        </div>

        <div class="flex-1 min-w-0 pr-1">
          <h5 class="text-xs font-semibold font-mono tracking-tight text-zinc-100">
            {toast.title}
          </h5>
          {#if toast.message}
            <p class="text-[11px] font-sans leading-relaxed text-zinc-300 mt-0.5 break-words">
              {toast.message}
            </p>
          {/if}
        </div>

        <button
          type="button"
          onclick={() => toastStore.dismiss(toast.id)}
          aria-label="Fechar notificação"
          class="shrink-0 text-zinc-400 hover:text-zinc-100 p-1 rounded-lg hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    {/each}
  </aside>
{/if}

<style>
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(20px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  :global(.animate-slide-in-right) {
    animation: slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
</style>
