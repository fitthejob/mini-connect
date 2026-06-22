import * as cdk from "aws-cdk-lib";
import * as connect from "aws-cdk-lib/aws-connect";
import * as logs from "aws-cdk-lib/aws-logs";
export class ConnectInstanceStack extends cdk.Stack {
    instanceArn;
    instanceId;
    constructor(scope, id, props) {
        super(scope, id, props);
        const instance = new connect.CfnInstance(this, `ConnectInstance-${props.envName}`, {
            identityManagementType: "CONNECT_MANAGED",
            instanceAlias: `mc-${props.envName}`,
            attributes: {
                inboundCalls: true,
                outboundCalls: true,
                contactflowLogs: true,
            },
        });
        this.instanceArn = instance.attrArn;
        this.instanceId = instance.attrId;
        // Connect creates this log group automatically when contactflowLogs is enabled.
        // Importing it here sets a retention policy — without this it defaults to never expire,
        // which means PHI (caller phone numbers, contact attributes) is retained indefinitely.
        new logs.LogGroup(this, `ConnectFlowLogsGroup-${props.envName}`, {
            logGroupName: `/aws/connect/mc-${props.envName}`,
            retention: logs.RetentionDays.ONE_MONTH,
            encryptionKey: props.kmsStack.memberDataKey,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        new cdk.CfnOutput(this, `ConnectInstanceArn-${props.envName}`, {
            value: instance.attrArn,
        });
        new cdk.CfnOutput(this, `ConnectInstanceId-${props.envName}`, {
            value: instance.attrId,
        });
        new cdk.CfnOutput(this, `ConnectInstanceStatus-${props.envName}`, {
            value: instance.attrInstanceStatus,
        });
    }
}
