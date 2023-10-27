export class HealthConfig extends FormApplication {
  constructor(object, options) {
    super(object || HealthConfig.defaultSettings, options);
  }

  /** Collect data for the template. @override */
  async getData() {
    let settings = await game.settings.get("pf1", "healthConfig");
    settings = mergeObject(HealthConfig.defaultSettings, settings);
    return settings;
  }

  /** @override */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      title: game.i18n.localize("SETTINGS.pf1HealthConfigName"),
      id: "health-config",
      template: "systems/pf1/templates/settings/health.hbs",
      classes: [...options.classes, "pf1", "health-config"],
      width: 480,
      height: "auto",
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: ".tabbed",
          initial: "base",
          group: "primary",
        },
      ],
    };
  }

  static get defaultSettings() {
    return {
      hitdice: {
        PC: { auto: false, rate: 0.5, maximized: 1 },
        NPC: { auto: false, rate: 0.5, maximized: 0 },
        Racial: { auto: false, rate: 0.5, maximized: 0 },
      },
      hitdieOptions: ["Compute", "Rate", "Maximized"],
      rounding: "up",
      continuity: "discrete",
      variants: {
        pc: { useWoundsAndVigor: false, useWoundThresholds: 0, allowWoundThresholdOverride: false },
        npc: { useWoundsAndVigor: false, useWoundThresholds: 0, allowWoundThresholdOverride: true },
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
    html.find('button[name="reset"]').click(this._onReset.bind(this));
    html.find('button[name="submit"]').click(this._onSubmit.bind(this));
  }

  /**
   * Handle button click to reset default settings
   *
   * @param event {Event}   The initial button click event
   * @private
   */
  async _onReset(event) {
    event.preventDefault();
    await game.settings.set("pf1", "healthConfig", HealthConfig.defaultSettings);
    ui.notifications.info(`Reset Pathfinder health configuration.`);
    return this.render();
  }

  _onSubmit(event) {
    super._onSubmit(event);
  }

  /**
   * This method is called upon form submission after form data is validated.
   *
   * @override
   */
  async _updateObject(event, formData) {
    const settings = expandObject(formData);
    // Some mild sanitation for the numeric values.
    for (const hd of Object.values(settings.hitdice)) {
      hd.rate = Math.clamped(hd.rate, 0, 100);
      hd.maximized = Math.clamped(Math.floor(hd.maximized), 0, 100);
    }

    settings.variants.npc.allowWoundThresholdOverride = true; // HACK: This setting vanishes otherwise

    await game.settings.set("pf1", "healthConfig", settings);
    ui.notifications.info("Updated Pathfinder health configuration.");
  }
}
