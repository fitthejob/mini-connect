import type { CustomerProfileSearchCriterion, LogicalOperator } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";

export const LOGICAL_OPERATORS = [
  "AND",
  "OR",
] as const satisfies readonly LogicalOperator[];

export class GetCustomerProfileActionBuilder extends BaseActionBuilder<GetCustomerProfileActionBuilder> {
  constructor(id: string) {
    super(id, "GetCustomerProfile");
    this.setParameter("ProfileRequestData", {});
  }

  identifier(name: string, value: string): this {
    return this.setParameter("ProfileRequestData", {
      IdentifierName: name,
      IdentifierValue: value,
    });
  }

  searchCriteria(criteria: CustomerProfileSearchCriterion[], logicalOperator: LogicalOperator): this {
    return this.setParameter("ProfileRequestData", {
      SearchCriteria: criteria,
      LogicalOperator: logicalOperator,
    });
  }

  addSearchCriterion(name: string, value: string): this {
    const requestData =
      this.getParameter<Record<string, unknown>>("ProfileRequestData");
    delete requestData.IdentifierName;
    delete requestData.IdentifierValue;
    const criteria =
      (requestData.SearchCriteria as CustomerProfileSearchCriterion[] | undefined)
      ?? [];
    criteria.push({
      IdentifierName: name,
      IdentifierValue: value,
    });
    requestData.SearchCriteria = criteria;
    return this;
  }

  logicalOperator(value: LogicalOperator): this {
    const requestData =
      this.getParameter<Record<string, unknown>>("ProfileRequestData");
    requestData.LogicalOperator = value;
    return this;
  }

  responseField(key: string): this {
    const data =
      this.getParameter<Record<string, boolean> | undefined>("ProfileResponseData")
      ?? {};
    data[key] = true;
    return this.setParameter("ProfileResponseData", data);
  }
}
