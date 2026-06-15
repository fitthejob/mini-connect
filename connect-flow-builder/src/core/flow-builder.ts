import { validateFlowDefinition } from "./validators.js";
import type {
  ConnectFlowAction,
  ConnectFlowDefinition,
  FlowAction,
  FlowDefinition,
  FlowMetadata,
  FlowSegment,
} from "./types.js";

export class FlowBuilder {
  private readonly name: string;
  private readonly actions = new Map<string, FlowAction>();
  private startActionId?: string;
  private metadata?: FlowMetadata;

  constructor(name: string) {
    this.name = name;
  }

  startWith(actionOrId: FlowAction | string): this {
    this.startActionId = typeof actionOrId === "string" ? actionOrId : actionOrId.id;
    if (typeof actionOrId !== "string") {
      this.add(actionOrId);
    }
    return this;
  }

  add(action: FlowAction): this {
    this.actions.set(action.id, action);
    return this;
  }

  addMany(actions: FlowAction[]): this {
    for (const action of actions) {
      this.add(action);
    }
    return this;
  }

  use(segment: FlowSegment): this {
    if (!this.startActionId) {
      this.startActionId = segment.startActionId;
    }
    return this.addMany(segment.actions);
  }

  withMetadata(metadata: FlowMetadata): this {
    this.metadata = metadata;
    return this;
  }

  build(): BuiltFlow {
    const definition: FlowDefinition = {
      version: "2019-10-30",
      startAction: this.startActionId ?? "",
      actions: [...this.actions.values()],
      metadata: this.metadata,
    };
    validateFlowDefinition(definition);
    return new BuiltFlow(this.name, definition);
  }
}

export class BuiltFlow {
  readonly name: string;
  readonly definition: FlowDefinition;

  constructor(name: string, definition: FlowDefinition) {
    this.name = name;
    this.definition = definition;
  }

  toConnectDefinition(): ConnectFlowDefinition {
    return {
      Version: this.definition.version,
      StartAction: this.definition.startAction,
      Metadata: this.definition.metadata,
      Actions: this.definition.actions.map((action) => this.toConnectAction(action)),
    };
  }

  toJsonString(pretty = true): string {
    return JSON.stringify(
      this.toConnectDefinition(),
      null,
      pretty ? 2 : undefined,
    );
  }

  private toConnectAction(action: FlowAction): ConnectFlowAction {
    return {
      Identifier: action.id,
      Type: action.type,
      Parameters: action.parameters,
      Transitions: action.transitions
        ? {
            NextAction: action.transitions.nextAction,
            Conditions: action.transitions.conditions?.map((condition) => ({
              NextAction: condition.nextAction,
              Condition: {
                Operator: condition.condition.operator,
                Operands: condition.condition.operands,
              },
            })),
            Errors: action.transitions.errors?.map((error) => ({
              NextAction: error.nextAction,
              ErrorType: error.errorType,
            })),
          }
        : undefined,
    };
  }
}
