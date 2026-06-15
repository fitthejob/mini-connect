import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import { CfnHoursOfOperation, CfnQueue } from "aws-cdk-lib/aws-connect";
import { Construct } from "constructs";

export interface ConnectQueuesStackProps extends StackProps {
  envName: string;
  instanceArn: string;
}

export class ConnectQueuesStack extends Stack {
  readonly supportQueueArn: string;

  constructor(scope: Construct, id: string, props: ConnectQueuesStackProps) {
    super(scope, id, props);

    const businessHours = new CfnHoursOfOperation(this, "BusinessHours", {
      instanceArn: props.instanceArn,
      name: `BusinessHours-${props.envName}`,
      description: "Business hours for the support queue.",
      timeZone: "America/New_York",
      config: [
        {
          day: "MONDAY",
          startTime: { hours: 9, minutes: 0 },
          endTime: { hours: 17, minutes: 0 },
        },
        {
          day: "TUESDAY",
          startTime: { hours: 9, minutes: 0 },
          endTime: { hours: 17, minutes: 0 },
        },
        {
          day: "WEDNESDAY",
          startTime: { hours: 9, minutes: 0 },
          endTime: { hours: 17, minutes: 0 },
        },
        {
          day: "THURSDAY",
          startTime: { hours: 9, minutes: 0 },
          endTime: { hours: 17, minutes: 0 },
        },
        {
          day: "FRIDAY",
          startTime: { hours: 9, minutes: 0 },
          endTime: { hours: 17, minutes: 0 },
        },
      ],
    });

    const supportQueue = new CfnQueue(this, "SupportQueue", {
      instanceArn: props.instanceArn,
      name: `Support-${props.envName}`,
      description: "Support queue for inbound routing.",
      hoursOfOperationArn: businessHours.attrHoursOfOperationArn,
      status: "ENABLED",
    });

    this.supportQueueArn = supportQueue.attrQueueArn;

    new CfnOutput(this, "BusinessHoursArn", {
      value: businessHours.attrHoursOfOperationArn,
    });

    new CfnOutput(this, "SupportQueueArn", {
      value: supportQueue.attrQueueArn,
    });
  }
}