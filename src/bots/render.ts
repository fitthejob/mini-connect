import type { BotCatalog } from "./types.js";

export function renderBotLocales(catalog: BotCatalog): object[] {
  return catalog.locales.map((localeId) => {
    const voice = catalog.voiceSettings?.[localeId];
    return {
      localeId,
      nluConfidenceThreshold: catalog.nluConfidenceThreshold,
      ...(voice !== undefined && {
        voiceSettings: {
          voiceId: voice.voiceId,
          engine: voice.engine,
        },
      }),
      slotTypes: catalog.slotTypes?.map((st) => ({
        name: st.name,
        slotTypeValues: st.slotTypeValues,
        valueSelectionSetting: st.valueSelectionSetting,
      })),
      intents: catalog.intents.map((intent) => ({
        name: intent.name,
        ...(intent.name === "FallbackIntent"
          ? { parentIntentSignature: "AMAZON.FallbackIntent" }
          : {
              sampleUtterances:
                intent.utterances
                  .find((u) => u.localeId === localeId)
                  ?.utterances.map((utterance) => ({ utterance })) ?? [],
              slots: intent.slots?.map((slot) => ({
                name: slot.name,
                slotTypeName: slot.slotTypeName,
                valueElicitationSetting: {
                  slotConstraint: slot.constraint,
                  promptSpecification: {
                    maxRetries: 2,
                    messageGroupsList: [
                      {
                        message: {
                          plainTextMessage: {
                            value:
                              slot.prompts.find((p) => p.localeId === localeId)
                                ?.value ?? "",
                          },
                        },
                      },
                    ],
                  },
                },
              })),
            }),
      })),
    };
  });
}
