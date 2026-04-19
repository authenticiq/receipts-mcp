# receipts-mcp

MCP middleware that emits signed receipts for tool calls while transparently forwarding broader MCP server traffic.

## Status

This repository is in active internal build. The stdio-based MCP shim path and the first three local client packs, Claude Desktop, Cursor, and VS Code, have landed for local development, with broader transport and additional client packs still in progress.

Current internal surface:
- deterministic input and output hashing for receipt payloads
- ML-DSA-87 signing aligned to `agent-receipts/v1`
- stdout, file, HTTP, and local git sinks
- stdio upstream forwarding via the MCP TypeScript SDK
- transparent proxying for tools, prompts, and resources, including `resources/subscribe` and `resources/unsubscribe`
- forwarding for upstream `notifications/tools/list_changed`, `notifications/prompts/list_changed`, `notifications/resources/list_changed`, and `notifications/resources/updated`
- Claude Desktop, Cursor, and VS Code setup docs with config examples for the current stdio deployment model

Still in progress:
- broader MCP transport coverage beyond stdio
- additional client integration packs and demos beyond Claude Desktop, Cursor, and VS Code
- end-to-end verification against released `agent-receipts` JS bindings

Planned launch surface:
- Transparent MCP shim for upstream tool servers
- Local file, stdout, and HTTP sinks
- Drop-in config examples for Claude Desktop, Cursor, VS Code, and ChatGPT MCP
- End-to-end verification with `agent-receipts`

See `docs/DESIGN.md` for the internal architecture and failure-mode decisions, `docs/CLAUDE_DESKTOP.md` for the Claude Desktop pack, `docs/CURSOR.md` for the Cursor pack, and `docs/VSCODE.md` for the VS Code pack.

This project is intended to be usable independently of StrataCodes.

Maintained by AuthenticIQ. StrataCodes may later use this project in production as a downstream commercial implementation.