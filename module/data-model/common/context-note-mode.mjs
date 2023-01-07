export class ContextNoteModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      subTarget: new fields.StringField({ required: true }),
      text: new fields.StringField({ required: true }),
    };
  }
}
