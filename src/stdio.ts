import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  DEFAULT_INHERITED_ENV_VARS,
  StdioClientTransport,
  type StdioServerParameters,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server, type ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type CallToolResult,
  type ListToolsRequest,
  type ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfigFromEnv } from './config.js';
import { ReceiptingShim, createSinks } from './server.js';
import type {
  ReceiptSink,
  ReceiptsMcpConfig,
  ToolCallContext,
  ToolCallResult,
} from './types.js';

function normalizeArguments(argumentsValue: ToolCallContext['arguments']): Record<string, unknown> | undefined {
  if (!argumentsValue || Array.isArray(argumentsValue) || typeof argumentsValue !== 'object') {
    return undefined;
  }

  return argumentsValue as Record<string, unknown>;
}

function normalizeEnv(env?: Record<string, string>): Record<string, string> | undefined {
  if (env) {
    return env;
  }

  const inherited: Record<string, string> = {};
  for (const key of DEFAULT_INHERITED_ENV_VARS) {
    const value = process.env[key];
    if (value !== undefined) {
      inherited[key] = value;
    }
  }
  return inherited;
}

export interface UpstreamToolClient {
  connect(): Promise<void>;
  listTools(params?: ListToolsRequest['params']): Promise<ListToolsResult>;
  callTool(call: ToolCallContext): Promise<ToolCallResult>;
  close(): Promise<void>;
}

export class StdioUpstreamMcpClient implements UpstreamToolClient {
  private readonly client = new Client(
    {
      name: 'receipts-mcp-upstream-client',
      version: '0.1.0-internal.0',
    },
    {
      capabilities: {},
    },
  );

  private readonly transport: StdioClientTransport;
  private connected = false;

  constructor(server: StdioServerParameters) {
    this.transport = new StdioClientTransport({
      ...server,
      env: normalizeEnv(server.env),
    });
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.client.connect(this.transport);
    this.connected = true;
  }

  async listTools(params?: ListToolsRequest['params']): Promise<ListToolsResult> {
    await this.connect();
    return this.client.listTools(params);
  }

  async callTool(call: ToolCallContext): Promise<ToolCallResult> {
    await this.connect();
    return this.client.callTool(
      {
        name: call.name,
        arguments: normalizeArguments(call.arguments),
      },
      CallToolResultSchema,
    );
  }

  async close(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.transport.close();
    this.connected = false;
  }
}

export interface ReceiptsProxyServerOptions {
  serverInfo?: {
    name: string;
    version: string;
  };
  serverOptions?: ServerOptions;
  sinks?: ReceiptSink[];
}

export class TransparentToolProxyServer {
  readonly server: Server;
  private readonly shim: ReceiptingShim;

  constructor(
    private readonly config: ReceiptsMcpConfig,
    private readonly upstream: UpstreamToolClient,
    options: ReceiptsProxyServerOptions = {},
  ) {
    this.server = new Server(
      options.serverInfo ?? {
        name: 'receipts-mcp',
        version: '0.1.0-internal.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        instructions:
          'Transparent MCP tool proxy that emits signed receipts for every upstream tool call.',
        ...(options.serverOptions ?? {}),
      },
    );

    this.shim = new ReceiptingShim(this.config, (call) => this.upstream.callTool(call), options.sinks);
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => this.upstream.listTools(request.params));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const response = await this.shim.callTool({
        name: request.params.name,
        arguments: request.params.arguments as ToolCallContext['arguments'],
      });

      return response.result as CallToolResult;
    });
  }

  async connect(transport: Transport): Promise<void> {
    await this.upstream.connect();
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
    await this.upstream.close();
  }

  static createInMemoryPair(
    config: ReceiptsMcpConfig,
    upstream: UpstreamToolClient,
    options: ReceiptsProxyServerOptions = {},
  ): [TransparentToolProxyServer, InMemoryTransport, InMemoryTransport] {
    const proxy = new TransparentToolProxyServer(config, upstream, options);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    return [proxy, clientTransport, serverTransport];
  }
}

export async function startStdioProxyFromEnv(): Promise<TransparentToolProxyServer> {
  const config = loadConfigFromEnv();
  if (!config.upstream.command) {
    throw new Error('RECEIPTS_MCP_UPSTREAM_COMMAND is required to start the stdio proxy.');
  }

  const upstream = new StdioUpstreamMcpClient({
    command: config.upstream.command,
    args: config.upstream.args,
    cwd: config.upstream.cwd,
  });
  const proxy = new TransparentToolProxyServer(config, upstream, {
    sinks: createSinks(config),
  });
  await proxy.connect(new StdioServerTransport());
  return proxy;
}
