export class AccessibilityConfigModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {};
  }
}

export class AccessibilityConfig extends FormApplication {
  constructor(object, options) {
    super(object, options);

    this._init = false;
  }

  /** Collect data for the template. @override */
  async getData() {
    const data = {};

    if (!this._init) {
      const settings = await game.settings.get("pf1", "accessibilityConfig");
      this._settings = foundry.utils.mergeObject(this.constructor.defaultSettings, settings);
      this._init = true;
    }
    data.settings = this._settings;

    return data;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("PF1.AccessibilityConfigName"),
      id: "accessibility-config",
      template: "systems/pf1/templates/settings/accessibility.hbs",
      width: 560,
      height: "auto",
      submitOnClose: false,
      closeOnSubmit: true,
      submitOnChange: false,
    });
  }

  /**
   * This method is called upon form submission after form data is validated.
   *
   * @override
   */
  async _updateObject(event, formData) {
    const settings = foundry.utils.expandObject(formData);
    // Some mild sanitation for the numeric values.
    await game.settings.set("pf1", "accessibilityConfig", settings);
    ui.notifications.info("Updated Pathfinder accessibility configuration.");
  }
}
