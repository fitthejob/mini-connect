import { App } from "aws-cdk-lib";

import { ConnectInstanceStack } from "../lib/connect-instance-stack.js";
import { ConnectQueuesStack } from "../lib/connect-queues-stack.js";
import { ContactFlowsStack } from "../lib/contact-flows-stack.js";

const app = new App();

const connectInstanceStack = new ConnectInstanceStack(app, "MiniConnect-Instance", {
  envName: "dev",
});

const connectQueuesStack = new ConnectQueuesStack(app, "MiniConnect-Queues", {
  envName: "dev",
  instanceArn: connectInstanceStack.instanceArn,
});

new ContactFlowsStack(app, "MiniConnect-ContactFlows", {
  envName: "dev",
  instanceArn: connectInstanceStack.instanceArn,
  supportQueueArn: connectQueuesStack.supportQueueArn,
});