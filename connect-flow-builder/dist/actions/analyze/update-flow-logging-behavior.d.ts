import type { FlowLoggingBehavior } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const FLOW_LOGGING_BEHAVIORS: readonly ["Enabled", "Disabled"];
export declare class UpdateFlowLoggingBehaviorActionBuilder extends BaseActionBuilder<UpdateFlowLoggingBehaviorActionBuilder> {
    constructor(id: string);
    enabled(): this;
    disabled(): this;
    behavior(value: FlowLoggingBehavior): this;
}
