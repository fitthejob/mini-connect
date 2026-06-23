import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

interface KmsStackProps extends cdk.StackProps {
  envName: string;
}

export class KmsStack extends cdk.Stack {
  readonly lambdaArtifactKey: kms.Key;
  readonly memberDataKey: kms.Key;
  readonly customerProfilesDlqKey: kms.Key;
  readonly snsAlarmKey!: kms.Key;

  constructor(scope: Construct, id: string, props: KmsStackProps) {
    super(scope, id, props);

    this.lambdaArtifactKey = new kms.Key(
      this,
      `LambdaArtifactKey-${props.envName}`,
      {
        enableKeyRotation: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      },
    );
    new cdk.CfnOutput(this, `LambdaArtifactKeyArn-${props.envName}`, {
      value: this.lambdaArtifactKey.keyArn,
      description: "KMS key ARN for Lambda artifact encryption",
    });

    this.memberDataKey = new kms.Key(this, `MemberDataKey-${props.envName}`, {
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: "AccountRootAccess",
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ["kms:*"],
            resources: ["*"],
          }),
          new iam.PolicyStatement({
            sid: "CloudWatchLogsKmsAccess",
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal(`logs.${cdk.Stack.of(this).region}.amazonaws.com`)],
            actions: ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:DescribeKey"],
            resources: ["*"],
          }),
        ],
      }),
    });
    new cdk.CfnOutput(this, `MemberDataKeyArn-${props.envName}`, {
      value: this.memberDataKey.keyArn,
      description: "KMS key ARN for DynamoDB Member data table encryption",
    });

    // Dedicated key for the Customer Profiles DLQ — profile.amazonaws.com needs
    // kms:GenerateDataKey and kms:Decrypt to publish to a KMS-encrypted SQS queue.
    // Kept separate from memberDataKey to avoid broadening its blast radius.
    this.customerProfilesDlqKey = new kms.Key(
      this,
      `CustomerProfilesDlqKey-${props.envName}`,
      {
        enableKeyRotation: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AccountRootAccess",
              effect: iam.Effect.ALLOW,
              principals: [new iam.AccountRootPrincipal()],
              actions: ["kms:*"],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              sid: "CustomerProfilesKmsAccess",
              effect: iam.Effect.ALLOW,
              principals: [new iam.ServicePrincipal("profile.amazonaws.com")],
              actions: ["kms:GenerateDataKey", "kms:Decrypt"],
              resources: ["*"],
            }),
          ],
        }),
      },
    );
    new cdk.CfnOutput(this, `CustomerProfilesDlqKeyArn-${props.envName}`, {
      value: this.customerProfilesDlqKey.keyArn,
      description: "KMS key ARN for Customer Profiles DLQ encryption",
    });

    // Shared key for SNS alarm topics (ops and dev monitoring stacks)
    this.snsAlarmKey = new kms.Key(this, `SnsAlarmKey-${props.envName}`, {
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    new cdk.CfnOutput(this, `SnsAlarmKeyArn-${props.envName}`, {
      value: this.snsAlarmKey.keyArn,
      description: "KMS key ARN for SNS alarm topic encryption (ops and dev monitoring)",
    });
  }
}
