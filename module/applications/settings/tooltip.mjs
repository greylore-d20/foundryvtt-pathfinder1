import { AbstractSplitSettingsApplication } from "@app/settings/abstract-settings.mjs";

export class TokenTooltipConfigModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      disable: new fields.BooleanField({ initial: false }),
      hideWithoutKey: new fields.BooleanField({ initial: false }),
      anchor: new fields.SchemaField({
        x: new fields.NumberField({ initial: 1 }),
        y: new fields.NumberField({ initial: 1 }),
      }),
      offset: new fields.SchemaField({
        x: new fields.NumberField({ initial: 0 }),
        y: new fields.NumberField({ initial: 0 }),
      }),
      onMouse: new fields.BooleanField({ initial: false }),
      portrait: new fields.SchemaField({
        hide: new fields.BooleanField({ initial: false }),
        maxSize: new fields.SchemaField({
          width: new fields.NumberField({ initial: 280 }),
          height: new fields.NumberField({ initial: 280 }),
        }),
      }),
    };
  }
}

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

/**
 * An application that lets the user configure tooltip related settings.
 *
 * @augments {AbstractSplitSettingsApplication}
 */
export class TooltipConfig extends AbstractSplitSettingsApplication {
  static DEFAULT_OPTIONS = {
    configKey: "tooltipConfig",
    worldConfigKey: "tooltipWorldConfig",
    position: {
      width: 700,
    },
    window: {
      title: "PF1.Application.Settings.Tooltip.Title",
    },
  };

  static PARTS = {
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    form: {
      template: "systems/pf1/templates/settings/tooltip.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const canvasRect = canvas.app.view.getBoundingClientRect();
    const screen = {
      width: canvasRect.width,
      height: canvasRect.height,
      halfWidth: Math.floor(canvasRect.width / 2),
      halfHeight: Math.floor(canvasRect.height / 2),
    };

    // Prepare preview data
    const preview = {
      width: 320,
      height: 320,
      tooltip: {
        width: 80,
        height: 48,
      },
    };

    const r1 = screen.width / screen.height;
    const r2 = screen.height / screen.width;

    if (r1 > r2) {
      preview.height = Math.ceil(preview.height * r2);
    } else if (r2 > r1) {
      preview.width = Math.ceil(preview.width * r1);
    }

    return {
      ...(await super._prepareContext()),
      screen,
      preview,
      hideKey: game.i18n.localize("PF1.Key_Control"),
      player: game.settings.get("pf1", "tooltipConfig"),
      world: game.settings.get("pf1", "tooltipWorldConfig"),
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
  }
}
