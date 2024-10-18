const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ScriptEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: ScriptEditor._updateObject,
      closeOnSubmit: true,
    },
    classes: ["pf1-v2", "script-editor"],
    window: {
      minimizable: false,
      resizable: true,
    },
    position: {
      width: 640,
      height: 560,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/script-editor.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  constructor(options = {}) {
    super(options);

    this.command = options.command || "";
    this.name = options.name || null;

    this.parent = options.parent;
    this.script = options.script;

    this._promises = {
      submit: [],
    };
  }

  /* -------------------------------------------- */

  /**
   * Get the window title
   *
   * @returns {string}
   */
  get title() {
    return this.name
      ? this.parent
        ? `${this.parent.name}: ${this.name}`
        : this.name
      : this.parent?.name ?? game.i18n.localize("PF1.Unknown");
  }

  /* -------------------------------------------- */

  /**
   *
   * @returns {string}
   */
  get id() {
    return `script-call-${this.parent.uuid.replaceAll(".", "-")}-id-${this.script}`;
  }

  /* -------------------------------------------- */

  /**
   *
   * @returns {boolean}
   */
  get isEditable() {
    const item = this.parent;
    let editable = this.options.editable && item.isOwner;
    if (item.pack && game.packs.get(item.pack)?.locked) editable = false;
    return editable;
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    return {
      command: this.command || "",
      name: this.name,
      buttons: [{ type: "submit", label: "PF1.Save", icon: "far fa-save" }],
    };
  }

  /* -------------------------------------------- */

  /**
   *
   * @returns {Promise<unknown>}
   */
  awaitResult() {
    let callback;
    const promise = new Promise((resolve) => {
      callback = resolve;
    });
    this._promises.submit.push({ callback, promise, resolved: false });
    return promise;
  }

  /* -------------------------------------------- */

  /**
   * Attach event listeners to the rendered application form.
   *
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onRender(context, options) {
    // Open help browser
    this.element.querySelector("a.help-browser[data-url]").addEventListener("click", this._openHelpBrowser.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Open the help browser to the specified URL.
   *
   * @param {Event} event
   * @private
   */
  _openHelpBrowser(event) {
    event.preventDefault();
    const a = event.currentTarget;
    pf1.applications.helpBrowser.openUrl(a.dataset.url);
  }

  /* -------------------------------------------- */

  /**
   * Update the object with the new change data from the form.
   *
   * @this {ScriptEditor&ApplicationV2}
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @returns {Promise<void>}
   * @private
   */
  static _updateObject(event, form, formData) {
    formData = formData.object;

    this.command = formData["command"];
    this.name = formData["name"] || null;

    const result = {
      command: this.command,
      name: this.name,
    };

    this.resolvePromises("submit", result);
  }

  /* -------------------------------------------- */

  /**
   * Resolve all promises of the given type with the given result.
   *
   * @param type
   * @param result
   */
  resolvePromises(type, result) {
    for (const p of this._promises[type]) {
      if (!p.resolved) {
        p.callback(result);
        p.resolved = true;
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Close the application and resolve any pending submit promises.
   *
   * @param args
   * @returns {Promise<void>}
   */
  async close(...args) {
    super.close(...args);

    this.resolvePromises("submit", null);
  }
}
