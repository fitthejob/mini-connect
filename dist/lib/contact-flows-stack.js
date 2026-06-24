import * as cdk from "aws-cdk-lib";
import * as connect from "aws-cdk-lib/aws-connect";
import { renderFlowCatalog, } from "connect-flow-builder";
import { flowCatalog } from "../src/flows/catalog.js";
const MODULE_KEYS = [
    "claimsModule",
    "billingModule",
    "formularyModule",
    "providerModule",
    "priorAuthModule",
];
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
        // ── Render and deploy support queue experience (no bindings needed) ──────
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
        // ── Render and deploy modules (Lambda bindings only — no flowIds needed) ─
        const moduleCatalog = flowCatalog.filter((spec) => MODULE_KEYS.includes(spec.key));
        const moduleBindings = {
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
        const moduleCfnFlows = new Map();
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
        const deploymentBindings = {
            queues: {
                support: props.supportQueueArn,
            },
            flowArns: {
                supportQueueExperience: supportQueueExperienceFlow.attrContactFlowArn,
            },
            flowIds: Object.fromEntries(MODULE_KEYS.map((key) => {
                const arn = moduleCfnFlows.get(key).attrContactFlowModuleArn;
                // ARN format: arn:aws:connect:region:account:instance/instanceId/flow-module/moduleId
                return [key, cdk.Fn.select(3, cdk.Fn.split("/", cdk.Fn.select(5, cdk.Fn.split(":", arn))))];
            })),
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
        const validationSandboxInbound = new connect.CfnContactFlow(this, "ValidationSandboxInbound", {
            instanceArn: props.instanceArn,
            name: "ValidationSandboxInbound",
            type: "CONTACT_FLOW",
            description: "Validation-only sandbox — not used for routing.",
            state: "ACTIVE",
            content: sandboxInboundContent,
        });
        const validationSandboxQueue = new connect.CfnContactFlow(this, "ValidationSandboxQueue", {
            instanceArn: props.instanceArn,
            name: "ValidationSandboxQueue",
            type: "CUSTOMER_QUEUE",
            description: "Validation-only sandbox — not used for routing.",
            state: "ACTIVE",
            content: sandboxQueueContent,
        });
        const validationSandboxModule = new connect.CfnContactFlowModule(this, "ValidationSandboxModule", {
            instanceArn: props.instanceArn,
            name: "ValidationSandboxModule",
            description: "Validation-only sandbox — not used for routing.",
            state: "ACTIVE",
            content: sandboxModuleContent,
        });
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
        new cdk.CfnOutput(this, `ValidationSandboxModuleArn-${props.envName}`, {
            value: validationSandboxModule.attrContactFlowModuleArn,
        });
    }
}
