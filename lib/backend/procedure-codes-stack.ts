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

interface ProcedureCodesStackProps extends cdk.StackProps {
  envName: string;
  kmsStack: KmsStack;
  s3Stack: S3Stack;
  backendDataStack: BackendDataStack;
}

export class ProcedureCodesStack extends cdk.Stack {
  readonly procedureLookupHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: ProcedureCodesStackProps) {
    super(scope, id, props);

    const dlq = new sqs.Queue(this, `ProcedureCodesDLQ-${props.envName}`, {
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.kmsStack.memberDataKey,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.procedureLookupHandler = new lambda.Function(
      this,
      `ProcedureLookupHandler-${props.envName}`,
      {
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "procedure_lookup.handler",
        code: lambda.Code.fromBucket(
          props.s3Stack.lambdaArtifactBucket,
          "procedure_lookup.zip",
          ssm.StringParameter.valueFromLookup(
            this,
            `/mini-connect/${props.envName}/lambdas/procedure_lookup/object_version`,
          ),
        ),
        timeout: cdk.Duration.seconds(15),
        logGroup: new logs.LogGroup(this, `ProcedureLookupLogGroup-${props.envName}`, {
          retention: logs.RetentionDays.ONE_MONTH,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
        environment: {
          PROCEDURE_CODES_TABLE_NAME: props.backendDataStack.procedureCodesTable.tableName,
          // Formulary table also needed — procedure lookup cross-references coverage
          FORMULARY_TABLE_NAME: props.backendDataStack.formularyTable.tableName,
        },
        environmentEncryption: props.kmsStack.memberDataKey,
        deadLetterQueue: dlq,
      },
    );

    this.procedureLookupHandler.grantInvoke(
      new iam.ServicePrincipal("connect.amazonaws.com", {
        conditions: {
          StringEquals: { "aws:SourceAccount": cdk.Stack.of(this).account },
        },
      }),
    );

    props.backendDataStack.procedureCodesTable.grantReadData(this.procedureLookupHandler);
    props.backendDataStack.formularyTable.grantReadData(this.procedureLookupHandler);

    new cdk.CfnOutput(this, `ProcedureLookupHandlerArn-${props.envName}`, {
      value: this.procedureLookupHandler.functionArn,
      description: "ARN of the procedure codes lookup Lambda handler",
    });
  }
}
