import type { ContactEventHookType } from "../../core/types.js";
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
] as const satisfies readonly ContactEventHookType[];

export class UpdateContactEventHooksActionBuilder extends BaseActionBuilder<UpdateContactEventHooksActionBuilder> {
  constructor(id: string) {
    super(id, "UpdateContactEventHooks");
  }

  eventHook(type: ContactEventHookType, flowIdOrArn: string): this {
    return this.setParameter("EventHooks", {
      [type]: flowIdOrArn,
    });
  }
}
