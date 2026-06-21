export interface SlotValue {
  value: string;
}

export interface SlotTypeValue {
  sampleValue: SlotValue;
  synonyms: SlotValue[];
}

export interface BotSlotType {
  name: string;
  slotTypeValues: SlotTypeValue[];
  valueSelectionSetting: {
    resolutionStrategy: "TOP_RESOLUTION" | "ORIGINAL_VALUE";
  };
}

export interface SlotPrompt {
  localeId: string;
  value: string;
}

export interface BotSlot {
  name: string;
  slotTypeName: string;
  constraint: "Required" | "Optional";
  prompts: SlotPrompt[];
}

export interface BotUtterance {
  localeId: string;
  utterances: string[];
}

export interface BotIntent {
  name: string;
  utterances: BotUtterance[];
  slots?: BotSlot[];
}

export interface BotCatalog {
  name: string;
  locales: string[];
  nluConfidenceThreshold: number;
  intents: BotIntent[];
  slotTypes?: BotSlotType[];
}
