import type { CustomerProfileSearchCriterion, LogicalOperator } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const LOGICAL_OPERATORS: readonly ["AND", "OR"];
export declare class GetCustomerProfileActionBuilder extends BaseActionBuilder<GetCustomerProfileActionBuilder> {
    constructor(id: string);
    identifier(name: string, value: string): this;
    searchCriteria(criteria: CustomerProfileSearchCriterion[], logicalOperator: LogicalOperator): this;
    addSearchCriterion(name: string, value: string): this;
    logicalOperator(value: LogicalOperator): this;
    responseField(key: string): this;
}
