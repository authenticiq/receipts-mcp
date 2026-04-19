import { loadConfigFromEnv } from './config.js';
import { forwardToolCall } from './forward.js';
import { createMlDsa87Signer, emitSignedReceipt } from './sign.js';
import { FileReceiptSink } from './sinks/file.js';
import { GitReceiptSink } from './sinks/git.js';
import { HttpReceiptSink } from './sinks/http.js';
import { StdoutReceiptSink } from './sinks/stdout.js';
import type {
  ReceiptSink,
  ReceiptingCallResult,
  ReceiptsMcpConfig,
  ToolCallContext,
  ToolCallResult,
  ToolDescriptor,
  UpstreamToolInvoker,
} from './types.js';
import { normalizeError, toJsonValue } from './utils.js';

export function createSinks(config: ReceiptsMcpConfig): ReceiptSink[] {
  return config.sinks.kinds.map((kind) => {
    switch (kind) {
      case 'stdout':
        return new StdoutReceiptSink();
      case 'file':
        return new FileReceiptSink(config.sinks.filePath!);
      case 'http':
        return new HttpReceiptSink({
          url: config.sinks.httpUrl!,
          headers: config.sinks.httpHeaders,
        });
      case 'git':
        return new GitReceiptSink(config.sinks.gitRepoPath!, {
          stage: config.sinks.gitStage,
        });
      default:
        throw new Error(`Unsupported sink: ${kind satisfies never}`);
    }
  });
}

async function writeToSinks(receipt: ReceiptingCallResult['receipt'], sinks: ReceiptSink[]): Promise<Error | undefined> {
  const failures: Error[] = [];

  for (const sink of sinks) {
    try {
      await sink.write(receipt);
    } catch (error) {
      failures.push(normalizeError(error, 'Receipt sink failed.'));
    }
  }

  if (failures.length === 0) {
    return undefined;
  }

  if (failures.length === 1) {
    return failures[0];
  }

  return new AggregateError(failures, 'Multiple receipt sinks failed.');
}

export class ReceiptingShim {
  private readonly sinks: ReceiptSink[];

  constructor(
    private readonly config: ReceiptsMcpConfig,
    private readonly invoke: UpstreamToolInvoker,
    sinks?: ReceiptSink[],
  ) {
    this.sinks = sinks ?? createSinks(config);
  }

  async callTool(call: ToolCallContext): Promise<ReceiptingCallResult> {
    const result = await forwardToolCall(this.invoke, call);
    const signer = createMlDsa87Signer({
      keyId: this.config.signer.keyId,
      seed: this.config.signer.seed,
    });
    const tool: ToolDescriptor = {
      name: call.name,
      server: this.config.toolDefaults.server ?? this.config.upstream.command,
      version: this.config.toolDefaults.version,
      transport: this.config.toolDefaults.transport,
    };

    const emission = await emitSignedReceipt(
      {
        eventType: 'tool_call',
        actor: this.config.actor,
        tool,
        input: call.arguments ?? null,
        output: normalizeToolResult(result),
        parentReceiptId: call.parentReceiptId,
        hashAlgorithm: this.config.hashAlgorithm,
      },
      signer,
    );

    const sinkError = await writeToSinks(emission.receipt, this.sinks);
    if (sinkError && !this.config.failOpen) {
      throw sinkError;
    }

    return {
      result,
      receipt: emission.receipt,
      publicKey: emission.publicKey,
      sinkError,
    };
  }
}

export function normalizeToolResult(result: ToolCallResult) {
  if (result.structuredContent !== undefined) {
    return toJsonValue(result.structuredContent);
  }

  if (result.content !== undefined) {
    return toJsonValue(result.content);
  }

  return toJsonValue(result);
}

export function createShimFromEnv(invoke: UpstreamToolInvoker): ReceiptingShim {
  return new ReceiptingShim(loadConfigFromEnv(), invoke);
}
