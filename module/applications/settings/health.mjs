export class HealthConfigModel extends foundry.abstract.DataModel {
  constructor(...args) {
    super(...args);

    Object.defineProperty(this, "continuity", {
      get() {
        foundry.utils.logCompatibilityWarning(
          "continuity string property in health configuration is deprecated in favor of continuous boolean property",
          {
            since: "PF1 v10",
            until: "PF1 v11",
          }
        );

        return this.continuous ? "continuous" : "discrete";
      },
    });
  }

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      hitdice: new fields.SchemaField({
        Racial: new fields.SchemaField({
          auto: new fields.BooleanField({ initial: false }),
          rate: new fields.NumberField({ positive: true, initial: 0.5, max: 1 }),
          maximized: new fields.BooleanField({ initial: false }),
        }),
        PC: new fields.SchemaField({
          auto: new fields.BooleanField({ initial: false }),
          rate: new fields.NumberField({ positive: true, initial: 0.5, max: 1 }),
          maximized: new fields.BooleanField({ initial: true }),
        }),
        NPC: new fields.SchemaField({
          auto: new fields.BooleanField({ initial: false }),
          rate: new fields.NumberField({ positive: true, initial: 0.5, max: 1 }),
          maximized: new fields.BooleanField({ initial: false }),
        }),
      }),
      maximized: new fields.NumberField({ integer: true, min: 0, initial: 1 }),
      rounding: new fields.StringField({ blank: false, nullable: false, initial: "up" }),
      continuous: new fields.BooleanField({ initial: false }),
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

  /**
   * Retrieve hit die configuration relevant to given class.
   *
   * @param {ItemClassPF} item
   * @returns {object} -
   */
  getClassHD(item) {
    const subtype = item.system.subType;
    switch (item.system.subType) {
      case "npc":
        return this.hitdice.NPC;
      case "racial":
        return this.hitdice.Racial;
      default:
        return this.hitdice.PC;
    }
  }

  static migrateData(data) {
    if (data.continuity) {
      data.continuous = data.continuity === "continuous";
    }
  }

  static get woundThesholdOptions() {
    return {
      0: game.i18n.localize("PF1.SETTINGS.Health.WoundThresholds.Disabled"),
      1: game.i18n.localize("PF1.SETTINGS.Health.WoundThresholds.Normal"),
      2: game.i18n.localize("PF1.SETTINGS.Health.WoundThresholds.Gritty"),
    };
  }
}

export class HealthConfig extends FormApplication {
  /**
   * @readonly
   */
  static model = HealthConfigModel;

  constructor(object = new HealthConfigModel(), options) {
    super(object, options);
  }

  /**
   * @override
   */
  getData() {
    this.healthConfig ??= new HealthConfigModel(game.settings.get("pf1", "healthConfig").toObject());

    const context = {
      ...this.healthConfig,
      woundThesholdOptions: HealthConfigModel.woundThesholdOptions,
    };

    for (const [hdId, data] of Object.entries(context.hitdice)) {
      data.label = `PF1.SETTINGS.Health.Class.${hdId.toLowerCase()}`;
    }

    return context;
  }

  /** @override */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      title: game.i18n.localize("PF1.SETTINGS.Health.Title"),
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
      submitOnChange: true,
      submitOnClose: false,
      closeOnSubmit: false,
    };
  }

  /**
   * Handle button click to reset default settings
   *
   * @param event {Event}   The initial button click event
   * @private
   */
  async _onReset(event) {
    event.preventDefault();

    await game.settings.set("pf1", "healthConfig", {});
    return this.render();
  }

  async _onSave(event) {
    event.preventDefault();

    const settings = this.healthConfig;
    await game.settings.set("pf1", "healthConfig", settings.toObject());
    this.close();
  }

  /**
   * Activate the default set of listeners for the Document sheet These listeners handle basic stuff like form submission or updating images.
   *
   * @override
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("button.reset").click(this._onReset.bind(this));
    html.find("button.save").click(this._onSave.bind(this));
  }

  /**
   * This method is called upon form submission after form data is validated.
   *
   * @override
   */
  async _updateObject(event, formData) {
    formData = foundry.utils.expandObject(formData);
    const settings = new HealthConfigModel(game.settings.get("pf1", "healthConfig").toObject());
    settings.updateSource(formData); // Validate settings
    this.healthConfig = settings;
    this.render();
  }
}
