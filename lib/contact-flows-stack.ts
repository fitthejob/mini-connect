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
  claimsQueueArn: string;
  billingQueueArn: string;
  pharmacyQueueArn: string;
  providerQueueArn: string;
  memberServicesQueueArn: string;
  hrsOfOpsArn: string;
  memberLookupArn: string;
  lexBotAliasArn: string;
  claimsLookupArn: string;
  providerLookupArn: string;
  formularyLookupArn: string;
  billingLookupArn: string;
  procedureLookupArn: string;
  identityVerifyArn: string;
}

const QUEUE_FLOW_KEYS = [
  "supportQueueExperience",
  "claimsQueueExperience",
  "billingQueueExperience",
  "pharmacyQueueExperience",
  "providerQueueExperience",
  "memberServicesQueueExperience",
] as const;

const MODULE_KEYS = [
  "claimsModule",
  "billingModule",
  "formularyModule",
  "providerModule",
  "priorAuthModule",
  "eligibilityModule",
] as const;

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

    // ── Render and deploy all queue experience flows (no bindings needed) ────
    const queueFlowCatalog = flowCatalog.filter((spec) =>
      QUEUE_FLOW_KEYS.includes(spec.key as typeof QUEUE_FLOW_KEYS[number]),
    );

    const queueFlowRender = renderFlowCatalog({
      catalog: queueFlowCatalog,
      environment: props.envName,
    });

    const queueFlowCfn = new Map<string, connect.CfnContactFlow>();

    for (const key of QUEUE_FLOW_KEYS) {
      const artifact = requireArtifact(queueFlowRender.artifacts, key);
      assertNoUnresolvedPlaceholders(artifact);

      const logicalId = key.charAt(0).toUpperCase() + key.slice(1) + "Flow";
      const cfnFlow = new connect.CfnContactFlow(this, logicalId, {
        instanceArn: props.instanceArn,
        name: artifact.name,
        type: artifact.type,
        description: artifact.description,
        state: artifact.state,
        content: artifact.content,
        tags: renderTags(artifact.tags),
      });

      queueFlowCfn.set(key, cfnFlow);
    }

    // ── Render and deploy modules (Lambda bindings only — no flowIds needed) ─
    const moduleCatalog = flowCatalog.filter((spec) =>
      MODULE_KEYS.includes(spec.key as typeof MODULE_KEYS[number]),
    );

    const moduleBindings: FlowBindings = {
      lambdas: {
        claimsLookup: props.claimsLookupArn,
        providerLookup: props.providerLookupArn,
        formularyLookup: props.formularyLookupArn,
        billingLookup: props.billingLookupArn,
        procedureLookup: props.procedureLookupArn,
      },
    };

    const moduleRender = renderFlowCatalog({
      catalog: moduleCatalog,
      environment: props.envName,
      bindings: moduleBindings,
    });

    const moduleCfnFlows = new Map<string, connect.CfnContactFlowModule>();

    for (const key of MODULE_KEYS) {
      const artifact = requireArtifact(moduleRender.artifacts, key);
      assertNoUnresolvedPlaceholders(artifact);

      const cfnModule = new connect.CfnContactFlowModule(this, `${key}Flow`, {
        instanceArn: props.instanceArn,
        name: artifact.name,
        description: artifact.description,
        state: artifact.state,
        content: artifact.content,
        tags: renderTags(artifact.tags),
      });

      moduleCfnFlows.set(key, cfnModule);
    }

    // ── Render and deploy main inbound (all bindings including module IDs) ───
    const deploymentBindings: FlowBindings = {
      queues: {
        support:        props.supportQueueArn,
        claims:         props.claimsQueueArn,
        billing:        props.billingQueueArn,
        pharmacy:       props.pharmacyQueueArn,
        provider:       props.providerQueueArn,
        memberServices: props.memberServicesQueueArn,
      },
      flowArns: {
        supportQueueExperience:       queueFlowCfn.get("supportQueueExperience")!.attrContactFlowArn,
        claimsQueueExperience:        queueFlowCfn.get("claimsQueueExperience")!.attrContactFlowArn,
        billingQueueExperience:       queueFlowCfn.get("billingQueueExperience")!.attrContactFlowArn,
        pharmacyQueueExperience:      queueFlowCfn.get("pharmacyQueueExperience")!.attrContactFlowArn,
        providerQueueExperience:      queueFlowCfn.get("providerQueueExperience")!.attrContactFlowArn,
        memberServicesQueueExperience: queueFlowCfn.get("memberServicesQueueExperience")!.attrContactFlowArn,
      },
      flowIds: Object.fromEntries(
        MODULE_KEYS.map((key) => {
          const arn = moduleCfnFlows.get(key)!.attrContactFlowModuleArn;
          // ARN format: arn:aws:connect:region:account:instance/instanceId/flow-module/moduleId
          return [key, cdk.Fn.select(3, cdk.Fn.split("/", cdk.Fn.select(5, cdk.Fn.split(":", arn))))];
        }),
      ),
      lambdas: {
        hrsOfOps: props.hrsOfOpsArn,
        memberLookup: props.memberLookupArn,
        claimsLookup: props.claimsLookupArn,
        providerLookup: props.providerLookupArn,
        formularyLookup: props.formularyLookupArn,
        billingLookup: props.billingLookupArn,
        procedureLookup: props.procedureLookupArn,
        identityVerify: props.identityVerifyArn,
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

    for (const cfnQueueFlow of queueFlowCfn.values()) {
      mainInboundFlow.node.addDependency(cfnQueueFlow);
    }
    for (const cfnModule of moduleCfnFlows.values()) {
      mainInboundFlow.node.addDependency(cfnModule);
    }

    // ── Validation sandbox flows ──────────────────────────────────────────────
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

    const sandboxModuleContent = JSON.stringify({
      Version: "2019-10-30",
      StartAction: "end",
      Actions: [{ Identifier: "end", Type: "EndFlowModuleExecution", Parameters: {}, Transitions: {} }],
      Settings: {
        InputParameters: [],
        OutputParameters: [],
        Transitions: [
          { DisplayName: "Success", ReferenceName: "Success", Description: "" },
          { DisplayName: "Error", ReferenceName: "Error", Description: "" },
        ],
      },
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

    const validationSandboxModule = new connect.CfnContactFlowModule(
      this,
      "ValidationSandboxModule",
      {
        instanceArn: props.instanceArn,
        name: "ValidationSandboxModule",
        description: "Validation-only sandbox — not used for routing.",
        state: "ACTIVE",
        content: sandboxModuleContent,
      },
    );

    new cdk.CfnOutput(this, `ConnectInstanceArnInput-${props.envName}`, {
      value: props.instanceArn,
    });

    new cdk.CfnOutput(this, `SupportQueueArnInput-${props.envName}`, {
      value: props.supportQueueArn,
    });

    for (const key of QUEUE_FLOW_KEYS) {
      new cdk.CfnOutput(this, `${key}FlowArn-${props.envName}`, {
        value: queueFlowCfn.get(key)!.attrContactFlowArn,
      });
    }

    new cdk.CfnOutput(this, `MainInboundFlowArn-${props.envName}`, {
      value: mainInboundFlow.attrContactFlowArn,
    });

    new cdk.CfnOutput(this, `ValidationSandboxInboundArn-${props.envName}`, {
      value: validationSandboxInbound.attrContactFlowArn,
    });

    new cdk.CfnOutput(this, `ValidationSandboxQueueArn-${props.envName}`, {
      value: validationSandboxQueue.attrContactFlowArn,
    });

    new cdk.CfnOutput(this, `ValidationSandboxModuleArn-${props.envName}`, {
      value: validationSandboxModule.attrContactFlowModuleArn,
    });
  }
}
