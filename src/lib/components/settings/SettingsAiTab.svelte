<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import {
    Sparkles,
    Bot,
    Cpu,
    Key,
    ExternalLink,
    Sliders,
    CheckCircle2,
    RefreshCw,
    ChevronDown,
  } from "@lucide/svelte";
  import { aiStore, AI_MODELS } from "$lib/services/aiProviderState.svelte";
  import { toastStore } from "$lib/services/toastService.svelte";
  import { t } from "$lib/i18n";

  let isTestingAi = $state(false);

  async function testAiKey() {
    if (!aiStore.apiKey.trim()) {
      toastStore.warning(t("toasts.keyMissingTitle"), t("toasts.keyMissingDesc"));
      return;
    }
    isTestingAi = true;

    try {
      await invoke("test_ai_connection", {
        provider: aiStore.provider,
        apiKey: aiStore.apiKey.trim(),
        model: aiStore.model,
      });
      aiStore.setValidated(aiStore.provider, true);
      aiStore.save();
      toastStore.success(
        t("toasts.authSuccessTitle"),
        t("toasts.authSuccessDesc", { provider: aiStore.provider.toUpperCase() })
      );
    } catch (e: any) {
      aiStore.setValidated(aiStore.provider, false);
      const msg = String(e || `Failed to authenticate with ${aiStore.provider.toUpperCase()} API.`);
      toastStore.error(t("toasts.authErrorTitle"), msg);
    } finally {
      isTestingAi = false;
    }
  }

  function saveAiSettings() {
    aiStore.save();
    toastStore.success(
      t("toasts.configSavedTitle"),
      t("toasts.configSavedDesc", { provider: aiStore.provider.toUpperCase() })
    );
  }
</script>

<div class="space-y-4">
  <div class="space-y-2">
    <span class="text-xs font-mono text-zinc-300 block font-medium">
      {t("settings.ai.selectProvider")}
    </span>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
      <button
        type="button"
        onclick={() => aiStore.setProvider("gemini")}
        class="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer text-center {aiStore.provider ===
        'gemini'
          ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
          : 'bg-[#1c1a28] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-amber-400" />
          <span class="font-semibold text-[13px]">Google Gemini</span>
        </div>
        {#if aiStore.geminiApiKey}
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{t("settings.ai.configured")}</span>
        {/if}
      </button>

      <button
        type="button"
        onclick={() => aiStore.setProvider("openai")}
        class="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer text-center {aiStore.provider ===
        'openai'
          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
          : 'bg-[#1c1a28] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <div class="flex items-center gap-2">
          <Bot class="w-4 h-4 text-emerald-400" />
          <span class="font-semibold text-[13px]">OpenAI (GPT)</span>
        </div>
        {#if aiStore.openaiApiKey}
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{t("settings.ai.configured")}</span>
        {/if}
      </button>

      <button
        type="button"
        onclick={() => aiStore.setProvider("anthropic")}
        class="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer text-center {aiStore.provider ===
        'anthropic'
          ? 'bg-violet-500/20 border-violet-500/50 text-violet-200 shadow-[0_0_15px_rgba(139,92,246,0.2)]'
          : 'bg-[#1c1a28] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <div class="flex items-center gap-2">
          <Cpu class="w-4 h-4 text-violet-400" />
          <span class="font-semibold text-[13px]">Anthropic (Claude)</span>
        </div>
        {#if aiStore.anthropicApiKey}
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{t("settings.ai.configured")}</span>
        {/if}
      </button>
    </div>
  </div>

  <div class="space-y-2">
    <div
      class="flex items-center justify-between text-xs font-mono text-zinc-300"
    >
      <label for="ai-key" class="flex items-center gap-1.5 font-medium">
        <Key class="w-3.5 h-3.5 text-amber-400" />
        {t("settings.ai.apiKeyLabel")} ({aiStore.provider === "gemini"
          ? "Google AI Studio"
          : aiStore.provider === "openai"
            ? "OpenAI Platform"
            : "Anthropic Console"})
      </label>
      {#if aiStore.provider === "gemini"}
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          class="text-[11px] text-amber-300 hover:underline flex items-center gap-1"
        >
          {t("settings.ai.getApiKey")} <ExternalLink class="w-2.5 h-2.5" />
        </a>
      {:else if aiStore.provider === "openai"}
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          class="text-[11px] text-emerald-300 hover:underline flex items-center gap-1"
        >
          {t("settings.ai.getApiKey")} <ExternalLink class="w-2.5 h-2.5" />
        </a>
      {:else}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          class="text-[11px] text-violet-300 hover:underline flex items-center gap-1"
        >
          {t("settings.ai.getApiKey")} <ExternalLink class="w-2.5 h-2.5" />
        </a>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <input
        id="ai-key"
        type="password"
        value={aiStore.apiKey}
        oninput={(e) =>
          aiStore.setApiKey((e.target as HTMLInputElement).value)}
        placeholder={aiStore.provider === "gemini"
          ? "Paste Google AI Studio Key (e.g. AIzaSy...)"
          : aiStore.provider === "openai"
            ? "Paste OpenAI Key (e.g. sk-proj-...)"
            : "Paste Anthropic Key (e.g. sk-ant-...)"}
        class="flex-1 rounded-xl bg-[#1c1a28] border border-white/[0.12] px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60 font-mono shadow-inner"
      />
      <button
        type="button"
        onclick={testAiKey}
        disabled={isTestingAi || !aiStore.apiKey.trim()}
        class="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-mono font-semibold transition-all cursor-pointer disabled:opacity-40 shrink-0"
        title={t("settings.ai.testConnection")}
      >
        <RefreshCw class="w-3.5 h-3.5 {isTestingAi ? 'animate-spin' : ''}" />
        <span>{isTestingAi ? t("settings.ai.testing") : t("settings.ai.testConnection")}</span>
      </button>
    </div>
  </div>

  <div class="space-y-2">
    <div
      class="flex items-center justify-between text-xs font-mono text-zinc-300"
    >
      <label for="ai-model" class="flex items-center gap-1.5 font-medium">
        <Sliders class="w-3.5 h-3.5 text-emerald-400" />
        {t("settings.ai.modelLabel")}
      </label>
      <span class="text-[10px] font-mono flex items-center gap-1">
        {#if aiStore.isValidated}
          <span class="text-emerald-400 flex items-center gap-1">
            <CheckCircle2 class="w-3 h-3" /> {t("settings.ai.verified")}
          </span>
        {:else if aiStore.apiKey.trim()}
          <span class="text-amber-400 flex items-center gap-1">
            <RefreshCw class="w-2.5 h-2.5" /> {t("settings.ai.unverified")}
          </span>
        {/if}
      </span>
    </div>

    <div class="relative">
      <select
        id="ai-model"
        value={aiStore.model}
        onchange={(e) => {
          aiStore.setModel((e.target as HTMLSelectElement).value);
        }}
        class="w-full appearance-none rounded-xl bg-[#1c1a28] border pl-4 pr-10 py-2.5 text-xs font-mono transition-all shadow-sm border-white/[0.12] hover:border-white/[0.22] text-zinc-100 focus:outline-none focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/20 cursor-pointer"
      >
        {#each AI_MODELS[aiStore.provider] as opt}
          <option value={opt.id} class="bg-[#1c1a28] text-zinc-100 py-1">
            {opt.name} — {opt.description} ({opt.contextWindow}) {opt.supportsReasoning ? '[Reasoning ⚡]' : ''}
          </option>
        {/each}
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400">
        <ChevronDown class="w-4 h-4" />
      </div>
    </div>
  </div>

  <div class="space-y-2 pt-2 border-t border-white/[0.08]">
    <div class="flex items-center justify-between text-xs font-mono text-zinc-300">
      <span class="flex items-center gap-1.5 font-medium">
        <Sliders class="w-3.5 h-3.5 text-amber-400" />
        {t("settings.ai.enforcementLabel")}
      </span>
      <span class="text-[10px] text-zinc-400 font-mono">
        {aiStore.enforcementLevel === "low" ? "LOW (Fast / Synthesis)" : aiStore.enforcementLevel === "high" ? "HIGH (Deep Reasoning & Multi-Factor Audits)" : "MEDIUM (Balanced Fiduciary)"}
      </span>
    </div>

    <div class="grid grid-cols-3 gap-2 font-mono text-xs">
      <button
        type="button"
        onclick={() => aiStore.setEnforcementLevel("low")}
        class="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl border transition-all cursor-pointer {aiStore.enforcementLevel === 'low'
          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
          : 'bg-[#1c1a28] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <span class="font-bold text-[12px]">{t("settings.ai.enforcementLow")}</span>
        <span class="text-[9px] text-zinc-400 font-sans">{t("settings.ai.enforcementLowDesc")}</span>
      </button>

      <button
        type="button"
        onclick={() => aiStore.setEnforcementLevel("medium")}
        class="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl border transition-all cursor-pointer {aiStore.enforcementLevel === 'medium'
          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
          : 'bg-[#1c1a28] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <span class="font-bold text-[12px]">{t("settings.ai.enforcementMedium")}</span>
        <span class="text-[9px] text-zinc-400 font-sans">{t("settings.ai.enforcementMediumDesc")}</span>
      </button>

      <button
        type="button"
        onclick={() => aiStore.setEnforcementLevel("high")}
        class="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl border transition-all cursor-pointer {aiStore.enforcementLevel === 'high'
          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
          : 'bg-[#1c1a28] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <span class="font-bold text-[12px]">{t("settings.ai.enforcementHigh")}</span>
        <span class="text-[9px] text-zinc-400 font-sans">{t("settings.ai.enforcementHighDesc")}</span>
      </button>
    </div>
  </div>

  <div class="flex items-center justify-end pt-2">
    <button
      type="button"
      onclick={saveAiSettings}
      class="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs font-mono transition-all hover:bg-zinc-200 cursor-pointer shadow-md"
    >
      {t("settings.ai.saveSettings")}
    </button>
  </div>
</div>
