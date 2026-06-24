import type { FlowCatalog } from "connect-flow-builder";

import { mainInboundSpec } from "./main-inbound.js";
import { supportQueueExperienceSpec } from "./support-queue-experience.js";
import { claimsModuleSpec } from "./modules/claims-module.js";
import { billingModuleSpec } from "./modules/billing-module.js";
import { formularyModuleSpec } from "./modules/formulary-module.js";
import { providerModuleSpec } from "./modules/provider-module.js";
import { priorAuthModuleSpec } from "./modules/prior-auth-module.js";

export const flowCatalog: FlowCatalog = [
  supportQueueExperienceSpec,
  claimsModuleSpec,
  billingModuleSpec,
  formularyModuleSpec,
  providerModuleSpec,
  priorAuthModuleSpec,
  mainInboundSpec,
];
