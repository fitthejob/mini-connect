import { CompareActionBuilder, DisconnectParticipantActionBuilder, FlowBuilder, MessageParticipantActionBuilder, UpdateContactTextToSpeechVoiceActionBuilder, equalsCondition, } from "connect-flow-builder";
export const supportQueueExperienceSpec = {
    key: "supportQueueExperience",
    name: "SupportQueueExperience",
    type: "CUSTOMER_QUEUE",
    filename: "support-queue-experience.json",
    description: "Customer queue flow for the support queue experience.",
    build: () => {
        // Voice is not inherited from the inbound flow — must be set again here
        const checkLanguage = new CompareActionBuilder("CheckLanguage")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "SetVoiceSpanish")
            .onError("SetVoiceEnglish", "NoMatchingCondition")
            .onError("SetVoiceEnglish")
            .build();
        const setVoiceEnglish = new UpdateContactTextToSpeechVoiceActionBuilder("SetVoiceEnglish")
            .voice("Joanna")
            .engine("neural")
            .next("QueuedPromptEnglish")
            .build();
        const setVoiceSpanish = new UpdateContactTextToSpeechVoiceActionBuilder("SetVoiceSpanish")
            .voice("Lupe")
            .engine("neural")
            .next("QueuedPromptSpanish")
            .build();
        const queuedPromptEnglish = new MessageParticipantActionBuilder("QueuedPromptEnglish")
            .text("Please hold while we connect you to the next available agent.")
            .next("Disconnect")
            .build();
        const queuedPromptSpanish = new MessageParticipantActionBuilder("QueuedPromptSpanish")
            .text("Por favor espere mientras lo conectamos con el siguiente agente disponible.")
            .next("Disconnect")
            .build();
        const disconnect = new DisconnectParticipantActionBuilder("Disconnect").build();
        return new FlowBuilder("SupportQueueExperience")
            .startWith(checkLanguage)
            .add(setVoiceEnglish)
            .add(setVoiceSpanish)
            .add(queuedPromptEnglish)
            .add(queuedPromptSpanish)
            .add(disconnect)
            .build();
    },
};
