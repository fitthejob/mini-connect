import { CompareActionBuilder, EndFlowModuleExecutionActionBuilder, FlowBuilder, GetParticipantInputActionBuilder, InvokeLambdaFunctionActionBuilder, MessageParticipantActionBuilder, UpdateContactAttributesActionBuilder, equalsCondition, } from "connect-flow-builder";
export const priorAuthModuleSpec = {
    key: "priorAuthModule",
    name: "PriorAuthModule",
    type: "CONTACT_FLOW_MODULE",
    filename: "prior-auth-module.json",
    description: "Prior authorization self-service — invokes ProcedureLookup Lambda, reads back coverage and auth requirement.",
    build: (context) => {
        const languageCheck = new CompareActionBuilder("PriorAuthLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "PriorAuthLookupBridgeSpanish")
            .onError("PriorAuthLookupBridgeEnglish", "NoMatchingCondition")
            .build();
        const bridgeEnglish = new MessageParticipantActionBuilder("PriorAuthLookupBridgeEnglish")
            .text("One moment while I check coverage for that procedure.")
            .next("InvokeProcedureLookup")
            .build();
        const bridgeSpanish = new MessageParticipantActionBuilder("PriorAuthLookupBridgeSpanish")
            .text("Un momento mientras verifico la cobertura para ese procedimiento.")
            .next("InvokeProcedureLookup")
            .build();
        const invokeLambda = new InvokeLambdaFunctionActionBuilder("InvokeProcedureLookup")
            .lambdaArn(context.refs.lambdaArn("procedureLookup"))
            .next("CompareProcedureFound")
            .onError("PriorAuthErrorLanguageCheck")
            .build();
        const errorLanguageCheck = new CompareActionBuilder("PriorAuthErrorLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "PriorAuthLookupErrorSpanish")
            .onError("PriorAuthLookupErrorEnglish", "NoMatchingCondition")
            .build();
        const errorEnglish = new MessageParticipantActionBuilder("PriorAuthLookupErrorEnglish")
            .text("I'm having trouble checking that right now. Let me connect you with our prior authorization team.")
            .next("SetNeedsTransfer")
            .build();
        const errorSpanish = new MessageParticipantActionBuilder("PriorAuthLookupErrorSpanish")
            .text("Tengo problemas para verificar eso ahora. Permítame conectarlo con nuestro equipo de autorización previa.")
            .next("SetNeedsTransfer")
            .build();
        const compareFound = new CompareActionBuilder("CompareProcedureFound")
            .comparisonValue("$.External.found")
            .when(equalsCondition("true"), "CompareProcedureCovered")
            .onError("PriorAuthNotFoundLanguageCheck", "NoMatchingCondition")
            .build();
        const notFoundLanguageCheck = new CompareActionBuilder("PriorAuthNotFoundLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "PriorAuthCodeNotFoundSpanish")
            .onError("PriorAuthCodeNotFoundEnglish", "NoMatchingCondition")
            .build();
        const codeNotFoundEnglish = new MessageParticipantActionBuilder("PriorAuthCodeNotFoundEnglish")
            .text("I wasn't able to find information for that procedure code. Let me connect you with someone who can help.")
            .next("SetNeedsTransfer")
            .build();
        const codeNotFoundSpanish = new MessageParticipantActionBuilder("PriorAuthCodeNotFoundSpanish")
            .text("No pude encontrar información para ese código de procedimiento. Permítame conectarlo con alguien que pueda ayudarle.")
            .next("SetNeedsTransfer")
            .build();
        const compareCovered = new CompareActionBuilder("CompareProcedureCovered")
            .comparisonValue("$.External.covered")
            .when(equalsCondition("true"), "CompareProcedurePriorAuth")
            .onError("ProcedureNotCoveredLanguageCheck", "NoMatchingCondition")
            .build();
        const notCoveredLanguageCheck = new CompareActionBuilder("ProcedureNotCoveredLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "ProcedureNotCoveredSpanish")
            .onError("ProcedureNotCoveredEnglish", "NoMatchingCondition")
            .build();
        const notCoveredEnglish = new MessageParticipantActionBuilder("ProcedureNotCoveredEnglish")
            .text("That procedure isn't covered under your current plan. A representative can review your options, including the appeals process.")
            .next("SetNeedsTransfer")
            .build();
        const notCoveredSpanish = new MessageParticipantActionBuilder("ProcedureNotCoveredSpanish")
            .text("Ese procedimiento no está cubierto bajo su plan actual. Un representante puede revisar sus opciones, incluido el proceso de apelación.")
            .next("SetNeedsTransfer")
            .build();
        const comparePriorAuth = new CompareActionBuilder("CompareProcedurePriorAuth")
            .comparisonValue("$.External.requiresPriorAuth")
            .when(equalsCondition("true"), "PriorAuthRequiredLanguageCheck")
            .onError("ProcedureCoveredNoPriorAuthLanguageCheck", "NoMatchingCondition")
            .build();
        const requiredLanguageCheck = new CompareActionBuilder("PriorAuthRequiredLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "PriorAuthRequiredSpanish")
            .onError("PriorAuthRequiredEnglish", "NoMatchingCondition")
            .build();
        // Auto-transfer — prior auth needs immediate agent action, no choice offered.
        const requiredEnglish = new MessageParticipantActionBuilder("PriorAuthRequiredEnglish")
            .text("Your plan covers this procedure, but prior authorization is required before your scheduled date. I'll connect you with our prior authorization team now.")
            .next("SetNeedsTransfer")
            .build();
        const requiredSpanish = new MessageParticipantActionBuilder("PriorAuthRequiredSpanish")
            .text("Su plan cubre este procedimiento, pero se requiere autorización previa antes de su fecha programada. Ahora le conectaré con nuestro equipo de autorización previa.")
            .next("SetNeedsTransfer")
            .build();
        const noPriorAuthLanguageCheck = new CompareActionBuilder("ProcedureCoveredNoPriorAuthLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "ProcedureCoveredNoPriorAuthSpanish")
            .onError("ProcedureCoveredNoPriorAuthEnglish", "NoMatchingCondition")
            .build();
        const noPriorAuthEnglish = new MessageParticipantActionBuilder("ProcedureCoveredNoPriorAuthEnglish")
            .text("Good news — your plan covers this procedure and no prior authorization is required.")
            .next("OfferTransferPriorAuthEnglish")
            .build();
        const noPriorAuthSpanish = new MessageParticipantActionBuilder("ProcedureCoveredNoPriorAuthSpanish")
            .text("Buenas noticias: su plan cubre este procedimiento y no se requiere autorización previa.")
            .next("OfferTransferPriorAuthSpanish")
            .build();
        const offerTransferEnglish = new GetParticipantInputActionBuilder("OfferTransferPriorAuthEnglish")
            .text("If you have any other questions, press 1 to speak with a representative. Press 2 to end the call.")
            .inputTimeLimitSeconds(8)
            .when(equalsCondition("1"), "SetNeedsTransfer")
            .when(equalsCondition("2"), "EndModule")
            .onError("EndModule", "InputTimeLimitExceeded")
            .onError("EndModule", "NoMatchingCondition")
            .onError("EndModule")
            .build();
        const offerTransferSpanish = new GetParticipantInputActionBuilder("OfferTransferPriorAuthSpanish")
            .text("Si tiene alguna otra pregunta, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada.")
            .inputTimeLimitSeconds(8)
            .when(equalsCondition("1"), "SetNeedsTransfer")
            .when(equalsCondition("2"), "EndModule")
            .onError("EndModule", "InputTimeLimitExceeded")
            .onError("EndModule", "NoMatchingCondition")
            .onError("EndModule")
            .build();
        const setNeedsTransfer = new UpdateContactAttributesActionBuilder("SetNeedsTransfer")
            .attribute("needsTransfer", "true")
            .next("EndModule")
            .build();
        const endModule = new EndFlowModuleExecutionActionBuilder("EndModule").build();
        return new FlowBuilder("PriorAuthModule")
            .startWith(languageCheck)
            .add(bridgeEnglish)
            .add(bridgeSpanish)
            .add(invokeLambda)
            .add(errorLanguageCheck)
            .add(errorEnglish)
            .add(errorSpanish)
            .add(compareFound)
            .add(notFoundLanguageCheck)
            .add(codeNotFoundEnglish)
            .add(codeNotFoundSpanish)
            .add(compareCovered)
            .add(notCoveredLanguageCheck)
            .add(notCoveredEnglish)
            .add(notCoveredSpanish)
            .add(comparePriorAuth)
            .add(requiredLanguageCheck)
            .add(requiredEnglish)
            .add(requiredSpanish)
            .add(noPriorAuthLanguageCheck)
            .add(noPriorAuthEnglish)
            .add(noPriorAuthSpanish)
            .add(offerTransferEnglish)
            .add(offerTransferSpanish)
            .add(setNeedsTransfer)
            .add(endModule)
            .build();
    },
};
