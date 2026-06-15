import type { CheckVoiceIdOption } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const CHECK_VOICE_ID_OPTIONS: readonly ["enrollmentStatus", "voiceAuthentication", "fraudDetection"];
export declare class CheckVoiceIdActionBuilder extends BaseActionBuilder<CheckVoiceIdActionBuilder> {
    constructor(id: string);
    option(value: CheckVoiceIdOption): this;
    enrollmentStatus(): this;
    voiceAuthentication(): this;
    fraudDetection(): this;
    whenStatusEquals(status: string, nextAction: string): this;
}
