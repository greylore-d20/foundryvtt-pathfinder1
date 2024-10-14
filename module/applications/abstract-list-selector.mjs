const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Offers a dynamic list selector that allows the user to add new entries and delete existing entries
 *
 * @augments {DocumentSheetV2&HandlebarsApplicationMixin}
 * @abstract
 */
export class AbstractListSelector extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: AbstractListSelector._save,
      closeOnSubmit: true,
      submitOnClose: false,
    },
    classes: ["pf1-v2", "list-selector"],
    window: {
      minimizable: false,
      resizable: true,
    },
    actions: {
      addEntry: AbstractListSelector._onAddEntry,
      deleteEntry: AbstractListSelector._onDeleteEntry,
    },
    position: {
      width: 600,
    },
    sheetConfig: false,
  };

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    return {
      document: this.document,
      id: this.name,
      entries: this.entries,
      fields: this.fields,
      dtypes: this.dtypes,
      buttons: [{ type: "submit", label: "PF1.Save", icon: "far fa-save" }],
    };
  }

  /* -------------------------------------------- */

  /**
   * Alias the name property
   *
   * @type {string}
   */
  get attribute() {
    return this.options.name;
  }

  /* -------------------------------------------- */

  /**
   * Get the list of fields
   *
   * @type {string[]}
   */
  get fields() {
    return this.options.fields.split(";");
  }

  /* -------------------------------------------- */

  /**
   * Get the list of data types
   *
   * @type {string[]}
   */
  get dtypes() {
    return this.options.dtypes.split(";");
  }

  /* -------------------------------------------- */

  /**
   * Get the data entry length
   *
   * @type {number}
   */
  get dataCount() {
    return this.fields.length;
  }

  /* -------------------------------------------- */

  /**
   * Provides default data for a new list entry
   *
   * @abstract
   * @param event
   * @protected
   * @returns {object}
   */
  _getNewEntry(event) {
    return {};
  }

  /* -------------------------------------------- */

  /**
   * Add a new entry to the list
   *
   * @param event
   * @static
   * @internal
   * @this {AbstractListSelector&DocumentSheetV2}
   * @returns {Promise<void>}
   */
  static async _onAddEntry(event) {
    event.preventDefault();
    this.entries.push(this._getNewEntry(event));
    return this.render();
  }

  /* -------------------------------------------- */

  /**
   * Delete an existing entry from the list
   *
   * @param event
   * @static
   * @internal
   * @this {AbstractListSelector&DocumentSheetV2}
   * @returns {Promise<void>}
   */
  static async _onDeleteEntry(event) {
    event.preventDefault();
    const a = event.target;

    const tr = a.closest("tr");
    const index = parseInt(tr.dataset.index);
    this.entries.splice(index, 1);
    return this.render();
  }

  /* -------------------------------------------- */

  /**
   * Update internal data snapshot on form change
   *
   * @param formConfig
   * @param event
   * @override
   * @internal
   * @this {AbstractListSelector&DocumentSheetV2}
   * @returns {Promise<void>}
   */
  async _onChangeForm(formConfig, event) {}

  /* -------------------------------------------- */

  /**
   * Provides update data for saves
   *
   * @abstract
   * @protected
   * @returns {object}
   */
  _getUpdateData() {
    return {};
  }

  /* -------------------------------------------- */

  /**
   * Save the new data back to the document.
   *
   * @internal
   * @this {AbstractListSelector&DocumentSheetV2}
   * @param {SubmitEvent} event               The originating form submission event
   * @param {HTMLFormElement} form            The form element that was submitted
   * @param {FormDataExtended} formData       Processed data for the submitted form
   * @param {object} formData.object          The object of the form
   * @returns {Promise<void>}
   */
  static async _save(event, form, formData) {
    this.document.update(this._getUpdateData());
  }
}
