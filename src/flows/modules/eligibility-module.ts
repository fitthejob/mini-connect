import {
  CompareActionBuilder,
  EndFlowModuleExecutionActionBuilder,
  FlowBuilder,
  GetParticipantInputActionBuilder,
  MessageParticipantActionBuilder,
  UpdateContactAttributesActionBuilder,
  equalsCondition,
  type FlowSpec,
} from "connect-flow-builder";

export const eligibilityModuleSpec: FlowSpec = {
  key: "eligibilityModule",
  name: "EligibilityModule",
  type: "CONTACT_FLOW_MODULE",
  filename: "eligibility-module.json",
  description: "Eligibility self-service — reads coverageStatus from ANI lookup, reads back status, offers transfer.",
  build: () => {
    const languageCheck = new CompareActionBuilder("EligibilityLanguageCheck")
      .comparisonValue("$.Attributes.preferredLanguage")
      .when(equalsCondition("es"), "CheckCoverageStatusSpanish")
      .onError("CheckCoverageStatusEnglish", "NoMatchingCondition")
      .build();

    const checkCoverageStatusEnglish = new CompareActionBuilder("CheckCoverageStatusEnglish")
      .comparisonValue("$.Customer.Attributes.coverageStatus")
      .when(equalsCondition("ACTIVE"),    "EligibilityActiveEnglish")
      .when(equalsCondition("SUSPENDED"), "EligibilitySuspendedEnglish")
      .when(equalsCondition("PENDING"),   "EligibilityPendingEnglish")
      .onError("EligibilityUnknownEnglish", "NoMatchingCondition")
      .build();

    const checkCoverageStatusSpanish = new CompareActionBuilder("CheckCoverageStatusSpanish")
      .comparisonValue("$.Customer.Attributes.coverageStatus")
      .when(equalsCondition("ACTIVE"),    "EligibilityActiveSpanish")
      .when(equalsCondition("SUSPENDED"), "EligibilitySuspendedSpanish")
      .when(equalsCondition("PENDING"),   "EligibilityPendingSpanish")
      .onError("EligibilityUnknownSpanish", "NoMatchingCondition")
      .build();

    const activeEnglish = new MessageParticipantActionBuilder("EligibilityActiveEnglish")
      .text("Your coverage is currently active. You have full access to your benefits under your current plan.")
      .next("OfferTransferEligibilityEnglish")
      .build();

    const suspendedEnglish = new MessageParticipantActionBuilder("EligibilitySuspendedEnglish")
      .text("Your coverage is currently suspended. Please speak with a representative for assistance.")
      .next("SetNeedsTransfer")
      .build();

    const pendingEnglish = new MessageParticipantActionBuilder("EligibilityPendingEnglish")
      .text("Your coverage is currently pending. It may take a few business days to become active.")
      .next("OfferTransferEligibilityEnglish")
      .build();

    const unknownEnglish = new MessageParticipantActionBuilder("EligibilityUnknownEnglish")
      .text("We were unable to locate your eligibility information. Let me connect you with a representative.")
      .next("SetNeedsTransfer")
      .build();

    const activeSpanish = new MessageParticipantActionBuilder("EligibilityActiveSpanish")
      .text("Su cobertura está actualmente activa. Tiene acceso completo a sus beneficios bajo su plan actual.")
      .next("OfferTransferEligibilitySpanish")
      .build();

    const suspendedSpanish = new MessageParticipantActionBuilder("EligibilitySuspendedSpanish")
      .text("Su cobertura está actualmente suspendida. Por favor hable con un representante para obtener ayuda.")
      .next("SetNeedsTransfer")
      .build();

    const pendingSpanish = new MessageParticipantActionBuilder("EligibilityPendingSpanish")
      .text("Su cobertura está actualmente pendiente. Puede tardar algunos días hábiles en activarse.")
      .next("OfferTransferEligibilitySpanish")
      .build();

    const unknownSpanish = new MessageParticipantActionBuilder("EligibilityUnknownSpanish")
      .text("No pudimos encontrar su información de elegibilidad. Permítame conectarlo con un representante.")
      .next("SetNeedsTransfer")
      .build();

    const offerTransferEnglish = new GetParticipantInputActionBuilder("OfferTransferEligibilityEnglish")
      .text("If you have additional questions, press 1 to speak with a representative. Press 2 to end the call.")
      .inputTimeLimitSeconds(8)
      .when(equalsCondition("1"), "SetNeedsTransfer")
      .when(equalsCondition("2"), "EndModule")
      .onError("SetNeedsTransfer", "InputTimeLimitExceeded")
      .onError("SetNeedsTransfer", "NoMatchingCondition")
      .onError("SetNeedsTransfer")
      .build();

    const offerTransferSpanish = new GetParticipantInputActionBuilder("OfferTransferEligibilitySpanish")
      .text("Si tiene preguntas adicionales, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada.")
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

    return new FlowBuilder("EligibilityModule")
      .startWith(languageCheck)
      .add(checkCoverageStatusEnglish)
      .add(checkCoverageStatusSpanish)
      .add(activeEnglish)
      .add(suspendedEnglish)
      .add(pendingEnglish)
      .add(unknownEnglish)
      .add(activeSpanish)
      .add(suspendedSpanish)
      .add(pendingSpanish)
      .add(unknownSpanish)
      .add(offerTransferEnglish)
      .add(offerTransferSpanish)
      .add(setNeedsTransfer)
      .add(endModule)
      .build();
  },
};
