import type { WaitEvent } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const WAIT_EVENTS: readonly ["CustomerReturned", "BotParticipantDisconnected"];
export declare class WaitActionBuilder extends BaseActionBuilder<WaitActionBuilder> {
    constructor(id: string);
    timeoutSeconds(value: number | string): this;
    events(...events: WaitEvent[]): this;
    onWaitCompleted(nextAction: string): this;
    onEvent(event: WaitEvent, nextAction: string): this;
}
