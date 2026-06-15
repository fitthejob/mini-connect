import type { PreviousContactParticipantState } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const PREVIOUS_CONTACT_PARTICIPANT_STATES: readonly ["AgentOnHold", "CustomerOnHold", "OffHold"];
export declare class UpdatePreviousContactParticipantStateActionBuilder extends BaseActionBuilder<UpdatePreviousContactParticipantStateActionBuilder> {
    constructor(id: string);
    state(value: PreviousContactParticipantState): this;
    agentOnHold(): this;
    customerOnHold(): this;
    offHold(): this;
}
