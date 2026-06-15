import type { FlowCatalog } from "connect-flow-builder";

import { mainInboundSpec } from "./main-inbound.js";
import { supportQueueExperienceSpec } from "./support-queue-experience.js";

export const flowCatalog: FlowCatalog = [
    supportQueueExperienceSpec,
    mainInboundSpec,
];