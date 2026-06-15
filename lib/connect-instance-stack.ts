import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import { CfnInstance } from "aws-cdk-lib/aws-connect";
import { Construct } from "constructs";

export interface ConnectInstanceStackProps extends StackProps {
  envName: string;
}

export class ConnectInstanceStack extends Stack {
  readonly instanceArn: string;

  constructor(scope: Construct, id: string, props: ConnectInstanceStackProps) {
    super(scope, id, props);

    const instance = new CfnInstance(this, "ConnectInstance", {
      identityManagementType: "CONNECT_MANAGED",
      instanceAlias: `mini-connect-${props.envName}`,
      attributes: {
        inboundCalls: true,
        outboundCalls: true,
      },
    });

    this.instanceArn = instance.attrArn;

    new CfnOutput(this, "ConnectInstanceArn", {
      value: instance.attrArn,
    });

    new CfnOutput(this, "ConnectInstanceId", {
      value: instance.attrId,
    });

    new CfnOutput(this, "ConnectInstanceStatus", {
      value: instance.attrInstanceStatus,
    });
  }
}