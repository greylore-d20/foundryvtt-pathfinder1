/**
 * Custom string field for IDs and tags.
 */
export class IdentifierField extends foundry.data.fields.StringField {
  static get _defaults() {
    return mergeObject(super._defaults, {
      initial: undefined,
      required: false,
      blank: false,
      length: null,
      nullable: true,
      validationError: "is not a valid identifier",
      strict: false,
    });
  }

  /** @override */
  _validateType(value) {
    if (value == null) return;

    if (this.options.strict) {
      // Test for ID style strings with very specific limits (match products of NeDB ID generation and randomID()).
      if (!/^[a-zA-Z0-9]*$/.test(value)) {
        throw new Error("Identifier must be simple latin alphanumeric string");
      }
    } else {
      // Test for more relaxed strings suitable for tags
      if (!/^[\w\d_-]*$/.test(value)) {
        throw new Error("Identifier must be simple alphanumeric string optionally with dashes and underscores");
      }
    }

    if (this.length > 0 && value.length !== this.length)
      throw new Error(`Identifier is must have length of ${this.length}`);
  }
}
