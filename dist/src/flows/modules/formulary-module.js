import { CompareActionBuilder, EndFlowModuleExecutionActionBuilder, FlowBuilder, GetParticipantInputActionBuilder, InvokeLambdaFunctionActionBuilder, MessageParticipantActionBuilder, UpdateContactAttributesActionBuilder, equalsCondition, } from "connect-flow-builder";
export const formularyModuleSpec = {
    key: "formularyModule",
    name: "FormularyModule",
    type: "CONTACT_FLOW_MODULE",
    filename: "formulary-module.json",
    description: "Prescription formulary self-service — invokes FormularyLookup Lambda, reads back coverage and tier.",
    build: (context) => {
        const languageCheck = new CompareActionBuilder("FormularyLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "FormularyLookupBridgeSpanish")
            .onError("FormularyLookupBridgeEnglish", "NoMatchingCondition")
            .build();
        const bridgeEnglish = new MessageParticipantActionBuilder("FormularyLookupBridgeEnglish")
            .text("One moment while I check your plan's formulary.")
            .next("InvokeFormularyLookup")
            .build();
        const bridgeSpanish = new MessageParticipantActionBuilder("FormularyLookupBridgeSpanish")
            .text("Un momento mientras verifico el formulario de su plan.")
            .next("InvokeFormularyLookup")
            .build();
        const invokeLambda = new InvokeLambdaFunctionActionBuilder("InvokeFormularyLookup")
            .lambdaArn(context.refs.lambdaArn("formularyLookup"))
            .next("CompareFormularyFound")
            .onError("FormularyErrorLanguageCheck")
            .build();
        const errorLanguageCheck = new CompareActionBuilder("FormularyErrorLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "FormularyLookupErrorSpanish")
            .onError("FormularyLookupErrorEnglish", "NoMatchingCondition")
            .build();
        const errorEnglish = new MessageParticipantActionBuilder("FormularyLookupErrorEnglish")
            .text("I'm having trouble checking your formulary right now. Let me connect you with our pharmacy team.")
            .next("SetNeedsTransfer")
            .build();
        const errorSpanish = new MessageParticipantActionBuilder("FormularyLookupErrorSpanish")
            .text("Tengo problemas para verificar su formulario ahora. Permítame conectarlo con nuestro equipo de farmacia.")
            .next("SetNeedsTransfer")
            .build();
        const compareFound = new CompareActionBuilder("CompareFormularyFound")
            .comparisonValue("$.External.found")
            .when(equalsCondition("true"), "PersistFormularyResults")
            .onError("FormularyNotFoundLanguageCheck", "NoMatchingCondition")
            .build();
        const persistResults = new UpdateContactAttributesActionBuilder("PersistFormularyResults")
            .attribute("externalMedicationName", "$.External.medicationName")
            .attribute("externalCovered", "$.External.covered")
            .attribute("externalTier", "$.External.tier")
            .attribute("externalCopay", "$.External.copay")
            .attribute("externalRequiresPriorAuth", "$.External.requiresPriorAuth")
            .next("CompareFormularyCovered")
            .build();
        const notFoundLanguageCheck = new CompareActionBuilder("FormularyNotFoundLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "MedicationNotCoveredSpanish")
            .onError("MedicationNotCoveredEnglish", "NoMatchingCondition")
            .build();
        const compareCovered = new CompareActionBuilder("CompareFormularyCovered")
            .comparisonValue("$.External.covered")
            .when(equalsCondition("true"), "CompareFormularyPriorAuth")
            .onError("FormularyNotCoveredLanguageCheck", "NoMatchingCondition")
            .build();
        const notCoveredLanguageCheck = new CompareActionBuilder("FormularyNotCoveredLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "MedicationNotCoveredSpanish")
            .onError("MedicationNotCoveredEnglish", "NoMatchingCondition")
            .build();
        const notCoveredEnglish = new MessageParticipantActionBuilder("MedicationNotCoveredEnglish")
            .text("$.External.medicationName isn't covered under your current plan. A representative can review covered alternatives with you.")
            .next("SetNeedsTransfer")
            .build();
        const notCoveredSpanish = new MessageParticipantActionBuilder("MedicationNotCoveredSpanish")
            .text("$.External.medicationName no está cubierto bajo su plan actual. Un representante puede revisar con usted las alternativas cubiertas.")
            .next("SetNeedsTransfer")
            .build();
        const comparePriorAuth = new CompareActionBuilder("CompareFormularyPriorAuth")
            .comparisonValue("$.External.requiresPriorAuth")
            .when(equalsCondition("true"), "FormularyPriorAuthLanguageCheck")
            .onError("FormularyCoveredLanguageCheck", "NoMatchingCondition")
            .build();
        const priorAuthLanguageCheck = new CompareActionBuilder("FormularyPriorAuthLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "MedicationCoveredPriorAuthSpanish")
            .onError("MedicationCoveredPriorAuthEnglish", "NoMatchingCondition")
            .build();
        const coveredPriorAuthEnglish = new MessageParticipantActionBuilder("MedicationCoveredPriorAuthEnglish")
            .text("$.External.medicationName is covered under your plan, but requires prior authorization before it can be dispensed. I'll connect you with our pharmacy team to start that process.")
            .next("SetNeedsTransfer")
            .build();
        const coveredPriorAuthSpanish = new MessageParticipantActionBuilder("MedicationCoveredPriorAuthSpanish")
            .text("$.External.medicationName está cubierto bajo su plan, pero requiere autorización previa antes de ser dispensado. Le conectaré con nuestro equipo de farmacia para iniciar ese proceso.")
            .next("SetNeedsTransfer")
            .build();
        const coveredLanguageCheck = new CompareActionBuilder("FormularyCoveredLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "MedicationCoveredSpanish")
            .onError("MedicationCoveredEnglish", "NoMatchingCondition")
            .build();
        const coveredEnglish = new MessageParticipantActionBuilder("MedicationCoveredEnglish")
            .text("$.External.medicationName is covered under your plan. It's a Tier $.External.tier medication with a $.External.copay copay.")
            .next("OfferTransferFormularyEnglish")
            .build();
        const coveredSpanish = new MessageParticipantActionBuilder("MedicationCoveredSpanish")
            .text("$.External.medicationName está cubierto bajo su plan. Es un medicamento de Nivel $.External.tier con un copago de $.External.copay.")
            .next("OfferTransferFormularySpanish")
            .build();
        const offerTransferEnglish = new GetParticipantInputActionBuilder("OfferTransferFormularyEnglish")
            .text("If you have questions about this medication or your formulary, press 1 to speak with a representative. Press 2 to end the call.")
            .inputTimeLimitSeconds(8)
            .when(equalsCondition("1"), "SetNeedsTransfer")
            .when(equalsCondition("2"), "EndModule")
            .onError("SetNeedsTransfer", "InputTimeLimitExceeded")
            .onError("SetNeedsTransfer", "NoMatchingCondition")
            .onError("SetNeedsTransfer")
            .build();
        const offerTransferSpanish = new GetParticipantInputActionBuilder("OfferTransferFormularySpanish")
            .text("Si tiene preguntas sobre este medicamento o su formulario, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada.")
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
        return new FlowBuilder("FormularyModule")
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
            .add(compareCovered)
            .add(notCoveredLanguageCheck)
            .add(notCoveredEnglish)
            .add(notCoveredSpanish)
            .add(comparePriorAuth)
            .add(priorAuthLanguageCheck)
            .add(coveredPriorAuthEnglish)
            .add(coveredPriorAuthSpanish)
            .add(coveredLanguageCheck)
            .add(coveredEnglish)
            .add(coveredSpanish)
            .add(offerTransferEnglish)
            .add(offerTransferSpanish)
            .add(setNeedsTransfer)
            .add(endModule)
            .build();
    },
};
