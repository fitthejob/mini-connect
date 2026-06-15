import {
  CfnOutput,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import { CfnContactFlow } from "aws-cdk-lib/aws-connect";
import { Construct } from "constructs";

import {
  renderFlowCatalog,
  type FlowBindings,
  type RenderedFlowArtifact,
} from "connect-flow-builder";

import { flowCatalog } from "../src/flows/catalog.js";

export interface ContactFlowsStackProps extends StackProps {
  envName: string;
  instanceArn: string;
  supportQueueArn: string;
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

export class ContactFlowsStack extends Stack {
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

    const supportQueueExperienceFlow = new CfnContactFlow(
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

    const mainInboundFlow = new CfnContactFlow(this, "MainInboundFlow", {
      instanceArn: props.instanceArn,
      name: mainInboundArtifact.name,
      type: mainInboundArtifact.type,
      description: mainInboundArtifact.description,
      state: mainInboundArtifact.state,
      content: mainInboundArtifact.content,
      tags: renderTags(mainInboundArtifact.tags),
    });

    mainInboundFlow.node.addDependency(supportQueueExperienceFlow);

    new CfnOutput(this, "ConnectInstanceArnInput", {
      value: props.instanceArn,
    });

    new CfnOutput(this, "SupportQueueArnInput", {
      value: props.supportQueueArn,
    });

    new CfnOutput(this, "SupportQueueExperienceFlowArn", {
      value: supportQueueExperienceFlow.attrContactFlowArn,
    });

    new CfnOutput(this, "MainInboundFlowArn", {
      value: mainInboundFlow.attrContactFlowArn,
    });
  }
}