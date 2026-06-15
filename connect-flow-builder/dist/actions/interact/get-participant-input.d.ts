import { BaseActionBuilder } from "../common.js";
export declare class GetParticipantInputActionBuilder extends BaseActionBuilder<GetParticipantInputActionBuilder> {
    constructor(id: string);
    text(value: string): this;
    lexBotAliasArn(value: string): this;
}
