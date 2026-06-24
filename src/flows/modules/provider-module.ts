import {
  CompareActionBuilder,
  EndFlowModuleExecutionActionBuilder,
  FlowBuilder,
  GetParticipantInputActionBuilder,
  InvokeLambdaFunctionActionBuilder,
  MessageParticipantActionBuilder,
  UpdateContactAttributesActionBuilder,
  equalsCondition,
  type FlowSpec,
} from "connect-flow-builder";

export const providerModuleSpec: FlowSpec = {
  key: "providerModule",
  name: "ProviderModule",
  type: "CONTACT_FLOW_MODULE",
  filename: "provider-module.json",
  description: "Provider network lookup self-service — invokes ProviderLookup Lambda, confirms in-network status.",
  build: (context) => {
    const languageCheck = new CompareActionBuilder("ProviderLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProviderLookupBridgeSpanish")
      .onError("ProviderLookupBridgeEnglish", "NoMatchingCondition")
      .build();

    const bridgeEnglish = new MessageParticipantActionBuilder("ProviderLookupBridgeEnglish")
      .text("One moment while I check your network.")
      .next("InvokeProviderLookup")
      .build();

    const bridgeSpanish = new MessageParticipantActionBuilder("ProviderLookupBridgeSpanish")
      .text("Un momento mientras verifico su red.")
      .next("InvokeProviderLookup")
      .build();

    const invokeLambda = new InvokeLambdaFunctionActionBuilder("InvokeProviderLookup")
      .lambdaArn(context.refs.lambdaArn("providerLookup"))
      .next("CompareProviderFound")
      .onError("ProviderErrorLanguageCheck")
      .build();

    const errorLanguageCheck = new CompareActionBuilder("ProviderErrorLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProviderLookupErrorSpanish")
      .onError("ProviderLookupErrorEnglish", "NoMatchingCondition")
      .build();

    const errorEnglish = new MessageParticipantActionBuilder("ProviderLookupErrorEnglish")
      .text("I'm having trouble checking provider network status right now. Let me connect you with a representative.")
      .next("SetNeedsTransfer")
      .build();

    const errorSpanish = new MessageParticipantActionBuilder("ProviderLookupErrorSpanish")
      .text("Tengo problemas para verificar el estado de la red de proveedores. Permítame conectarlo con un representante.")
      .next("SetNeedsTransfer")
      .build();

    const compareFound = new CompareActionBuilder("CompareProviderFound")
      .comparisonValue("$.External.found")
      .when(equalsCondition("true"), "ProviderFoundLanguageCheck")
      .onError("ProviderNotFoundLanguageCheck", "NoMatchingCondition")
      .build();

    const foundLanguageCheck = new CompareActionBuilder("ProviderFoundLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProviderFoundSpanish")
      .onError("ProviderFoundEnglish", "NoMatchingCondition")
      .build();

    // Phone number only — addresses over TTS are not useful to callers.
    const foundEnglish = new MessageParticipantActionBuilder("ProviderFoundEnglish")
      .text("$.External.name is in-network for your plan. Their phone number is $.External.phone. I can connect you with a representative to schedule an appointment or send you more details.")
      .next("OfferTransferProviderEnglish")
      .build();

    const foundSpanish = new MessageParticipantActionBuilder("ProviderFoundSpanish")
      .text("$.External.name está en la red de su plan. Su número de teléfono es $.External.phone. Puedo conectarlo con un representante para programar una cita o enviarle más detalles.")
      .next("OfferTransferProviderSpanish")
      .build();

    const notFoundLanguageCheck = new CompareActionBuilder("ProviderNotFoundLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProviderNotFoundSpanish")
      .onError("ProviderNotFoundEnglish", "NoMatchingCondition")
      .build();

    const notFoundEnglish = new MessageParticipantActionBuilder("ProviderNotFoundEnglish")
      .text("That provider isn't currently in-network for your plan. I can connect you with a representative who can help you find an in-network alternative.")
      .next("SetNeedsTransfer")
      .build();

    const notFoundSpanish = new MessageParticipantActionBuilder("ProviderNotFoundSpanish")
      .text("Ese proveedor no está actualmente en la red de su plan. Puedo conectarlo con un representante que le ayude a encontrar una alternativa en la red.")
      .next("SetNeedsTransfer")
      .build();

    const offerTransferEnglish = new GetParticipantInputActionBuilder("OfferTransferProviderEnglish")
      .text("Press 1 to speak with a representative. Press 2 to end the call.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetNeedsTransfer")
      .when(equalsCondition("2"), "EndModule")
      .onError("EndModule", "InputTimeLimitExceeded")
      .onError("EndModule", "NoMatchingCondition")
      .onError("EndModule")
      .build();

    const offerTransferSpanish = new GetParticipantInputActionBuilder("OfferTransferProviderSpanish")
      .text("Oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetNeedsTransfer")
      .when(equalsCondition("2"), "EndModule")
      .onError("EndModule", "InputTimeLimitExceeded")
      .onError("EndModule", "NoMatchingCondition")
      .onError("EndModule")
      .build();

    const setNeedsTransfer = new UpdateContactAttributesActionBuilder("SetNeedsTransfer")
      .attribute("needsTransfer", "true")
      .next("EndModule")
      .build();

    const endModule = new EndFlowModuleExecutionActionBuilder("EndModule").build();

    return new FlowBuilder("ProviderModule")
      .startWith(languageCheck)
      .add(bridgeEnglish)
      .add(bridgeSpanish)
      .add(invokeLambda)
      .add(errorLanguageCheck)
      .add(errorEnglish)
      .add(errorSpanish)
      .add(compareFound)
      .add(foundLanguageCheck)
      .add(foundEnglish)
      .add(foundSpanish)
      .add(notFoundLanguageCheck)
      .add(notFoundEnglish)
      .add(notFoundSpanish)
      .add(offerTransferEnglish)
      .add(offerTransferSpanish)
      .add(setNeedsTransfer)
      .add(endModule)
      .build();
  },
};
