import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { FileReceiptSink } from '../src/sinks/file.js';
import { GitReceiptSink } from '../src/sinks/git.js';
import { HttpReceiptSink } from '../src/sinks/http.js';
import { StdoutReceiptSink } from '../src/sinks/stdout.js';
import type { Receipt } from '../src/types.js';

const sampleReceipt: Receipt = {
  schema_version: 'agent-receipts/v1',
  receipt_id: '01JTEST0000000000000000000',
  issued_at: '2026-04-18T18:00:00.000Z',
  payload: {
    event_type: 'tool_call',
    actor: {
      kind: 'agent',
      id: 'agent:test',
    },
    tool: {
      name: 'filesystem.read',
      transport: 'mcp',
    },
    inputs_hash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    outputs_hash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
  },
  signature: {
    alg: 'ml-dsa87',
    key_id: 'demo',
    encoding: 'base64',
    value: 'c2ln',
  },
};

describe('sinks', () => {
  it('writes stdout receipts as JSON lines', async () => {
    let output = '';
    const sink = new StdoutReceiptSink({
      write(chunk: string) {
        output += chunk;
        return true;
      },
    });

    await sink.write(sampleReceipt);

    expect(output.trim()).toBe(JSON.stringify(sampleReceipt));
  });

  it('appends receipts to a file sink', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'receipts-mcp-file-'));
    const filePath = join(tempDir, 'receipts.jsonl');
    const sink = new FileReceiptSink(filePath);

    await sink.write(sampleReceipt);

    const content = await readFile(filePath, 'utf8');
    expect(content.trim()).toBe(JSON.stringify(sampleReceipt));
  });

  it('posts receipts with the http sink', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const sink = new HttpReceiptSink({
      url: 'https://example.com/ingest',
      fetchImpl,
    });

    await sink.write(sampleReceipt);

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('writes receipts into a deterministic git ledger path', async () => {
    const repoPath = await mkdtemp(join(tmpdir(), 'receipts-mcp-git-'));
    const sink = new GitReceiptSink(repoPath);

    await sink.write(sampleReceipt);

    const content = await readFile(join(repoPath, 'receipts', '2026', '04', '18', 'receipts.jsonl'), 'utf8');
    expect(content.trim()).toBe(JSON.stringify(sampleReceipt));
  });
});