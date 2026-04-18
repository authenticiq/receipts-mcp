# receipts-mcp Guidelines

This repo is the integration surface that emits receipts from MCP tool traffic.

## Current phase

- scaffold-stage public repo
- workflow and policy baseline exists
- implementation has not landed yet

## What this repo must preserve

- compatibility with `agent-receipts`
- transparent MCP forwarding behavior
- explicit and documented failure handling
- neutral OSS positioning with no required StrataCodes dependency

## Before making changes

1. Read `README.md`, `SECURITY.md`, and `CONTRIBUTING.md`.
2. Inspect existing workflows and repo status.
3. Check whether the change affects receipt emission, sink behavior, config examples, or integration docs.

## Current validation baseline

- `../.tools/gitleaks dir . --config gitleaks.toml`

## Target validation baseline once implementation lands

- format/lint
- unit tests
- integration test against a mock upstream MCP server
- verification that emitted receipts pass `agent-receipts`

## Repo rules

- Do not add hidden hosted dependencies to the default verification or emission path.
- Keep failure mode decisions explicit: fail-open vs fail-closed must be documented, not accidental.
- Example client configs are part of the product surface and must be maintained like code.
- If a change would affect emitted receipt shape, verify the downstream contract impact before shipping.