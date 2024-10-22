import { CompactingMixin } from "@models/abstract/compacting-mixin.mjs";

export class DamagePartModel extends CompactingMixin(foundry.abstract.DataModel) {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      formula: new fields.StringField(),
      type: new fields.SchemaField({
        values: new fields.ArrayField(new fields.StringField()),
        custom: new fields.StringField(),
      }),
    };
  }

  /**
   * Prune data
   *
   * @param {object} data
   */
  static pruneData(data) {
    if (!data.formula) delete data.formula;
    if (data.type) {
      if (!data.type.custom) delete data.type?.custom;
      if (data.type.values?.length) {
        data.type.values = data.type.values.map((v) => v.trim()).filter((v) => !!v);
      }
      if (!(data.type.values?.length > 0)) delete data.type.values;
      if (Object.keys(data.type).length == 0) delete data.type;
    }
  }
}
