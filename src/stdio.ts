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
  EmptyResultSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  PromptListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ResourceUpdatedNotificationSchema,
  SubscribeRequestSchema,
  ToolListChangedNotificationSchema,
  UnsubscribeRequestSchema,
  type CallToolRequest,
  type CallToolResult,
  type EmptyResult,
  type GetPromptRequest,
  type GetPromptResult,
  type ListPromptsRequest,
  type ListPromptsResult,
  type ListResourceTemplatesRequest,
  type ListResourceTemplatesResult,
  type ListResourcesRequest,
  type ListResourcesResult,
  type ListToolsRequest,
  type ListToolsResult,
  type ReadResourceRequest,
  type ReadResourceResult,
  type ResourceUpdatedNotification,
  type ServerCapabilities,
  type SubscribeRequest,
  type UnsubscribeRequest,
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

export interface UpstreamMcpClient {
  connect(): Promise<void>;
  getServerCapabilities(): ServerCapabilities | undefined;
  setNotificationHandlers(handlers: UpstreamMcpNotificationHandlers): void;
  listTools(params?: ListToolsRequest['params']): Promise<ListToolsResult>;
  callTool(call: ToolCallContext): Promise<ToolCallResult>;
  listPrompts(params?: ListPromptsRequest['params']): Promise<ListPromptsResult>;
  getPrompt(params: GetPromptRequest['params']): Promise<GetPromptResult>;
  listResources(params?: ListResourcesRequest['params']): Promise<ListResourcesResult>;
  listResourceTemplates(
    params?: ListResourceTemplatesRequest['params'],
  ): Promise<ListResourceTemplatesResult>;
  readResource(params: ReadResourceRequest['params']): Promise<ReadResourceResult>;
  subscribeResource(params: SubscribeRequest['params']): Promise<EmptyResult>;
  unsubscribeResource(params: UnsubscribeRequest['params']): Promise<EmptyResult>;
  close(): Promise<void>;
}

export interface UpstreamMcpNotificationHandlers {
  onToolListChanged?: () => Promise<void> | void;
  onPromptListChanged?: () => Promise<void> | void;
  onResourceListChanged?: () => Promise<void> | void;
  onResourceUpdated?: (params: ResourceUpdatedNotification['params']) => Promise<void> | void;
}

export type UpstreamToolClient = UpstreamMcpClient;

export class StdioUpstreamMcpClient implements UpstreamMcpClient {
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
  private notificationHandlers: UpstreamMcpNotificationHandlers = {};

  constructor(server: StdioServerParameters) {
    this.transport = new StdioClientTransport({
      ...server,
      env: normalizeEnv(server.env),
    });

    this.client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      await this.notificationHandlers.onToolListChanged?.();
    });
    this.client.setNotificationHandler(PromptListChangedNotificationSchema, async () => {
      await this.notificationHandlers.onPromptListChanged?.();
    });
    this.client.setNotificationHandler(ResourceListChangedNotificationSchema, async () => {
      await this.notificationHandlers.onResourceListChanged?.();
    });
    this.client.setNotificationHandler(ResourceUpdatedNotificationSchema, async (notification) => {
      await this.notificationHandlers.onResourceUpdated?.(notification.params);
    });
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.client.connect(this.transport);
    this.connected = true;
  }

  getServerCapabilities(): ServerCapabilities | undefined {
    return this.client.getServerCapabilities();
  }

  setNotificationHandlers(handlers: UpstreamMcpNotificationHandlers): void {
    this.notificationHandlers = {
      ...this.notificationHandlers,
      ...handlers,
    };
  }

  async listTools(params?: ListToolsRequest['params']): Promise<ListToolsResult> {
    await this.connect();
    return this.client.listTools(params);
  }

  async listPrompts(params?: ListPromptsRequest['params']): Promise<ListPromptsResult> {
    await this.connect();
    return this.client.listPrompts(params);
  }

  async getPrompt(params: GetPromptRequest['params']): Promise<GetPromptResult> {
    await this.connect();
    return this.client.getPrompt(params);
  }

  async listResources(params?: ListResourcesRequest['params']): Promise<ListResourcesResult> {
    await this.connect();
    return this.client.listResources(params);
  }

  async listResourceTemplates(
    params?: ListResourceTemplatesRequest['params'],
  ): Promise<ListResourceTemplatesResult> {
    await this.connect();
    return this.client.listResourceTemplates(params);
  }

  async readResource(params: ReadResourceRequest['params']): Promise<ReadResourceResult> {
    await this.connect();
    return this.client.readResource(params);
  }

  async subscribeResource(params: SubscribeRequest['params']): Promise<EmptyResult> {
    await this.connect();
    return this.client.subscribeResource(params);
  }

  async unsubscribeResource(params: UnsubscribeRequest['params']): Promise<EmptyResult> {
    await this.connect();
    return this.client.unsubscribeResource(params);
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
  private serverInstance?: Server;
  private readonly shim: ReceiptingShim;
  private readonly activeResourceSubscriptions = new Set<string>();
  private readonly serverInfo: {
    name: string;
    version: string;
  };
  private readonly serverOptions: ServerOptions;

  get server(): Server {
    if (!this.serverInstance) {
      throw new Error('Proxy server is not connected yet.');
    }

    return this.serverInstance;
  }

  constructor(
    private readonly config: ReceiptsMcpConfig,
    private readonly upstream: UpstreamMcpClient,
    options: ReceiptsProxyServerOptions = {},
  ) {
    this.serverInfo = options.serverInfo ?? {
      name: 'receipts-mcp',
      version: '0.1.0-internal.0',
    };
    this.serverOptions = options.serverOptions ?? {};
    this.shim = new ReceiptingShim(this.config, (call) => this.upstream.callTool(call), options.sinks);
    this.upstream.setNotificationHandlers({
      onToolListChanged: async () => this.forwardToolListChanged(),
      onPromptListChanged: async () => this.forwardPromptListChanged(),
      onResourceListChanged: async () => this.forwardResourceListChanged(),
      onResourceUpdated: async (params) => this.forwardResourceUpdated(params),
    });
  }

  private async sendIfConnected(send: (server: Server) => Promise<void>): Promise<void> {
    const server = this.serverInstance;
    if (!server?.transport) {
      return;
    }

    try {
      await send(server);
    } catch {
      // Ignore notification forwarding failures during disconnect races.
    }
  }

  private async forwardToolListChanged(): Promise<void> {
    await this.sendIfConnected((server) => server.sendToolListChanged());
  }

  private async forwardPromptListChanged(): Promise<void> {
    await this.sendIfConnected((server) => server.sendPromptListChanged());
  }

  private async forwardResourceListChanged(): Promise<void> {
    await this.sendIfConnected((server) => server.sendResourceListChanged());
  }

  private async forwardResourceUpdated(params: ResourceUpdatedNotification['params']): Promise<void> {
    if (!this.activeResourceSubscriptions.has(params.uri)) {
      return;
    }

    await this.sendIfConnected((server) => server.sendResourceUpdated(params));
  }

  private createServerCapabilities(upstreamCapabilities?: ServerCapabilities): ServerCapabilities {
    const capabilities: ServerCapabilities = {};

    if (!upstreamCapabilities || upstreamCapabilities.tools) {
      capabilities.tools = {
        listChanged: upstreamCapabilities?.tools?.listChanged ?? false,
      };
    }

    if (upstreamCapabilities?.prompts) {
      capabilities.prompts = {
        listChanged: upstreamCapabilities.prompts.listChanged ?? false,
      };
    }

    if (upstreamCapabilities?.resources) {
      capabilities.resources = {
        listChanged: upstreamCapabilities.resources.listChanged ?? false,
        subscribe: upstreamCapabilities.resources.subscribe ?? false,
      };
    }

    return capabilities;
  }

  private createServer(): Server {
    const derivedCapabilities = this.createServerCapabilities(this.upstream.getServerCapabilities());
    const capabilities = {
      ...derivedCapabilities,
      ...(this.serverOptions.capabilities ?? {}),
    };
    const server = new Server(this.serverInfo, {
      ...this.serverOptions,
      capabilities,
      instructions:
        this.serverOptions.instructions ??
        'Transparent MCP proxy that forwards tool, prompt, and resource traffic while emitting signed receipts for upstream tool calls.',
    });

    if (capabilities.tools) {
      server.setRequestHandler(ListToolsRequestSchema, async (request) => this.upstream.listTools(request.params));
      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const response = await this.shim.callTool({
          name: request.params.name,
          arguments: request.params.arguments as ToolCallContext['arguments'],
        });

        return response.result as CallToolResult;
      });
    }

    if (capabilities.prompts) {
      server.setRequestHandler(ListPromptsRequestSchema, async (request) => this.upstream.listPrompts(request.params));
      server.setRequestHandler(GetPromptRequestSchema, async (request) => this.upstream.getPrompt(request.params));
    }

    if (capabilities.resources) {
      server.setRequestHandler(ListResourcesRequestSchema, async (request) => this.upstream.listResources(request.params));
      server.setRequestHandler(ListResourceTemplatesRequestSchema, async (request) =>
        this.upstream.listResourceTemplates(request.params),
      );
      server.setRequestHandler(ReadResourceRequestSchema, async (request) => this.upstream.readResource(request.params));

      if (capabilities.resources.subscribe) {
        server.setRequestHandler(SubscribeRequestSchema, async (request) => {
          const result = await this.upstream.subscribeResource(request.params);
          this.activeResourceSubscriptions.add(request.params.uri);
          return EmptyResultSchema.parse(result);
        });
        server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
          const result = await this.upstream.unsubscribeResource(request.params);
          this.activeResourceSubscriptions.delete(request.params.uri);
          return EmptyResultSchema.parse(result);
        });
      }
    }

    return server;
  }

  async connect(transport: Transport): Promise<void> {
    await this.upstream.connect();
    if (!this.serverInstance) {
      this.serverInstance = this.createServer();
    }

    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    if (this.serverInstance) {
      await this.serverInstance.close();
      this.serverInstance = undefined;
    }

    this.activeResourceSubscriptions.clear();
    await this.upstream.close();
  }

  static createInMemoryPair(
    config: ReceiptsMcpConfig,
    upstream: UpstreamMcpClient,
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
