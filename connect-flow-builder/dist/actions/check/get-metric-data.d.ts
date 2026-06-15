import type { QueueChannel } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const QUEUE_CHANNELS: readonly ["Voice", "Chat"];
export declare class GetMetricDataActionBuilder extends BaseActionBuilder<GetMetricDataActionBuilder> {
    constructor(id: string);
    queueId(value: string): this;
    agentId(value: string): this;
    useCurrentTargetQueue(): this;
    queueChannel(value: QueueChannel): this;
    voiceChannel(): this;
    chatChannel(): this;
}
