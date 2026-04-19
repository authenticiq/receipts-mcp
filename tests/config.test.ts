import { describe, expect, it } from 'vitest';

import { loadConfigFromEnv } from '../src/config.js';

describe('config', () => {
  it('loads defaults from an empty environment', () => {
    const config = loadConfigFromEnv({});

    expect(config.failOpen).toBe(true);
    expect(config.actor.id).toBe('agent:receipts-mcp');
    expect(config.sinks.kinds).toEqual(['stdout']);
  });

  it('requires sink-specific settings', () => {
    expect(() => loadConfigFromEnv({ RECEIPTS_MCP_SINKS: 'file' })).toThrow(
      'RECEIPTS_MCP_FILE_PATH is required',
    );
  });
});
