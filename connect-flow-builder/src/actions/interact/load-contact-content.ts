import type { LoadContactContentType } from "../../core/types.js";
import { BaseActionBuilder } from "../common.js";

export const LOAD_CONTACT_CONTENT_TYPES = [
  "EmailMessage",
] as const satisfies readonly LoadContactContentType[];

export class LoadContactContentActionBuilder extends BaseActionBuilder<LoadContactContentActionBuilder> {
  constructor(id: string) {
    super(id, "LoadContactContent");
  }

  contentType(value: LoadContactContentType): this {
    return this.setParameter("ContentType", value);
  }

  emailMessage(): this {
    return this.contentType("EmailMessage");
  }
}
