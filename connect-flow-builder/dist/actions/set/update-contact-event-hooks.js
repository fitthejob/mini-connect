import { BaseActionBuilder } from "../common.js";
export const CONTACT_EVENT_HOOK_TYPES = [
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
];
export class UpdateContactEventHooksActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "UpdateContactEventHooks");
    }
    eventHook(type, flowIdOrArn) {
        return this.setParameter("EventHooks", {
            [type]: flowIdOrArn,
        });
    }
}
