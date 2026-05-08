import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { SemfsConfig } from "../types/core.js";
import { badRequest, forbidden } from "../utils/errors.js";
import { normalizeRepoPath } from "../utils/path.js";
import { IdentityBundle } from "./identity-loader.js";

interface VectorRecord {
  id: string;
  identity_id: string;
  namespace: string;
  summary: string;
  content_ref?: string;
  privacy_class: string;
  source_agent: string;
  retrieval_tags: string[];
  embedding?: number[];
  source_path?: string;
}

export class VectorService {
  constructor(private readonly config: SemfsConfig) {}

  async upsert(bundle: IdentityBundle, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const namespace = String(input.namespace ?? "");
    const namespacePolicy = this.namespacePolicy(bundle, namespace);
    if (!namespacePolicy) throw badRequest(`Unknown vector namespace: ${namespace}`);
    if (namespacePolicy.state === "future_use_inactive" || namespacePolicy.default_access === "blocked_in_seed") {
      throw forbidden(`Vector namespace is blocked in current lifecycle: ${namespace}`);
    }
    const summary = String(input.summary ?? "");
    if (!summary) throw badRequest("summary is required");
    const record: VectorRecord = {
      id: String(input.record_id ?? crypto.randomUUID()),
      identity_id: bundle.identity_id,
      namespace,
      summary,
      content_ref: typeof input.content_ref === "string" ? input.content_ref : undefined,
      privacy_class: String(input.privacy_class ?? namespacePolicy.privacy_class ?? "internal"),
      source_agent: String(input.source_agent ?? "unknown"),
      retrieval_tags: Array.isArray(input.retrieval_tags) ? input.retrieval_tags.map(String) : [],
      source_path: typeof input.source_path === "string" ? input.source_path : undefined,
      embedding: await this.embed(summary),
    };
    if (this.config.vectorStore === "memory") await this.appendRecord(bundle, record);
    return {
      ok: true,
      durable: this.config.vectorStore === "memory",
      vector_store: this.config.vectorStore,
      record: this.publicRecord(record),
      memory_status: this.status(bundle),
    };
  }

  async search(bundle: IdentityBundle, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const namespace = String(input.namespace ?? "");
    const query = String(input.query ?? input.query_summary ?? "");
    const maxRecords = Math.min(Number(input.max_records ?? 3), 20);
    const namespacePolicy = this.namespacePolicy(bundle, namespace);
    if (!namespacePolicy) throw badRequest(`Unknown vector namespace: ${namespace}`);
    if (namespacePolicy.state === "future_use_inactive" || namespacePolicy.default_access === "blocked_in_seed") {
      throw forbidden(`Vector namespace is blocked in current lifecycle: ${namespace}`);
    }
    if (this.config.vectorStore === "null") {
      return { ok: true, vector_store: "null", records: [], memory_status: this.status(bundle), note: "Vector store is disabled." };
    }
    const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
    const records = await this.readRecords(bundle, namespace);
    const matches = records
      .filter((record) => record.identity_id === bundle.identity_id && record.namespace === namespace)
      .filter((record) => !terms.length || terms.some((term) => record.summary.toLowerCase().includes(term)))
      .slice(-maxRecords)
      .map((record) => this.publicRecord(record));
    return { ok: true, vector_store: "memory", records: matches, memory_status: this.status(bundle) };
  }

  status(bundle: IdentityBundle | null = null): Record<string, unknown> {
    const namespaces = (bundle?.vector_namespaces?.namespaces as Record<string, unknown>[] | undefined) ?? [];
    const enabledNamespaces = namespaces.filter(
      (entry) => entry.state !== "future_use_inactive" && entry.default_access !== "blocked_in_seed"
    );
    const blockedNamespaces = namespaces.filter(
      (entry) => entry.state === "future_use_inactive" || entry.default_access === "blocked_in_seed"
    );
    return {
      vector_store: this.config.vectorStore,
      enabled: this.config.vectorStore !== "null",
      durable: this.config.vectorStore === "memory",
      durability: this.config.vectorStore === "memory" ? "local_file_jsonl" : "disabled",
      storage: this.storageDescriptor(bundle),
      embeddings_configured: Boolean(this.config.embeddings),
      repo_namespace_policy_present: Boolean(bundle?.vector_namespaces),
      enabled_namespace_count: enabledNamespaces.length,
      blocked_namespace_count: blockedNamespaces.length,
      pii_posture:
        this.config.vectorStore === "memory"
          ? "Policy-allowed private or personal summaries may be stored outside tracked repo files. Never store secrets, credentials, payment tokens, or raw transcripts."
          : "Memory disabled; do not claim durable recall.",
    };
  }

  private namespacePolicy(bundle: IdentityBundle, namespace: string): Record<string, unknown> | null {
    const namespaces = (bundle.vector_namespaces?.namespaces as Record<string, unknown>[] | undefined) ?? [];
    return namespaces.find((entry) => entry.key === namespace) ?? null;
  }

  private async embed(text: string): Promise<number[] | undefined> {
    if (!this.config.embeddings) return undefined;
    const response = await fetch(`${this.config.embeddings.baseUrl.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.embeddings.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: this.config.embeddings.model, input: text }),
    });
    if (!response.ok) throw new Error(`Embedding request failed: ${response.status}`);
    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    return payload.data?.[0]?.embedding;
  }

  private async appendRecord(bundle: IdentityBundle, record: VectorRecord): Promise<void> {
    const file = this.namespaceFile(bundle, record.namespace);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
  }

  private async readRecords(bundle: IdentityBundle, namespace: string): Promise<VectorRecord[]> {
    const file = this.namespaceFile(bundle, namespace);
    let content = "";
    try {
      content = await fs.readFile(file, "utf8");
    } catch {
      return [];
    }
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as VectorRecord);
  }

  private namespaceFile(bundle: IdentityBundle, namespace: string): string {
    const root = this.memoryRoot(bundle);
    const identityId = normalizeRepoPath(bundle.identity_id).replaceAll("/", "_");
    const namespaceId = normalizeRepoPath(namespace).replaceAll("/", "_");
    return path.join(root, "vector", identityId, `${namespaceId}.jsonl`);
  }

  private memoryRoot(bundle: IdentityBundle): string {
    if (this.config.vectorStore !== "memory") throw badRequest("Vector memory is disabled.");
    if (this.config.vectorFileDir) return path.resolve(this.config.vectorFileDir);
    if (bundle.store_kind === "local") return path.join(path.resolve(bundle.store_label), ".memory");
    throw badRequest("SEMFS_VECTOR_FILE_DIR is required when SEMFS_VECTOR_STORE=memory and the identity store is not local.");
  }

  private storageDescriptor(bundle: IdentityBundle | null): Record<string, unknown> {
    if (this.config.vectorStore === "null") return { type: "disabled" };
    if (!bundle) {
      return {
        type: "local_file",
        location: this.config.vectorFileDir ? "configured_vector_file_dir" : "identity_repo_dot_memory",
      };
    }
    return {
      type: "local_file",
      location: this.config.vectorFileDir ? "configured_vector_file_dir" : "identity_repo_dot_memory",
      path: this.memoryRoot(bundle),
      tracked_by_repo: false,
      note: "The seed .gitignore excludes .memory/ when the default identity-local location is used.",
    };
  }

  private publicRecord(record: VectorRecord): Record<string, unknown> {
    return {
      id: record.id,
      identity_id: record.identity_id,
      namespace: record.namespace,
      summary: record.summary,
      content_ref: record.content_ref,
      privacy_class: record.privacy_class,
      source_agent: record.source_agent,
      retrieval_tags: record.retrieval_tags,
      source_path: record.source_path,
      has_embedding: Boolean(record.embedding),
    };
  }
}
