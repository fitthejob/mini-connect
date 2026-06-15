import { BaseActionBuilder } from "../common.js";
export const PREVIOUS_CONTACT_PARTICIPANT_STATES = [
    "AgentOnHold",
    "CustomerOnHold",
    "OffHold",
];
export class UpdatePreviousContactParticipantStateActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "UpdatePreviousContactParticipantState");
    }
    state(value) {
        return this.setParameter("PreviousContactParticipantState", value);
    }
    agentOnHold() {
        return this.state("AgentOnHold");
    }
    customerOnHold() {
        return this.state("CustomerOnHold");
    }
    offHold() {
        return this.state("OffHold");
    }
}
