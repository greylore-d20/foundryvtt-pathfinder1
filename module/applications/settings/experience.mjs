import { AbstractSettingsApplication } from "@app/settings/abstract-settings.mjs";

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

  static migrateData(source) {
    source.disable ??= source.disableExperienceTracking;
    if (source.track === "customFormula") source.track = "custom";
    source.openDistributor ??= source.openXpDistributor;

    return super.migrateData(source);
  }
}

/**
 * An application that lets the user configure experience related settings.
 *
 * @augments {AbstractSettingsApplication}
 */
export class ExperienceConfig extends AbstractSettingsApplication {
  static DEFAULT_OPTIONS = {
    configKey: "experienceConfig",
    position: {
      width: 560,
    },
    window: {
      title: "PF1.Application.Settings.Experience.Title",
    },
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/settings/experience.hbs",
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
    const settings = game.settings.get("pf1", "experienceConfig");
    return {
      ...(await super._prepareContext()),
      settings,
      enabled: settings.disable !== true,
      hasCustomFormula: settings.track === "custom",
      config: pf1.config,
      const: pf1.const,
      progressionOptions: {
        slow: "PF1.Application.Settings.Experience.Track.Options.Slow",
        medium: "PF1.Application.Settings.Experience.Track.Options.Medium",
        fast: "PF1.Application.Settings.Experience.Track.Options.Fast",
        custom: "PF1.Application.Settings.Experience.Track.Options.Custom",
      },
      buttons: [
        { type: "submit", label: "PF1.Save", icon: "far fa-save" },
        { type: "reset", action: "reset", label: "PF1.Reset", icon: "far fa-undo" },
      ],
    };
  }
}
