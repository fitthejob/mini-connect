import * as cdk from "aws-cdk-lib";
import * as connect from "aws-cdk-lib/aws-connect";
import { renderFlowCatalog, } from "connect-flow-builder";
import { flowCatalog } from "../src/flows/catalog.js";
function requireArtifact(artifacts, key) {
    const artifact = artifacts.find((candidate) => candidate.key === key);
    if (!artifact) {
        throw new Error(`Missing rendered flow artifact for key "${key}".`);
    }
    return artifact;
}
function assertNoUnresolvedPlaceholders(artifact) {
    if (artifact.unresolvedPlaceholders.length > 0) {
        throw new Error(`Flow "${artifact.key}" still has unresolved placeholders: ${artifact.unresolvedPlaceholders.join(", ")}`);
    }
}
function renderTags(tags) {
    return Object.entries(tags).map(([key, value]) => ({ key, value }));
}
export class ContactFlowsStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const supportOnlyCatalog = flowCatalog.filter((spec) => spec.key === "supportQueueExperience");
        if (supportOnlyCatalog.length !== 1) {
            throw new Error('Expected exactly one "supportQueueExperience" flow spec in the catalog.');
        }
        const supportRender = renderFlowCatalog({
            catalog: supportOnlyCatalog,
            environment: props.envName,
        });
        const supportArtifact = requireArtifact(supportRender.artifacts, "supportQueueExperience");
        assertNoUnresolvedPlaceholders(supportArtifact);
        const supportQueueExperienceFlow = new connect.CfnContactFlow(this, "SupportQueueExperienceFlow", {
            instanceArn: props.instanceArn,
            name: supportArtifact.name,
            type: supportArtifact.type,
            description: supportArtifact.description,
            state: supportArtifact.state,
            content: supportArtifact.content,
            tags: renderTags(supportArtifact.tags),
        });
        const deploymentBindings = {
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
        const mainInboundArtifact = requireArtifact(deploymentRender.artifacts, "mainInbound");
        assertNoUnresolvedPlaceholders(mainInboundArtifact);
        const mainInboundFlow = new connect.CfnContactFlow(this, "MainInboundFlow", {
            instanceArn: props.instanceArn,
            name: mainInboundArtifact.name,
            type: mainInboundArtifact.type,
            description: mainInboundArtifact.description,
            state: mainInboundArtifact.state,
            content: mainInboundArtifact.content,
            tags: renderTags(mainInboundArtifact.tags),
        });
        mainInboundFlow.node.addDependency(supportQueueExperienceFlow);
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
    }
}
