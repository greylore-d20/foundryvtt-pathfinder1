import { IdentifierField, FormulaField } from "@model/fields/_module.mjs";
import { DamageModel } from "./damage-model.mjs";

/**
 * Conditional Modifier DataModel
 */
export class ConditionalModifierModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      _id: new IdentifierField({ strict: true }),
      critical: new fields.StringField({ choices: ["normal", "crit"], required: false }), // Default: "normal",
      formula: new FormulaField(),
      target: new IdentifierField({ required: false }),
      subTarget: new IdentifierField({ required: false }),
      type: new IdentifierField({ required: false }),
      damageType: new fields.EmbeddedDataField(DamageModel, { required: false }),
    };
  }
}
