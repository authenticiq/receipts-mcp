import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SubscribeRequestSchema, UnsubscribeRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import z from 'zod';

const server = new McpServer({
  name: 'mock-upstream',
  version: '1.0.0',
});
const resourceSubscriptions = new Set();

server.server.registerCapabilities({
  resources: {
    subscribe: true,
  },
});
server.server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  resourceSubscriptions.add(request.params.uri);
  return {};
});
server.server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  resourceSubscriptions.delete(request.params.uri);
  return {};
});

server.registerTool(
  'echo',
  {
    description: 'Echo back the provided message.',
    inputSchema: {
      message: z.string(),
    },
  },
  async ({ message }) => ({
    content: [
      {
        type: 'text',
        text: `echo:${message}`,
      },
    ],
    structuredContent: {
      echoed: message,
    },
  }),
);

server.registerTool(
  'trigger-list-changes',
  {
    description: 'Emit tool, prompt, and resource list-changed notifications.',
  },
  async () => {
    await server.sendToolListChanged();
    await server.sendPromptListChanged();
    await server.sendResourceListChanged();

    return {
      content: [
        {
          type: 'text',
          text: 'list-changed notifications emitted',
        },
      ],
      structuredContent: {
        emitted: true,
      },
    };
  },
);

server.registerTool(
  'trigger-resource-update',
  {
    description: 'Emit a resource-updated notification for a subscribed URI.',
    inputSchema: {
      uri: z.string(),
    },
  },
  async ({ uri }) => {
    const notified = resourceSubscriptions.has(uri);
    if (notified) {
      await server.server.sendResourceUpdated({
        uri,
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: notified ? `resource-updated:${uri}` : `resource-not-subscribed:${uri}`,
        },
      ],
      structuredContent: {
        notified,
        uri,
      },
    };
  },
);

server.registerPrompt(
  'greeting-template',
  {
    description: 'Generate a simple greeting prompt for the provided name.',
    argsSchema: {
      name: z.string(),
    },
  },
  async ({ name }) => ({
    description: `Greeting prompt for ${name}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please greet ${name} in a friendly manner.`,
        },
      },
    ],
  }),
);

server.registerResource(
  'default-greeting',
  'https://example.com/greetings/default',
  {
    description: 'A static greeting resource.',
    mimeType: 'text/plain',
  },
  async () => ({
    contents: [
      {
        uri: 'https://example.com/greetings/default',
        mimeType: 'text/plain',
        text: 'Hello, world!',
      },
    ],
  }),
);

server.registerResource(
  'note-template',
  new ResourceTemplate('memo:///notes/{slug}', {
    list: undefined,
  }),
  {
    description: 'A simple dynamic note resource.',
    mimeType: 'text/plain',
  },
  async (uri) => {
    const slug = uri.pathname.split('/').at(-1) ?? 'unknown';

    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'text/plain',
          text: `note:${slug}`,
        },
      ],
    };
  },
);

await server.connect(new StdioServerTransport());
