import { equalsCondition } from "../../core/conditions.js";
import type { LoopOperand } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";

export const LOOP_OPERANDS = [
  "ContinueLooping",
  "DoneLooping",
] as const satisfies readonly LoopOperand[];

export class LoopActionBuilder extends BaseActionBuilder<LoopActionBuilder> {
  constructor(id: string) {
    super(id, "Loop");
  }

  loopCount(value: number | string): this {
    return this.setParameter("LoopCount", value);
  }

  whenContinueLooping(nextAction: string): this {
    this.when(equalsCondition("ContinueLooping"), nextAction);
    return this;
  }

  whenDoneLooping(nextAction: string): this {
    this.when(equalsCondition("DoneLooping"), nextAction);
    return this;
  }
}
