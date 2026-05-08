import { loadConfig } from "../config/config.js";
import { IdentityRegistry } from "../stores/registry.js";
import { AgentService } from "./agent-service.js";
import { AuthService } from "./auth-service.js";
import { DreamService } from "./dream-service.js";
import { IdentityLoader } from "./identity-loader.js";
import { IdentityProfileService } from "./identity-profile-service.js";
import { InboundService } from "./inbound-service.js";
import { PolicyService } from "./policy-service.js";
import { SafeWriter } from "./safe-writer.js";
import { SeedTemplateService } from "./seed-template-service.js";
import { VectorService } from "./vector-service.js";

export function createContainer() {
  const config = loadConfig();
  const registry = new IdentityRegistry(config);
  const loader = new IdentityLoader();
  const policy = new PolicyService();
  const writer = new SafeWriter();
  return {
    config,
    auth: new AuthService(config.authPrincipals, config.allowPublicAccess),
    registry,
    loader,
    identityProfile: new IdentityProfileService(),
    inbound: new InboundService(loader, policy),
    policy,
    writer,
    agents: new AgentService(policy),
    dreams: new DreamService(writer),
    seedTemplates: new SeedTemplateService(registry),
    vectors: new VectorService(config),
  };
}

export type SemfsContainer = ReturnType<typeof createContainer>;
