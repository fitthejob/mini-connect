import { BaseActionBuilder } from "../common.js";

export class GetParticipantInputActionBuilder extends BaseActionBuilder<GetParticipantInputActionBuilder> {
  constructor(id: string) {
    super(id, "GetParticipantInput");
  }

  text(value: string): this {
    return this.setParameter("Text", value);
  }

  lexBotAliasArn(value: string): this {
    return this.setParameter("LexV2Bot", value);
  }
}
