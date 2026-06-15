import { BaseActionBuilder } from "../common.js";

export class InvokeLambdaFunctionActionBuilder extends BaseActionBuilder<InvokeLambdaFunctionActionBuilder> {
  constructor(id: string) {
    super(id, "InvokeLambdaFunction");
  }

  lambdaArn(value: string): this {
    return this.setParameter("LambdaFunctionARN", value);
  }
}
