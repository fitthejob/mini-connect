import type { PersistentContactRehydrationType } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const PERSISTENT_CONTACT_REHYDRATION_TYPES: readonly ["ENTIRE_PAST_SESSION", "FROM_SEGMENT"];
export declare class CreatePersistentContactAssociationActionBuilder extends BaseActionBuilder<CreatePersistentContactAssociationActionBuilder> {
    constructor(id: string);
    rehydrationType(value: PersistentContactRehydrationType): this;
    entirePastSession(): this;
    fromSegment(): this;
    sourceContactId(value: string): this;
}
