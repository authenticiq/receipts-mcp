# Claude Desktop Pack

Claude Desktop is the first client pack because it already supports stdio MCP servers, which matches the current `receipts-mcp` transport.

This pack is for local development and internal validation. It assumes:

- `receipts-mcp` runs as a local stdio server
- the upstream MCP server also runs locally over stdio
- receipts are currently emitted for tool calls only
- prompts and resources pass through the proxy unchanged

## Prerequisites

1. Install dependencies in this repository.
2. Build the CLI with `npm run build`.
3. Identify the upstream MCP server command and argument list you want Claude Desktop to use through the proxy.

## Config Template

Use [examples/claude-desktop/claude_desktop_config.example.json](../examples/claude-desktop/claude_desktop_config.example.json) as the starting point for your Claude Desktop MCP config.

The important parts are:

- `command` and `args`: how Claude Desktop starts `receipts-mcp`
- `RECEIPTS_MCP_UPSTREAM_COMMAND`: the real upstream MCP server executable
- `RECEIPTS_MCP_UPSTREAM_ARGS`: the upstream argument list encoded as a JSON array string
- `RECEIPTS_MCP_SINKS`: where emitted receipts go
- `RECEIPTS_MCP_FILE_PATH`: required if you enable the `file` sink

## Recommended Environment Settings

- `RECEIPTS_MCP_UPSTREAM_ARGS` should be a JSON array string in Claude Desktop config. That avoids shell-splitting edge cases.
- `RECEIPTS_MCP_KEY_ID` should identify the local actor or workstation using the proxy.
- `RECEIPTS_MCP_SEED_BASE64` is optional, but useful when you want a stable dev signing key across restarts.
- `RECEIPTS_MCP_TOOL_SERVER` lets you label the upstream server in emitted receipts.

If `RECEIPTS_MCP_SEED_BASE64` is omitted, `receipts-mcp` generates a new dev key on each process start.

## Smoke Test

1. Build `receipts-mcp`.
2. Update the Claude Desktop config with real absolute paths and upstream command details.
3. Restart Claude Desktop.
4. Ask Claude to use one of the upstream server's tools.
5. Confirm that receipts appear in the configured sink output.

## Current Limitations

- This pack is stdio-only because `receipts-mcp` does not yet expose streamable HTTP transport.
- Receipt emission currently covers tool calls, not prompts or resources.
- Public-key export and external verification ergonomics still need more work before this becomes a polished end-user flow.