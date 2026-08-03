import { loadConfig } from "../config/config.js";
import { IdentityRegistry } from "../stores/registry.js";
import { AgentService } from "./agent-service.js";
import { AuthService } from "./auth-service.js";
import { DreamService } from "./dream-service.js";
import { IdentityLoader } from "./identity-loader.js";
import { IdentityProfileService } from "./identity-profile-service.js";
import { InboundService } from "./inbound-service.js";
import { SelfInspectionService } from "./inspection-service.js";
import { PolicyService } from "./policy-service.js";
import { RuntimeOrchestrationService } from "./runtime-orchestration-service.js";
import { SafeWriter } from "./safe-writer.js";
import { SeedTemplateService } from "./seed-template-service.js";
import { VectorService } from "./vector-service.js";

export function createContainer() {
  const config = loadConfig();
  const registry = new IdentityRegistry(config);
  const loader = new IdentityLoader();
  const policy = new PolicyService();
  const writer = new SafeWriter();
  const auth = new AuthService(config.authPrincipals, config.allowPublicAccess);
  const vectors = new VectorService(config);
  const runtime = new RuntimeOrchestrationService(policy, writer, vectors, auth);
  return {
    config,
    auth,
    registry,
    loader,
    identityProfile: new IdentityProfileService(),
    inbound: new InboundService(loader, policy, runtime),
    policy,
    writer,
    agents: new AgentService(policy),
    dreams: new DreamService(writer),
    inspection: new SelfInspectionService(loader, policy),
    seedTemplates: new SeedTemplateService(registry),
    vectors,
    runtime,
  };
}

export type SemfsContainer = ReturnType<typeof createContainer>;
