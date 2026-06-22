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
  ListContactFlowsCommand,
} from "@aws-sdk/client-connect";
import {
  renderFlowCatalog,
  type FlowBindings,
} from "connect-flow-builder";
import { flowCatalog } from "../src/flows/catalog.js";

const SANDBOX_INBOUND_NAME = "ValidationSandboxInbound";
const SANDBOX_QUEUE_NAME = "ValidationSandboxQueue";
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
): Promise<{ inboundId: string; queueId: string }> {
  const response = await connect.send(
    new ListContactFlowsCommand({ InstanceId: instanceId }),
  );
  const flows = response.ContactFlowSummaryList ?? [];
  const inbound = flows.find((f) => f.Name === SANDBOX_INBOUND_NAME);
  const queue = flows.find((f) => f.Name === SANDBOX_QUEUE_NAME);

  if (!inbound?.Id || !queue?.Id) {
    throw new Error(
      `Sandbox flows not found. Create them once:\n` +
      `aws connect create-contact-flow --instance-id ${instanceId} --name "${SANDBOX_INBOUND_NAME}" --type CONTACT_FLOW --content '{"Version":"2019-10-30","StartAction":"end","Actions":[{"Identifier":"end","Type":"DisconnectParticipant","Parameters":{},"Transitions":{}}]}'\n` +
      `aws connect create-contact-flow --instance-id ${instanceId} --name "${SANDBOX_QUEUE_NAME}" --type CUSTOMER_QUEUE --content '{"Version":"2019-10-30","StartAction":"end","Actions":[{"Identifier":"end","Type":"DisconnectParticipant","Parameters":{},"Transitions":{}}]}'`,
    );
  }
  return { inboundId: inbound.Id, queueId: queue.Id };
}

async function validateFlow(
  connect: ConnectClient,
  instanceId: string,
  sandboxId: string,
  content: string,
): Promise<{ valid: boolean; problems: string[] }> {
  try {
    await connect.send(
      new UpdateContactFlowContentCommand({
        InstanceId: instanceId,
        ContactFlowId: sandboxId,
        Content: content,
      }),
    );
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
    hrsOfOpsArn,
    memberLookupArn,
    lexBotAliasArn,
    supportQueueExperienceFlowArn,
  ] = await Promise.all([
    getStackOutput(cfn, "MiniConnect-Queues", `SupportQueueArn${env}`),
    getStackOutput(cfn, "MiniConnect-Lambda", `HrsOfOpsHandlerArn${env}`),
    getStackOutput(cfn, "MiniConnect-Lambda", `MemberLookupHandlerArn${env}`),
    getStackOutput(cfn, "MiniConnect-Lex", `BotAliasArn${env}`),
    getStackOutput(cfn, "MiniConnect-ContactFlows", `SupportQueueExperienceFlowArn${env}`),
  ]);

  // Render support queue flow first (no bindings needed)
  const supportOnlyCatalog = flowCatalog.filter(
    (s) => s.key === "supportQueueExperience",
  );
  const supportRender = renderFlowCatalog({
    catalog: supportOnlyCatalog,
    environment: env,
  });
  const supportArtifact = supportRender.artifacts.find(
    (a) => a.key === "supportQueueExperience",
  )!;

  // Render full catalog with real bindings
  const bindings: FlowBindings = {
    queues: { support: supportQueueArn },
    flowArns: { supportQueueExperience: supportQueueExperienceFlowArn },
    lambdas: { hrsOfOps: hrsOfOpsArn, memberLookup: memberLookupArn },
    lexBotAliases: { mainInbound: lexBotAliasArn },
  };

  const fullRender = renderFlowCatalog({
    catalog: flowCatalog,
    environment: env,
    bindings,
  });

  const { inboundId, queueId } = await getSandboxFlowIds(connect, instanceId);
  console.log(`Sandbox (CONTACT_FLOW):   ${SANDBOX_INBOUND_NAME} (${inboundId})`);
  console.log(`Sandbox (CUSTOMER_QUEUE): ${SANDBOX_QUEUE_NAME} (${queueId})`);
  console.log(`Instance: ${instanceId}\n`);

  const artifacts = [supportArtifact, ...fullRender.artifacts.filter(
    (a) => a.key !== "supportQueueExperience",
  )];

  let passed = 0;
  let failed = 0;

  for (const artifact of artifacts) {
    process.stdout.write(`  Validating ${artifact.name}... `);
    // Route to the correct sandbox type — Connect validates block types per flow type
    const sandboxId = artifact.type === "CUSTOMER_QUEUE" ? queueId : inboundId;
    const result = await validateFlow(connect, instanceId, sandboxId, artifact.content);

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
