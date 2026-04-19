# Cursor Pack

Cursor is the next pack after Claude Desktop because it is also a local MCP client and fits the current stdio deployment model.

This pack targets a project-local `.cursor/mcp.json` setup so the MCP server wiring can live alongside the repo you want Cursor to work in.

## Prerequisites

1. Install dependencies in this repository.
2. Build the CLI with `npm run build`.
3. Identify the upstream MCP server command and argument list that `receipts-mcp` should proxy.

## Config Template

Use [examples/cursor/.cursor/mcp.json](../examples/cursor/.cursor/mcp.json) as the starting point for a project-local Cursor MCP configuration.

The important parts are:

- `command` and `args`: how Cursor starts `receipts-mcp`
- `RECEIPTS_MCP_UPSTREAM_COMMAND`: the real upstream MCP server executable
- `RECEIPTS_MCP_UPSTREAM_ARGS`: the upstream argument list encoded as a JSON array string
- `RECEIPTS_MCP_UPSTREAM_CWD`: optional working directory for the upstream server
- `RECEIPTS_MCP_SINKS`: where emitted receipts go
- `RECEIPTS_MCP_FILE_PATH`: required if you enable the `file` sink

## Recommended Environment Settings

- Keep `RECEIPTS_MCP_UPSTREAM_ARGS` as a JSON array string to avoid argument-splitting issues.
- Set `RECEIPTS_MCP_ACTOR_ID` and `RECEIPTS_MCP_KEY_ID` to something Cursor-specific so receipts are easy to distinguish from Claude Desktop or other clients.
- Set `RECEIPTS_MCP_TOOL_SERVER` so emitted receipts carry a stable upstream server label.
- Use `RECEIPTS_MCP_UPSTREAM_CWD` when the upstream server expects to start from a particular workspace.

If `RECEIPTS_MCP_SEED_BASE64` is omitted, `receipts-mcp` generates a new dev key on each process start.

## Smoke Test

1. Build `receipts-mcp`.
2. Copy the example into the target repo as `.cursor/mcp.json` and replace the placeholder paths.
3. Restart Cursor or reload the window so the MCP config is re-read.
4. Trigger one of the upstream server's tools from Cursor.
5. Confirm that receipts appear in the configured sink output.

## Current Limitations

- This pack is stdio-only because `receipts-mcp` does not yet expose streamable HTTP transport.
- Receipt emission currently covers tool calls, not prompts or resources.
- This pack is intentionally project-local. If you want a global Cursor setup later, add that once the transport and launch surface are more stable.