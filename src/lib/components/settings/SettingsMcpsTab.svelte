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
    Wrench,
    FileCode,
    Play,
  } from "@lucide/svelte";
  import { pluginsStore } from "$lib/services/pluginsState.svelte";
  import { toastStore } from "$lib/services/toastService.svelte";
  import { t } from "$lib/i18n";

  let newMcpName = $state("");
  let newMcpEndpoint = $state("");
  let newMcpTransport = $state<"stdio" | "sse">("sse");
  let newMcpApiKey = $state("");
  let newMcpAuthHeader = $state("Authorization");
  let createMode = $state<"form" | "json">("form");
  let jsonInput = $state(`{
  "mcpServers": {
    "staggi-portfolio": {
      "url": "http://localhost:8000/sse",
      "headers": {
        "Authorization": "Bearer staggi-secret-api-key-2026"
      }
    }
  }
}`);

  let isCreatingMcp = $state(false);

  let testingMcpId = $state<string | null>(null);
  let openAuthMcpId = $state<string | null>(null);
  let expandedToolsMcpId = $state<string | null>(null);
  let executingToolName = $state<string | null>(null);
  let toolExecutionResult = $state<{ toolName: string; resultText: string } | null>(null);
  let tempApiKey = $state<string>("");
  let tempAuthHeader = $state<string>("Authorization");

  async function handleExecuteTool(mcpId: string, toolName: string) {
    executingToolName = toolName;
    toolExecutionResult = null;
    try {
      const res = await pluginsStore.callTool(mcpId, toolName, {});
      const raw = res?.result?.content || res?.result || res;
      let text = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
      toolExecutionResult = { toolName, resultText: text };
      toastStore.success("Ferramenta Executada", `${toolName} respondeu com sucesso.`);
    } catch (e: any) {
      toastStore.error("Erro na Execução", String(e || "Falha ao executar ferramenta"));
    } finally {
      executingToolName = null;
    }
  }

  async function handleTestMcp(id: string) {
    testingMcpId = id;
    try {
      const res = await pluginsStore.testMcp(id);
      if (res.success) {
        const toolMsg = res.tools && res.tools.length > 0 
          ? ` • ${res.tools.length} ferramentas descobertas` 
          : "";
        toastStore.success(
          t("settings.mcps.statusConnected"),
          `${res.message}${toolMsg}`
        );
        if (res.tools && res.tools.length > 0) {
          expandedToolsMcpId = id;
        }
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
    const cleanKey = tempApiKey.trim().replace(/^Bearer\s+/i, "");
    pluginsStore.updateMcp(id, {
      apiKey: cleanKey || undefined,
      authHeader: tempAuthHeader.trim() || "Authorization",
    });
    toastStore.success(
      t("settings.mcps.savedAuth"),
      "Authentication settings updated."
    );
    openAuthMcpId = null;
    handleTestMcp(id);
  }

  function handleAddMcp() {
    if (!newMcpName.trim() || !newMcpEndpoint.trim()) return;
    const name = newMcpName.trim();
    const cleanKey = newMcpApiKey.trim().replace(/^Bearer\s+/i, "");
    const added = pluginsStore.addMcp({
      name,
      type: "Custom MCP Server",
      transport: newMcpTransport,
      endpoint: newMcpEndpoint.trim(),
      active: true,
      desc: "User-registered custom MCP Server",
      apiKey: cleanKey || undefined,
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
    handleTestMcp(added.id);
  }

  function handleImportJson() {
    if (!jsonInput.trim()) return;
    try {
      const added = pluginsStore.importMcpJson(jsonInput.trim());
      if (added.length > 0) {
        toastStore.success(
          "Configuração MCP Importada",
          `${added.length} servidor(es) registrado(s). Conectando e descobrindo ferramentas...`
        );
        isCreatingMcp = false;
        for (const item of added) {
          handleTestMcp(item.id);
        }
      } else {
        toastStore.error("Erro na importação", "Nenhum servidor válido encontrado no JSON.");
      }
    } catch (e: any) {
      toastStore.error("JSON Inválido", e?.message || "Verifique a sintaxe do JSON.");
    }
  }
</script>

<div class="space-y-4">
  {#if !isCreatingMcp}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <button
        type="button"
        onclick={() => { isCreatingMcp = true; createMode = "form"; }}
        class="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-[#232034] to-[#1c1a28] border border-emerald-500/30 hover:border-emerald-500/50 flex items-center justify-between text-left transition-all cursor-pointer group shadow-sm"
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
              Formulário manual (SSE / stdio)
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onclick={() => { isCreatingMcp = true; createMode = "json"; }}
        class="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-[#232034] to-[#1c1a28] border border-purple-500/30 hover:border-purple-500/50 flex items-center justify-between text-left transition-all cursor-pointer group shadow-sm"
      >
        <div class="flex items-center gap-3">
          <div
            class="h-9 w-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform"
          >
            <FileCode class="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h5
              class="text-xs font-semibold text-zinc-100 font-mono flex items-center gap-1.5"
            >
              Colar JSON (mcpServers)
            </h5>
            <p class="text-[11px] text-zinc-400 font-sans">
              Configuração JSON do Claude / MCP
            </p>
          </div>
        </div>
      </button>
    </div>
  {/if}

  {#if isCreatingMcp}
    <div
      class="p-4 rounded-2xl bg-[#1e1c2b]/95 border border-emerald-500/35 shadow-lg space-y-3 animate-fade-in"
    >
      <div
        class="flex items-center justify-between pb-1 border-b border-white/[0.06]"
      >
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => (createMode = "form")}
            class="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer {createMode === 'form' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            Formulário
          </button>
          <button
            type="button"
            onclick={() => (createMode = "json")}
            class="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer {createMode === 'json' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            Colar JSON (mcpServers)
          </button>
        </div>
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

      {#if createMode === "form"}
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
              <option value="sse" class="bg-[#2a273b] text-zinc-100">{t("settings.mcps.transportSse")}</option>
              <option value="stdio" class="bg-[#2a273b] text-zinc-100">{t("settings.mcps.transportStdio")}</option>
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
          placeholder="http://localhost:8000/sse"
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
            placeholder="Token ou Chave de API (ex: staggi-secret-api-key-2026)"
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
      {:else}
        <div class="space-y-2">
          <p class="text-[11px] text-zinc-300 font-sans">
            Cole a configuração do seu servidor no formato padrão MCP (<code class="text-purple-300">mcpServers</code>):
          </p>
          <textarea
            bind:value={jsonInput}
            rows={7}
            placeholder={`{\n  "mcpServers": {\n    "staggi-portfolio": {\n      "url": "http://localhost:8000/sse",\n      "headers": {\n        "Authorization": "Bearer ..."\n      }\n    }\n  }\n}`}
            class="w-full rounded-xl bg-[#2a273b] border border-white/[0.12] p-3 text-xs text-zinc-100 font-mono focus:outline-none focus:border-purple-400 leading-relaxed custom-scrollbar"
          ></textarea>
          <div class="flex items-center gap-2 pt-1">
            <button
              type="button"
              onclick={() => (isCreatingMcp = false)}
              class="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onclick={handleImportJson}
              disabled={!jsonInput.trim()}
              class="flex-1 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-mono font-semibold transition-all cursor-pointer disabled:opacity-40"
            >
              Importar e Conectar Servidor
            </button>
          </div>
        </div>
      {/if}
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
            {#if mcp.tools && mcp.tools.length > 0}
              <button
                type="button"
                onclick={() => expandedToolsMcpId = expandedToolsMcpId === mcp.id ? null : mcp.id}
                class="px-2 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0 hover:bg-purple-500/25 transition-all cursor-pointer font-mono"
              >
                <Wrench class="w-2.5 h-2.5 text-purple-400" />
                <span>{mcp.tools.length} Tools</span>
                <ChevronDown class="w-2.5 h-2.5 transition-transform {expandedToolsMcpId === mcp.id ? 'rotate-180' : ''}" />
              </button>
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

        {#if expandedToolsMcpId === mcp.id && mcp.tools && mcp.tools.length > 0}
          <div class="mt-2 p-3 rounded-xl bg-[#232034]/95 border border-purple-500/35 space-y-2 animate-fade-in text-xs font-mono">
            <div class="flex items-center justify-between pb-1.5 border-b border-white/[0.08]">
              <span class="font-semibold text-purple-300 flex items-center gap-1.5">
                <Wrench class="w-3.5 h-3.5 text-purple-400" />
                Ferramentas Disponíveis ({mcp.tools.length})
              </span>
              <span class="text-[10px] text-zinc-400 font-sans">Protocolo MCP Ativo</span>
            </div>
            <div class="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {#each mcp.tools as tool}
                <div class="p-2.5 rounded-lg bg-[#191726] border border-white/[0.06] space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-emerald-400 font-mono">{tool.name}</span>
                    <button
                      type="button"
                      onclick={() => handleExecuteTool(mcp.id, tool.name)}
                      disabled={executingToolName === tool.name}
                      class="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono cursor-pointer transition-colors disabled:opacity-40"
                    >
                      <Play class="w-2.5 h-2.5 {executingToolName === tool.name ? 'animate-spin' : ''}" />
                      <span>{executingToolName === tool.name ? 'Executando...' : 'Testar'}</span>
                    </button>
                  </div>
                  {#if tool.description}
                    <p class="text-[11px] text-zinc-300 font-sans whitespace-pre-line leading-relaxed">
                      {tool.description}
                    </p>
                  {/if}
                  {#if toolExecutionResult && toolExecutionResult.toolName === tool.name}
                    <div class="mt-2 p-2.5 rounded bg-black/50 border border-emerald-500/40 text-[10px] text-zinc-200 font-mono space-y-1 animate-fade-in">
                      <div class="flex items-center justify-between text-emerald-300 font-semibold border-b border-white/[0.08] pb-1">
                        <span>Resultado ({tool.name}):</span>
                        <button
                          type="button"
                          onclick={() => (toolExecutionResult = null)}
                          class="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        >✕</button>
                      </div>
                      <pre class="max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed text-zinc-300 custom-scrollbar">{toolExecutionResult.resultText}</pre>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
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
      </div>
    {/each}
  </div>
</div>
