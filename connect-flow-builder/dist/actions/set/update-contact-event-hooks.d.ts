import type { ContactEventHookType } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const CONTACT_EVENT_HOOK_TYPES: readonly ["AgentHold", "AgentWhisper", "CustomerHold", "CustomerQueue", "CustomerRemaining", "CustomerWhisper", "DefaultAgentUI", "DisconnectAgentUI", "PauseContact", "ResumeContact"];
export declare class UpdateContactEventHooksActionBuilder extends BaseActionBuilder<UpdateContactEventHooksActionBuilder> {
    constructor(id: string);
    eventHook(type: ContactEventHookType, flowIdOrArn: string): this;
}
