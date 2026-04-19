import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import z from 'zod';

const server = new McpServer({
  name: 'mock-upstream',
  version: '1.0.0',
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
