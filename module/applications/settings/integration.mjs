import { AbstractSettingsApplication } from "@app/settings/abstract-settings.mjs";

export class IntegrationModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      diceSoNice: new fields.BooleanField({ initial: true }),
      dragRuler: new fields.BooleanField({ initial: true }),
    };
  }
}

/**
 * An application that lets the user configure module integration related settings.
 *
 * @augments {AbstractSettingsApplication}
 */
export class IntegrationConfig extends AbstractSettingsApplication {
  static DEFAULT_OPTIONS = {
    configKey: "integration",
    position: {
      width: 460,
    },
    window: {
      title: "PF1.Application.Settings.Integration.Title",
    },
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/settings/integration.hbs",
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
    return {
      ...(await super._prepareContext()),
      settings: game.settings.get("pf1", "integration"),
      dsnFound: game.modules.get("dice-so-nice")?.active,
      drFound: game.modules.get("drag-ruler")?.active,
    };
  }
}
