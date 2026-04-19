import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { Receipt, ReceiptSink } from '../types.js';

const execFileAsync = promisify(execFile);

function buildLedgerPath(repoPath: string, issuedAt: string): string {
  const [year, month, day] = issuedAt.slice(0, 10).split('-');
  return join(repoPath, 'receipts', year, month, day, 'receipts.jsonl');
}

export class GitReceiptSink implements ReceiptSink {
  constructor(
    private readonly repoPath: string,
    private readonly options: {
      stage?: boolean;
    } = {},
  ) {}

  async write(receipt: Receipt): Promise<void> {
    const ledgerPath = buildLedgerPath(this.repoPath, receipt.issued_at);
    await mkdir(join(this.repoPath, 'receipts', receipt.issued_at.slice(0, 4), receipt.issued_at.slice(5, 7), receipt.issued_at.slice(8, 10)), {
      recursive: true,
    });
    await appendFile(ledgerPath, `${JSON.stringify(receipt)}\n`, 'utf8');

    if (this.options.stage) {
      await execFileAsync('git', ['-C', this.repoPath, 'add', ledgerPath]);
    }
  }
}
