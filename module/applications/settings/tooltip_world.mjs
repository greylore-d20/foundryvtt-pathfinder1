export class TokenTooltipWorldConfigModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      disable: new fields.BooleanField({ initial: false }),
      portrait: new fields.SchemaField({
        hide: new fields.BooleanField({ initial: false }),
      }),
      hideHeld: new fields.BooleanField({ initial: true }),
      hideArmor: new fields.BooleanField({ initial: true }),
      hideBuffs: new fields.BooleanField({ initial: true }),
      hideConditions: new fields.BooleanField({ initial: false }),
      hideClothing: new fields.BooleanField({ initial: true }),
      hideActorNameByDisposition: new fields.NumberField({ initial: 0 }),
      minimumPermission: new fields.NumberField({ initial: CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED }),
      hideActorNameReplacement: new fields.StringField({ initial: "???", nullable: false }),
    };
  }

  /*
  static migrateData(data) {}
  */
}

export class TooltipWorldConfig extends FormApplication {
  constructor(object, options) {
    super(object, options);

    this._cachedData = null;
  }

  getData() {
    const result = {};

    // Get settings
    result.data = game.settings.get("pf1", "tooltipWorldConfig");

    result.permissions = {
      [CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE]: "OWNERSHIP.NONE",
      [CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED]: "OWNERSHIP.LIMITED",
      [CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER]: "OWNERSHIP.OBSERVER",
      [CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER]: "OWNERSHIP.OWNER",
    };

    return result;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("PF1.TooltipWorldConfigName"),
      id: "tooltip-world-config",
      template: "systems/pf1/templates/settings/tooltip_world.hbs",
      width: 540,
      height: "auto",
    });
  }

  activateListeners(html) {
    html.find('button[name="submit"]').click(this._onSubmit.bind(this));
    html.find('button[name="reset"]').click(this._onReset.bind(this));
  }

  async _onReset(event) {
    event.preventDefault();
    await game.settings.set("pf1", "tooltipWorldConfig", new TokenTooltipWorldConfigModel());
    ui.notifications.info(game.i18n.localize("PF1.TooltipConfigResetInfo"));
    return this.render();
  }

  async _updateObject(event, formData) {
    const settings = expandObject(formData);

    await game.settings.set("pf1", "tooltipWorldConfig", settings);
    ui.notifications.info(game.i18n.localize("PF1.TooltipConfigUpdateInfo"));
  }
}
