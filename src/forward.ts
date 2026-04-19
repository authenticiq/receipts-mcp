import type { ToolCallContext, ToolCallResult, UpstreamToolInvoker } from './types.js';

export async function forwardToolCall(
  invoke: UpstreamToolInvoker,
  call: ToolCallContext,
): Promise<ToolCallResult> {
  return invoke(call);
}
