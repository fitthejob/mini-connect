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
const connectInstanceStack = new ConnectInstanceStack(app, "MiniConnect-Instance", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
});
const connectQueuesStack = new ConnectQueuesStack(app, "MiniConnect-Queues", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    instanceArn: connectInstanceStack.instanceArn,
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
const lambdaStack = new LambdaStack(app, "MiniConnect-Lambda", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    s3Stack,
    dynamoDbStack,
});
const lexStack = new LexStack(app, "MiniConnect-Lex", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    instanceArn: connectInstanceStack.instanceArn,
    catalog: mainInboundBotCatalog,
});
new ContactFlowsStack(app, "MiniConnect-ContactFlows", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    instanceArn: connectInstanceStack.instanceArn,
    supportQueueArn: connectQueuesStack.supportQueueArn,
    hrsOfOpsArn: lambdaStack.hrsOfOpsHandler.functionArn,
    memberLookupArn: lambdaStack.memberLookupHandler.functionArn,
    lexBotAliasArn: lexStack.botAliasArn,
});
new MonitoringOpsStack(app, "MiniConnect-MonitoringOps", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    connectInstanceStack,
});
new MonitoringDevStack(app, "MiniConnect-MonitoringDev", {
    // env: accountMap[env],
    env: awsEnv,
    envName: env,
    lambdaStack,
    dynamoDbStack,
});
new AwsSolutionsChecks(app);
