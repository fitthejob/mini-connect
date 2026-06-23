import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
export class ClaimsStack extends cdk.Stack {
    claimsLookupHandler;
    constructor(scope, id, props) {
        super(scope, id, props);
        const dlq = new sqs.Queue(this, `ClaimsDLQ-${props.envName}`, {
            encryption: sqs.QueueEncryption.KMS,
            encryptionMasterKey: props.kmsStack.memberDataKey,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        this.claimsLookupHandler = new lambda.Function(this, `ClaimsLookupHandler-${props.envName}`, {
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: "claims_lookup.handler",
            code: lambda.Code.fromBucket(props.s3Stack.lambdaArtifactBucket, "claims_lookup.zip", ssm.StringParameter.valueFromLookup(this, `/mini-connect/${props.envName}/lambdas/claims_lookup/object_version`)),
            timeout: cdk.Duration.seconds(15),
            logGroup: new logs.LogGroup(this, `ClaimsLookupLogGroup-${props.envName}`, {
                retention: logs.RetentionDays.ONE_MONTH,
                encryptionKey: props.kmsStack.memberDataKey,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            }),
            environment: {
                CLAIMS_TABLE_NAME: props.backendDataStack.claimsTable.tableName,
            },
            environmentEncryption: props.kmsStack.memberDataKey,
            deadLetterQueue: dlq,
        });
        this.claimsLookupHandler.grantInvoke(new iam.ServicePrincipal("connect.amazonaws.com", {
            conditions: {
                StringEquals: { "aws:SourceAccount": cdk.Stack.of(this).account },
            },
        }));
        props.backendDataStack.claimsTable.grantReadData(this.claimsLookupHandler);
        new cdk.CfnOutput(this, `ClaimsLookupHandlerArn-${props.envName}`, {
            value: this.claimsLookupHandler.functionArn,
            description: "ARN of the claims lookup Lambda handler",
        });
    }
}
