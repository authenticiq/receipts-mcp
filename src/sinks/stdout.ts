import type { Receipt, ReceiptSink } from '../types.js';

export class StdoutReceiptSink implements ReceiptSink {
  constructor(private readonly writer: Pick<NodeJS.WritableStream, 'write'> = process.stdout) {}

  async write(receipt: Receipt): Promise<void> {
    this.writer.write(`${JSON.stringify(receipt)}\n`);
  }
}
