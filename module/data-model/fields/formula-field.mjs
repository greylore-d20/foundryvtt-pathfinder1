/**
 * Custom field for identifying and possibly validating formulas.
 *
 * The formula could be validated immediately, but it would invalidate the document which is undesirable.
 */
export class FormulaField extends foundry.data.fields.StringField {
  // TODO
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: false,
      initial: undefined,
    });
  }
}
