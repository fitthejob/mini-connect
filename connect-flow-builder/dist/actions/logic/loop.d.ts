import { BaseActionBuilder } from "../common.js";
export declare const LOOP_OPERANDS: readonly ["ContinueLooping", "DoneLooping"];
export declare class LoopActionBuilder extends BaseActionBuilder<LoopActionBuilder> {
    constructor(id: string);
    loopCount(value: number | string): this;
    whenContinueLooping(nextAction: string): this;
    whenDoneLooping(nextAction: string): this;
}
