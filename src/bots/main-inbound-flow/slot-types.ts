import type { BotSlotType } from "../types.js";

export const slotTypes: BotSlotType[] = [
  {
    name: "ServiceTypeSlotType",
    slotTypeValues: [
      {
        sampleValue: { value: "DENTAL" },
        synonyms: [
          { value: "dental" },
          { value: "teeth" },
          { value: "tooth" },
          { value: "dentista" },
          { value: "dientes" },
        ],
      },
      {
        sampleValue: { value: "VISION" },
        synonyms: [
          { value: "vision" },
          { value: "eye" },
          { value: "glasses" },
          { value: "lenses" },
          { value: "visión" },
          { value: "ojo" },
          { value: "lentes" },
        ],
      },
      {
        sampleValue: { value: "PRESCRIPTION" },
        synonyms: [
          { value: "prescription" },
          { value: "medication" },
          { value: "drug" },
          { value: "meds" },
          { value: "receta" },
          { value: "medicamento" },
          { value: "medicina" },
        ],
      },
      {
        sampleValue: { value: "MEDICAL" },
        synonyms: [
          { value: "medical" },
          { value: "doctor" },
          { value: "physician" },
          { value: "médico" },
          { value: "médica" },
        ],
      },
      {
        sampleValue: { value: "MENTAL_HEALTH" },
        synonyms: [
          { value: "mental health" },
          { value: "therapy" },
          { value: "counseling" },
          { value: "salud mental" },
          { value: "terapia" },
          { value: "consejería" },
        ],
      },
    ],
    valueSelectionSetting: { resolutionStrategy: "TOP_RESOLUTION" },
  },
  {
    name: "MedicalSpecialtySlotType",
    slotTypeValues: [
      {
        sampleValue: { value: "PRIMARY_CARE" },
        synonyms: [
          { value: "primary care" },
          { value: "family doctor" },
          { value: "general practitioner" },
          { value: "médico de cabecera" },
          { value: "médico general" },
          { value: "médico familiar" },
        ],
      },
      {
        sampleValue: { value: "CARDIOLOGY" },
        synonyms: [
          { value: "cardiology" },
          { value: "heart doctor" },
          { value: "cardiologist" },
          { value: "cardiología" },
          { value: "cardiólogo" },
          { value: "médico del corazón" },
        ],
      },
      {
        sampleValue: { value: "ORTHOPEDICS" },
        synonyms: [
          { value: "orthopedics" },
          { value: "bone doctor" },
          { value: "orthopedist" },
          { value: "ortopedia" },
          { value: "ortopedista" },
          { value: "médico de huesos" },
        ],
      },
      {
        sampleValue: { value: "DERMATOLOGY" },
        synonyms: [
          { value: "dermatology" },
          { value: "skin doctor" },
          { value: "dermatologist" },
          { value: "dermatología" },
          { value: "dermatólogo" },
          { value: "médico de la piel" },
        ],
      },
      {
        sampleValue: { value: "MENTAL_HEALTH" },
        synonyms: [
          { value: "psychiatry" },
          { value: "therapist" },
          { value: "counselor" },
          { value: "psiquiatría" },
          { value: "terapeuta" },
          { value: "consejero" },
        ],
      },
    ],
    valueSelectionSetting: { resolutionStrategy: "TOP_RESOLUTION" },
  },
];
