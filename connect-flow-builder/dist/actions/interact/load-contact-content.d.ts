import type { LoadContactContentType } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";
export declare const LOAD_CONTACT_CONTENT_TYPES: readonly ["EmailMessage"];
export declare class LoadContactContentActionBuilder extends BaseActionBuilder<LoadContactContentActionBuilder> {
    constructor(id: string);
    contentType(value: LoadContactContentType): this;
    emailMessage(): this;
}
