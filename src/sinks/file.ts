import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { Receipt, ReceiptSink } from '../types.js';

export class FileReceiptSink implements ReceiptSink {
  constructor(private readonly filePath: string) {}

  async write(receipt: Receipt): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(receipt)}\n`, 'utf8');
  }
}
