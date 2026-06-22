import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { DynamoDbStack } from "../dynamodb-stack.js";
import { LambdaStack } from "../lambda-stack.js";

interface MonitoringDevStackProps extends cdk.StackProps {
  envName: string;
  lambdaStack: LambdaStack;
  dynamoDbStack: DynamoDbStack;
}

export class MonitoringDevStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringDevStackProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(
      this,
      `DevMonitoring-${props.envName}`,
      {
        dashboardName: `MiniConnect-Developer-${props.envName}`,
      },
    );

    const devTopic = new sns.Topic(this, `DevAlarmTopic-${props.envName}`, {
      displayName: `MiniConnect Dev Alarms (${props.envName})`,
    });

    const hrsOfOpsLambdaErrorsMetric = new cloudwatch.Metric({
      namespace: "AWS/Lambda",
      metricName: "Errors",
      dimensionsMap: {
        FunctionName: props.lambdaStack.hrsOfOpsHandler.functionName,
      },
      statistic: "Sum",
      period: cdk.Duration.minutes(5),
    });

    const hrsOfOpsLambdaDurationMetric = new cloudwatch.Metric({
      namespace: "AWS/Lambda",
      metricName: "Duration",
      dimensionsMap: {
        FunctionName: props.lambdaStack.hrsOfOpsHandler.functionName,
      },
      statistic: "p95",
      period: cdk.Duration.minutes(5),
    });

    const memberLookupLambdaErrorsMetric = new cloudwatch.Metric({
      namespace: "AWS/Lambda",
      metricName: "Errors",
      dimensionsMap: {
        FunctionName: props.lambdaStack.memberLookupHandler.functionName,
      },
      statistic: "Sum",
      period: cdk.Duration.minutes(5),
    });

    const memberLookupLambdaDurationMetric = new cloudwatch.Metric({
      namespace: "AWS/Lambda",
      metricName: "Duration",
      dimensionsMap: {
        FunctionName: props.lambdaStack.memberLookupHandler.functionName,
      },
      statistic: "p95",
      period: cdk.Duration.minutes(5),
    });

    const dynamoDbReadLatencyMetric = new cloudwatch.Metric({
      namespace: "AWS/DynamoDB",
      metricName: "SuccessfulRequestLatency",
      dimensionsMap: {
        TableName: props.dynamoDbStack.memberTable.tableName,
        Operation: "GetItem",
      },
      statistic: "p99",
      period: cdk.Duration.minutes(5),
    });

    const dynamoDbWriteLatencyMetric = new cloudwatch.Metric({
      namespace: "AWS/DynamoDB",
      metricName: "SuccessfulRequestLatency",
      dimensionsMap: {
        TableName: props.dynamoDbStack.memberTable.tableName,
        Operation: "PutItem",
      },
      statistic: "p99",
      period: cdk.Duration.minutes(5),
    });

    const hrsOfOpsErrorsAlarm = hrsOfOpsLambdaErrorsMetric.createAlarm(
      this,
      `HrsOfOpsErrorsAlarm-${props.envName}`,
      {
        alarmName: `MiniConnect-HrsOfOpsErrors-${props.envName}`,
        alarmDescription:
          "HrsOfOps Lambda is erroring — business hours routing may be affected.",
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      },
    );
    hrsOfOpsErrorsAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(devTopic),
    );

    const memberLookupErrorsAlarm = memberLookupLambdaErrorsMetric.createAlarm(
      this,
      `MemberLookupErrorsAlarm-${props.envName}`,
      {
        alarmName: `MiniConnect-MemberLookupErrors-${props.envName}`,
        alarmDescription:
          "MemberLookup Lambda is erroring — member data will not surface to agents.",
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      },
    );
    memberLookupErrorsAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(devTopic),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "HrsOfOps Lambda Errors",
        left: [hrsOfOpsLambdaErrorsMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "HrsOfOps Lambda Duration",
        left: [hrsOfOpsLambdaDurationMetric],
        width: 12,
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "MemberLookup Lambda Errors",
        left: [memberLookupLambdaErrorsMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "MemberLookup Lambda Duration p95 (ms)",
        left: [memberLookupLambdaDurationMetric],
        width: 12,
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "DynamoDB Read Latency p99 (ms)",
        left: [dynamoDbReadLatencyMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "DynamoDB Write Latency p99 (ms)",
        left: [dynamoDbWriteLatencyMetric],
        width: 12,
      }),
    );

    new cdk.CfnOutput(this, `DevAlarmTopicArn-${props.envName}`, {
      value: devTopic.topicArn,
      description: "SNS topic ARN for dev alarms — subscribe to receive notifications",
    });
  }
}
