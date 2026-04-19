import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  PromptListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  ResourceUpdatedNotificationSchema,
  ToolListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
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

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
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
  it('lists and fetches tools, prompts, and resources through a spawned stdio upstream server', async () => {
    const upstream = new StdioUpstreamMcpClient({
      command: process.execPath,
      args: [fixturePath],
      cwd: dirname(fixturePath),
      stderr: 'pipe',
    });

    try {
      await upstream.connect();

      const capabilities = upstream.getServerCapabilities();
      expect(capabilities?.tools).toBeDefined();
      expect(capabilities?.prompts).toBeDefined();
      expect(capabilities?.resources).toBeDefined();
      expect(capabilities?.resources?.subscribe).toBe(true);

      const tools = await upstream.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain('echo');

      const prompts = await upstream.listPrompts();
      expect(prompts.prompts.map((prompt) => prompt.name)).toContain('greeting-template');

      const prompt = await upstream.getPrompt({
        name: 'greeting-template',
        arguments: {
          name: 'Ada',
        },
      });
      expect(prompt.messages[0]?.content).toMatchObject({
        type: 'text',
        text: 'Please greet Ada in a friendly manner.',
      });

      const resources = await upstream.listResources();
      expect(resources.resources.map((resource) => resource.uri)).toContain(
        'https://example.com/greetings/default',
      );

      const templates = await upstream.listResourceTemplates();
      expect(templates.resourceTemplates.map((template) => template.uriTemplate)).toContain('memo:///notes/{slug}');

      const resource = await upstream.readResource({
        uri: 'memo:///notes/example',
      });
      expect(resource.contents).toContainEqual(
        expect.objectContaining({
          uri: 'memo:///notes/example',
          text: 'note:example',
        }),
      );

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

  it('proxies tools, prompts, and resources through the transparent server', async () => {
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

      const capabilities = client.getServerCapabilities();
      expect(capabilities?.tools).toBeDefined();
      expect(capabilities?.prompts).toBeDefined();
      expect(capabilities?.resources).toEqual(
        expect.objectContaining({
          subscribe: true,
        }),
      );

      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain('echo');

      const prompts = await client.listPrompts();
      expect(prompts.prompts.map((prompt) => prompt.name)).toContain('greeting-template');

      const prompt = await client.getPrompt({
        name: 'greeting-template',
        arguments: {
          name: 'Grace',
        },
      });
      expect(prompt.messages[0]?.content).toMatchObject({
        type: 'text',
        text: 'Please greet Grace in a friendly manner.',
      });

      const resources = await client.listResources();
      expect(resources.resources.map((resource) => resource.uri)).toContain(
        'https://example.com/greetings/default',
      );

      const templates = await client.listResourceTemplates();
      expect(templates.resourceTemplates.map((template) => template.uriTemplate)).toContain('memo:///notes/{slug}');

      const resource = await client.readResource({
        uri: 'memo:///notes/proxy',
      });
      expect(resource.contents).toContainEqual(
        expect.objectContaining({
          uri: 'memo:///notes/proxy',
          text: 'note:proxy',
        }),
      );
      expect(sink.receipts).toHaveLength(0);

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

  it('forwards resource subscriptions and upstream notifications through the transparent server', async () => {
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
    const toolListChanged = createDeferred<void>();
    const promptListChanged = createDeferred<void>();
    const resourceListChanged = createDeferred<void>();
    const firstResourceUpdate = createDeferred<string>();
    const resourceUpdates: string[] = [];
    const client = new Client({
      name: 'receipts-mcp-test-client',
      version: '1.0.0',
    });

    client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
      toolListChanged.resolve();
    });
    client.setNotificationHandler(PromptListChangedNotificationSchema, () => {
      promptListChanged.resolve();
    });
    client.setNotificationHandler(ResourceListChangedNotificationSchema, () => {
      resourceListChanged.resolve();
    });
    client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification) => {
      resourceUpdates.push(notification.params.uri);
      if (resourceUpdates.length === 1) {
        firstResourceUpdate.resolve(notification.params.uri);
      }
    });

    try {
      await proxy.connect(serverTransport);
      await client.connect(clientTransport);

      expect(client.getServerCapabilities()?.resources).toEqual(
        expect.objectContaining({
          subscribe: true,
        }),
      );

      await client.subscribeResource({
        uri: 'memo:///notes/watch',
      });

      const listChangeResult = await client.callTool({
        name: 'trigger-list-changes',
      });
      expect(listChangeResult.structuredContent).toEqual({
        emitted: true,
      });

      await Promise.all([
        toolListChanged.promise,
        promptListChanged.promise,
        resourceListChanged.promise,
      ]);

      const firstUpdateResult = await client.callTool({
        name: 'trigger-resource-update',
        arguments: {
          uri: 'memo:///notes/watch',
        },
      });
      expect(firstUpdateResult.structuredContent).toEqual({
        notified: true,
        uri: 'memo:///notes/watch',
      });

      await expect(firstResourceUpdate.promise).resolves.toBe('memo:///notes/watch');
      expect(resourceUpdates).toEqual(['memo:///notes/watch']);

      await client.unsubscribeResource({
        uri: 'memo:///notes/watch',
      });

      const secondUpdateResult = await client.callTool({
        name: 'trigger-resource-update',
        arguments: {
          uri: 'memo:///notes/watch',
        },
      });
      expect(secondUpdateResult.structuredContent).toEqual({
        notified: false,
        uri: 'memo:///notes/watch',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(resourceUpdates).toEqual(['memo:///notes/watch']);
      expect(sink.receipts).toHaveLength(3);
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