import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

await server.connect(new StdioServerTransport());
