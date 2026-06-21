import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
export class KmsStack extends cdk.Stack {
    lambdaArtifactKey;
    memberDataKey;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.lambdaArtifactKey = new kms.Key(this, `LambdaArtifactKey-${props.envName}`, {
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        new cdk.CfnOutput(this, `LambdaArtifactKeyArn-${props.envName}`, {
            value: this.lambdaArtifactKey.keyArn,
            description: "KMS key ARN for Lambda artifact encryption",
        });
        this.memberDataKey = new kms.Key(this, `MemberDataKey-${props.envName}`, {
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        new cdk.CfnOutput(this, `MemberDataKeyArn-${props.envName}`, {
            value: this.memberDataKey.keyArn,
            description: "KMS key ARN for DynamoDB Member data table encryption",
        });
    }
}
