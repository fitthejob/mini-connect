import {
  CompareActionBuilder,
  FlowBuilder,
  MessageParticipantIterativelyActionBuilder,
  UpdateContactTextToSpeechVoiceActionBuilder,
  equalsCondition,
  type FlowSpec,
} from "connect-flow-builder";

export const billingQueueExperienceSpec: FlowSpec = {
  key: "billingQueueExperience",
  name: "BillingQueueExperience",
  type: "CUSTOMER_QUEUE",
  filename: "billing-queue-experience.json",
  description: "Hold experience for the billing queue.",
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
      .addText("We are happy to assist you with your billing question. A billing specialist will be with you shortly. Please continue to hold.")
      .build();

    const holdLoopSpanish = new MessageParticipantIterativelyActionBuilder("HoldLoopSpanish")
      .addText("Nos da gusto ayudarle con su consulta de facturación. Un especialista en facturación lo atenderá en breve. Por favor, espere un momento.")
      .build();

    return new FlowBuilder("BillingQueueExperience")
      .startWith(checkLanguage)
      .add(setVoiceEnglish)
      .add(setVoiceSpanish)
      .add(holdLoopEnglish)
      .add(holdLoopSpanish)
      .build();
  },
};
