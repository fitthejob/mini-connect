import { BaseActionBuilder } from "../common.js";
export const PERSISTENT_CONTACT_REHYDRATION_TYPES = [
    "ENTIRE_PAST_SESSION",
    "FROM_SEGMENT",
];
export class CreatePersistentContactAssociationActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "CreatePersistentContactAssociation");
    }
    rehydrationType(value) {
        return this.setParameter("RehydrationType", value);
    }
    entirePastSession() {
        return this.rehydrationType("ENTIRE_PAST_SESSION");
    }
    fromSegment() {
        return this.rehydrationType("FROM_SEGMENT");
    }
    sourceContactId(value) {
        return this.setParameter("SourceContactId", value);
    }
}
