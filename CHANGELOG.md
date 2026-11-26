# Changelog

All notable changes to **Staggi** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.22] - 2026-11-25

### Fixed
- **Amazon Bedrock Converse API & Smart Cross-Region Routing**:
  - Adopted AWS Bedrock modern Converse API (`/converse`) as primary conversation protocol with automatic fallback to `InvokeModel`.
  - Added intelligent runtime region routing: automatically routes US cross-region inference profiles (`us.*`) and Nova models to compute regions (`us-east-1`), completely eliminating HTTP 400 ValidationException errors when using regional credentials (e.g. `sa-east-1`).
  - Standardized message roles (`user` / `assistant`), merged consecutive identical roles, and ensured conversations always start with a user message.
  - Upgraded Bedrock connection test to execute a real 1-token live invocation test for early validation of AWS Model Access permissions.
- **Executive UI Progress & Thinking State**:
  - Standardized all AI thinking states to clean executive English (`Thinking...`), removing intermediate Portuguese messages.
  - Enforced strict anti-metalanguage directives in system instructions.

---

## [0.1.21] - 2026-11-25

### Fixed
- **Amazon Bedrock Cross-Region Inference Profiles**:
  - Automatically resolve model IDs to cross-region system-defined inference profiles (`us.<model_id>`), resolving AWS 400 Bad Request on-demand invocation errors.
- **MCP Tool Invocation & Dynamic Tool Calling**:
  - Automated dynamic tool planning and multi-tool parallel calling with session schema caching.
  - Enhanced Brazilian/US asset ticker recognition and client portfolio disambiguation logic.
- **Windows Build Compatibility**:
  - Wrapped WebView2 environment configuration in `unsafe` blocks for Rust 2024 edition compatibility.

---

## [0.1.2] - 2026-11-25

### Added
- **Amazon Bedrock Provider with AWS SigV4**:
  - Direct native integration with Amazon Bedrock using AWS Signature Version 4 (SigV4) cryptographic signing in Rust.
  - Dedicated configuration UI in Settings for AWS Access Key ID, Secret Access Key, Region selection (`us-east-1`, `us-west-2`, `sa-east-1`, etc.), and optional Session Token (STS/SSO).
  - Out-of-the-box support for Anthropic Claude models on Bedrock (Claude 3.5 Sonnet v2, Claude 3.5 Haiku, Claude 3 Haiku), Amazon Nova (Nova Pro, Nova Lite), and Meta Llama 3.3 70B.
  - Dynamic discovery of active foundation models enabled on the AWS account via Bedrock API.
- **Native Always-On Screen Capture Protection**:
  - Enforced OS-level content protection (`contentProtected: true` in Tauri) across all platforms to prevent screenshots, screen recording, and window capture in video conferencing software.

### Changed
- **Spotlight Bar Placeholder**:
  - Standardized on a clean, fixed English placeholder (`"Ask anything, search tickers or type / for skills..."`) without text rotation or jumping animations.
- **MCP Settings UI Refinement**:
  - Cleaned up redundant status tags (`CUSTOM MCP SERVER`, `MARKET DATA MCP`, `NATIVE`, `HTTP`) for a cleaner card layout.
- **Windows Overlay Scrollbars & Performance Optimization**:
  - Standardized modern macOS-style overlay scrollbars across Windows, macOS, and Linux.
  - Eliminated UI lag on Windows builds by enabling hardware acceleration and optimizing backdrop filters.

### Fixed
- **MCP Streamable HTTP Session ID Handshake**:
  - Fixed `400 Bad Request: Missing session ID` errors during `tools/call` executions (e.g. `list_clients`).
  - Added full lifecycle session preservation (`initialize` -> `notifications/initialized` -> `tools/call`), propagating the `mcp-session-id` header across both direct HTTP and SSE transports with automatic re-handshake recovery.

---

## [0.1.1] - 2026-11-24

### Added
- **Full OAuth 2.1 Protocol Suite for MCP**:
  - Implemented RFC 8414 Authorization Server Metadata auto-discovery (`/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`, and `/.well-known/oauth-protected-resource`).
  - Dynamic Client Registration (RFC 7591) for automatic client registration on `/register` without manual credential creation.
  - Proof Key for Code Exchange (PKCE) with `S256` (RFC 7636).
  - Built-in temporary HTTP loopback listener (RFC 8252) on `127.0.0.1:18420` for seamless system browser redirection and authorization code capture.
  - Automatic token expiration tracking and silent refresh via refresh tokens.
- **Zero-Config MCP Integration**:
  - Connecting an MCP server with OAuth 2.1 now requires only the server URL; all endpoints, client registration, and PKCE tokens are resolved automatically.
  - Added optional collapsible advanced settings for manual override if desired.
- **Streamable HTTP Transport for MCP**:
  - Modern HTTP transport (`http`) is now the default for HTTP/HTTPS MCP endpoints, supporting standard JSON-RPC over HTTP and FastMCP session handshakes.
  - Intelligent route detection automatically tests and falls back to `/mcp` endpoints when root URLs return HTTP 404 or 405.
- **Automated Email Dispatch for Background Tasks**:
  - Direct email dispatch triggered automatically on task completion with validated recipient addresses.
  - Clean, executive HTML email reports focusing strictly on portfolio monitoring, data tables, and advisor actionables.

### Changed
- Clean default slate: Kept only Yahoo Finance (`builtin://yahoo-finance`) as the default configured MCP; removed legacy mock MCPs and mock skills.
- Default transport for HTTP/HTTPS servers changed from legacy `sse` to `http` (Streamable HTTP).
- Local storage automatic migration to normalize legacy MCP records and clean up obsolete entries.
- Task completion notifications now exclusively use non-blocking toast alerts (`toastStore`) instead of intrusive banner overlays.

### Fixed
- Fixed Svelte 5 rune execution in `automationEmailService` by migrating to `.svelte.ts`.
- Fixed `effect_update_depth_exceeded` infinite loop in Settings tabs using `untrack` and lifecycle hooks.
- Corrected table and LaTeX formatting artifacts in automation email previews.

## [0.1.0] - 2026-11-21

### Added
- **Spotlight Bar (Command Center)**: Desktop overlay with global keyboard shortcut (`Cmd/Ctrl + Shift + Space`) for rapid financial queries, ticker lookups, and specialized analytical skills.
- **Multi-Asset Card Visualizations**:
  - `ValuationProjectionCard`: Graham Intrinsic Model and Bazin Ceiling Price (DY 6%) with margin of safety indicators.
  - `AssetDividendsCard`: 5-year dividend yield evolution and declared distributions schedule.
  - `AssetQuoteCard`: Intraday price ranges, liquidity volume, market cap, and multiple metrics.
  - `CorporateEventsCard`: Material disclosures, earnings announcements, and categorized corporate radar.
  - `ComparisonTableCard`: Cross-asset peer multiple comparisons.
  - `AssetProfileCard`: Identifier sheets (ISIN, CUSIP, Bloomberg Ticker), asset class, domicile, and tax status.
- **Model Context Protocol (MCP) Client**:
  - Support for `stdio` and `sse` transport protocols.
  - Default integrations: Yahoo Finance, FinanceDatabase (300k+ assets), Equibles ETF Holdings, US Treasury Yield Curve, Bond Intelligence, and TickerInside Insider Trading.
- **Specialized Analytical Skills Engine**:
  - Declarative markdown directives with slash-command triggers (`/valuation`, `/dividends`, `/screening`, `/fixed-income`, `/insider`, `/report`, `/offshore`).
- **Autonomous Background Automations**:
  - Periodic execution daemon with customizable intervals (15m to 24h).
  - Floating toast alerts and full markdown execution inspector.
- **Multi-Provider AI Engine**:
  - Direct integration with Google Gemini, Anthropic Claude, and OpenAI GPT models.
  - Client-side encryption: API keys stored strictly in local secure storage, never logged or transmitted to third-party backends.
- **Internationalization (i18n)**:
  - Reactive Svelte 5 i18n store with English (`en`) as the active locale.

### Changed
- Refactored entire frontend architecture to Svelte 5 Runes (`$state`, `$derived`, `$props`).
- Enforced clean architecture layer boundaries: Presentation (`components/`), Domain (`types/domain/`), and Application (`services/`).

[0.1.1]: https://github.com/vieirinhasantana/staggi/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/vieirinhasantana/staggi/releases/tag/v0.1.0
