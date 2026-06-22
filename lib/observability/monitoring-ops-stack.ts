import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as kms from "aws-cdk-lib/aws-kms";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { ConnectInstanceStack } from "../connect-instance-stack.js";

interface MonitoringOpsStackProps extends cdk.StackProps {
  envName: string;
  connectInstanceStack: ConnectInstanceStack;
}

export class MonitoringOpsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringOpsStackProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(
      this,
      `OpsMonitoring-${props.envName}`,
      {
        dashboardName: `MiniConnect-Operations-${props.envName}`,
      },
    );

    const opsTopicKey = new kms.Key(this, `OpsAlarmTopicKey-${props.envName}`, {
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const opsTopic = new sns.Topic(this, `OpsAlarmTopic-${props.envName}`, {
      displayName: `MiniConnect Ops Alarms (${props.envName})`,
      masterKey: opsTopicKey,
    });

    const concurrentCallsMetric = new cloudwatch.Metric({
      namespace: "AWS/Connect",
      metricName: "ConcurrentCalls",
      dimensionsMap: {
        InstanceId: props.connectInstanceStack.instanceId,
      },
      statistic: "Maximum",
      period: cdk.Duration.minutes(1),
    });

    const contactsInQueueMetric = new cloudwatch.Metric({
      namespace: "AWS/Connect",
      metricName: "ContactsInQueue",
      dimensionsMap: {
        InstanceId: props.connectInstanceStack.instanceId,
      },
      statistic: "Maximum",
      period: cdk.Duration.minutes(1),
    });

    const contactsAbandonedMetric = new cloudwatch.Metric({
      namespace: "AWS/Connect",
      metricName: "ContactsAbandoned",
      dimensionsMap: {
        InstanceId: props.connectInstanceStack.instanceId,
      },
      statistic: "Sum",
      period: cdk.Duration.minutes(5),
    });

    const averageHandleTimeMetric = new cloudwatch.Metric({
      namespace: "AWS/Connect",
      metricName: "HandleTime",
      dimensionsMap: {
        InstanceId: props.connectInstanceStack.instanceId,
      },
      statistic: "Average",
      period: cdk.Duration.minutes(5),
    });

    const contactsAbandonedAlarm = contactsAbandonedMetric.createAlarm(
      this,
      `ContactsAbandonedAlarm-${props.envName}`,
      {
        alarmName: `MiniConnect-ContactsAbandoned-${props.envName}`,
        alarmDescription:
          "Contacts abandoning in queue — check agent availability and queue wait times.",
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      },
    );
    contactsAbandonedAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(opsTopic),
    );

    const contactsInQueueAlarm = contactsInQueueMetric.createAlarm(
      this,
      `ContactsInQueueAlarm-${props.envName}`,
      {
        alarmName: `MiniConnect-ContactsInQueue-${props.envName}`,
        alarmDescription:
          "Queue depth elevated — contacts waiting longer than expected.",
        threshold: 10,
        evaluationPeriods: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      },
    );
    contactsInQueueAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(opsTopic),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Concurrent Active Calls",
        left: [concurrentCallsMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "Contacts in Queue",
        left: [contactsInQueueMetric],
        width: 12,
      }),
    );
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Abandoned Contacts",
        left: [contactsAbandonedMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "Average Handle Time (seconds)",
        left: [averageHandleTimeMetric],
        width: 12,
      }),
    );

    new cdk.CfnOutput(this, `OpsAlarmTopicArn-${props.envName}`, {
      value: opsTopic.topicArn,
      description: "SNS topic ARN for ops alarms — subscribe to receive notifications",
    });
  }
}
