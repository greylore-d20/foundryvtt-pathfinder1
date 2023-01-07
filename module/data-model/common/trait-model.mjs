export class TraitModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      custom: new fields.StringField({ required: false }),
      value: new fields.ArrayField(new fields.StringField({ blank: true }), { required: false }),
    };
  }

  get all() {
    return [...this.value, ...this.customArray];
  }

  get customArray() {
    return (this.custom || "").split(";").map((t) => t.trim());
  }
}
