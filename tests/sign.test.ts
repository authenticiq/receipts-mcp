import { ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';
import { describe, expect, it } from 'vitest';

import { canonicalPayloadBytes } from '../src/capture.js';
import { createMlDsa87Signer, emitSignedReceipt } from '../src/sign.js';
import { base64Decode } from '../src/utils.js';

describe('sign', () => {
  it('emits a signed receipt that verifies with ml-dsa87', async () => {
    const signer = createMlDsa87Signer({
      keyId: 'demo-ml-dsa87',
      seed: new Uint8Array(32).fill(7),
    });

    const emission = await emitSignedReceipt(
      {
        eventType: 'tool_call',
        actor: {
          kind: 'agent',
          id: 'agent:demo',
          model: 'claude-sonnet-4',
        },
        tool: {
          name: 'filesystem.read',
          transport: 'mcp',
        },
        input: { path: 'README.md' },
        output: { bytes: 1024 },
      },
      signer,
    );

    expect(emission.receipt.signature.alg).toBe('ml-dsa87');
    expect(emission.receipt.schema_version).toBe('agent-receipts/v1');

    const isValid = ml_dsa87.verify(
      base64Decode(emission.receipt.signature.value),
      canonicalPayloadBytes(emission.receipt.payload),
      signer.publicKey,
    );

    expect(isValid).toBe(true);
  });
});
