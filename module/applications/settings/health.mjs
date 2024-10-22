import { AbstractSettingsApplication } from "@app/settings/abstract-settings.mjs";

export class HealthConfigModel extends foundry.abstract.DataModel {
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
        }),
        npc: new fields.SchemaField({
          useWoundsAndVigor: new fields.BooleanField({ initial: false }),
          useWoundThresholds: new fields.NumberField({ initial: 0 }),
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

  static migrateData(source) {
    if (source.continuity) {
      source.continuous = source.continuity === "continuous";
    }

    return super.migrateData(source);
  }

  static get woundThesholdOptions() {
    return {
      0: game.i18n.localize("PF1.Application.Settings.Health.WoundThresholds.Disabled"),
      1: game.i18n.localize("PF1.Application.Settings.Health.WoundThresholds.Normal"),
      2: game.i18n.localize("PF1.Application.Settings.Health.WoundThresholds.Gritty"),
    };
  }
}

export class HealthConfig extends AbstractSettingsApplication {
  static DEFAULT_OPTIONS = {
    configKey: "healthConfig",
    position: {
      width: 480,
    },
    window: {
      title: "PF1.Application.Settings.Health.Title",
    },
  };

  static PARTS = {
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    form: {
      template: "systems/pf1/templates/settings/health.hbs",
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
    this.healthConfig ??= new HealthConfigModel(game.settings.get("pf1", "healthConfig").toObject());

    const context = {
      ...this.healthConfig,
      woundThesholdOptions: HealthConfigModel.woundThesholdOptions,
      healthRounding: {
        up: "PF1.Application.Settings.Health.RoundingUp",
        nearest: "PF1.Application.Settings.Health.RoundingNearest",
        down: "PF1.Application.Settings.Health.RoundingDown",
      },
      healthContinuity: {
        true: "PF1.Application.Settings.Health.Continuous",
        false: "PF1.Application.Settings.Health.Discrete",
      },
    };

    for (const [hdId, hdData] of Object.entries(context.hitdice)) {
      hdData.label = `PF1.Application.Settings.Health.Class.${hdId.toLowerCase()}`;
    }

    return {
      ...(await super._prepareContext()),
      ...context,
      showWoundsVigorWarning: {
        pc: this.healthConfig.variants.pc.useWoundsAndVigor && this.healthConfig.variants.pc.useWoundThresholds !== 0,
        npc:
          this.healthConfig.variants.npc.useWoundsAndVigor && this.healthConfig.variants.npc.useWoundThresholds !== 0,
      },
      model: this.healthConfig.constructor.defineSchema(),
      tabs: [
        {
          id: "base",
          icon: "fas fa-heartbeat",
          label: "PF1.Application.Settings.Health.TabBase",
          group: "primary",
          cssClass: "active",
        },
        {
          id: "variants",
          icon: "fas fa-prescription-bottle-alt",
          label: "PF1.Application.Settings.Health.TabVariant",
          group: "primary",
        },
      ],
    };
  }
}
