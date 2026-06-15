import type { MediaDirection, MediaStreamingState } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const MEDIA_STREAMING_STATES: readonly ["Enabled", "Disabled"];
export declare const MEDIA_DIRECTIONS: readonly ["From", "To"];
export declare class UpdateContactMediaStreamingBehaviorActionBuilder extends BaseActionBuilder<UpdateContactMediaStreamingBehaviorActionBuilder> {
    constructor(id: string);
    enabled(): this;
    disabled(): this;
    state(value: MediaStreamingState): this;
    participantCustomer(...directions: MediaDirection[]): this;
    audioStream(): this;
}
