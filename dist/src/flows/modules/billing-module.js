import { CompareActionBuilder, EndFlowModuleExecutionActionBuilder, FlowBuilder, GetParticipantInputActionBuilder, InvokeLambdaFunctionActionBuilder, MessageParticipantActionBuilder, UpdateContactAttributesActionBuilder, equalsCondition, } from "connect-flow-builder";
export const billingModuleSpec = {
    key: "billingModule",
    name: "BillingModule",
    type: "CONTACT_FLOW_MODULE",
    filename: "billing-module.json",
    description: "Billing invoice self-service — invokes BillingLookup Lambda, reads back status and amount.",
    build: (context) => {
        const languageCheck = new CompareActionBuilder("BillingLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "BillingLookupBridgeSpanish")
            .onError("BillingLookupBridgeEnglish", "NoMatchingCondition")
            .build();
        const bridgeEnglish = new MessageParticipantActionBuilder("BillingLookupBridgeEnglish")
            .text("One moment while I pull up your invoice.")
            .next("BillingSetLookupAttempted")
            .build();
        const bridgeSpanish = new MessageParticipantActionBuilder("BillingLookupBridgeSpanish")
            .text("Un momento mientras busco su factura.")
            .next("BillingSetLookupAttempted")
            .build();
        const setLookupAttempted = new UpdateContactAttributesActionBuilder("BillingSetLookupAttempted")
            .attribute("lookupAttempted", "true")
            .next("InvokeBillingLookup")
            .build();
        const invokeLambda = new InvokeLambdaFunctionActionBuilder("InvokeBillingLookup")
            .lambdaArn(context.refs.lambdaArn("billingLookup"))
            .next("CompareBillingFound")
            .onError("BillingSetLookupError")
            .build();
        const setLookupError = new UpdateContactAttributesActionBuilder("BillingSetLookupError")
            .attribute("lookupResult", "error")
            .next("BillingErrorLanguageCheck")
            .build();
        const errorLanguageCheck = new CompareActionBuilder("BillingErrorLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "BillingLookupErrorSpanish")
            .onError("BillingLookupErrorEnglish", "NoMatchingCondition")
            .build();
        const errorEnglish = new MessageParticipantActionBuilder("BillingLookupErrorEnglish")
            .text("I'm having trouble retrieving your invoice right now. Let me connect you with our billing team.")
            .next("SetNeedsTransfer")
            .build();
        const errorSpanish = new MessageParticipantActionBuilder("BillingLookupErrorSpanish")
            .text("Tengo problemas para recuperar su factura ahora. Permítame conectarlo con nuestro equipo de facturación.")
            .next("SetNeedsTransfer")
            .build();
        const compareFound = new CompareActionBuilder("CompareBillingFound")
            .comparisonValue("$.External.found")
            .when(equalsCondition("true"), "PersistBillingResults")
            .onError("CompareBillingMissingSlot", "NoMatchingCondition")
            .build();
        const compareMissingSlot = new CompareActionBuilder("CompareBillingMissingSlot")
            .comparisonValue("$.External.missingSlot")
            .when(equalsCondition("true"), "BillingMissingSlotLanguageCheck")
            .onError("BillingSetLookupNotFound", "NoMatchingCondition")
            .build();
        const missingSlotLanguageCheck = new CompareActionBuilder("BillingMissingSlotLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "BillingMissingSlotSpanish")
            .onError("BillingMissingSlotEnglish", "NoMatchingCondition")
            .build();
        const missingSlotEnglish = new MessageParticipantActionBuilder("BillingMissingSlotEnglish")
            .text("To look up your invoice, I'll need your invoice number — you can find it on your billing statement. Let me connect you with a representative who can help.")
            .next("SetNeedsTransfer")
            .build();
        const missingSlotSpanish = new MessageParticipantActionBuilder("BillingMissingSlotSpanish")
            .text("Para buscar su factura, necesito su número de factura — puede encontrarlo en su estado de cuenta. Permítame conectarlo con un representante que pueda ayudarle.")
            .next("SetNeedsTransfer")
            .build();
        const setLookupNotFound = new UpdateContactAttributesActionBuilder("BillingSetLookupNotFound")
            .attribute("lookupResult", "not_found")
            .next("BillingNotFoundLanguageCheck")
            .build();
        const persistResults = new UpdateContactAttributesActionBuilder("PersistBillingResults")
            .attribute("externalStatus", "$.External.status")
            .attribute("externalAmount", "$.External.amount")
            .attribute("externalDateIssued", "$.External.dateIssued")
            .attribute("externalDueDate", "$.External.dueDate")
            .attribute("externalDescription", "$.External.description")
            .next("CompareBillingStatus")
            .build();
        const notFoundLanguageCheck = new CompareActionBuilder("BillingNotFoundLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "InvoiceNotFoundSpanish")
            .onError("InvoiceNotFoundEnglish", "NoMatchingCondition")
            .build();
        const notFoundEnglish = new MessageParticipantActionBuilder("InvoiceNotFoundEnglish")
            .text("We weren't able to locate that invoice for your account. A billing representative can help you find it.")
            .next("SetNeedsTransfer")
            .build();
        const notFoundSpanish = new MessageParticipantActionBuilder("InvoiceNotFoundSpanish")
            .text("No pudimos encontrar esa factura en su cuenta. Un representante de facturación puede ayudarle a encontrarla.")
            .next("SetNeedsTransfer")
            .build();
        const compareStatus = new CompareActionBuilder("CompareBillingStatus")
            .comparisonValue("$.External.status")
            .when(equalsCondition("PAID"), "BillingPaidLanguageCheck")
            .when(equalsCondition("UNPAID"), "BillingUnpaidLanguageCheck")
            .when(equalsCondition("OVERDUE"), "BillingOverdueLanguageCheck")
            .onError("SetNeedsTransfer", "NoMatchingCondition")
            .build();
        const paidLanguageCheck = new CompareActionBuilder("BillingPaidLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "InvoicePaidSpanish")
            .onError("InvoicePaidEnglish", "NoMatchingCondition")
            .build();
        const unpaidLanguageCheck = new CompareActionBuilder("BillingUnpaidLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "InvoiceUnpaidSpanish")
            .onError("InvoiceUnpaidEnglish", "NoMatchingCondition")
            .build();
        const overdueLanguageCheck = new CompareActionBuilder("BillingOverdueLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "InvoiceOverdueSpanish")
            .onError("InvoiceOverdueEnglish", "NoMatchingCondition")
            .build();
        const paidEnglish = new MessageParticipantActionBuilder("InvoicePaidEnglish")
            .text("Your invoice of $.External.amount has been paid. It was issued on $.External.dateIssued for $.External.description.")
            .next("OfferTransferBillingEnglish")
            .build();
        const paidSpanish = new MessageParticipantActionBuilder("InvoicePaidSpanish")
            .text("Su factura de $.External.amount ha sido pagada. Fue emitida el $.External.dateIssued por $.External.description.")
            .next("OfferTransferBillingSpanish")
            .build();
        const unpaidEnglish = new MessageParticipantActionBuilder("InvoiceUnpaidEnglish")
            .text("You have an outstanding invoice of $.External.amount due on $.External.dueDate for $.External.description.")
            .next("OfferTransferBillingEnglish")
            .build();
        const unpaidSpanish = new MessageParticipantActionBuilder("InvoiceUnpaidSpanish")
            .text("Tiene una factura pendiente de $.External.amount con vencimiento el $.External.dueDate por $.External.description.")
            .next("OfferTransferBillingSpanish")
            .build();
        // OVERDUE — auto-transfer, no choice offered.
        const overdueEnglish = new MessageParticipantActionBuilder("InvoiceOverdueEnglish")
            .text("You have a past-due balance of $.External.amount that was due on $.External.dueDate. I'll connect you with our billing team now.")
            .next("SetNeedsTransfer")
            .build();
        const overdueSpanish = new MessageParticipantActionBuilder("InvoiceOverdueSpanish")
            .text("Tiene un saldo vencido de $.External.amount que venció el $.External.dueDate. Ahora le conectaré con nuestro equipo de facturación.")
            .next("SetNeedsTransfer")
            .build();
        const offerTransferEnglish = new GetParticipantInputActionBuilder("OfferTransferBillingEnglish")
            .text("To speak with a billing representative, press 1. Press 2 to end the call.")
            .inputTimeLimitSeconds(8)
            .when(equalsCondition("1"), "SetNeedsTransfer")
            .when(equalsCondition("2"), "EndModule")
            .onError("SetNeedsTransfer", "InputTimeLimitExceeded")
            .onError("SetNeedsTransfer", "NoMatchingCondition")
            .onError("SetNeedsTransfer")
            .build();
        const offerTransferSpanish = new GetParticipantInputActionBuilder("OfferTransferBillingSpanish")
            .text("Para hablar con un representante de facturación, oprima 1. Oprima 2 para terminar la llamada.")
            .inputTimeLimitSeconds(8)
            .when(equalsCondition("1"), "SetNeedsTransfer")
            .when(equalsCondition("2"), "EndModule")
            .onError("SetNeedsTransfer", "InputTimeLimitExceeded")
            .onError("SetNeedsTransfer", "NoMatchingCondition")
            .onError("SetNeedsTransfer")
            .build();
        const setNeedsTransfer = new UpdateContactAttributesActionBuilder("SetNeedsTransfer")
            .attribute("needsTransfer", "true")
            .next("EndModule")
            .build();
        const endModule = new EndFlowModuleExecutionActionBuilder("EndModule").build();
        return new FlowBuilder("BillingModule")
            .startWith(languageCheck)
            .add(bridgeEnglish)
            .add(bridgeSpanish)
            .add(setLookupAttempted)
            .add(invokeLambda)
            .add(setLookupError)
            .add(errorLanguageCheck)
            .add(errorEnglish)
            .add(errorSpanish)
            .add(compareFound)
            .add(compareMissingSlot)
            .add(missingSlotLanguageCheck)
            .add(missingSlotEnglish)
            .add(missingSlotSpanish)
            .add(setLookupNotFound)
            .add(persistResults)
            .add(notFoundLanguageCheck)
            .add(notFoundEnglish)
            .add(notFoundSpanish)
            .add(compareStatus)
            .add(paidLanguageCheck)
            .add(unpaidLanguageCheck)
            .add(overdueLanguageCheck)
            .add(paidEnglish)
            .add(paidSpanish)
            .add(unpaidEnglish)
            .add(unpaidSpanish)
            .add(overdueEnglish)
            .add(overdueSpanish)
            .add(offerTransferEnglish)
            .add(offerTransferSpanish)
            .add(setNeedsTransfer)
            .add(endModule)
            .build();
    },
};
