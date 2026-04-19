# receipts-mcp Design

`receipts-mcp` is a transparent receipting layer for MCP server traffic.

The current signed evidence surface is tool calls. Prompt and resource requests are forwarded transparently so the proxy can sit in front of a broader MCP server without altering those response shapes.

This document captures the Week 2 internal build shape before the full launch surface lands.

## Shim topology

Target topology:

`client -> receipts-mcp -> upstream MCP server`

The shim sits in the middle of the MCP request path. For tool calls, it forwards the invocation upstream, captures the request and response payloads, signs a receipt that matches the `agent-receipts/v1` contract, writes that receipt to one or more sinks, and then returns the upstream response to the client.

For prompt and resource requests, it behaves as a transparent proxy and returns the upstream result without receipt emission.

The current internal build focuses on the core emission pipeline first:

- deterministic payload capture and hashing
- ML-DSA-87 signing
- sink fan-out with explicit failure handling
- a transport-agnostic shim core that can wrap future MCP SDK forwarding

That keeps the hard parts testable before the full transport integration lands.

## Per-tool-call lifecycle

1. Receive tool call metadata and arguments.
2. Forward the call to the upstream execution layer.
3. Capture the upstream response.
4. Hash inputs and outputs with deterministic byte handling.
5. Canonicalize and sign the receipt payload.
6. Emit the signed receipt to the configured sinks.
7. Return the upstream tool result to the client.

The receipt path must not silently mutate the upstream response. Receipts are side-channel evidence, not a replacement response format.

## Forwarded non-tool surfaces

The current forwarding layer also passes through the non-tool surfaces that common MCP clients expect when an upstream server exposes them:

- `prompts/list`
- `prompts/get`
- `resources/list`
- `resources/templates/list`
- `resources/read`
- `resources/subscribe`
- `resources/unsubscribe`

These requests do not currently emit receipts. That keeps the signing contract narrowly scoped to the initial audit target, while still allowing the proxy to front more complete MCP servers during integration.

## Forwarded notifications

The current proxy also forwards the small notification surface needed to keep stdio clients coherent when the upstream server changes underneath them:

- `notifications/tools/list_changed`
- `notifications/prompts/list_changed`
- `notifications/resources/list_changed`
- `notifications/resources/updated`

Resource-updated notifications are only forwarded for URIs the downstream client subscribed to through the proxy.

## Core interfaces

The internal build centers on a small number of interfaces:

```ts
interface ReceiptSink {
  write(receipt: Receipt): Promise<void>;
}

type UpstreamToolInvoker = (call: ToolCallContext) => Promise<ToolCallResult>;
```

This keeps sink behavior and forwarding behavior separable. The MCP SDK transport layer can later adapt these primitives without changing receipt generation rules.

## Failure modes

Receipt emission failures are explicit and configurable.

- `failOpen=true`: tool calls still succeed even if one or more sinks fail.
- `failOpen=false`: sink failures abort the tool call after upstream execution.

Default for the internal build is `failOpen=true`, because audit fan-out should not accidentally become an availability outage during early deployment.

When multiple sinks fail, the shim aggregates the failures into a single error surface.

## Key handling

The internal build supports ML-DSA-87 via `@noble/post-quantum`.

- Dev mode: generate a deterministic signer from a supplied seed or a random one if no seed is provided.
- Prod mode target: load key material from environment or an external plugin.

The long-term public surface should keep key custody outside the shim wherever possible. The shim may load private key material, but it should not become a full key-management product.

## Sinks

The initial sink set matches the Week 2 plan:

- `stdout`: newline-delimited JSON receipts for local observation
- `file`: append-only JSONL file
- `http`: POST each receipt to an ingest endpoint
- `git`: append receipts to a deterministic path inside a local git-backed ledger directory

The `git` sink is intentionally simple in the internal build. It writes append-only receipt logs under a deterministic date path, which keeps it compatible with future `ledger-mirror` work without over-coupling the projects before Project 3 starts.

## Transport integration status

The internal build now includes a real stdio-based forwarding path:

- `StdioUpstreamMcpClient` spawns and connects to an upstream MCP server over stdio
- `TransparentToolProxyServer` exposes tools, prompts, resource read/list/subscribe surfaces, and forwards list/resource notifications while emitting receipts for upstream tool calls
- `src/cli.ts` starts the proxy from environment configuration for local development

This is intentionally a narrow first transport slice.

Still pending:

- Streamable HTTP transport support
- broader notification coverage beyond list-change and resource-updated events
- additional client config packs and demos beyond Claude Desktop, Cursor, VS Code, Claude Code, and the OpenAI developer or ChatGPT remote pack

Current local-development client packs:

- Claude Desktop
- Cursor
- VS Code
- Claude Code

Current remote-target developer pack:

- OpenAI developer or ChatGPT MCP integration, documented against OpenAI's remote MCP tool surface and blocked on remote transport support in `receipts-mcp`

The OpenAI developer or ChatGPT pack is intentionally documented as a deployment target rather than a drop-in local config. OpenAI's current MCP support is remote-server oriented and expects a public HTTP or SSE endpoint, while `receipts-mcp` currently ships only a local stdio transport.

The split between receipt core and transport wiring is still useful:

- it keeps the receipt contract logic testable without transport noise
- it allows stdio to land before the broader transport matrix
- it makes contract validation against `agent-receipts` easier during early development