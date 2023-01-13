/**
 * Model for item.system.links contents
 */
export class LinkDataModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      id: new fields.StringField({ blank: false, required: false }),
      uuid: new fields.StringField({ blank: false, required: false }),
      name: new fields.StringField({ blank: false, required: false }),
      img: new fields.StringField({ blank: false, required: false }),
    };
  }
}
