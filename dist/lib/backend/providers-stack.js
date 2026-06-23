import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
export class ProvidersStack extends cdk.Stack {
    providerLookupHandler;
    constructor(scope, id, props) {
        super(scope, id, props);
        const dlq = new sqs.Queue(this, `ProvidersDLQ-${props.envName}`, {
            encryption: sqs.QueueEncryption.KMS,
            encryptionMasterKey: props.kmsStack.memberDataKey,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        this.providerLookupHandler = new lambda.Function(this, `ProviderLookupHandler-${props.envName}`, {
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: "provider_lookup.handler",
            code: lambda.Code.fromBucket(props.s3Stack.lambdaArtifactBucket, "provider_lookup.zip", ssm.StringParameter.valueFromLookup(this, `/mini-connect/${props.envName}/lambdas/provider_lookup/object_version`)),
            timeout: cdk.Duration.seconds(15),
            logGroup: new logs.LogGroup(this, `ProviderLookupLogGroup-${props.envName}`, {
                retention: logs.RetentionDays.ONE_MONTH,
                encryptionKey: props.kmsStack.memberDataKey,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            }),
            environment: {
                PROVIDERS_TABLE_NAME: props.backendDataStack.providersTable.tableName,
            },
            environmentEncryption: props.kmsStack.memberDataKey,
            deadLetterQueue: dlq,
        });
        this.providerLookupHandler.grantInvoke(new iam.ServicePrincipal("connect.amazonaws.com", {
            conditions: {
                StringEquals: { "aws:SourceAccount": cdk.Stack.of(this).account },
            },
        }));
        props.backendDataStack.providersTable.grantReadData(this.providerLookupHandler);
        new cdk.CfnOutput(this, `ProviderLookupHandlerArn-${props.envName}`, {
            value: this.providerLookupHandler.functionArn,
            description: "ARN of the provider lookup Lambda handler",
        });
    }
}
