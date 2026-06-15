import { BaseActionBuilder } from "../common.js";
export const FLOW_LOGGING_BEHAVIORS = [
    "Enabled",
    "Disabled",
];
export class UpdateFlowLoggingBehaviorActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "UpdateFlowLoggingBehavior");
    }
    enabled() {
        return this.setParameter("FlowLoggingBehavior", "Enabled");
    }
    disabled() {
        return this.setParameter("FlowLoggingBehavior", "Disabled");
    }
    behavior(value) {
        return this.setParameter("FlowLoggingBehavior", value);
    }
}
