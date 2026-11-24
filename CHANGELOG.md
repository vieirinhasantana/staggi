# Changelog

All notable changes to **Staggi** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
