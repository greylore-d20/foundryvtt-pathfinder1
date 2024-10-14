import { AbstractSettingsApplication } from "@app/settings/abstract-settings.mjs";

export class PerformanceModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      reachLimit: new fields.NumberField({ integer: true, min: 0, initial: 60 }),
    };
  }
}

/**
 * An application that lets the user configure performance-related settings.
 *
 * @augments {AbstractSettingsApplication}
 */
export class PerformanceConfig extends AbstractSettingsApplication {
  static DEFAULT_OPTIONS = {
    configKey: "performance",
    position: {
      width: 520,
    },
    window: {
      title: "PF1.Application.Settings.Performance.Title",
    },
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/settings/performance.hbs",
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
    const settings = game.settings.get("pf1", "performance");
    return {
      ...(await super._prepareContext()),
      settings,
      model: settings.constructor.defineSchema(),
    };
  }
}
