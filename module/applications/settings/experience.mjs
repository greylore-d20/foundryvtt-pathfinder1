export class ExperienceConfigModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      disable: new fields.BooleanField({ initial: false }),
      track: new fields.StringField({ initial: "medium", choices: ["fast", "medium", "slow", "custom"] }),
      custom: new fields.SchemaField({
        formula: new fields.StringField({ initial: "", nullable: false }),
      }),
      openDistributor: new fields.BooleanField({ initial: true }),
    };
  }

  static migrateData(data) {
    super.migrateData(data);

    data.disable ??= data.disableExperienceTracking;
    if (data.track === "customFormula") data.track = "custom";
    data.openDistributor ??= data.openXpDistributor;
  }
}

export class ExperienceConfig extends FormApplication {
  constructor(...args) {
    super(...args);

    this._settings = game.settings.get("pf1", "experienceConfig").toObject();
  }

  /** @override */
  getData() {
    const settings = this._settings;

    return {
      ...settings,
      // Custom experience track booleans
      enabled: settings.disable !== true,
      hasCustomFormula: settings.track === "custom",
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
    this._settings = foundry.utils.mergeObject(this._settings, foundry.utils.expandObject(formData));
    this.render();
  }
}
