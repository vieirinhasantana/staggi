# 🧠 LLMS.md — Staggi Architecture & Codebase Map

> **Para LLMs, Agentes Autônomos e Engenheiros:**
> Este arquivo é a fonte canônica da verdade sobre a estrutura, convenções de Clean Architecture, fluxo de dados e padrões de desenvolvimento do **Staggi**.
> Leia este documento antes de inspecionar ou alterar qualquer parte do projeto.

---

## 1. Visão Geral do Projeto (Identity & Tech Stack)

- **Nome**: Staggi
- **Propósito**: Aplicação desktop executiva para consultoria de patrimônio, inteligência de mercado financeiro, orquestração de servidores MCP e automação de rotinas analíticas (Wealth Management & Financial AI).
- **Core Stack**:
  - **Desktop Core**: [Tauri v2.0](https://v2.tauri.app/) (Rust)
  - **Frontend**: [SvelteKit](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/) com Runes (`$state`, `$derived`, `$effect`, `$props`)
  - **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/)
  - **Ícones**: `@lucide/svelte`
  - **Package & Runtime**: [Bun](https://bun.sh/) (comandos devem rodar com `bun run check`, `bun run build`)
  - **Market Data**: Yahoo Finance API nativa em Rust (HTTP/JSON sem bibliotecas pesadas de scraping) + Protocolo Model Context Protocol (MCP)

---

## 2. Mapa de Diretórios (Clean Architecture)

```
staggi/
├── LLMS.md                         # Este arquivo (guia canônico para IAs e LLMs)
├── ARCHITECTURE.md                 # Documento de arquitetura de software e diagramas
├── src-tauri/                      # [INFRAESTRUTURA BACKEND RUST]
│   ├── src/
│   │   ├── main.rs                 # Ponto de entrada Tauri (app builder e setup)
│   │   └── lib.rs                  # Comandos IPC Tauri (ask_ai, test_ai_connection, fetch_yahoo_data...)
│   └── Cargo.toml                  # Dependências Rust (reqwest, serde, tauri)
│
├── src/                            # [FRONTEND SVELTE 5]
│   ├── app.css                     # Estilos globais Tailwind CSS e temas escuros
│   ├── app.html                    # Template HTML base
│   │
│   ├── routes/                     # [CAMADA DE APRESENTAÇÃO - PÁGINAS]
│   │   ├── +layout.svelte          # Shell raiz da aplicação
│   │   ├── +layout.ts              # Configuração SSR/prerender para Tauri Desktop (prerender = true)
│   │   └── +page.svelte            # Tela principal: Chat, Drawer de Sessões, Spotlight e Cards
│   │
│   └── lib/
│       ├── types/                  # [CAMADA DE DOMÍNIO - TIPOS E CONTRATOS]
│       │   ├── index.ts            # Re-exportador central e unificado de tipos
│       │   └── domain/
│       │       ├── ai.ts           # AIProvider, EnforcementLevel, AIModelOption, AIChatMessagePayload
│       │       ├── chat.ts         # ChatMessage, ChatSession, QuickPrompt, MessageSender
│       │       ├── financial.ts    # StockQuote, DividendItem, ParsedAssetQuote, ParsedValuationProjection...
│       │       ├── plugins.ts      # McpServerItem, SkillDefinition
│       │       └── tasks.ts        # ScheduledTask, TaskExecutionLog, TaskAlert
│       │
│       ├── services/               # [CAMADA DE APLICAÇÃO - STORES E CASOS DE USO]
│       │   ├── aiProviderState.svelte.ts # Store reativa global da IA (Gemini, OpenAI, Anthropic, Models, Enforcement)
│       │   ├── pluginsState.svelte.ts    # Store reativa de Servidores MCP e Skills analíticas
│       │   ├── tasksState.svelte.ts      # Store reativa do Agendador de Tarefas em segundo plano
│       │   ├── chatSessionService.ts     # Persistência de sessões de chat em LocalStorage
│       │   ├── geminiService.ts          # Orquestrador de prompt, Tools, MCPs e chamada ao Rust IPC
│       │   ├── advisorService.ts         # Gerador de prompt inicial e diretivas de Wealth Advisor
│       │   ├── formatMessage.ts          # Parser de Markdown, extração de cards JSON e formatação de texto
│       │   ├── yahooFinanceService.ts    # Cliente de cotações em tempo real integrado ao Rust
│       │   └── updaterService.svelte.ts  # Gerenciador de atualizações de versão do app desktop
│       │
│       ├── utils/                  # [CAMADA DE SUPORTE E UTILITÁRIOS]
│       │   ├── formatters.ts       # Formatadores puros: formatRelativeTime, formatMinutesLabel, formatCurrency
│       │   └── index.ts (utils.ts) # Utilitário cn (clsx + tailwind-merge)
│       │
│       └── components/             # [CAMADA DE APRESENTAÇÃO - COMPONENTES SVELTE 5]
│           ├── SpotlightBar.svelte           # Barra de busca rápida global de ativos e skills
│           ├── ChatMessageItem.svelte        # Renderizador de mensagens (texto, streaming ▌, cards dinâmicos)
│           ├── ChatHistoryDrawer.svelte      # Painel lateral deslizante com histórico de conversas
│           ├── SettingsModal.svelte          # Modal orquestrador de configurações
│           │
│           ├── settings/                     # [SUBCOMPONENTES MODULARES DE CONFIGURAÇÃO]
│           │   ├── SettingsAiTab.svelte      # Aba 1: Provedores, Chaves, Modelos e Enforcement
│           │   ├── SettingsMcpsTab.svelte    # Aba 2: Gestão de Servidores MCP e teste de endpoints
│           │   ├── SettingsSkillsTab.svelte  # Aba 3: Editor de Prompts Analíticos Especializados (SKILL.md)
│           │   ├── SettingsTasksTab.svelte   # Aba 4: Agendador de rotinas e tarefas em segundo plano
│           │   └── TaskResultModal.svelte    # Modal de visualização dos relatórios de execução das tarefas
│           │
│           ├── cards/                        # [CARDS RICOS DE RESPOSTA FINANCEIRA]
│           │   ├── AssetQuoteCard.svelte     # Card de cotação oficial em tempo real
│           │   ├── AssetProfileCard.svelte   # Card de perfil fundamentalista, setor e métricas
│           │   ├── AssetDividendsCard.svelte # Card com histórico de dividendos e yield anual
│           │   ├── CorporateEventsCard.svelte# Card de fatos relevantes e eventos corporativos
│           │   ├── ValuationProjectionCard.svelte # Card de modelos de valuation (Graham, Bazin)
│           │   └── ComparisonTableCard.svelte# Tabela comparativa entre múltiplos tickers
│           │
│           └── ui/                           # Componentes visuais atômicos (Button, Dialog, Badge, Command...)
```

---

## 3. Fluxo de Dados e Interações

```
[ Usuário digita mensagem no Chat ou no Spotlight ]
                     │
                     ▼
             [ +page.svelte ]
                     │
         (Adiciona bolha "Pensando..." com Brain pulsante)
                     │
                     ▼
          [ geminiService.ts ]
          ├── Enriquece histórico de conversas
          ├── Injeta diretivas fiduciárias de Wealth Advisor
          ├── Identifica e formata Skills (/valuation, /proventos, etc.)
          └── Prepara ferramentas MCPs ativas
                     │
                     ▼
   [ Rust IPC: invoke("ask_ai" / "ask_gemini") ]
          ├── Google Gemini / OpenAI / Anthropic
          ├── Transmite Reasoning Effort (o1/o3/Claude 3.7)
          └── Executa chamadas nativas de rede
                     │
                     ▼
          [ +page.svelte (Streaming 60fps) ]
          ├── Divide tokens e renderiza texto suavemente com cursor ▌
          ├── Conclui streaming
          └── Extrai blocos visuais via formatMessage.ts
                     │
                     ▼
      [ ChatMessageItem.svelte -> Renderiza Cards Ricos ]
```

---

## 4. Regras Absolutas e Diretrizes de Código (Clean Code)

1. **Svelte 5 Runes**:
   - Utilize sempre `$state`, `$derived`, `$derived.by`, `$effect` e `$props`.
   - **Nunca** utilize sintaxe legada do Svelte 4 (`export let`, `$: computed`, ou `writable()` stores dentro de componentes).
2. **Paleta de Cores e Temas**:
   - **NUNCA** utilize preto puro (`#000000` ou `bg-black`).
   - Utilize os tons escuros fiduciários estabelecidos: `#181628`, `#1c1a28`, `#141320`, `#1e1c2b`.
3. **Janela Desktop Tauri**:
   - Cabeçalhos de painéis e barras superiores utilizam `data-tauri-drag-region` para permitir que o usuário arraste a janela pelo mouse.
4. **Dados de Mercado Reais (Sem Mocks)**:
   - Toda cotação, múltiplo ou evento corporativo é obtido em tempo real via Yahoo Finance API nativa (`fetch_yahoo_data` em Rust) ou servidores MCP ativos. Não invente ou insira dados falsos.
5. **Indicação de Estado de Pensamento**:
   - Sempre utilize o padrão genérico `Pensando... [nome_da_ferramenta]` acompanhado pelo ícone de cérebro pulsante (`Brain` com `animate-pulse text-amber-400`).
6. **Formulários Consistentes**:
   - Botões de cancelamento em formulários devem exibir `"Cancelar"` (evite ícones `X` isolados em cabeçalhos de formulários quando os demais usam texto).

---

## 5. Como Adicionar Novas Funcionalidades (Guia para IAs)

### A. Adicionar um Novo Modelo de IA
1. Abra `src/lib/services/aiProviderState.svelte.ts`.
2. Adicione a especificação em `AI_MODELS[provider]` com `id`, `name`, `description`, `supportsTools`, `supportsReasoning` e `contextWindow`.
3. Não crie inputs de texto para digitação manual; o dropdown reflete o catálogo automaticamente.

### B. Adicionar uma Nova Ferramenta ou Servidor MCP
1. Registre as interfaces em `src/lib/types/domain/plugins.ts`.
2. Defina os padrões iniciais em `src/lib/services/pluginsState.svelte.ts`.
3. Adicione o despachante de ferramenta em `src/lib/services/geminiService.ts` para que o modelo saiba invocar a tool correspondente.

### C. Criar um Novo Card Visual de Chat
1. Crie o contrato de dados em `src/lib/types/domain/financial.ts`.
2. Adicione a regex de extração e parser em `src/lib/services/formatMessage.ts`.
3. Crie o componente visual em `src/lib/components/` (ex: `NovoCard.svelte`).
4. Conecte a renderização condicional em `src/lib/components/ChatMessageItem.svelte`.
