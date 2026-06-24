import {
  CompareActionBuilder,
  FlowBuilder,
  MessageParticipantIterativelyActionBuilder,
  UpdateContactTextToSpeechVoiceActionBuilder,
  equalsCondition,
  type FlowSpec,
} from "connect-flow-builder";

export const pharmacyQueueExperienceSpec: FlowSpec = {
  key: "pharmacyQueueExperience",
  name: "PharmacyQueueExperience",
  type: "CUSTOMER_QUEUE",
  filename: "pharmacy-queue-experience.json",
  description: "Hold experience for the pharmacy queue (prescriptions and prior authorization).",
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
      .addText("We are happy to assist you with your prescription. A pharmacy specialist will be with you shortly. Please continue to hold.")
      .build();

    const holdLoopSpanish = new MessageParticipantIterativelyActionBuilder("HoldLoopSpanish")
      .addText("Nos da gusto ayudarle con su receta médica. Un especialista en farmacia lo atenderá en breve. Por favor, espere un momento.")
      .build();

    return new FlowBuilder("PharmacyQueueExperience")
      .startWith(checkLanguage)
      .add(setVoiceEnglish)
      .add(setVoiceSpanish)
      .add(holdLoopEnglish)
      .add(holdLoopSpanish)
      .build();
  },
};
