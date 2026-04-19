# VS Code Pack

VS Code already ships first-party MCP support, so this pack uses VS Code's native `mcp.json` configuration surface instead of a custom wrapper.

VS Code supports both workspace-local and user-profile MCP configuration.

- Workspace: `.vscode/mcp.json`
- User profile: open `mcp.json` via `MCP: Open User Configuration`

For `receipts-mcp`, the workspace-local route is the best starting point because it keeps the proxy and upstream settings close to the repo they belong to.

## Prerequisites

1. Install dependencies in this repository.
2. Build the CLI with `npm run build`.
3. Identify the upstream MCP server command and argument list that `receipts-mcp` should proxy.

## Config Template

Use [examples/vscode/.vscode/mcp.json](../examples/vscode/.vscode/mcp.json) as the starting point for a VS Code workspace configuration.

The important parts are:

- `servers.receipts-mcp.type`: `stdio` for the current local launch model
- `command` and `args`: how VS Code starts `receipts-mcp`
- `env`: the proxy and upstream configuration passed to `receipts-mcp`
- optional `sandboxEnabled`: VS Code can sandbox local stdio servers on macOS and Linux

## Recommended Environment Settings

- Keep `RECEIPTS_MCP_UPSTREAM_ARGS` as a JSON array string to avoid argument-splitting issues.
- Set `RECEIPTS_MCP_ACTOR_ID` and `RECEIPTS_MCP_KEY_ID` to something VS Code-specific if you use multiple MCP clients against the same upstream server.
- Set `RECEIPTS_MCP_TOOL_SERVER` so emitted receipts carry a stable upstream server label.
- Use `RECEIPTS_MCP_UPSTREAM_CWD` when the upstream server expects to start from a particular workspace.

## VS Code-Specific Notes

- Tools appear in chat once VS Code trusts and starts the server.
- Prompts can be invoked from chat with `/receipts-mcp.<prompt-name>` when the upstream server exposes prompts.
- Resources can be attached through `Add Context > MCP Resources` or the `MCP: Browse Resources` command when the upstream server exposes resources.
- VS Code stores enable/disable state separately from `mcp.json`, so sharing the config file does not force the server on for every collaborator.

## Optional Sandboxing

VS Code supports sandboxing for local stdio MCP servers on macOS and Linux.

If you enable sandboxing later, remember that `receipts-mcp` may need:

- write access to the file sink path if you use `RECEIPTS_MCP_SINKS=file`
- network access required by the upstream server it launches

Keep the initial pack unsandboxed unless you are ready to tune those allowances.

## Smoke Test

1. Build `receipts-mcp`.
2. Copy the example into the target repo as `.vscode/mcp.json` or adapt it into your user-profile `mcp.json`.
3. In VS Code, run `MCP: List Servers` or open the Chat customizations UI and confirm that `receipts-mcp` is visible.
4. Trust and start the server.
5. Trigger one of the upstream server's tools from chat and confirm that receipts appear in the configured sink output.

## Current Limitations

- This pack is stdio-only because `receipts-mcp` does not yet expose streamable HTTP transport.
- Receipt emission currently covers tool calls, not prompts or resources.
- Sandboxing is optional and not configured in the starter example because the correct allowances depend on your upstream server and sink choices.