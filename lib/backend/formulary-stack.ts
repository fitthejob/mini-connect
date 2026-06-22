import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { BackendDataStack } from "./backend-data-stack.js";
import { KmsStack } from "../kms-stack.js";
import { S3Stack } from "../s3-stack.js";

interface FormularyStackProps extends cdk.StackProps {
  envName: string;
  kmsStack: KmsStack;
  s3Stack: S3Stack;
  backendDataStack: BackendDataStack;
}

export class FormularyStack extends cdk.Stack {
  readonly formularyLookupHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: FormularyStackProps) {
    super(scope, id, props);

    const dlq = new sqs.Queue(this, `FormularyDLQ-${props.envName}`, {
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.kmsStack.memberDataKey,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.formularyLookupHandler = new lambda.Function(
      this,
      `FormularyLookupHandler-${props.envName}`,
      {
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "formulary_lookup.handler",
        code: lambda.Code.fromBucket(
          props.s3Stack.lambdaArtifactBucket,
          "formulary_lookup.zip",
          ssm.StringParameter.valueFromLookup(
            this,
            `/mini-connect/${props.envName}/lambdas/formulary_lookup/object_version`,
          ),
        ),
        timeout: cdk.Duration.seconds(15),
        logRetention: logs.RetentionDays.ONE_MONTH,
        environment: {
          FORMULARY_TABLE_NAME: props.backendDataStack.formularyTable.tableName,
        },
        environmentEncryption: props.kmsStack.memberDataKey,
        deadLetterQueue: dlq,
      },
    );

    this.formularyLookupHandler.grantInvoke(
      new iam.ServicePrincipal("connect.amazonaws.com", {
        conditions: {
          StringEquals: { "aws:SourceAccount": cdk.Stack.of(this).account },
        },
      }),
    );

    props.backendDataStack.formularyTable.grantReadData(this.formularyLookupHandler);

    new cdk.CfnOutput(this, `FormularyLookupHandlerArn-${props.envName}`, {
      value: this.formularyLookupHandler.functionArn,
      description: "ARN of the formulary lookup Lambda handler",
    });
  }
}
