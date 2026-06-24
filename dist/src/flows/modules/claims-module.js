import { CompareActionBuilder, EndFlowModuleExecutionActionBuilder, FlowBuilder, GetParticipantInputActionBuilder, InvokeLambdaFunctionActionBuilder, MessageParticipantActionBuilder, UpdateContactAttributesActionBuilder, equalsCondition, } from "connect-flow-builder";
export const claimsModuleSpec = {
    key: "claimsModule",
    name: "ClaimsModule",
    type: "CONTACT_FLOW_MODULE",
    filename: "claims-module.json",
    description: "Claims status self-service — invokes ClaimsLookup Lambda, reads back status, offers transfer.",
    build: (context) => {
        const languageCheck = new CompareActionBuilder("ClaimsLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "ClaimsLookupBridgeSpanish")
            .onError("ClaimsLookupBridgeEnglish", "NoMatchingCondition")
            .build();
        const bridgeEnglish = new MessageParticipantActionBuilder("ClaimsLookupBridgeEnglish")
            .text("One moment while I look up that claim.")
            .next("InvokeClaimsLookup")
            .build();
        const bridgeSpanish = new MessageParticipantActionBuilder("ClaimsLookupBridgeSpanish")
            .text("Un momento mientras busco esa reclamación.")
            .next("InvokeClaimsLookup")
            .build();
        const invokeLambda = new InvokeLambdaFunctionActionBuilder("InvokeClaimsLookup")
            .lambdaArn(context.refs.lambdaArn("claimsLookup"))
            .next("CompareClaimsFound")
            .onError("ClaimsErrorLanguageCheck")
            .build();
        const errorLanguageCheck = new CompareActionBuilder("ClaimsErrorLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "ClaimsLookupErrorSpanish")
            .onError("ClaimsLookupErrorEnglish", "NoMatchingCondition")
            .build();
        const errorEnglish = new MessageParticipantActionBuilder("ClaimsLookupErrorEnglish")
            .text("I'm having trouble retrieving your claim right now. Let me connect you with a representative.")
            .next("SetNeedsTransfer")
            .build();
        const errorSpanish = new MessageParticipantActionBuilder("ClaimsLookupErrorSpanish")
            .text("Tengo problemas para recuperar su reclamación en este momento. Permítame conectarlo con un representante.")
            .next("SetNeedsTransfer")
            .build();
        const compareFound = new CompareActionBuilder("CompareClaimsFound")
            .comparisonValue("$.External.found")
            .when(equalsCondition("true"), "PersistClaimsResults")
            .onError("ClaimsNotFoundLanguageCheck", "NoMatchingCondition")
            .build();
        const persistResults = new UpdateContactAttributesActionBuilder("PersistClaimsResults")
            .attribute("externalStatus", "$.External.status")
            .attribute("externalDateOfService", "$.External.dateOfService")
            .attribute("externalBilledAmount", "$.External.billedAmount")
            .attribute("externalPaidAmount", "$.External.paidAmount")
            .attribute("externalDenialReason", "$.External.denialReason")
            .next("CompareClaimsStatus")
            .build();
        const notFoundLanguageCheck = new CompareActionBuilder("ClaimsNotFoundLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "ClaimsNotFoundSpanish")
            .onError("ClaimsNotFoundEnglish", "NoMatchingCondition")
            .build();
        const notFoundEnglish = new MessageParticipantActionBuilder("ClaimsNotFoundEnglish")
            .text("We weren't able to locate that claim for your account. A representative can help you find it.")
            .next("SetNeedsTransfer")
            .build();
        const notFoundSpanish = new MessageParticipantActionBuilder("ClaimsNotFoundSpanish")
            .text("No pudimos encontrar esa reclamación en su cuenta. Un representante puede ayudarle a encontrarla.")
            .next("SetNeedsTransfer")
            .build();
        const compareStatus = new CompareActionBuilder("CompareClaimsStatus")
            .comparisonValue("$.External.status")
            .when(equalsCondition("APPROVED"), "ClaimsApprovedLanguageCheck")
            .when(equalsCondition("DENIED"), "ClaimsDeniedLanguageCheck")
            .when(equalsCondition("PENDING"), "ClaimsPendingLanguageCheck")
            .onError("SetNeedsTransfer", "NoMatchingCondition")
            .build();
        const approvedLanguageCheck = new CompareActionBuilder("ClaimsApprovedLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "ClaimsApprovedSpanish")
            .onError("ClaimsApprovedEnglish", "NoMatchingCondition")
            .build();
        const deniedLanguageCheck = new CompareActionBuilder("ClaimsDeniedLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "ClaimsDeniedSpanish")
            .onError("ClaimsDeniedEnglish", "NoMatchingCondition")
            .build();
        const pendingLanguageCheck = new CompareActionBuilder("ClaimsPendingLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "ClaimsPendingSpanish")
            .onError("ClaimsPendingEnglish", "NoMatchingCondition")
            .build();
        const approvedEnglish = new MessageParticipantActionBuilder("ClaimsApprovedEnglish")
            .text("Your claim was approved. Your plan paid $.External.paidAmount of the $.External.billedAmount billed for your visit on $.External.dateOfService.")
            .next("OfferTransferClaimsEnglish")
            .build();
        const approvedSpanish = new MessageParticipantActionBuilder("ClaimsApprovedSpanish")
            .text("Su reclamación fue aprobada. Su plan pagó $.External.paidAmount de los $.External.billedAmount facturados por su visita del $.External.dateOfService.")
            .next("OfferTransferClaimsSpanish")
            .build();
        const deniedEnglish = new MessageParticipantActionBuilder("ClaimsDeniedEnglish")
            .text("Your claim was denied. The reason given was: $.External.denialReason. A representative can help you with next steps or an appeal.")
            .next("OfferTransferClaimsEnglish")
            .build();
        const deniedSpanish = new MessageParticipantActionBuilder("ClaimsDeniedSpanish")
            .text("Su reclamación fue denegada. El motivo fue: $.External.denialReason. Un representante puede ayudarle con los próximos pasos o una apelación.")
            .next("OfferTransferClaimsSpanish")
            .build();
        const pendingEnglish = new MessageParticipantActionBuilder("ClaimsPendingEnglish")
            .text("Your claim for the visit on $.External.dateOfService is currently under review. No action is needed from you at this time.")
            .next("OfferTransferClaimsEnglish")
            .build();
        const pendingSpanish = new MessageParticipantActionBuilder("ClaimsPendingSpanish")
            .text("Su reclamación por la visita del $.External.dateOfService está actualmente en revisión. No se requiere ninguna acción de su parte en este momento.")
            .next("OfferTransferClaimsSpanish")
            .build();
        const offerTransferEnglish = new GetParticipantInputActionBuilder("OfferTransferClaimsEnglish")
            .text("If you have additional questions about this claim, press 1 to speak with a representative. Press 2 to end the call.")
            .inputTimeLimitSeconds(8)
            .when(equalsCondition("1"), "SetNeedsTransfer")
            .when(equalsCondition("2"), "EndModule")
            .onError("SetNeedsTransfer", "InputTimeLimitExceeded")
            .onError("SetNeedsTransfer", "NoMatchingCondition")
            .onError("SetNeedsTransfer")
            .build();
        const offerTransferSpanish = new GetParticipantInputActionBuilder("OfferTransferClaimsSpanish")
            .text("Si tiene preguntas adicionales sobre esta reclamación, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada.")
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
        return new FlowBuilder("ClaimsModule")
            .startWith(languageCheck)
            .add(bridgeEnglish)
            .add(bridgeSpanish)
            .add(invokeLambda)
            .add(errorLanguageCheck)
            .add(errorEnglish)
            .add(errorSpanish)
            .add(compareFound)
            .add(persistResults)
            .add(notFoundLanguageCheck)
            .add(notFoundEnglish)
            .add(notFoundSpanish)
            .add(compareStatus)
            .add(approvedLanguageCheck)
            .add(deniedLanguageCheck)
            .add(pendingLanguageCheck)
            .add(approvedEnglish)
            .add(approvedSpanish)
            .add(deniedEnglish)
            .add(deniedSpanish)
            .add(pendingEnglish)
            .add(pendingSpanish)
            .add(offerTransferEnglish)
            .add(offerTransferSpanish)
            .add(setNeedsTransfer)
            .add(endModule)
            .build();
    },
};
