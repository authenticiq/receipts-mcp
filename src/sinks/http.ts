import type { Receipt, ReceiptSink } from '../types.js';

export interface HttpReceiptSinkOptions {
  url: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export class HttpReceiptSink implements ReceiptSink {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpReceiptSinkOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async write(receipt: Receipt): Promise<void> {
    const response = await this.fetchImpl(this.options.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.options.headers ?? {}),
      },
      body: JSON.stringify(receipt),
    });

    if (!response.ok) {
      throw new Error(`HTTP sink failed with ${response.status} ${response.statusText}`);
    }
  }
}
