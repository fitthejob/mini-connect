import { CompareActionBuilder, ConnectParticipantWithLexBotActionBuilder, DisconnectParticipantActionBuilder, FlowBuilder, GetCustomerProfileActionBuilder, GetParticipantInputActionBuilder, InvokeLambdaFunctionActionBuilder, InvokeFlowModuleActionBuilder, MessageParticipantActionBuilder, SetCustomerQueueFlowActionBuilder, ShowViewActionBuilder, TransferContactToQueueActionBuilder, UpdateContactAttributesActionBuilder, UpdateContactTargetQueueActionBuilder, UpdateContactTextToSpeechVoiceActionBuilder, equalsCondition, } from "connect-flow-builder";
export const mainInboundSpec = {
    key: "mainInbound",
    name: "MainInbound",
    type: "CONTACT_FLOW",
    filename: "main-inbound.json",
    description: "Primary inbound flow — call setup, intent capture, module dispatch, and queue routing.",
    dependsOnFlows: [
        "supportQueueExperience",
        "claimsQueueExperience",
        "billingQueueExperience",
        "pharmacyQueueExperience",
        "providerQueueExperience",
        "memberServicesQueueExperience",
    ],
    build: (context) => {
        // ── Section 1: Call setup ─────────────────────────────────────────────────
        // Voice → language selection → hours check → ANI lookup → second-factor → greeting
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
            .onError("CheckGreetingPersonalization")
            .build();
        const compareHours = new CompareActionBuilder("CompareHours")
            .comparisonValue("$.External.isBusinessHours")
            .when(equalsCondition("true"), "LookupByPhone")
            .onError("CheckLanguageForClosed", "NoMatchingCondition")
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
        // ANI lookup — identifies the caller by phone number before they say a word.
        // Success sets $.Customer.* and marks callerIdentified=true for the screen pop.
        // All error branches fail open to Greeting so no caller is stranded by a miss.
        const lookupByPhone = new GetCustomerProfileActionBuilder("LookupByPhone")
            .identifier("_phone", "$.CustomerEndpoint.Address")
            .responseField("FirstName")
            .responseField("LastName")
            .responseField("Attributes.memberId")
            .responseField("Attributes.planId")
            .responseField("Attributes.coverageStatus")
            .next("SetCallerIdentified")
            .onError("CheckGreetingPersonalization", "NoneFoundError")
            .onError("CheckGreetingPersonalization", "MultipleFoundError")
            .onError("CheckGreetingPersonalization")
            .build();
        const setCallerIdentified = new UpdateContactAttributesActionBuilder("SetCallerIdentified")
            .attribute("callerIdentified", "true")
            .next("VerifyIdentityCheck")
            .build();
        // ── Second-factor identity verification ───────────────────────────────────
        // Only runs for identified callers (callerIdentified=true).
        // Collects 8-digit DOB via DTMF, validates against DynamoDB via Lambda.
        // Two attempts allowed. Lambda errors fail open to Greeting.
        const verifyIdentityCheck = new CompareActionBuilder("VerifyIdentityCheck")
            .comparisonValue("$.Attributes.callerIdentified")
            .when(equalsCondition("true"), "VerifyDobPromptLanguageCheck")
            .onError("CheckGreetingPersonalization", "NoMatchingCondition")
            .build();
        const verifyDobPromptLanguageCheck = new CompareActionBuilder("VerifyDobPromptLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "VerifyDobPromptSpanish")
            .onError("VerifyDobPromptEnglish", "NoMatchingCondition")
            .build();
        const verifyDobPromptEnglish = new GetParticipantInputActionBuilder("VerifyDobPromptEnglish")
            .text("For your security, please enter your date of birth using your keypad. " +
            "Enter the month, day, and year. For example, January 15th 1980 would be " +
            "0 1 1 5 1 9 8 0.")
            .inputTimeLimitSeconds(15)
            .onError("StoreVerifyInput", "NoMatchingCondition")
            .onError("StoreVerifyInput", "InputTimeLimitExceeded")
            .onError("StoreVerifyInput")
            .build();
        const verifyDobPromptSpanish = new GetParticipantInputActionBuilder("VerifyDobPromptSpanish")
            .text("Por su seguridad, ingrese su fecha de nacimiento usando su teclado. " +
            "Ingrese mes, día y año. Por ejemplo, el 15 de enero de 1980 sería " +
            "0 1 1 5 1 9 8 0.")
            .inputTimeLimitSeconds(15)
            .onError("StoreVerifyInput", "NoMatchingCondition")
            .onError("StoreVerifyInput", "InputTimeLimitExceeded")
            .onError("StoreVerifyInput")
            .build();
        // $.StoredCustomerInput holds the DTMF digits collected by GetParticipantInput.
        const storeVerifyInput = new UpdateContactAttributesActionBuilder("StoreVerifyInput")
            .attribute("dtmfDateOfBirth", "$.StoredCustomerInput")
            .next("InvokeIdentityVerify")
            .build();
        const invokeIdentityVerify = new InvokeLambdaFunctionActionBuilder("InvokeIdentityVerify")
            .lambdaArn(context.refs.lambdaArn("identityVerify"))
            .next("CompareVerified")
            .onError("CheckGreetingPersonalization")
            .build();
        const compareVerified = new CompareActionBuilder("CompareVerified")
            .comparisonValue("$.External.verified")
            .when(equalsCondition("true"), "CheckGreetingPersonalization")
            .onError("CheckVerifyRetry", "NoMatchingCondition")
            .build();
        // Allow one retry before locking. verifyAttempt starts unset (falsy);
        // after the first failure we set it to "2" so the second failure locks.
        const checkVerifyRetry = new CompareActionBuilder("CheckVerifyRetry")
            .comparisonValue("$.Attributes.verifyAttempt")
            .when(equalsCondition("2"), "VerifyLockedLanguageCheck")
            .onError("IncrementVerifyAttempt", "NoMatchingCondition")
            .build();
        const incrementVerifyAttempt = new UpdateContactAttributesActionBuilder("IncrementVerifyAttempt")
            .attribute("verifyAttempt", "2")
            .next("VerifyRetryLanguageCheck")
            .build();
        const verifyRetryLanguageCheck = new CompareActionBuilder("VerifyRetryLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "VerifyRetrySpanish")
            .onError("VerifyRetryEnglish", "NoMatchingCondition")
            .build();
        const verifyRetryEnglish = new GetParticipantInputActionBuilder("VerifyRetryEnglish")
            .text("That didn't match our records. Please try again — enter your 8-digit date of birth.")
            .inputTimeLimitSeconds(15)
            .onError("StoreVerifyInput", "NoMatchingCondition")
            .onError("StoreVerifyInput", "InputTimeLimitExceeded")
            .onError("StoreVerifyInput")
            .build();
        const verifyRetrySpanish = new GetParticipantInputActionBuilder("VerifyRetrySpanish")
            .text("Eso no coincide con nuestros registros. Por favor intente de nuevo — ingrese su fecha de nacimiento de 8 dígitos.")
            .inputTimeLimitSeconds(15)
            .onError("StoreVerifyInput", "NoMatchingCondition")
            .onError("StoreVerifyInput", "InputTimeLimitExceeded")
            .onError("StoreVerifyInput")
            .build();
        const verifyLockedLanguageCheck = new CompareActionBuilder("VerifyLockedLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "VerifyLockedSpanish")
            .onError("VerifyLockedEnglish", "NoMatchingCondition")
            .build();
        const verifyLockedEnglish = new MessageParticipantActionBuilder("VerifyLockedEnglish")
            .text("We were unable to verify your identity. For your security, please call back " +
            "or visit our website to confirm your account information.")
            .next("Disconnect")
            .build();
        const verifyLockedSpanish = new MessageParticipantActionBuilder("VerifyLockedSpanish")
            .text("No pudimos verificar su identidad. Por su seguridad, por favor llame de nuevo " +
            "o visite nuestro sitio web para confirmar la información de su cuenta.")
            .next("Disconnect")
            .build();
        // ── Greeting ──────────────────────────────────────────────────────────────
        // Personalized for identified callers, generic otherwise.
        const checkGreetingPersonalization = new CompareActionBuilder("CheckGreetingPersonalization")
            .comparisonValue("$.Attributes.callerIdentified")
            .when(equalsCondition("true"), "GreetingPersonalized")
            .onError("GreetingGeneric", "NoMatchingCondition")
            .build();
        const greetingPersonalized = new MessageParticipantActionBuilder("GreetingPersonalized")
            .text("Welcome back, $.Customer.FirstName.")
            .next("SetIntentPromptLanguage")
            .build();
        const greetingGeneric = new MessageParticipantActionBuilder("GreetingGeneric")
            .text("Welcome to Mini Connect.")
            .next("SetIntentPromptLanguage")
            .build();
        // ── Section 2: Intent capture ─────────────────────────────────────────────
        // Language branch → Lex intent prompt → SetIntentXxx → module dispatch
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
        const intentPromptEnglish = intentBranches("IntentRetryLanguageCheck")(new ConnectParticipantWithLexBotActionBuilder("IntentPromptEnglish")
            .text("How can I help you today? You can say things like: check my claim status, benefits question, prior authorization, find a provider, prescription help, check eligibility, or billing question.")
            .lexV2BotAliasArn(context.refs.lexBotAliasArn("mainInbound"))
            .sessionAttribute("x-amz-lex:locale-id", "en_US")).build();
        const intentPromptSpanish = intentBranches("IntentRetryLanguageCheck")(new ConnectParticipantWithLexBotActionBuilder("IntentPromptSpanish")
            .text("¿Cómo puedo ayudarle hoy? Puede decir: estado de reclamación, pregunta sobre beneficios, autorización previa, buscar proveedor, ayuda con receta, verificar elegibilidad, o pregunta de facturación.")
            .lexV2BotAliasArn(context.refs.lexBotAliasArn("mainInbound"))
            .sessionAttribute("x-amz-lex:locale-id", "es_US")).build();
        // ── Intent re-prompt (DTMF fallback on Lex no-match) ─────────────────────
        // One retry with a numbered DTMF menu. Second failure routes to member services.
        const intentRetryLanguageCheck = new CompareActionBuilder("IntentRetryLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "IntentRetrySpanish")
            .onError("IntentRetryEnglish", "NoMatchingCondition")
            .build();
        const intentRetryEnglish = new GetParticipantInputActionBuilder("IntentRetryEnglish")
            .text("I didn't catch that. Press 1 for claims, 2 for billing, 3 for prescriptions, " +
            "4 for providers, 5 for eligibility, or press 0 to speak with a representative.")
            .inputTimeLimitSeconds(10)
            .when(equalsCondition("1"), "SetIntentClaims")
            .when(equalsCondition("2"), "SetIntentBilling")
            .when(equalsCondition("3"), "SetIntentPrescription")
            .when(equalsCondition("4"), "SetIntentProviderLookup")
            .when(equalsCondition("5"), "SetIntentEligibility")
            .when(equalsCondition("0"), "CheckCallerIdentified")
            .onError("CheckCallerIdentified", "InputTimeLimitExceeded")
            .onError("CheckCallerIdentified", "NoMatchingCondition")
            .onError("CheckCallerIdentified")
            .build();
        const intentRetrySpanish = new GetParticipantInputActionBuilder("IntentRetrySpanish")
            .text("No entendí su solicitud. Oprima 1 para reclamaciones, 2 para facturación, 3 para recetas, " +
            "4 para proveedores, 5 para elegibilidad, o oprima 0 para hablar con un representante.")
            .inputTimeLimitSeconds(10)
            .when(equalsCondition("1"), "SetIntentClaims")
            .when(equalsCondition("2"), "SetIntentBilling")
            .when(equalsCondition("3"), "SetIntentPrescription")
            .when(equalsCondition("4"), "SetIntentProviderLookup")
            .when(equalsCondition("5"), "SetIntentEligibility")
            .when(equalsCondition("0"), "CheckCallerIdentified")
            .onError("CheckCallerIdentified", "InputTimeLimitExceeded")
            .onError("CheckCallerIdentified", "NoMatchingCondition")
            .onError("CheckCallerIdentified")
            .build();
        // ── Section 3: Module dispatch ────────────────────────────────────────────
        // One SetIntentXxx + InvokeXxxModule pair per intent.
        // All modules signal agent-needed via needsTransfer=true → CheckNeedsTransfer.
        // Module errors skip directly to CheckCallerIdentified (queue routing).
        const setIntentClaims = new UpdateContactAttributesActionBuilder("SetIntentClaims")
            .attribute("callReason", "claims_status")
            .attribute("slotClaimNumber", "$.Lex.Slots.ClaimNumber")
            .attribute("slotDateOfService", "$.Lex.Slots.DateOfService")
            .next("InvokeClaimsModule")
            .build();
        const invokeClaimsModule = new InvokeFlowModuleActionBuilder("InvokeClaimsModule")
            .flowModuleId(context.refs.flowId("claimsModule"))
            .next("CheckNeedsTransfer")
            .onError("CheckCallerIdentified")
            .build();
        const setIntentBenefits = new UpdateContactAttributesActionBuilder("SetIntentBenefits")
            .attribute("callReason", "benefits_inquiry")
            .attribute("slotServiceType", "$.Lex.Slots.ServiceType")
            .next("BenefitsTransferLanguageCheck")
            .build();
        // Benefits has no backend data — play a bridge and route directly to queue.
        const benefitsTransferLanguageCheck = new CompareActionBuilder("BenefitsTransferLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "BenefitsTransferSpanish")
            .onError("BenefitsTransferEnglish", "NoMatchingCondition")
            .build();
        const benefitsTransferEnglish = new MessageParticipantActionBuilder("BenefitsTransferEnglish")
            .text("Let me connect you with a benefits specialist.")
            .next("CheckCallerIdentified")
            .build();
        const benefitsTransferSpanish = new MessageParticipantActionBuilder("BenefitsTransferSpanish")
            .text("Permítame conectarlo con un especialista en beneficios.")
            .next("CheckCallerIdentified")
            .build();
        const setIntentPriorAuth = new UpdateContactAttributesActionBuilder("SetIntentPriorAuth")
            .attribute("callReason", "prior_authorization")
            .attribute("slotProcedureCode", "$.Lex.Slots.ProcedureCode")
            .attribute("slotProviderName", "$.Lex.Slots.ProviderName")
            .next("InvokePriorAuthModule")
            .build();
        const invokePriorAuthModule = new InvokeFlowModuleActionBuilder("InvokePriorAuthModule")
            .flowModuleId(context.refs.flowId("priorAuthModule"))
            .next("CheckNeedsTransfer")
            .onError("CheckCallerIdentified")
            .build();
        const setIntentProviderLookup = new UpdateContactAttributesActionBuilder("SetIntentProviderLookup")
            .attribute("callReason", "provider_lookup")
            .attribute("slotSpecialty", "$.Lex.Slots.Specialty")
            .attribute("slotZipCode", "$.Lex.Slots.ZipCode")
            .attribute("slotProviderName", "$.Lex.Slots.ProviderName")
            .next("InvokeProviderModule")
            .build();
        const invokeProviderModule = new InvokeFlowModuleActionBuilder("InvokeProviderModule")
            .flowModuleId(context.refs.flowId("providerModule"))
            .next("CheckNeedsTransfer")
            .onError("CheckCallerIdentified")
            .build();
        const setIntentPrescription = new UpdateContactAttributesActionBuilder("SetIntentPrescription")
            .attribute("callReason", "prescription")
            .attribute("slotMedicationName", "$.Lex.Slots.MedicationName")
            .next("InvokeFormularyModule")
            .build();
        const invokeFormularyModule = new InvokeFlowModuleActionBuilder("InvokeFormularyModule")
            .flowModuleId(context.refs.flowId("formularyModule"))
            .next("CheckNeedsTransfer")
            .onError("CheckCallerIdentified")
            .build();
        const setIntentEligibility = new UpdateContactAttributesActionBuilder("SetIntentEligibility")
            .attribute("callReason", "eligibility")
            .next("CheckEligibilityIdentified")
            .build();
        // Eligibility reads coverageStatus from ANI lookup — unidentified callers have no data.
        const checkEligibilityIdentified = new CompareActionBuilder("CheckEligibilityIdentified")
            .comparisonValue("$.Attributes.callerIdentified")
            .when(equalsCondition("true"), "InvokeEligibilityModule")
            .onError("EligibilityUnidentifiedLanguageCheck", "NoMatchingCondition")
            .build();
        const eligibilityUnidentifiedLanguageCheck = new CompareActionBuilder("EligibilityUnidentifiedLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "EligibilityUnidentifiedSpanish")
            .onError("EligibilityUnidentifiedEnglish", "NoMatchingCondition")
            .build();
        const eligibilityUnidentifiedEnglish = new MessageParticipantActionBuilder("EligibilityUnidentifiedEnglish")
            .text("I wasn't able to find your account by phone number. Let me connect you with a " +
            "representative who can verify your identity and check your coverage.")
            .next("CheckCallerIdentified")
            .build();
        const eligibilityUnidentifiedSpanish = new MessageParticipantActionBuilder("EligibilityUnidentifiedSpanish")
            .text("No pude encontrar su cuenta por número de teléfono. Permítame conectarlo con un " +
            "representante que pueda verificar su identidad y revisar su cobertura.")
            .next("CheckCallerIdentified")
            .build();
        const invokeEligibilityModule = new InvokeFlowModuleActionBuilder("InvokeEligibilityModule")
            .flowModuleId(context.refs.flowId("eligibilityModule"))
            .next("CheckNeedsTransfer")
            .onError("CheckCallerIdentified")
            .build();
        const setIntentBilling = new UpdateContactAttributesActionBuilder("SetIntentBilling")
            .attribute("callReason", "billing")
            .attribute("slotInvoiceNumber", "$.Lex.Slots.InvoiceNumber")
            .next("InvokeBillingModule")
            .build();
        const invokeBillingModule = new InvokeFlowModuleActionBuilder("InvokeBillingModule")
            .flowModuleId(context.refs.flowId("billingModule"))
            .next("CheckNeedsTransfer")
            .onError("CheckCallerIdentified")
            .build();
        // ── Section 4: Post-module routing ────────────────────────────────────────
        // needsTransfer check → caller name → transfer bridge → screen pop → queue transfer
        // Modules set needsTransfer=true when the caller needs an agent.
        // Caller chose to end from an offer-transfer prompt → Disconnect.
        const checkNeedsTransfer = new CompareActionBuilder("CheckNeedsTransfer")
            .comparisonValue("$.Attributes.needsTransfer")
            .when(equalsCondition("true"), "CheckCallerIdentified")
            .onError("Disconnect", "NoMatchingCondition")
            .build();
        // Set callerName for the agent screen pop.
        // callerIdentified=true only when LookupByPhone succeeded.
        const checkCallerIdentified = new CompareActionBuilder("CheckCallerIdentified")
            .comparisonValue("$.Attributes.callerIdentified")
            .when(equalsCondition("true"), "SetCallerName")
            .onError("SetCallerNameUnknown", "NoMatchingCondition")
            .build();
        const setCallerName = new UpdateContactAttributesActionBuilder("SetCallerName")
            .attribute("callerName", "$.Customer.FirstName $.Customer.LastName")
            .next("TransferBridgeLanguageCheck")
            .build();
        const setCallerNameUnknown = new UpdateContactAttributesActionBuilder("SetCallerNameUnknown")
            .attribute("callerName", "Unidentified Member")
            .next("TransferBridgeLanguageCheck")
            .build();
        // Bridge message between self-service result and hold music.
        const transferBridgeLanguageCheck = new CompareActionBuilder("TransferBridgeLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "TransferBridgeSpanish")
            .onError("TransferBridgeEnglish", "NoMatchingCondition")
            .build();
        const transferBridgeEnglish = new MessageParticipantActionBuilder("TransferBridgeEnglish")
            .text("Please hold while I connect you with a specialist.")
            .next("RouteToQueue")
            .build();
        const transferBridgeSpanish = new MessageParticipantActionBuilder("TransferBridgeSpanish")
            .text("Por favor espere mientras le conecto con un especialista.")
            .next("RouteToQueue")
            .build();
        // Route to the ShowView screen pop for the caller's intent, then to the
        // matching domain queue. Unrecognized paths land in member-services.
        const routeToQueue = new CompareActionBuilder("RouteToQueue")
            .comparisonValue("$.Attributes.callReason")
            .when(equalsCondition("claims_status"), "ShowClaimsView")
            .when(equalsCondition("billing"), "ShowBillingView")
            .when(equalsCondition("prescription"), "ShowFormularyView")
            .when(equalsCondition("prior_authorization"), "ShowPriorAuthView")
            .when(equalsCondition("provider_lookup"), "ShowProviderView")
            .when(equalsCondition("eligibility"), "ShowEligibilityView")
            .when(equalsCondition("benefits_inquiry"), "ShowBenefitsView")
            .onError("SetMemberServicesQueueFlow", "NoMatchingCondition")
            .build();
        // Agent screen pop via AWS-managed Detail view. Fires at answer time.
        // All outcomes (action selected or error) continue to queue setup.
        const buildShowView = (id, heading, intentItems, resultItems, nextBlock) => new ShowViewActionBuilder(id)
            .viewResource("detail", "$LATEST")
            .invocationTimeLimitSeconds(2)
            .viewData("Heading", heading)
            .viewData("AttributeBar", JSON.stringify([
            { Label: "Caller", Value: "$.Attributes.callerName" },
            { Label: "Member ID", Value: "$.Attributes.memberId" },
            { Label: "Plan", Value: "$.Attributes.planId" },
            { Label: "Coverage", Value: "$.Attributes.coverageStatus" },
            { Label: "Language", Value: "$.Attributes.preferredLanguage" },
        ]))
            .viewData("Sections", JSON.stringify([
            { Heading: "Caller Intent", Type: "DataSection", Items: intentItems },
            { Heading: "Lookup Result", Type: "DataSection", Items: resultItems },
        ]))
            .viewData("Actions", JSON.stringify(["Transfer", "End Call"]))
            .when(equalsCondition("Transfer"), nextBlock)
            .when(equalsCondition("End Call"), nextBlock)
            .onError(nextBlock, "NoMatchingCondition")
            .onError(nextBlock, "TimeLimitExceeded")
            .onError(nextBlock)
            .build();
        const showClaimsView = buildShowView("ShowClaimsView", "Claims Status", [
            { Label: "Call Reason", Value: "$.Attributes.callReason" },
            { Label: "Claim Number", Value: "$.Attributes.slotClaimNumber" },
            { Label: "Date of Service", Value: "$.Attributes.slotDateOfService" },
        ], [
            { Label: "Status", Value: "$.Attributes.externalStatus" },
            { Label: "Billed Amount", Value: "$.Attributes.externalBilledAmount" },
            { Label: "Paid Amount", Value: "$.Attributes.externalPaidAmount" },
            { Label: "Denial Reason", Value: "$.Attributes.externalDenialReason" },
            { Label: "Date of Service", Value: "$.Attributes.externalDateOfService" },
            { Label: "Lookup Attempted", Value: "$.Attributes.lookupAttempted" },
            { Label: "Lookup Result", Value: "$.Attributes.lookupResult" },
        ], "SetClaimsQueueFlow");
        const showBillingView = buildShowView("ShowBillingView", "Billing Inquiry", [
            { Label: "Call Reason", Value: "$.Attributes.callReason" },
            { Label: "Invoice Number", Value: "$.Attributes.slotInvoiceNumber" },
        ], [
            { Label: "Status", Value: "$.Attributes.externalStatus" },
            { Label: "Amount", Value: "$.Attributes.externalAmount" },
            { Label: "Date Issued", Value: "$.Attributes.externalDateIssued" },
            { Label: "Due Date", Value: "$.Attributes.externalDueDate" },
            { Label: "Description", Value: "$.Attributes.externalDescription" },
            { Label: "Lookup Attempted", Value: "$.Attributes.lookupAttempted" },
            { Label: "Lookup Result", Value: "$.Attributes.lookupResult" },
        ], "SetBillingQueueFlow");
        const showFormularyView = buildShowView("ShowFormularyView", "Prescription Formulary", [
            { Label: "Call Reason", Value: "$.Attributes.callReason" },
            { Label: "Medication Name", Value: "$.Attributes.slotMedicationName" },
        ], [
            { Label: "Medication", Value: "$.Attributes.externalMedicationName" },
            { Label: "Covered", Value: "$.Attributes.externalCovered" },
            { Label: "Tier", Value: "$.Attributes.externalTier" },
            { Label: "Copay", Value: "$.Attributes.externalCopay" },
            { Label: "Requires Prior Auth", Value: "$.Attributes.externalRequiresPriorAuth" },
            { Label: "Lookup Attempted", Value: "$.Attributes.lookupAttempted" },
            { Label: "Lookup Result", Value: "$.Attributes.lookupResult" },
        ], "SetPharmacyQueueFlow");
        const showProviderView = buildShowView("ShowProviderView", "Provider Network Lookup", [
            { Label: "Call Reason", Value: "$.Attributes.callReason" },
            { Label: "Provider Name", Value: "$.Attributes.slotProviderName" },
            { Label: "Specialty", Value: "$.Attributes.slotSpecialty" },
            { Label: "Zip Code", Value: "$.Attributes.slotZipCode" },
        ], [
            { Label: "Name", Value: "$.Attributes.externalName" },
            { Label: "Phone", Value: "$.Attributes.externalPhone" },
            { Label: "In-Network", Value: "$.Attributes.externalInNetwork" },
            { Label: "Lookup Attempted", Value: "$.Attributes.lookupAttempted" },
            { Label: "Lookup Result", Value: "$.Attributes.lookupResult" },
        ], "SetProviderQueueFlow");
        const showPriorAuthView = buildShowView("ShowPriorAuthView", "Prior Authorization", [
            { Label: "Call Reason", Value: "$.Attributes.callReason" },
            { Label: "Procedure Code", Value: "$.Attributes.slotProcedureCode" },
            { Label: "Provider Name", Value: "$.Attributes.slotProviderName" },
        ], [
            { Label: "Covered", Value: "$.Attributes.externalCovered" },
            { Label: "Requires Prior Auth", Value: "$.Attributes.externalRequiresPriorAuth" },
            { Label: "Description", Value: "$.Attributes.externalDescription" },
            { Label: "Lookup Attempted", Value: "$.Attributes.lookupAttempted" },
            { Label: "Lookup Result", Value: "$.Attributes.lookupResult" },
        ], "SetPharmacyQueueFlow");
        const showEligibilityView = buildShowView("ShowEligibilityView", "Eligibility Check", [
            { Label: "Call Reason", Value: "$.Attributes.callReason" },
        ], [
            { Label: "Coverage Status", Value: "$.Attributes.coverageStatus" },
            { Label: "Member ID", Value: "$.Attributes.memberId" },
            { Label: "Plan", Value: "$.Attributes.planId" },
        ], "SetMemberServicesQueueFlow");
        const showBenefitsView = buildShowView("ShowBenefitsView", "Benefits Inquiry", [
            { Label: "Call Reason", Value: "$.Attributes.callReason" },
            { Label: "Service Type", Value: "$.Attributes.slotServiceType" },
        ], [], "SetMemberServicesQueueFlow");
        // ── Section 5: Queue setup ────────────────────────────────────────────────
        // SetXxxQueueFlow → SetXxxQueue → TransferToQueue (shared)
        // Each pair sets the domain hold experience and queue ARN.
        const setClaimsQueueFlow = new SetCustomerQueueFlowActionBuilder("SetClaimsQueueFlow")
            .customerQueueFlowArn(context.refs.flowArn("claimsQueueExperience"))
            .next("SetClaimsQueue")
            .onError("Disconnect")
            .build();
        const setClaimsQueue = new UpdateContactTargetQueueActionBuilder("SetClaimsQueue")
            .queueId(context.refs.queueArn("claims"))
            .next("TransferToQueue")
            .onError("Disconnect")
            .build();
        const setBillingQueueFlow = new SetCustomerQueueFlowActionBuilder("SetBillingQueueFlow")
            .customerQueueFlowArn(context.refs.flowArn("billingQueueExperience"))
            .next("SetBillingQueue")
            .onError("Disconnect")
            .build();
        const setBillingQueue = new UpdateContactTargetQueueActionBuilder("SetBillingQueue")
            .queueId(context.refs.queueArn("billing"))
            .next("TransferToQueue")
            .onError("Disconnect")
            .build();
        const setPharmacyQueueFlow = new SetCustomerQueueFlowActionBuilder("SetPharmacyQueueFlow")
            .customerQueueFlowArn(context.refs.flowArn("pharmacyQueueExperience"))
            .next("SetPharmacyQueue")
            .onError("Disconnect")
            .build();
        const setPharmacyQueue = new UpdateContactTargetQueueActionBuilder("SetPharmacyQueue")
            .queueId(context.refs.queueArn("pharmacy"))
            .next("TransferToQueue")
            .onError("Disconnect")
            .build();
        const setProviderQueueFlow = new SetCustomerQueueFlowActionBuilder("SetProviderQueueFlow")
            .customerQueueFlowArn(context.refs.flowArn("providerQueueExperience"))
            .next("SetProviderQueue")
            .onError("Disconnect")
            .build();
        const setProviderQueue = new UpdateContactTargetQueueActionBuilder("SetProviderQueue")
            .queueId(context.refs.queueArn("provider"))
            .next("TransferToQueue")
            .onError("Disconnect")
            .build();
        const setMemberServicesQueueFlow = new SetCustomerQueueFlowActionBuilder("SetMemberServicesQueueFlow")
            .customerQueueFlowArn(context.refs.flowArn("memberServicesQueueExperience"))
            .next("SetMemberServicesQueue")
            .onError("Disconnect")
            .build();
        const setMemberServicesQueue = new UpdateContactTargetQueueActionBuilder("SetMemberServicesQueue")
            .queueId(context.refs.queueArn("memberServices"))
            .next("TransferToQueue")
            .onError("Disconnect")
            .build();
        const queueAtCapacityLanguageCheck = new CompareActionBuilder("QueueAtCapacityLanguageCheck")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "QueueAtCapacitySpanish")
            .onError("QueueAtCapacityEnglish", "NoMatchingCondition")
            .build();
        const queueAtCapacityEnglish = new MessageParticipantActionBuilder("QueueAtCapacityEnglish")
            .text("We're sorry, all of our representatives are currently busy. Please call back during business hours and we will be happy to assist you.")
            .next("Disconnect")
            .build();
        const queueAtCapacitySpanish = new MessageParticipantActionBuilder("QueueAtCapacitySpanish")
            .text("Lo sentimos, todos nuestros representantes están ocupados en este momento. Por favor llame de vuelta durante el horario de atención y con gusto le ayudaremos.")
            .next("Disconnect")
            .build();
        const transfer = new TransferContactToQueueActionBuilder("TransferToQueue")
            .next("Disconnect")
            .onError("QueueAtCapacityLanguageCheck", "QueueAtCapacity")
            .onError("Disconnect")
            .build();
        const disconnect = new DisconnectParticipantActionBuilder("Disconnect").build();
        // ── Flow assembly ─────────────────────────────────────────────────────────
        return new FlowBuilder("MainInbound")
            // Section 1: Call setup
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
            .add(setCallerIdentified)
            // Second-factor verification
            .add(verifyIdentityCheck)
            .add(verifyDobPromptLanguageCheck)
            .add(verifyDobPromptEnglish)
            .add(verifyDobPromptSpanish)
            .add(storeVerifyInput)
            .add(invokeIdentityVerify)
            .add(compareVerified)
            .add(checkVerifyRetry)
            .add(incrementVerifyAttempt)
            .add(verifyRetryLanguageCheck)
            .add(verifyRetryEnglish)
            .add(verifyRetrySpanish)
            .add(verifyLockedLanguageCheck)
            .add(verifyLockedEnglish)
            .add(verifyLockedSpanish)
            // Greeting
            .add(checkGreetingPersonalization)
            .add(greetingPersonalized)
            .add(greetingGeneric)
            // Section 2: Intent capture
            .add(setIntentPromptLanguage)
            .add(intentPromptEnglish)
            .add(intentPromptSpanish)
            // Intent re-prompt
            .add(intentRetryLanguageCheck)
            .add(intentRetryEnglish)
            .add(intentRetrySpanish)
            // Section 3: Module dispatch
            .add(setIntentClaims)
            .add(invokeClaimsModule)
            .add(setIntentBenefits)
            .add(benefitsTransferLanguageCheck)
            .add(benefitsTransferEnglish)
            .add(benefitsTransferSpanish)
            .add(setIntentPriorAuth)
            .add(invokePriorAuthModule)
            .add(setIntentProviderLookup)
            .add(invokeProviderModule)
            .add(setIntentPrescription)
            .add(invokeFormularyModule)
            .add(setIntentEligibility)
            .add(checkEligibilityIdentified)
            .add(eligibilityUnidentifiedLanguageCheck)
            .add(eligibilityUnidentifiedEnglish)
            .add(eligibilityUnidentifiedSpanish)
            .add(invokeEligibilityModule)
            .add(setIntentBilling)
            .add(invokeBillingModule)
            // Section 4: Post-module routing
            .add(checkNeedsTransfer)
            .add(checkCallerIdentified)
            .add(setCallerName)
            .add(setCallerNameUnknown)
            .add(transferBridgeLanguageCheck)
            .add(transferBridgeEnglish)
            .add(transferBridgeSpanish)
            .add(routeToQueue)
            .add(showClaimsView)
            .add(showBillingView)
            .add(showFormularyView)
            .add(showProviderView)
            .add(showPriorAuthView)
            .add(showEligibilityView)
            .add(showBenefitsView)
            // Section 5: Queue setup
            .add(setClaimsQueueFlow)
            .add(setClaimsQueue)
            .add(setBillingQueueFlow)
            .add(setBillingQueue)
            .add(setPharmacyQueueFlow)
            .add(setPharmacyQueue)
            .add(setProviderQueueFlow)
            .add(setProviderQueue)
            .add(setMemberServicesQueueFlow)
            .add(setMemberServicesQueue)
            .add(transfer)
            .add(queueAtCapacityLanguageCheck)
            .add(queueAtCapacityEnglish)
            .add(queueAtCapacitySpanish)
            .add(disconnect)
            .build();
    },
};
