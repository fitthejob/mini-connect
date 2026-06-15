import { equalsCondition } from "../../core/conditions.js";
import { BaseActionBuilder } from "../common.js";
export const WAIT_EVENTS = [
    "CustomerReturned",
    "BotParticipantDisconnected",
];
export class WaitActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "Wait");
    }
    timeoutSeconds(value) {
        return this.setParameter("TimeoutSeconds", value);
    }
    events(...events) {
        return this.setParameter("Events", events);
    }
    onWaitCompleted(nextAction) {
        this.when(equalsCondition("WaitCompleted"), nextAction);
        return this;
    }
    onEvent(event, nextAction) {
        this.when(equalsCondition(event), nextAction);
        return this;
    }
}
