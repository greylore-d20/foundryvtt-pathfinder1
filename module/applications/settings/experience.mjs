export class ExperienceConfig extends FormApplication {
  constructor(...args) {
    super(...args);

    this._settings = duplicate(game.settings.get("pf1", "experienceConfig"));
  }

  /** @override */
  getData() {
    const settings = this._settings;

    return {
      ...settings,
      // Custom experience track booleans
      enabled: settings.disableExperienceTracking !== true,
      hasCustomFormula: settings.track === "customFormula",
    };
  }

  /** @override */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...super.defaultOptions,
      title: game.i18n.localize("PF1.ExperienceConfigName"),
      classes: [...options.classes, "pf1", "experience-config"],
      id: "experience-config",
      template: "systems/pf1/templates/settings/experience.hbs",
      submitOnChange: true,
      closeOnSubmit: false,
      submitOnClose: false,
      width: 560,
      height: "auto",
    };
  }

  static get defaultSettings() {
    return {
      track: "medium",
      disableExperienceTracking: false,
      openXpDistributor: true,
      custom: {
        formula: "",
      },
    };
  }

  /**
   * Activate the default set of listeners for the Document sheet These listeners handle basic stuff like form submission or updating images.
   *
   * @override
   */
  activateListeners(html) {
    super.activateListeners(html);

    this.form.querySelector("button.save").addEventListener("click", this._onSaveConfig.bind(this));
  }

  async _onSaveConfig(event) {
    event.preventDefault();
    event.stopPropagation();

    game.settings.set("pf1", "experienceConfig", this._settings);
    this.close();
  }

  /** @override */
  async _updateObject(event, formData) {
    this._settings = mergeObject(this._settings, expandObject(formData));
    this.render();
  }
}
