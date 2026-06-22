import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
export class BillingStack extends cdk.Stack {
    billingLookupHandler;
    constructor(scope, id, props) {
        super(scope, id, props);
        const dlq = new sqs.Queue(this, `BillingDLQ-${props.envName}`, {
            encryption: sqs.QueueEncryption.KMS,
            encryptionMasterKey: props.kmsStack.memberDataKey,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        this.billingLookupHandler = new lambda.Function(this, `BillingLookupHandler-${props.envName}`, {
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: "billing_lookup.handler",
            code: lambda.Code.fromBucket(props.s3Stack.lambdaArtifactBucket, "billing_lookup.zip", ssm.StringParameter.valueFromLookup(this, `/mini-connect/${props.envName}/lambdas/billing_lookup/object_version`)),
            timeout: cdk.Duration.seconds(15),
            logRetention: logs.RetentionDays.ONE_MONTH,
            environment: {
                BILLING_TABLE_NAME: props.backendDataStack.billingTable.tableName,
            },
            environmentEncryption: props.kmsStack.memberDataKey,
            deadLetterQueue: dlq,
        });
        this.billingLookupHandler.grantInvoke(new iam.ServicePrincipal("connect.amazonaws.com", {
            conditions: {
                StringEquals: { "aws:SourceAccount": cdk.Stack.of(this).account },
            },
        }));
        props.backendDataStack.billingTable.grantReadData(this.billingLookupHandler);
        new cdk.CfnOutput(this, `BillingLookupHandlerArn-${props.envName}`, {
            value: this.billingLookupHandler.functionArn,
            description: "ARN of the billing lookup Lambda handler",
        });
    }
}
