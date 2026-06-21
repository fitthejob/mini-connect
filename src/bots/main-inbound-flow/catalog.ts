import type { BotCatalog } from "../types.js";
import { intents } from "./intents.js";
import { slotTypes } from "./slot-types.js";

export const mainInboundBotCatalog: BotCatalog = {
  name: "MainInboundBot",
  locales: ["en_US", "es_US"],
  nluConfidenceThreshold: 0.7,
  slotTypes,
  intents,
};
