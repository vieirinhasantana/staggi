# Changelog

All notable changes to **Staggi** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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

[0.1.0]: https://github.com/vieirinhasantana/staggi/releases/tag/v0.1.0
