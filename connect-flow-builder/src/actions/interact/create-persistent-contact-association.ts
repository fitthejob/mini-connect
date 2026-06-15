import type { PersistentContactRehydrationType } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";

export const PERSISTENT_CONTACT_REHYDRATION_TYPES = [
  "ENTIRE_PAST_SESSION",
  "FROM_SEGMENT",
] as const satisfies readonly PersistentContactRehydrationType[];

export class CreatePersistentContactAssociationActionBuilder extends BaseActionBuilder<CreatePersistentContactAssociationActionBuilder> {
  constructor(id: string) {
    super(id, "CreatePersistentContactAssociation");
  }

  rehydrationType(value: PersistentContactRehydrationType): this {
    return this.setParameter("RehydrationType", value);
  }

  entirePastSession(): this {
    return this.rehydrationType("ENTIRE_PAST_SESSION");
  }

  fromSegment(): this {
    return this.rehydrationType("FROM_SEGMENT");
  }

  sourceContactId(value: string): this {
    return this.setParameter("SourceContactId", value);
  }
}
