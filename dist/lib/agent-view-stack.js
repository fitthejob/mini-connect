import * as cdk from "aws-cdk-lib";
import * as connect from "aws-cdk-lib/aws-connect";
// Detail view template for the agent workspace screen pop.
// AttributeBar is the persistent header strip (member identity, always visible).
// Sections is the intent-specific body (lookup results).
// The view data is injected at runtime by the ShowView block in the flow using
// contact attributes,values like $.Attributes.externalStatus are passed as
// ViewData entries and referenced here via TemplateString interpolation.
function detailViewTemplate(heading, sections) {
    return {
        AttributeBar: [
            { Label: "Member ID", Value: "$.Attributes.memberId" },
            { Label: "Plan", Value: "$.Attributes.planId" },
            { Label: "Coverage", Value: "$.Attributes.coverageStatus" },
            { Label: "Language", Value: "$.Attributes.preferredLanguage" },
        ],
        Heading: heading,
        Sections: sections,
    };
}
export class AgentViewStack extends cdk.Stack {
    claimsViewArn;
    billingViewArn;
    formularyViewArn;
    providerViewArn;
    priorAuthViewArn;
    eligibilityViewArn;
    benefitsViewArn;
    constructor(scope, id, props) {
        super(scope, id, props);
        const makeView = (logicalId, name, description, template) => {
            const view = new connect.CfnView(this, logicalId, {
                instanceArn: props.instanceArn,
                name: `${name}-${props.envName}`,
                description,
                actions: ["Transfer", "EndCall"],
                template,
            });
            new cdk.CfnOutput(this, `${logicalId}Arn`, { value: view.attrViewArn });
            return view;
        };
        // ── Claims ────────────────────────────────────────────────────────────────
        const claimsView = makeView("ClaimsView", "ClaimsStatus", "Claims status screen pop,shows claim lookup result to agent at answer time.", detailViewTemplate("Claims Status", [
            {
                Heading: "Caller Intent",
                Type: "DataSection",
                Items: [
                    { Label: "Call Reason", Value: "$.Attributes.callReason" },
                    { Label: "Claim Number", Value: "$.Attributes.slotClaimNumber" },
                    { Label: "Date of Service", Value: "$.Attributes.slotDateOfService" },
                ],
            },
            {
                Heading: "Lookup Result",
                Type: "DataSection",
                Items: [
                    { Label: "Status", Value: "$.Attributes.externalStatus" },
                    { Label: "Billed Amount", Value: "$.Attributes.externalBilledAmount" },
                    { Label: "Paid Amount", Value: "$.Attributes.externalPaidAmount" },
                    { Label: "Denial Reason", Value: "$.Attributes.externalDenialReason" },
                    { Label: "Date of Service", Value: "$.Attributes.externalDateOfService" },
                ],
            },
        ]));
        this.claimsViewArn = claimsView.attrViewArn;
        // ── Billing ───────────────────────────────────────────────────────────────
        const billingView = makeView("BillingView", "BillingInquiry", "Billing inquiry screen pop,shows invoice lookup result to agent at answer time.", detailViewTemplate("Billing Inquiry", [
            {
                Heading: "Caller Intent",
                Type: "DataSection",
                Items: [
                    { Label: "Call Reason", Value: "$.Attributes.callReason" },
                    { Label: "Invoice Number", Value: "$.Attributes.slotInvoiceNumber" },
                ],
            },
            {
                Heading: "Lookup Result",
                Type: "DataSection",
                Items: [
                    { Label: "Status", Value: "$.Attributes.externalStatus" },
                    { Label: "Amount", Value: "$.Attributes.externalAmount" },
                    { Label: "Date Issued", Value: "$.Attributes.externalDateIssued" },
                    { Label: "Due Date", Value: "$.Attributes.externalDueDate" },
                    { Label: "Description", Value: "$.Attributes.externalDescription" },
                ],
            },
        ]));
        this.billingViewArn = billingView.attrViewArn;
        // ── Formulary ─────────────────────────────────────────────────────────────
        const formularyView = makeView("FormularyView", "FormularyLookup", "Formulary lookup screen pop,shows prescription coverage result to agent at answer time.", detailViewTemplate("Prescription Formulary", [
            {
                Heading: "Caller Intent",
                Type: "DataSection",
                Items: [
                    { Label: "Call Reason", Value: "$.Attributes.callReason" },
                    { Label: "Medication Name", Value: "$.Attributes.slotMedicationName" },
                ],
            },
            {
                Heading: "Lookup Result",
                Type: "DataSection",
                Items: [
                    { Label: "Medication", Value: "$.Attributes.externalMedicationName" },
                    { Label: "Covered", Value: "$.Attributes.externalCovered" },
                    { Label: "Tier", Value: "$.Attributes.externalTier" },
                    { Label: "Copay", Value: "$.Attributes.externalCopay" },
                    { Label: "Requires Prior Auth", Value: "$.Attributes.externalRequiresPriorAuth" },
                ],
            },
        ]));
        this.formularyViewArn = formularyView.attrViewArn;
        // ── Provider ──────────────────────────────────────────────────────────────
        const providerView = makeView("ProviderView", "ProviderLookup", "Provider network lookup screen pop,shows in-network status to agent at answer time.", detailViewTemplate("Provider Network Lookup", [
            {
                Heading: "Caller Intent",
                Type: "DataSection",
                Items: [
                    { Label: "Call Reason", Value: "$.Attributes.callReason" },
                    { Label: "Provider Name", Value: "$.Attributes.slotProviderName" },
                    { Label: "Specialty", Value: "$.Attributes.slotSpecialty" },
                    { Label: "Zip Code", Value: "$.Attributes.slotZipCode" },
                ],
            },
            {
                Heading: "Lookup Result",
                Type: "DataSection",
                Items: [
                    { Label: "Name", Value: "$.Attributes.externalName" },
                    { Label: "Phone", Value: "$.Attributes.externalPhone" },
                    { Label: "In-Network", Value: "$.Attributes.externalInNetwork" },
                ],
            },
        ]));
        this.providerViewArn = providerView.attrViewArn;
        // ── Prior Auth ────────────────────────────────────────────────────────────
        const priorAuthView = makeView("PriorAuthView", "PriorAuthorization", "Prior authorization screen pop,shows procedure coverage and auth requirement to agent.", detailViewTemplate("Prior Authorization", [
            {
                Heading: "Caller Intent",
                Type: "DataSection",
                Items: [
                    { Label: "Call Reason", Value: "$.Attributes.callReason" },
                    { Label: "Procedure Code", Value: "$.Attributes.slotProcedureCode" },
                    { Label: "Provider Name", Value: "$.Attributes.slotProviderName" },
                ],
            },
            {
                Heading: "Lookup Result",
                Type: "DataSection",
                Items: [
                    { Label: "Covered", Value: "$.Attributes.externalCovered" },
                    { Label: "Requires Prior Auth", Value: "$.Attributes.externalRequiresPriorAuth" },
                    { Label: "Description", Value: "$.Attributes.externalDescription" },
                ],
            },
        ]));
        this.priorAuthViewArn = priorAuthView.attrViewArn;
        // ── Eligibility ───────────────────────────────────────────────────────────
        const eligibilityView = makeView("EligibilityView", "EligibilityCheck", "Eligibility screen pop,shows coverage status from ANI lookup to agent at answer time.", detailViewTemplate("Eligibility Check", [
            {
                Heading: "Caller Intent",
                Type: "DataSection",
                Items: [
                    { Label: "Call Reason", Value: "$.Attributes.callReason" },
                ],
            },
            {
                Heading: "Coverage Status",
                Type: "DataSection",
                Items: [
                    { Label: "Coverage Status", Value: "$.Attributes.coverageStatus" },
                    { Label: "Member ID", Value: "$.Attributes.memberId" },
                    { Label: "Plan", Value: "$.Attributes.planId" },
                ],
            },
        ]));
        this.eligibilityViewArn = eligibilityView.attrViewArn;
        // ── Benefits ──────────────────────────────────────────────────────────────
        const benefitsView = makeView("BenefitsView", "BenefitsInquiry", "Benefits inquiry screen pop,shows service type and caller identity to agent at answer time.", detailViewTemplate("Benefits Inquiry", [
            {
                Heading: "Caller Intent",
                Type: "DataSection",
                Items: [
                    { Label: "Call Reason", Value: "$.Attributes.callReason" },
                    { Label: "Service Type", Value: "$.Attributes.slotServiceType" },
                ],
            },
        ]));
        this.benefitsViewArn = benefitsView.attrViewArn;
    }
}
