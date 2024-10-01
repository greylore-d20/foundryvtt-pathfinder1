import { FormulaField } from "@model/fields/_module.mjs";

/**
 * DataModel for Changes
 */
export class ChangeModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      _id: new fields.StringField({ required: true, default: randomID(8) }),
      formula: new FormulaField(),
      modifier: new fields.StringField({ blank: true }),
      operator: new fields.StringField({ choices: ["add", "set", "script", "+", "="], initial: "add" }),
      priority: new fields.NumberField({ integer: true, initial: 0, required: false }),
      subTarget: new fields.StringField({ required: false }),
    };
  }

  get id() {
    return this._id;
  }

  get isActive() {
    return this.formula.length > 0 && this.modifier.length > 0 && this.subTarget.length > 0;
  }

  // Migrates only in-memory, should be replaced with proper migration
  static migrateData(source) {
    super.migrateData(source);
    if (source.operator === "+") source.operator = "add";
    else if (source.operator === "=") source.operator = "set";
  }
}
