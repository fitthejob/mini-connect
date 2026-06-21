import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
export class DynamoDbStack extends cdk.Stack {
    memberTable;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.memberTable = new dynamodb.Table(this, `MemberTable-${props.envName}`, {
            partitionKey: { name: "memberId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
            encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
            encryptionKey: props.kmsStack.memberDataKey,
        });
        new cdk.CfnOutput(this, `MemberTableName-${props.envName}`, {
            value: this.memberTable.tableName,
            description: "DynamoDB member table name",
        });
    }
}
