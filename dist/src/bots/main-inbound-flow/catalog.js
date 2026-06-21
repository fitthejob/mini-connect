import { intents } from "./intents.js";
import { slotTypes } from "./slot-types.js";
export const mainInboundBotCatalog = {
    name: "MainInboundBot",
    locales: ["en_US", "es_US"],
    nluConfidenceThreshold: 0.7,
    slotTypes,
    intents,
};
