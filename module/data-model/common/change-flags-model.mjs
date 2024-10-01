export class ChangeFlagsModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      heavyArmorFullSpeed: new fields.BooleanField({ required: false }),
      loseDexToAC: new fields.BooleanField({ required: false }),
      mediumArmorFullSpeed: new fields.BooleanField({ required: false }),
      noEncumbrance: new fields.BooleanField({ required: false }),
    };
  }
}
