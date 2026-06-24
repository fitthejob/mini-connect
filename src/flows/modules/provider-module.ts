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
      .next("ProviderSetLookupAttempted")
      .build();

    const bridgeSpanish = new MessageParticipantActionBuilder("ProviderLookupBridgeSpanish")
      .text("Un momento mientras verifico su red.")
      .next("ProviderSetLookupAttempted")
      .build();

    const setLookupAttempted = new UpdateContactAttributesActionBuilder("ProviderSetLookupAttempted")
      .attribute("lookupAttempted", "true")
      .next("InvokeProviderLookup")
      .build();

    const invokeLambda = new InvokeLambdaFunctionActionBuilder("InvokeProviderLookup")
      .lambdaArn(context.refs.lambdaArn("providerLookup"))
      .next("CompareProviderFound")
      .onError("ProviderSetLookupError")
      .build();

    const setLookupError = new UpdateContactAttributesActionBuilder("ProviderSetLookupError")
      .attribute("lookupResult", "error")
      .next("ProviderErrorLanguageCheck")
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

    // Lambda returns missingSlot="true" when neither provider name nor specialty+zip was captured.
    const compareFound = new CompareActionBuilder("CompareProviderFound")
      .comparisonValue("$.External.found")
      .when(equalsCondition("true"), "PersistProviderResults")
      .onError("CompareProviderMissingSlot", "NoMatchingCondition")
      .build();

    const compareMissingSlot = new CompareActionBuilder("CompareProviderMissingSlot")
      .comparisonValue("$.External.missingSlot")
      .when(equalsCondition("true"), "ProviderMissingSlotLanguageCheck")
      .onError("ProviderSetLookupNotFound", "NoMatchingCondition")
      .build();

    const missingSlotLanguageCheck = new CompareActionBuilder("ProviderMissingSlotLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProviderMissingSlotSpanish")
      .onError("ProviderMissingSlotEnglish", "NoMatchingCondition")
      .build();

    const missingSlotEnglish = new MessageParticipantActionBuilder("ProviderMissingSlotEnglish")
      .text("To search for a provider, I'll need either the provider's name or their specialty and zip code. Let me connect you with a representative who can help.")
      .next("SetNeedsTransfer")
      .build();

    const missingSlotSpanish = new MessageParticipantActionBuilder("ProviderMissingSlotSpanish")
      .text("Para buscar un proveedor, necesito el nombre del proveedor o su especialidad y código postal. Permítame conectarlo con un representante que pueda ayudarle.")
      .next("SetNeedsTransfer")
      .build();

    const setLookupNotFound = new UpdateContactAttributesActionBuilder("ProviderSetLookupNotFound")
      .attribute("lookupResult", "not_found")
      .next("ProviderNotFoundLanguageCheck")
      .build();

    const persistResults = new UpdateContactAttributesActionBuilder("PersistProviderResults")
      .attribute("externalName", "$.External.name")
      .attribute("externalPhone", "$.External.phone")
      .attribute("externalInNetwork", "$.External.inNetwork")
      .next("ProviderFoundLanguageCheck")
      .build();

    const foundLanguageCheck = new CompareActionBuilder("ProviderFoundLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "ProviderFoundSpanish")
      .onError("ProviderFoundEnglish", "NoMatchingCondition")
      .build();

    // Phone number only — addresses over TTS are not useful to callers.
    const foundEnglish = new MessageParticipantActionBuilder("ProviderFoundEnglish")
      .text("$.External.name is in your plan's network. Their phone number is $.External.phone.")
      .next("OfferTransferProviderEnglish")
      .build();

    const foundSpanish = new MessageParticipantActionBuilder("ProviderFoundSpanish")
      .text("$.External.name está en la red de su plan. Su número de teléfono es $.External.phone.")
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
      .text("Press 1 to speak with a representative for more information about this provider. Press 2 to end the call.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetNeedsTransfer")
      .when(equalsCondition("2"), "EndModule")
      .onError("SetNeedsTransfer", "InputTimeLimitExceeded")
      .onError("SetNeedsTransfer", "NoMatchingCondition")
      .onError("SetNeedsTransfer")
      .build();

    const offerTransferSpanish = new GetParticipantInputActionBuilder("OfferTransferProviderSpanish")
      .text("Oprima 1 para hablar con un representante para obtener más información sobre este proveedor. Oprima 2 para terminar la llamada.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetNeedsTransfer")
      .when(equalsCondition("2"), "EndModule")
      .onError("SetNeedsTransfer", "InputTimeLimitExceeded")
      .onError("SetNeedsTransfer", "NoMatchingCondition")
      .onError("SetNeedsTransfer")
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
      .add(setLookupAttempted)
      .add(invokeLambda)
      .add(setLookupError)
      .add(errorLanguageCheck)
      .add(errorEnglish)
      .add(errorSpanish)
      .add(compareFound)
      .add(compareMissingSlot)
      .add(missingSlotLanguageCheck)
      .add(missingSlotEnglish)
      .add(missingSlotSpanish)
      .add(setLookupNotFound)
      .add(persistResults)
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
