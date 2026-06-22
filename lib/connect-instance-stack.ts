import * as cdk from "aws-cdk-lib";
import * as connect from "aws-cdk-lib/aws-connect";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface ConnectInstanceStackProps extends cdk.StackProps {
  envName: string;
}

export class ConnectInstanceStack extends cdk.Stack {
  readonly instanceArn: string;
  readonly instanceId: string;

  constructor(scope: Construct, id: string, props: ConnectInstanceStackProps) {
    super(scope, id, props);

    const instance = new connect.CfnInstance(
      this,
      `ConnectInstance-${props.envName}`,
      {
        identityManagementType: "CONNECT_MANAGED",
        instanceAlias: `mc-${props.envName}`,
        attributes: {
          inboundCalls: true,
          outboundCalls: true,
          contactflowLogs: true,
        },
      },
    );

    this.instanceArn = instance.attrArn;
    this.instanceId = instance.attrId;

    // Connect creates this log group automatically when contactflowLogs is enabled.
    // LogRetention custom resource handles both new and existing log groups — it calls
    // PutRetentionPolicy regardless of whether the group already exists, avoiding the
    // "resource already exists" error that new LogGroup() would throw.
    new logs.LogRetention(this, `ConnectFlowLogRetention-${props.envName}`, {
      logGroupName: `/aws/connect/mc-${props.envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
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
