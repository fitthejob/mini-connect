import { SUPPORTED_CONDITION_OPERATORS } from "./conditions.js";
import { getActionDefinition } from "./registry.js";
import type {
  CheckVoiceIdOption,
  CheckMetricDataMetricType,
  CompleteOutboundCallVoiceConnector,
  ContactEventHookType,
  FlowAction,
  FlowCondition,
  FlowDefinition,
  FlowLoggingBehavior,
  LoadContactContentType,
  LoopOperand,
  MessageLoopContent,
  OutboundCallStatusOperand,
  PersistentContactRehydrationType,
  PreviousContactParticipantState,
  RoutingCriteriaAttributeCondition,
  RoutingCriteriaObject,
  RoutingCriteriaStep,
  WaitEvent,
} from "./types.js";

const CHECK_METRIC_DATA_METRIC_TYPES = new Set<CheckMetricDataMetricType>([
  "NumberOfAgentsAvailable",
  "NumberOfAgentsStaffed",
  "NumberOfAgentsOnline",
  "OldestContactInQueueAgeSeconds",
  "NumberOfContactsInQueue",
]);

const STAFFING_METRIC_TYPES = new Set<CheckMetricDataMetricType>([
  "NumberOfAgentsAvailable",
  "NumberOfAgentsStaffed",
  "NumberOfAgentsOnline",
]);

const WAIT_EVENTS = new Set<WaitEvent>([
  "CustomerReturned",
  "BotParticipantDisconnected",
]);

const FLOW_LOGGING_BEHAVIORS = new Set<FlowLoggingBehavior>([
  "Enabled",
  "Disabled",
]);

const QUEUE_CHANNELS = new Set(["Voice", "Chat"]);
const OUTBOUND_CALL_STATUS_OPERANDS = new Set<OutboundCallStatusOperand>([
  "CallAnswered",
  "VoicemailBeep",
  "VoicemailNoBeep",
  "NotDetected",
]);
const CHECK_VOICE_ID_OPTIONS = new Set<CheckVoiceIdOption>([
  "enrollmentStatus",
  "voiceAuthentication",
  "fraudDetection",
]);
const ENROLLMENT_STATUS_RESULTS = new Set([
  "Enrolled",
  "Not enrolled",
  "Opted out",
]);
const VOICE_AUTHENTICATION_RESULTS = new Set([
  "Authenticated",
  "Not authenticated",
  "Inconclusive",
  "Not enrolled",
  "Opted out",
]);
const FRAUD_DETECTION_RESULTS = new Set([
  "High risk",
  "Low risk",
  "Inconclusive",
]);
const PREVIOUS_CONTACT_PARTICIPANT_STATES = new Set<PreviousContactParticipantState>([
  "AgentOnHold",
  "CustomerOnHold",
  "OffHold",
]);
const PERSISTENT_CONTACT_REHYDRATION_TYPES =
  new Set<PersistentContactRehydrationType>([
    "ENTIRE_PAST_SESSION",
    "FROM_SEGMENT",
  ]);
const LOAD_CONTACT_CONTENT_TYPES = new Set<LoadContactContentType>([
  "EmailMessage",
]);
const MEDIA_STREAMING_STATES = new Set(["Enabled", "Disabled"]);
const MEDIA_DIRECTIONS = new Set(["From", "To"]);
const CONTACT_TARGETS = new Set(["Current", "Related"]);
const LOOP_OPERANDS = new Set<LoopOperand>(["ContinueLooping", "DoneLooping"]);

const CONTACT_EVENT_HOOK_TYPES = new Set<ContactEventHookType>([
  "AgentHold",
  "AgentWhisper",
  "CustomerHold",
  "CustomerQueue",
  "CustomerRemaining",
  "CustomerWhisper",
  "DefaultAgentUI",
  "DisconnectAgentUI",
  "PauseContact",
  "ResumeContact",
]);
const AUTHENTICATE_PARTICIPANT_OPERANDS = new Set(["OptedOut"]);

export function validateFlowDefinition(flow: FlowDefinition): void {
  const actionIds = new Set(flow.actions.map((action) => action.id));

  if (!flow.startAction) {
    throw new Error("Flow definition must include a start action.");
  }
  if (!actionIds.has(flow.startAction)) {
    throw new Error(`Start action "${flow.startAction}" does not exist in the flow.`);
  }

  validateDuplicateIds(flow.actions);
  validateTransitions(flow.actions, actionIds);
  validateActionParameters(flow.actions);
}

function validateDuplicateIds(actions: FlowAction[]): void {
  const seen = new Set<string>();
  for (const action of actions) {
    if (seen.has(action.id)) {
      throw new Error(`Duplicate action id "${action.id}" detected.`);
    }
    seen.add(action.id);
  }
}

function validateTransitions(actions: FlowAction[], actionIds: Set<string>): void {
  for (const action of actions) {
    if (action.transitions?.nextAction && !actionIds.has(action.transitions.nextAction)) {
      throw new Error(
        `Action "${action.id}" references missing next action "${action.transitions.nextAction}".`,
      );
    }

    for (const error of action.transitions?.errors ?? []) {
      if (!actionIds.has(error.nextAction)) {
        throw new Error(
          `Action "${action.id}" references missing error action "${error.nextAction}".`,
        );
      }
    }

    for (const condition of action.transitions?.conditions ?? []) {
      if (!actionIds.has(condition.nextAction)) {
        throw new Error(
          `Action "${action.id}" references missing conditional action "${condition.nextAction}".`,
        );
      }
      validateConditionExpression(action.id, condition.condition.operator, condition.condition.operands);
    }
  }
}

function validateActionParameters(actions: FlowAction[]): void {
  for (const action of actions) {
    const definition = getActionDefinition(action.type);
    for (const parameter of definition.requiredParameters) {
      requireParameter(action, parameter);
    }
    validateActionSpecificConstraints(action);
  }
}

function requireParameter(action: FlowAction, key: string): void {
  if (!(key in action.parameters)) {
    throw new Error(`Action "${action.id}" of type "${action.type}" requires parameter "${key}".`);
  }
}

function validateConditionExpression(
  actionId: string,
  operator: string,
  operands: string[],
): void {
  if (!SUPPORTED_CONDITION_OPERATORS.includes(operator as typeof SUPPORTED_CONDITION_OPERATORS[number])) {
    throw new Error(`Action "${actionId}" uses unsupported condition operator "${operator}".`);
  }
  if (operands.length !== 1) {
    throw new Error(
      `Action "${actionId}" condition operator "${operator}" requires exactly one operand.`,
    );
  }
}

function validateActionSpecificConstraints(action: FlowAction): void {
  switch (action.type) {
    case "AuthenticateParticipant":
      validateAuthenticateParticipantAction(action);
      break;
    case "AssociateContactToCustomerProfile":
      validateAssociateContactToCustomerProfileAction(action);
      break;
    case "CheckOutboundCallStatus":
      validateCheckOutboundCallStatusAction(action);
      break;
    case "CheckVoiceId":
      validateCheckVoiceIdAction(action);
      break;
    case "ConnectParticipantWithLexBot":
      validateConnectParticipantWithLexBotAction(action);
      break;
    case "CompleteOutboundCall":
      validateCompleteOutboundCallAction(action);
      break;
    case "CreateCase":
      validateCreateCaseAction(action);
      break;
    case "CreateCallbackContact":
      validateCreateCallbackContactAction(action);
      break;
    case "CreatePersistentContactAssociation":
      validateCreatePersistentContactAssociationAction(action);
      break;
    case "CreateCustomerProfile":
      validateCreateCustomerProfileAction(action);
      break;
    case "CreateTask":
      validateCreateTaskAction(action);
      break;
    case "CreateWisdomSession":
      validateCreateWisdomSessionAction(action);
      break;
    case "Compare":
      validateCompareAction(action);
      break;
    case "CheckHoursOfOperation":
      validateCheckHoursOfOperationAction(action);
      break;
    case "CheckMetricData":
      validateCheckMetricDataAction(action);
      break;
    case "DistributeByPercentage":
      validateDistributeByPercentageAction(action);
      break;
    case "DequeueContactAndTransferToQueue":
      validateDequeueContactAndTransferToQueueAction(action);
      break;
    case "EndFlowExecution":
      validateEndFlowExecutionAction(action);
      break;
    case "EndFlowModuleExecution":
      validateEndFlowModuleExecutionAction(action);
      break;
    case "EvaluateDataTableValues":
      validateEvaluateDataTableValuesAction(action);
      break;
    case "GetCase":
      validateGetCaseAction(action);
      break;
    case "GetCalculatedAttributesForCustomerProfile":
      validateGetCalculatedAttributesForCustomerProfileAction(action);
      break;
    case "GetParticipantInput":
      validateGetParticipantInputAction(action);
      break;
    case "LoadContactContent":
      validateLoadContactContentAction(action);
      break;
    case "GetCustomerProfile":
      validateGetCustomerProfileAction(action);
      break;
    case "GetCustomerProfileObject":
      validateGetCustomerProfileObjectAction(action);
      break;
    case "ListDataTableValues":
      validateListDataTableValuesAction(action);
      break;
    case "GetMetricData":
      validateGetMetricDataAction(action);
      break;
    case "InvokeFlowModule":
      validateInvokeFlowModuleAction(action);
      break;
    case "Loop":
      validateLoopAction(action);
      break;
    case "MessageParticipantIteratively":
      validateMessageParticipantIterativelyAction(action);
      break;
    case "ResumeContact":
      validateResumeContactAction(action);
      break;
    case "ShowView":
      validateShowViewAction(action);
      break;
    case "StartOutboundChatContact":
      validateStartOutboundChatContactAction(action);
      break;
    case "StartVoiceIdStream":
      validateStartVoiceIdStreamAction(action);
      break;
    case "TagContact":
      validateTagContactAction(action);
      break;
    case "TransferContactToAgent":
      validateTransferContactToAgentAction(action);
      break;
    case "TransferContactToQueue":
      validateTransferContactToQueueAction(action);
      break;
    case "TransferParticipantToThirdParty":
      validateTransferParticipantToThirdPartyAction(action);
      break;
    case "TransferToFlow":
      validateTransferToFlowAction(action);
      break;
    case "UnTagContact":
      validateUnTagContactAction(action);
      break;
    case "UpsertDataTableValues":
      validateUpsertDataTableValuesAction(action);
      break;
    case "UpdateContactCallbackNumber":
      validateUpdateContactCallbackNumberAction(action);
      break;
    case "UpdateContactData":
      validateUpdateContactDataAction(action);
      break;
    case "UpdateContactEventHooks":
      validateUpdateContactEventHooksAction(action);
      break;
    case "UpdateContactMediaProcessing":
      validateUpdateContactMediaProcessingAction(action);
      break;
    case "UpdateContactMediaStreamingBehavior":
      validateUpdateContactMediaStreamingBehaviorAction(action);
      break;
    case "UpdatePreviousContactParticipantState":
      validateUpdatePreviousContactParticipantStateAction(action);
      break;
    case "UpdateContactRecordingAndAnalyticsBehavior":
      validateUpdateContactRecordingAndAnalyticsBehaviorAction(action);
      break;
    case "UpdateContactRoutingBehavior":
      validateUpdateContactRoutingBehaviorAction(action);
      break;
    case "UpdateContactTargetQueue":
      validateUpdateContactTargetQueueAction(action);
      break;
    case "UpdateContactTextToSpeechVoice":
      validateUpdateContactTextToSpeechVoiceAction(action);
      break;
    case "UpdateCase":
      validateUpdateCaseAction(action);
      break;
    case "UpdateFlowAttributes":
      validateUpdateFlowAttributesAction(action);
      break;
    case "UpdateFlowLoggingBehavior":
      validateUpdateFlowLoggingBehaviorAction(action);
      break;
    case "UpdateRoutingCriteria":
      validateUpdateRoutingCriteriaAction(action);
      break;
    case "UpdateCustomerProfile":
      validateUpdateCustomerProfileAction(action);
      break;
    case "Wait":
      validateWaitAction(action);
      break;
    default:
      break;
  }
}

function validateCompareAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "ComparisonValue");

  if ((action.transitions?.conditions?.length ?? 0) === 0) {
    throw new Error(`Action "${action.id}" of type "Compare" requires at least one condition.`);
  }
}

function validateConnectParticipantWithLexBotAction(action: FlowAction): void {
  const hasLexV2Bot = isObject(action.parameters.LexV2Bot);
  const hasLexBot = isObject(action.parameters.LexBot);

  if (hasLexV2Bot === hasLexBot) {
    throw new Error(
      `Action "${action.id}" of type "ConnectParticipantWithLexBot" requires exactly one of LexV2Bot or LexBot.`,
    );
  }

  validateSinglePromptVariant(action, "ConnectParticipantWithLexBot");

  if (hasLexV2Bot) {
    const lexV2Bot = action.parameters.LexV2Bot as Record<string, unknown>;
    if (typeof lexV2Bot.AliasArn !== "string" || lexV2Bot.AliasArn.trim().length === 0) {
      throw new Error(
        `Action "${action.id}" of type "ConnectParticipantWithLexBot" requires LexV2Bot.AliasArn to be a non-empty string.`,
      );
    }
  }

  if (hasLexBot) {
    const lexBot = action.parameters.LexBot as Record<string, unknown>;
    for (const key of ["Name", "Region", "Alias"]) {
      if (typeof lexBot[key] !== "string" || (lexBot[key] as string).trim().length === 0) {
        throw new Error(
          `Action "${action.id}" of type "ConnectParticipantWithLexBot" requires LexBot.${key} to be a non-empty string.`,
        );
      }
    }
  }

  const timeout = action.parameters.LexTimeoutSeconds;
  if (timeout !== undefined) {
    if (!isObject(timeout) || !("Text" in timeout)) {
      throw new Error(
        `Action "${action.id}" of type "ConnectParticipantWithLexBot" requires LexTimeoutSeconds to be an object with Text.`,
      );
    }

    const textValue = timeout.Text;
    if (
      !(
        (typeof textValue === "number" && Number.isInteger(textValue) && textValue > 0)
        || (typeof textValue === "string" && textValue.trim().length > 0)
      )
    ) {
      throw new Error(
        `Action "${action.id}" of type "ConnectParticipantWithLexBot" requires LexTimeoutSeconds.Text to be a positive integer or a non-empty JSONPath string.`,
      );
    }
  }

  for (const condition of action.transitions?.conditions ?? []) {
    if (condition.condition.operator !== "Equals") {
      throw new Error(
        `Action "${action.id}" of type "ConnectParticipantWithLexBot" only supports Equals conditions.`,
      );
    }
  }
}

function validateEndFlowExecutionAction(action: FlowAction): void {
  if (Object.keys(action.parameters).length > 0) {
    throw new Error(
      `Action "${action.id}" of type "EndFlowExecution" does not accept parameters.`,
    );
  }
}

function validateDistributeByPercentageAction(action: FlowAction): void {
  if (Object.keys(action.parameters).length > 0) {
    throw new Error(
      `Action "${action.id}" of type "DistributeByPercentage" does not accept parameters.`,
    );
  }

  const conditions = action.transitions?.conditions ?? [];
  if (conditions.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "DistributeByPercentage" requires at least one condition.`,
    );
  }

  let previousThreshold = 0;
  for (const condition of conditions) {
    if (condition.condition.operator !== "NumberLessThan") {
      throw new Error(
        `Action "${action.id}" of type "DistributeByPercentage" only supports NumberLessThan conditions.`,
      );
    }

    const operand = Number(condition.condition.operands[0]);
    if (!Number.isInteger(operand) || operand < 1 || operand > 100) {
      throw new Error(
        `Action "${action.id}" of type "DistributeByPercentage" requires thresholds to be integers between 1 and 100.`,
      );
    }

    if (operand <= previousThreshold) {
      throw new Error(
        `Action "${action.id}" of type "DistributeByPercentage" requires thresholds to increase strictly in ascending order.`,
      );
    }

    previousThreshold = operand;
  }
}

function validateCheckOutboundCallStatusAction(action: FlowAction): void {
  if (Object.keys(action.parameters).length > 0) {
    throw new Error(
      `Action "${action.id}" of type "CheckOutboundCallStatus" does not accept parameters.`,
    );
  }

  const conditions = action.transitions?.conditions ?? [];
  if (conditions.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "CheckOutboundCallStatus" requires at least one condition.`,
    );
  }

  for (const condition of conditions) {
    if (condition.condition.operator !== "Equals") {
      throw new Error(
        `Action "${action.id}" of type "CheckOutboundCallStatus" only supports Equals conditions.`,
      );
    }

    const operand = condition.condition.operands[0] as OutboundCallStatusOperand;
    if (!OUTBOUND_CALL_STATUS_OPERANDS.has(operand)) {
      throw new Error(
        `Action "${action.id}" of type "CheckOutboundCallStatus" uses unsupported operand "${operand}".`,
      );
    }
  }

  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateCreateTaskAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "ContactFlowId");
  requireNonEmptyStringParameter(action, "Name");

  if ("Description" in action.parameters) {
    requireNonEmptyStringParameter(action, "Description");
  }

  validateStringMapParameter(action, "Attributes");
  validateStringMapParameter(action, "References");

  const hasDelaySeconds = "DelaySeconds" in action.parameters;
  const hasScheduledTime = "ScheduledTime" in action.parameters;
  if (hasDelaySeconds && hasScheduledTime) {
    throw new Error(
      `Action "${action.id}" of type "CreateTask" cannot define both DelaySeconds and ScheduledTime.`,
    );
  }

  if (hasDelaySeconds) {
    const value = action.parameters.DelaySeconds;
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 518400) {
      throw new Error(
        `Action "${action.id}" of type "CreateTask" requires DelaySeconds to be an integer between 1 and 518400.`,
      );
    }
  }

  if (hasScheduledTime) {
    requireNonEmptyStringParameter(action, "ScheduledTime");
  }

  if ("TaskTemplateId" in action.parameters) {
    requireNonEmptyStringParameter(action, "TaskTemplateId");
  }
}

function validateCreatePersistentContactAssociationAction(
  action: FlowAction,
): void {
  const rehydrationType = requireNonEmptyStringParameter(
    action,
    "RehydrationType",
  ) as PersistentContactRehydrationType;

  if (!PERSISTENT_CONTACT_REHYDRATION_TYPES.has(rehydrationType)) {
    throw new Error(
      `Action "${action.id}" of type "CreatePersistentContactAssociation" requires RehydrationType to be ENTIRE_PAST_SESSION or FROM_SEGMENT.`,
    );
  }

  requireNonEmptyStringParameter(action, "SourceContactId");
  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateLoadContactContentAction(action: FlowAction): void {
  const contentType = requireNonEmptyStringParameter(
    action,
    "ContentType",
  ) as LoadContactContentType;

  if (!LOAD_CONTACT_CONTENT_TYPES.has(contentType)) {
    throw new Error(
      `Action "${action.id}" of type "LoadContactContent" requires ContentType to be EmailMessage.`,
    );
  }

  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateGetParticipantInputAction(action: FlowAction): void {
  const hasTouchtoneBufferMode = "EnableDTMFBuffer" in action.parameters;
  const isStoreInputMode =
    action.parameters.StoreInput === "True"
    || action.parameters.StoreInput === "true";
  const hasLexBot = "LexV2Bot" in action.parameters;
  const isDtmfMode = "InputTimeLimitSeconds" in action.parameters && !hasLexBot;

  if (hasTouchtoneBufferMode) {
    validateSetTouchtoneBufferBehaviorAction(action);
    return;
  }

  if (isStoreInputMode) {
    validateStoreCustomerInputAction(action);
    return;
  }

  // Pure DTMF mode: has InputTimeLimitSeconds but no LexV2Bot.
  // Connect requires NoMatchingCondition when the block has conditional transitions.
  if (isDtmfMode) {
    if ((action.transitions?.conditions?.length ?? 0) > 0) {
      requireErrorTypes(action, ["NoMatchingCondition"]);
    }
    return;
  }

  if (hasLexBot) {
    validateLexBackedGetParticipantInputAction(action);
    return;
  }

  throw new Error(
    `Action "${action.id}" of type "GetParticipantInput" requires either the Lex-backed mode (Text plus LexV2Bot), the DTMF mode (InputTimeLimitSeconds without LexV2Bot), the stored-input mode (StoreInput with proven DTMF configuration), or the touchtone-buffer mode (EnableDTMFBuffer).`,
  );
}

function validateLexBackedGetParticipantInputAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "Text");
  requireNonEmptyStringParameter(action, "LexV2Bot");
}

function validateSetTouchtoneBufferBehaviorAction(action: FlowAction): void {
  requireErrorTypes(action, ["NoMatchingError"]);

  if ((action.transitions?.conditions?.length ?? 0) > 0) {
    throw new Error(
      `Action "${action.id}" of type "GetParticipantInput" does not support conditional transitions in the currently implemented Set Touchtone Buffer Behavior mode.`,
    );
  }

  const enableDtmfBuffer = requireNonEmptyStringParameter(
    action,
    "EnableDTMFBuffer",
  );
  if (!isConnectTrueFalseString(enableDtmfBuffer)) {
    throw new Error(
      `Action "${action.id}" of type "GetParticipantInput" requires EnableDTMFBuffer to be True, False, true, or false in the currently implemented Set Touchtone Buffer Behavior mode.`,
    );
  }

  for (const unsupportedKey of [
    "Text",
    "LexV2Bot",
    "DTMFConfiguration",
    "InputValidation",
    "InputTimeLimitSeconds",
  ] as const) {
    if (unsupportedKey in action.parameters) {
      throw new Error(
        `Action "${action.id}" of type "GetParticipantInput" does not support ${unsupportedKey} in the currently implemented Set Touchtone Buffer Behavior mode.`,
      );
    }
  }

  if (normalizeConnectTrueFalseString(enableDtmfBuffer) === "True") {
    if ("StoreInput" in action.parameters) {
      throw new Error(
        `Action "${action.id}" of type "GetParticipantInput" only supports StoreInput in Set Touchtone Buffer Behavior stop-and-clear mode.`,
      );
    }

    if ("InputEncryption" in action.parameters) {
      throw new Error(
        `Action "${action.id}" of type "GetParticipantInput" only supports InputEncryption in Set Touchtone Buffer Behavior stop-and-clear mode.`,
      );
    }

    return;
  }

  if ("StoreInput" in action.parameters) {
    const storeInput = requireNonEmptyStringParameter(action, "StoreInput");
    if (!isConnectTrueFalseString(storeInput)) {
      throw new Error(
        `Action "${action.id}" of type "GetParticipantInput" requires StoreInput to be True, False, true, or false in the currently implemented Set Touchtone Buffer Behavior mode.`,
      );
    }

    if (normalizeConnectTrueFalseString(storeInput) !== "True") {
      throw new Error(
        `Action "${action.id}" of type "GetParticipantInput" only supports StoreInput = True in the currently implemented Set Touchtone Buffer Behavior mode.`,
      );
    }
  }

  if ("InputEncryption" in action.parameters) {
    if (!("StoreInput" in action.parameters)) {
      throw new Error(
        `Action "${action.id}" of type "GetParticipantInput" requires StoreInput when InputEncryption is used in the currently implemented Set Touchtone Buffer Behavior mode.`,
      );
    }

    const inputEncryption = requireObjectParameter(action, "InputEncryption");
    requireNestedNonEmptyString(
      action,
      inputEncryption,
      "InputEncryption",
      "EncryptionKeyId",
      "GetParticipantInput",
    );
    requireNestedNonEmptyString(
      action,
      inputEncryption,
      "InputEncryption",
      "Key",
      "GetParticipantInput",
    );
  }
}

function validateStoreCustomerInputAction(action: FlowAction): void {
  requireErrorTypes(action, ["NoMatchingError"]);

  if ((action.transitions?.conditions?.length ?? 0) > 0) {
    throw new Error(
      `Action "${action.id}" of type "GetParticipantInput" does not support conditional transitions in the currently implemented Store customer input mode.`,
    );
  }

  const inputTimeLimit = requireNonEmptyStringParameter(
    action,
    "InputTimeLimitSeconds",
  );
  validatePositiveIntegerOrIntegerString(
    action,
    inputTimeLimit,
    "InputTimeLimitSeconds",
    "GetParticipantInput",
  );

  const dtmfConfiguration = requireObjectParameter(action, "DTMFConfiguration");
  const disableCancelKey = requireNestedNonEmptyString(
    action,
    dtmfConfiguration,
    "DTMFConfiguration",
    "DisableCancelKey",
    "GetParticipantInput",
  );
  if (disableCancelKey !== "True" && disableCancelKey !== "False") {
    throw new Error(
      `Action "${action.id}" of type "GetParticipantInput" requires DTMFConfiguration.DisableCancelKey to be True or False in the currently implemented Store customer input mode.`,
    );
  }

  const interdigitTimeLimit = requireNestedNonEmptyString(
    action,
    dtmfConfiguration,
    "DTMFConfiguration",
    "InterdigitTimeLimitSeconds",
    "GetParticipantInput",
  );
  validatePositiveIntegerOrIntegerString(
    action,
    interdigitTimeLimit,
    "DTMFConfiguration.InterdigitTimeLimitSeconds",
    "GetParticipantInput",
  );

  const inputValidation = requireObjectParameter(action, "InputValidation");
  const customValidation = inputValidation.CustomValidation;
  if (!isObject(customValidation)) {
    throw new Error(
      `Action "${action.id}" of type "GetParticipantInput" requires InputValidation.CustomValidation in the currently implemented Store customer input mode.`,
    );
  }

  const maximumLength = requireNestedNonEmptyString(
    action,
    customValidation,
    "InputValidation.CustomValidation",
    "MaximumLength",
    "GetParticipantInput",
  );
  validatePositiveIntegerOrIntegerString(
    action,
    maximumLength,
    "InputValidation.CustomValidation.MaximumLength",
    "GetParticipantInput",
  );
}

function validateCreateCaseAction(action: FlowAction): void {
  validateLowercaseBooleanStringParameter(action, "LinkContactToCase");
  requireNonEmptyStringParameter(action, "CaseTemplateId");
  validateStringMapParameter(action, "CaseRequestFields");
  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateCreateCustomerProfileAction(action: FlowAction): void {
  validateProfileRequestDataHasEntries(action);
  validateProfileResponseData(action);
  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateEvaluateDataTableValuesAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "DataTableId");
  requireErrorTypes(action, ["NoMatchingError"]);

  const queries = requireArrayParameter(
    action,
    "Queries",
    "EvaluateDataTableValues",
  );
  validateArrayLengthRange(
    action,
    queries,
    "Queries",
    "EvaluateDataTableValues",
    1,
    5,
  );

  const seenQueryNames = new Set<string>();
  for (const query of queries) {
    if (!isObject(query)) {
      throw new Error(
        `Action "${action.id}" of type "EvaluateDataTableValues" requires every Queries entry to be an object.`,
      );
    }

    const queryName = requireNestedNonEmptyString(
      action,
      query,
      "Queries",
      "QueryName",
      "EvaluateDataTableValues",
    );
    if (seenQueryNames.has(queryName)) {
      throw new Error(
        `Action "${action.id}" of type "EvaluateDataTableValues" requires every Queries.QueryName to be unique.`,
      );
    }
    seenQueryNames.add(queryName);

    validateNestedStringArray(
      action,
      query,
      "Attributes",
      "Queries",
      "EvaluateDataTableValues",
    );
    validateNamedPrimaryValues(
      action,
      query,
      "PrimaryValues",
      "AttributeName",
      "Queries",
      "EvaluateDataTableValues",
    );
  }
}

function validateCheckHoursOfOperationAction(action: FlowAction): void {
  const conditions = action.transitions?.conditions ?? [];

  if (conditions.length !== 2) {
    throw new Error(
      `Action "${action.id}" of type "CheckHoursOfOperation" requires exactly two conditions.`,
    );
  }

  const operandValues = new Set<string>();
  for (const condition of conditions) {
    if (condition.condition.operator !== "Equals") {
      throw new Error(
        `Action "${action.id}" of type "CheckHoursOfOperation" only supports Equals conditions.`,
      );
    }

    const operand = condition.condition.operands[0];
    if (operand !== "True" && operand !== "False") {
      throw new Error(
        `Action "${action.id}" of type "CheckHoursOfOperation" only supports Equals True and Equals False conditions.`,
      );
    }

    operandValues.add(operand);
  }

  if (!operandValues.has("True") || !operandValues.has("False")) {
    throw new Error(
      `Action "${action.id}" of type "CheckHoursOfOperation" requires one True condition and one False condition.`,
    );
  }
}

function validateCheckMetricDataAction(action: FlowAction): void {
  const metricType = requireMetricTypeParameter(action);
  const hasQueueId = "QueueId" in action.parameters;
  const hasAgentId = "AgentId" in action.parameters;
  const conditions = action.transitions?.conditions ?? [];

  if (hasQueueId && hasAgentId) {
    throw new Error(
      `Action "${action.id}" of type "CheckMetricData" cannot define both QueueId and AgentId.`,
    );
  }

  if (conditions.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "CheckMetricData" requires at least one condition.`,
    );
  }

  if (!STAFFING_METRIC_TYPES.has(metricType)) {
    return;
  }

  for (const condition of conditions) {
    validateStaffingMetricCondition(action, condition);
  }

  for (const error of action.transitions?.errors ?? []) {
    if (error.errorType === "NoMatchingCondition") {
      throw new Error(
        `Action "${action.id}" of type "CheckMetricData" does not support NoMatchingCondition for staffing metrics.`,
      );
    }
  }
}

function validateStaffingMetricCondition(
  action: FlowAction,
  condition: FlowCondition,
): void {
  if (
    condition.condition.operator !== "NumberGreaterThan"
    || condition.condition.operands[0] !== "0"
  ) {
    throw new Error(
      `Action "${action.id}" of type "CheckMetricData" only supports NumberGreaterThan 0 conditions for staffing metrics.`,
    );
  }
}

function validateMessageParticipantIterativelyAction(action: FlowAction): void {
  const messages = action.parameters.Messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "MessageParticipantIteratively" requires Messages to contain at least one entry.`,
    );
  }

  for (const message of messages) {
    validateMessageLoopContent(action, message);
  }

  const interruptFrequency = action.parameters.InterruptFrequencySeconds;
  if (
    interruptFrequency !== undefined
    && (!Number.isInteger(interruptFrequency) || (interruptFrequency as number) <= 0)
  ) {
    throw new Error(
      `Action "${action.id}" of type "MessageParticipantIteratively" requires InterruptFrequencySeconds to be a positive integer when provided.`,
    );
  }

  for (const condition of action.transitions?.conditions ?? []) {
    if (
      condition.condition.operator !== "Equals"
      || condition.condition.operands[0] !== "MessagesInterrupted"
    ) {
      throw new Error(
        `Action "${action.id}" of type "MessageParticipantIteratively" only supports Equals MessagesInterrupted conditions.`,
      );
    }
  }
}

function validateLoopAction(action: FlowAction): void {
  const loopCount = action.parameters.LoopCount;
  if (typeof loopCount === "number") {
    if (!Number.isInteger(loopCount) || loopCount < 0 || loopCount > 100) {
      throw new Error(
        `Action "${action.id}" of type "Loop" requires LoopCount to be an integer between 0 and 100.`,
      );
    }
  } else if (!(typeof loopCount === "string" && loopCount.trim().length > 0)) {
    throw new Error(
      `Action "${action.id}" of type "Loop" requires LoopCount to be an integer between 0 and 100 or a non-empty JSONPath string.`,
    );
  }

  const conditions = action.transitions?.conditions ?? [];
  if (conditions.length !== 2) {
    throw new Error(
      `Action "${action.id}" of type "Loop" requires exactly two conditions.`,
    );
  }

  const operands = new Set<string>();
  for (const condition of conditions) {
    if (condition.condition.operator !== "Equals") {
      throw new Error(
        `Action "${action.id}" of type "Loop" only supports Equals conditions.`,
      );
    }

    const operand = condition.condition.operands[0] as LoopOperand;
    if (!LOOP_OPERANDS.has(operand)) {
      throw new Error(
        `Action "${action.id}" of type "Loop" only supports ContinueLooping and DoneLooping operands.`,
      );
    }

    operands.add(operand);
  }

  if (!operands.has("ContinueLooping") || !operands.has("DoneLooping")) {
    throw new Error(
      `Action "${action.id}" of type "Loop" requires one ContinueLooping condition and one DoneLooping condition.`,
    );
  }
}

function validateInvokeFlowModuleAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "FlowModuleId");
}

function validateGetMetricDataAction(action: FlowAction): void {
  const hasQueueId = "QueueId" in action.parameters;
  const hasAgentId = "AgentId" in action.parameters;

  if (hasQueueId && hasAgentId) {
    throw new Error(
      `Action "${action.id}" of type "GetMetricData" cannot define both QueueId and AgentId.`,
    );
  }

  if (hasQueueId) {
    requireNonEmptyStringParameter(action, "QueueId");
  }

  if (hasAgentId) {
    requireNonEmptyStringParameter(action, "AgentId");
  }

  if ("QueueChannel" in action.parameters) {
    const queueChannel = requireNonEmptyStringParameter(action, "QueueChannel");
    if (!QUEUE_CHANNELS.has(queueChannel)) {
      throw new Error(
        `Action "${action.id}" of type "GetMetricData" requires QueueChannel to be Voice or Chat.`,
      );
    }
  }
}

function validateGetCaseAction(action: FlowAction): void {
  validateLowercaseBooleanStringParameter(action, "LinkContactToCase");
  validateLowercaseBooleanStringParameter(action, "GetLastUpdatedCase");
  requireNonEmptyStringParameter(action, "CustomerId");
  validateStringMapParameter(action, "CaseRequestFields");
  validateStringArrayParameter(action, "CaseResponseFields");
  requireErrorTypes(action, [
    "NoMatchingError",
    "ContactNotLinked",
    "MultipleFound",
    "NoneFound",
  ]);
}

function validateGetCustomerProfileAction(action: FlowAction): void {
  const requestData = requireObjectParameter(action, "ProfileRequestData");
  const hasIdentifierPair =
    typeof requestData.IdentifierName === "string"
    && requestData.IdentifierName.trim().length > 0
    && typeof requestData.IdentifierValue === "string"
    && requestData.IdentifierValue.trim().length > 0;
  const hasSearchCriteria = Array.isArray(requestData.SearchCriteria);

  if (hasIdentifierPair === hasSearchCriteria) {
    throw new Error(
      `Action "${action.id}" of type "GetCustomerProfile" requires either IdentifierName and IdentifierValue, or SearchCriteria with LogicalOperator.`,
    );
  }

  if (hasSearchCriteria) {
    if ((requestData.SearchCriteria as unknown[]).length === 0) {
      throw new Error(
        `Action "${action.id}" of type "GetCustomerProfile" requires SearchCriteria to contain at least one entry.`,
      );
    }

    validateCustomerProfileSearchCriteria(action, requestData.SearchCriteria as unknown[]);
    if (
      requestData.LogicalOperator !== "AND"
      && requestData.LogicalOperator !== "OR"
    ) {
      throw new Error(
        `Action "${action.id}" of type "GetCustomerProfile" requires LogicalOperator to be AND or OR when SearchCriteria is used.`,
      );
    }
  }

  validateProfileResponseData(action);
  requireErrorTypes(action, ["MultipleFoundError", "NoneFoundError", "NoMatchingError"]);
}

function validateGetCustomerProfileObjectAction(action: FlowAction): void {
  const requestData = requireObjectParameter(action, "ProfileRequestData");

  if (
    typeof requestData.ProfileId !== "string"
    || requestData.ProfileId.trim().length === 0
    || typeof requestData.ObjectType !== "string"
    || requestData.ObjectType.trim().length === 0
  ) {
    throw new Error(
      `Action "${action.id}" of type "GetCustomerProfileObject" requires ProfileId and ObjectType to be non-empty strings.`,
    );
  }

  const hasUseLatest = typeof requestData.UseLatest === "boolean";
  const hasIdentifierPair =
    typeof requestData.IdentifierName === "string"
    && requestData.IdentifierName.trim().length > 0
    && typeof requestData.IdentifierValue === "string"
    && requestData.IdentifierValue.trim().length > 0;

  if (hasUseLatest === hasIdentifierPair) {
    throw new Error(
      `Action "${action.id}" of type "GetCustomerProfileObject" requires either UseLatest or IdentifierName and IdentifierValue.`,
    );
  }

  validateProfileResponseData(action);
  requireErrorTypes(action, ["NoneFoundError", "NoMatchingError"]);
}

function validateListDataTableValuesAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "DataTableId");
  requireErrorTypes(action, ["NoMatchingError"]);

  const primaryKeyGroups = requireArrayParameter(
    action,
    "PrimaryKeyGroups",
    "ListDataTableValues",
  );
  validateArrayLengthRange(
    action,
    primaryKeyGroups,
    "PrimaryKeyGroups",
    "ListDataTableValues",
    1,
    5,
  );

  const seenGroupNames = new Set<string>();
  for (const group of primaryKeyGroups) {
    if (!isObject(group)) {
      throw new Error(
        `Action "${action.id}" of type "ListDataTableValues" requires every PrimaryKeyGroups entry to be an object.`,
      );
    }

    const groupName = requireNestedNonEmptyString(
      action,
      group,
      "PrimaryKeyGroups",
      "PrimaryKeyGroupName",
      "ListDataTableValues",
    );
    if (seenGroupNames.has(groupName)) {
      throw new Error(
        `Action "${action.id}" of type "ListDataTableValues" requires every PrimaryKeyGroups.PrimaryKeyGroupName to be unique.`,
      );
    }
    seenGroupNames.add(groupName);

    validateNamedPrimaryValues(
      action,
      group,
      "PrimaryValues",
      "Name",
      "PrimaryKeyGroups",
      "ListDataTableValues",
    );
  }
}

function validateAuthenticateParticipantAction(action: FlowAction): void {
  const cognitoConfiguration = requireObjectParameter(
    action,
    "CognitoConfiguration",
  );
  for (const key of ["UserPoolArn", "AppClientId"] as const) {
    if (
      typeof cognitoConfiguration[key] !== "string"
      || cognitoConfiguration[key].trim().length === 0
    ) {
      throw new Error(
        `Action "${action.id}" of type "AuthenticateParticipant" requires CognitoConfiguration.${key} to be a non-empty string.`,
      );
    }
  }

  const customerProfilesConfiguration = requireObjectParameter(
    action,
    "CustomerProfilesConfiguration",
  );
  if (
    typeof customerProfilesConfiguration.ObjectTypeName !== "string"
    || customerProfilesConfiguration.ObjectTypeName.trim().length === 0
  ) {
    throw new Error(
      `Action "${action.id}" of type "AuthenticateParticipant" requires CustomerProfilesConfiguration.ObjectTypeName to be a non-empty string.`,
    );
  }

  const timeLimitMinutes = action.parameters.TimeLimitMinutes;
  const numericTimeLimit =
    typeof timeLimitMinutes === "number"
      ? timeLimitMinutes
      : typeof timeLimitMinutes === "string"
        ? Number(timeLimitMinutes)
        : NaN;
  if (
    !Number.isInteger(numericTimeLimit)
    || numericTimeLimit <= 0
  ) {
    throw new Error(
      `Action "${action.id}" of type "AuthenticateParticipant" requires TimeLimitMinutes to be a positive integer or integer string.`,
    );
  }

  for (const condition of action.transitions?.conditions ?? []) {
    if (condition.condition.operator !== "Equals") {
      throw new Error(
        `Action "${action.id}" of type "AuthenticateParticipant" only supports Equals conditions.`,
      );
    }

    const operand = condition.condition.operands[0];
    if (!AUTHENTICATE_PARTICIPANT_OPERANDS.has(operand)) {
      throw new Error(
        `Action "${action.id}" of type "AuthenticateParticipant" only supports the OptedOut condition operand.`,
      );
    }
  }

  requireErrorTypes(action, ["TimeLimitExceeded", "NoMatchingError"]);
}

function validateAssociateContactToCustomerProfileAction(action: FlowAction): void {
  const requestData = requireObjectParameter(action, "ProfileRequestData");

  if (
    typeof requestData.ProfileId !== "string"
    || requestData.ProfileId.trim().length === 0
    || typeof requestData.ContactId !== "string"
    || requestData.ContactId.trim().length === 0
  ) {
    throw new Error(
      `Action "${action.id}" of type "AssociateContactToCustomerProfile" requires ProfileId and ContactId to be non-empty strings.`,
    );
  }

  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateCheckVoiceIdAction(action: FlowAction): void {
  const option = action.parameters.CheckVoiceIdOption as CheckVoiceIdOption | undefined;
  if (!option || !CHECK_VOICE_ID_OPTIONS.has(option)) {
    throw new Error(
      `Action "${action.id}" of type "CheckVoiceId" requires CheckVoiceIdOption to be one of ${[...CHECK_VOICE_ID_OPTIONS].join(", ")}.`,
    );
  }

  const conditions = action.transitions?.conditions ?? [];
  if (conditions.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "CheckVoiceId" requires at least one condition.`,
    );
  }

  const allowedOperands = getAllowedCheckVoiceIdOperands(option);
  for (const condition of conditions) {
    if (condition.condition.operator !== "Equals") {
      throw new Error(
        `Action "${action.id}" of type "CheckVoiceId" only supports Equals conditions.`,
      );
    }

    const operand = condition.condition.operands[0];
    if (!allowedOperands.has(operand)) {
      throw new Error(
        `Action "${action.id}" of type "CheckVoiceId" does not support operand "${operand}" for option "${option}".`,
      );
    }
  }

  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateCompleteOutboundCallAction(action: FlowAction): void {
  if ("CallerId" in action.parameters) {
    const callerId = requireObjectParameter(action, "CallerId");
    if (typeof callerId.Number !== "string" || callerId.Number.trim().length === 0) {
      throw new Error(
        `Action "${action.id}" of type "CompleteOutboundCall" requires CallerId.Number to be a non-empty string when provided.`,
      );
    }
  }

  if ("VoiceConnector" in action.parameters) {
    const voiceConnector = requireObjectParameter(action, "VoiceConnector");
    validateCompleteOutboundCallVoiceConnector(action, voiceConnector);
  }

  if ("ConnectionTimeLimitSeconds" in action.parameters) {
    requireIntegerInRangeParameter(
      action,
      "ConnectionTimeLimitSeconds",
      1,
      600,
      "an integer between 1 and 600",
    );
  }
}

function validateCreateCallbackContactAction(action: FlowAction): void {
  const queueId = action.parameters.QueueId;
  const agentId = action.parameters.AgentId;

  if (queueId !== undefined && agentId !== undefined) {
    throw new Error(
      `Action "${action.id}" of type "CreateCallbackContact" cannot define both QueueId and AgentId.`,
    );
  }

  if (queueId !== undefined) {
    requireNonEmptyStringParameter(action, "QueueId");
  }

  if (agentId !== undefined) {
    requireNonEmptyStringParameter(action, "AgentId");
  }

  requireIntegerInRangeParameter(
    action,
    "InitialCallDelaySeconds",
    1,
    259200,
    "an integer between 1 and 259200",
  );
  requireIntegerInRangeParameter(
    action,
    "MaximumConnectionAttempts",
    1,
    Number.MAX_SAFE_INTEGER,
    "a positive integer",
  );
  requireIntegerInRangeParameter(
    action,
    "RetryDelaySeconds",
    1,
    259200,
    "an integer between 1 and 259200",
  );

  for (const key of ["ContactFlowId", "CallerId"]) {
    if (key in action.parameters) {
      requireNonEmptyStringParameter(action, key);
    }
  }

  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateCreateWisdomSessionAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "WisdomAssistantArn");
  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateDequeueContactAndTransferToQueueAction(action: FlowAction): void {
  const queueId = action.parameters.QueueId;
  const agentId = action.parameters.AgentId;

  if ((queueId === undefined) === (agentId === undefined)) {
    throw new Error(
      `Action "${action.id}" of type "DequeueContactAndTransferToQueue" requires exactly one of QueueId or AgentId.`,
    );
  }

  if (queueId !== undefined) {
    requireNonEmptyStringParameter(action, "QueueId");
  }

  if (agentId !== undefined) {
    requireNonEmptyStringParameter(action, "AgentId");
  }

  requireErrorTypes(action, ["QueueAtCapacity", "NoMatchingError"]);
}

function validateEndFlowModuleExecutionAction(action: FlowAction): void {
  if (Object.keys(action.parameters).length > 0) {
    throw new Error(
      `Action "${action.id}" of type "EndFlowModuleExecution" does not accept parameters.`,
    );
  }
}

function validateGetCalculatedAttributesForCustomerProfileAction(action: FlowAction): void {
  const requestData = requireObjectParameter(action, "ProfileRequestData");
  if (
    typeof requestData.ProfileId !== "string"
    || requestData.ProfileId.trim().length === 0
  ) {
    throw new Error(
      `Action "${action.id}" of type "GetCalculatedAttributesForCustomerProfile" requires ProfileRequestData.ProfileId to be a non-empty string.`,
    );
  }

  validateProfileResponseData(action);
  requireErrorTypes(action, ["NoneFoundError", "NoMatchingError"]);
}

function validateStartOutboundChatContactAction(action: FlowAction): void {
  const sourceEndpoint = requireObjectParameter(action, "SourceEndpoint");
  const destinationEndpoint = requireObjectParameter(action, "DestinationEndpoint");

  if (
    typeof sourceEndpoint.Address !== "string"
    || sourceEndpoint.Address.trim().length === 0
    || sourceEndpoint.Type !== "CONNECT_PHONENUMBER_ARN"
  ) {
    throw new Error(
      `Action "${action.id}" of type "StartOutboundChatContact" requires SourceEndpoint to use a non-empty Address and Type "CONNECT_PHONENUMBER_ARN".`,
    );
  }

  if (
    typeof destinationEndpoint.Address !== "string"
    || destinationEndpoint.Address.trim().length === 0
    || destinationEndpoint.Type !== "TELEPHONE_NUMBER"
  ) {
    throw new Error(
      `Action "${action.id}" of type "StartOutboundChatContact" requires DestinationEndpoint to use a non-empty Address and Type "TELEPHONE_NUMBER".`,
    );
  }

  requireNonEmptyStringParameter(action, "ContactFlowArn");

  if (action.parameters.ContactSubtype !== "connect:SMS") {
    throw new Error(
      `Action "${action.id}" of type "StartOutboundChatContact" only supports ContactSubtype "connect:SMS".`,
    );
  }

  if ("InitialSystemMessage" in action.parameters) {
    const initialSystemMessage = requireObjectParameter(action, "InitialSystemMessage");
    if (
      typeof initialSystemMessage.Content !== "string"
      || initialSystemMessage.Content.trim().length === 0
    ) {
      throw new Error(
        `Action "${action.id}" of type "StartOutboundChatContact" requires InitialSystemMessage.Content to be a non-empty string when provided.`,
      );
    }
  }

  if (
    "RelatedContact" in action.parameters
    && action.parameters.RelatedContact !== "CURRENT"
  ) {
    throw new Error(
      `Action "${action.id}" of type "StartOutboundChatContact" only supports RelatedContact "CURRENT".`,
    );
  }

  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateStartVoiceIdStreamAction(action: FlowAction): void {
  if (Object.keys(action.parameters).length > 0) {
    throw new Error(
      `Action "${action.id}" of type "StartVoiceIdStream" does not accept parameters.`,
    );
  }

  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateUpdatePreviousContactParticipantStateAction(action: FlowAction): void {
  const state = action.parameters
    .PreviousContactParticipantState as PreviousContactParticipantState | undefined;
  if (!state || !PREVIOUS_CONTACT_PARTICIPANT_STATES.has(state)) {
    throw new Error(
      `Action "${action.id}" of type "UpdatePreviousContactParticipantState" requires PreviousContactParticipantState to be one of ${[...PREVIOUS_CONTACT_PARTICIPANT_STATES].join(", ")}.`,
    );
  }

  requireErrorTypes(action, ["NoMatchingError"]);
}

function requireNonEmptyStringParameter(action: FlowAction, key: string): string {
  const value = action.parameters[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Action "${action.id}" of type "${action.type}" requires "${key}" to be a non-empty string.`);
  }

  return value;
}

function requireMetricTypeParameter(action: FlowAction): CheckMetricDataMetricType {
  const metricType = requireNonEmptyStringParameter(action, "MetricType") as CheckMetricDataMetricType;

  if (!CHECK_METRIC_DATA_METRIC_TYPES.has(metricType)) {
    throw new Error(
      `Action "${action.id}" of type "CheckMetricData" uses unsupported MetricType "${metricType}".`,
    );
  }

  return metricType;
}

function validateTransferToFlowAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "ContactFlowId");
}

function validateTransferContactToQueueAction(action: FlowAction): void {
  if (Object.keys(action.parameters).length > 0) {
    throw new Error(
      `Action "${action.id}" of type "TransferContactToQueue" does not accept parameters.`,
    );
  }

  requireErrorTypes(action, [
    "QueueAtCapacity",
    "NoMatchingError",
  ]);
}

function validateTransferParticipantToThirdPartyAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "ThirdPartyPhoneNumber");
  const connectionTimeLimit = requireNonEmptyStringParameter(
    action,
    "ThirdPartyConnectionTimeLimitSeconds",
  );
  validatePositiveIntegerOrIntegerString(
    action,
    connectionTimeLimit,
    "ThirdPartyConnectionTimeLimitSeconds",
    "TransferParticipantToThirdParty",
  );

  validateTrueFalseField(
    action,
    requireNonEmptyStringParameter(action, "ContinueFlowExecution"),
    "ContinueFlowExecution",
  );

  if ("ThirdPartyDTMFDigits" in action.parameters) {
    requireNonEmptyStringParameter(action, "ThirdPartyDTMFDigits");
  }

  if ("CallerId" in action.parameters) {
    const callerId = requireObjectParameter(action, "CallerId");
    requireNestedNonEmptyString(
      action,
      callerId,
      "CallerId",
      "Name",
      "TransferParticipantToThirdParty",
    );
    requireNestedNonEmptyString(
      action,
      callerId,
      "CallerId",
      "Number",
      "TransferParticipantToThirdParty",
    );
  }

  requireErrorTypes(action, [
    "CallFailed",
    "ConnectionTimeLimitExceeded",
    "NoMatchingError",
  ]);
}

function validateTransferContactToAgentAction(action: FlowAction): void {
  if (Object.keys(action.parameters).length > 0) {
    throw new Error(
      `Action "${action.id}" of type "TransferContactToAgent" does not accept parameters.`,
    );
  }
}

function validateResumeContactAction(action: FlowAction): void {
  if (Object.keys(action.parameters).length > 0) {
    throw new Error(
      `Action "${action.id}" of type "ResumeContact" does not accept parameters.`,
    );
  }
}

function validateTagContactAction(action: FlowAction): void {
  const tags = action.parameters.Tags;

  if (!isObject(tags) || Object.keys(tags).length === 0) {
    throw new Error(
      `Action "${action.id}" of type "TagContact" requires Tags to contain at least one entry.`,
    );
  }

  for (const [key, value] of Object.entries(tags)) {
    validateUserDefinedTagEntry(action, key, value, "TagContact");
  }
}

function validateUpdateContactEventHooksAction(action: FlowAction): void {
  const eventHooks = action.parameters.EventHooks;

  if (!isObject(eventHooks)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactEventHooks" requires EventHooks to be an object.`,
    );
  }

  const entries = Object.entries(eventHooks);
  if (entries.length !== 1) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactEventHooks" requires EventHooks to define exactly one hook.`,
    );
  }

  const [hookType, flowIdOrArn] = entries[0];
  if (!CONTACT_EVENT_HOOK_TYPES.has(hookType as ContactEventHookType)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactEventHooks" uses unsupported hook type "${hookType}".`,
    );
  }

  if (typeof flowIdOrArn !== "string" || flowIdOrArn.trim().length === 0) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactEventHooks" requires the configured hook target to be a non-empty string.`,
    );
  }
}

function validateUpdateContactMediaProcessingAction(action: FlowAction): void {
  const chatProcessor = action.parameters.ChatProcessor;
  if (!isObject(chatProcessor)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactMediaProcessing" requires ChatProcessor to be an object.`,
    );
  }

  validateTrueFalseField(action, chatProcessor.ProcessingEnabled, "ChatProcessor.ProcessingEnabled");

  if (
    typeof chatProcessor.LambdaProcessorARN !== "string"
    || chatProcessor.LambdaProcessorARN.trim().length === 0
  ) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactMediaProcessing" requires ChatProcessor.LambdaProcessorARN to be a non-empty string.`,
    );
  }

  if ("ChatProcessorSettings" in chatProcessor) {
    const settings = chatProcessor.ChatProcessorSettings;
    if (!isObject(settings)) {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactMediaProcessing" requires ChatProcessorSettings to be an object when provided.`,
      );
    }

    validateTrueFalseField(
      action,
      settings.DeliverUnprocessedMessages,
      "ChatProcessor.ChatProcessorSettings.DeliverUnprocessedMessages",
    );
  }

  requireErrorTypes(action, ["NoMatchingError", "ChannelMismatch"]);
}

function validateUpdateContactMediaStreamingBehaviorAction(action: FlowAction): void {
  const mediaStreamingState = requireNonEmptyStringParameter(action, "MediaStreamingState");
  if (!MEDIA_STREAMING_STATES.has(mediaStreamingState)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactMediaStreamingBehavior" requires MediaStreamingState to be Enabled or Disabled.`,
    );
  }

  if (action.parameters.MediaStreamType !== "Audio") {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactMediaStreamingBehavior" only supports MediaStreamType "Audio".`,
    );
  }

  const participants = action.parameters.Participants;
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactMediaStreamingBehavior" requires Participants to contain at least one entry.`,
    );
  }

  for (const participant of participants) {
    if (!isObject(participant) || participant.ParticipantType !== "Customer") {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactMediaStreamingBehavior" only supports ParticipantType "Customer".`,
      );
    }

    if (!Array.isArray(participant.MediaDirections) || participant.MediaDirections.length === 0) {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactMediaStreamingBehavior" requires every participant to define at least one media direction.`,
      );
    }

    for (const direction of participant.MediaDirections) {
      if (typeof direction !== "string" || !MEDIA_DIRECTIONS.has(direction)) {
        throw new Error(
          `Action "${action.id}" of type "UpdateContactMediaStreamingBehavior" only supports media directions From and To.`,
        );
      }
    }
  }
}

function validateUpdateContactRecordingAndAnalyticsBehaviorAction(action: FlowAction): void {
  const hasVoiceBehavior = isObject(action.parameters.VoiceBehavior);
  const hasChatBehavior = isObject(action.parameters.ChatBehavior);
  const hasScreenRecordingBehavior = isObject(action.parameters.ScreenRecordingBehavior);

  if (!hasVoiceBehavior && !hasChatBehavior && !hasScreenRecordingBehavior) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" requires at least one behavior object.`,
    );
  }

  if (hasVoiceBehavior && hasChatBehavior) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" cannot define both VoiceBehavior and ChatBehavior.`,
    );
  }

  if (hasVoiceBehavior) {
    validateVoiceBehavior(action, action.parameters.VoiceBehavior as Record<string, unknown>);
  }

  if (hasChatBehavior) {
    validateChatBehavior(action, action.parameters.ChatBehavior as Record<string, unknown>);
  }

  if (hasScreenRecordingBehavior) {
    validateScreenRecordingBehavior(
      action,
      action.parameters.ScreenRecordingBehavior as Record<string, unknown>,
    );
  }

  const requiredErrors = hasChatBehavior
    ? ["NoMatchingError", "ChannelMismatch", "InFlightRedactionConfigurationFailed"]
    : ["NoMatchingError", "ChannelMismatch"];
  requireErrorTypes(action, requiredErrors);
}

function validateUnTagContactAction(action: FlowAction): void {
  const tagKeys = action.parameters.TagKeys;

  if (!Array.isArray(tagKeys) || tagKeys.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "UnTagContact" requires TagKeys to contain at least one entry.`,
    );
  }

  for (const key of tagKeys) {
    if (typeof key !== "string" || key.trim().length === 0) {
      throw new Error(
        `Action "${action.id}" of type "UnTagContact" requires every TagKeys entry to be a non-empty string.`,
      );
    }

    if (key.startsWith("aws:")) {
      throw new Error(
        `Action "${action.id}" of type "UnTagContact" cannot remove system tag keys prefixed with aws:.`,
      );
    }

    if (isLikelyJsonPath(key)) {
      throw new Error(
        `Action "${action.id}" of type "UnTagContact" requires static TagKeys values, not JSONPath references.`,
      );
    }
  }
}

function validateUpsertDataTableValuesAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "LockVersion");
  requireNonEmptyStringParameter(action, "DataTableId");
  requireErrorTypes(action, ["NoMatchingError"]);

  const upsertGroups = requireArrayParameter(
    action,
    "DataTableUpsertAttributes",
    "UpsertDataTableValues",
  );
  validateArrayLengthRange(
    action,
    upsertGroups,
    "DataTableUpsertAttributes",
    "UpsertDataTableValues",
    1,
    25,
  );

  const seenGroupNames = new Set<string>();
  let totalAttributeCount = 0;

  for (const group of upsertGroups) {
    if (!isObject(group)) {
      throw new Error(
        `Action "${action.id}" of type "UpsertDataTableValues" requires every DataTableUpsertAttributes entry to be an object.`,
      );
    }

    const groupName = requireNestedNonEmptyString(
      action,
      group,
      "DataTableUpsertAttributes",
      "PrimaryKeyGroupName",
      "UpsertDataTableValues",
    );
    if (seenGroupNames.has(groupName)) {
      throw new Error(
        `Action "${action.id}" of type "UpsertDataTableValues" requires every DataTableUpsertAttributes.PrimaryKeyGroupName to be unique.`,
      );
    }
    seenGroupNames.add(groupName);

    validateNamedPrimaryValues(
      action,
      group,
      "PrimaryValues",
      "Name",
      "DataTableUpsertAttributes",
      "UpsertDataTableValues",
    );

    const attributes = requireNestedArray(
      action,
      group,
      "DataTableUpsertAttributes",
      "Attributes",
      "UpsertDataTableValues",
    );
    validateArrayLengthRange(
      action,
      attributes,
      "DataTableUpsertAttributes.Attributes",
      "UpsertDataTableValues",
      1,
      25,
    );
    totalAttributeCount += attributes.length;

    for (const attribute of attributes) {
      if (!isObject(attribute)) {
        throw new Error(
          `Action "${action.id}" of type "UpsertDataTableValues" requires every DataTableUpsertAttributes.Attributes entry to be an object.`,
        );
      }

      requireNestedNonEmptyString(
        action,
        attribute,
        "DataTableUpsertAttributes.Attributes",
        "Name",
        "UpsertDataTableValues",
      );
      requireNestedNonEmptyString(
        action,
        attribute,
        "DataTableUpsertAttributes.Attributes",
        "Value",
        "UpsertDataTableValues",
      );

      if (
        "UseDefaultValue" in attribute
        && typeof attribute.UseDefaultValue !== "boolean"
      ) {
        throw new Error(
          `Action "${action.id}" of type "UpsertDataTableValues" requires DataTableUpsertAttributes.Attributes.UseDefaultValue to be a boolean when provided.`,
        );
      }
    }
  }

  if (totalAttributeCount > 25) {
    throw new Error(
      `Action "${action.id}" of type "UpsertDataTableValues" supports at most 25 total write attributes across DataTableUpsertAttributes.`,
    );
  }
}

function validateUpdateContactCallbackNumberAction(action: FlowAction): void {
  const callbackNumber = requireNonEmptyStringParameter(action, "CallbackNumber");

  if (!isLikelyJsonPath(callbackNumber)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactCallbackNumber" requires CallbackNumber to be a JSONPath reference.`,
    );
  }
}

function validateUpdateContactDataAction(action: FlowAction): void {
  const targetContact = requireNonEmptyStringParameter(action, "TargetContact");
  if (!CONTACT_TARGETS.has(targetContact)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactData" requires TargetContact to be Current or Related.`,
    );
  }

  const parameterKeys = Object.keys(action.parameters).filter((key) => key !== "TargetContact");
  if (parameterKeys.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactData" requires at least one attribute besides TargetContact.`,
    );
  }

  for (const key of ["Name", "Description", "LanguageCode", "CustomerId", "WatchlistId", "WisdomSessionArn"]) {
    if (key in action.parameters) {
      requireNonEmptyStringParameter(action, key);
    }
  }

  for (const key of [
    "IsVoiceIdStreamingEnabled",
    "IsVoiceAuthenticationEnabled",
    "IsFraudDetectionEnabled",
  ]) {
    if (key in action.parameters) {
      const value = requireNonEmptyStringParameter(action, key);
      if (value !== "TRUE" && value !== "FALSE") {
        throw new Error(
          `Action "${action.id}" of type "UpdateContactData" requires ${key} to be TRUE or FALSE.`,
        );
      }
    }
  }

  validateRangeStringParameter(action, "VoiceAuthenticationThreshold", 0, 100);
  validateRangeStringParameter(action, "FraudDetectionThreshold", 0, 100);
  validateRangeStringParameter(action, "VoiceAuthenticationResponseTime", 5, 10);

  if ("References" in action.parameters) {
    const references = action.parameters.References;
    if (!isObject(references) || Object.keys(references).length === 0) {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactData" requires References to be a non-empty object when provided.`,
      );
    }

    for (const [key, value] of Object.entries(references)) {
      if (key.trim().length === 0 || typeof value !== "string" || value.trim().length === 0) {
        throw new Error(
          `Action "${action.id}" of type "UpdateContactData" requires every References entry to use a non-empty string key and value.`,
        );
      }
    }
  }
}

function validateUpdateCaseAction(action: FlowAction): void {
  validateLowercaseBooleanStringParameter(action, "LinkContactToCase");
  requireNonEmptyStringParameter(action, "CaseId");
  validateStringMapParameter(action, "CaseRequestFields");
  requireErrorTypes(action, ["ContactNotLinked", "NoMatchingError"]);
}

function validateUpdateContactRoutingBehaviorAction(action: FlowAction): void {
  const priority = action.parameters.QueuePriority;
  const timeAdjustment = action.parameters.QueueTimeAdjustmentSeconds;

  if ((priority === undefined) === (timeAdjustment === undefined)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactRoutingBehavior" requires exactly one of QueuePriority or QueueTimeAdjustmentSeconds.`,
    );
  }

  if (
    priority !== undefined
    && (!Number.isInteger(priority) || (priority as number) < 1 || (priority as number) > 99)
  ) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactRoutingBehavior" requires QueuePriority to be an integer between 1 and 99.`,
    );
  }

  if (timeAdjustment !== undefined && !Number.isInteger(timeAdjustment)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactRoutingBehavior" requires QueueTimeAdjustmentSeconds to be an integer.`,
    );
  }
}

function validateUpdateContactTargetQueueAction(action: FlowAction): void {
  const queueId = action.parameters.QueueId;
  const agentId = action.parameters.AgentId;

  if ((queueId === undefined) === (agentId === undefined)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactTargetQueue" requires exactly one of QueueId or AgentId.`,
    );
  }

  if (queueId !== undefined) {
    requireNonEmptyStringParameter(action, "QueueId");
  }

  if (agentId !== undefined) {
    requireNonEmptyStringParameter(action, "AgentId");
  }
}

function validateUpdateContactTextToSpeechVoiceAction(action: FlowAction): void {
  requireNonEmptyStringParameter(action, "TextToSpeechVoice");

  for (const key of ["TextToSpeechEngine", "TextToSpeechStyle"]) {
    if (key in action.parameters) {
      requireNonEmptyStringParameter(action, key);
    }
  }
}

function validateUpdateFlowAttributesAction(action: FlowAction): void {
  const flowAttributes = action.parameters.FlowAttributes;

  if (!isObject(flowAttributes) || Object.keys(flowAttributes).length === 0) {
    throw new Error(
      `Action "${action.id}" of type "UpdateFlowAttributes" requires FlowAttributes to contain at least one entry.`,
    );
  }

  for (const [key, value] of Object.entries(flowAttributes)) {
    if (key.trim().length === 0 || typeof value !== "string" || value.trim().length === 0) {
      throw new Error(
        `Action "${action.id}" of type "UpdateFlowAttributes" requires every FlowAttributes entry to use a non-empty string key and value.`,
      );
    }
  }
}

function validateUpdateFlowLoggingBehaviorAction(action: FlowAction): void {
  const behavior = requireNonEmptyStringParameter(
    action,
    "FlowLoggingBehavior",
  ) as FlowLoggingBehavior;

  if (!FLOW_LOGGING_BEHAVIORS.has(behavior)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateFlowLoggingBehavior" requires FlowLoggingBehavior to be Enabled or Disabled.`,
    );
  }
}

function validateUpdateCustomerProfileAction(action: FlowAction): void {
  validateProfileRequestDataHasEntries(action);
  validateProfileResponseData(action);
  requireErrorTypes(action, ["NoMatchingError"]);
}

function validateWaitAction(action: FlowAction): void {
  validateWaitTimeout(action);

  const events = validateWaitEvents(action);
  const conditions = action.transitions?.conditions ?? [];

  if (conditions.length === 0) {
    throw new Error(`Action "${action.id}" of type "Wait" requires conditions for WaitCompleted and configured events.`);
  }

  const requiredOperands = new Set<string>(["WaitCompleted", ...events]);
  const actualOperands = new Set<string>();

  for (const condition of conditions) {
    if (condition.condition.operator !== "Equals") {
      throw new Error(`Action "${action.id}" of type "Wait" only supports Equals conditions.`);
    }

    const operand = condition.condition.operands[0];
    if (!requiredOperands.has(operand)) {
      throw new Error(
        `Action "${action.id}" of type "Wait" uses unsupported condition operand "${operand}".`,
      );
    }

    actualOperands.add(operand);
  }

  for (const operand of requiredOperands) {
    if (!actualOperands.has(operand)) {
      throw new Error(
        `Action "${action.id}" of type "Wait" requires a condition for "${operand}".`,
      );
    }
  }
}

function validateWaitTimeout(action: FlowAction): void {
  const timeout = action.parameters.TimeoutSeconds;

  if (typeof timeout === "number") {
    if (!Number.isInteger(timeout) || timeout <= 0 || timeout > 604800) {
      throw new Error(
        `Action "${action.id}" of type "Wait" requires TimeoutSeconds to be a positive integer no greater than 604800.`,
      );
    }
    return;
  }

  if (typeof timeout === "string" && timeout.trim().length > 0) {
    return;
  }

  throw new Error(
    `Action "${action.id}" of type "Wait" requires TimeoutSeconds to be a positive integer or a non-empty JSONPath string.`,
  );
}

function validateWaitEvents(action: FlowAction): WaitEvent[] {
  const events = action.parameters.Events;

  if (events === undefined) {
    return [];
  }

  if (!Array.isArray(events)) {
    throw new Error(`Action "${action.id}" of type "Wait" requires Events to be an array when provided.`);
  }

  for (const event of events) {
    if (typeof event !== "string" || !WAIT_EVENTS.has(event as WaitEvent)) {
      throw new Error(
        `Action "${action.id}" of type "Wait" uses unsupported event "${String(event)}".`,
      );
    }
  }

  return events as WaitEvent[];
}

function validateRangeStringParameter(
  action: FlowAction,
  key: string,
  min: number,
  max: number,
): void {
  if (!(key in action.parameters)) {
    return;
  }

  const value = requireNonEmptyStringParameter(action, key);
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < min || numericValue > max) {
    throw new Error(
      `Action "${action.id}" of type "${action.type}" requires ${key} to be between ${min} and ${max}.`,
    );
  }
}

function validateStringMapParameter(action: FlowAction, key: string): void {
  if (!(key in action.parameters)) {
    return;
  }

  const value = action.parameters[key];
  if (!isObject(value) || Object.keys(value).length === 0) {
    throw new Error(
      `Action "${action.id}" of type "${action.type}" requires ${key} to be a non-empty object when provided.`,
    );
  }

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (
      entryKey.trim().length === 0
      || typeof entryValue !== "string"
      || entryValue.trim().length === 0
    ) {
      throw new Error(
        `Action "${action.id}" of type "${action.type}" requires every ${key} entry to use a non-empty string key and value.`,
      );
    }
  }
}

function validateStringArrayParameter(action: FlowAction, key: string): void {
  if (!(key in action.parameters)) {
    return;
  }

  const value = action.parameters[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "${action.type}" requires ${key} to be a non-empty array when provided.`,
    );
  }

  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(
        `Action "${action.id}" of type "${action.type}" requires every ${key} entry to be a non-empty string.`,
      );
    }
  }
}

function requireArrayParameter(
  action: FlowAction,
  key: string,
  actionType: FlowAction["type"],
): unknown[] {
  const value = action.parameters[key];
  if (!Array.isArray(value)) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires ${key} to be an array.`,
    );
  }

  return value;
}

function requireNestedArray(
  action: FlowAction,
  parent: Record<string, unknown>,
  parentName: string,
  key: string,
  actionType: FlowAction["type"],
): unknown[] {
  const value = parent[key];
  if (!Array.isArray(value)) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires ${parentName}.${key} to be an array.`,
    );
  }

  return value;
}

function validateArrayLengthRange(
  action: FlowAction,
  value: unknown[],
  fieldName: string,
  actionType: FlowAction["type"],
  min: number,
  max: number,
): void {
  if (value.length < min || value.length > max) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires ${fieldName} to contain between ${min} and ${max} entries.`,
    );
  }
}

function validateNestedStringArray(
  action: FlowAction,
  parent: Record<string, unknown>,
  key: string,
  parentName: string,
  actionType: FlowAction["type"],
): void {
  const value = requireNestedArray(action, parent, parentName, key, actionType);
  if (value.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires ${parentName}.${key} to contain at least one entry.`,
    );
  }

  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(
        `Action "${action.id}" of type "${actionType}" requires every ${parentName}.${key} entry to be a non-empty string.`,
      );
    }
  }
}

function validateNamedPrimaryValues(
  action: FlowAction,
  parent: Record<string, unknown>,
  key: string,
  nameKey: string,
  parentName: string,
  actionType: FlowAction["type"],
): void {
  const primaryValues = requireNestedArray(
    action,
    parent,
    parentName,
    key,
    actionType,
  );
  if (primaryValues.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires ${parentName}.${key} to contain at least one entry.`,
    );
  }

  for (const primaryValue of primaryValues) {
    if (!isObject(primaryValue)) {
      throw new Error(
        `Action "${action.id}" of type "${actionType}" requires every ${parentName}.${key} entry to be an object.`,
      );
    }

    requireNestedNonEmptyString(
      action,
      primaryValue,
      `${parentName}.${key}`,
      nameKey,
      actionType,
    );
    requireNestedNonEmptyString(
      action,
      primaryValue,
      `${parentName}.${key}`,
      "Value",
      actionType,
    );
  }
}

function validateLowercaseBooleanStringParameter(action: FlowAction, key: string): void {
  const value = requireNonEmptyStringParameter(action, key);
  if (value !== "true" && value !== "false") {
    throw new Error(
      `Action "${action.id}" of type "${action.type}" requires ${key} to be "true" or "false".`,
    );
  }
}

function requireObjectParameter(action: FlowAction, key: string): Record<string, unknown> {
  const value = action.parameters[key];
  if (!isObject(value)) {
    throw new Error(
      `Action "${action.id}" of type "${action.type}" requires ${key} to be an object.`,
    );
  }
  return value;
}

function requireNestedNonEmptyString(
  action: FlowAction,
  parent: Record<string, unknown>,
  parentName: string,
  key: string,
  actionType: FlowAction["type"],
): string {
  const value = parent[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires ${parentName}.${key} to be a non-empty string.`,
    );
  }
  return value;
}

function validatePositiveIntegerOrIntegerString(
  action: FlowAction,
  value: unknown,
  fieldName: string,
  actionType: FlowAction["type"],
): void {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value)
        : NaN;

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires ${fieldName} to be a positive integer or integer string.`,
    );
  }
}

function validateProfileRequestDataHasEntries(action: FlowAction): void {
  const requestData = requireObjectParameter(action, "ProfileRequestData");
  if (Object.keys(requestData).length === 0) {
    throw new Error(
      `Action "${action.id}" of type "${action.type}" requires ProfileRequestData to contain at least one entry.`,
    );
  }
}

function validateProfileResponseData(action: FlowAction): void {
  if (!("ProfileResponseData" in action.parameters)) {
    return;
  }

  const responseData = action.parameters["ProfileResponseData"];

  // Connect flow API expects ProfileResponseData as an array of field name strings
  if (!Array.isArray(responseData)) {
    throw new Error(
      `Action "${action.id}" of type "${action.type}" requires ProfileResponseData to be an array of field name strings.`,
    );
  }

  if (responseData.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "${action.type}" requires ProfileResponseData to contain at least one entry when provided.`,
    );
  }

  for (const entry of responseData) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(
        `Action "${action.id}" of type "${action.type}" requires every ProfileResponseData entry to be a non-empty string.`,
      );
    }
  }
}

function validateCustomerProfileSearchCriteria(
  action: FlowAction,
  criteria: unknown[],
): void {
  for (const criterion of criteria) {
    if (!isObject(criterion)) {
      throw new Error(
        `Action "${action.id}" of type "GetCustomerProfile" requires every SearchCriteria entry to be an object.`,
      );
    }

    if (
      typeof criterion.IdentifierName !== "string"
      || criterion.IdentifierName.trim().length === 0
      || typeof criterion.IdentifierValue !== "string"
      || criterion.IdentifierValue.trim().length === 0
    ) {
      throw new Error(
        `Action "${action.id}" of type "GetCustomerProfile" requires every SearchCriteria entry to define non-empty IdentifierName and IdentifierValue fields.`,
      );
    }
  }
}

function validateMessageLoopContent(action: FlowAction, message: unknown): void {
  if (!isObject(message)) {
    throw new Error(
      `Action "${action.id}" of type "MessageParticipantIteratively" requires every message to be an object.`,
    );
  }

  const typedMessage = message as MessageLoopContent & Record<string, unknown>;
  const contentKeys = ["Text", "PromptId", "SSML", "Media"].filter(
    (key) => typedMessage[key] !== undefined,
  );

  if (contentKeys.length !== 1) {
    throw new Error(
      `Action "${action.id}" of type "MessageParticipantIteratively" requires each message to define exactly one of Text, PromptId, SSML, or Media.`,
    );
  }

  const [contentKey] = contentKeys;
  if (contentKey === "Media") {
    validateMediaObject(action, typedMessage.Media, "MessageParticipantIteratively");
    return;
  }

  const value = typedMessage[contentKey];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Action "${action.id}" of type "MessageParticipantIteratively" requires ${contentKey} to be a non-empty string.`,
    );
  }
}

function validateUserDefinedTagEntry(
  action: FlowAction,
  key: string,
  value: unknown,
  actionType: FlowAction["type"],
): void {
  if (key.trim().length === 0 || key.startsWith("aws:")) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires every tag key to be a non-empty user-defined tag key.`,
    );
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires every tag value to be a non-empty string.`,
    );
  }
}

function validateSinglePromptVariant(action: FlowAction, actionType: FlowAction["type"]): void {
  const promptKeys = ["PromptId", "Text", "SSML", "Media"].filter(
    (key) => action.parameters[key] !== undefined,
  );

  if (promptKeys.length !== 1) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires exactly one of PromptId, Text, SSML, or Media.`,
    );
  }

  const [promptKey] = promptKeys;
  if (promptKey === "Media") {
    validateMediaObject(action, action.parameters.Media, actionType);
    return;
  }

  requireNonEmptyStringParameter(action, promptKey);
}

function validateTrueFalseField(
  action: FlowAction,
  value: unknown,
  fieldName: string,
): void {
  if (value !== "True" && value !== "False") {
    throw new Error(
      `Action "${action.id}" of type "${action.type}" requires ${fieldName} to be True or False.`,
    );
  }
}

function isConnectTrueFalseString(value: string): boolean {
  return value === "True"
    || value === "False"
    || value === "true"
    || value === "false";
}

function normalizeConnectTrueFalseString(value: string): "True" | "False" {
  return value.toLowerCase() === "true" ? "True" : "False";
}

function getAllowedCheckVoiceIdOperands(
  option: CheckVoiceIdOption,
): Set<string> {
  switch (option) {
    case "enrollmentStatus":
      return ENROLLMENT_STATUS_RESULTS;
    case "voiceAuthentication":
      return VOICE_AUTHENTICATION_RESULTS;
    case "fraudDetection":
      return FRAUD_DETECTION_RESULTS;
    default:
      return new Set<string>();
  }
}

function validateCompleteOutboundCallVoiceConnector(
  action: FlowAction,
  voiceConnector: Record<string, unknown>,
): void {
  if (voiceConnector.VoiceConnectorType !== "ChimeConnector") {
    throw new Error(
      `Action "${action.id}" of type "CompleteOutboundCall" only supports VoiceConnectorType "ChimeConnector".`,
    );
  }

  for (const key of ["VoiceConnectorArn", "FromUser", "ToUser"] as const) {
    if (
      typeof voiceConnector[key] !== "string"
      || voiceConnector[key].trim().length === 0
    ) {
      throw new Error(
        `Action "${action.id}" of type "CompleteOutboundCall" requires VoiceConnector.${key} to be a non-empty string.`,
      );
    }
  }

  if (
    "UserToUserInformation" in voiceConnector
    && voiceConnector.UserToUserInformation !== undefined
    && (
      typeof voiceConnector.UserToUserInformation !== "string"
      || voiceConnector.UserToUserInformation.trim().length === 0
    )
  ) {
    throw new Error(
      `Action "${action.id}" of type "CompleteOutboundCall" requires VoiceConnector.UserToUserInformation to be a non-empty string when provided.`,
    );
  }
}

function requireIntegerInRangeParameter(
  action: FlowAction,
  key: string,
  minimum: number,
  maximum: number,
  expectedDescription: string,
): number {
  const value = action.parameters[key];
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw new Error(
      `Action "${action.id}" of type "${action.type}" requires "${key}" to be ${expectedDescription}.`,
    );
  }
  return value;
}

function requireErrorTypes(action: FlowAction, errorTypes: string[]): void {
  const presentErrorTypes = new Set(
    (action.transitions?.errors ?? []).map((error) => error.errorType),
  );

  for (const errorType of errorTypes) {
    if (!presentErrorTypes.has(errorType)) {
      throw new Error(
        `Action "${action.id}" of type "${action.type}" requires an error transition for ${errorType}.`,
      );
    }
  }
}

function validateMediaObject(
  action: FlowAction,
  media: unknown,
  actionType: FlowAction["type"],
): void {
  if (!isObject(media)) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires Media to be an object.`,
    );
  }

  if (
    typeof media.Uri !== "string"
    || media.Uri.trim().length === 0
    || media.SourceType !== "S3"
    || media.MediaType !== "Audio"
  ) {
    throw new Error(
      `Action "${action.id}" of type "${actionType}" requires Media to include a non-empty Uri plus SourceType "S3" and MediaType "Audio".`,
    );
  }
}

function validateVoiceBehavior(action: FlowAction, voiceBehavior: Record<string, unknown>): void {
  if ("VoiceRecordingBehavior" in voiceBehavior) {
    const recordingBehavior = voiceBehavior.VoiceRecordingBehavior;
    if (!isObject(recordingBehavior)) {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" requires VoiceRecordingBehavior to be an object.`,
      );
    }

    if (!Array.isArray(recordingBehavior.RecordedParticipants)) {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" requires VoiceRecordingBehavior.RecordedParticipants to be an array.`,
      );
    }

    for (const participant of recordingBehavior.RecordedParticipants) {
      if (participant !== "Agent" && participant !== "Customer") {
        throw new Error(
          `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" only supports Agent and Customer in VoiceRecordingBehavior.RecordedParticipants.`,
        );
      }
    }

    if (
      "IVRRecordingBehavior" in recordingBehavior
      && recordingBehavior.IVRRecordingBehavior !== "Enabled"
      && recordingBehavior.IVRRecordingBehavior !== "Disabled"
    ) {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" requires IVRRecordingBehavior to be Enabled or Disabled.`,
      );
    }
  }

  if ("VoiceAnalyticsBehavior" in voiceBehavior) {
    const analyticsBehavior = voiceBehavior.VoiceAnalyticsBehavior;
    if (!isObject(analyticsBehavior)) {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" requires VoiceAnalyticsBehavior to be an object.`,
      );
    }

    if ("Enabled" in analyticsBehavior) {
      validateTrueFalseField(
        action,
        analyticsBehavior.Enabled,
        "VoiceBehavior.VoiceAnalyticsBehavior.Enabled",
      );
    }

    if ("AnalyticsModes" in analyticsBehavior) {
      if (!Array.isArray(analyticsBehavior.AnalyticsModes) || analyticsBehavior.AnalyticsModes.length === 0) {
        throw new Error(
          `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" requires VoiceAnalyticsBehavior.AnalyticsModes to be a non-empty array when provided.`,
        );
      }

      for (const mode of analyticsBehavior.AnalyticsModes) {
        if (!["RealTime", "PostContact", "AutomatedInteraction"].includes(String(mode))) {
          throw new Error(
            `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" uses unsupported voice analytics mode "${String(mode)}".`,
          );
        }
      }
    }
  }
}

function validateChatBehavior(action: FlowAction, chatBehavior: Record<string, unknown>): void {
  const analyticsBehavior = chatBehavior.ChatAnalyticsBehavior;
  if (!isObject(analyticsBehavior)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" requires ChatAnalyticsBehavior to be an object.`,
    );
  }

  if ("Enabled" in analyticsBehavior) {
    validateTrueFalseField(
      action,
      analyticsBehavior.Enabled,
      "ChatBehavior.ChatAnalyticsBehavior.Enabled",
    );
  }

  if ("AnalyticsModes" in analyticsBehavior) {
    if (
      !Array.isArray(analyticsBehavior.AnalyticsModes)
      || analyticsBehavior.AnalyticsModes.length !== 1
      || analyticsBehavior.AnalyticsModes[0] !== "ContactLens"
    ) {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" only supports ChatAnalyticsBehavior.AnalyticsModes of ["ContactLens"].`,
      );
    }
  }

  if ("InFlightChatRedactionConfiguration" in analyticsBehavior) {
    const redactionConfig = analyticsBehavior.InFlightChatRedactionConfiguration;
    if (!isObject(redactionConfig)) {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" requires InFlightChatRedactionConfiguration to be an object when provided.`,
      );
    }

    validateTrueFalseField(
      action,
      redactionConfig.Enabled,
      "ChatBehavior.ChatAnalyticsBehavior.InFlightChatRedactionConfiguration.Enabled",
    );

    if ("DeliverUnprocessedMessages" in redactionConfig) {
      validateTrueFalseField(
        action,
        redactionConfig.DeliverUnprocessedMessages,
        "ChatBehavior.ChatAnalyticsBehavior.InFlightChatRedactionConfiguration.DeliverUnprocessedMessages",
      );
    }
  }
}

function validateScreenRecordingBehavior(action: FlowAction, screenRecordingBehavior: Record<string, unknown>): void {
  if (!Array.isArray(screenRecordingBehavior.ScreenRecordedParticipants)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" requires ScreenRecordedParticipants to be an array.`,
    );
  }

  for (const participant of screenRecordingBehavior.ScreenRecordedParticipants) {
    if (participant !== "Agent") {
      throw new Error(
        `Action "${action.id}" of type "UpdateContactRecordingAndAnalyticsBehavior" only supports Agent in ScreenRecordedParticipants.`,
      );
    }
  }
}

function isLikelyJsonPath(value: string): boolean {
  return /^\$(\.|\[)/.test(value);
}

function validateUpdateRoutingCriteriaAction(action: FlowAction): void {
  const routingCriteria = action.parameters.RoutingCriteria;

  if (typeof routingCriteria === "string") {
    if (routingCriteria.trim().length === 0) {
      throw new Error(
        `Action "${action.id}" of type "UpdateRoutingCriteria" requires a non-empty RoutingCriteria JSONPath string.`,
      );
    }
    return;
  }

  if (!isObject(routingCriteria)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateRoutingCriteria" requires RoutingCriteria to be an object or a JSONPath string.`,
    );
  }

  const criteria = routingCriteria as unknown as RoutingCriteriaObject;
  if (!Array.isArray(criteria.Steps) || criteria.Steps.length === 0) {
    throw new Error(
      `Action "${action.id}" of type "UpdateRoutingCriteria" requires RoutingCriteria.Steps to contain at least one step.`,
    );
  }

  for (const step of criteria.Steps) {
    validateRoutingCriteriaStep(action, step);
  }
}

function validateRoutingCriteriaStep(action: FlowAction, step: RoutingCriteriaStep): void {
  if (!isObject(step.Expression)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateRoutingCriteria" requires every step to include an Expression.`,
    );
  }

  const hasAttributeCondition = isObject(step.Expression.AttributeCondition);
  const hasAndExpression = Array.isArray(step.Expression.AndExpression);

  if (hasAttributeCondition === hasAndExpression) {
    throw new Error(
      `Action "${action.id}" of type "UpdateRoutingCriteria" requires each step Expression to define exactly one of AttributeCondition or AndExpression.`,
    );
  }

  if (hasAttributeCondition) {
    validateRoutingCriteriaAttributeCondition(action, step.Expression.AttributeCondition as RoutingCriteriaAttributeCondition);
  }

  if (hasAndExpression) {
    const andConditions = step.Expression.AndExpression as RoutingCriteriaAttributeCondition[];
    if (andConditions.length === 0) {
      throw new Error(
        `Action "${action.id}" of type "UpdateRoutingCriteria" requires AndExpression to contain at least one attribute condition.`,
      );
    }
    for (const condition of andConditions) {
      validateRoutingCriteriaAttributeCondition(action, condition);
    }
  }

  const duration = step.Expiry?.DurationInSeconds;
  if (!Number.isInteger(duration) || (duration ?? 0) <= 0) {
    throw new Error(
      `Action "${action.id}" of type "UpdateRoutingCriteria" requires every step expiry duration to be a positive integer.`,
    );
  }
}

function validateRoutingCriteriaAttributeCondition(
  action: FlowAction,
  condition: RoutingCriteriaAttributeCondition,
): void {
  if (typeof condition.Name !== "string" || condition.Name.length < 1 || condition.Name.length > 64) {
    throw new Error(
      `Action "${action.id}" of type "UpdateRoutingCriteria" requires attribute condition Name to be 1-64 characters.`,
    );
  }

  if (typeof condition.Value !== "string" || condition.Value.length < 1 || condition.Value.length > 64) {
    throw new Error(
      `Action "${action.id}" of type "UpdateRoutingCriteria" requires attribute condition Value to be 1-64 characters.`,
    );
  }

  if (![1, 2, 3, 4, 5].includes(condition.ProficiencyLevel)) {
    throw new Error(
      `Action "${action.id}" of type "UpdateRoutingCriteria" requires ProficiencyLevel to be between 1 and 5.`,
    );
  }

  if (condition.ComparisonOperator !== "NumberGreaterOrEqualTo") {
    throw new Error(
      `Action "${action.id}" of type "UpdateRoutingCriteria" only supports ComparisonOperator "NumberGreaterOrEqualTo".`,
    );
  }
}

function validateShowViewAction(action: FlowAction): void {
  const viewResource = action.parameters.ViewResource;

  if (!isObject(viewResource)) {
    throw new Error(`Action "${action.id}" of type "ShowView" requires ViewResource to be an object.`);
  }

  if (
    typeof viewResource.Id !== "string"
    || viewResource.Id.trim().length === 0
    || typeof viewResource.Version !== "string"
    || viewResource.Version.trim().length === 0
  ) {
    throw new Error(
      `Action "${action.id}" of type "ShowView" requires ViewResource.Id and ViewResource.Version to be non-empty strings.`,
    );
  }

  if ("InvocationTimeLimitSeconds" in action.parameters) {
    const timeLimit = action.parameters.InvocationTimeLimitSeconds;
    if (!Number.isInteger(timeLimit) || (timeLimit as number) <= 0) {
      throw new Error(
        `Action "${action.id}" of type "ShowView" requires InvocationTimeLimitSeconds to be a positive integer when provided.`,
      );
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
