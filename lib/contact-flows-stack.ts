import * as cdk from "aws-cdk-lib";
import * as connect from "aws-cdk-lib/aws-connect";
import { Construct } from "constructs";

import {
  renderFlowCatalog,
  type FlowBindings,
  type RenderedFlowArtifact,
} from "connect-flow-builder";

import { flowCatalog } from "../src/flows/catalog.js";

interface ContactFlowsStackProps extends cdk.StackProps {
  envName: string;
  instanceArn: string;
  supportQueueArn: string;
  hrsOfOpsArn: string;
  memberLookupArn: string;
  lexBotAliasArn: string;
  claimsLookupArn: string;
  providerLookupArn: string;
  formularyLookupArn: string;
  billingLookupArn: string;
  procedureLookupArn: string;
}

function requireArtifact(
  artifacts: readonly RenderedFlowArtifact[],
  key: string,
): RenderedFlowArtifact {
  const artifact = artifacts.find((candidate) => candidate.key === key);
  if (!artifact) {
    throw new Error(`Missing rendered flow artifact for key "${key}".`);
  }
  return artifact;
}

function assertNoUnresolvedPlaceholders(artifact: RenderedFlowArtifact): void {
  if (artifact.unresolvedPlaceholders.length > 0) {
    throw new Error(
      `Flow "${artifact.key}" still has unresolved placeholders: ${artifact.unresolvedPlaceholders.join(
        ", ",
      )}`,
    );
  }
}

function renderTags(tags: Readonly<Record<string, string>>) {
  return Object.entries(tags).map(([key, value]) => ({ key, value }));
}

export class ContactFlowsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ContactFlowsStackProps) {
    super(scope, id, props);

    const supportOnlyCatalog = flowCatalog.filter(
      (spec) => spec.key === "supportQueueExperience",
    );

    if (supportOnlyCatalog.length !== 1) {
      throw new Error(
        'Expected exactly one "supportQueueExperience" flow spec in the catalog.',
      );
    }

    const supportRender = renderFlowCatalog({
      catalog: supportOnlyCatalog,
      environment: props.envName,
    });

    const supportArtifact = requireArtifact(
      supportRender.artifacts,
      "supportQueueExperience",
    );
    assertNoUnresolvedPlaceholders(supportArtifact);

    const supportQueueExperienceFlow = new connect.CfnContactFlow(
      this,
      "SupportQueueExperienceFlow",
      {
        instanceArn: props.instanceArn,
        name: supportArtifact.name,
        type: supportArtifact.type,
        description: supportArtifact.description,
        state: supportArtifact.state,
        content: supportArtifact.content,
        tags: renderTags(supportArtifact.tags),
      },
    );

    const deploymentBindings: FlowBindings = {
      queues: {
        support: props.supportQueueArn,
      },
      flowArns: {
        supportQueueExperience: supportQueueExperienceFlow.attrContactFlowArn,
      },
      lambdas: {
        hrsOfOps: props.hrsOfOpsArn,
        memberLookup: props.memberLookupArn,
        claimsLookup: props.claimsLookupArn,
        providerLookup: props.providerLookupArn,
        formularyLookup: props.formularyLookupArn,
        billingLookup: props.billingLookupArn,
        procedureLookup: props.procedureLookupArn,
      },
      lexBotAliases: {
        mainInbound: props.lexBotAliasArn,
      },
    };

    const deploymentRender = renderFlowCatalog({
      catalog: flowCatalog,
      environment: props.envName,
      bindings: deploymentBindings,
    });

    const mainInboundArtifact = requireArtifact(
      deploymentRender.artifacts,
      "mainInbound",
    );
    assertNoUnresolvedPlaceholders(mainInboundArtifact);

    const mainInboundFlow = new connect.CfnContactFlow(
      this,
      "MainInboundFlow",
      {
        instanceArn: props.instanceArn,
        name: mainInboundArtifact.name,
        type: mainInboundArtifact.type,
        description: mainInboundArtifact.description,
        state: mainInboundArtifact.state,
        content: mainInboundArtifact.content,
        tags: renderTags(mainInboundArtifact.tags),
      },
    );

    mainInboundFlow.node.addDependency(supportQueueExperienceFlow);

    // Minimal stub flows used by validate-flows.ts to syntax-check rendered
    // flow JSON against the Connect API before a real deploy. They are never
    // attached to a phone number or queue — Connect just validates the content.
    const sandboxInboundContent = JSON.stringify({
      Version: "2019-10-30",
      StartAction: "end",
      Actions: [{ Identifier: "end", Type: "DisconnectParticipant", Parameters: {}, Transitions: {} }],
    });

    const sandboxQueueContent = JSON.stringify({
      Version: "2019-10-30",
      StartAction: "end",
      Actions: [{ Identifier: "end", Type: "DisconnectParticipant", Parameters: {}, Transitions: {} }],
    });

    const validationSandboxInbound = new connect.CfnContactFlow(
      this,
      "ValidationSandboxInbound",
      {
        instanceArn: props.instanceArn,
        name: "ValidationSandboxInbound",
        type: "CONTACT_FLOW",
        description: "Validation-only sandbox — not used for routing.",
        state: "ACTIVE",
        content: sandboxInboundContent,
      },
    );

    const validationSandboxQueue = new connect.CfnContactFlow(
      this,
      "ValidationSandboxQueue",
      {
        instanceArn: props.instanceArn,
        name: "ValidationSandboxQueue",
        type: "CUSTOMER_QUEUE",
        description: "Validation-only sandbox — not used for routing.",
        state: "ACTIVE",
        content: sandboxQueueContent,
      },
    );

    new cdk.CfnOutput(this, `ConnectInstanceArnInput-${props.envName}`, {
      value: props.instanceArn,
    });

    new cdk.CfnOutput(this, `SupportQueueArnInput-${props.envName}`, {
      value: props.supportQueueArn,
    });

    new cdk.CfnOutput(this, `SupportQueueExperienceFlowArn-${props.envName}`, {
      value: supportQueueExperienceFlow.attrContactFlowArn,
    });

    new cdk.CfnOutput(this, `MainInboundFlowArn-${props.envName}`, {
      value: mainInboundFlow.attrContactFlowArn,
    });

    new cdk.CfnOutput(this, `ValidationSandboxInboundArn-${props.envName}`, {
      value: validationSandboxInbound.attrContactFlowArn,
    });

    new cdk.CfnOutput(this, `ValidationSandboxQueueArn-${props.envName}`, {
      value: validationSandboxQueue.attrContactFlowArn,
    });
  }
}
