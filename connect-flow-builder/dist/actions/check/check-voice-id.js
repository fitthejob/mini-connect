import { equalsCondition } from "../../core/conditions.js";
import { BaseActionBuilder } from "../common.js";
export const CHECK_VOICE_ID_OPTIONS = [
    "enrollmentStatus",
    "voiceAuthentication",
    "fraudDetection",
];
export class CheckVoiceIdActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "CheckVoiceId");
    }
    option(value) {
        return this.setParameter("CheckVoiceIdOption", value);
    }
    enrollmentStatus() {
        return this.option("enrollmentStatus");
    }
    voiceAuthentication() {
        return this.option("voiceAuthentication");
    }
    fraudDetection() {
        return this.option("fraudDetection");
    }
    whenStatusEquals(status, nextAction) {
        this.when(equalsCondition(status), nextAction);
        return this;
    }
}
