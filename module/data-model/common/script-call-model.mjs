export class ScriptCallModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      _id: new fields.StringField({ blank: false, required: true }),
      name: new fields.StringField({ blank: false, required: true }),
      type: new fields.StringField({ blank: false, required: true }),
      value: new fields.StringField({ blank: true, required: false }),
      category: new fields.StringField({ blank: false, required: true }),
      hidden: new fields.BooleanField({ required: false }),
      img: new fields.StringField({ required: false }),
    };
  }

  get id() {
    return this._id;
  }
}
