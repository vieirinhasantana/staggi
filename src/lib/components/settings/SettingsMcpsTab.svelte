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
    ShieldCheck,
    Globe,
    Compass,
    LogOut,
    Check,
    ArrowRight,
  } from "@lucide/svelte";
  import { pluginsStore } from "$lib/services/pluginsState.svelte";
  import type { McpServerItem, McpAuthType, McpOAuth2Config } from "$lib/types";
  import { toastStore } from "$lib/services/toastService.svelte";
  import { t } from "$lib/i18n";

  let newMcpName = $state("");
  let newMcpEndpoint = $state("");
  let newMcpTransport = $state<"http" | "stdio" | "sse">("http");
  let newMcpAuthType = $state<McpAuthType>("none");
  let newMcpApiKey = $state("");
  let newMcpAuthHeader = $state("Authorization");

  // New MCP OAuth 2.1 fields
  let newMcpOAuthIssuer = $state("");
  let newMcpOAuthAuthUrl = $state("");
  let newMcpOAuthTokenUrl = $state("");
  let newMcpOAuthClientId = $state("");
  let newMcpOAuthClientSecret = $state("");
  let newMcpOAuthScopes = $state("");
  let newMcpOAuthRedirectUri = $state("http://localhost:18420/oauth/callback");

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
  let toolExecutionResult = $state<{
    toolName: string;
    resultText: string;
  } | null>(null);

  // Active MCP Auth modal state
  let tempAuthType = $state<McpAuthType>("none");
  let tempApiKey = $state<string>("");
  let tempAuthHeader = $state<string>("Authorization");
  let tempOAuthIssuer = $state("");
  let tempOAuthAuthUrl = $state("");
  let tempOAuthTokenUrl = $state("");
  let tempOAuthClientId = $state("");
  let tempOAuthClientSecret = $state("");
  let tempOAuthScopes = $state("offline_access");
  let tempOAuthRedirectUri = $state("http://localhost:18420/oauth/callback");

  let isAuthorizingMcpId = $state<string | null>(null);
  let isRefreshingMcpId = $state<string | null>(null);
  let isDiscoveringAuth = $state(false);
  let showManualOAuthInput = $state(false);
  let manualOAuthCode = $state("");

  async function handleExecuteTool(mcpId: string, toolName: string) {
    executingToolName = toolName;
    toolExecutionResult = null;
    try {
      let args: Record<string, unknown> = {};
      if (toolName === "send_automation_report_email") {
        args = {
          automation_name: "Teste de Diagnóstico de Automação",
          summary:
            "Varredura executada via teste de conexão no painel de configurações.",
          details:
            "Rotina executada com sucesso. Parâmetros operacionais e templates validados.",
          recipient_email: "advisory@staggi.com.br",
          status: "SUCCESS",
        };
      } else if (toolName === "send_portfolio_proposal_email") {
        args = {
          client_id: "STG00000001",
          trade_idea_id: "trade-001",
        };
      } else if (
        toolName === "get_stock_quote" ||
        toolName.includes("quote") ||
        toolName.includes("price")
      ) {
        args = { symbol: "PETR4.SA" };
      }

      const res = await pluginsStore.callTool(mcpId, toolName, args);
      const raw = res?.result?.content || res?.result || res;
      let text = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
      toolExecutionResult = { toolName, resultText: text };
      toastStore.success(
        "Ferramenta Executada",
        `${toolName} respondeu com sucesso.`,
      );
    } catch (e: any) {
      toastStore.error(
        "Erro na Execução",
        String(e || "Falha ao executar ferramenta"),
      );
    } finally {
      executingToolName = null;
    }
  }

  async function handleTestMcp(id: string) {
    testingMcpId = id;
    try {
      const res = await pluginsStore.testMcp(id);
      if (res.success) {
        const toolMsg =
          res.tools && res.tools.length > 0
            ? ` • ${res.tools.length} ferramentas descobertas`
            : "";
        toastStore.success(
          t("settings.mcps.statusConnected"),
          `${res.message}${toolMsg}`,
        );
        if (res.tools && res.tools.length > 0) {
          expandedToolsMcpId = id;
        }
      } else if (res.status === "auth_error") {
        toastStore.error(t("settings.mcps.statusAuthError"), res.message);
      } else {
        toastStore.warning(t("settings.mcps.statusUnreachable"), res.message);
      }
    } finally {
      testingMcpId = null;
    }
  }

  function handleOpenAuth(mcp: McpServerItem) {
    if (openAuthMcpId === mcp.id) {
      openAuthMcpId = null;
    } else {
      openAuthMcpId = mcp.id;
      tempAuthType =
        mcp.authType ||
        (mcp.oauth2 ? "oauth2" : mcp.apiKey ? "api_key" : "none");
      tempApiKey = mcp.apiKey || "";
      tempAuthHeader = mcp.authHeader || "Authorization";

      const o = mcp.oauth2;
      tempOAuthIssuer = o?.issuerUrl || "";
      tempOAuthAuthUrl = o?.authorizationUrl || "";
      tempOAuthTokenUrl = o?.tokenUrl || "";
      tempOAuthClientId = o?.clientId || "";
      tempOAuthClientSecret = o?.clientSecret || "";
      tempOAuthScopes = o?.scopes?.join(" ") || "offline_access";
      tempOAuthRedirectUri =
        o?.redirectUri || "http://localhost:18420/oauth/callback";
      manualOAuthCode = "";
      showManualOAuthInput = false;
    }
  }

  async function handleDiscoverEndpoints(isNew: boolean = false) {
    const issuer = isNew ? newMcpOAuthIssuer.trim() : tempOAuthIssuer.trim();
    if (!issuer) {
      toastStore.warning(
        "Issuer URL Necessária",
        "Informe o domínio base ou URL do provedor OAuth 2.1.",
      );
      return;
    }

    isDiscoveringAuth = true;
    try {
      const res = await pluginsStore.discoverOAuth2Endpoints(issuer);
      if (res.success) {
        if (isNew) {
          if (res.authorization_endpoint)
            newMcpOAuthAuthUrl = res.authorization_endpoint;
          if (res.token_endpoint) newMcpOAuthTokenUrl = res.token_endpoint;
          if (res.scopes_supported && res.scopes_supported.length > 0) {
            newMcpOAuthScopes = res.scopes_supported.join(" ");
          }
        } else {
          if (res.authorization_endpoint)
            tempOAuthAuthUrl = res.authorization_endpoint;
          if (res.token_endpoint) tempOAuthTokenUrl = res.token_endpoint;
          if (res.scopes_supported && res.scopes_supported.length > 0) {
            tempOAuthScopes = res.scopes_supported.join(" ");
          }
        }
        toastStore.success(
          "Endpoints Descobertos (RFC 8414)",
          "Endpoints de Autorização e Token preenchidos automaticamente.",
        );
      } else {
        toastStore.error(
          "Descoberta Falhou",
          res.error || "Não foi possível detectar metadados automaticamente.",
        );
      }
    } catch (e: any) {
      toastStore.error(
        "Erro na Descoberta",
        String(e || "Falha na requisição"),
      );
    } finally {
      isDiscoveringAuth = false;
    }
  }

  function handleSaveAuth(id: string, testAfter: boolean = true) {
    const mcp = pluginsStore.mcps.find((m) => m.id === id);
    if (!mcp) return;

    let oauthConfig: McpOAuth2Config | undefined = undefined;

    if (tempAuthType === "oauth2") {
      oauthConfig = {
        issuerUrl: tempOAuthIssuer.trim() || undefined,
        authorizationUrl: tempOAuthAuthUrl.trim(),
        tokenUrl: tempOAuthTokenUrl.trim(),
        clientId: tempOAuthClientId.trim(),
        clientSecret: tempOAuthClientSecret.trim() || undefined,
        scopes: tempOAuthScopes.trim()
          ? tempOAuthScopes.trim().split(" ")
          : ["offline_access"],
        redirectUri:
          tempOAuthRedirectUri.trim() ||
          "http://localhost:18420/oauth/callback",
        accessToken: mcp.oauth2?.accessToken,
        refreshToken: mcp.oauth2?.refreshToken,
        tokenType: mcp.oauth2?.tokenType || "Bearer",
        expiresAt: mcp.oauth2?.expiresAt,
        scopeGranted: mcp.oauth2?.scopeGranted,
      };
    }

    const cleanKey = tempApiKey.trim().replace(/^Bearer\s+/i, "");

    pluginsStore.updateMcp(id, {
      authType: tempAuthType,
      apiKey: tempAuthType === "api_key" ? cleanKey || undefined : undefined,
      authHeader: tempAuthHeader.trim() || "Authorization",
      oauth2: tempAuthType === "oauth2" ? oauthConfig : undefined,
    });

    if (testAfter) {
      toastStore.success(
        t("settings.mcps.savedAuth"),
        "Configurações de autenticação salvas com sucesso.",
      );
      openAuthMcpId = null;
      handleTestMcp(id);
    }
  }

  async function handleStartOAuthFlow(mcpId: string) {
    isAuthorizingMcpId = mcpId;
    try {
      handleSaveAuth(mcpId, false);
      toastStore.info(
        "Aguardando Autorização OAuth 2.1",
        "O navegador foi aberto com PKCE (S256). Conclua o login na aba do navegador.",
      );
      await pluginsStore.startOAuth2Flow(mcpId);
      toastStore.success(
        "Conectado via OAuth 2.1",
        "Token de acesso obtido e autenticação vinculada com sucesso.",
      );
      openAuthMcpId = null;
    } catch (e: any) {
      toastStore.error(
        "Falha no OAuth 2.1",
        String(e?.message || e || "Erro no fluxo de autorização"),
      );
    } finally {
      isAuthorizingMcpId = null;
    }
  }

  async function handleManualSubmitCode(mcpId: string) {
    if (!manualOAuthCode.trim()) return;
    try {
      await pluginsStore.submitManualOAuth2Code(mcpId, manualOAuthCode.trim());
      toastStore.success(
        "Código Validado",
        "Autenticação OAuth 2.1 finalizada com sucesso.",
      );
      manualOAuthCode = "";
      showManualOAuthInput = false;
      openAuthMcpId = null;
    } catch (e: any) {
      toastStore.error(
        "Código Inválido",
        String(e?.message || e || "Falha ao trocar código"),
      );
    }
  }

  async function handleRefreshOAuth(mcpId: string) {
    isRefreshingMcpId = mcpId;
    try {
      await pluginsStore.refreshOAuth2Token(mcpId);
      toastStore.success(
        "Token Renovado",
        "Novo access token obtido via refresh token.",
      );
    } catch (e: any) {
      toastStore.error(
        "Erro ao Renovar",
        String(e?.message || e || "Falha no refresh"),
      );
    } finally {
      isRefreshingMcpId = null;
    }
  }

  function handleDisconnectOAuth(mcpId: string) {
    pluginsStore.disconnectOAuth2(mcpId);
    toastStore.info("Desconectado", "Credenciais OAuth 2.1 removidas.");
  }

  function handleAddMcp() {
    const endpoint = newMcpEndpoint.trim();
    if (!endpoint) return;

    let name = newMcpName.trim();
    if (!name) {
      try {
        const u = new URL(endpoint.startsWith("http") ? endpoint : `http://${endpoint}`);
        name = u.hostname === "localhost" || u.hostname === "127.0.0.1"
          ? (u.pathname && u.pathname !== "/" ? `mcp-${u.pathname.replace(/^\//, "").replace(/\//g, "-")}` : "mcp-local")
          : `mcp-${u.hostname.split(".")[0]}`;
      } catch {
        name = "mcp-server";
      }
    }

    const cleanKey = newMcpApiKey.trim().replace(/^Bearer\s+/i, "");

    let oauthConfig: McpOAuth2Config | undefined = undefined;
    if (newMcpAuthType === "oauth2") {
      oauthConfig = {
        issuerUrl: newMcpOAuthIssuer.trim() || undefined,
        authorizationUrl: newMcpOAuthAuthUrl.trim() || "",
        tokenUrl: newMcpOAuthTokenUrl.trim() || "",
        clientId: newMcpOAuthClientId.trim() || "",
        clientSecret: newMcpOAuthClientSecret.trim() || undefined,
        scopes: newMcpOAuthScopes.trim()
          ? newMcpOAuthScopes.trim().split(" ")
          : undefined,
        redirectUri:
          newMcpOAuthRedirectUri.trim() ||
          "http://localhost:18420/oauth/callback",
      };
    }

    // Auto-detect transport if not set
    let transport = newMcpTransport;
    if (endpoint.includes("/sse")) {
      transport = "sse";
    } else if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      transport = "http";
    }

    const added = pluginsStore.addMcp({
      name,
      type: "Custom MCP Server",
      transport,
      endpoint,
      active: true,
      desc: "User-registered custom MCP Server",
      authType: newMcpAuthType,
      apiKey: newMcpAuthType === "api_key" ? cleanKey || undefined : undefined,
      authHeader: newMcpAuthHeader.trim() || "Authorization",
      oauth2: oauthConfig,
    });

    const selectedAuthType = newMcpAuthType;

    toastStore.success(
      t("toasts.mcpRegisteredTitle"),
      t("toasts.mcpRegisteredDesc", { name }),
    );

    newMcpName = "";
    newMcpEndpoint = "";
    newMcpApiKey = "";
    newMcpAuthHeader = "Authorization";
    newMcpAuthType = "none";
    newMcpOAuthIssuer = "";
    newMcpOAuthAuthUrl = "";
    newMcpOAuthTokenUrl = "";
    newMcpOAuthClientId = "";
    newMcpOAuthClientSecret = "";
    newMcpOAuthScopes = "";
    isCreatingMcp = false;

    if (selectedAuthType === "oauth2") {
      handleStartOAuthFlow(added.id);
    } else {
      handleTestMcp(added.id);
    }
  }

  function handleImportJson() {
    if (!jsonInput.trim()) return;
    try {
      const added = pluginsStore.importMcpJson(jsonInput.trim());
      if (added.length > 0) {
        toastStore.success(
          "Configuração MCP Importada",
          `${added.length} servidor(es) registrado(s). Conectando e descobrindo ferramentas...`,
        );
        isCreatingMcp = false;
        for (const item of added) {
          handleTestMcp(item.id);
        }
      } else {
        toastStore.error(
          "Erro na importação",
          "Nenhum servidor válido encontrado no JSON.",
        );
      }
    } catch (e: any) {
      toastStore.error(
        "JSON Inválido",
        e?.message || "Verifique a sintaxe do JSON.",
      );
    }
  }

  function formatExpiresAt(expiresAt?: number): string {
    if (!expiresAt) return "Não especificado";
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return "Expirado (renovação automática ativa)";
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 60) return `Expira em ~${diffMin} min`;
    const diffHours = Math.round(diffMin / 60);
    return `Expira em ~${diffHours} h`;
  }
</script>

<div class="space-y-4">
  {#if !isCreatingMcp}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <button
        type="button"
        onclick={() => {
          isCreatingMcp = true;
          createMode = "form";
        }}
        class="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-[#262626] to-[#232323] border border-emerald-500/30 hover:border-emerald-500/50 flex items-center justify-between text-left transition-all cursor-pointer group shadow-sm"
      >
        <div class="flex items-center gap-3">
          <div
            class="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform"
          >
            <Plus class="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h5
              class="text-xs font-semibold text-zinc-100 flex items-center gap-1.5"
            >
              {t("settings.mcps.connectNew")}
            </h5>
            <p class="text-[11px] text-zinc-400 font-sans">
              Formulário manual (SSE / stdio / OAuth 2.1)
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onclick={() => {
          isCreatingMcp = true;
          createMode = "json";
        }}
        class="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-[#262626] to-[#232323] border border-purple-500/30 hover:border-purple-500/50 flex items-center justify-between text-left transition-all cursor-pointer group shadow-sm"
      >
        <div class="flex items-center gap-3">
          <div
            class="h-9 w-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform"
          >
            <FileCode class="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h5
              class="text-xs font-semibold text-zinc-100 flex items-center gap-1.5"
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
      class="p-4 rounded-2xl bg-[#232323]/95 border border-emerald-500/35 shadow-lg space-y-3 animate-fade-in"
    >
      <div
        class="flex items-center justify-between pb-1 border-b border-white/[0.06]"
      >
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => (createMode = "form")}
            class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer {createMode ===
            'form'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-zinc-400 hover:text-zinc-200'}"
          >
            Formulário
          </button>
          <button
            type="button"
            onclick={() => (createMode = "json")}
            class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer {createMode ===
            'json'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-zinc-400 hover:text-zinc-200'}"
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
          class="text-zinc-400 hover:text-zinc-100 text-xs cursor-pointer"
        >
          {t("common.cancel")}
        </button>
      </div>

      {#if createMode === "form"}
        <div class="grid grid-cols-2 gap-2 text-xs">
          <input
            type="text"
            aria-label={t("settings.mcps.serverName")}
            bind:value={newMcpName}
            placeholder={t("settings.mcps.namePlaceholder")}
            class="rounded-xl bg-[#282828] border border-white/[0.1] px-3.5 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500/60"
          />
          <div class="relative">
            <select
              aria-label={t("settings.mcps.transportType")}
              bind:value={newMcpTransport}
              class="w-full appearance-none rounded-xl bg-[#282828] border border-white/[0.1] hover:border-white/[0.2] pl-3 pr-8 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500/60 transition-colors cursor-pointer"
            >
              <option value="http" class="bg-[#282828] text-zinc-100"
                >{t("settings.mcps.transportHttp")}</option
              >
              <option value="sse" class="bg-[#282828] text-zinc-100"
                >{t("settings.mcps.transportSse")}</option
              >
              <option value="stdio" class="bg-[#282828] text-zinc-100"
                >{t("settings.mcps.transportStdio")}</option
              >
            </select>
            <div
              class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400"
            >
              <ChevronDown class="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
        <input
          type="text"
          aria-label={t("settings.mcps.endpointUrl")}
          bind:value={newMcpEndpoint}
          oninput={() => {
            const ep = newMcpEndpoint.trim();
            if (ep.includes("/sse")) {
              newMcpTransport = "sse";
            } else if (ep.startsWith("http://") || ep.startsWith("https://")) {
              newMcpTransport = "http";
            }
          }}
          placeholder="URL do Servidor (ex: http://localhost:8000/mcp ou http://localhost:8000)"
          class="w-full rounded-xl bg-[#282828] border border-white/[0.1] px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60"
        />

        <!-- Authentication Mode Selection -->
        <div class="space-y-1.5 pt-1">
          <label
            class="text-[11px] text-zinc-300 font-semibold flex items-center gap-1.5"
          >
            <Lock class="w-3 h-3 text-emerald-400" /> Método de Autenticação
          </label>
          <div
            class="grid grid-cols-3 gap-1.5 p-1 bg-[#1e1e1e] rounded-xl border border-white/[0.08] text-xs"
          >
            <button
              type="button"
              onclick={() => (newMcpAuthType = "none")}
              class="py-1.5 px-2 rounded-lg font-medium text-center transition-all cursor-pointer {newMcpAuthType ===
              'none'
                ? 'bg-white/[0.12] text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'}"
            >
              Sem Auth
            </button>
            <button
              type="button"
              onclick={() => (newMcpAuthType = "api_key")}
              class="py-1.5 px-2 rounded-lg font-medium text-center transition-all cursor-pointer flex items-center justify-center gap-1 {newMcpAuthType ===
              'api_key'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'}"
            >
              <Key class="w-3 h-3" /> API Key
            </button>
            <button
              type="button"
              onclick={() => (newMcpAuthType = "oauth2")}
              class="py-1.5 px-2 rounded-lg font-medium text-center transition-all cursor-pointer flex items-center justify-center gap-1 {newMcpAuthType ===
              'oauth2'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'}"
            >
              <ShieldCheck class="w-3 h-3 text-sky-400" /> OAuth 2.1
            </button>
          </div>
        </div>

        {#if newMcpAuthType === "api_key"}
          <div class="space-y-1 pt-1 animate-fade-in">
            <label
              for="new-mcp-key"
              class="text-[11px] text-zinc-300 flex items-center gap-1.5"
            >
              <Key class="w-3 h-3 text-amber-400" />
              {t("settings.mcps.apiKeyLabel")}
            </label>
            <input
              id="new-mcp-key"
              type="password"
              bind:value={newMcpApiKey}
              placeholder="Token ou Chave de API (ex: staggi-secret-api-key-2026)"
              class="w-full rounded-xl bg-[#282828] border border-white/[0.1] px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>
        {:else if newMcpAuthType === "oauth2"}
          <div
            class="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-2.5 animate-fade-in text-xs"
          >
            <div class="flex items-center justify-between">
              <span class="font-semibold text-sky-300 flex items-center gap-1.5">
                <ShieldCheck class="w-4 h-4 text-sky-400" /> OAuth 2.1 Automático (Zero Config)
              </span>
              <span class="text-[10px] text-sky-400/80 font-mono">RFC 8414 • RFC 7591 • PKCE S256</span>
            </div>

            <p class="text-[11px] text-zinc-300 leading-relaxed">
              Basta informar a URL do servidor acima. A descoberta de rotas, registro dinâmico do cliente e o fluxo PKCE no navegador acontecem de forma 100% automática ao cadastrar.
            </p>

            <details class="pt-1 text-[11px] text-zinc-400">
              <summary class="cursor-pointer hover:text-zinc-200 select-none flex items-center gap-1">
                <span>Parâmetros avançados (opcional / detecção automática)</span>
              </summary>
              <div class="space-y-2 pt-2.5">
                <div class="flex items-center gap-1.5">
                  <input
                    type="text"
                    bind:value={newMcpOAuthIssuer}
                    placeholder="Issuer / URL Base (opcional)"
                    class="flex-1 rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="button"
                    onclick={() => handleDiscoverEndpoints(true)}
                    disabled={isDiscoveringAuth || (!newMcpOAuthIssuer.trim() && !newMcpEndpoint.trim())}
                    class="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-xs font-semibold cursor-pointer transition-colors shrink-0 disabled:opacity-40 flex items-center gap-1"
                  >
                    <Compass class="w-3 h-3 {isDiscoveringAuth ? 'animate-spin' : ''}" />
                    <span>Detectar</span>
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    bind:value={newMcpOAuthAuthUrl}
                    placeholder="Auth URL (opcional)"
                    class="rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                  />
                  <input
                    type="text"
                    bind:value={newMcpOAuthTokenUrl}
                    placeholder="Token URL (opcional)"
                    class="rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    bind:value={newMcpOAuthClientId}
                    placeholder="Client ID (opcional - auto registro)"
                    class="rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                  />
                  <input
                    type="password"
                    bind:value={newMcpOAuthClientSecret}
                    placeholder="Client Secret (opcional)"
                    class="rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    bind:value={newMcpOAuthScopes}
                    placeholder="Scopes (ex: read write)"
                    class="rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                  />
                  <input
                    type="text"
                    bind:value={newMcpOAuthRedirectUri}
                    placeholder="Redirect URI (padrão: loopback 18420)"
                    class="rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>
            </details>
          </div>
        {/if}

        <div class="flex items-center gap-2 pt-1">
          <button
            type="button"
            onclick={() => {
              isCreatingMcp = false;
              newMcpName = "";
              newMcpEndpoint = "";
              newMcpApiKey = "";
            }}
            class="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs transition-colors cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onclick={handleAddMcp}
            disabled={!newMcpEndpoint.trim()}
            class="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
          >
            {t("settings.mcps.registerBtn")}
          </button>
        </div>
      {:else}
        <div class="space-y-2">
          <p class="text-[11px] text-zinc-300 font-sans">
            Cole a configuração do seu servidor no formato padrão MCP (<code
              class="text-purple-300">mcpServers</code
            >), incluindo opções de <code class="text-sky-300">oauth2</code> se houver:
          </p>
          <textarea
            bind:value={jsonInput}
            rows={7}
            placeholder={`{\n  "mcpServers": {\n    "staggi-portfolio": {\n      "url": "http://localhost:8000/sse",\n      "headers": {\n        "Authorization": "Bearer ..."\n      }\n    }\n  }\n}`}
            class="w-full rounded-xl bg-[#282828] border border-white/[0.12] p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-400 leading-relaxed custom-scrollbar"
          ></textarea>
          <div class="flex items-center gap-2 pt-1">
            <button
              type="button"
              onclick={() => (isCreatingMcp = false)}
              class="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs transition-colors cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onclick={handleImportJson}
              disabled={!jsonInput.trim()}
              class="flex-1 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
            >
              Importar e Conectar Servidor
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <div class="flex items-center justify-between pt-1">
    <h5 class="text-xs font-semibold text-zinc-300">
      {t("settings.mcps.installedServers", { count: pluginsStore.mcps.length })}
    </h5>
  </div>

  <div class="space-y-2.5">
    {#each pluginsStore.mcps as mcp}
      <div
        class="p-3.5 rounded-2xl bg-[#232323]/80 border border-white/[0.08] space-y-2.5 text-xs transition-all"
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

            <!-- Authentication Status Badge -->
            {#if mcp.authType === "oauth2" || mcp.oauth2}
              {#if mcp.oauth2?.accessToken}
                <span
                  class="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0"
                  title="Autenticado via OAuth 2.1"
                >
                  <ShieldCheck class="w-3 h-3 text-emerald-400" /> OAuth 2.1 Ativo
                </span>
              {:else}
                <span
                  class="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0"
                  title="Configuração OAuth 2.1 pendente de conexão"
                >
                  <ShieldCheck class="w-3 h-3 text-amber-400" /> OAuth 2.1 Pendente
                </span>
              {/if}
            {:else if mcp.apiKey}
              <span
                class="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0"
              >
                <Lock class="w-2.5 h-2.5 text-emerald-400" /> API Key
              </span>
            {/if}

            {#if mcp.tools && mcp.tools.length > 0}
              <button
                type="button"
                onclick={() =>
                  (expandedToolsMcpId =
                    expandedToolsMcpId === mcp.id ? null : mcp.id)}
                class="px-2 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0 hover:bg-purple-500/25 transition-all cursor-pointer"
              >
                <Wrench class="w-2.5 h-2.5 text-purple-400" />
                <span>{mcp.tools.length} Tools</span>
                <ChevronDown
                  class="w-2.5 h-2.5 transition-transform {expandedToolsMcpId ===
                  mcp.id
                    ? 'rotate-180'
                    : ''}"
                />
              </button>
            {/if}
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider bg-white/[0.04] text-zinc-400 border border-white/[0.06] mr-1 hidden sm:inline"
              >{mcp.transport === "builtin (Native MCP)" ? "NATIVE" : mcp.transport}</span
            >

            <button
              type="button"
              onclick={() => handleTestMcp(mcp.id)}
              disabled={testingMcpId === mcp.id}
              title={t("settings.mcps.testConnection")}
              class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                class="w-2.5 h-2.5 {testingMcpId === mcp.id
                  ? 'animate-spin'
                  : ''}"
              />
              <span
                >{testingMcpId === mcp.id
                  ? t("settings.mcps.testing")
                  : t("settings.mcps.testConnection")}</span
              >
            </button>

            <button
              type="button"
              onclick={() => handleOpenAuth(mcp)}
              title="Configurar Autenticação (OAuth 2.1 / API Key)"
              class="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer {mcp.authType ===
                'oauth2' || mcp.oauth2
                ? mcp.oauth2?.accessToken
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : mcp.apiKey
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/[0.06] text-zinc-400 border border-white/[0.08] hover:text-zinc-200'}"
            >
              {#if mcp.authType === "oauth2" || mcp.oauth2}
                <ShieldCheck class="w-3 h-3 text-sky-400" />
              {:else}
                <Key class="w-3 h-3 text-amber-400" />
              {/if}
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

        <!-- Authentication Drawer -->
        {#if openAuthMcpId === mcp.id}
          <div
            class="mt-2 p-3.5 rounded-xl bg-[#262626] border border-white/[0.12] space-y-3 animate-fade-in text-xs shadow-lg"
          >
            <div
              class="flex items-center justify-between text-zinc-200 border-b border-white/[0.08] pb-2"
            >
              <span
                class="font-semibold flex items-center gap-1.5 text-zinc-100"
              >
                <Lock class="w-3.5 h-3.5 text-emerald-400" /> Autenticação do Servidor
                ({mcp.name})
              </span>
              <button
                type="button"
                onclick={() => (openAuthMcpId = null)}
                class="text-zinc-400 hover:text-zinc-200 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <!-- Segmented Auth Type Selector -->
            <div
              class="grid grid-cols-3 gap-1.5 p-1 bg-[#1c1c1c] rounded-xl border border-white/[0.08]"
            >
              <button
                type="button"
                onclick={() => (tempAuthType = "none")}
                class="py-1.5 px-2 rounded-lg font-medium text-center transition-all cursor-pointer {tempAuthType ===
                'none'
                  ? 'bg-white/[0.12] text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'}"
              >
                Sem Auth
              </button>
              <button
                type="button"
                onclick={() => (tempAuthType = "api_key")}
                class="py-1.5 px-2 rounded-lg font-medium text-center transition-all cursor-pointer flex items-center justify-center gap-1 {tempAuthType ===
                'api_key'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'}"
              >
                <Key class="w-3 h-3" /> API Key
              </button>
              <button
                type="button"
                onclick={() => (tempAuthType = "oauth2")}
                class="py-1.5 px-2 rounded-lg font-medium text-center transition-all cursor-pointer flex items-center justify-center gap-1 {tempAuthType ===
                'oauth2'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'}"
              >
                <ShieldCheck class="w-3 h-3 text-sky-400" /> OAuth 2.1 (PKCE)
              </button>
            </div>

            {#if tempAuthType === "api_key"}
              <div class="space-y-2 animate-fade-in">
                <div class="flex items-center justify-between text-zinc-300">
                  <span
                    class="text-[11px] font-medium flex items-center gap-1.5 text-amber-300"
                  >
                    <Key class="w-3 h-3 text-amber-400" /> Chave de Acesso / Token
                    Bearer
                  </span>
                  <span class="text-[10px] text-zinc-400"
                    >Header: {tempAuthHeader || "Authorization"}</span
                  >
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="password"
                    bind:value={tempApiKey}
                    placeholder="Cole sua chave ou token estático..."
                    class="flex-1 rounded-lg bg-[#1e1e1e] border border-white/[0.12] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onclick={() => handleSaveAuth(mcp.id)}
                    class="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold cursor-pointer transition-colors shrink-0"
                  >
                    Salvar e Testar
                  </button>
                </div>
              </div>
            {:else if tempAuthType === "oauth2"}
              <div class="space-y-3 animate-fade-in">
                <!-- Connected Status Banner -->
                {#if mcp.oauth2?.accessToken}
                  <div
                    class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <CheckCircle2 class="w-4 h-4 text-emerald-400" />
                        <div>
                          <div class="font-bold text-emerald-300 text-xs">
                            Autenticado via OAuth 2.1
                          </div>
                          <div class="text-[10px] text-zinc-400">
                            {formatExpiresAt(mcp.oauth2.expiresAt)} • {mcp
                              .oauth2.scopeGranted || tempOAuthScopes}
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <button
                          type="button"
                          onclick={() => handleRefreshOAuth(mcp.id)}
                          disabled={isRefreshingMcpId === mcp.id ||
                            !mcp.oauth2?.refreshToken}
                          title="Renovar token agora usando Refresh Token"
                          class="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 cursor-pointer transition-colors flex items-center gap-1 disabled:opacity-40"
                        >
                          <RefreshCw
                            class="w-3 h-3 {isRefreshingMcpId === mcp.id
                              ? 'animate-spin'
                              : ''}"
                          />
                          <span>Renovar Token</span>
                        </button>
                        <button
                          type="button"
                          onclick={() => handleDisconnectOAuth(mcp.id)}
                          title="Desconectar do provedor OAuth 2.1"
                          class="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <LogOut class="w-3 h-3" />
                          <span>Desconectar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                {:else}
                  <div
                    class="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-between"
                  >
                    <div class="flex items-center gap-2">
                      <ShieldCheck class="w-4 h-4 text-sky-400" />
                      <div class="text-[11px] text-zinc-300">
                        Servidor requer login interativo com <strong
                          class="text-sky-300">PKCE S256</strong
                        >.
                      </div>
                    </div>
                    <button
                      type="button"
                      onclick={() => handleStartOAuthFlow(mcp.id)}
                      disabled={isAuthorizingMcpId === mcp.id}
                      class="px-3.5 py-1.5 rounded-lg bg-sky-500/25 hover:bg-sky-500/35 border border-sky-500/50 text-sky-200 font-bold text-xs cursor-pointer transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <Globe
                        class="w-3.5 h-3.5 {isAuthorizingMcpId === mcp.id
                          ? 'animate-spin'
                          : ''}"
                      />
                      <span
                        >{isAuthorizingMcpId === mcp.id
                          ? "Aguardando no Navegador..."
                          : "Conectar via OAuth 2.1"}</span
                      >
                    </button>
                  </div>
                {/if}

                <!-- Endpoint Configuration Form (Collapsible) -->
                <details
                  class="p-3 rounded-xl bg-[#1e1e1e] border border-white/[0.08] space-y-2 text-zinc-400 text-[11px]"
                >
                  <summary class="cursor-pointer hover:text-zinc-200 select-none flex items-center justify-between">
                    <span class="font-semibold text-sky-300 flex items-center gap-1.5">
                      <Compass class="w-3 h-3" /> Parâmetros Avançados (opcional / detecção automática)
                    </span>
                    <button
                      type="button"
                      onclick={(e) => {
                        e.stopPropagation();
                        handleDiscoverEndpoints(false);
                      }}
                      disabled={isDiscoveringAuth || (!tempOAuthIssuer.trim() && !mcp.endpoint)}
                      class="text-[10px] text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <span>Auto-detectar (RFC 8414)</span>
                      <ArrowRight class="w-2.5 h-2.5" />
                    </button>
                  </summary>

                  <div class="space-y-2 pt-2">
                    <input
                      type="text"
                      bind:value={tempOAuthIssuer}
                      placeholder="URL Base do Provedor (Issuer, ex: https://auth.empresa.com)"
                      class="w-full rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                    />

                    <div class="grid grid-cols-2 gap-2">
                      <label class="text-[10px] text-zinc-400 mb-0.5 block">
                        <span class="block mb-0.5">Authorization Endpoint</span>
                        <input
                          type="text"
                          bind:value={tempOAuthAuthUrl}
                          placeholder="https://.../oauth/authorize"
                          class="w-full rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400 font-normal"
                        />
                      </label>
                      <label class="text-[10px] text-zinc-400 mb-0.5 block">
                        <span class="block mb-0.5">Token Endpoint</span>
                        <input
                          type="text"
                          bind:value={tempOAuthTokenUrl}
                          placeholder="https://.../oauth/token"
                          class="w-full rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400 font-normal"
                        />
                      </label>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      <label class="text-[10px] text-zinc-400 mb-0.5 block">
                        <span class="block mb-0.5">Client ID</span>
                        <input
                          type="text"
                          bind:value={tempOAuthClientId}
                          placeholder="ID do cliente registrado (opcional)"
                          class="w-full rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400 font-normal"
                        />
                      </label>
                      <label class="text-[10px] text-zinc-400 mb-0.5 block">
                        <span class="block mb-0.5">Client Secret (Opcional)</span>
                        <input
                          type="password"
                          bind:value={tempOAuthClientSecret}
                          placeholder="Opcional com PKCE S256"
                          class="w-full rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400 font-normal"
                        />
                      </label>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      <label class="text-[10px] text-zinc-400 mb-0.5 block">
                        <span class="block mb-0.5"
                          >Scopes (separados por espaço)</span
                        >
                      <input
                        type="text"
                        bind:value={tempOAuthScopes}
                        placeholder="offline_access mcp:tools"
                        class="w-full rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400 font-normal"
                      />
                    </label>
                    <label class="text-[10px] text-zinc-400 mb-0.5 block">
                      <span class="block mb-0.5">Redirect URI (Loopback)</span>
                      <input
                        type="text"
                        bind:value={tempOAuthRedirectUri}
                        placeholder="http://localhost:18420/oauth/callback"
                        class="w-full rounded-lg bg-[#282828] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400 font-normal"
                      />
                    </label>
                  </div>
                </div>
              </details>

                <!-- Manual code fallback option -->
                <div class="pt-1">
                  <button
                    type="button"
                    onclick={() =>
                      (showManualOAuthInput = !showManualOAuthInput)}
                    class="text-[10px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                  >
                    {showManualOAuthInput
                      ? "Ocultar entrada manual"
                      : "Não conseguiu redirecionar? Colar código de autorização manualmente"}
                  </button>

                  {#if showManualOAuthInput}
                    <div
                      class="mt-2 p-2.5 rounded-lg bg-[#1a1a1a] border border-white/[0.1] space-y-1.5 animate-fade-in"
                    >
                      <label
                        class="text-[10px] text-zinc-300 font-medium block"
                      >
                        <span class="block mb-1"
                          >Cole o código de autorização ou a URL completa
                          redirecionada:</span
                        >
                        <div class="flex items-center gap-1.5">
                          <input
                            type="text"
                            bind:value={manualOAuthCode}
                            placeholder="Cole aqui (ex: spl_abc123 ou http://localhost:18420/oauth/callback?code=...)"
                            class="flex-1 rounded-lg bg-[#262626] border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400 font-mono font-normal"
                          />
                          <button
                            type="button"
                            onclick={() => handleManualSubmitCode(mcp.id)}
                            disabled={!manualOAuthCode.trim()}
                            class="px-3 py-1.5 rounded-lg bg-sky-500/25 hover:bg-sky-500/35 border border-sky-500/40 text-sky-200 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40"
                          >
                            Trocar Código
                          </button>
                        </div>
                      </label>
                    </div>
                  {/if}
                </div>

                <div class="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onclick={() => handleSaveAuth(mcp.id, false)}
                    class="px-4 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-zinc-200 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Salvar Parâmetros
                  </button>
                </div>
              </div>
            {:else}
              <div
                class="p-3 rounded-xl bg-white/[0.04] text-center space-y-2 text-zinc-400"
              >
                <p class="text-xs">
                  Este servidor será acessado publicamente sem cabeçalhos de
                  autenticação.
                </p>
                <button
                  type="button"
                  onclick={() => handleSaveAuth(mcp.id)}
                  class="px-4 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-zinc-200 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Salvar
                </button>
              </div>
            {/if}
          </div>
        {/if}

        {#if mcp.lastTestedMessage}
          <div
            class="flex items-center gap-1.5 text-[10px] {mcp.lastTestedStatus ===
            'connected'
              ? 'text-emerald-400'
              : mcp.lastTestedStatus === 'auth_error'
                ? 'text-rose-400'
                : 'text-amber-400'}"
          >
            {#if mcp.lastTestedStatus === "connected"}
              <CheckCircle2 class="w-3 h-3 shrink-0" />
            {:else if mcp.lastTestedStatus === "auth_error"}
              <Key class="w-3 h-3 shrink-0" />
            {:else}
              <AlertTriangle class="w-3 h-3 shrink-0" />
            {/if}
            <span class="truncate">{mcp.lastTestedMessage}</span>
          </div>
        {/if}

        {#if expandedToolsMcpId === mcp.id && mcp.tools && mcp.tools.length > 0}
          <div
            class="mt-2 p-3 rounded-xl bg-[#262626]/95 border border-purple-500/35 space-y-2 animate-fade-in text-xs"
          >
            <div
              class="flex items-center justify-between pb-1.5 border-b border-white/[0.08]"
            >
              <span
                class="font-semibold text-purple-300 flex items-center gap-1.5"
              >
                <Wrench class="w-3.5 h-3.5 text-purple-400" />
                Ferramentas Disponíveis ({mcp.tools.length})
              </span>
              <span class="text-[10px] text-zinc-400 font-sans"
                >Protocolo MCP Ativo</span
              >
            </div>
            <div
              class="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar"
            >
              {#each mcp.tools as tool}
                <div
                  class="p-2.5 rounded-lg bg-[#1e1e1e] border border-white/[0.06] space-y-1"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-emerald-400">{tool.name}</span>
                    <button
                      type="button"
                      onclick={() => handleExecuteTool(mcp.id, tool.name)}
                      disabled={executingToolName === tool.name}
                      class="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] cursor-pointer transition-colors disabled:opacity-40"
                    >
                      <Play
                        class="w-2.5 h-2.5 {executingToolName === tool.name
                          ? 'animate-spin'
                          : ''}"
                      />
                      <span
                        >{executingToolName === tool.name
                          ? "Executando..."
                          : "Testar"}</span
                      >
                    </button>
                  </div>
                  {#if tool.description}
                    <p
                      class="text-[11px] text-zinc-300 font-sans whitespace-pre-line leading-relaxed"
                    >
                      {tool.description}
                    </p>
                  {/if}
                  {#if toolExecutionResult && toolExecutionResult.toolName === tool.name}
                    <div
                      class="mt-2 p-2.5 rounded bg-black/50 border border-emerald-500/40 text-[10px] text-zinc-200 space-y-1 animate-fade-in"
                    >
                      <div
                        class="flex items-center justify-between text-emerald-300 font-semibold border-b border-white/[0.08] pb-1"
                      >
                        <span>Resultado ({tool.name}):</span>
                        <button
                          type="button"
                          onclick={() => (toolExecutionResult = null)}
                          class="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                          >✕</button
                        >
                      </div>
                      <pre
                        class="max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed text-zinc-300 custom-scrollbar">{toolExecutionResult.resultText}</pre>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <p class="text-[11px] text-zinc-300 font-sans leading-relaxed">
          {mcp.desc}
        </p>

        {#if mcp.id === "mcp-financedatabase"}
          <div
            class="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[11px]"
          >
            <div class="flex items-center justify-between text-zinc-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-zinc-400">{t("settings.mcps.coverage")}</span>
                <span
                  class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25 text-[10px]"
                  >300k+ Assets</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/25 text-[10px]"
                  >Equities & ETFs</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25 text-[10px]"
                  >Funds & Indices</span
                >
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
          <div
            class="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[11px]"
          >
            <div class="flex items-center justify-between text-zinc-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-zinc-400"
                  >{t("settings.mcps.transparency")}</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px]"
                  >Holdings</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 text-[10px]"
                  >Portfolio Weights</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[10px]"
                  >Overlap Analysis</span
                >
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
          <div
            class="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[11px]"
          >
            <div class="flex items-center justify-between text-zinc-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-zinc-400">{t("settings.mcps.metrics")}</span>
                <span
                  class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[10px]"
                  >Modified Duration</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25 text-[10px]"
                  >YTM</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25 text-[10px]"
                  >Rating & Convexity</span
                >
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
          <div
            class="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[11px]"
          >
            <div class="flex items-center justify-between text-zinc-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-zinc-400">{t("settings.mcps.usCurve")}</span>
                <span
                  class="px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/25 text-[10px]"
                  >1M to 30Y</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px]"
                  >Spread 10Y-2Y</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 text-[10px]"
                  >Risk-Free Benchmark</span
                >
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
          <div
            class="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[11px]"
          >
            <div class="flex items-center justify-between text-zinc-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-zinc-400"
                  >{t("settings.mcps.smartMoney")}</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25 text-[10px]"
                  >SEC Form 4</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px]"
                  >Director Purchases</span
                >
                <span
                  class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25 text-[10px]"
                  >Whale Tracking</span
                >
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
