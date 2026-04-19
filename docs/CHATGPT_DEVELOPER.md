# OpenAI Developer or ChatGPT Pack

OpenAI's current MCP support is different from the local desktop and editor clients already documented in this repository.

The official OpenAI surface is remote MCP, not local stdio configuration. Today, OpenAI developers can use MCP through:

- the Responses API with `tools: [{ "type": "mcp", ... }]`
- prompts or deep research tooling in the OpenAI platform
- ChatGPT Apps or custom MCP connections in ChatGPT settings

That means this pack is a deployment-target guide, not a plug-and-play local config like Claude Desktop, Cursor, VS Code, or Claude Code.

## Important Limitation

`receipts-mcp` currently ships only a local stdio transport.

OpenAI's documented MCP support expects a remote endpoint over HTTP or SSE. So this pack becomes directly usable only when one of the following is true:

- `receipts-mcp` grows native remote transport support
- you put `receipts-mcp` behind a trusted stdio-to-remote bridge

Until then, treat this as the target integration shape for the next transport phase rather than something you can wire up immediately.

## Developer Surface

The official OpenAI developer pattern uses an MCP tool definition with fields like:

- `type: "mcp"`
- `server_label`
- `server_description`
- `server_url`
- optional `allowed_tools`
- `require_approval`

Use [examples/chatgpt-developer/responses_mcp_request.example.json](../examples/chatgpt-developer/responses_mcp_request.example.json) as the starting point for a Responses API request body once `receipts-mcp` is reachable over a remote transport.

## ChatGPT and Deep Research Notes

- OpenAI documents custom remote MCP servers for ChatGPT Apps and deep research.
- For deep research-style flows, the docs call out that MCP servers used there should be configured with no approval required.
- ChatGPT-side setup is done through ChatGPT settings and Apps or Connectors, not through a checked-in local config file.

For `receipts-mcp`, that means the pack is more about deployment shape than file placement.

## Recommended Starting Point Once Remote Transport Exists

- Start with a read-oriented upstream server and keep the approval surface narrow.
- Use `allowed_tools` if the upstream server exposes many tools and you only want a small subset available through OpenAI.
- Use a stable `server_label` and `server_description` so the OpenAI tool selection surface remains understandable.
- Default to a trusted remote endpoint you control. OpenAI's docs are explicit that remote MCP servers should be treated as third-party systems with real data-exfiltration risk.

## Smoke Test

Once remote transport support exists in `receipts-mcp`:

1. Deploy `receipts-mcp` at a public HTTPS MCP endpoint.
2. Adapt the example request body with the real `server_url`.
3. Test it through the Responses API first.
4. If you want ChatGPT or deep research integration, connect the same remote endpoint through the OpenAI UI flow.
5. Confirm that upstream tool calls still emit receipts in the configured sink output.

## Current Limitations

- This pack is blocked on remote transport support in `receipts-mcp`.
- OpenAI's current docs focus on remote MCP and developer-side tool definitions, not a local config file for stdio servers.
- ChatGPT-side custom MCP deployment and deep research use cases may impose additional expectations around approval behavior and, in some cases, read-oriented tool design.