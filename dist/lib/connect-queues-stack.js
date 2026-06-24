import * as cdk from "aws-cdk-lib";
import * as connect from "aws-cdk-lib/aws-connect";
export class ConnectQueuesStack extends cdk.Stack {
    supportQueueArn;
    claimsQueueArn;
    billingQueueArn;
    pharmacyQueueArn;
    providerQueueArn;
    memberServicesQueueArn;
    constructor(scope, id, props) {
        super(scope, id, props);
        const businessHours = new connect.CfnHoursOfOperation(this, `BusinessHours-${props.envName}`, {
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
        const supportQueue = new connect.CfnQueue(this, `SupportQueue-${props.envName}`, {
            instanceArn: props.instanceArn,
            name: `Support-${props.envName}`,
            description: "Support queue for inbound routing.",
            hoursOfOperationArn: businessHours.attrHoursOfOperationArn,
            status: "ENABLED",
        });
        this.supportQueueArn = supportQueue.attrQueueArn;
        const makeQueue = (id, name, description) => {
            const q = new connect.CfnQueue(this, id, {
                instanceArn: props.instanceArn,
                name,
                description,
                hoursOfOperationArn: businessHours.attrHoursOfOperationArn,
                status: "ENABLED",
            });
            new cdk.CfnOutput(this, `${id}Arn`, { value: q.attrQueueArn });
            return q.attrQueueArn;
        };
        this.claimsQueueArn = makeQueue(`ClaimsQueue-${props.envName}`, `Claims-${props.envName}`, "Claims status inquiries.");
        this.billingQueueArn = makeQueue(`BillingQueue-${props.envName}`, `Billing-${props.envName}`, "Billing and invoice inquiries.");
        this.pharmacyQueueArn = makeQueue(`PharmacyQueue-${props.envName}`, `Pharmacy-${props.envName}`, "Prescription and prior authorization inquiries.");
        this.providerQueueArn = makeQueue(`ProviderQueue-${props.envName}`, `Provider-${props.envName}`, "Provider network lookup inquiries.");
        this.memberServicesQueueArn = makeQueue(`MemberServicesQueue-${props.envName}`, `MemberServices-${props.envName}`, "Eligibility, benefits, and general member services.");
        new cdk.CfnOutput(this, `BusinessHoursArn-${props.envName}`, {
            value: businessHours.attrHoursOfOperationArn,
        });
        new cdk.CfnOutput(this, `SupportQueueArn-${props.envName}`, {
            value: supportQueue.attrQueueArn,
        });
    }
}
