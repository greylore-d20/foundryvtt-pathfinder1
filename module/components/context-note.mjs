/**
 * @property {string} text - Note contents
 * @property {string} subTaget - Note subject
 */
export class ContextNote extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      text: new fields.StringField({ initial: "", nullable: false, blank: true }),
      subTarget: new fields.StringField({ initial: "", nullable: false, blank: true }),
    };
  }
}
