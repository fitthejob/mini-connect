import type { FlowLoggingBehavior } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";

export const FLOW_LOGGING_BEHAVIORS = [
  "Enabled",
  "Disabled",
] as const satisfies readonly FlowLoggingBehavior[];

export class UpdateFlowLoggingBehaviorActionBuilder extends BaseActionBuilder<UpdateFlowLoggingBehaviorActionBuilder> {
  constructor(id: string) {
    super(id, "UpdateFlowLoggingBehavior");
  }

  enabled(): this {
    return this.setParameter("FlowLoggingBehavior", "Enabled");
  }

  disabled(): this {
    return this.setParameter("FlowLoggingBehavior", "Disabled");
  }

  behavior(value: FlowLoggingBehavior): this {
    return this.setParameter("FlowLoggingBehavior", value);
  }
}
