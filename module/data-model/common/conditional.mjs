import { IdentifierField } from "@model/fields/_module.mjs";
import { ConditionalModifierModel } from "./conditional-modifier.mjs";

/**
 * Conditional DataModel
 */
export class ConditionalModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      _id: new IdentifierField({ strict: true }),
      name: new fields.StringField(),
      default: new fields.BooleanField({ required: false }), // Default: false
      modifiers: new fields.ArrayField(new fields.EmbeddedDataField(ConditionalModifierModel)),
    };
  }
}
