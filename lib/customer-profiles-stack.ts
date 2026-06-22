import * as cdk from "aws-cdk-lib";
import * as connect from "aws-cdk-lib/aws-connect";
import * as customerprofiles from "aws-cdk-lib/aws-customerprofiles";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { KmsStack } from "./kms-stack.js";

interface CustomerProfilesStackProps extends cdk.StackProps {
  envName: string;
  instanceArn: string;
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

    this.domainName = `mini-connect-${props.envName}`;

    new customerprofiles.CfnDomain(
      this,
      `CustomerProfilesDomain-${props.envName}`,
      {
        domainName: this.domainName,
        defaultEncryptionKey: props.kmsStack.memberDataKey.keyArn,
        defaultExpirationDays: 366,
        deadLetterQueueUrl: dlq.queueUrl,
      },
    );

    // CfnDomain exposes no ARN GetAtt — construct it from known parts
    const domainArn = `arn:aws:profile:${this.region}:${this.account}:domains/${this.domainName}`;

    new connect.CfnIntegrationAssociation(
      this,
      `CustomerProfilesIntegration-${props.envName}`,
      {
        instanceId: props.instanceArn,
        integrationType: "CUSTOMER_PROFILES",
        integrationArn: domainArn,
      },
    );

    new cdk.CfnOutput(this, `CustomerProfilesDomainName-${props.envName}`, {
      value: this.domainName,
      description: "Customer Profiles domain name",
    });

    new cdk.CfnOutput(this, `CustomerProfilesDomainArn-${props.envName}`, {
      value: domainArn,
      description: "Customer Profiles domain ARN",
    });
  }
}
