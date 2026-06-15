import type { OutboundCallStatusOperand } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const OUTBOUND_CALL_STATUS_OPERANDS: readonly ["CallAnswered", "VoicemailBeep", "VoicemailNoBeep", "NotDetected"];
export declare class CheckOutboundCallStatusActionBuilder extends BaseActionBuilder<CheckOutboundCallStatusActionBuilder> {
    constructor(id: string);
    onStatus(status: OutboundCallStatusOperand, nextAction: string): this;
    whenCallAnswered(nextAction: string): this;
    whenVoicemailBeep(nextAction: string): this;
    whenVoicemailNoBeep(nextAction: string): this;
    whenNotDetected(nextAction: string): this;
}
