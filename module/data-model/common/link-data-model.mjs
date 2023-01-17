import { IdentifierField } from "@model/fields/_module.mjs";

/**
 * Model for item.system.links contents
 */
export class LinkDataModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      id: new IdentifierField({ required: false }),
      //uuid: new fields.StringField({ required: false }), // Added by !899
      dataType: new fields.StringField({ required: false }), // Removed by !899
      name: new fields.StringField({ required: false }),
      level: new fields.NumberField({ min: 1, integer: true, required: false }),
      img: new fields.StringField({ required: false }),
    };
  }
}
