import type { CheckMetricDataMetricType } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const CHECK_METRIC_DATA_METRIC_TYPES: readonly ["NumberOfAgentsAvailable", "NumberOfAgentsStaffed", "NumberOfAgentsOnline", "OldestContactInQueueAgeSeconds", "NumberOfContactsInQueue"];
export declare class CheckMetricDataActionBuilder extends BaseActionBuilder<CheckMetricDataActionBuilder> {
    constructor(id: string);
    metricType(value: CheckMetricDataMetricType): this;
    numberOfAgentsAvailable(): this;
    numberOfAgentsStaffed(): this;
    numberOfAgentsOnline(): this;
    oldestContactInQueueAgeSeconds(): this;
    numberOfContactsInQueue(): this;
    queueId(value: string): this;
    agentId(value: string): this;
    useCurrentTargetQueue(): this;
    whenMetricGreaterThanZero(nextAction: string): this;
}
