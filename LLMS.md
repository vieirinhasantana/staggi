# 🧠 LLMS.md — Staggi Architecture & Codebase Map

> **For LLMs, Autonomous Coding Agents, and Engineers:**
> This file is the canonical source of truth for the codebase architecture, Clean Architecture conventions, data flows, and development standards of **Staggi**.
> Read this document thoroughly before inspecting, refactoring, or generating code in this repository.

---

## 1. Project Identity & Tech Stack

- **Name**: Staggi
- **Purpose**: Executive desktop platform for wealth advisory, financial market intelligence, Model Context Protocol (MCP) tool orchestration, and background analytical automations.
- **Core Stack**:
  - **Desktop Core**: [Tauri v2.0](https://v2.tauri.app/) (Rust)
  - **Frontend**: [SvelteKit](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/) with Runes (`$state`, `$derived`, `$derived.by`, `$effect`, `$props`)
  - **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
  - **Icons**: `@lucide/svelte`
  - **Package Manager & Runtime**: [Bun](https://bun.sh/) (always execute commands with `bun run check`, `bun run build`)
  - **Market Data**: Native Yahoo Finance integration in Rust (clean HTTP/JSON endpoints without fragile scraping) + Model Context Protocol (MCP)

---

## 2. Directory Map (Clean Architecture)

```
staggi/
├── LLMS.md                         # This file (canonical AI & LLM reference)
├── ARCHITECTURE.md                 # Software design specifications and Mermaid diagrams
├── README.md                       # Public project presentation & showcase
├── src-tauri/                      # [INFRASTRUCTURE LAYER - RUST BACKEND]
│   ├── src/
│   │   ├── main.rs                 # Tauri application entry point and builder
│   │   └── lib.rs                  # Native IPC commands (ask_ai, test_ai_connection, fetch_yahoo_data...)
│   └── Cargo.toml                  # Rust dependencies (reqwest, serde, tauri)
│
├── src/                            # [FRONTEND APPLICATION - SVELTE 5]
│   ├── app.css                     # Global Tailwind CSS styles and dark fiduciary palette
│   ├── app.html                    # Base HTML container
│   │
│   ├── routes/                     # [PRESENTATION LAYER - PAGES & ROUTES]
│   │   ├── +layout.svelte          # Root application shell (ToastContainer mounting)
│   │   ├── +layout.ts              # Static desktop prerender config (prerender = true)
│   │   └── +page.svelte            # Primary workspace: Chat, Spotlight, Drawer, Floating Cards
│   │
│   └── lib/
│       ├── types/                  # [DOMAIN LAYER - ENTITIES & CONTRACTS]
│       │   ├── index.ts            # Central barrel export (Façade for $lib/types)
│       │   └── domain/
│       │       ├── ai.ts           # AIProvider, EnforcementLevel, AIModelOption, AIChatMessagePayload
│       │       ├── chat.ts         # ChatMessage, ChatSession, QuickPrompt, MessageSender
│       │       ├── financial.ts    # StockQuote, DividendItem, ParsedAssetQuote, ParsedValuationProjection...
│       │       ├── plugins.ts      # McpServerItem, SkillDefinition
│       │       └── tasks.ts        # ScheduledTask, TaskExecutionLog, TaskAlert
│       │
│       ├── services/               # [APPLICATION LAYER - STORES & USE CASES]
│       │   ├── aiProviderState.svelte.ts # Global reactive store for AI (Gemini, OpenAI, Anthropic, Models)
│       │   ├── pluginsState.svelte.ts    # Global reactive store for MCP Servers & Analytical Skills
│       │   ├── tasksState.svelte.ts      # Background Task Scheduler and execution runner
│       │   ├── toastService.svelte.ts    # Floating Toast notifications store
│       │   ├── chatSessionService.ts     # LocalStorage persistence for multi-turn chat sessions
│       │   ├── geminiService.ts          # Orchestrator for prompts, skills, MCP tools, and Rust IPC
│       │   ├── advisorService.ts         # Initial prompt generator with fiduciary guidelines
│       │   ├── formatMessage.ts          # Markdown parser, card regex extractors, and visual adapters
│       │   ├── yahooFinanceService.ts    # Real-time market data client bound to Rust IPC
│       │   └── updaterService.svelte.ts  # Desktop app update checker
│       │
│       ├── hooks/                  # [REUSABLE COMPOSABLE HOOKS]
│       │   ├── useKeyboardShortcut.ts
│       │   ├── useDebounce.ts
│       │   ├── useClickOutside.ts
│       │   ├── useMediaQuery.ts
│       │   └── index.ts
│       │
│       ├── utils/                  # [UTILITIES & FORMATTERS]
│       │   ├── formatters.ts       # Pure formatters: formatRelativeTime, formatCurrency, etc.
│       │   └── utils.ts            # cn() class merge helper (clsx + tailwind-merge)
│       │
│       └── components/             # [PRESENTATION LAYER - SVELTE 5 COMPONENTS]
│           ├── SpotlightBar.svelte           # Global command launcher for tickers and skills
│           ├── ChatMessageItem.svelte        # Message renderer (text, ▌ streaming, interactive cards)
│           ├── ChatHistoryDrawer.svelte      # Sliding drawer for multi-session navigation
│           ├── SettingsModal.svelte          # Orchestrator modal for configurations
│           ├── ToastContainer.svelte         # Floating toast container mounted at root layout
│           │
│           ├── settings/                     # [MODULAR SETTINGS TABS]
│           │   ├── SettingsAiTab.svelte      # AI Source, API Key, Model Catalog, Enforcement Levels
│           │   ├── SettingsMcpsTab.svelte    # MCP Server Management, SSE/stdio, Tool testing
│           │   ├── SettingsSkillsTab.svelte  # Specialized Analytical Frameworks (SKILL.md)
│           │   ├── SettingsTasksTab.svelte   # Automated Background Tasks & Cron schedules
│           │   └── TaskResultModal.svelte    # Execution report inspector modal
│           │
│           ├── cards/                        # [RICH FINANCIAL RESPONSE CARDS]
│           │   ├── AssetQuoteCard.svelte     # Real-time ticker price, change, volume
│           │   ├── AssetProfileCard.svelte   # Fundamental profile, sector, asset class
│           │   ├── AssetDividendsCard.svelte # Payouts calendar, historical DY, ex-dates
│           │   ├── CorporateEventsCard.svelte# Material regulatory filings (CVM / SEC)
│           │   ├── ValuationProjectionCard.svelte # Graham Formula, Bazin Ceiling Price
│           │   └── ComparisonTableCard.svelte# Sector peer comparison matrix
│           │
│           └── ui/                           # [ATOMIC UI PRIMITIVES]
│               ├── Card.svelte
│               ├── Input.svelte
│               ├── Tooltip.svelte
│               └── index.ts
```

---

## 3. Data Flow & Request Lifecycle

```
[ User types prompt in Chat Input or SpotlightBar ]
                         │
                         ▼
                 [ +page.svelte ]
                         │
        (Mounts "Thinking... [tool_name]" bubble with pulsing Brain icon)
                         │
                         ▼
              [ geminiService.ts ]
              ├── Gathers chronological chat history
              ├── Injects fiduciary Wealth Advisor directives
              ├── Identifies and resolves Skills (/valuation, /proventos, etc.)
              └── Prepares active MCP tools schema
                         │
                         ▼
       [ Rust IPC: invoke("ask_ai" / "ask_gemini") ]
              ├── Google Gemini / OpenAI / Anthropic
              ├── Injects native Reasoning Effort / Thinking parameters
              └── Executes direct HTTPS requests via native reqwest
                         │
                         ▼
              [ +page.svelte (Streaming 60fps) ]
              ├── Splits tokens and streams text smoothly with cursor ▌
              ├── Concludes streaming
              └── Extracts structured visual payloads via formatMessage.ts
                         │
                         ▼
          [ ChatMessageItem.svelte -> Mounts Rich Financial Cards ]
```

---

## 4. Absolute Development Guidelines (Clean Code)

1. **Svelte 5 Runes Only**:
   - Always use `$state`, `$derived`, `$derived.by`, `$effect`, and `$props`.
   - **Never** introduce legacy Svelte 4 syntax (`export let`, `$: computed`, or `writable()` stores inside components).
2. **Color Palette & Fiduciary Dark Theme**:
   - **NEVER** use pure black (`#000000` or `bg-black`).
   - Use the approved dark fiduciary palette: `#181628`, `#1c1a28`, `#141320`, `#1e1c2b`.
3. **Tauri Desktop Window Standards**:
   - Modal headers and draggable window bars must include `data-tauri-drag-region`.
4. **Authentic Market Data (Zero Mocking)**:
   - All quotes, multiples, and corporate filings are fetched from official Yahoo Finance endpoints (`fetch_yahoo_data` in Rust) or active MCP servers. Never generate or hardcode fictional market numbers.
5. **Standardized Thinking State**:
   - Always use the uniform format `Thinking... [tool_name]` (or `Pensando... [ferramenta]`) accompanied by the pulsing brain icon (`Brain` with `animate-pulse text-amber-400`).
6. **Form & UI Consistency**:
   - Cancel buttons in modals/forms must display standard text `"Cancelar"` (avoid isolated `X` icons in headers when sibling views use text buttons).

---

## 5. How to Extend the Application (Agent Guide)

### A. Adding a New AI Model
1. Open `src/lib/services/aiProviderState.svelte.ts`.
2. Add the specification under `AI_MODELS[provider]` with `id`, `name`, `description`, `supportsTools`, `supportsReasoning`, and `contextWindow`.
3. Do not create text inputs for model typing; the select dropdown reflects the catalog automatically.

### B. Adding a New MCP Tool or Server
1. Register interfaces in `src/lib/types/domain/plugins.ts`.
2. Set initial defaults in `src/lib/services/pluginsState.svelte.ts`.
3. Add tool dispatching in `src/lib/services/geminiService.ts` so the model can invoke the tool schema.

### C. Creating a New Financial Response Card
1. Create the data contract in `src/lib/types/domain/financial.ts`.
2. Add the extraction regex and parser in `src/lib/services/formatMessage.ts`.
3. Create the Svelte 5 component under `src/lib/components/cards/` (e.g., `NewMetricCard.svelte`).
4. Wire conditional rendering into `src/lib/components/ChatMessageItem.svelte`.
