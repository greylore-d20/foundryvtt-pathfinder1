import { HealthConfig } from "./config/health.js";
import { ExperienceConfig } from "./config/experience.js";
import { AccessibilityConfig } from "./config/accessibility.js";
import { TooltipConfig } from "./config/tooltip.js";
import { TooltipWorldConfig } from "./config/tooltip_world.js";
import { TooltipPF } from "./hud/tooltip.js";

export const registerSystemSettings = function () {
  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("pf1", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: "0.0.0",
  });
  /**
   * Track when the last changelog was shown
   */
  game.settings.register("pf1", "changelogVersion", {
    name: "Changelog Version",
    scope: "client",
    config: false,
    type: String,
    default: "0.74.9",
  });
  game.settings.register("pf1", "dontShowChangelog", {
    name: "Don't Automatically Show Changelog",
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });

  // Health configuration
  game.settings.registerMenu("pf1", "healthConfig", {
    name: "SETTINGS.pf1HealthConfigName",
    label: "SETTINGS.pf1HealthConfigLabel",
    hint: "SETTINGS.pf1HealthConfigHint",
    icon: "fas fa-heartbeat",
    type: HealthConfig,
    restricted: true,
  });
  game.settings.register("pf1", "healthConfig", {
    name: "SETTINGS.pf1HealthConfigName",
    scope: "world",
    default: HealthConfig.defaultSettings,
    type: Object,
    config: false,
    onChange: () => {
      game.actors.contents.forEach((o) => {
        o.prepareData();
        if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
      });
      Object.values(game.actors.tokens).forEach((o) => {
        o.prepareData();
        if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
      });
    },
  });

  // Experience configuration
  game.settings.registerMenu("pf1", "experienceConfig", {
    name: "PF1.ExperienceConfigName",
    label: "PF1.ExperienceConfigLabel",
    hint: "PF1.ExperienceConfigHint",
    icon: "fas fa-book",
    type: ExperienceConfig,
    restricted: true,
  });
  game.settings.register("pf1", "experienceConfig", {
    name: "PF1.ExperienceConfigName",
    scope: "world",
    default: ExperienceConfig.defaultSettings,
    type: Object,
    config: false,
    onChange: () => {
      game.actors.contents.forEach((o) => {
        o.prepareData();
        if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
      });
      Object.values(game.actors.tokens).forEach((o) => {
        o.prepareData();
        if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
      });
    },
  });

  // Accessibility configuration
  game.settings.registerMenu("pf1", "accessibilityConfig", {
    name: "PF1.AccessibilityConfigName",
    label: "PF1.AccessibilityConfigLabel",
    hint: "PF1.AccessibilityConfigHint",
    restricted: false,
    icon: "fas fa-wheelchair",
    type: AccessibilityConfig,
  });
  game.settings.register("pf1", "accessibilityConfig", {
    name: "PF1.AccessibilityConfigName",
    scope: "client",
    default: AccessibilityConfig.defaultSettings,
    type: Object,
    config: false,
    onChange: () => {
      window.location.reload();
    },
  });

  // Tooltip configuration
  game.settings.registerMenu("pf1", "tooltipConfig", {
    name: "PF1.TooltipConfigName",
    label: "PF1.TooltipConfigLabel",
    hint: "PF1.TooltipConfigHint",
    restricted: false,
    icon: "fas fa-window-maximize",
    type: TooltipConfig,
  });
  game.settings.register("pf1", "tooltipConfig", {
    name: "PF1.TooltipConfigName",
    scope: "client",
    default: TooltipConfig.defaultSettings,
    type: Object,
    config: false,
    onChange: (settings) => {
      const worldConf = game.settings.get("pf1", "tooltipWorldConfig");
      const enable = !worldConf.disabled && !settings.disabled;
      TooltipPF.toggle(enable);
    },
  });

  // Tooltip World configuration
  /* game.settings.registerMenu("pf1", "tooltipWorldConfig", {
    name: "PF1.TooltipWorldConfigName",
    label: "PF1.TooltipWorldConfigLabel",
    hint: "PF1.TooltipWorldConfigHint",
    restricted: true,
    icon: "fas fa-window-maximize",
    type: TooltipWorldConfig,
  }); */
  game.settings.register("pf1", "tooltipWorldConfig", {
    name: "PF1.TooltipWorldConfigName",
    scope: "world",
    default: TooltipWorldConfig.defaultSettings,
    type: Object,
    config: false,
    onChange: (settings) => {
      TooltipPF.toggle(!settings.disable);
      game.pf1.tooltip?.setPosition();
    },
  });

  /**
   * Register diagonal movement rule setting
   */
  game.settings.register("pf1", "diagonalMovement", {
    name: "SETTINGS.pf1DiagN",
    hint: "SETTINGS.pf1DiagL",
    scope: "world",
    config: true,
    default: "5105",
    type: String,
    choices: {
      555: "SETTINGS.pf1DiagPHB",
      5105: "SETTINGS.pf1DiagDMG",
    },
    onChange: (rule) => (canvas.grid.diagonalRule = rule),
  });

  /**
   * Experience rate
   *
   * @deprecated
   */
  game.settings.register("pf1", "experienceRate", {
    name: "SETTINGS.pf1ExpRateN",
    hint: "SETTINGS.pf1ExpRateL",
    scope: "world",
    config: false,
    default: "",
    type: String,
    onChange: () => {
      [...game.actors.contents, ...Object.values(game.actors.tokens)]
        .filter((o) => {
          return o.data.type === "character";
        })
        .forEach((o) => {
          o.prepareData();
          if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
        });
    },
  });

  const reRenderSheets = () => {
    [...game.actors.contents, ...Object.values(game.actors.tokens)]
      .filter((o) => {
        return o.data.type === "character";
      })
      .forEach((o) => {
        o.prepareData();
        if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
      });
  };

  /**
   * System of Units
   */
  game.settings.register("pf1", "units", {
    name: "SETTINGS.pf1UnitsN",
    hint: "SETTINGS.pf1UnitsL",
    scope: "world",
    config: true,
    default: "imperial",
    type: String,
    choices: {
      imperial: game.i18n.localize("SETTINGS.pf1ImperialUnits"),
      metric: game.i18n.localize("SETTINGS.pf1MetricUnits"),
    },
    onChange: reRenderSheets,
  });

  game.settings.register("pf1", "distanceUnits", {
    name: "SETTINGS.pf1DistanceUnitsN",
    hint: "SETTINGS.pf1DistanceUnitsL",
    scope: "world",
    config: true,
    default: "default",
    type: String,
    choices: {
      default: game.i18n.localize("PF1.Default"),
      imperial: game.i18n.localize("SETTINGS.pf1ImperialDistanceUnits"),
      metric: game.i18n.localize("SETTINGS.pf1MetricDistanceUnits"),
    },
    onChange: reRenderSheets,
  });

  game.settings.register("pf1", "weightUnits", {
    name: "SETTINGS.pf1WeightUnitsN",
    hint: "SETTINGS.pf1WeightUnitsL",
    scope: "world",
    config: true,
    default: "default",
    type: String,
    choices: {
      default: game.i18n.localize("PF1.Default"),
      imperial: game.i18n.localize("SETTINGS.pf1ImperialWeightUnits"),
      metric: game.i18n.localize("SETTINGS.pf1MetricWeightUnits"),
    },
    onChange: reRenderSheets,
  });

  /**
   * Option to allow the background skills optional ruleset.
   */
  game.settings.register("pf1", "allowBackgroundSkills", {
    name: "SETTINGS.pf1BackgroundSkillsN",
    hint: "SETTINGS.pf1BackgroundSkillsH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      game.actors.contents.forEach((o) => {
        if (o.sheet && o.sheet.rendered) o.sheet.render(true);
      });
      Object.values(game.actors.tokens).forEach((o) => {
        if (o.sheet && o.sheet.rendered) o.sheet.render(true);
      });
    },
  });

  /**
   * Option to use the Fractional Base Bonuses optional ruleset.
   */
  game.settings.register("pf1", "useFractionalBaseBonuses", {
    name: "SETTINGS.pf1FractionalBaseBonusesN",
    hint: "SETTINGS.pf1FractionalBaseBonusesH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      window.location.reload();
    },
  });

  /**
   * Option to automatically collapse Item Card descriptions
   */
  game.settings.register("pf1", "autoCollapseItemCards", {
    name: "SETTINGS.pf1AutoCollapseCardN",
    hint: "SETTINGS.pf1AutoCollapseCardL",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      ui.chat.render();
    },
  });

  /**
   * Option to hide chat buttons
   */
  game.settings.register("pf1", "hideChatButtons", {
    name: "SETTINGS.pf1HideChatButtonsN",
    hint: "SETTINGS.pf1HideChatButtonsH",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      ui.chat.render();
    },
  });

  /**
   * Option to change measure style
   */
  game.settings.register("pf1", "measureStyle", {
    name: "SETTINGS.pf1MeasureStyleN",
    hint: "SETTINGS.pf1MeasureStyleL",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  /**
   * Low-light Vision Mode
   */
  game.settings.register("pf1", "lowLightVisionMode", {
    name: "SETTINGS.pf1LowLightVisionModeN",
    hint: "SETTINGS.pf1LowLightVisionModeH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      // Refresh canvas sight
      canvas.lighting.initializeSources();
      canvas.perception.initialize();
    },
  });

  game.settings.register("pf1", "sharedVisionMode", {
    name: "SETTINGS.pf1SharedVisionModeN",
    hint: "SETTINGS.pf1SharedVisionModeH",
    scope: "world",
    config: true,
    default: "0",
    type: String,
    choices: {
      0: "SETTINGS.pf1SharedVisionWithoutSelection",
      1: "SETTINGS.pf1SharedVisionWithSelection",
    },
    onChange: () => {
      game.socket.emit("system.pf1", { eventType: "redrawCanvas" });
    },
  });

  /**
   * Set coin weight
   */
  game.settings.register("pf1", "coinWeight", {
    name: "SETTINGS.pf1CoinWeightN",
    hint: "SETTINGS.pf1CoinWeightH",
    scope: "world",
    config: true,
    default: 50,
    type: Number,
    onChange: () => {
      game.actors.contents.forEach((o) => {
        o.prepareData();
      });
      Object.values(game.actors.tokens).forEach((o) => {
        o.prepareData();
      });
    },
  });

  /**
   * Hide token conditions
   */
  game.settings.register("pf1", "hideTokenConditions", {
    name: "SETTINGS.pf1HideTokenConditionsN",
    hint: "SETTINGS.pf1HideTokenConditionsH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      const promises = [];
      const actors = [
        ...Array.from(game.actors.contents.filter((o) => getProperty(o.data, "token.actorLink"))),
        ...Object.values(game.actors.tokens),
      ];
      for (const actor of actors) {
        promises.push(actor.toggleConditionStatusIcons());
      }
      return Promise.all(promises);
    },
  });

  /**
   * Display default token conditions alongside system ones
   */
  game.settings.register("pf1", "coreEffects", {
    name: "SETTINGS.pf1CoreEffectsN",
    hint: "SETTINGS.pf1CoreEffectsH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      window.location.reload();
    },
  });

  /**
   * Skip action dialog prompts
   */
  game.settings.register("pf1", "skipActionDialogs", {
    name: "SETTINGS.pf1SkipActionDialogsN",
    hint: "SETTINGS.pf1SkipActionDialogsH",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  });

  /*
   * When skipping an action dialog prompt still place the template if one is configured
   */
  game.settings.register("pf1", "placeMeasureTemplateOnQuickRolls", {
    name: "SETTINGS.placeMeasureTemplateOnQuickRollsN",
    hint: "SETTINGS.placeMeasureTemplateOnQuickRollsH",
    scope: "client",
    config: true,
    default: true,
    type: Boolean,
  });

  /**
   * Attack chat card template
   */
  game.settings.register("pf1", "attackChatCardTemplate", {
    name: "SETTINGS.pf1AttackChatCardTemplateN",
    hint: "SETTINGS.pf1AttackChatCardTemplateH",
    scope: "world",
    config: true,
    default: "systems/pf1/templates/chat/attack-roll.hbs",
    type: String,
    choices: {
      "systems/pf1/templates/chat/attack-roll.hbs": "PF1.Primary",
      "systems/pf1/templates/chat/attack-roll2.hbs": "PF1.Alternate",
    },
  });

  /**
   * Unchained action economy
   */
  game.settings.register("pf1", "unchainedActionEconomy", {
    name: "SETTINGS.pf1UnchainedActionEconomyN",
    hint: "SETTINGS.pf1UnchainedActionEconomyH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      const promises = [];
      const actors = [
        ...Array.from(game.actors.contents.filter((o) => getProperty(o.data, "token.actorLink"))),
        ...Object.values(game.actors.tokens),
      ];
      for (const actor of actors) {
        promises.push(actor.toggleConditionStatusIcons());
      }
      return Promise.all(promises);
    },
  });

  /**
   * Invert filter Shift-clicking
   */
  game.settings.register("pf1", "invertSectionFilterShiftBehaviour", {
    name: "SETTINGS.pf1InvertSectionFilterBehaviourN",
    hint: "SETTINGS.pf1InvertSectionFilterBehaviourH",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  });

  /**
   * Hide reach measurements
   */
  game.settings.register("pf1", "hideReachMeasurements", {
    name: "SETTINGS.pf1HideReachMeasurementsN",
    hint: "SETTINGS.pf1HideReachMeasurementsH",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  });

  /**
   * Display BAB iteratives instead of simply total
   */
  game.settings.register("pf1", "displayIteratives", {
    name: "SETTINGS.pf1DisplayIterativesN",
    hint: "SETTINGS.pf1DisplayIterativesH",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  });

  /**
   * Alternative reach corner rule
   */
  game.settings.register("pf1", "alternativeReachCornerRule", {
    name: "SETTINGS.pf1AlternativeReachCornerRuleN",
    hint: "SETTINGS.pf1AlternativeReachCornerRuleH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });
};

export const registerClientSettings = function () {
  /**
   * Compendium filters
   */
  game.settings.register("pf1", "compendiumFilters", {
    name: "Compendium Filters",
    hint: "Stores compendium filters",
    scope: "client",
    config: false,
    default: {},
    type: Object,
  });

  /**
   * Compendium items
   */
  game.settings.register("pf1", "compendiumItems", {
    name: "Compendium Items",
    hint: "Cache compendium entries",
    scope: "client",
    config: false,
    default: {},
    type: Object,
  });

  /**
   * Compendium save versions
   */
  game.settings.register("pf1", "compendiumSaveVersions", {
    name: "Compendium Save Versions",
    hint: "Versions of compendium caches",
    scope: "client",
    config: false,
    default: {
      spells: "0.75.6",
      items: "0.75.6",
      bestiary: "0.75.6",
      feats: "0.75.6",
      classes: "0.75.6",
      races: "0.75.6",
    },
    type: Object,
  });

  /*
   * Compendium difference data
   */
  game.settings.register("pf1", "compendiumForceRefresh", {
    name: "Compendium Force Refresh Data",
    hint: "Data needed to determine whether to force refresh compendiums",
    scope: "client",
    config: false,
    default: {
      diff: {
        items: [],
        spells: [],
        classes: [],
        races: [],
        feats: [],
        bestiary: [],
      },
    },
    type: Object,
  });
};

export const migrateSystemSettings = async function () {
  if (!game.user.isGM) return;

  // Migrate attack template
  {
    const template = game.settings.get("pf1", "attackChatCardTemplate");
    if (template.endsWith(".html")) {
      const newTemplate = template.slice(0, template.length - "html".length) + "hbs";
      await game.settings.set("pf1", "attackChatCardTemplate", newTemplate);
    }
  }
};

export const getSkipActionPrompt = function () {
  return (
    (game.settings.get("pf1", "skipActionDialogs") && !game.keyboard.isDown("Shift")) ||
    (!game.settings.get("pf1", "skipActionDialogs") && game.keyboard.isDown("Shift"))
  );
};
