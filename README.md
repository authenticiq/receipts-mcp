# receipts-mcp

MCP middleware that emits signed receipts for every tool call.

## Status

This repository is in active internal build. The first stdio-based MCP shim path has landed for local development, with broader transport and client-pack work still in progress.

Current internal surface:
- deterministic input and output hashing for receipt payloads
- ML-DSA-87 signing aligned to `agent-receipts/v1`
- stdout, file, HTTP, and local git sinks
- stdio upstream forwarding via the MCP TypeScript SDK
- a transparent tool proxy server for `tools/list` and `tools/call`

Still in progress:
- broader MCP transport coverage beyond stdio
- client integration packs and demos
- end-to-end verification against released `agent-receipts` JS bindings

Planned launch surface:
- Transparent MCP shim for upstream tool servers
- Local file, stdout, and HTTP sinks
- Drop-in config examples for Claude Desktop, Cursor, VS Code, and ChatGPT MCP
- End-to-end verification with `agent-receipts`

See `docs/DESIGN.md` for the internal architecture and failure-mode decisions.

This project is intended to be usable independently of StrataCodes.

Maintained by AuthenticIQ. StrataCodes may later use this project in production as a downstream commercial implementation.