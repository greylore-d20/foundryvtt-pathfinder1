import { CompactingMixin } from "@models/abstract/compacting-mixin.mjs";

/**
 * Manual Extra Attack data model
 */
export class ExtraAttackModel extends CompactingMixin(foundry.abstract.DataModel) {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      name: new fields.StringField(),
      formula: new fields.StringField(), // Formula
    };
  }

  static migrateData(source) {
    // Convert very old tuple format
    if (Array.isArray(source)) {
      const [formula, name] = source;
      source = { formula, name };
    }

    return super.migrateData(source);
  }

  /** @override */
  static pruneData(data) {
    if (!data.formula) delete data.formula;
    if (!data.name) delete data.name;
  }
}
