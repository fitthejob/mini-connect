import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
export class S3Stack extends cdk.Stack {
    lambdaArtifactBucket;
    constructor(scope, id, props) {
        super(scope, id, props);
        const accessLogBucket = new s3.Bucket(this, `LambdaArtifactsAccessLogs-${props.envName}`, {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            enforceSSL: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
        });
        this.lambdaArtifactBucket = new s3.Bucket(this, `LambdaArtifacts-${props.envName}`, {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            versioned: true,
            encryptionKey: props.kmsStack.lambdaArtifactKey,
            encryption: s3.BucketEncryption.KMS,
            enforceSSL: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            serverAccessLogsBucket: accessLogBucket,
            serverAccessLogsPrefix: `${props.envName}/`,
        });
        new cdk.CfnOutput(this, `LambdaArtifactBucketName-${props.envName}`, {
            value: this.lambdaArtifactBucket.bucketName,
            description: "LAMBDA_ARTIFACT_BUCKET env var",
            exportName: `LambdaArtifactBucketName-${props.envName}`,
        });
    }
}
