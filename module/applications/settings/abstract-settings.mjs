const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A generic application to render a settings modal.
 *
 * @abstract
 * @augments {ApplicationV2&HandlebarsApplicationMixin}
 */
export class AbstractSettingsApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: AbstractSettingsApplication._save,
      submitOnChange: false,
      closeOnSubmit: true,
      submitOnClose: false,
    },
    classes: ["pf1-v2", "settings"],
    window: {
      minimizable: false,
      resizable: false,
    },
    sheetConfig: false,
  };

  /* -------------------------------------------- */

  /**
   * Initialize the configuration for this application. Override the default ID to be unique to this
   * settings app instance and tack on extra class.
   *
   * @override
   * @param {ApplicationConfiguration} options    The provided configuration options for the Application
   * @returns {ApplicationConfiguration}           The final configuration values for the application
   */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);

    options.id = options.configKey.replace("Config", "").toLowerCase() + "-config";
    options.classes = options.classes || [];
    options.classes.push(options.id);

    return options;
  }

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    return {
      buttons: [
        { type: "submit", label: "PF1.Save", icon: "far fa-save" },
        { type: "reset", action: "reset", label: "PF1.Reset", icon: "far fa-undo" },
      ],
    };
  }

  /* -------------------------------------------- */

  /**
   * The event handler for changes to form input elements
   *
   * @internal
   * @param {ApplicationFormConfiguration} formConfig   The configuration of the form being changed
   * @param {Event} event                               The triggering event
   * @returns {void}
   */
  _onChangeForm(formConfig, event) {
    this._updateSliderInputs(event);
    this._updateConflicts(event);
    this._updateHiddenElements(event);
  }

  /* -------------------------------------------- */

  /**
   * Attach hooks to rendered HTML.
   *
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onRender(context, options) {
    this.element.addEventListener("reset", this._onFormReset.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * The event handler that is fired when the form is reset to its original values
   *
   * @internal
   * @param {Event} event                               The triggering event
   * @returns {void}
   */
  _onFormReset(event) {
    // Delay execution to fire _after_ form has been reset
    setTimeout(() => {
      this._updateSliderInputs(event);
      this._updateConflicts(event);
      this._updateHiddenElements(event);
    }, 1);
  }

  /* -------------------------------------------- */

  /**
   * Display conflic warnings based on the value of inputs.
   *
   * @param {Event} event
   * @private
   */
  _updateConflicts(event) {
    const conflictElements = this.element.querySelectorAll("[data-conflict]");
    const seenElements = [];

    for (const element of conflictElements) {
      if (seenElements.includes(element)) continue;

      const conflictSelector = element.getAttribute("data-conflict");
      const conflictElement = this.element.querySelector(conflictSelector);

      let value = element.matches('input[type="checkbox"') ? +element.checked : element.value;
      let conflictValue = conflictElement.matches('input[type="checkbox"')
        ? +conflictElement.checked
        : conflictElement.value;

      [value, conflictValue] = [value, conflictValue].map((v) => (isNaN(v) ? v : parseInt(v)));

      const warningContainer =
        element.closest(".form-group").querySelector(".conflict-warning") ||
        conflictElement.closest(".form-group").querySelector(".conflict-warning");

      warningContainer.classList[!!value && !!conflictValue ? "remove" : "add"]("hidden");

      seenElements.push(element, conflictElement);
    }
  }

  /* -------------------------------------------- */

  /**
   * Hide form components based on the value of inputs.
   *
   * @param {Event} event
   * @private
   */
  _updateHiddenElements(event) {
    const hidingElements = this.element.querySelectorAll("input[data-hide]");
    for (const element of hidingElements) {
      const value = element.matches('input[type="checkbox"') ? +element.checked : element.value;
      const hideOnValue = element.dataset.hideOn || 0;

      const hideSelector = element.dataset.hide;
      const hideElement = this.element.querySelector(hideSelector);

      hideElement.classList[value == hideOnValue ? "add" : "remove"]("hidden");
    }
  }

  /* -------------------------------------------- */

  /**
   * Re-renders all slider input values
   *
   * @param {Event} event
   * @private
   */
  _updateSliderInputs(event) {
    const sliders = this.element.querySelectorAll("input[type=range]");
    for (const slider of sliders) {
      const value = slider.value;
      const valueSpan = slider.closest(".form-slider")?.querySelector(".range-value");
      if (valueSpan) valueSpan.innerText = value;
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the game settings with the new configuration
   *
   * @internal
   * @this {ApplicationV2&ActorRestDialog}
   * @param {SubmitEvent} event                                     The originating form submission event
   * @param {HTMLFormElement} form                                  The form element that was submitted
   * @param {FormDataExtended} formData                             Processed data for the submitted form
   * @param {Partial<ActorRestOptions>} formData.object             The form data in object form
   * @returns {Promise<void>}
   */
  static async _save(event, form, formData) {
    formData = foundry.utils.expandObject(formData.object);
    game.settings.set("pf1", this.options.configKey, formData);
  }
}

/**
 * A generic application to render a settings modal with a "Player" and a "World" tab.
 *
 * @abstract
 * @augments {AbstractSettingsApplication}
 */
export class AbstractSplitSettingsApplication extends AbstractSettingsApplication {
  static DEFAULT_OPTIONS = {
    ...AbstractSettingsApplication.DEFAULT_OPTIONS,
    form: {
      handler: AbstractSplitSettingsApplication._save,
      submitOnChange: false,
      closeOnSubmit: true,
      submitOnClose: false,
    },
  };

  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if (!game.user.isGM) {
      options.parts.shift();
    }
  }

  _prepareContext() {
    return {
      ...super._prepareContext(),
      isGM: game.user.isGM,
      tabs: [
        {
          id: "player",
          icon: "fas fa-user",
          label: "PF1.Application.Settings.Player",
          group: "primary",
          cssClass: "active",
        },
        {
          id: "world",
          icon: "fas fa-globe",
          label: "PF1.Application.Settings.World",
          group: "primary",
        },
      ],
    };
  }

  /* -------------------------------------------- */

  /**
   * Update the game settings with the new configuration
   *
   * @internal
   * @this {ApplicationV2&ActorRestDialog}
   * @param {SubmitEvent} event                                     The originating form submission event
   * @param {HTMLFormElement} form                                  The form element that was submitted
   * @param {FormDataExtended} formData                             Processed data for the submitted form
   * @param {Partial<ActorRestOptions>} formData.object             The form data in object form
   * @returns {Promise<void>}
   */
  static async _save(event, form, formData) {
    formData = foundry.utils.expandObject(formData.object);

    game.settings.set("pf1", this.options.configKey, formData.player);
    if (game.user.isGM) {
      game.settings.set("pf1", this.options.worldConfigKey, formData.world);
    }
  }
}
