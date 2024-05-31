export class TextEditor extends DocumentSheet {
  /**
   * @param {Document} doc - Document to link with
   * @param {object} config - Editor configuration
   * @param {string} config.path - Path to save data to
   * @param {Function} [config.callback] - Optional callback to use instead of normal document update
   * @param {object} [appOptions] - Normal application options
   */
  constructor(doc, { path, callback } = {}, appOptions) {
    super(doc, appOptions);

    if (!path) throw new Error("TextEditor requires path parameter to be filled!");

    this.path = path;
    this.callback = callback;
  }

  get title() {
    return `${game.i18n.localize("PF1.Instructions")} – ${this.document.name}`;
  }

  get template() {
    return "systems/pf1/templates/apps/text-editor.hbs";
  }

  get id() {
    const id = this.document.uuid.replaceAll(".", "-");
    const path = this.path.replaceAll(".", "-");
    return `text-editor_${id}_${path}`;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "pf1", "text-editor"],
      height: 520,
      width: 580,
      closeOnSubmit: true,
      submitOnClose: false,
      submitOnChange: false,
      resizable: true,
    };
  }

  getData() {
    return {
      path: this.path,
      editable: this.isEditable,
    };
  }

  _updateObject(event, formData) {
    formData = foundry.utils.expandObject(formData);

    if (this.callback) return this.callback(formData);
    else return super._updateObject(event, formData);
  }
}
