export type JsonObject = Record<string, unknown>;

export type BackendKind = "local" | "github";

export type AuthScope =
  | "identity:status"
  | "identity:initialize"
  | "identity:seed_update"
  | "identity:read"
  | "identity:profile_write"
  | "inbound:prepare"
  | "agent:read"
  | "agent:prepare"
  | "agent:authorize"
  | "agent:validate"
  | "run:prepare"
  | "run:orchestrate"
  | "run:record"
  | "runtime:capability_write"
  | "memory:search"
  | "memory:write"
  | "governance:read"
  | "artifact:safe_write"
  | "context:write"
  | "evolution:write"
  | "activation:write"
  | "review:write"
  | "approval:write"
  | "dream:prepare"
  | "dream:validate"
  | "dream:write";

export type TokenClass = "public" | "readonly" | "runtime" | "owner_runtime" | "admin" | "agent_runtime";

export type SubagentType = "inline_subagent" | "parallel_subagent" | "continuation_subagent";

export interface AgentRuntimeGrant {
  grantId: string;
  runId: string;
  parentRunId: string;
  conversationId: string;
  agentId: string;
  subagentType: SubagentType;
  expiresAt: string;
  scopes: AuthScope[];
  allowedTools: string[];
  allowedOperationFamilies: string[];
  allowedVectorNamespaces: string[];
  responseAuthority: "parent_reviewed" | "direct_response_allowed";
  ownerVerified: boolean;
}

export interface AuthPrincipal {
  id: string;
  tokenClass: TokenClass;
  scopes: AuthScope[];
  token?: string;
  agentRuntimeGrant?: AgentRuntimeGrant;
}

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
  writeManyText?(files: Array<{ path: string; content: string }>, message?: string): Promise<WriteResult[]>;
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
  authPrincipals: AuthPrincipal[];
  allowPublicAccess: boolean;
  defaultIdentityId: string;
  backend: BackendKind;
  identityPath?: string;
  githubRepo?: string;
  githubRef?: string;
  githubToken?: string;
  vectorStore: "memory" | "null";
  vectorFileDir?: string;
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
  run_id?: string;
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
