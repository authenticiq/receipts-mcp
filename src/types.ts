export const RECEIPT_SCHEMA_VERSION = 'agent-receipts/v1';
export const KEY_FIXTURE_SCHEMA_VERSION = 'agent-receipts/key-fixture/v1';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ActorKind = 'agent' | 'human' | 'system';
export type ToolTransport = 'mcp' | 'http' | 'local';
export type SignatureAlgorithm = 'ml-dsa87' | 'ed25519';
export type HashAlgorithm = 'sha256' | 'sha512';
export type SinkKind = 'stdout' | 'file' | 'http' | 'git';

export interface Actor {
  kind: ActorKind;
  id: string;
  model?: string;
  session_id?: string;
}

export interface ToolDescriptor {
  name: string;
  version?: string;
  server?: string;
  transport: ToolTransport;
}

export interface ReceiptPayload {
  event_type: string;
  actor: Actor;
  tool: ToolDescriptor;
  inputs_hash: string;
  outputs_hash: string;
  parent_receipt_id?: string;
}

export interface SignatureBlock {
  alg: SignatureAlgorithm;
  key_id: string;
  encoding: 'base64';
  value: string;
}

export interface Receipt {
  schema_version: typeof RECEIPT_SCHEMA_VERSION;
  receipt_id: string;
  issued_at: string;
  payload: ReceiptPayload;
  signature: SignatureBlock;
}

export interface PublicKeyFixture {
  schema_version: typeof KEY_FIXTURE_SCHEMA_VERSION;
  key_id: string;
  alg: SignatureAlgorithm;
  encoding: 'base64';
  value: string;
}

export interface ReceiptSigner {
  alg: SignatureAlgorithm;
  keyId: string;
  publicKey: Uint8Array;
  sign(message: Uint8Array): Promise<Uint8Array> | Uint8Array;
}

export interface EmitReceiptInput {
  eventType: string;
  actor: Actor;
  tool: ToolDescriptor;
  input: unknown;
  output: unknown;
  parentReceiptId?: string;
  receiptId?: string;
  issuedAt?: string;
  hashAlgorithm?: HashAlgorithm;
}

export interface ReceiptEmission {
  receipt: Receipt;
  publicKey: PublicKeyFixture;
}

export interface ReceiptSink {
  write(receipt: Receipt): Promise<void>;
}

export interface ToolCallContext {
  name: string;
  arguments?: JsonValue;
  parentReceiptId?: string;
}

export interface ToolCallResult {
  content?: unknown;
  structuredContent?: unknown;
  isError?: boolean;
  [key: string]: unknown;
}

export type UpstreamToolInvoker = (call: ToolCallContext) => Promise<ToolCallResult>;

export interface ReceiptsMcpConfig {
  failOpen: boolean;
  actor: Actor;
  hashAlgorithm: HashAlgorithm;
  signer: {
    keyId: string;
    seed?: Uint8Array;
  };
  toolDefaults: {
    server?: string;
    version?: string;
    transport: ToolTransport;
  };
  upstream: {
    command?: string;
    args: string[];
    cwd?: string;
    transport: 'stdio';
  };
  sinks: {
    kinds: SinkKind[];
    filePath?: string;
    httpUrl?: string;
    httpHeaders: Record<string, string>;
    gitRepoPath?: string;
    gitStage: boolean;
  };
}

export interface ReceiptingCallResult {
  result: ToolCallResult;
  receipt: Receipt;
  publicKey: PublicKeyFixture;
  sinkError?: Error;
}
