import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
export class S3Stack extends cdk.Stack {
    lambdaArtifactBucket;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.lambdaArtifactBucket = new s3.Bucket(this, `LambdaArtifacts-${props.envName}`, {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            versioned: true,
            encryptionKey: props.kmsStack.lambdaArtifactKey,
            encryption: s3.BucketEncryption.KMS,
            enforceSSL: true,
        });
        new cdk.CfnOutput(this, `LambdaArtifactBucketName-${props.envName}`, {
            value: this.lambdaArtifactBucket.bucketName,
            description: "LAMBDA_ARTIFACT_BUCKET env var",
        });
    }
}
