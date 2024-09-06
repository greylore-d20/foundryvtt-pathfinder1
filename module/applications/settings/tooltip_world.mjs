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

  static migrateData(data) {
    if (data.hideActorName !== undefined) {
      if (data.hideActorNameByDisposition === undefined) {
        // 1 (All) for true, -2 (None) for false
        data.hideActorNameByDisposition == data.hideActorName ? 1 : -2;
      }
      delete data.hideActorName;
    }
  }
}

export class TooltipWorldConfig extends FormApplication {
  constructor(object, options) {
    super(object, options);

    this._cachedData = null;
  }

  getData() {
    const result = {
      data: game.settings.get("pf1", "tooltipWorldConfig"),
      config: pf1.config,
      const: pf1.const,
      tokenNameDisposition: {
        "-2": "PF1.Disposition.None",
        "-1": "PF1.Disposition.Hostile",
        0: "PF1.Disposition.Non-Friendly",
        1: "PF1.Disposition.All",
      },
      permissions: {
        [CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE]: "OWNERSHIP.NONE",
        [CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED]: "OWNERSHIP.LIMITED",
        [CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER]: "OWNERSHIP.OBSERVER",
        [CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER]: "OWNERSHIP.OWNER",
      },
    };

    return result;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("PF1.SETTINGS.TokenTooltip.World.Name"),
      id: "tooltip-world-config",
      template: "systems/pf1/templates/settings/tooltip_world.hbs",
      width: 540,
      height: "auto",
    });
  }

  activateListeners(html) {
    html.find("button.reset").click(this._onReset.bind(this));
  }

  async _onReset(event) {
    event.preventDefault();
    await game.settings.set("pf1", "tooltipWorldConfig", {});
    ui.notifications.info(game.i18n.localize("PF1.SETTINGS.TokenTooltip.ResetInfo"));
    return this.render();
  }

  async _updateObject(event, formData) {
    const settings = foundry.utils.expandObject(formData);

    await game.settings.set("pf1", "tooltipWorldConfig", settings);
    ui.notifications.info(game.i18n.localize("PF1.SETTINGS.TokenTooltip.UpdateInfo"));
  }
}
