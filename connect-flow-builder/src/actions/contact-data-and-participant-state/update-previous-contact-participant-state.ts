import type { PreviousContactParticipantState } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";

export const PREVIOUS_CONTACT_PARTICIPANT_STATES = [
  "AgentOnHold",
  "CustomerOnHold",
  "OffHold",
] as const satisfies readonly PreviousContactParticipantState[];

export class UpdatePreviousContactParticipantStateActionBuilder extends BaseActionBuilder<UpdatePreviousContactParticipantStateActionBuilder> {
  constructor(id: string) {
    super(id, "UpdatePreviousContactParticipantState");
  }

  state(value: PreviousContactParticipantState): this {
    return this.setParameter("PreviousContactParticipantState", value);
  }

  agentOnHold(): this {
    return this.state("AgentOnHold");
  }

  customerOnHold(): this {
    return this.state("CustomerOnHold");
  }

  offHold(): this {
    return this.state("OffHold");
  }
}
