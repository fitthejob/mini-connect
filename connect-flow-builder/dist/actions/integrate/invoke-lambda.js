import { BaseActionBuilder } from "../common.js";
export class InvokeLambdaFunctionActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "InvokeLambdaFunction");
    }
    lambdaArn(value) {
        return this.setParameter("LambdaFunctionARN", value);
    }
}
