import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { ReceiptingShim } from '../src/server.js';
import { StdioUpstreamMcpClient, TransparentToolProxyServer } from '../src/stdio.js';
import type { Receipt, ReceiptSink, ReceiptsMcpConfig } from '../src/types.js';

const execFileAsync = promisify(execFile);
const fixturePath = resolve(process.cwd(), 'tests/fixtures/mock-upstream-server.mjs');
const agentReceiptsManifestPath = resolve(process.cwd(), '../agent-receipts/Cargo.toml');

class MemoryReceiptSink implements ReceiptSink {
  readonly receipts: Receipt[] = [];

  async write(receipt: Receipt): Promise<void> {
    this.receipts.push(receipt);
  }
}

function createTestConfig(): ReceiptsMcpConfig {
  return {
    failOpen: true,
    actor: {
      kind: 'agent',
      id: 'agent:receipts-mcp',
      model: 'claude-sonnet-4',
      session_id: 'session:test',
    },
    hashAlgorithm: 'sha256',
    signer: {
      keyId: 'receipts-mcp-test',
      seed: new Uint8Array(32).fill(9),
    },
    toolDefaults: {
      transport: 'mcp',
      server: 'mock-upstream',
      version: '1.0.0',
    },
    upstream: {
      command: process.execPath,
      args: [fixturePath],
      transport: 'stdio',
    },
    sinks: {
      kinds: ['stdout'],
      httpHeaders: {},
      gitStage: false,
    },
  };
}

describe('stdio forwarding', () => {
  it('lists and calls tools through a spawned stdio upstream server', async () => {
    const upstream = new StdioUpstreamMcpClient({
      command: process.execPath,
      args: [fixturePath],
      cwd: dirname(fixturePath),
      stderr: 'pipe',
    });

    try {
      const tools = await upstream.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain('echo');

      const result = await upstream.callTool({
        name: 'echo',
        arguments: {
          message: 'hello',
        },
      });

      expect(result.structuredContent).toEqual({
        echoed: 'hello',
      });
    } finally {
      await upstream.close();
    }
  });

  it('proxies tools/list and tools/call through the transparent server', async () => {
    const upstream = new StdioUpstreamMcpClient({
      command: process.execPath,
      args: [fixturePath],
      cwd: dirname(fixturePath),
      stderr: 'pipe',
    });
    const sink = new MemoryReceiptSink();
    const config = createTestConfig();
    const proxy = new TransparentToolProxyServer(config, upstream, {
      sinks: [sink],
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({
      name: 'receipts-mcp-test-client',
      version: '1.0.0',
    });

    try {
      await proxy.connect(serverTransport);
      await client.connect(clientTransport);

      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain('echo');

      const result = await client.callTool({
        name: 'echo',
        arguments: {
          message: 'proxied',
        },
      });

      expect(result.structuredContent).toEqual({
        echoed: 'proxied',
      });
      expect(sink.receipts).toHaveLength(1);
      expect(sink.receipts[0]?.payload.tool.name).toBe('echo');
    } finally {
      await client.close();
      await proxy.close();
    }
  });

  it('verifies emitted receipts with the local agent-receipts CLI when available', async () => {
    if (!existsSync(agentReceiptsManifestPath)) {
      return;
    }

    const upstream = new StdioUpstreamMcpClient({
      command: process.execPath,
      args: [fixturePath],
      cwd: dirname(fixturePath),
      stderr: 'pipe',
    });
    const sink = new MemoryReceiptSink();
    const config = createTestConfig();
    const shim = new ReceiptingShim(config, (call) => upstream.callTool(call), [sink]);

    try {
      const emission = await shim.callTool({
        name: 'echo',
        arguments: {
          message: 'verify-me',
        },
      });

      const tempDir = await mkdtemp(join(tmpdir(), 'receipts-mcp-verify-'));
      const keysDir = join(tempDir, 'keys');
      const receiptPath = join(tempDir, 'receipt.json');
      await mkdir(keysDir, { recursive: true });
      await writeFile(receiptPath, `${JSON.stringify(emission.receipt, null, 2)}\n`, 'utf8');
      await writeFile(
        join(keysDir, `${emission.publicKey.key_id}.public.json`),
        `${JSON.stringify(emission.publicKey, null, 2)}\n`,
        'utf8',
      );

      const verification = await execFileAsync(
        'cargo',
        [
          'run',
          '--manifest-path',
          agentReceiptsManifestPath,
          '--bin',
          'receipts',
          '--',
          'verify',
          receiptPath,
          '--keys-dir',
          keysDir,
        ],
        {
          cwd: process.cwd(),
        },
      );

      expect(verification.stdout).toContain('verify ok:');
      expect(sink.receipts).toHaveLength(1);
    } finally {
      await upstream.close();
    }
  }, 120000);
});