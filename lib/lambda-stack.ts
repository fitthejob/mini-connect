import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { S3Stack } from "./s3-stack.js";
import { DynamoDbStack } from "./dynamodb-stack.js";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface LambdaStackProps extends cdk.StackProps {
  s3Stack: S3Stack;
  dynamoDbStack: DynamoDbStack;
  envName: string;
}

export class LambdaStack extends cdk.Stack {
  readonly hrsOfOpsHandler: lambda.Function;
  readonly memberLookupHandler: lambda.Function;
  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);
    this.hrsOfOpsHandler = new lambda.Function(
      this,
      `HrsOfOpsHandler-${props.envName}`,
      {
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "hrs_of_ops.handler",
        code: lambda.Code.fromBucket(
          props.s3Stack.lambdaArtifactBucket,
          "hrs_of_ops.zip",
          ssm.StringParameter.valueFromLookup(
            this,
            `/mini-connect/${props.envName}/lambdas/hrs_of_ops/object_version`,
          ),
        ),
      },
    );
    this.hrsOfOpsHandler.grantInvoke(
      new iam.ServicePrincipal("connect.amazonaws.com"),
    );
    new cdk.CfnOutput(this, `HrsOfOpsHandlerArn-${props.envName}`, {
      value: this.hrsOfOpsHandler.functionArn,
      description: "ARN of the hours of operations Lambda handler",
    });

    this.memberLookupHandler = new lambda.Function(
      this,
      `MemberLookupHandler-${props.envName}`,
      {
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "member_lookup.handler",
        code: lambda.Code.fromBucket(
          props.s3Stack.lambdaArtifactBucket,
          "member_lookup.zip",
          ssm.StringParameter.valueFromLookup(
            this,
            `/mini-connect/${props.envName}/lambdas/member_lookup/object_version`,
          ),
        ),
        environment: {
          MEMBER_TABLE_NAME: props.dynamoDbStack.memberTable.tableName,
        },
      },
    );
    this.memberLookupHandler.grantInvoke(
      new iam.ServicePrincipal("connect.amazonaws.com"),
    );
    props.dynamoDbStack.memberTable.grantReadData(this.memberLookupHandler);
    new cdk.CfnOutput(this, `MemberLookupHandlerArn-${props.envName}`, {
      value: this.memberLookupHandler.functionArn,
      description: "ARN of the member lookup Lambda handler",
    });
  }
}
