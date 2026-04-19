import { startStdioProxyFromEnv } from './stdio.js';

async function main(): Promise<void> {
  const proxy = await startStdioProxyFromEnv();

  const shutdown = async () => {
    await proxy.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

main().catch((error: unknown) => {
  const normalized = error instanceof Error ? error : new Error(String(error));
  process.stderr.write(`${normalized.message}\n`);
  process.exit(1);
});
