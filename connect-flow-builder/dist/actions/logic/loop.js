import { equalsCondition } from "../../core/conditions.js";
import { BaseActionBuilder } from "../common.js";
export const LOOP_OPERANDS = [
    "ContinueLooping",
    "DoneLooping",
];
export class LoopActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "Loop");
    }
    loopCount(value) {
        return this.setParameter("LoopCount", value);
    }
    whenContinueLooping(nextAction) {
        this.when(equalsCondition("ContinueLooping"), nextAction);
        return this;
    }
    whenDoneLooping(nextAction) {
        this.when(equalsCondition("DoneLooping"), nextAction);
        return this;
    }
}
