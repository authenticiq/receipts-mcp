# receipts-mcp

MCP middleware that emits signed receipts for every tool call.

## Status

This repository is an early public scaffold. The full extraction sprint has not landed yet.

Planned launch surface:
- Transparent MCP shim for upstream tool servers
- Local file, stdout, and HTTP sinks
- Drop-in config examples for Claude Desktop, Cursor, VS Code, and ChatGPT MCP
- End-to-end verification with `agent-receipts`

This project is intended to be usable independently of StrataCodes.

Maintained by AuthenticIQ. StrataCodes may later use this project in production as a downstream commercial implementation.