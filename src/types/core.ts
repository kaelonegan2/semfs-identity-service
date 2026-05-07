export type JsonObject = Record<string, unknown>;

export type BackendKind = "local" | "github";

export interface WriteResult {
  path: string;
  wrote: boolean;
  skipped?: boolean;
  sha?: string;
  message?: string;
}

export interface IdentityStore {
  readonly kind: BackendKind;
  readonly label: string;
  readText(path: string): Promise<string>;
  writeText(path: string, content: string, message?: string): Promise<WriteResult>;
  exists(path: string): Promise<boolean>;
  listFiles(prefix?: string): Promise<string[]>;
}

export interface IdentityMount {
  identityId: string;
  store: IdentityStore;
}

export interface SemfsConfig {
  host: string;
  port: number;
  authToken: string;
  defaultIdentityId: string;
  backend: BackendKind;
  identityPath?: string;
  githubRepo?: string;
  githubRef?: string;
  githubToken?: string;
  vectorStore: "memory" | "null";
  embeddings?: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
}

export interface TrustContext {
  owner_verified?: boolean;
  trust_level?: string;
  role?: string;
  approval_state?: string;
}

export interface AgentActionRequest {
  message_summary?: string;
  conversation_id?: string | null;
  route?: string;
  trust?: TrustContext;
  requested_tool?: string;
  action_type?: string;
  target_path?: string;
  namespace?: string;
  facets?: JsonObject;
  vector_query?: string;
}

export interface DreamFinding {
  type: string;
  title: string;
  summary: string;
  target_ref?: string;
  safe_default?: string;
  proposed_artifact?: string;
}

export interface DreamRequest {
  scope?: string;
  goal?: string;
  max_refs?: number;
}
