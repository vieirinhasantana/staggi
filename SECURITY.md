# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

---

## Local Secret & Key Protection

Staggi is designed with a **privacy-first, local-only** fiduciary architecture:

- **Local Storage**: User API keys (Google Gemini, Anthropic Claude, OpenAI GPT) are stored strictly within the user's local desktop storage.
- **Zero Telemetry**: No user prompts, financial portfolios, or credentials are sent to external analytics servers or third-party brokers.
- **Direct Communication**: Network traffic occurs exclusively between your machine and the verified AI / MCP providers configured in Settings.

---

## Reporting a Vulnerability

If you discover a potential security vulnerability within Staggi, please do **NOT** open a public GitHub issue.

Instead, please report security vulnerabilities responsibly via private disclosure:

1. Use GitHub's private vulnerability reporting feature on [our repository](https://github.com/vieirinhasantana/staggi/security/advisories/new).
2. Alternatively, reach out directly to the maintainer via GitHub profile contact.

Please provide:
- A clear description of the vulnerability.
- Steps or a minimal proof-of-concept to reproduce the behavior.
- Affected operating systems and Staggi version.

We strive to review, acknowledge, and resolve security reports promptly.
