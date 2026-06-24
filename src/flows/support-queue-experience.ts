import {
  CompareActionBuilder,
  FlowBuilder,
  MessageParticipantIterativelyActionBuilder,
  UpdateContactTextToSpeechVoiceActionBuilder,
  equalsCondition,
  type FlowSpec,
} from "connect-flow-builder";

export const supportQueueExperienceSpec: FlowSpec = {
  key: "supportQueueExperience",
  name: "SupportQueueExperience",
  type: "CUSTOMER_QUEUE",
  filename: "support-queue-experience.json",
  description: "Customer queue flow for the support queue experience.",
  build: () => {
    // Voice is not inherited from the inbound flow — must be re-set here
    const checkLanguage = new CompareActionBuilder("CheckLanguage")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "SetVoiceSpanish")
      .onError("SetVoiceEnglish", "NoMatchingCondition")
      .build();

    const setVoiceEnglish = new UpdateContactTextToSpeechVoiceActionBuilder(
      "SetVoiceEnglish",
    )
      .voice("Joanna")
      .engine("neural")
      .next("HoldLoopEnglish")
      .build();

    const setVoiceSpanish = new UpdateContactTextToSpeechVoiceActionBuilder(
      "SetVoiceSpanish",
    )
      .voice("Lupe")
      .engine("neural")
      .next("HoldLoopSpanish")
      .build();

    // MessageParticipantIteratively loops the hold message until an agent answers
    const holdLoopEnglish = new MessageParticipantIterativelyActionBuilder(
      "HoldLoopEnglish",
    )
      .addText(
        "Please hold while we connect you with the next available member services representative.",
      )
      .build();

    const holdLoopSpanish = new MessageParticipantIterativelyActionBuilder(
      "HoldLoopSpanish",
    )
      .addText(
        "Por favor espere mientras le conectamos con el siguiente representante de servicios para miembros.",
      )
      .build();

    return new FlowBuilder("SupportQueueExperience")
      .startWith(checkLanguage)
      .add(setVoiceEnglish)
      .add(setVoiceSpanish)
      .add(holdLoopEnglish)
      .add(holdLoopSpanish)
      .build();
  },
};
