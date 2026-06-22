import * as cdk from "aws-cdk-lib";
import { ConnectInstanceStack } from "../lib/connect-instance-stack.js";
import { ConnectQueuesStack } from "../lib/connect-queues-stack.js";
import { ContactFlowsStack } from "../lib/contact-flows-stack.js";
import { KmsStack } from "../lib/kms-stack.js";
import { LambdaStack } from "../lib/lambda-stack.js";
import { S3Stack } from "../lib/s3-stack.js";
import { LexStack } from "../lib/lex-stack.js";
import { DynamoDbStack } from "../lib/dynamodb-stack.js";
import { mainInboundBotCatalog } from "../src/bots/main-inbound-flow/catalog.js";
import { MonitoringOpsStack } from "../lib/observability/monitoring-ops-stack.js";
import { MonitoringDevStack } from "../lib/observability/monitoring-dev-stack.js";
import { CustomerProfilesStack } from "../lib/customer-profiles-stack.js";
import { BackendDataStack } from "../lib/backend/backend-data-stack.js";
import { ClaimsStack } from "../lib/backend/claims-stack.js";
import { ProvidersStack } from "../lib/backend/providers-stack.js";
import { FormularyStack } from "../lib/backend/formulary-stack.js";
import { BillingStack } from "../lib/backend/billing-stack.js";
import { ProcedureCodesStack } from "../lib/backend/procedure-codes-stack.js";
import { AwsSolutionsChecks } from "cdk-nag";
const app = new cdk.App();
const env = app.node.tryGetContext("env") ?? "dev";
// const accountMap: Record<string, { account: string; region: string }> = {
//   dev:  { account: "111111111", region: "us-east-1" },
//   prod: { account: "222222222", region: "us-east-1" },
// };
const awsEnv = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
};
// ── Foundational infrastructure ──────────────────────────────────────────────
const connectInstanceStack = new ConnectInstanceStack(app, "MiniConnect-Instance", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
});
const kmsStack = new KmsStack(app, "MiniConnect-Kms", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
});
const dynamoDbStack = new DynamoDbStack(app, "MiniConnect-DynamoDB", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    kmsStack,
});
const s3Stack = new S3Stack(app, "MiniConnect-S3", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    kmsStack,
});
// ── Connect resources ─────────────────────────────────────────────────────────
const connectQueuesStack = new ConnectQueuesStack(app, "MiniConnect-Queues", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    instanceArn: connectInstanceStack.instanceArn,
});
new CustomerProfilesStack(app, "MiniConnect-CustomerProfiles", {
    env: awsEnv,
    envName: env,
    kmsStack,
});
const lexStack = new LexStack(app, "MiniConnect-Lex", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    instanceArn: connectInstanceStack.instanceArn,
    catalog: mainInboundBotCatalog,
});
// ── Core Lambdas ──────────────────────────────────────────────────────────────
const lambdaStack = new LambdaStack(app, "MiniConnect-Lambda", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    s3Stack,
    dynamoDbStack,
    kmsStack,
});
// ── Backend data layer ────────────────────────────────────────────────────────
const backendDataStack = new BackendDataStack(app, "MiniConnect-BackendData", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    kmsStack,
});
// ── Domain Lambda stacks (one per health plan domain) ─────────────────────────
const claimsStack = new ClaimsStack(app, "MiniConnect-Claims", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    kmsStack,
    s3Stack,
    backendDataStack,
});
const providersStack = new ProvidersStack(app, "MiniConnect-Providers", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    kmsStack,
    s3Stack,
    backendDataStack,
});
const formularyStack = new FormularyStack(app, "MiniConnect-Formulary", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    kmsStack,
    s3Stack,
    backendDataStack,
});
const billingStack = new BillingStack(app, "MiniConnect-Billing", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    kmsStack,
    s3Stack,
    backendDataStack,
});
const procedureCodesStack = new ProcedureCodesStack(app, "MiniConnect-ProcedureCodes", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    kmsStack,
    s3Stack,
    backendDataStack,
});
// ── Contact flows ─────────────────────────────────────────────────────────────
new ContactFlowsStack(app, "MiniConnect-ContactFlows", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    instanceArn: connectInstanceStack.instanceArn,
    supportQueueArn: connectQueuesStack.supportQueueArn,
    hrsOfOpsArn: lambdaStack.hrsOfOpsHandler.functionArn,
    memberLookupArn: lambdaStack.memberLookupHandler.functionArn,
    lexBotAliasArn: lexStack.botAliasArn,
    claimsLookupArn: claimsStack.claimsLookupHandler.functionArn,
    providerLookupArn: providersStack.providerLookupHandler.functionArn,
    formularyLookupArn: formularyStack.formularyLookupHandler.functionArn,
    billingLookupArn: billingStack.billingLookupHandler.functionArn,
    procedureLookupArn: procedureCodesStack.procedureLookupHandler.functionArn,
});
// ── Observability ─────────────────────────────────────────────────────────────
new MonitoringOpsStack(app, "MiniConnect-MonitoringOps", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    connectInstanceStack,
    kmsStack,
});
new MonitoringDevStack(app, "MiniConnect-MonitoringDev", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    lambdaStack,
    dynamoDbStack,
    kmsStack,
});
new AwsSolutionsChecks(app);
