<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import {
    Sparkles,
    Bot,
    Cpu,
    Cloud,
    Key,
    ExternalLink,
    Sliders,
    CheckCircle2,
    RefreshCw,
    ChevronDown,
    Shield,
  } from "@lucide/svelte";
  import { aiStore } from "$lib/services/aiProviderState.svelte";
  import { toastStore } from "$lib/services/toastService.svelte";
  import { t } from "$lib/i18n";

  let isTestingAi = $state(false);

  // Temporary local state for Bedrock inputs
  let localBedrockAccessKey = $state(aiStore.bedrockAccessKeyId);
  let localBedrockSecretKey = $state(aiStore.bedrockSecretAccessKey);
  let localBedrockRegion = $state(aiStore.bedrockRegion || "us-east-1");
  let localBedrockSessionToken = $state(aiStore.bedrockSessionToken);

  const AWS_REGIONS = [
    { id: "us-east-1", name: "US East (N. Virginia) — us-east-1" },
    { id: "us-west-2", name: "US West (Oregon) — us-west-2" },
    { id: "sa-east-1", name: "South America (São Paulo) — sa-east-1" },
    { id: "eu-central-1", name: "Europe (Frankfurt) — eu-central-1" },
    { id: "eu-west-1", name: "Europe (Ireland) — eu-west-1" },
    { id: "ap-southeast-1", name: "Asia Pacific (Singapore) — ap-southeast-1" },
    { id: "ap-northeast-1", name: "Asia Pacific (Tokyo) — ap-northeast-1" },
  ];

  onMount(() => {
    if (aiStore.provider === "bedrock" ? aiStore.isConfigured : aiStore.apiKey.trim()) {
      aiStore.fetchLiveModels();
    }
  });

  async function handleFetchLiveModels() {
    if (aiStore.provider === "bedrock" && !aiStore.isConfigured) {
      toastStore.warning(t("toasts.keyMissingTitle"), "Informe o Access Key ID e Secret Access Key da AWS.");
      return;
    }
    if (aiStore.provider !== "bedrock" && !aiStore.apiKey.trim()) {
      toastStore.warning(t("toasts.keyMissingTitle"), t("toasts.keyMissingDesc"));
      return;
    }
    const models = await aiStore.fetchLiveModels();
    toastStore.info(
      t("settings.ai.refreshModels"),
      t("settings.ai.modelsRefreshed", { count: models.length, provider: aiStore.provider.toUpperCase() })
    );
  }

  function syncBedrockInputs() {
    aiStore.setBedrockCredentials(
      localBedrockAccessKey,
      localBedrockSecretKey,
      localBedrockRegion,
      localBedrockSessionToken
    );
  }

  async function testAiKey() {
    if (aiStore.provider === "bedrock") {
      syncBedrockInputs();
      if (!aiStore.bedrockAccessKeyId || !aiStore.bedrockSecretAccessKey) {
        toastStore.warning("Credenciais Incompletas", "Informe o Access Key ID e Secret Access Key da AWS.");
        return;
      }
    } else if (!aiStore.apiKey.trim()) {
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
    } catch (err: any) {
      aiStore.setValidated(aiStore.provider, false);
      const msg = err?.message || String(err || "Authentication failed");
      toastStore.error(t("toasts.authErrorTitle"), msg);
    } finally {
      isTestingAi = false;
    }
  }

  function saveAiSettings() {
    if (aiStore.provider === "bedrock") {
      syncBedrockInputs();
    }
    aiStore.save();
    toastStore.success(
      t("toasts.configSavedTitle"),
      t("toasts.configSavedDesc", { provider: aiStore.provider.toUpperCase() })
    );
  }
</script>

<div class="space-y-6">
  <div class="space-y-2">
    <span class="text-xs font-medium text-zinc-300">
      {t("settings.ai.selectProvider")}
    </span>

    <div class="grid grid-cols-4 gap-2">
      <button
        type="button"
        onclick={() => {
          aiStore.setProvider("gemini");
        }}
        class="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer text-center {aiStore.provider ===
        'gemini'
          ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
          : 'bg-[#232323] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-amber-400" />
          <span class="font-semibold text-[13px]">Gemini</span>
        </div>
        {#if aiStore.geminiApiKey}
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{t("settings.ai.configured")}</span>
        {/if}
      </button>

      <button
        type="button"
        onclick={() => {
          aiStore.setProvider("openai");
        }}
        class="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer text-center {aiStore.provider ===
        'openai'
          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
          : 'bg-[#232323] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <div class="flex items-center gap-2">
          <Bot class="w-4 h-4 text-emerald-400" />
          <span class="font-semibold text-[13px]">OpenAI</span>
        </div>
        {#if aiStore.openaiApiKey}
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{t("settings.ai.configured")}</span>
        {/if}
      </button>

      <button
        type="button"
        onclick={() => {
          aiStore.setProvider("anthropic");
        }}
        class="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer text-center {aiStore.provider ===
        'anthropic'
          ? 'bg-violet-500/20 border-violet-500/50 text-violet-200 shadow-[0_0_15px_rgba(139,92,246,0.2)]'
          : 'bg-[#232323] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <div class="flex items-center gap-2">
          <Cpu class="w-4 h-4 text-violet-400" />
          <span class="font-semibold text-[13px]">Anthropic</span>
        </div>
        {#if aiStore.anthropicApiKey}
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{t("settings.ai.configured")}</span>
        {/if}
      </button>

      <button
        type="button"
        onclick={() => {
          aiStore.setProvider("bedrock");
        }}
        class="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer text-center {aiStore.provider ===
        'bedrock'
          ? 'bg-orange-500/20 border-orange-500/50 text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
          : 'bg-[#232323] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <div class="flex items-center gap-2">
          <Cloud class="w-4 h-4 text-orange-400" />
          <span class="font-semibold text-[13px]">AWS Bedrock</span>
        </div>
        {#if aiStore.bedrockValidated}
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Conectado</span>
        {:else if aiStore.isConfigured}
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">{t("settings.ai.configured")}</span>
        {/if}
      </button>
    </div>
  </div>

  {#if aiStore.provider === "bedrock"}
    <!-- Amazon Bedrock AWS Credentials Panel -->
    <div class="space-y-3.5 p-4 rounded-2xl bg-[#232323]/60 border border-orange-500/20">
      <div class="flex items-center justify-between text-xs text-zinc-300">
        <span class="flex items-center gap-1.5 font-medium text-orange-300">
          <Shield class="w-4 h-4 text-orange-400" />
          Credenciais AWS Identity and Access Management (IAM)
        </span>
        <a
          href="https://console.aws.amazon.com/bedrock/"
          target="_blank"
          class="text-[11px] text-orange-400 hover:underline flex items-center gap-1"
        >
          AWS Bedrock Console <ExternalLink class="w-2.5 h-2.5" />
        </a>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label for="bedrock-access-key" class="text-[11px] text-zinc-400 font-medium">
            AWS Access Key ID *
          </label>
          <input
            id="bedrock-access-key"
            type="text"
            bind:value={localBedrockAccessKey}
            onblur={syncBedrockInputs}
            placeholder="AKIAIOSFODNN7EXAMPLE"
            class="w-full rounded-xl bg-[#1c1c1c] border border-white/[0.12] px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-orange-400/60 font-mono shadow-inner"
          />
        </div>

        <div class="space-y-1">
          <label for="bedrock-secret-key" class="text-[11px] text-zinc-400 font-medium">
            AWS Secret Access Key *
          </label>
          <input
            id="bedrock-secret-key"
            type="password"
            bind:value={localBedrockSecretKey}
            onblur={syncBedrockInputs}
            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            class="w-full rounded-xl bg-[#1c1c1c] border border-white/[0.12] px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-orange-400/60 font-mono shadow-inner"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label for="bedrock-region" class="text-[11px] text-zinc-400 font-medium">
            Região AWS (Region)
          </label>
          <div class="relative">
            <select
              id="bedrock-region"
              bind:value={localBedrockRegion}
              onchange={syncBedrockInputs}
              class="w-full appearance-none rounded-xl bg-[#1c1c1c] border border-white/[0.12] px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-orange-400/60 font-sans cursor-pointer"
            >
              {#each AWS_REGIONS as reg}
                <option value={reg.id} class="bg-[#1c1c1c] text-zinc-100 py-1">
                  {reg.name}
                </option>
              {/each}
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400">
              <ChevronDown class="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <label for="bedrock-session-token" class="text-[11px] text-zinc-400 font-medium">
            AWS Session Token (Opcional — caso use STS / SSO)
          </label>
          <input
            id="bedrock-session-token"
            type="password"
            bind:value={localBedrockSessionToken}
            onblur={syncBedrockInputs}
            placeholder="Opcional para credenciais temporárias"
            class="w-full rounded-xl bg-[#1c1c1c] border border-white/[0.08] px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-orange-400/40 shadow-inner"
          />
        </div>
      </div>

      <div class="flex items-center justify-between pt-1">
        <span class="text-[10px] text-zinc-500">
          Autenticação criptográfica SigV4 direta no client Tauri sem envio para terceiros.
        </span>
        <button
          type="button"
          onclick={testAiKey}
          disabled={isTestingAi || !localBedrockAccessKey.trim() || !localBedrockSecretKey.trim()}
          class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/40 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 shrink-0"
          title={t("settings.ai.testConnection")}
        >
          <RefreshCw class="w-3.5 h-3.5 {isTestingAi ? 'animate-spin' : ''}" />
          <span>{isTestingAi ? "Validando SigV4..." : "Testar Conexão AWS"}</span>
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-2">
      <div
        class="flex items-center justify-between text-xs text-zinc-300"
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
          class="flex-1 rounded-xl bg-[#232323] border border-white/[0.12] px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60 shadow-inner"
        />
        <button
          type="button"
          onclick={testAiKey}
          disabled={isTestingAi || !aiStore.apiKey.trim()}
          class="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 shrink-0"
          title={t("settings.ai.testConnection")}
        >
          <RefreshCw class="w-3.5 h-3.5 {isTestingAi ? 'animate-spin' : ''}" />
          <span>{isTestingAi ? t("settings.ai.testing") : t("settings.ai.testConnection")}</span>
        </button>
      </div>
    </div>
  {/if}

  <div class="space-y-2">
    <div
      class="flex items-center justify-between text-xs text-zinc-300"
    >
      <div class="flex items-center gap-2">
        <label for="ai-model" class="flex items-center gap-1.5 font-medium">
          <Sliders class="w-3.5 h-3.5 text-emerald-400" />
          {t("settings.ai.modelLabel")}
        </label>
        <button
          type="button"
          onclick={handleFetchLiveModels}
          disabled={aiStore.isFetchingModels || (aiStore.provider === "bedrock" ? !aiStore.isConfigured : !aiStore.apiKey.trim())}
          class="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 hover:underline transition-colors disabled:opacity-40 cursor-pointer ml-1"
          title={t("settings.ai.refreshModels")}
        >
          <RefreshCw class="w-2.5 h-2.5 {aiStore.isFetchingModels ? 'animate-spin text-sky-300' : ''}" />
          <span>{aiStore.isFetchingModels ? t("settings.ai.refreshingModels") : t("settings.ai.refreshModels")}</span>
        </button>
      </div>

      <span class="text-[10px] flex items-center gap-1">
        {#if aiStore.isValidated}
          <span class="text-emerald-400 flex items-center gap-1">
            <CheckCircle2 class="w-3 h-3" /> {t("settings.ai.verified")}
          </span>
        {:else if (aiStore.provider === 'bedrock' ? aiStore.isConfigured : aiStore.apiKey.trim())}
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
        class="w-full appearance-none rounded-xl bg-[#232323] border pl-4 pr-10 py-2.5 text-xs transition-all shadow-sm border-white/[0.12] hover:border-white/[0.22] text-zinc-100 focus:outline-none focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/20 cursor-pointer"
      >
        {#each aiStore.availableModelOptions as opt}
          <option value={opt.id} class="bg-[#232323] text-zinc-100 py-1">
            {opt.name}{opt.description ? ` — ${opt.description}` : ''}
          </option>
        {/each}
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400">
        <ChevronDown class="w-4 h-4" />
      </div>
    </div>
  </div>

  <div class="space-y-2 pt-2 border-t border-white/[0.08]">
    <div class="flex items-center justify-between text-xs text-zinc-300">
      <span class="flex items-center gap-1.5 font-medium">
        <Sliders class="w-3.5 h-3.5 text-amber-400" />
        {t("settings.ai.enforcementLabel")}
      </span>
      <span class="text-[10px] text-zinc-400">
        {aiStore.enforcementLevel === "low" ? "LOW (Fast / Synthesis)" : aiStore.enforcementLevel === "high" ? "HIGH (Deep Reasoning & Multi-Factor Audits)" : "MEDIUM (Balanced Fiduciary)"}
      </span>
    </div>

    <div class="grid grid-cols-3 gap-2 text-xs">
      <button
        type="button"
        onclick={() => aiStore.setEnforcementLevel("low")}
        class="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl border transition-all cursor-pointer {aiStore.enforcementLevel === 'low'
          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
          : 'bg-[#232323] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <span class="font-bold text-[12px]">{t("settings.ai.enforcementLow")}</span>
        <span class="text-[9px] text-zinc-400 font-sans">{t("settings.ai.enforcementLowDesc")}</span>
      </button>

      <button
        type="button"
        onclick={() => aiStore.setEnforcementLevel("medium")}
        class="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl border transition-all cursor-pointer {aiStore.enforcementLevel === 'medium'
          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
          : 'bg-[#232323] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
      >
        <span class="font-bold text-[12px]">{t("settings.ai.enforcementMedium")}</span>
        <span class="text-[9px] text-zinc-400 font-sans">{t("settings.ai.enforcementMediumDesc")}</span>
      </button>

      <button
        type="button"
        onclick={() => aiStore.setEnforcementLevel("high")}
        class="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl border transition-all cursor-pointer {aiStore.enforcementLevel === 'high'
          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
          : 'bg-[#232323] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}"
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
      class="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs transition-all hover:bg-zinc-200 cursor-pointer shadow-md"
    >
      {t("settings.ai.saveSettings")}
    </button>
  </div>
</div>
