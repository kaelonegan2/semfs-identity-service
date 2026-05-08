import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SemfsContainer } from "../services/container.js";
import { AuthPrincipal, AuthScope } from "../types/core.js";

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

export function createMcpServer(container: SemfsContainer, principal?: AuthPrincipal): McpServer {
  const server = new McpServer({ name: "semfs", version: "0.1.0" });
  const activePrincipal = principal ?? { id: "legacy-admin", tokenClass: "admin" as const, scopes: container.config.authPrincipals[0]?.scopes ?? [] };

  function has(scope: AuthScope): boolean {
    return container.auth.hasScope(activePrincipal, scope);
  }

  async function load(identityId: string) {
    const mount = container.registry.resolve(identityId);
    const bundle = await container.loader.load(mount);
    return { mount, bundle };
  }

  if (has("identity:initialize")) server.tool(
    "semfs_initialize_identity",
    "Initialize a target repo with the business-neutral SemFS seed identity template.",
    {
      identity_id: z.string(),
      display_name: z.string().optional(),
      owner_placeholder: z.string().optional(),
      overwrite_mode: z.enum(["refuse", "replace_seed_files"]).optional(),
    },
    async (args) => text(await container.seedTemplates.initialize(args))
  );

  if (has("identity:status")) server.tool(
    "semfs_get_identity_status",
    "Check whether a SemFS identity is ready, uninitialized, or incomplete without requiring the full manifest to load.",
    { identity_id: z.string().default(container.config.defaultIdentityId) },
    async ({ identity_id }) => {
      const mount = container.registry.resolve(identity_id);
      return text(container.auth.statusResponse(await container.loader.status(mount), activePrincipal));
    }
  );

  if (has("inbound:prepare")) server.tool(
    "semfs_prepare_inbound",
    "Prepare a compact identity-aware runtime packet for an arbitrary inbound message.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      message: z.string().optional(),
      conversation_id: z.string().nullable().optional(),
      owner_verified: z.boolean().optional(),
      trust_level: z.string().optional(),
      risk_detected: z.boolean().optional(),
      risk_category: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const mount = container.registry.resolve(identity_id);
      return text(await container.inbound.prepare(mount, { ...rest, auth: activePrincipal }));
    }
  );

  if (has("identity:read")) server.tool(
    "semfs_get_manifest",
    "Read the SemFS identity manifest and active runtime surface.",
    { identity_id: z.string().default(container.config.defaultIdentityId) },
    async ({ identity_id }) => {
      const { mount, bundle } = await load(identity_id);
      return text({ mount: { identity_id: mount.identityId, store: mount.store.label }, manifest: container.loader.manifest(bundle) });
    }
  );

  if (has("identity:profile_write")) server.tool(
    "semfs_apply_owner_identity_seed",
    "Apply verified-owner seed identity direction to canonical profile, brief, README, and status surfaces. This does not activate capabilities, external actions, credentials, payments, publishing, or lifecycle changes.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      display_name: z.string().optional(),
      represented_entity: z.string().optional(),
      primary_purpose: z.string().optional(),
      business_or_function_domain: z.string().optional(),
      audience_or_market: z.string().optional(),
      profile_summary: z.string().optional(),
      voice_summary: z.string().optional(),
      owner_instruction: z.string().optional(),
      tone: z.array(z.string()).optional(),
      conversation_id: z.string().nullable().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const mount = container.registry.resolve(identity_id);
      return text(await container.identityProfile.applyOwnerIdentitySeed(mount, activePrincipal, rest));
    }
  );

  if (has("agent:read")) server.tool(
    "semfs_get_agent",
    "Retrieve an internal identity agent manifest with prompt, tools, policies, contracts, skills, specialists, and memory access.",
    { identity_id: z.string().default(container.config.defaultIdentityId), agent_id: z.string() },
    async ({ identity_id, agent_id }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.agents.getAgent(mount, bundle, agent_id));
    }
  );

  if (has("agent:prepare")) server.tool(
    "semfs_prepare_agent_action",
    "Prepare contract and prep for an outside runtime to act as an identity agent.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      agent_id: z.string(),
      message_summary: z.string().optional(),
      conversation_id: z.string().nullable().optional(),
      route: z.string().optional(),
      owner_verified: z.boolean().optional(),
      trust_level: z.string().optional(),
    },
    async ({ identity_id, agent_id, owner_verified, trust_level, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.agents.prepareAction(mount, bundle, agent_id, { ...rest, trust: { owner_verified, trust_level } }));
    }
  );

  if (has("agent:authorize")) server.tool(
    "semfs_authorize_agent_action",
    "Authorize a requested tool or action as a specific identity agent.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      agent_id: z.string(),
      requested_tool: z.string().optional(),
      action_type: z.string().optional(),
    },
    async ({ identity_id, agent_id, ...rest }) => {
      const { bundle } = await load(identity_id);
      return text(container.agents.authorizeAction(bundle, agent_id, rest));
    }
  );

  if (has("agent:validate")) server.tool(
    "semfs_validate_agent_output",
    "Validate an agent output against its output contract, route policy, and facet policy.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      agent_id: z.string(),
      output_json: z.string(),
    },
    async ({ identity_id, agent_id, output_json }) => {
      const { bundle } = await load(identity_id);
      return text(container.agents.validateOutput(bundle, agent_id, JSON.parse(output_json) as Record<string, unknown>));
    }
  );

  if (has("dream:prepare")) server.tool(
    "semfs_prepare_dream",
    "Prepare a bounded autonomous maturation evaluation packet.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      scope: z.enum(["profile", "knowledge", "capabilities", "authority", "memory", "agents", "tools", "specialists", "skills", "all"]).default("all"),
      goal: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { bundle } = await load(identity_id);
      return text(container.dreams.prepare(bundle, rest));
    }
  );

  if (has("dream:validate")) server.tool("semfs_validate_dream", "Validate dream findings before safe writeback.", { findings_json: z.string() }, async ({ findings_json }) =>
    text(container.dreams.validate(JSON.parse(findings_json)))
  );

  if (has("dream:write")) server.tool(
    "semfs_write_safe_dream_outputs",
    "Write validated safe dream findings as SemFS artifacts.",
    { identity_id: z.string().default(container.config.defaultIdentityId), findings_json: z.string() },
    async ({ identity_id, findings_json }) => {
      const { mount } = await load(identity_id);
      return text(await container.dreams.writeSafe(mount, JSON.parse(findings_json)));
    }
  );

  if (has("memory:search")) server.tool(
    "semfs_vector_search",
    "Search policy-filtered SemFS vector summaries.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      namespace: z.string(),
      query: z.string(),
      max_records: z.number().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { bundle } = await load(identity_id);
      return text(await container.vectors.search(bundle, rest));
    }
  );

  if (has("memory:write")) server.tool(
    "semfs_vector_upsert",
    "Write a policy-checked SemFS vector summary to an allowed namespace.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      namespace: z.string(),
      summary: z.string(),
      record_id: z.string().optional(),
      content_ref: z.string().optional(),
      privacy_class: z.string().optional(),
      source_agent: z.string().optional(),
      retrieval_tags: z.array(z.string()).optional(),
      source_path: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { bundle } = await load(identity_id);
      return text(await container.vectors.upsert(bundle, rest));
    }
  );

  if (has("artifact:safe_write")) server.tool(
    "semfs_write_safe_artifact",
    "Write a safe SemFS artifact to an allowlisted path. This cannot write lifecycle, registry, dispatch, security, credential, or payment paths.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      path: z.string(),
      content: z.string(),
      message: z.string().optional(),
    },
    async ({ identity_id, path, content, message }) => {
      const { mount } = await load(identity_id);
      return text(await container.writer.writeSafe(mount, path, content, message));
    }
  );

  if (has("review:write")) server.tool(
    "semfs_create_review_packet",
    "Create a safe human/owner review packet artifact.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      conversation_id: z.string().optional(),
      summary: z.string().optional(),
      decision_needed: z.string().optional(),
      safe_default: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.writer.createReviewPacket(mount, rest));
    }
  );

  if (has("approval:write")) server.tool(
    "semfs_capture_approval",
    "Capture an owner or reviewer approval result without activating capabilities.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      decision_id: z.string().optional(),
      approval_status: z.string().optional(),
      reviewer: z.string().optional(),
      summary: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.writer.captureApproval(mount, rest));
    }
  );

  return server;
}
