import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderFlowCatalog, writeRenderedFlowCatalog, } from "connect-flow-builder";
import { flowCatalog } from "../src/flows/catalog.js";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(moduleDir, "..");
const environment = process.argv[2] ?? "dev";
const outputDir = path.join(repositoryRoot, ".staging", "contact-flows", environment);
const bindings = {
    queues: {
        support: "${Queue.support.Arn}",
    },
    flowArns: {
        supportQueueExperience: "${Flow.supportQueueExperience.Arn}",
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
