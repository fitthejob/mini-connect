import {
  CompareActionBuilder,
  FlowBuilder,
  MessageParticipantIterativelyActionBuilder,
  UpdateContactTextToSpeechVoiceActionBuilder,
  equalsCondition,
  type FlowSpec,
} from "connect-flow-builder";

export const claimsQueueExperienceSpec: FlowSpec = {
  key: "claimsQueueExperience",
  name: "ClaimsQueueExperience",
  type: "CUSTOMER_QUEUE",
  filename: "claims-queue-experience.json",
  description: "Hold experience for the claims queue.",
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
      .addText("We are happy to assist you with your claim. A claims specialist will be with you shortly. Please continue to hold.")
      .build();

    const holdLoopSpanish = new MessageParticipantIterativelyActionBuilder("HoldLoopSpanish")
      .addText("Nos da gusto ayudarle con su reclamo. Un especialista en reclamos lo atenderá en breve. Por favor, espere un momento.")
      .build();

    return new FlowBuilder("ClaimsQueueExperience")
      .startWith(checkLanguage)
      .add(setVoiceEnglish)
      .add(setVoiceSpanish)
      .add(holdLoopEnglish)
      .add(holdLoopSpanish)
      .build();
  },
};
