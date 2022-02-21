export class ChangeWidget_Base extends FormApplication {
  constructor(object = {}, options = {}) {
    super(object, options);

    /**
     * @property
     * Tracks the new info.
     */
    this._data = JSON.parse(object.formula);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      closeOnSubmit: true,
      editable: true,
      submitOnChange: false,
      submitOnClose: true,
    });
  }

  get item() {
    return this.object.parent;
  }

  get actor() {
    return this.item.actor;
  }

  static async getBanner(change) {
    console.warn("getBanner should be overwritten", change);
    return "";
  }

  static get defaultValue() {
    console.warn("defaultValue should be overwritten");
    return {};
  }

  _updateObject(event, formData) {
    const data = mergeObject(this._data, expandObject(formData));
    this.object.update({ formula: JSON.stringify(data) });
  }

  /**
   * Perform actor data-altering functionality.
   *
   * @param {ItemChange} change
   * @param {Object} data - The change's formula data.
   */
  static applyChange(change, data) {}

  static getValue(change, data) {
    change.value = 0;
    return 0;
  }

  static getChangeTargets(change, data) {
    return [];
  }
}
