import { PreparedModel } from "./prepared-model.mjs";

import { IDField } from "@datafields/id-field.mjs";

/**
 * DataModel to mimic basic document-like behaviour.
 *
 * Calls {@link prepareData()} on initialization and on {@link reset()}
 *
 * Also handles `_id` nicely.
 */
export class DocumentLikeModel extends PreparedModel {
  static defineSchema(options) {
    const fields = foundry.data.fields;
    return {
      _id: new IDField(),
      name: new fields.StringField({
        required: true,
        blank: false,
        nullable: false,
        initial: options.name,
      }),
    };
  }

  /** @type {string} - Internal ID */
  get id() {
    return this._id;
  }
}
