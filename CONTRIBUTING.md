# Contributing to Staggi

Thank you for your interest in contributing to **Staggi**! We welcome community contributions, bug reports, and analytical improvements.

---

## Code of Conduct

We are committed to providing a welcoming, respectful, and harassment-free environment for all contributors. Please treat fellow maintainers and contributors with mutual respect, constructive communication, and professional courtesy.

---

## Development Setup

### Prerequisites

1. **Bun** (`v1.2+`): [bun.sh](https://bun.sh)
2. **Rust & Cargo** (`stable`): [rustup.rs](https://rustup.rs)
3. **Platform Dependencies**:
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
   - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
   - **Windows**: Microsoft C++ Build Tools & WebView2 runtime

### Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/vieirinhasantana/staggi.git
cd staggi

# 2. Install dependencies
bun install

# 3. Start development desktop instance
bun run tauri dev
```

---

## Architectural Principles & Coding Standards

1. **Svelte 5 Runes Only**:
   - Use modern Svelte 5 syntax: `$state()`, `$derived()`, `$props()`, and `$effect()`.
   - Do not use legacy Svelte 3/4 stores (`writable`, `derived`) or `$:` reactive declarations.
2. **Clean Layer Separation**:
   - **Domain (`src/lib/types/domain/`)**: Pure TypeScript contracts and financial entities without external dependencies.
   - **Application (`src/lib/services/`)**: LLM orchestrators, MCP clients, and calculation services.
   - **Presentation (`src/lib/components/`)**: Reactive UI components and specialized cards.
3. **Internationalization (i18n)**:
   - All user-facing strings must use the `t("keyPath")` helper from `$lib/i18n`.
   - Never hardcode raw UI strings or language-specific text in templates.
4. **Self-Documenting Code**:
   - Keep code expressive with clear naming conventions.
   - All comments must be in English.
5. **Zero Secrets in Repository**:
   - Never commit API keys, credentials, or personal secrets.

---

## Pull Request Guidelines

1. **Branch Naming**:
   - `feat/feature-name`
   - `fix/bug-fix`
   - `refactor/clean-architecture`
   - `docs/documentation-update`
2. **Commit Messages**:
   - Follow [Conventional Commits](https://www.conventionalcommits.org/):
     - `feat: add cashflow discount model to valuation card`
     - `fix: resolve SSE reconnection timeout in MCP client`
     - `refactor: extract financial multiples calculation to service`
3. **Local Validation Before Submitting**:
   ```bash
   bun run check
   bun run build
   cargo check --manifest-path src-tauri/Cargo.toml
   ```
