/**
 * Pre-deploy contact flow validator.
 *
 * Renders flows with real ARN bindings from CloudFormation outputs, then pushes
 * each flow to a dedicated ValidationSandbox flow on the Connect instance.
 * Connect validates the full parameter and syntax contract and returns specific
 * problem messages — the same errors that would otherwise only surface in
 * CloudTrail after a failed CDK deploy.
 *
 * Usage:
 *   npm run validate:flows -- dev nevs-cloud-dev
 *
 * Prerequisites:
 *   - All MiniConnect stacks must be deployed
 *   - A "ValidationSandbox" CONTACT_FLOW must exist on the instance
 *   - AWS credentials must be configured for the target environment
 */

import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  ConnectClient,
  UpdateContactFlowContentCommand,
  UpdateContactFlowModuleContentCommand,
  ListContactFlowsCommand,
  ListContactFlowModulesCommand,
} from "@aws-sdk/client-connect";
import {
  renderFlowCatalog,
  type FlowBindings,
} from "connect-flow-builder";
import { flowCatalog } from "../src/flows/catalog.js";

const SANDBOX_INBOUND_NAME = "ValidationSandboxInbound";
const SANDBOX_QUEUE_NAME = "ValidationSandboxQueue";
const SANDBOX_MODULE_NAME = "ValidationSandboxModule";
const REGION = process.env.AWS_REGION ?? "us-east-1";

const env = process.argv[2] ?? "dev";
const awsProfile = process.argv[3];
if (awsProfile) process.env.AWS_PROFILE = awsProfile;

async function getStackOutput(
  cfn: CloudFormationClient,
  stackName: string,
  outputKey: string,
): Promise<string> {
  const response = await cfn.send(
    new DescribeStacksCommand({ StackName: stackName }),
  );
  const output = response.Stacks?.[0]?.Outputs?.find(
    (o) => o.OutputKey === outputKey,
  );
  if (!output?.OutputValue) {
    throw new Error(`Output "${outputKey}" not found in stack "${stackName}"`);
  }
  return output.OutputValue;
}

async function getSandboxFlowIds(
  connect: ConnectClient,
  instanceId: string,
): Promise<{ inboundId: string; queueId: string; moduleId: string }> {
  const [flowsResponse, modulesResponse] = await Promise.all([
    connect.send(new ListContactFlowsCommand({ InstanceId: instanceId })),
    connect.send(new ListContactFlowModulesCommand({ InstanceId: instanceId })),
  ]);

  const flows = flowsResponse.ContactFlowSummaryList ?? [];
  const modules = modulesResponse.ContactFlowModulesSummaryList ?? [];

  const inbound = flows.find((f) => f.Name === SANDBOX_INBOUND_NAME);
  const queue = flows.find((f) => f.Name === SANDBOX_QUEUE_NAME);
  const module = modules.find((f) => f.Name === SANDBOX_MODULE_NAME);

  if (!inbound?.Id || !queue?.Id || !module?.Id) {
    throw new Error(
      `Sandbox flows not found. Deploy MiniConnect-ContactFlows to create them automatically.`,
    );
  }
  return { inboundId: inbound.Id, queueId: queue.Id, moduleId: module.Id };
}

async function validateFlow(
  connect: ConnectClient,
  instanceId: string,
  sandboxId: string,
  content: string,
  isModule = false,
): Promise<{ valid: boolean; problems: string[] }> {
  try {
    if (isModule) {
      await connect.send(
        new UpdateContactFlowModuleContentCommand({
          InstanceId: instanceId,
          ContactFlowModuleId: sandboxId,
          Content: content,
        }),
      );
    } else {
      await connect.send(
        new UpdateContactFlowContentCommand({
          InstanceId: instanceId,
          ContactFlowId: sandboxId,
          Content: content,
        }),
      );
    }
    return { valid: true, problems: [] };
  } catch (err: unknown) {
    const error = err as {
      name?: string;
      message?: string;
      problems?: Array<{ message: string }>;
      $metadata?: { httpStatusCode?: number };
    };
    if (error.$metadata?.httpStatusCode === 400) {
      const problems = error.problems?.map((p) => p.message) ?? [error.message ?? "Unknown error"];
      return { valid: false, problems };
    }
    throw err;
  }
}

async function main(): Promise<void> {
  const cfn = new CloudFormationClient({ region: REGION });
  const connect = new ConnectClient({ region: REGION });

  console.log(`\nResolving bindings from CloudFormation (env: ${env})...\n`);

  const instanceId = await getStackOutput(cfn, "MiniConnect-Instance", `ConnectInstanceId${env}`);

  const [
    supportQueueArn,
    claimsQueueArn,
    billingQueueArn,
    pharmacyQueueArn,
    providerQueueArn,
    memberServicesQueueArn,
    hrsOfOpsArn,
    memberLookupArn,
    identityVerifyArn,
    lexBotAliasArn,
    claimsLookupArn,
    providerLookupArn,
    formularyLookupArn,
    billingLookupArn,
    procedureLookupArn,
  ] = await Promise.all([
    getStackOutput(cfn, "MiniConnect-Queues", `SupportQueueArn${env}`),
    getStackOutput(cfn, "MiniConnect-Queues", `ClaimsQueue${env}Arn`),
    getStackOutput(cfn, "MiniConnect-Queues", `BillingQueue${env}Arn`),
    getStackOutput(cfn, "MiniConnect-Queues", `PharmacyQueue${env}Arn`),
    getStackOutput(cfn, "MiniConnect-Queues", `ProviderQueue${env}Arn`),
    getStackOutput(cfn, "MiniConnect-Queues", `MemberServicesQueue${env}Arn`),
    getStackOutput(cfn, "MiniConnect-Lambda", `HrsOfOpsHandlerArn${env}`),
    getStackOutput(cfn, "MiniConnect-Lambda", `MemberLookupHandlerArn${env}`),
    getStackOutput(cfn, "MiniConnect-Lambda", `IdentityVerifyHandlerArn${env}`),
    getStackOutput(cfn, "MiniConnect-Lex", `BotAliasArn${env}`),
    getStackOutput(cfn, "MiniConnect-Claims", `ClaimsLookupHandlerArn${env}`),
    getStackOutput(cfn, "MiniConnect-Providers", `ProviderLookupHandlerArn${env}`),
    getStackOutput(cfn, "MiniConnect-Formulary", `FormularyLookupHandlerArn${env}`),
    getStackOutput(cfn, "MiniConnect-Billing", `BillingLookupHandlerArn${env}`),
    getStackOutput(cfn, "MiniConnect-ProcedureCodes", `ProcedureLookupHandlerArn${env}`),
  ]);

  // Render all queue experience flows (no bindings needed)
  const queueFlowKeys = [
    "supportQueueExperience",
    "claimsQueueExperience",
    "billingQueueExperience",
    "pharmacyQueueExperience",
    "providerQueueExperience",
    "memberServicesQueueExperience",
  ];
  const queueFlowCatalog = flowCatalog.filter((s) => queueFlowKeys.includes(s.key));
  const queueFlowRender = renderFlowCatalog({
    catalog: queueFlowCatalog,
    environment: env,
  });;

  // Render modules with Lambda bindings — push to module sandbox for validation
  const moduleKeys = ["claimsModule", "billingModule", "formularyModule", "providerModule", "priorAuthModule", "eligibilityModule"];
  const moduleCatalog = flowCatalog.filter((s) => moduleKeys.includes(s.key));
  const moduleBindings: FlowBindings = {
    lambdas: {
      claimsLookup: claimsLookupArn,
      providerLookup: providerLookupArn,
      formularyLookup: formularyLookupArn,
      billingLookup: billingLookupArn,
      procedureLookup: procedureLookupArn,
    },
  };
  const moduleRender = renderFlowCatalog({
    catalog: moduleCatalog,
    environment: env,
    bindings: moduleBindings,
  });

  // Resolve queue flow ARNs and module IDs from deployed ContactFlows stack.
  const [
    supportQueueExperienceFlowArn,
    claimsQueueExperienceFlowArn,
    billingQueueExperienceFlowArn,
    pharmacyQueueExperienceFlowArn,
    providerQueueExperienceFlowArn,
    memberServicesQueueExperienceFlowArn,
    claimsModuleArn,
    billingModuleArn,
    formularyModuleArn,
    providerModuleArn,
    priorAuthModuleArn,
    eligibilityModuleArn,
  ] = await Promise.all([
    getStackOutput(cfn, "MiniConnect-ContactFlows", `supportQueueExperienceFlowArn${env}`),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `claimsQueueExperienceFlowArn${env}`),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `billingQueueExperienceFlowArn${env}`),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `pharmacyQueueExperienceFlowArn${env}`),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `providerQueueExperienceFlowArn${env}`),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `memberServicesQueueExperienceFlowArn${env}`),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `claimsModuleFlowId${env}`).catch(() => "placeholder"),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `billingModuleFlowId${env}`).catch(() => "placeholder"),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `formularyModuleFlowId${env}`).catch(() => "placeholder"),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `providerModuleFlowId${env}`).catch(() => "placeholder"),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `priorAuthModuleFlowId${env}`).catch(() => "placeholder"),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `eligibilityModuleFlowId${env}`).catch(() => "placeholder"),
  ]);

  // Render full catalog with real bindings
  const bindings: FlowBindings = {
    queues: {
      support:        supportQueueArn,
      claims:         claimsQueueArn,
      billing:        billingQueueArn,
      pharmacy:       pharmacyQueueArn,
      provider:       providerQueueArn,
      memberServices: memberServicesQueueArn,
    },
    flowArns: {
      supportQueueExperience:        supportQueueExperienceFlowArn,
      claimsQueueExperience:         claimsQueueExperienceFlowArn,
      billingQueueExperience:        billingQueueExperienceFlowArn,
      pharmacyQueueExperience:       pharmacyQueueExperienceFlowArn,
      providerQueueExperience:       providerQueueExperienceFlowArn,
      memberServicesQueueExperience: memberServicesQueueExperienceFlowArn,
    },
    flowIds: {
      claimsModule:    claimsModuleArn,
      billingModule:   billingModuleArn,
      formularyModule: formularyModuleArn,
      providerModule:  providerModuleArn,
      priorAuthModule:    priorAuthModuleArn,
      eligibilityModule: eligibilityModuleArn,
    },
    lambdas: {
      hrsOfOps:        hrsOfOpsArn,
      memberLookup:    memberLookupArn,
      identityVerify:  identityVerifyArn,
      claimsLookup:    claimsLookupArn,
      providerLookup:  providerLookupArn,
      formularyLookup: formularyLookupArn,
      billingLookup:   billingLookupArn,
      procedureLookup: procedureLookupArn,
    },
    lexBotAliases: { mainInbound: lexBotAliasArn },
  };

  const fullRender = renderFlowCatalog({
    catalog: flowCatalog,
    environment: env,
    bindings,
  });

  const { inboundId, queueId, moduleId } = await getSandboxFlowIds(connect, instanceId);
  console.log(`Sandbox (CONTACT_FLOW):        ${SANDBOX_INBOUND_NAME} (${inboundId})`);
  console.log(`Sandbox (CUSTOMER_QUEUE):      ${SANDBOX_QUEUE_NAME} (${queueId})`);
  console.log(`Sandbox (CONTACT_FLOW_MODULE): ${SANDBOX_MODULE_NAME} (${moduleId})`);
  console.log(`Instance: ${instanceId}\n`);

  const artifacts = [
    ...queueFlowRender.artifacts,
    ...moduleRender.artifacts,
    ...fullRender.artifacts.filter(
      (a) => !queueFlowKeys.includes(a.key) && !moduleKeys.includes(a.key),
    ),
  ];

  let passed = 0;
  let failed = 0;

  for (const artifact of artifacts) {
    process.stdout.write(`  Validating ${artifact.name}... `);
    // Route to the correct sandbox type — Connect validates block types per flow type
    const isModule = artifact.type === "CONTACT_FLOW_MODULE";
    const sandboxId = artifact.type === "CUSTOMER_QUEUE"
      ? queueId
      : isModule
        ? moduleId
        : inboundId;
    const result = await validateFlow(connect, instanceId, sandboxId, artifact.content, isModule);

    if (result.valid) {
      console.log("✓");
      passed++;
    } else {
      console.log("✗ FAILED");
      for (const problem of result.problems) {
        console.log(`    → ${problem}`);
      }
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed.\n`);

  if (failed > 0) {
    console.error("Fix the issues above before deploying.");
    process.exit(1);
  }

  console.log("All flows valid — safe to deploy.");
}

main().catch((err) => {
  console.error("\nValidator error:", (err as Error).message);
  process.exit(1);
});
