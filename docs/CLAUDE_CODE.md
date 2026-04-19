# Claude Code Pack

Claude Code is the next natural local pack because it has first-party MCP support, a project-scoped `.mcp.json` format, and direct support for local stdio MCP servers.

This pack targets Claude Code's shared project scope so the configuration can live in version control alongside the repo that should use `receipts-mcp`.

## Prerequisites

1. Install dependencies in this repository.
2. Build the CLI with `npm run build`.
3. Identify the upstream MCP server command and argument list that `receipts-mcp` should proxy.

## Config Template

Use [examples/claude-code/.mcp.json](../examples/claude-code/.mcp.json) as the starting point for a Claude Code project configuration.

The important parts are:

- `mcpServers.receipts-mcp.command` and `args`: how Claude Code starts `receipts-mcp`
- `RECEIPTS_MCP_UPSTREAM_COMMAND`: the real upstream MCP server executable
- `RECEIPTS_MCP_UPSTREAM_ARGS`: the upstream argument list encoded as a JSON array string
- `RECEIPTS_MCP_UPSTREAM_CWD`: optional working directory for the upstream server
- `RECEIPTS_MCP_SINKS`: where emitted receipts go
- `RECEIPTS_MCP_FILE_PATH`: required if you enable the `file` sink

## Claude Code Scope Notes

Claude Code supports three MCP scopes:

- `local`: private to you for the current project, stored in `~/.claude.json`
- `project`: shared in the project root as `.mcp.json`
- `user`: private to you across projects, stored in `~/.claude.json`

For `receipts-mcp`, the project scope is the best starting point because it is the only one designed for version-controlled team sharing.

If you prefer the CLI over manual editing, the official pattern is:

```bash
claude mcp add --transport stdio --scope project receipts-mcp -- \
  node /absolute/path/to/receipts-mcp/dist/cli.js
```

Then add the required `RECEIPTS_MCP_*` environment variables to the generated `.mcp.json` entry.

## Recommended Environment Settings

- Keep `RECEIPTS_MCP_UPSTREAM_ARGS` as a JSON array string to avoid argument-splitting issues.
- Set `RECEIPTS_MCP_ACTOR_ID` and `RECEIPTS_MCP_KEY_ID` to something Claude Code-specific if you use multiple MCP clients against the same upstream server.
- Set `RECEIPTS_MCP_TOOL_SERVER` so emitted receipts carry a stable upstream server label.
- Use `RECEIPTS_MCP_UPSTREAM_CWD` when the upstream server expects to start from a particular workspace.

Claude Code also supports environment variable expansion in `.mcp.json`, so you can swap absolute paths for `${VAR}` or `${VAR:-default}` patterns once you know your team rollout model.

## Smoke Test

1. Build `receipts-mcp`.
2. Copy the example into the target repo as `.mcp.json` and replace the placeholder paths.
3. Start Claude Code in that repo.
4. Run `/mcp` and confirm that `receipts-mcp` is connected.
5. Trigger one of the upstream server's tools and confirm that receipts appear in the configured sink output.

## Current Limitations

- This pack is stdio-only because `receipts-mcp` does not yet expose streamable HTTP transport.
- Receipt emission currently covers tool calls, not prompts or resources.
- Local-scope and user-scope variants are supported by Claude Code, but this starter pack intentionally uses the shared project-scope path.