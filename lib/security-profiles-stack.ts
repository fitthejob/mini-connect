import * as cdk from "aws-cdk-lib";
import * as connect from "aws-cdk-lib/aws-connect";
import { Construct } from "constructs";
import { ConnectInstanceStack } from "./connect-instance-stack.js";

interface SecurityProfilesStackProps extends cdk.StackProps {
  envName: string;
  connectInstanceStack: ConnectInstanceStack;
}

export class SecurityProfilesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SecurityProfilesStackProps) {
    super(scope, id, props);

    // Read-only profile for auditors, supervisors, or ops staff who need full
    // visibility into instance configuration without any ability to make changes.
    // Grants View on every configurable resource type; excludes all Edit/Create/Delete
    // permissions and all contact-handling capabilities (no outbound calls, no chat).
    new connect.CfnSecurityProfile(
      this,
      `InstanceViewerProfile-${props.envName}`,
      {
        instanceArn: props.connectInstanceStack.instanceArn,
        securityProfileName: `InstanceViewer-${props.envName}`,
        description:
          "Read-only access to all instance configuration. " +
          "View users, queues, flows, routing profiles, security profiles, " +
          "hours of operation, phone numbers, quick connects, prompts, " +
          "hierarchy, and reporting. No write permissions.",
        permissions: [
          // ── Agent access (login only — no contact handling capabilities) ──────
          "BasicAgentAccess",

          // ── Users and access control ──────────────────────────────────────────
          "Users.View",
          "SecurityProfiles.View",
          "AgentGrouping.View",
          "AgentStates.View",

          // ── Routing configuration ─────────────────────────────────────────────
          "RoutingPolicies.View",
          "Queues.View",
          "TransferDestinations.View",
          "HoursOfOperation.View",
          "PhoneNumbers.View",

          // ── Contact flows ─────────────────────────────────────────────────────
          "ContactFlows.View",
          "ContactFlowModules.View",
          "Prompts.View",
          "Views.View",

          // ── Contact data and attributes ───────────────────────────────────────
          "ContactAttributes.View",
          "ContactSearch.View",
          "ConfigureContactAttributes.View",

          // ── Reporting and analytics ───────────────────────────────────────────
          "AccessMetrics",
          "MetricsReports.View",
          "ReportSchedules.View",
          "Rules.View",
        ],
      },
    );
  }
}
