import {
  CompareActionBuilder,
  FlowBuilder,
  MessageParticipantIterativelyActionBuilder,
  UpdateContactTextToSpeechVoiceActionBuilder,
  equalsCondition,
  type FlowSpec,
} from "connect-flow-builder";

export const providerQueueExperienceSpec: FlowSpec = {
  key: "providerQueueExperience",
  name: "ProviderQueueExperience",
  type: "CUSTOMER_QUEUE",
  filename: "provider-queue-experience.json",
  description: "Hold experience for the provider network lookup queue.",
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
      .addText("We are happy to assist you with your provider search. A member services representative will be with you shortly. Please continue to hold.")
      .build();

    const holdLoopSpanish = new MessageParticipantIterativelyActionBuilder("HoldLoopSpanish")
      .addText("Nos da gusto ayudarle con su búsqueda de proveedores. Un representante de servicios para miembros lo atenderá en breve. Por favor, espere un momento.")
      .build();

    return new FlowBuilder("ProviderQueueExperience")
      .startWith(checkLanguage)
      .add(setVoiceEnglish)
      .add(setVoiceSpanish)
      .add(holdLoopEnglish)
      .add(holdLoopSpanish)
      .build();
  },
};
