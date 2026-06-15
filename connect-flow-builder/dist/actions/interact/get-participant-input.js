import { BaseActionBuilder } from "../common.js";
export class GetParticipantInputActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "GetParticipantInput");
    }
    text(value) {
        return this.setParameter("Text", value);
    }
    lexBotAliasArn(value) {
        return this.setParameter("LexV2Bot", value);
    }
}
