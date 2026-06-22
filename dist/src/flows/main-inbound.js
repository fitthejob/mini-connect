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
            .onError("LookupByPhone")
            .build();
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
            .add(setSupportQueueFlow)
            .add(setWorkingQueue)
            .add(transfer)
            .add(disconnect)
            .build();
    },
};
