import { BaseActionBuilder } from "../common.js";
export const LOAD_CONTACT_CONTENT_TYPES = [
    "EmailMessage",
];
export class LoadContactContentActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "LoadContactContent");
    }
    contentType(value) {
        return this.setParameter("ContentType", value);
    }
    emailMessage() {
        return this.contentType("EmailMessage");
    }
}
