import { CompareActionBuilder, ConnectParticipantWithLexBotActionBuilder, DisconnectParticipantActionBuilder, FlowBuilder, GetCustomerProfileActionBuilder, InvokeLambdaFunctionActionBuilder, MessageParticipantActionBuilder, SetCustomerQueueFlowActionBuilder, TransferContactToQueueActionBuilder, UpdateContactAttributesActionBuilder, UpdateContactTargetQueueActionBuilder, UpdateContactTextToSpeechVoiceActionBuilder, equalsCondition, } from "connect-flow-builder";
export const mainInboundSpec = {
    key: "mainInbound",
    name: "MainInbound",
    type: "CONTACT_FLOW",
    filename: "main-inbound.json",
    description: "Primary inbound flow for support.",
    dependsOnFlows: ["supportQueueExperience"],
    build: (context) => {
        const setDefaultVoice = new UpdateContactTextToSpeechVoiceActionBuilder("SetDefaultVoice")
            .voice("Joanna")
            .engine("neural")
            .next("LanguagePrompt")
            .build();
        const languagePrompt = new ConnectParticipantWithLexBotActionBuilder("LanguagePrompt")
            .text("For English, press or say 1. Para español, oprima o diga 2.")
            .lexV2BotAliasArn(context.refs.lexBotAliasArn("mainInbound"))
            .whenIntentEquals("EnglishIntent", "SetEnglishAttr")
            .whenIntentEquals("SpanishIntent", "SetSpanishAttr")
            .onInputTimeLimitExceeded("CheckHours")
            .onNoMatchingCondition("CheckHours")
            .build();
        const setEnglishAttr = new UpdateContactAttributesActionBuilder("SetEnglishAttr")
            .attribute("preferredLanguage", "en")
            .next("SetVoiceEnglish")
            .build();
        const setVoiceEnglish = new UpdateContactTextToSpeechVoiceActionBuilder("SetVoiceEnglish")
            .voice("Joanna")
            .engine("neural")
            .next("CheckHours")
            .build();
        const setSpanishAttr = new UpdateContactAttributesActionBuilder("SetSpanishAttr")
            .attribute("preferredLanguage", "es")
            .next("SetVoiceSpanish")
            .build();
        const setVoiceSpanish = new UpdateContactTextToSpeechVoiceActionBuilder("SetVoiceSpanish")
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
        const checkLanguageForClosed = new CompareActionBuilder("CheckLanguageForClosed")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "ClosedMessageSpanish")
            .onError("ClosedMessageEnglish", "NoMatchingCondition")
            .build();
        const closedMessageEnglish = new MessageParticipantActionBuilder("ClosedMessageEnglish")
            .text("Thank you for calling Mini Connect. Our offices are currently closed. " +
            "Our business hours are Monday through Friday, 9am to 5pm Eastern Time. " +
            "Please call back during business hours.")
            .next("Disconnect")
            .build();
        const closedMessageSpanish = new MessageParticipantActionBuilder("ClosedMessageSpanish")
            .text("Gracias por llamar a Mini Connect. Nuestras oficinas están actualmente cerradas. " +
            "Nuestro horario de atención es de lunes a viernes, de 9am a 5pm hora del Este. " +
            "Por favor llame de vuelta durante el horario de atención.")
            .next("Disconnect")
            .build();
        const greeting = new MessageParticipantActionBuilder("Greeting")
            .text("Welcome to Mini Connect.")
            .next("SetIntentPromptLanguage")
            .build();
        // Branch on preferredLanguage to select the correct Lex locale for intent capture.
        // Lex locale must be set statically per block — it cannot be passed dynamically.
        const setIntentPromptLanguage = new CompareActionBuilder("SetIntentPromptLanguage")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "IntentPromptSpanish")
            .onError("IntentPromptEnglish", "NoMatchingCondition")
            .build();
        const intentBranches = (nextOnNoMatch) => (builder) => builder
            .whenIntentEquals("ClaimsStatusIntent", "SetIntentClaims")
            .whenIntentEquals("BenefitsInquiryIntent", "SetIntentBenefits")
            .whenIntentEquals("PriorAuthorizationIntent", "SetIntentPriorAuth")
            .whenIntentEquals("ProviderLookupIntent", "SetIntentProviderLookup")
            .whenIntentEquals("PrescriptionIntent", "SetIntentPrescription")
            .whenIntentEquals("EligibilityIntent", "SetIntentEligibility")
            .whenIntentEquals("BillingIntent", "SetIntentBilling")
            .onInputTimeLimitExceeded(nextOnNoMatch)
            .onNoMatchingCondition(nextOnNoMatch);
        const intentPromptEnglish = intentBranches("SetSupportQueueFlow")(new ConnectParticipantWithLexBotActionBuilder("IntentPromptEnglish")
            .text("How can I help you today? You can say things like: check my claim status, benefits question, prior authorization, find a provider, prescription help, check eligibility, or billing question.")
            .lexV2BotAliasArn(context.refs.lexBotAliasArn("mainInbound"))
            .sessionAttribute("x-amz-lex:locale-id", "en_US")).build();
        const intentPromptSpanish = intentBranches("SetSupportQueueFlow")(new ConnectParticipantWithLexBotActionBuilder("IntentPromptSpanish")
            .text("¿Cómo puedo ayudarle hoy? Puede decir: estado de reclamación, pregunta sobre beneficios, autorización previa, buscar proveedor, ayuda con receta, verificar elegibilidad, o pregunta de facturación.")
            .lexV2BotAliasArn(context.refs.lexBotAliasArn("mainInbound"))
            .sessionAttribute("x-amz-lex:locale-id", "es_US")).build();
        // Store call reason as contact attribute so agents see it on their screen.
        // All intents currently route to the same support queue — split into dedicated
        // queues when additional queues are provisioned.
        const setIntentClaims = new UpdateContactAttributesActionBuilder("SetIntentClaims")
            .attribute("callReason", "claims_status")
            .next("SetSupportQueueFlow")
            .build();
        const setIntentBenefits = new UpdateContactAttributesActionBuilder("SetIntentBenefits")
            .attribute("callReason", "benefits_inquiry")
            .next("SetSupportQueueFlow")
            .build();
        const setIntentPriorAuth = new UpdateContactAttributesActionBuilder("SetIntentPriorAuth")
            .attribute("callReason", "prior_authorization")
            .next("SetSupportQueueFlow")
            .build();
        const setIntentProviderLookup = new UpdateContactAttributesActionBuilder("SetIntentProviderLookup")
            .attribute("callReason", "provider_lookup")
            .next("SetSupportQueueFlow")
            .build();
        const setIntentPrescription = new UpdateContactAttributesActionBuilder("SetIntentPrescription")
            .attribute("callReason", "prescription")
            .next("SetSupportQueueFlow")
            .build();
        const setIntentEligibility = new UpdateContactAttributesActionBuilder("SetIntentEligibility")
            .attribute("callReason", "eligibility")
            .next("SetSupportQueueFlow")
            .build();
        const setIntentBilling = new UpdateContactAttributesActionBuilder("SetIntentBilling")
            .attribute("callReason", "billing")
            .next("SetSupportQueueFlow")
            .build();
        const setSupportQueueFlow = new SetCustomerQueueFlowActionBuilder("SetSupportQueueFlow")
            .customerQueueFlowArn(context.refs.flowArn("supportQueueExperience"))
            .next("SetWorkingQueue")
            .onError("Disconnect")
            .build();
        const setWorkingQueue = new UpdateContactTargetQueueActionBuilder("SetWorkingQueue")
            .queueId(context.refs.queueArn("support"))
            .next("TransferToSupport")
            .onError("Disconnect")
            .build();
        const transfer = new TransferContactToQueueActionBuilder("TransferToSupport")
            .next("Disconnect")
            .onError("Disconnect", "QueueAtCapacity")
            .onError("Disconnect")
            .build();
        const disconnect = new DisconnectParticipantActionBuilder("Disconnect").build();
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
            .add(setIntentBilling)
            .add(setSupportQueueFlow)
            .add(setWorkingQueue)
            .add(transfer)
            .add(disconnect)
            .build();
    },
};
