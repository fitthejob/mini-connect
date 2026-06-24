import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  renderFlowCatalog,
  writeRenderedFlowCatalog,
  type FlowBindings,
} from "connect-flow-builder";

import { flowCatalog } from "../src/flows/catalog.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(moduleDir, "..");

const environment = process.argv[2] ?? "dev";
const outputDir = path.join(
  repositoryRoot,
  ".staging",
  "contact-flows",
  environment,
);

const bindings: FlowBindings = {
  queues: {
    support:        "${Queue.support.Arn}",
    claims:         "${Queue.claims.Arn}",
    billing:        "${Queue.billing.Arn}",
    pharmacy:       "${Queue.pharmacy.Arn}",
    provider:       "${Queue.provider.Arn}",
    memberServices: "${Queue.memberServices.Arn}",
  },
  flowArns: {
    supportQueueExperience:        "${Flow.supportQueueExperience.Arn}",
    claimsQueueExperience:         "${Flow.claimsQueueExperience.Arn}",
    billingQueueExperience:        "${Flow.billingQueueExperience.Arn}",
    pharmacyQueueExperience:       "${Flow.pharmacyQueueExperience.Arn}",
    providerQueueExperience:       "${Flow.providerQueueExperience.Arn}",
    memberServicesQueueExperience: "${Flow.memberServicesQueueExperience.Arn}",
  },
  flowIds: {
    claimsModule: "${FlowModule.claimsModule.Id}",
    billingModule: "${FlowModule.billingModule.Id}",
    formularyModule: "${FlowModule.formularyModule.Id}",
    providerModule: "${FlowModule.providerModule.Id}",
    priorAuthModule: "${FlowModule.priorAuthModule.Id}",
  },
  lexBotAliases: {
    mainInbound: "${LexBot.mainInbound.AliasArn}",
  },
  lambdas: {
    hrsOfOps: "${Lambda.hrsOfOps.Arn}",
    memberLookup: "${Lambda.memberLookup.Arn}",
    claimsLookup: "${Lambda.claimsLookup.Arn}",
    providerLookup: "${Lambda.providerLookup.Arn}",
    formularyLookup: "${Lambda.formularyLookup.Arn}",
    billingLookup: "${Lambda.billingLookup.Arn}",
    procedureLookup: "${Lambda.procedureLookup.Arn}",
  },
};

const result = renderFlowCatalog({
  catalog: flowCatalog,
  environment,
  bindings,
});

writeRenderedFlowCatalog(outputDir, result);

console.log(`Staged ${result.artifacts.length} flow artifacts into ${outputDir}`);
console.log(JSON.stringify(result.manifest, null, 2));
