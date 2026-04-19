# receipts-mcp Design

`receipts-mcp` is a transparent receipting layer for MCP tool traffic.

This document captures the Week 2 internal build shape before the full launch surface lands.

## Shim topology

Target topology:

`client -> receipts-mcp -> upstream MCP server`

The shim sits in the middle of the tool-call path. It forwards the tool invocation upstream, captures the request and response payloads, signs a receipt that matches the `agent-receipts/v1` contract, writes that receipt to one or more sinks, and then returns the upstream response to the client.

The current internal build focuses on the core emission pipeline first:

- deterministic payload capture and hashing
- ML-DSA-87 signing
- sink fan-out with explicit failure handling
- a transport-agnostic shim core that can wrap future MCP SDK forwarding

That keeps the hard parts testable before the full transport integration lands.

## Per-call lifecycle

1. Receive tool call metadata and arguments.
2. Forward the call to the upstream execution layer.
3. Capture the upstream response.
4. Hash inputs and outputs with deterministic byte handling.
5. Canonicalize and sign the receipt payload.
6. Emit the signed receipt to the configured sinks.
7. Return the upstream tool result to the client.

The receipt path must not silently mutate the upstream response. Receipts are side-channel evidence, not a replacement response format.

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
- `TransparentToolProxyServer` exposes `tools/list` and `tools/call` through a local proxy server while emitting receipts for each upstream call
- `src/cli.ts` starts the proxy from environment configuration for local development

This is intentionally a narrow first transport slice.

Still pending:

- Streamable HTTP transport support
- prompt and resource forwarding beyond the tool surface
- release-grade client config packs and demos

The split between receipt core and transport wiring is still useful:

- it keeps the receipt contract logic testable without transport noise
- it allows stdio to land before the broader transport matrix
- it makes contract validation against `agent-receipts` easier during early development