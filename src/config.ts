import { z } from 'zod';

import type { ReceiptsMcpConfig, SinkKind, ToolTransport } from './types.js';
import { base64Decode } from './utils.js';

const actorKindSchema = z.enum(['agent', 'human', 'system']);
const sinkKindSchema = z.enum(['stdout', 'file', 'http', 'git']);
const transportSchema = z.enum(['mcp', 'http', 'local']);

function parseSinkKinds(raw: string | undefined): SinkKind[] {
  if (!raw) {
    return ['stdout'];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is SinkKind => sinkKindSchema.safeParse(value).success);
}

function parseArgs(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
      return parsed;
    }
  } catch {
    // Fall back to shell-like space splitting below.
  }

  return raw
    .split(' ')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseBoolean(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const envSchema = z
  .object({
    failOpen: z.boolean().default(true),
    actor: z.object({
      kind: actorKindSchema.default('agent'),
      id: z.string().min(1).default('agent:receipts-mcp'),
      model: z.string().optional(),
      session_id: z.string().optional(),
    }),
    hashAlgorithm: z.enum(['sha256', 'sha512']).default('sha256'),
    signer: z.object({
      keyId: z.string().min(1).default('receipts-mcp-dev'),
      seed: z.instanceof(Uint8Array).optional(),
    }),
    toolDefaults: z.object({
      server: z.string().optional(),
      version: z.string().optional(),
      transport: transportSchema.default('mcp'),
    }),
    upstream: z.object({
      command: z.string().optional(),
      args: z.array(z.string()).default([]),
      cwd: z.string().optional(),
      transport: z.literal('stdio').default('stdio'),
    }),
    sinks: z.object({
      kinds: z.array(sinkKindSchema).min(1).default(['stdout']),
      filePath: z.string().optional(),
      httpUrl: z.string().url().optional(),
      httpHeaders: z.record(z.string(), z.string()).default({}),
      gitRepoPath: z.string().optional(),
      gitStage: z.boolean().default(false),
    }),
  })
  .superRefine((value, ctx) => {
    if (value.sinks.kinds.includes('file') && !value.sinks.filePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RECEIPTS_MCP_FILE_PATH is required when the file sink is enabled.',
      });
    }

    if (value.sinks.kinds.includes('http') && !value.sinks.httpUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RECEIPTS_MCP_HTTP_URL is required when the http sink is enabled.',
      });
    }

    if (value.sinks.kinds.includes('git') && !value.sinks.gitRepoPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RECEIPTS_MCP_GIT_REPO_PATH is required when the git sink is enabled.',
      });
    }
  });

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ReceiptsMcpConfig {
  return envSchema.parse({
    failOpen: parseBoolean(env.RECEIPTS_MCP_FAIL_OPEN, true),
    actor: {
      kind: (env.RECEIPTS_MCP_ACTOR_KIND as ReceiptsMcpConfig['actor']['kind'] | undefined) ?? 'agent',
      id: env.RECEIPTS_MCP_ACTOR_ID ?? 'agent:receipts-mcp',
      model: env.RECEIPTS_MCP_ACTOR_MODEL,
      session_id: env.RECEIPTS_MCP_SESSION_ID,
    },
    hashAlgorithm: env.RECEIPTS_MCP_HASH_ALGORITHM ?? 'sha256',
    signer: {
      keyId: env.RECEIPTS_MCP_KEY_ID ?? 'receipts-mcp-dev',
      seed: env.RECEIPTS_MCP_SEED_BASE64 ? base64Decode(env.RECEIPTS_MCP_SEED_BASE64) : undefined,
    },
    toolDefaults: {
      server: env.RECEIPTS_MCP_TOOL_SERVER,
      version: env.RECEIPTS_MCP_TOOL_VERSION,
      transport: (env.RECEIPTS_MCP_TOOL_TRANSPORT as ToolTransport | undefined) ?? 'mcp',
    },
    upstream: {
      command: env.RECEIPTS_MCP_UPSTREAM_COMMAND,
      args: parseArgs(env.RECEIPTS_MCP_UPSTREAM_ARGS),
      cwd: env.RECEIPTS_MCP_UPSTREAM_CWD,
      transport: 'stdio',
    },
    sinks: {
      kinds: parseSinkKinds(env.RECEIPTS_MCP_SINKS),
      filePath: env.RECEIPTS_MCP_FILE_PATH,
      httpUrl: env.RECEIPTS_MCP_HTTP_URL,
      httpHeaders: {},
      gitRepoPath: env.RECEIPTS_MCP_GIT_REPO_PATH,
      gitStage: parseBoolean(env.RECEIPTS_MCP_GIT_STAGE, false),
    },
  });
}
