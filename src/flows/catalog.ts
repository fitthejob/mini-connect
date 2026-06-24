import type { FlowCatalog } from "connect-flow-builder";

import { mainInboundSpec } from "./main-inbound.js";
import { supportQueueExperienceSpec } from "./support-queue-experience.js";
import { claimsQueueExperienceSpec } from "./queue-experiences/claims-queue-experience.js";
import { billingQueueExperienceSpec } from "./queue-experiences/billing-queue-experience.js";
import { pharmacyQueueExperienceSpec } from "./queue-experiences/pharmacy-queue-experience.js";
import { providerQueueExperienceSpec } from "./queue-experiences/provider-queue-experience.js";
import { memberServicesQueueExperienceSpec } from "./queue-experiences/member-services-queue-experience.js";
import { claimsModuleSpec } from "./modules/claims-module.js";
import { billingModuleSpec } from "./modules/billing-module.js";
import { formularyModuleSpec } from "./modules/formulary-module.js";
import { providerModuleSpec } from "./modules/provider-module.js";
import { priorAuthModuleSpec } from "./modules/prior-auth-module.js";

export const flowCatalog: FlowCatalog = [
  supportQueueExperienceSpec,
  claimsQueueExperienceSpec,
  billingQueueExperienceSpec,
  pharmacyQueueExperienceSpec,
  providerQueueExperienceSpec,
  memberServicesQueueExperienceSpec,
  claimsModuleSpec,
  billingModuleSpec,
  formularyModuleSpec,
  providerModuleSpec,
  priorAuthModuleSpec,
  mainInboundSpec,
];
