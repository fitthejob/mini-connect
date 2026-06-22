import * as cdk from "aws-cdk-lib";
import * as customerprofiles from "aws-cdk-lib/aws-customerprofiles";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { KmsStack } from "./kms-stack.js";

interface CustomerProfilesStackProps extends cdk.StackProps {
  envName: string;
  kmsStack: KmsStack;
}

export class CustomerProfilesStack extends cdk.Stack {
  readonly domainName: string;

  constructor(scope: Construct, id: string, props: CustomerProfilesStackProps) {
    super(scope, id, props);

    const dlq = new sqs.Queue(this, `CustomerProfilesDLQ-${props.envName}`, {
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.kmsStack.memberDataKey,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Required so Customer Profiles can publish failed ingestion events to the DLQ
    dlq.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "CustomerProfilesSendMessage",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("profile.amazonaws.com")],
        actions: ["sqs:SendMessage"],
        resources: [dlq.queueArn],
      }),
    );

    this.domainName = `mini-connect-${props.envName}`;

    const domain = new customerprofiles.CfnDomain(
      this,
      `CustomerProfilesDomain-${props.envName}`,
      {
        domainName: this.domainName,
        defaultEncryptionKey: props.kmsStack.memberDataKey.keyArn,
        defaultExpirationDays: 366,
        deadLetterQueueUrl: dlq.queueUrl,
      },
    );

    // Customer Profiles sends a test SQS message during domain creation to validate
    // the DLQ. Explicitly depend on the queue and its policy so CloudFormation does
    // not create the domain before the policy is in place.
    domain.node.addDependency(dlq);

    // NOTE: The domain-to-instance association cannot be done via CloudFormation
    // or the API — it must be performed manually in the Connect console using the
    // KMS key and DLQ provisioned by this stack. See docs/RUNBOOK.md → Customer Profiles.
    // AWS platform constraint documented in the CreateDomain API reference.

    const domainArn = `arn:aws:profile:${this.region}:${this.account}:domains/${this.domainName}`;

    new cdk.CfnOutput(this, `CustomerProfilesDLQUrl-${props.envName}`, {
      value: dlq.queueUrl,
      description: "Customer Profiles DLQ URL — select this queue when enabling Customer Profiles in the Connect console",
    });

    new cdk.CfnOutput(this, `CustomerProfilesDomainName-${props.envName}`, {
      value: this.domainName,
      description: "Customer Profiles domain name — associate with Connect instance manually in console",
    });

    new cdk.CfnOutput(this, `CustomerProfilesDomainArn-${props.envName}`, {
      value: domainArn,
      description: "Customer Profiles domain ARN",
    });
  }
}
