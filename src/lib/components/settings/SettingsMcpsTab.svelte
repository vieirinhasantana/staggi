<script lang="ts">
  import {
    Plus,
    ChevronDown,
    ExternalLink,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    Key,
    RefreshCw,
    Lock,
  } from "@lucide/svelte";
  import { pluginsStore } from "$lib/services/pluginsState.svelte";
  import { toastStore } from "$lib/services/toastService.svelte";
  import { getQuote } from "$lib/services/yahooFinanceService";
  import type { StockQuote } from "$lib/types";
  import { t } from "$lib/i18n";

  let newMcpName = $state("");
  let newMcpEndpoint = $state("");
  let newMcpTransport = $state<"stdio" | "sse">("stdio");
  let newMcpApiKey = $state("");
  let newMcpAuthHeader = $state("Authorization");

  let mcpTickerTest = $state("PETR4.SA");
  let mcpQuoteResult = $state<StockQuote | null>(null);
  let isTestingMcpYahoo = $state(false);
  let isCreatingMcp = $state(false);

  let testingMcpId = $state<string | null>(null);
  let openAuthMcpId = $state<string | null>(null);
  let tempApiKey = $state<string>("");
  let tempAuthHeader = $state<string>("Authorization");

  async function testMcpYahooQuote() {
    isTestingMcpYahoo = true;
    mcpQuoteResult = null;
    try {
      mcpQuoteResult = await getQuote(mcpTickerTest);
    } catch {
    } finally {
      isTestingMcpYahoo = false;
    }
  }

  async function handleTestMcp(id: string) {
    testingMcpId = id;
    try {
      const res = await pluginsStore.testMcp(id);
      if (res.success) {
        toastStore.success(
          t("settings.mcps.statusConnected"),
          res.message
        );
      } else if (res.status === "auth_error") {
        toastStore.error(
          t("settings.mcps.statusAuthError"),
          res.message
        );
      } else {
        toastStore.warning(
          t("settings.mcps.statusUnreachable"),
          res.message
        );
      }
    } finally {
      testingMcpId = null;
    }
  }

  function handleOpenAuth(mcp: any) {
    if (openAuthMcpId === mcp.id) {
      openAuthMcpId = null;
    } else {
      openAuthMcpId = mcp.id;
      tempApiKey = mcp.apiKey || "";
      tempAuthHeader = mcp.authHeader || "Authorization";
    }
  }

  function handleSaveAuth(id: string) {
    pluginsStore.updateMcp(id, {
      apiKey: tempApiKey.trim() || undefined,
      authHeader: tempAuthHeader.trim() || "Authorization",
    });
    toastStore.success(
      t("settings.mcps.savedAuth"),
      "Authentication settings updated."
    );
    openAuthMcpId = null;
  }

  function handleAddMcp() {
    if (!newMcpName.trim() || !newMcpEndpoint.trim()) return;
    const name = newMcpName.trim();
    pluginsStore.addMcp({
      name,
      type: "Custom MCP Server",
      transport: newMcpTransport,
      endpoint: newMcpEndpoint.trim(),
      active: true,
      desc: "User-registered custom MCP Server",
      apiKey: newMcpApiKey.trim() || undefined,
      authHeader: newMcpAuthHeader.trim() || "Authorization",
    });
    toastStore.success(
      t("toasts.mcpRegisteredTitle"),
      t("toasts.mcpRegisteredDesc", { name })
    );
    newMcpName = "";
    newMcpEndpoint = "";
    newMcpApiKey = "";
    newMcpAuthHeader = "Authorization";
    isCreatingMcp = false;
  }
</script>

<div class="space-y-4">
  {#if !isCreatingMcp}
    <button
      type="button"
      onclick={() => (isCreatingMcp = true)}
      class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-[#232034] to-[#1c1a28] border border-emerald-500/30 hover:border-emerald-500/50 flex items-center justify-between text-left transition-all cursor-pointer group shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div
          class="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform"
        >
          <Plus class="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h5
            class="text-xs font-semibold text-zinc-100 font-mono flex items-center gap-1.5"
          >
            {t("settings.mcps.connectNew")}
          </h5>
          <p class="text-[11px] text-zinc-400 font-sans">
            {t("settings.mcps.connectNewDesc")}
          </p>
        </div>
      </div>
      <span
        class="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-200 text-xs font-mono font-semibold border border-emerald-500/35 group-hover:bg-emerald-500/30 transition-all shrink-0"
      >
        {t("settings.mcps.connectBtn")}
      </span>
    </button>
  {/if}

  {#if isCreatingMcp}
    <div
      class="p-4 rounded-2xl bg-[#1e1c2b]/95 border border-emerald-500/35 shadow-lg space-y-3 animate-fade-in"
    >
      <div
        class="flex items-center justify-between pb-1 border-b border-white/[0.06]"
      >
        <span
          class="text-xs font-mono text-emerald-300 font-semibold flex items-center gap-1.5"
        >
          <Plus class="w-3.5 h-3.5 text-emerald-400" /> {t("settings.mcps.modalTitle")}
        </span>
        <button
          type="button"
          onclick={() => {
            isCreatingMcp = false;
            newMcpName = "";
            newMcpEndpoint = "";
            newMcpApiKey = "";
          }}
          class="text-zinc-400 hover:text-zinc-100 text-xs font-mono cursor-pointer"
        >
          {t("common.cancel")}
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs font-mono">
        <input
          type="text"
          aria-label={t("settings.mcps.serverName")}
          bind:value={newMcpName}
          placeholder={t("settings.mcps.namePlaceholder")}
          class="rounded-xl bg-[#2a273b] border border-white/[0.1] px-3.5 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500/60"
        />
        <div class="relative">
          <select
            aria-label={t("settings.mcps.transportType")}
            bind:value={newMcpTransport}
            class="w-full appearance-none rounded-xl bg-[#2a273b] border border-white/[0.1] hover:border-white/[0.2] pl-3 pr-8 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500/60 font-mono transition-colors cursor-pointer"
          >
            <option value="stdio" class="bg-[#2a273b] text-zinc-100">{t("settings.mcps.transportStdio")}</option>
            <option value="sse" class="bg-[#2a273b] text-zinc-100">{t("settings.mcps.transportSse")}</option>
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400">
            <ChevronDown class="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
      <input
        type="text"
        aria-label={t("settings.mcps.endpointUrl")}
        bind:value={newMcpEndpoint}
        placeholder={t("settings.mcps.endpointPlaceholder")}
        class="w-full rounded-xl bg-[#2a273b] border border-white/[0.1] px-3.5 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/60"
      />

      <div class="space-y-1 pt-1">
        <label for="new-mcp-key" class="text-[11px] text-zinc-300 font-mono flex items-center gap-1.5">
          <Key class="w-3 h-3 text-amber-400" /> {t("settings.mcps.apiKeyLabel")}
        </label>
        <input
          id="new-mcp-key"
          type="password"
          bind:value={newMcpApiKey}
          placeholder={t("settings.mcps.apiKeyPlaceholder")}
          class="w-full rounded-xl bg-[#2a273b] border border-white/[0.1] px-3.5 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/60"
        />
        <p class="text-[10px] text-zinc-400 font-sans">
          {t("settings.mcps.authOptional")}
        </p>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button
          type="button"
          onclick={() => {
            isCreatingMcp = false;
            newMcpName = "";
            newMcpEndpoint = "";
            newMcpApiKey = "";
          }}
          class="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onclick={handleAddMcp}
          disabled={!newMcpName.trim() || !newMcpEndpoint.trim()}
          class="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold transition-all cursor-pointer disabled:opacity-40"
        >
          {t("settings.mcps.registerBtn")}
        </button>
      </div>
    </div>
  {/if}

  <div class="flex items-center justify-between pt-1">
    <h5 class="text-xs font-semibold text-zinc-300 font-mono">
      {t("settings.mcps.installedServers", { count: pluginsStore.mcps.length })}
    </h5>
  </div>

  <div class="space-y-2.5">
    {#each pluginsStore.mcps as mcp}
      <div
        class="p-3.5 rounded-2xl bg-[#1c1a28]/80 border border-white/[0.08] space-y-2.5 text-xs font-mono transition-all"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 min-w-0 flex-wrap">
            <div
              class="h-2 w-2 rounded-full shrink-0 {mcp.active
                ? mcp.lastTestedStatus === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : mcp.lastTestedStatus === 'auth_error'
                    ? 'bg-rose-400'
                    : mcp.lastTestedStatus === 'unreachable'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400/80'
                : 'bg-zinc-600'}"
            ></div>
            <span class="font-bold text-zinc-100 truncate">{mcp.name}</span>
            <span
              class="px-2 py-0.5 rounded text-[10px] bg-white/[0.06] text-zinc-300 border border-white/[0.06] shrink-0"
              >{mcp.type}</span
            >
            {#if mcp.apiKey}
              <span class="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                <Lock class="w-2.5 h-2.5 text-emerald-400" /> Auth
              </span>
            {/if}
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[10px] text-zinc-500 mr-1 hidden sm:inline"
              >{mcp.transport}</span
            >

            <button
              type="button"
              onclick={() => handleTestMcp(mcp.id)}
              disabled={testingMcpId === mcp.id}
              title={t("settings.mcps.testConnection")}
              class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw class="w-2.5 h-2.5 {testingMcpId === mcp.id ? 'animate-spin' : ''}" />
              <span>{testingMcpId === mcp.id ? t("settings.mcps.testing") : t("settings.mcps.testConnection")}</span>
            </button>

            <button
              type="button"
              onclick={() => handleOpenAuth(mcp)}
              title={t("settings.mcps.apiKeyLabel")}
              class="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer {mcp.apiKey ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-white/[0.06] text-zinc-400 border border-white/[0.08] hover:text-zinc-200'}"
            >
              <Key class="w-3 h-3 text-amber-400" />
            </button>

            <button
              type="button"
              onclick={() => pluginsStore.toggleMcp(mcp.id)}
              class="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer {mcp.active
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/[0.06] text-zinc-400 border border-white/[0.06]'}"
            >
              {mcp.active ? t("common.online") : t("common.disabled")}
            </button>

            {#if !mcp.id.startsWith("mcp-yahoo")}
              <button
                type="button"
                onclick={() => pluginsStore.removeMcp(mcp.id)}
                aria-label={`${t("common.delete")} ${mcp.name}`}
                class="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            {/if}
          </div>
        </div>

        {#if openAuthMcpId === mcp.id}
          <div class="mt-2 p-3 rounded-xl bg-[#232034] border border-amber-500/35 space-y-2 animate-fade-in text-xs font-mono">
            <div class="flex items-center justify-between text-zinc-200">
              <span class="font-semibold flex items-center gap-1.5 text-amber-300">
                <Key class="w-3.5 h-3.5 text-amber-400" /> {t("settings.mcps.apiKeyLabel")}
              </span>
              <span class="text-[10px] text-zinc-400">Header: {tempAuthHeader || "Authorization"}</span>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="password"
                bind:value={tempApiKey}
                placeholder={t("settings.mcps.apiKeyPlaceholder")}
                class="flex-1 rounded-lg bg-[#191726] border border-white/[0.12] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-mono"
              />
              <button
                type="button"
                onclick={() => handleSaveAuth(mcp.id)}
                class="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold cursor-pointer transition-colors shrink-0"
              >
                {t("common.save")}
              </button>
            </div>
            <p class="text-[10px] text-zinc-400 font-sans">
              {t("settings.mcps.authOptional")}
            </p>
          </div>
        {/if}

        {#if mcp.lastTestedMessage}
          <div class="flex items-center gap-1.5 text-[10px] font-mono {mcp.lastTestedStatus === 'connected' ? 'text-emerald-400' : mcp.lastTestedStatus === 'auth_error' ? 'text-rose-400' : 'text-amber-400'}">
            {#if mcp.lastTestedStatus === 'connected'}
              <CheckCircle2 class="w-3 h-3 shrink-0" />
            {:else if mcp.lastTestedStatus === 'auth_error'}
              <Key class="w-3 h-3 shrink-0" />
            {:else}
              <AlertTriangle class="w-3 h-3 shrink-0" />
            {/if}
            <span class="truncate">{mcp.lastTestedMessage}</span>
          </div>
        {/if}

        <p
          class="text-[11px] text-zinc-300 font-sans leading-relaxed"
        >
          {mcp.desc}
        </p>

        {#if mcp.id === "mcp-financedatabase"}
          <div class="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[11px] font-mono">
            <div class="flex items-center justify-between text-zinc-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-zinc-400">{t("settings.mcps.coverage")}</span>
                <span class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25 text-[10px]">300k+ Assets</span>
                <span class="px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/25 text-[10px]">Equities & ETFs</span>
                <span class="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25 text-[10px]">Funds & Indices</span>
              </div>
              <a
                href="https://www.jeroenbouma.com/projects/financedatabase/mcp"
                target="_blank"
                class="text-[10px] text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>FinanceDatabase Docs</span>
                <ExternalLink class="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        {/if}

        {#if mcp.id === "mcp-equibles-etf"}
          <div class="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[11px] font-mono">
            <div class="flex items-center justify-between text-zinc-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-zinc-400">{t("settings.mcps.transparency")}</span>
                <span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px]">Holdings</span>
                <span class="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 text-[10px]">Portfolio Weights</span>
                <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[10px]">Overlap Analysis</span>
              </div>
              <a
                href="https://equibles.com/etf-holdings-api"
                target="_blank"
                class="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Equibles ETF API</span>
                <ExternalLink class="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        {/if}

        {#if mcp.id === "mcp-bonds"}
          <div class="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[11px] font-mono">
            <div class="flex items-center justify-between text-zinc-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-zinc-400">{t("settings.mcps.metrics")}</span>
                <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[10px]">Modified Duration</span>
                <span class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25 text-[10px]">YTM</span>
                <span class="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25 text-[10px]">Rating & Convexity</span>
              </div>
              <a
                href="https://mcp.so/servers/bond-mcp-server"
                target="_blank"
                class="text-[10px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Bond MCP Server</span>
                <ExternalLink class="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        {/if}

        {#if mcp.id === "mcp-treasury-yields"}
          <div class="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[11px] font-mono">
            <div class="flex items-center justify-between text-zinc-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-zinc-400">{t("settings.mcps.usCurve")}</span>
                <span class="px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/25 text-[10px]">1M to 30Y</span>
                <span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px]">Spread 10Y-2Y</span>
                <span class="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 text-[10px]">Risk-Free Benchmark</span>
              </div>
              <a
                href="https://treasury-yields-rates-today-mcp.lipmichal.workers.dev"
                target="_blank"
                class="text-[10px] text-teal-400 hover:text-teal-300 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Treasury Yields MCP</span>
                <ExternalLink class="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        {/if}

        {#if mcp.id === "mcp-tickerinside"}
          <div class="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[11px] font-mono">
            <div class="flex items-center justify-between text-zinc-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-zinc-400">{t("settings.mcps.smartMoney")}</span>
                <span class="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25 text-[10px]">SEC Form 4</span>
                <span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px]">Director Purchases</span>
                <span class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25 text-[10px]">Whale Tracking</span>
              </div>
              <a
                href="https://mcpservers.org/pt-BR/servers/tickerinside-com-agent"
                target="_blank"
                class="text-[10px] text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>TickerInside MCP</span>
                <ExternalLink class="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        {/if}

        {#if mcp.id === "mcp-yahoo"}
          <div
            class="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]"
          >
            <span class="text-zinc-400"
              >{t("settings.mcps.testYahoo")}</span
            >
            <div class="flex items-center gap-2">
              <input
                type="text"
                aria-label="Ticker symbol for Yahoo Finance test"
                bind:value={mcpTickerTest}
                class="w-24 px-2 py-1 rounded bg-[#2b273b] border border-white/[0.1] text-zinc-100 uppercase text-center font-mono focus:outline-none"
              />
              <button
                type="button"
                onclick={testMcpYahooQuote}
                disabled={isTestingMcpYahoo}
                class="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 font-mono text-[10px] cursor-pointer"
              >
                {isTestingMcpYahoo ? t("settings.mcps.fetching") : t("settings.mcps.testTicker")}
              </button>
            </div>
          </div>
          {#if mcpQuoteResult}
            <div
              class="mt-1 p-2 rounded-lg bg-[#2b273b]/60 border border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-200"
            >
              <span
                >{mcpQuoteResult.name} ({mcpQuoteResult.symbol})</span
              >
              <span class="font-bold"
                >{mcpQuoteResult.currency}
                {mcpQuoteResult.price.toFixed(2)}</span
              >
              <span
                class={mcpQuoteResult.change >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"}
              >
                {mcpQuoteResult.change >= 0
                  ? "+"
                  : ""}{mcpQuoteResult.changePercent.toFixed(2)}%
              </span>
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
</div>
