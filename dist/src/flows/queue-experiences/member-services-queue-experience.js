import { CompareActionBuilder, FlowBuilder, MessageParticipantIterativelyActionBuilder, UpdateContactTextToSpeechVoiceActionBuilder, equalsCondition, } from "connect-flow-builder";
export const memberServicesQueueExperienceSpec = {
    key: "memberServicesQueueExperience",
    name: "MemberServicesQueueExperience",
    type: "CUSTOMER_QUEUE",
    filename: "member-services-queue-experience.json",
    description: "Hold experience for the member services queue (eligibility, benefits, and general inquiries).",
    build: () => {
        const checkLanguage = new CompareActionBuilder("CheckLanguage")
            .comparisonValue("$.Attributes.preferredLanguage")
            .when(equalsCondition("es"), "SetVoiceSpanish")
            .onError("SetVoiceEnglish", "NoMatchingCondition")
            .build();
        const setVoiceEnglish = new UpdateContactTextToSpeechVoiceActionBuilder("SetVoiceEnglish")
            .voice("Joanna")
            .engine("neural")
            .next("HoldLoopEnglish")
            .build();
        const setVoiceSpanish = new UpdateContactTextToSpeechVoiceActionBuilder("SetVoiceSpanish")
            .voice("Lupe")
            .engine("neural")
            .next("HoldLoopSpanish")
            .build();
        const holdLoopEnglish = new MessageParticipantIterativelyActionBuilder("HoldLoopEnglish")
            .addText("We are happy to assist you. A member services representative will be with you shortly. Please continue to hold.")
            .build();
        const holdLoopSpanish = new MessageParticipantIterativelyActionBuilder("HoldLoopSpanish")
            .addText("Nos da gusto ayudarle. Un representante de servicios para miembros lo atenderá en breve. Por favor, espere un momento.")
            .build();
        return new FlowBuilder("MemberServicesQueueExperience")
            .startWith(checkLanguage)
            .add(setVoiceEnglish)
            .add(setVoiceSpanish)
            .add(holdLoopEnglish)
            .add(holdLoopSpanish)
            .build();
    },
};
