export class HealthConfigModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      hitdice: new fields.SchemaField({
        PC: new fields.SchemaField({
          auto: new fields.BooleanField({ initial: false }),
          rate: new fields.NumberField({ min: 0, initial: 0.5 }),
          maximized: new fields.NumberField({ integer: true, min: 0, initial: 1 }),
        }),
        NPC: new fields.SchemaField({
          auto: new fields.BooleanField({ initial: false }),
          rate: new fields.NumberField({ min: 0, initial: 0.5 }),
          maximized: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
        }),
        Racial: new fields.SchemaField({
          auto: new fields.BooleanField({ initial: false }),
          rate: new fields.NumberField({ min: 0, initial: 0.5 }),
          maximized: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
        }),
      }),
      rounding: new fields.StringField({ blank: false, nullable: false, initial: "up" }),
      continuity: new fields.StringField({ blank: false, nullable: false, initial: "discrete" }),
      variants: new fields.SchemaField({
        pc: new fields.SchemaField({
          useWoundsAndVigor: new fields.BooleanField({ initial: false }),
          useWoundThresholds: new fields.NumberField({ initial: 0 }),
          allowWoundThresholdOverride: new fields.BooleanField({ initial: false }),
        }),
        npc: new fields.SchemaField({
          useWoundsAndVigor: new fields.BooleanField({ initial: false }),
          useWoundThresholds: new fields.NumberField({ initial: 0 }),
          allowWoundThresholdOverride: new fields.BooleanField({ initial: true }),
        }),
      }),
    };
  }
}

export class HealthConfig extends FormApplication {
  constructor(object = new HealthConfigModel(), options) {
    super(object, options);
  }

  /**
   * @override
   */
  getData() {
    return game.settings.get("pf1", "healthConfig");
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
    await game.settings.set("pf1", "healthConfig", new HealthConfigModel());
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
    const settings = foundry.utils.expandObject(formData);
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
