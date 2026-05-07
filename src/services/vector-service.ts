import crypto from "node:crypto";
import { SemfsConfig } from "../types/core.js";
import { badRequest, forbidden } from "../utils/errors.js";
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
  private readonly records: VectorRecord[] = [];

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
    if (this.config.vectorStore === "memory") this.records.push(record);
    return {
      ok: true,
      durable: false,
      vector_store: this.config.vectorStore,
      record: this.publicRecord(record),
      note: "V1 ships memory/null vector adapters; durable vector stores are plugins.",
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
      return { ok: true, vector_store: "null", records: [], note: "Vector store is disabled." };
    }
    const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
    const matches = this.records
      .filter((record) => record.identity_id === bundle.identity_id && record.namespace === namespace)
      .filter((record) => !terms.length || terms.some((term) => record.summary.toLowerCase().includes(term)))
      .slice(-maxRecords)
      .map((record) => this.publicRecord(record));
    return { ok: true, vector_store: "memory", records: matches };
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
