import * as cdk from "aws-cdk-lib";
import * as connect from "aws-cdk-lib/aws-connect";
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
