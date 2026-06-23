import {
  CompareActionBuilder,
  ConnectParticipantWithLexBotActionBuilder,
  DisconnectParticipantActionBuilder,
  FlowBuilder,
  GetCustomerProfileActionBuilder,
  GetParticipantInputActionBuilder,
  InvokeLambdaFunctionActionBuilder,
  MessageParticipantActionBuilder,
  SetCustomerQueueFlowActionBuilder,
  TransferContactToQueueActionBuilder,
  UpdateContactAttributesActionBuilder,
  UpdateContactTargetQueueActionBuilder,
  UpdateContactTextToSpeechVoiceActionBuilder,
  equalsCondition,
  type FlowSpec,
} from "connect-flow-builder";

export const mainInboundSpec: FlowSpec = {
  key: "mainInbound",
  name: "MainInbound",
  type: "CONTACT_FLOW",
  filename: "main-inbound.json",
  description: "Primary inbound flow for support.",
  dependsOnFlows: ["supportQueueExperience"],
  build: (context) => {
    const setDefaultVoice = new UpdateContactTextToSpeechVoiceActionBuilder(
      "SetDefaultVoice",
    )
      .voice("Joanna")
      .engine("neural")
      .next("LanguagePrompt")
      .build();

    const languagePrompt = new ConnectParticipantWithLexBotActionBuilder(
      "LanguagePrompt",
    )
      .text("For English, press or say 1. Para español, oprima o diga 2.")
      .lexV2BotAliasArn(context.refs.lexBotAliasArn("mainInbound"))
      .whenIntentEquals("EnglishIntent", "SetEnglishAttr")
      .whenIntentEquals("SpanishIntent", "SetSpanishAttr")
      .onInputTimeLimitExceeded("CheckHours")
      .onNoMatchingCondition("CheckHours")
      .build();

    const setEnglishAttr = new UpdateContactAttributesActionBuilder(
      "SetEnglishAttr",
    )
      .attribute("preferredLanguage", "en")
      .next("SetVoiceEnglish")
      .build();

    const setVoiceEnglish = new UpdateContactTextToSpeechVoiceActionBuilder(
      "SetVoiceEnglish",
    )
      .voice("Joanna")
      .engine("neural")
      .next("CheckHours")
      .build();

    const setSpanishAttr = new UpdateContactAttributesActionBuilder(
      "SetSpanishAttr",
    )
      .attribute("preferredLanguage", "es")
      .next("SetVoiceSpanish")
      .build();

    const setVoiceSpanish = new UpdateContactTextToSpeechVoiceActionBuilder(
      "SetVoiceSpanish",
    )
      .voice("Lupe")
      .engine("neural")
      .next("CheckHours")
      .build();

    const checkHours = new InvokeLambdaFunctionActionBuilder("CheckHours")
      .lambdaArn(context.refs.lambdaArn("hrsOfOps"))
      .next("CompareHours")
      .onError("Greeting")
      .build();

    const compareHours = new CompareActionBuilder("CompareHours")
      .comparisonValue("$.External.isBusinessHours")
      .when(equalsCondition("true"), "LookupByPhone")
      .onError("CheckLanguageForClosed", "NoMatchingCondition")
      .build();

    // ANI lookup — identifies the caller by phone number before they say a word.
    // All error branches fail open to Greeting so no caller is stranded by a
    // profile miss. Response fields land at $.Customer.* for the rest of the call.
    const lookupByPhone = new GetCustomerProfileActionBuilder("LookupByPhone")
      .identifier("_phone", "$.CustomerEndpoint.Address")
      .responseField("FirstName")
      .responseField("LastName")
      .responseField("Attributes.memberId")
      .responseField("Attributes.planId")
      .responseField("Attributes.coverageStatus")
      .next("Greeting")
      .onError("Greeting", "NoneFoundError")
      .onError("Greeting", "MultipleFoundError")
      .onError("Greeting")
      .build();

    const checkLanguageForClosed = new CompareActionBuilder(
      "CheckLanguageForClosed",
    )
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ClosedMessageSpanish")
      .onError("ClosedMessageEnglish", "NoMatchingCondition")
      .build();

    const closedMessageEnglish = new MessageParticipantActionBuilder(
      "ClosedMessageEnglish",
    )
      .text(
        "Thank you for calling Mini Connect. Our offices are currently closed. " +
        "Our business hours are Monday through Friday, 9am to 5pm Eastern Time. " +
        "Please call back during business hours.",
      )
      .next("Disconnect")
      .build();

    const closedMessageSpanish = new MessageParticipantActionBuilder(
      "ClosedMessageSpanish",
    )
      .text(
        "Gracias por llamar a Mini Connect. Nuestras oficinas están actualmente cerradas. " +
        "Nuestro horario de atención es de lunes a viernes, de 9am a 5pm hora del Este. " +
        "Por favor llame de vuelta durante el horario de atención.",
      )
      .next("Disconnect")
      .build();

    const greeting = new MessageParticipantActionBuilder("Greeting")
      .text("Welcome to Mini Connect.")
      .next("SetIntentPromptLanguage")
      .build();

    // Branch on preferredLanguage to select the correct Lex locale for intent capture.
    // Lex locale must be set statically per block — it cannot be passed dynamically.
    const setIntentPromptLanguage = new CompareActionBuilder(
      "SetIntentPromptLanguage",
    )
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "IntentPromptSpanish")
      .onError("IntentPromptEnglish", "NoMatchingCondition")
      .build();

    const intentBranches = (nextOnNoMatch: string) => (builder: ConnectParticipantWithLexBotActionBuilder) =>
      builder
        .whenIntentEquals("ClaimsStatusIntent", "SetIntentClaims")
        .whenIntentEquals("BenefitsInquiryIntent", "SetIntentBenefits")
        .whenIntentEquals("PriorAuthorizationIntent", "SetIntentPriorAuth")
        .whenIntentEquals("ProviderLookupIntent", "SetIntentProviderLookup")
        .whenIntentEquals("PrescriptionIntent", "SetIntentPrescription")
        .whenIntentEquals("EligibilityIntent", "SetIntentEligibility")
        .whenIntentEquals("BillingIntent", "SetIntentBilling")
        .onInputTimeLimitExceeded(nextOnNoMatch)
        .onNoMatchingCondition(nextOnNoMatch);

    const intentPromptEnglish = intentBranches("SetSupportQueueFlow")(
      new ConnectParticipantWithLexBotActionBuilder("IntentPromptEnglish")
        .text("How can I help you today? You can say things like: check my claim status, benefits question, prior authorization, find a provider, prescription help, check eligibility, or billing question.")
        .lexV2BotAliasArn(context.refs.lexBotAliasArn("mainInbound"))
        .sessionAttribute("x-amz-lex:locale-id", "en_US"),
    ).build();

    const intentPromptSpanish = intentBranches("SetSupportQueueFlow")(
      new ConnectParticipantWithLexBotActionBuilder("IntentPromptSpanish")
        .text("¿Cómo puedo ayudarle hoy? Puede decir: estado de reclamación, pregunta sobre beneficios, autorización previa, buscar proveedor, ayuda con receta, verificar elegibilidad, o pregunta de facturación.")
        .lexV2BotAliasArn(context.refs.lexBotAliasArn("mainInbound"))
        .sessionAttribute("x-amz-lex:locale-id", "es_US"),
    ).build();

    // Store call reason and Lex slot values as contact attributes.
    // Slot values use JSONPath ($.Lex.Slots.SlotName) — Connect resolves them at runtime.
    // Agents see callReason and relevant slot values on their screen before answering.
    const setIntentClaims = new UpdateContactAttributesActionBuilder("SetIntentClaims")
      .attribute("callReason", "claims_status")
      .attribute("slotClaimNumber", "$.Lex.Slots.ClaimNumber")
      .attribute("slotDateOfService", "$.Lex.Slots.DateOfService")
      .next("ClaimsLanguageCheck")
      .build();

    // Language check before bridge message so Spanish callers hear Spanish.
    const claimsLanguageCheck = new CompareActionBuilder("ClaimsLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ClaimsLookupBridgeSpanish")
      .onError("ClaimsLookupBridgeEnglish", "NoMatchingCondition")
      .build();

    // "One moment" bridge fills the silence while the Lambda runs.
    const claimsLookupBridgeEnglish = new MessageParticipantActionBuilder("ClaimsLookupBridgeEnglish")
      .text("One moment while I look up that claim.")
      .next("InvokeClaimsLookup")
      .build();

    const claimsLookupBridgeSpanish = new MessageParticipantActionBuilder("ClaimsLookupBridgeSpanish")
      .text("Un momento mientras busco esa reclamación.")
      .next("InvokeClaimsLookup")
      .build();

    // memberId and claimId come from contact attributes set by ANI lookup and Lex slot capture.
    // claimId read from $.Attributes.slotClaimNumber, memberId from $.Attributes.memberId
    // — both are contact attributes set earlier in the flow and available to the Lambda
    // via event.Details.ContactData.Attributes.
    const invokeClaimsLookup = new InvokeLambdaFunctionActionBuilder("InvokeClaimsLookup")
      .lambdaArn(context.refs.lambdaArn("claimsLookup"))
      .next("CompareClaimsFound")
      .onError("ClaimsErrorLanguageCheck")
      .build();

    const claimsErrorLanguageCheck = new CompareActionBuilder("ClaimsErrorLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ClaimsLookupErrorSpanish")
      .onError("ClaimsLookupErrorEnglish", "NoMatchingCondition")
      .build();

    const claimsLookupErrorEnglish = new MessageParticipantActionBuilder("ClaimsLookupErrorEnglish")
      .text("I'm having trouble retrieving your claim right now. Let me connect you with a representative.")
      .next("SetSupportQueueFlow")
      .build();

    const claimsLookupErrorSpanish = new MessageParticipantActionBuilder("ClaimsLookupErrorSpanish")
      .text("Tengo problemas para recuperar su reclamación en este momento. Permítame conectarlo con un representante.")
      .next("SetSupportQueueFlow")
      .build();

    const compareClaimsFound = new CompareActionBuilder("CompareClaimsFound")
      .comparisonValue("$.External.found")
      .when(equalsCondition("true"), "CompareClaimsStatus")
      .onError("ClaimsNotFoundLanguageCheck", "NoMatchingCondition")
      .build();

    const claimsNotFoundLanguageCheck = new CompareActionBuilder("ClaimsNotFoundLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ClaimsNotFoundSpanish")
      .onError("ClaimsNotFoundEnglish", "NoMatchingCondition")
      .build();

    const claimsNotFoundEnglish = new MessageParticipantActionBuilder("ClaimsNotFoundEnglish")
      .text("We weren't able to locate that claim for your account. A representative can help you find it.")
      .next("SetSupportQueueFlow")
      .build();

    const claimsNotFoundSpanish = new MessageParticipantActionBuilder("ClaimsNotFoundSpanish")
      .text("No pudimos encontrar esa reclamación en su cuenta. Un representante puede ayudarle a encontrarla.")
      .next("SetSupportQueueFlow")
      .build();

    const compareClaimsStatus = new CompareActionBuilder("CompareClaimsStatus")
      .comparisonValue("$.External.status")
      .when(equalsCondition("APPROVED"), "ClaimsApprovedLanguageCheck")
      .when(equalsCondition("DENIED"), "ClaimsDeniedLanguageCheck")
      .when(equalsCondition("PENDING"), "ClaimsPendingLanguageCheck")
      .onError("SetSupportQueueFlow", "NoMatchingCondition")
      .build();

    const claimsApprovedLanguageCheck = new CompareActionBuilder("ClaimsApprovedLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ClaimsApprovedSpanish")
      .onError("ClaimsApprovedEnglish", "NoMatchingCondition")
      .build();

    const claimsDeniedLanguageCheck = new CompareActionBuilder("ClaimsDeniedLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ClaimsDeniedSpanish")
      .onError("ClaimsDeniedEnglish", "NoMatchingCondition")
      .build();

    const claimsPendingLanguageCheck = new CompareActionBuilder("ClaimsPendingLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ClaimsPendingSpanish")
      .onError("ClaimsPendingEnglish", "NoMatchingCondition")
      .build();

    const claimsApprovedEnglish = new MessageParticipantActionBuilder("ClaimsApprovedEnglish")
      .text("Your claim was approved. Your plan paid $.External.paidAmount of the $.External.billedAmount billed for your visit on $.External.dateOfService.")
      .next("OfferTransferClaimsEnglish")
      .build();

    const claimsApprovedSpanish = new MessageParticipantActionBuilder("ClaimsApprovedSpanish")
      .text("Su reclamación fue aprobada. Su plan pagó $.External.paidAmount de los $.External.billedAmount facturados por su visita del $.External.dateOfService.")
      .next("OfferTransferClaimsSpanish")
      .build();

    const claimsDeniedEnglish = new MessageParticipantActionBuilder("ClaimsDeniedEnglish")
      .text("Your claim was denied. The reason given was: $.External.denialReason. A representative can help you with next steps or an appeal.")
      .next("OfferTransferClaimsEnglish")
      .build();

    const claimsDeniedSpanish = new MessageParticipantActionBuilder("ClaimsDeniedSpanish")
      .text("Su reclamación fue denegada. El motivo fue: $.External.denialReason. Un representante puede ayudarle con los próximos pasos o una apelación.")
      .next("OfferTransferClaimsSpanish")
      .build();

    const claimsPendingEnglish = new MessageParticipantActionBuilder("ClaimsPendingEnglish")
      .text("Your claim for the visit on $.External.dateOfService is currently under review. No action is needed from you at this time.")
      .next("OfferTransferClaimsEnglish")
      .build();

    const claimsPendingSpanish = new MessageParticipantActionBuilder("ClaimsPendingSpanish")
      .text("Su reclamación por la visita del $.External.dateOfService está actualmente en revisión. No se requiere ninguna acción de su parte en este momento.")
      .next("OfferTransferClaimsSpanish")
      .build();

    const offerTransferClaimsEnglish = new GetParticipantInputActionBuilder("OfferTransferClaimsEnglish")
      .text("If you have additional questions about this claim, press 1 to speak with a representative. Press 2 to end the call.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    const offerTransferClaimsSpanish = new GetParticipantInputActionBuilder("OfferTransferClaimsSpanish")
      .text("Si tiene preguntas adicionales sobre esta reclamación, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    // ── Benefits ─────────────────────────────────────────────────────────────
    // No Lambda — no backend table for benefits. Routes to queue with context.
    const setIntentBenefits = new UpdateContactAttributesActionBuilder("SetIntentBenefits")
      .attribute("callReason", "benefits_inquiry")
      .attribute("slotServiceType", "$.Lex.Slots.ServiceType")
      .next("BenefitsTransferLanguageCheck")
      .build();

    const benefitsTransferLanguageCheck = new CompareActionBuilder("BenefitsTransferLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "BenefitsTransferSpanish")
      .onError("BenefitsTransferEnglish", "NoMatchingCondition")
      .build();

    const benefitsTransferEnglish = new MessageParticipantActionBuilder("BenefitsTransferEnglish")
      .text("Let me connect you with a benefits specialist.")
      .next("SetSupportQueueFlow")
      .build();

    const benefitsTransferSpanish = new MessageParticipantActionBuilder("BenefitsTransferSpanish")
      .text("Permítame conectarlo con un especialista en beneficios.")
      .next("SetSupportQueueFlow")
      .build();

    // ── Prior Authorization ───────────────────────────────────────────────────
    const setIntentPriorAuth = new UpdateContactAttributesActionBuilder("SetIntentPriorAuth")
      .attribute("callReason", "prior_authorization")
      .attribute("slotProcedureCode", "$.Lex.Slots.ProcedureCode")
      .attribute("slotProviderName", "$.Lex.Slots.ProviderName")
      .next("PriorAuthLanguageCheck")
      .build();

    const priorAuthLanguageCheck = new CompareActionBuilder("PriorAuthLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "PriorAuthLookupBridgeSpanish")
      .onError("PriorAuthLookupBridgeEnglish", "NoMatchingCondition")
      .build();

    const priorAuthLookupBridgeEnglish = new MessageParticipantActionBuilder("PriorAuthLookupBridgeEnglish")
      .text("One moment while I check coverage for that procedure.")
      .next("InvokeProcedureLookup")
      .build();

    const priorAuthLookupBridgeSpanish = new MessageParticipantActionBuilder("PriorAuthLookupBridgeSpanish")
      .text("Un momento mientras verifico la cobertura para ese procedimiento.")
      .next("InvokeProcedureLookup")
      .build();

    const invokeProcedureLookup = new InvokeLambdaFunctionActionBuilder("InvokeProcedureLookup")
      .lambdaArn(context.refs.lambdaArn("procedureLookup"))
      .next("CompareProcedureFound")
      .onError("PriorAuthErrorLanguageCheck")
      .build();

    const priorAuthErrorLanguageCheck = new CompareActionBuilder("PriorAuthErrorLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "PriorAuthLookupErrorSpanish")
      .onError("PriorAuthLookupErrorEnglish", "NoMatchingCondition")
      .build();

    const priorAuthLookupErrorEnglish = new MessageParticipantActionBuilder("PriorAuthLookupErrorEnglish")
      .text("I'm having trouble checking that right now. Let me connect you with our prior authorization team.")
      .next("SetSupportQueueFlow")
      .build();

    const priorAuthLookupErrorSpanish = new MessageParticipantActionBuilder("PriorAuthLookupErrorSpanish")
      .text("Tengo problemas para verificar eso ahora. Permítame conectarlo con nuestro equipo de autorización previa.")
      .next("SetSupportQueueFlow")
      .build();

    const compareProcedureFound = new CompareActionBuilder("CompareProcedureFound")
      .comparisonValue("$.External.found")
      .when(equalsCondition("true"), "CompareProcedureCovered")
      .onError("PriorAuthNotFoundLanguageCheck", "NoMatchingCondition")
      .build();

    const priorAuthNotFoundLanguageCheck = new CompareActionBuilder("PriorAuthNotFoundLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "PriorAuthCodeNotFoundSpanish")
      .onError("PriorAuthCodeNotFoundEnglish", "NoMatchingCondition")
      .build();

    const priorAuthCodeNotFoundEnglish = new MessageParticipantActionBuilder("PriorAuthCodeNotFoundEnglish")
      .text("I wasn't able to find information for that procedure code. Let me connect you with someone who can help.")
      .next("SetSupportQueueFlow")
      .build();

    const priorAuthCodeNotFoundSpanish = new MessageParticipantActionBuilder("PriorAuthCodeNotFoundSpanish")
      .text("No pude encontrar información para ese código de procedimiento. Permítame conectarlo con alguien que pueda ayudarle.")
      .next("SetSupportQueueFlow")
      .build();

    const compareProcedureCovered = new CompareActionBuilder("CompareProcedureCovered")
      .comparisonValue("$.External.covered")
      .when(equalsCondition("true"), "CompareProcedurePriorAuth")
      .onError("ProcedureNotCoveredLanguageCheck", "NoMatchingCondition")
      .build();

    const procedureNotCoveredLanguageCheck = new CompareActionBuilder("ProcedureNotCoveredLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProcedureNotCoveredSpanish")
      .onError("ProcedureNotCoveredEnglish", "NoMatchingCondition")
      .build();

    const procedureNotCoveredEnglish = new MessageParticipantActionBuilder("ProcedureNotCoveredEnglish")
      .text("That procedure isn't covered under your current plan. A representative can review your options, including the appeals process.")
      .next("SetSupportQueueFlow")
      .build();

    const procedureNotCoveredSpanish = new MessageParticipantActionBuilder("ProcedureNotCoveredSpanish")
      .text("Ese procedimiento no está cubierto bajo su plan actual. Un representante puede revisar sus opciones, incluido el proceso de apelación.")
      .next("SetSupportQueueFlow")
      .build();

    const compareProcedurePriorAuth = new CompareActionBuilder("CompareProcedurePriorAuth")
      .comparisonValue("$.External.requiresPriorAuth")
      .when(equalsCondition("true"), "PriorAuthRequiredLanguageCheck")
      .onError("ProcedureCoveredNoPriorAuthLanguageCheck", "NoMatchingCondition")
      .build();

    const priorAuthRequiredLanguageCheck = new CompareActionBuilder("PriorAuthRequiredLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "PriorAuthRequiredSpanish")
      .onError("PriorAuthRequiredEnglish", "NoMatchingCondition")
      .build();

    // Auto-transfer — prior auth needs immediate agent action, no choice offered.
    const priorAuthRequiredEnglish = new MessageParticipantActionBuilder("PriorAuthRequiredEnglish")
      .text("Your plan covers this procedure, but prior authorization is required before your scheduled date. I'll connect you with our prior authorization team now.")
      .next("SetSupportQueueFlow")
      .build();

    const priorAuthRequiredSpanish = new MessageParticipantActionBuilder("PriorAuthRequiredSpanish")
      .text("Su plan cubre este procedimiento, pero se requiere autorización previa antes de su fecha programada. Ahora le conectaré con nuestro equipo de autorización previa.")
      .next("SetSupportQueueFlow")
      .build();

    const procedureCoveredNoPriorAuthLanguageCheck = new CompareActionBuilder("ProcedureCoveredNoPriorAuthLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProcedureCoveredNoPriorAuthSpanish")
      .onError("ProcedureCoveredNoPriorAuthEnglish", "NoMatchingCondition")
      .build();

    const procedureCoveredNoPriorAuthEnglish = new MessageParticipantActionBuilder("ProcedureCoveredNoPriorAuthEnglish")
      .text("Good news — your plan covers this procedure and no prior authorization is required.")
      .next("OfferTransferPriorAuthEnglish")
      .build();

    const procedureCoveredNoPriorAuthSpanish = new MessageParticipantActionBuilder("ProcedureCoveredNoPriorAuthSpanish")
      .text("Buenas noticias: su plan cubre este procedimiento y no se requiere autorización previa.")
      .next("OfferTransferPriorAuthSpanish")
      .build();

    const offerTransferPriorAuthEnglish = new GetParticipantInputActionBuilder("OfferTransferPriorAuthEnglish")
      .text("If you have any other questions, press 1 to speak with a representative. Press 2 to end the call.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    const offerTransferPriorAuthSpanish = new GetParticipantInputActionBuilder("OfferTransferPriorAuthSpanish")
      .text("Si tiene alguna otra pregunta, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    // ── Provider Lookup ───────────────────────────────────────────────────────
    const setIntentProviderLookup = new UpdateContactAttributesActionBuilder("SetIntentProviderLookup")
      .attribute("callReason", "provider_lookup")
      .attribute("slotSpecialty", "$.Lex.Slots.Specialty")
      .attribute("slotZipCode", "$.Lex.Slots.ZipCode")
      .attribute("slotProviderName", "$.Lex.Slots.ProviderName")
      .next("ProviderLanguageCheck")
      .build();

    const providerLanguageCheck = new CompareActionBuilder("ProviderLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProviderLookupBridgeSpanish")
      .onError("ProviderLookupBridgeEnglish", "NoMatchingCondition")
      .build();

    const providerLookupBridgeEnglish = new MessageParticipantActionBuilder("ProviderLookupBridgeEnglish")
      .text("One moment while I check your network.")
      .next("InvokeProviderLookup")
      .build();

    const providerLookupBridgeSpanish = new MessageParticipantActionBuilder("ProviderLookupBridgeSpanish")
      .text("Un momento mientras verifico su red.")
      .next("InvokeProviderLookup")
      .build();

    const invokeProviderLookup = new InvokeLambdaFunctionActionBuilder("InvokeProviderLookup")
      .lambdaArn(context.refs.lambdaArn("providerLookup"))
      .next("CompareProviderFound")
      .onError("ProviderErrorLanguageCheck")
      .build();

    const providerErrorLanguageCheck = new CompareActionBuilder("ProviderErrorLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProviderLookupErrorSpanish")
      .onError("ProviderLookupErrorEnglish", "NoMatchingCondition")
      .build();

    const providerLookupErrorEnglish = new MessageParticipantActionBuilder("ProviderLookupErrorEnglish")
      .text("I'm having trouble checking provider network status right now. Let me connect you with a representative.")
      .next("SetSupportQueueFlow")
      .build();

    const providerLookupErrorSpanish = new MessageParticipantActionBuilder("ProviderLookupErrorSpanish")
      .text("Tengo problemas para verificar el estado de la red de proveedores. Permítame conectarlo con un representante.")
      .next("SetSupportQueueFlow")
      .build();

    const compareProviderFound = new CompareActionBuilder("CompareProviderFound")
      .comparisonValue("$.External.found")
      .when(equalsCondition("true"), "ProviderFoundLanguageCheck")
      .onError("ProviderNotFoundLanguageCheck", "NoMatchingCondition")
      .build();

    const providerFoundLanguageCheck = new CompareActionBuilder("ProviderFoundLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProviderFoundSpanish")
      .onError("ProviderFoundEnglish", "NoMatchingCondition")
      .build();

    // Phone number only — addresses over TTS are not useful to callers.
    const providerFoundEnglish = new MessageParticipantActionBuilder("ProviderFoundEnglish")
      .text("$.External.name is in-network for your plan. Their phone number is $.External.phone. I can connect you with a representative to schedule an appointment or send you more details.")
      .next("OfferTransferProviderEnglish")
      .build();

    const providerFoundSpanish = new MessageParticipantActionBuilder("ProviderFoundSpanish")
      .text("$.External.name está en la red de su plan. Su número de teléfono es $.External.phone. Puedo conectarlo con un representante para programar una cita o enviarle más detalles.")
      .next("OfferTransferProviderSpanish")
      .build();

    const providerNotFoundLanguageCheck = new CompareActionBuilder("ProviderNotFoundLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProviderNotFoundSpanish")
      .onError("ProviderNotFoundEnglish", "NoMatchingCondition")
      .build();

    const providerNotFoundEnglish = new MessageParticipantActionBuilder("ProviderNotFoundEnglish")
      .text("That provider isn't currently in-network for your plan. I can connect you with a representative who can help you find an in-network alternative.")
      .next("SetSupportQueueFlow")
      .build();

    const providerNotFoundSpanish = new MessageParticipantActionBuilder("ProviderNotFoundSpanish")
      .text("Ese proveedor no está actualmente en la red de su plan. Puedo conectarlo con un representante que le ayude a encontrar una alternativa en la red.")
      .next("SetSupportQueueFlow")
      .build();

    const offerTransferProviderEnglish = new GetParticipantInputActionBuilder("OfferTransferProviderEnglish")
      .text("Press 1 to speak with a representative. Press 2 to end the call.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    const offerTransferProviderSpanish = new GetParticipantInputActionBuilder("OfferTransferProviderSpanish")
      .text("Oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    // ── Prescription / Formulary ──────────────────────────────────────────────
    const setIntentPrescription = new UpdateContactAttributesActionBuilder("SetIntentPrescription")
      .attribute("callReason", "prescription")
      .attribute("slotMedicationName", "$.Lex.Slots.MedicationName")
      .next("FormularyLanguageCheck")
      .build();

    const formularyLanguageCheck = new CompareActionBuilder("FormularyLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "FormularyLookupBridgeSpanish")
      .onError("FormularyLookupBridgeEnglish", "NoMatchingCondition")
      .build();

    const formularyLookupBridgeEnglish = new MessageParticipantActionBuilder("FormularyLookupBridgeEnglish")
      .text("One moment while I check your plan's formulary.")
      .next("InvokeFormularyLookup")
      .build();

    const formularyLookupBridgeSpanish = new MessageParticipantActionBuilder("FormularyLookupBridgeSpanish")
      .text("Un momento mientras verifico el formulario de su plan.")
      .next("InvokeFormularyLookup")
      .build();

    const invokeFormularyLookup = new InvokeLambdaFunctionActionBuilder("InvokeFormularyLookup")
      .lambdaArn(context.refs.lambdaArn("formularyLookup"))
      .next("CompareFormularyFound")
      .onError("FormularyErrorLanguageCheck")
      .build();

    const formularyErrorLanguageCheck = new CompareActionBuilder("FormularyErrorLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "FormularyLookupErrorSpanish")
      .onError("FormularyLookupErrorEnglish", "NoMatchingCondition")
      .build();

    const formularyLookupErrorEnglish = new MessageParticipantActionBuilder("FormularyLookupErrorEnglish")
      .text("I'm having trouble checking your formulary right now. Let me connect you with our pharmacy team.")
      .next("SetSupportQueueFlow")
      .build();

    const formularyLookupErrorSpanish = new MessageParticipantActionBuilder("FormularyLookupErrorSpanish")
      .text("Tengo problemas para verificar su formulario ahora. Permítame conectarlo con nuestro equipo de farmacia.")
      .next("SetSupportQueueFlow")
      .build();

    const compareFormularyFound = new CompareActionBuilder("CompareFormularyFound")
      .comparisonValue("$.External.found")
      .when(equalsCondition("true"), "CompareFormularyCovered")
      .onError("FormularyNotFoundLanguageCheck", "NoMatchingCondition")
      .build();

    const formularyNotFoundLanguageCheck = new CompareActionBuilder("FormularyNotFoundLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "MedicationNotCoveredSpanish")
      .onError("MedicationNotCoveredEnglish", "NoMatchingCondition")
      .build();

    const compareFormularyCovered = new CompareActionBuilder("CompareFormularyCovered")
      .comparisonValue("$.External.covered")
      .when(equalsCondition("true"), "CompareFormularyPriorAuth")
      .onError("FormularyNotCoveredLanguageCheck", "NoMatchingCondition")
      .build();

    const formularyNotCoveredLanguageCheck = new CompareActionBuilder("FormularyNotCoveredLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "MedicationNotCoveredSpanish")
      .onError("MedicationNotCoveredEnglish", "NoMatchingCondition")
      .build();

    const medicationNotCoveredEnglish = new MessageParticipantActionBuilder("MedicationNotCoveredEnglish")
      .text("$.External.medicationName isn't covered under your current plan. A representative can review covered alternatives with you.")
      .next("SetSupportQueueFlow")
      .build();

    const medicationNotCoveredSpanish = new MessageParticipantActionBuilder("MedicationNotCoveredSpanish")
      .text("$.External.medicationName no está cubierto bajo su plan actual. Un representante puede revisar con usted las alternativas cubiertas.")
      .next("SetSupportQueueFlow")
      .build();

    const compareFormularyPriorAuth = new CompareActionBuilder("CompareFormularyPriorAuth")
      .comparisonValue("$.External.requiresPriorAuth")
      .when(equalsCondition("true"), "FormularyPriorAuthLanguageCheck")
      .onError("FormularyCoveredLanguageCheck", "NoMatchingCondition")
      .build();

    const formularyPriorAuthLanguageCheck = new CompareActionBuilder("FormularyPriorAuthLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "MedicationCoveredPriorAuthSpanish")
      .onError("MedicationCoveredPriorAuthEnglish", "NoMatchingCondition")
      .build();

    const medicationCoveredPriorAuthEnglish = new MessageParticipantActionBuilder("MedicationCoveredPriorAuthEnglish")
      .text("$.External.medicationName is covered under your plan, but requires prior authorization before it can be dispensed. I'll connect you with our pharmacy team to start that process.")
      .next("SetSupportQueueFlow")
      .build();

    const medicationCoveredPriorAuthSpanish = new MessageParticipantActionBuilder("MedicationCoveredPriorAuthSpanish")
      .text("$.External.medicationName está cubierto bajo su plan, pero requiere autorización previa antes de ser dispensado. Le conectaré con nuestro equipo de farmacia para iniciar ese proceso.")
      .next("SetSupportQueueFlow")
      .build();

    const formularyCoveredLanguageCheck = new CompareActionBuilder("FormularyCoveredLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "MedicationCoveredSpanish")
      .onError("MedicationCoveredEnglish", "NoMatchingCondition")
      .build();

    const medicationCoveredEnglish = new MessageParticipantActionBuilder("MedicationCoveredEnglish")
      .text("$.External.medicationName is covered under your plan. It's a Tier $.External.tier medication with a $.External.copay copay.")
      .next("OfferTransferFormularyEnglish")
      .build();

    const medicationCoveredSpanish = new MessageParticipantActionBuilder("MedicationCoveredSpanish")
      .text("$.External.medicationName está cubierto bajo su plan. Es un medicamento de Nivel $.External.tier con un copago de $.External.copay.")
      .next("OfferTransferFormularySpanish")
      .build();

    const offerTransferFormularyEnglish = new GetParticipantInputActionBuilder("OfferTransferFormularyEnglish")
      .text("If you have questions about this medication or your formulary, press 1 to speak with a representative. Press 2 to end the call.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    const offerTransferFormularySpanish = new GetParticipantInputActionBuilder("OfferTransferFormularySpanish")
      .text("Si tiene preguntas sobre este medicamento o su formulario, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    // Eligibility is self-service — coverage status is already available from the
    // ANI lookup at $.Customer.Attributes.coverageStatus. No agent needed for
    // simple status checks. Offer transfer if the caller wants more help.
    const setIntentEligibility = new UpdateContactAttributesActionBuilder("SetIntentEligibility")
      .attribute("callReason", "eligibility")
      .attribute("slotMemberId", "$.Lex.Slots.MemberId")
      .next("CheckEligibilityLanguage")
      .build();

    const checkEligibilityLanguage = new CompareActionBuilder("CheckEligibilityLanguage")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "CheckCoverageStatusSpanish")
      .onError("CheckCoverageStatusEnglish", "NoMatchingCondition")
      .build();

    const checkCoverageStatusEnglish = new CompareActionBuilder("CheckCoverageStatusEnglish")
      .comparisonValue("$.Customer.Attributes.coverageStatus")
      .when(equalsCondition("ACTIVE"), "EligibilityActiveEnglish")
      .when(equalsCondition("SUSPENDED"), "EligibilitySuspendedEnglish")
      .when(equalsCondition("PENDING"), "EligibilityPendingEnglish")
      .onError("EligibilityUnknownEnglish", "NoMatchingCondition")
      .build();

    const checkCoverageStatusSpanish = new CompareActionBuilder("CheckCoverageStatusSpanish")
      .comparisonValue("$.Customer.Attributes.coverageStatus")
      .when(equalsCondition("ACTIVE"), "EligibilityActiveSpanish")
      .when(equalsCondition("SUSPENDED"), "EligibilitySuspendedSpanish")
      .when(equalsCondition("PENDING"), "EligibilityPendingSpanish")
      .onError("EligibilityUnknownSpanish", "NoMatchingCondition")
      .build();

    const eligibilityActiveEnglish = new MessageParticipantActionBuilder("EligibilityActiveEnglish")
      .text("Your coverage is currently active. You have full access to your benefits under your current plan.")
      .next("OfferTransferEnglish")
      .build();

    const eligibilitySuspendedEnglish = new MessageParticipantActionBuilder("EligibilitySuspendedEnglish")
      .text("Your coverage is currently suspended. Please speak with a representative for assistance.")
      .next("SetSupportQueueFlow")
      .build();

    const eligibilityPendingEnglish = new MessageParticipantActionBuilder("EligibilityPendingEnglish")
      .text("Your coverage is currently pending. It may take a few business days to become active.")
      .next("OfferTransferEnglish")
      .build();

    const eligibilityUnknownEnglish = new MessageParticipantActionBuilder("EligibilityUnknownEnglish")
      .text("We were unable to locate your eligibility information. Let me connect you with a representative.")
      .next("SetSupportQueueFlow")
      .build();

    const eligibilityActiveSpanish = new MessageParticipantActionBuilder("EligibilityActiveSpanish")
      .text("Su cobertura está actualmente activa. Tiene acceso completo a sus beneficios bajo su plan actual.")
      .next("OfferTransferSpanish")
      .build();

    const eligibilitySuspendedSpanish = new MessageParticipantActionBuilder("EligibilitySuspendedSpanish")
      .text("Su cobertura está actualmente suspendida. Por favor hable con un representante para obtener ayuda.")
      .next("SetSupportQueueFlow")
      .build();

    const eligibilityPendingSpanish = new MessageParticipantActionBuilder("EligibilityPendingSpanish")
      .text("Su cobertura está actualmente pendiente. Puede tardar algunos días hábiles en activarse.")
      .next("OfferTransferSpanish")
      .build();

    const eligibilityUnknownSpanish = new MessageParticipantActionBuilder("EligibilityUnknownSpanish")
      .text("No pudimos encontrar su información de elegibilidad. Permítame conectarlo con un representante.")
      .next("SetSupportQueueFlow")
      .build();

    // Offer caller the option to speak with an agent or end the call
    const offerTransferEnglish = new GetParticipantInputActionBuilder("OfferTransferEnglish")
      .text("If you have additional questions, press 1 to speak with a representative. Press 2 to end the call.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    const offerTransferSpanish = new GetParticipantInputActionBuilder("OfferTransferSpanish")
      .text("Si tiene preguntas adicionales, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    // ── Billing ───────────────────────────────────────────────────────────────
    const setIntentBilling = new UpdateContactAttributesActionBuilder("SetIntentBilling")
      .attribute("callReason", "billing")
      .attribute("slotInvoiceNumber", "$.Lex.Slots.InvoiceNumber")
      .next("BillingLanguageCheck")
      .build();

    const billingLanguageCheck = new CompareActionBuilder("BillingLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "BillingLookupBridgeSpanish")
      .onError("BillingLookupBridgeEnglish", "NoMatchingCondition")
      .build();

    const billingLookupBridgeEnglish = new MessageParticipantActionBuilder("BillingLookupBridgeEnglish")
      .text("One moment while I pull up your invoice.")
      .next("InvokeBillingLookup")
      .build();

    const billingLookupBridgeSpanish = new MessageParticipantActionBuilder("BillingLookupBridgeSpanish")
      .text("Un momento mientras busco su factura.")
      .next("InvokeBillingLookup")
      .build();

    const invokeBillingLookup = new InvokeLambdaFunctionActionBuilder("InvokeBillingLookup")
      .lambdaArn(context.refs.lambdaArn("billingLookup"))
      .next("CompareBillingFound")
      .onError("BillingErrorLanguageCheck")
      .build();

    const billingErrorLanguageCheck = new CompareActionBuilder("BillingErrorLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "BillingLookupErrorSpanish")
      .onError("BillingLookupErrorEnglish", "NoMatchingCondition")
      .build();

    const billingLookupErrorEnglish = new MessageParticipantActionBuilder("BillingLookupErrorEnglish")
      .text("I'm having trouble retrieving your invoice right now. Let me connect you with our billing team.")
      .next("SetSupportQueueFlow")
      .build();

    const billingLookupErrorSpanish = new MessageParticipantActionBuilder("BillingLookupErrorSpanish")
      .text("Tengo problemas para recuperar su factura ahora. Permítame conectarlo con nuestro equipo de facturación.")
      .next("SetSupportQueueFlow")
      .build();

    const compareBillingFound = new CompareActionBuilder("CompareBillingFound")
      .comparisonValue("$.External.found")
      .when(equalsCondition("true"), "CompareBillingStatus")
      .onError("BillingNotFoundLanguageCheck", "NoMatchingCondition")
      .build();

    const billingNotFoundLanguageCheck = new CompareActionBuilder("BillingNotFoundLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "InvoiceNotFoundSpanish")
      .onError("InvoiceNotFoundEnglish", "NoMatchingCondition")
      .build();

    const invoiceNotFoundEnglish = new MessageParticipantActionBuilder("InvoiceNotFoundEnglish")
      .text("We weren't able to locate that invoice for your account. A billing representative can help you find it.")
      .next("SetSupportQueueFlow")
      .build();

    const invoiceNotFoundSpanish = new MessageParticipantActionBuilder("InvoiceNotFoundSpanish")
      .text("No pudimos encontrar esa factura en su cuenta. Un representante de facturación puede ayudarle a encontrarla.")
      .next("SetSupportQueueFlow")
      .build();

    const compareBillingStatus = new CompareActionBuilder("CompareBillingStatus")
      .comparisonValue("$.External.status")
      .when(equalsCondition("PAID"), "BillingPaidLanguageCheck")
      .when(equalsCondition("UNPAID"), "BillingUnpaidLanguageCheck")
      .when(equalsCondition("OVERDUE"), "BillingOverdueLanguageCheck")
      .onError("SetSupportQueueFlow", "NoMatchingCondition")
      .build();

    const billingPaidLanguageCheck = new CompareActionBuilder("BillingPaidLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "InvoicePaidSpanish")
      .onError("InvoicePaidEnglish", "NoMatchingCondition")
      .build();

    const billingUnpaidLanguageCheck = new CompareActionBuilder("BillingUnpaidLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "InvoiceUnpaidSpanish")
      .onError("InvoiceUnpaidEnglish", "NoMatchingCondition")
      .build();

    const billingOverdueLanguageCheck = new CompareActionBuilder("BillingOverdueLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "InvoiceOverdueSpanish")
      .onError("InvoiceOverdueEnglish", "NoMatchingCondition")
      .build();

    const invoicePaidEnglish = new MessageParticipantActionBuilder("InvoicePaidEnglish")
      .text("Your invoice of $.External.amount has been paid. It was issued on $.External.dateIssued for $.External.description.")
      .next("OfferTransferBillingEnglish")
      .build();

    const invoicePaidSpanish = new MessageParticipantActionBuilder("InvoicePaidSpanish")
      .text("Su factura de $.External.amount ha sido pagada. Fue emitida el $.External.dateIssued por $.External.description.")
      .next("OfferTransferBillingSpanish")
      .build();

    const invoiceUnpaidEnglish = new MessageParticipantActionBuilder("InvoiceUnpaidEnglish")
      .text("You have an outstanding invoice of $.External.amount due on $.External.dueDate for $.External.description.")
      .next("OfferTransferBillingEnglish")
      .build();

    const invoiceUnpaidSpanish = new MessageParticipantActionBuilder("InvoiceUnpaidSpanish")
      .text("Tiene una factura pendiente de $.External.amount con vencimiento el $.External.dueDate por $.External.description.")
      .next("OfferTransferBillingSpanish")
      .build();

    // OVERDUE — auto-transfer, no choice offered.
    const invoiceOverdueEnglish = new MessageParticipantActionBuilder("InvoiceOverdueEnglish")
      .text("You have a past-due balance of $.External.amount that was due on $.External.dueDate. I'll connect you with our billing team now.")
      .next("SetSupportQueueFlow")
      .build();

    const invoiceOverdueSpanish = new MessageParticipantActionBuilder("InvoiceOverdueSpanish")
      .text("Tiene un saldo vencido de $.External.amount que venció el $.External.dueDate. Ahora le conectaré con nuestro equipo de facturación.")
      .next("SetSupportQueueFlow")
      .build();

    const offerTransferBillingEnglish = new GetParticipantInputActionBuilder("OfferTransferBillingEnglish")
      .text("To speak with a billing representative, press 1. Press 2 to end the call.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    const offerTransferBillingSpanish = new GetParticipantInputActionBuilder("OfferTransferBillingSpanish")
      .text("Para hablar con un representante de facturación, oprima 1. Oprima 2 para terminar la llamada.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetSupportQueueFlow")
      .when(equalsCondition("2"), "Disconnect")
      .onError("Disconnect", "InputTimeLimitExceeded")
      .onError("Disconnect", "NoMatchingCondition")
      .onError("Disconnect")
      .build();

    const setSupportQueueFlow = new SetCustomerQueueFlowActionBuilder(
      "SetSupportQueueFlow",
    )
      .customerQueueFlowArn(context.refs.flowArn("supportQueueExperience"))
      .next("SetWorkingQueue")
      .onError("Disconnect")
      .build();

    const setWorkingQueue = new UpdateContactTargetQueueActionBuilder(
      "SetWorkingQueue",
    )
      .queueId(context.refs.queueArn("support"))
      .next("TransferToSupport")
      .onError("Disconnect")
      .build();

    const transfer = new TransferContactToQueueActionBuilder("TransferToSupport")
      .next("Disconnect")
      .onError("Disconnect", "QueueAtCapacity")
      .onError("Disconnect")
      .build();

    const disconnect = new DisconnectParticipantActionBuilder(
      "Disconnect",
    ).build();

    return new FlowBuilder("MainInbound")
      .startWith(setDefaultVoice)
      .add(languagePrompt)
      .add(setEnglishAttr)
      .add(setVoiceEnglish)
      .add(setSpanishAttr)
      .add(setVoiceSpanish)
      .add(checkHours)
      .add(compareHours)
      .add(checkLanguageForClosed)
      .add(closedMessageEnglish)
      .add(closedMessageSpanish)
      .add(lookupByPhone)
      .add(greeting)
      .add(setIntentPromptLanguage)
      .add(intentPromptEnglish)
      .add(intentPromptSpanish)
      .add(setIntentClaims)
      .add(claimsLanguageCheck)
      .add(claimsLookupBridgeEnglish)
      .add(claimsLookupBridgeSpanish)
      .add(invokeClaimsLookup)
      .add(claimsErrorLanguageCheck)
      .add(claimsLookupErrorEnglish)
      .add(claimsLookupErrorSpanish)
      .add(compareClaimsFound)
      .add(claimsNotFoundLanguageCheck)
      .add(claimsNotFoundEnglish)
      .add(claimsNotFoundSpanish)
      .add(compareClaimsStatus)
      .add(claimsApprovedLanguageCheck)
      .add(claimsDeniedLanguageCheck)
      .add(claimsPendingLanguageCheck)
      .add(claimsApprovedEnglish)
      .add(claimsApprovedSpanish)
      .add(claimsDeniedEnglish)
      .add(claimsDeniedSpanish)
      .add(claimsPendingEnglish)
      .add(claimsPendingSpanish)
      .add(offerTransferClaimsEnglish)
      .add(offerTransferClaimsSpanish)
      .add(setIntentBenefits)
      .add(benefitsTransferLanguageCheck)
      .add(benefitsTransferEnglish)
      .add(benefitsTransferSpanish)
      .add(setIntentPriorAuth)
      .add(priorAuthLanguageCheck)
      .add(priorAuthLookupBridgeEnglish)
      .add(priorAuthLookupBridgeSpanish)
      .add(invokeProcedureLookup)
      .add(priorAuthErrorLanguageCheck)
      .add(priorAuthLookupErrorEnglish)
      .add(priorAuthLookupErrorSpanish)
      .add(compareProcedureFound)
      .add(priorAuthNotFoundLanguageCheck)
      .add(priorAuthCodeNotFoundEnglish)
      .add(priorAuthCodeNotFoundSpanish)
      .add(compareProcedureCovered)
      .add(procedureNotCoveredLanguageCheck)
      .add(procedureNotCoveredEnglish)
      .add(procedureNotCoveredSpanish)
      .add(compareProcedurePriorAuth)
      .add(priorAuthRequiredLanguageCheck)
      .add(priorAuthRequiredEnglish)
      .add(priorAuthRequiredSpanish)
      .add(procedureCoveredNoPriorAuthLanguageCheck)
      .add(procedureCoveredNoPriorAuthEnglish)
      .add(procedureCoveredNoPriorAuthSpanish)
      .add(offerTransferPriorAuthEnglish)
      .add(offerTransferPriorAuthSpanish)
      .add(setIntentProviderLookup)
      .add(providerLanguageCheck)
      .add(providerLookupBridgeEnglish)
      .add(providerLookupBridgeSpanish)
      .add(invokeProviderLookup)
      .add(providerErrorLanguageCheck)
      .add(providerLookupErrorEnglish)
      .add(providerLookupErrorSpanish)
      .add(compareProviderFound)
      .add(providerFoundLanguageCheck)
      .add(providerFoundEnglish)
      .add(providerFoundSpanish)
      .add(providerNotFoundLanguageCheck)
      .add(providerNotFoundEnglish)
      .add(providerNotFoundSpanish)
      .add(offerTransferProviderEnglish)
      .add(offerTransferProviderSpanish)
      .add(setIntentPrescription)
      .add(formularyLanguageCheck)
      .add(formularyLookupBridgeEnglish)
      .add(formularyLookupBridgeSpanish)
      .add(invokeFormularyLookup)
      .add(formularyErrorLanguageCheck)
      .add(formularyLookupErrorEnglish)
      .add(formularyLookupErrorSpanish)
      .add(compareFormularyFound)
      .add(formularyNotFoundLanguageCheck)
      .add(compareFormularyCovered)
      .add(formularyNotCoveredLanguageCheck)
      .add(medicationNotCoveredEnglish)
      .add(medicationNotCoveredSpanish)
      .add(compareFormularyPriorAuth)
      .add(formularyPriorAuthLanguageCheck)
      .add(medicationCoveredPriorAuthEnglish)
      .add(medicationCoveredPriorAuthSpanish)
      .add(formularyCoveredLanguageCheck)
      .add(medicationCoveredEnglish)
      .add(medicationCoveredSpanish)
      .add(offerTransferFormularyEnglish)
      .add(offerTransferFormularySpanish)
      .add(setIntentEligibility)
      .add(checkEligibilityLanguage)
      .add(checkCoverageStatusEnglish)
      .add(checkCoverageStatusSpanish)
      .add(eligibilityActiveEnglish)
      .add(eligibilitySuspendedEnglish)
      .add(eligibilityPendingEnglish)
      .add(eligibilityUnknownEnglish)
      .add(eligibilityActiveSpanish)
      .add(eligibilitySuspendedSpanish)
      .add(eligibilityPendingSpanish)
      .add(eligibilityUnknownSpanish)
      .add(offerTransferEnglish)
      .add(offerTransferSpanish)
      .add(setIntentBilling)
      .add(billingLanguageCheck)
      .add(billingLookupBridgeEnglish)
      .add(billingLookupBridgeSpanish)
      .add(invokeBillingLookup)
      .add(billingErrorLanguageCheck)
      .add(billingLookupErrorEnglish)
      .add(billingLookupErrorSpanish)
      .add(compareBillingFound)
      .add(billingNotFoundLanguageCheck)
      .add(invoiceNotFoundEnglish)
      .add(invoiceNotFoundSpanish)
      .add(compareBillingStatus)
      .add(billingPaidLanguageCheck)
      .add(billingUnpaidLanguageCheck)
      .add(billingOverdueLanguageCheck)
      .add(invoicePaidEnglish)
      .add(invoicePaidSpanish)
      .add(invoiceUnpaidEnglish)
      .add(invoiceUnpaidSpanish)
      .add(invoiceOverdueEnglish)
      .add(invoiceOverdueSpanish)
      .add(offerTransferBillingEnglish)
      .add(offerTransferBillingSpanish)
      .add(setSupportQueueFlow)
      .add(setWorkingQueue)
      .add(transfer)
      .add(disconnect)
      .build();
  },
};
