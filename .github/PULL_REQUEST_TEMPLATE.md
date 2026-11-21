## Description

Please provide a summary of the change and the issue or feature it addresses.

- What problem does this solve?
- What changes were introduced?

---

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Refactoring (code improvement or clean architecture restructuring)
- [ ] Documentation update
- [ ] MCP Server / Financial Skill enhancement

---

## Checklist

- [ ] My code adheres to the project's [Clean Architecture](ARCHITECTURE.md) and [Coding Guidelines](CONTRIBUTING.md).
- [ ] Uses modern **Svelte 5 Runes** (`$state`, `$derived`, `$props`) with zero legacy stores.
- [ ] All new UI strings are registered in the **i18n** dictionary (`src/lib/i18n/`).
- [ ] All comments and documentation are in **English**.
- [ ] No API keys, credentials, or sensitive secrets are committed.
- [ ] `bun run check` passes with 0 errors and 0 warnings.
- [ ] `bun run build` succeeds locally.
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` succeeds.
