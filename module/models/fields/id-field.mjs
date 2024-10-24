export class IDField extends foundry.data.fields.StringField {
  constructor(options = {}, context) {
    if (options.choices) throw new Error("choices is not valid option for IDField");
    super(options, context);
  }

  static get _defaults() {
    const defaults = super._defaults;
    defaults.required = true;
    defaults.nullable = false;
    defaults.blank = false;
    defaults.readonly = true;
    defaults.initial = () => foundry.utils.randomID(16);
    return defaults;
  }

  _validateType(value) {
    if (typeof value !== "string") throw new Error("must be a string");
    if (!/^[a-z\d]+$/i.test(value)) throw new Error("must be alphanumeric");
  }
}
