import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
export class MonitoringOpsStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const dashboard = new cloudwatch.Dashboard(this, `OpsMonitoring-${props.envName}`, {
            dashboardName: `MiniConnect-Operations-${props.envName}`,
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
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: "Concurrent Active Calls",
            left: [concurrentCallsMetric],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: "Contacts in Queue",
            left: [contactsInQueueMetric],
            width: 12,
        }));
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: "Abandoned Contacts",
            left: [contactsAbandonedMetric],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: "Average Handle Time (seconds)",
            left: [averageHandleTimeMetric],
            width: 12,
        }));
    }
}
