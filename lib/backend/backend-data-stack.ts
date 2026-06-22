import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { KmsStack } from "../kms-stack.js";

interface BackendDataStackProps extends cdk.StackProps {
  envName: string;
  kmsStack: KmsStack;
}

export class BackendDataStack extends cdk.Stack {
  readonly claimsTable: dynamodb.Table;
  readonly providersTable: dynamodb.Table;
  readonly formularyTable: dynamodb.Table;
  readonly billingTable: dynamodb.Table;
  readonly procedureCodesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: BackendDataStackProps) {
    super(scope, id, props);

    const tableDefaults = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsStack.memberDataKey,
    };

    // Claims — PK: claimId, SK: memberId
    // GSI on memberId so we can look up all claims for a member.
    // SK enforces that a claim lookup must match the calling member (ANI-verified).
    this.claimsTable = new dynamodb.Table(this, `ClaimsTable-${props.envName}`, {
      ...tableDefaults,
      partitionKey: { name: "claimId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "memberId", type: dynamodb.AttributeType.STRING },
    });
    this.claimsTable.addGlobalSecondaryIndex({
      indexName: "memberId-index",
      partitionKey: { name: "memberId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    new cdk.CfnOutput(this, `ClaimsTableName-${props.envName}`, {
      value: this.claimsTable.tableName,
      description: "DynamoDB claims table name",
    });

    // Providers — PK: providerId
    // GSI on normalizedName for name-based lookup (caller says provider name).
    // GSI on specialty+zipCode for "find a specialist near me" queries.
    this.providersTable = new dynamodb.Table(this, `ProvidersTable-${props.envName}`, {
      ...tableDefaults,
      partitionKey: { name: "providerId", type: dynamodb.AttributeType.STRING },
    });
    this.providersTable.addGlobalSecondaryIndex({
      indexName: "name-index",
      partitionKey: { name: "normalizedName", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.providersTable.addGlobalSecondaryIndex({
      indexName: "specialty-zip-index",
      partitionKey: { name: "specialty", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "zipCode", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    new cdk.CfnOutput(this, `ProvidersTableName-${props.envName}`, {
      value: this.providersTable.tableName,
      description: "DynamoDB providers table name",
    });

    // Formulary — PK: planId, SK: normalizedMedicationName
    // Coverage varies by plan — the same medication may be covered under Gold
    // but require prior auth under Bronze. Composite key enforces plan-scoped lookup.
    this.formularyTable = new dynamodb.Table(this, `FormularyTable-${props.envName}`, {
      ...tableDefaults,
      partitionKey: { name: "planId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "normalizedMedicationName", type: dynamodb.AttributeType.STRING },
    });
    new cdk.CfnOutput(this, `FormularyTableName-${props.envName}`, {
      value: this.formularyTable.tableName,
      description: "DynamoDB formulary table name",
    });

    // Billing — PK: invoiceId, SK: memberId
    // SK enforces that invoice lookup must match the calling member.
    // GSI on memberId to retrieve all invoices for a member.
    this.billingTable = new dynamodb.Table(this, `BillingTable-${props.envName}`, {
      ...tableDefaults,
      partitionKey: { name: "invoiceId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "memberId", type: dynamodb.AttributeType.STRING },
    });
    this.billingTable.addGlobalSecondaryIndex({
      indexName: "memberId-index",
      partitionKey: { name: "memberId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    new cdk.CfnOutput(this, `BillingTableName-${props.envName}`, {
      value: this.billingTable.tableName,
      description: "DynamoDB billing table name",
    });

    // Procedure codes — PK: procedureCode
    // Standalone reference table — codes exist independently of members or plans.
    // The formulary Lambda cross-references this table when checking prior auth requirements.
    this.procedureCodesTable = new dynamodb.Table(this, `ProcedureCodesTable-${props.envName}`, {
      ...tableDefaults,
      partitionKey: { name: "procedureCode", type: dynamodb.AttributeType.STRING },
    });
    new cdk.CfnOutput(this, `ProcedureCodesTableName-${props.envName}`, {
      value: this.procedureCodesTable.tableName,
      description: "DynamoDB procedure codes table name",
    });
  }
}
