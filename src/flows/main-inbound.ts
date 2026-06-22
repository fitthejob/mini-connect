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
    // All intents route to the same support queue — split when dedicated queues are added.
    const setIntentClaims = new UpdateContactAttributesActionBuilder("SetIntentClaims")
      .attribute("callReason", "claims_status")
      .attribute("slotClaimNumber", "$.Lex.Slots.ClaimNumber")
      .attribute("slotDateOfService", "$.Lex.Slots.DateOfService")
      .next("SetSupportQueueFlow")
      .build();

    const setIntentBenefits = new UpdateContactAttributesActionBuilder("SetIntentBenefits")
      .attribute("callReason", "benefits_inquiry")
      .attribute("slotServiceType", "$.Lex.Slots.ServiceType")
      .next("SetSupportQueueFlow")
      .build();

    const setIntentPriorAuth = new UpdateContactAttributesActionBuilder("SetIntentPriorAuth")
      .attribute("callReason", "prior_authorization")
      .attribute("slotProcedureCode", "$.Lex.Slots.ProcedureCode")
      .attribute("slotProviderName", "$.Lex.Slots.ProviderName")
      .next("SetSupportQueueFlow")
      .build();

    const setIntentProviderLookup = new UpdateContactAttributesActionBuilder("SetIntentProviderLookup")
      .attribute("callReason", "provider_lookup")
      .attribute("slotSpecialty", "$.Lex.Slots.Specialty")
      .attribute("slotZipCode", "$.Lex.Slots.ZipCode")
      .next("SetSupportQueueFlow")
      .build();

    const setIntentPrescription = new UpdateContactAttributesActionBuilder("SetIntentPrescription")
      .attribute("callReason", "prescription")
      .attribute("slotMedicationName", "$.Lex.Slots.MedicationName")
      .next("SetSupportQueueFlow")
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

    const setIntentBilling = new UpdateContactAttributesActionBuilder("SetIntentBilling")
      .attribute("callReason", "billing")
      .attribute("slotInvoiceNumber", "$.Lex.Slots.InvoiceNumber")
      .next("SetSupportQueueFlow")
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
      .add(setIntentBenefits)
      .add(setIntentPriorAuth)
      .add(setIntentProviderLookup)
      .add(setIntentPrescription)
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
      .add(setSupportQueueFlow)
      .add(setWorkingQueue)
      .add(transfer)
      .add(disconnect)
      .build();
  },
};
