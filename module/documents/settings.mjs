import { HealthConfig, HealthConfigModel } from "../applications/settings/health.mjs";
import { ExperienceConfig, ExperienceConfigModel } from "../applications/settings/experience.mjs";
import {
  TooltipConfig,
  TokenTooltipWorldConfigModel,
  TokenTooltipConfigModel,
} from "../applications/settings/tooltip.mjs";
import { IntegrationConfig, IntegrationModel } from "module/applications/settings/integration.mjs";
import { PerformanceConfig, PerformanceModel } from "module/applications/settings/performance.mjs";
import { TooltipPF } from "../applications/tooltip.mjs";

export const registerSystemSettings = function () {
  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("pf1", "systemMigrationVersion", {
    scope: "world",
    config: false,
    type: String,
    default: "0.0.0",
  });

  // Migration is in progress
  game.settings.register("pf1", "migrating", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false,
    onChange: (value) => (pf1.migrations.isMigrating = value),
  });

  /**
   * Track when the last changelog was shown
   */
  game.settings.register("pf1", "changelogVersion", {
    scope: "client",
    config: false,
    type: String,
    default: "0.74.9",
  });
  /**
   * Don't automatically show changelog
   */
  game.settings.register("pf1", "dontShowChangelog", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });

  // Health configuration
  game.settings.registerMenu("pf1", "healthConfig", {
    name: "PF1.Application.Settings.Health.Title",
    label: "PF1.Application.Settings.Health.Label",
    hint: "PF1.Application.Settings.Health.Hint",
    icon: "fas fa-heartbeat",
    type: HealthConfig,
    restricted: true,
  });
  game.settings.register("pf1", "healthConfig", {
    scope: "world",
    default: new HealthConfigModel(),
    type: HealthConfigModel,
    config: false,
    requiresReload: true,
    //onChange: () => pf1.utils.refreshActors(), // Excessive if reloading instantly
  });

  // Experience configuration
  game.settings.registerMenu("pf1", "experienceConfig", {
    name: "PF1.Application.Settings.Experience.Title",
    label: "PF1.Application.Settings.Experience.Label",
    hint: "PF1.Application.Settings.Experience.Hint",
    icon: "fas fa-book",
    type: ExperienceConfig,
    restricted: true,
  });
  game.settings.register("pf1", "experienceConfig", {
    scope: "world",
    default: new ExperienceConfigModel(),
    type: ExperienceConfigModel,
    config: false,
    onChange: () => pf1.utils.refreshActors({ renderOnly: true }),
  });

  // Tooltip configuration
  game.settings.registerMenu("pf1", "tooltipConfig", {
    name: "PF1.Application.Settings.Tooltip.Title",
    label: "PF1.Application.Settings.Tooltip.Label",
    hint: "PF1.Application.Settings.Tooltip.Hint",
    restricted: false,
    icon: "fas fa-window-maximize",
    type: TooltipConfig,
  });
  game.settings.register("pf1", "tooltipConfig", {
    scope: "client",
    default: new TokenTooltipConfigModel(),
    type: TokenTooltipConfigModel,
    config: false,
    onChange: (settings) => {
      const worldConf = game.settings.get("pf1", "tooltipWorldConfig");
      const enable = !worldConf.disabled && !settings.disabled;
      TooltipPF.toggle(enable);
    },
  });

  // Tooltip World configuration
  game.settings.register("pf1", "tooltipWorldConfig", {
    scope: "world",
    default: new TokenTooltipWorldConfigModel(),
    type: TokenTooltipWorldConfigModel,
    config: false,
    onChange: (settings) => {
      TooltipPF.toggle(!settings.disable);
      pf1.tooltip?.setPosition();
    },
  });

  game.settings.register("pf1", "integration", {
    type: IntegrationModel,
    default: new IntegrationModel(),
    scope: "world",
    config: false,
    requiresReload: true,
  });

  game.settings.registerMenu("pf1", "integration", {
    name: "PF1.Application.Settings.Integration.Title",
    label: "PF1.Application.Settings.Integration.Label",
    hint: "PF1.Application.Settings.Integration.Hint",
    restricted: true,
    icon: "fa-solid fa-check-to-slot",
    type: IntegrationConfig,
  });

  game.settings.register("pf1", "performance", {
    scope: "client",
    default: new PerformanceModel(),
    type: PerformanceModel,
    config: false,
  });

  game.settings.registerMenu("pf1", "performance", {
    name: "PF1.Application.Settings.Performance.Title",
    label: "PF1.Application.Settings.Performance.Button",
    hint: "PF1.Application.Settings.Performance.Hint",
    restricted: false,
    icon: "fa-solid fa-gauge",
    type: PerformanceConfig,
  });

  // MEASURING

  /**
   * Option to change measure style
   */
  game.settings.register("pf1", "measureStyle", {
    name: "PF1.SETTINGS.Canvas.MeasureStyle",
    hint: "PF1.SETTINGS.Canvas.MeasureStyleHint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  /**
   * Register diagonal movement rule setting
   */
  game.settings.register("pf1", "diagonalMovement", {
    name: "PF1.SETTINGS.DiagonalRule.Label",
    hint: "PF1.SETTINGS.DiagonalRule.Hint",
    scope: "world",
    config: true,
    default: "5105",
    type: String,
    choices: {
      5105: "PF1.SETTINGS.DiagonalRule.Options.Core",
      555: "PF1.SETTINGS.DiagonalRule.Options.Simple",
    },
  });

  /**
   * System of Units
   */
  game.settings.register("pf1", "units", {
    name: "PF1.SETTINGS.Units.System",
    hint: "PF1.SETTINGS.Units.SystemHint",
    scope: "world",
    config: true,
    default: "imperial",
    type: String,
    choices: {
      imperial: "PF1.SETTINGS.Units.Imperial",
      metric: "PF1.SETTINGS.Units.Metric",
    },
    requiresReload: true,
  });

  /**
   * System of units override for distances.
   */
  game.settings.register("pf1", "distanceUnits", {
    name: "PF1.SETTINGS.Units.Distance",
    hint: "PF1.SETTINGS.Units.DistanceHint",
    scope: "world",
    config: true,
    default: "default",
    type: String,
    choices: {
      default: "PF1.Default",
      imperial: "PF1.SETTINGS.Units.ImperialDistance",
      metric: "PF1.SETTINGS.Units.MetricDistance",
    },
    requiresReload: true,
  });

  /**
   * System of units override for weights.
   */
  game.settings.register("pf1", "weightUnits", {
    name: "PF1.SETTINGS.Units.Weight",
    hint: "PF1.SETTINGS.Units.WeightHint",
    scope: "world",
    config: true,
    default: "default",
    type: String,
    choices: {
      default: "PF1.Default",
      imperial: "PF1.SETTINGS.Units.ImperialWeight",
      metric: "PF1.SETTINGS.Units.MetricWeight",
    },
    requiresReload: true,
  });

  /**
   * Overland speed variant for metric.
   */
  game.settings.register("pf1", "overlandMetricVariant", {
    name: "PF1.SETTINGS.OverlandVariantN",
    hint: "PF1.SETTINGS.OverlandVariantL",
    scope: "world",
    config: true,
    default: "rounded",
    choices: {
      rounded: "PF1.SETTINGS.OverlandMetricRounded",
      exact: "PF1.SETTINGS.OverlandMetricExact",
    },
  });

  // OPTIONAL RULES

  /**
   * Option to allow the background skills optional ruleset.
   */
  game.settings.register("pf1", "allowBackgroundSkills", {
    name: "PF1.SETTINGS.VariantRules.BackgroundSkills",
    hint: "PF1.SETTINGS.VariantRules.BackgroundSkillsHint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => pf1.utils.refreshActors({ renderOnly: true }),
  });

  /**
   * Option to use the Fractional Base Bonuses optional ruleset.
   */
  game.settings.register("pf1", "useFractionalBaseBonuses", {
    name: "PF1.SETTINGS.VariantRules.FractionalBaseBonuses",
    hint: "PF1.SETTINGS.VariantRules.FractionalBaseBonusesHint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true,
  });

  /**
   * Unchained action economy
   */
  game.settings.register("pf1", "unchainedActionEconomy", {
    name: "PF1.SETTINGS.UnchainedActionEconomyN",
    hint: "PF1.SETTINGS.UnchainedActionEconomyH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => pf1.utils.refreshActors({ renderOnly: true }),
  });

  /**
   * Cybertech
   */
  game.settings.register("pf1", "cybertech", {
    name: "PF1.SETTINGS.Cybertech",
    hint: "PF1.SETTINGS.CybertechHint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => pf1.utils.refreshActors({ renderOnly: true }),
  });

  // Armor as DR

  /**
   * Critical confirmation rolls
   */
  game.settings.register("pf1", "critConfirm", {
    name: "PF1.SETTINGS.CriticalConfirm",
    hint: "PF1.SETTINGS.CriticalConfirmHint",
    scope: "world",
    type: Boolean,
    default: true,
    config: true,
  });

  // VISION

  /**
   * Low-light Vision Mode
   */
  game.settings.register("pf1", "lowLightVisionMode", {
    name: "PF1.SETTINGS.Vision.RequiresSelection",
    hint: "PF1.SETTINGS.Vision.RequiresSelectionHint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      // Refresh canvas sight
      canvas.perception.update(
        { initializeLighting: true, initializeVision: true, refreshLighting: true, refreshVision: true },
        true
      );
    },
  });

  /**
   * Shared Vision sharing style.
   */
  game.settings.register("pf1", "sharedVisionMode", {
    name: "PF1.SETTINGS.Vision.Sharing",
    hint: "PF1.SETTINGS.Vision.SharingHint",
    scope: "world",
    config: false, // Hidden as it is unused; TODO: Re-implement #187's setting usage or remove setting/feature completely
    default: 0,
    type: Number,
    choices: {
      0: "PF1.SETTINGS.Vision.SharingWithoutSelection",
      1: "PF1.SETTINGS.Vision.SharingWithSelection",
    },
    onChange: () => canvas.perception.update({ refreshLighting: true, refreshVision: true }, true),
  });

  game.settings.register("pf1", "guaranteedVision", {
    name: "PF1.SETTINGS.Vision.Guaranteed",
    hint: "PF1.SETTINGS.Vision.GuaranteedHint",
    scope: "world",
    config: true,
    default: "OBSERVER",
    type: String,
    choices: {
      OBSERVER: "OWNERSHIP.OBSERVER",
      OWNER: "OWNERSHIP.OWNER",
    },
    onChange: () => canvas.perception.update({ refreshLighting: true, refreshVision: true }, true),
  });

  /**
   * Enable vision for player characters by default.
   */
  game.settings.register("pf1", "characterVision", {
    name: "PF1.SETTINGS.Vision.PCDefault",
    hint: "PF1.SETTINGS.Vision.PCDefaultHint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  game.settings.register("pf1", "pcDisposition", {
    name: "PF1.SETTINGS.Token.PCDisposition",
    hint: "PF1.SETTINGS.Token.PCDispositionHint",
    type: String,
    choices: {
      NONE: "PF1.NoOverride",
      FRIENDLY: "TOKEN.DISPOSITION.FRIENDLY",
      NEUTRAL: "TOKEN.DISPOSITION.NEUTRAL",
    },
    default: "FRIENDLY",
    scope: "world",
    config: true,
  });

  game.settings.register("pf1", "npcDisposition", {
    name: "PF1.SETTINGS.Token.NPCDisposition",
    hint: "PF1.SETTINGS.Token.NPCDispositionHint",
    type: String,
    choices: {
      NONE: "PF1.NoOverride",
      NEUTRAL: "TOKEN.DISPOSITION.NEUTRAL",
      HOSTILE: "TOKEN.DISPOSITION.HOSTILE",
    },
    default: "NONE",
    scope: "world",
    config: true,
  });

  game.settings.register("pf1", "systemVision", {
    name: "PF1.SETTINGS.Vision.SystemControl",
    hint: "PF1.SETTINGS.Vision.SystemControlHint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: () => {
      Object.values(ui.windows)
        .filter((app) => app instanceof TokenConfig)
        .forEach((app) => app.render());

      // Initialize lighting is required for LLV to take effect
      canvas.perception.update({ initializeLighting: true, refreshLighting: true, refreshVision: true }, true);
    },
  });

  // CHAT CARDS

  /**
   * Option to automatically collapse Item Card descriptions
   */
  game.settings.register("pf1", "autoCollapseItemCards", {
    name: "PF1.SETTINGS.Chat.AutoCollapse",
    hint: "PF1.SETTINGS.Chat.AutoCollapseHint",
    scope: "client",
    config: true,
    default: 0,
    type: Number,
    choices: {
      0: "PF1.SETTINGS.Chat.AutoCollapseExpanded",
      1: "PF1.SETTINGS.Chat.AutoCollapseCompacted",
      2: "PF1.SETTINGS.Chat.AutoCollapseCollapsed",
    },
    onChange: () => ui.chat.render(), // BUG: This doesn't work
  });

  /**
   * Option to hide chat buttons
   */
  game.settings.register("pf1", "hideChatButtons", {
    name: "PF1.SETTINGS.Chat.HideButtons",
    hint: "PF1.SETTINGS.Chat.HideButtonsHint",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => ui.chat.render(),
  });

  // HOMEBREW

  /**
   * Set coin weight
   */
  game.settings.register("pf1", "coinWeight", {
    name: "PF1.SETTINGS.Houserules.CoinDivisor",
    hint: "PF1.SETTINGS.Houserules.CoinDivisorHint",
    scope: "world",
    config: true,
    default: 50,
    type: Number,
    requiresReload: true,
  });

  /**
   * Default spellpoint cost
   */
  game.settings.register("pf1", "spellPointCost", {
    name: "PF1.SETTINGS.Houserules.SpellPointCost",
    hint: "PF1.SETTINGS.Houserules.SpellPointCostHint",
    scope: "world",
    config: true,
    default: "1 + @sl",
    type: String,
    onChange: () => pf1.utils.refreshSheets({ reset: false }),
  });

  /**
   * Alternative reach corner rule
   */
  game.settings.register("pf1", "alternativeReachCornerRule", {
    name: "PF1.SETTINGS.Houserules.AltReach",
    hint: "PF1.SETTINGS.Houserules.AltReachHint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

  /**
   * Allow proficiencies on NPCs.
   */
  game.settings.register("pf1", "npcProficiencies", {
    name: "PF1.SETTINGS.Houserules.NPCProficiencies",
    hint: "PF1.SETTINGS.Houserules.NPCProficienciesHint",
    scope: "world",
    config: true,
    default: false,
    onChange: () => pf1.utils.refreshSheets({ reset: false }),
    type: Boolean,
  });

  // TOKENS / CONDITIONS

  /**
   * Display default token conditions alongside system ones
   */
  game.settings.register("pf1", "coreEffects", {
    name: "PF1.SETTINGS.CoreEffectsN",
    hint: "PF1.SETTINGS.CoreEffectsH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true,
  });

  /**
   * Hide token conditions
   */
  game.settings.register("pf1", "hideTokenConditions", {
    name: "PF1.SETTINGS.HideTokenConditionsN",
    hint: "PF1.SETTINGS.HideTokenConditionsH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => canvas.tokens?.placeables?.forEach((t) => t._applyRenderFlags({ redrawEffects: true })),
  });

  // TRANSPARENCY

  /**
   * Hide inline rolls from non-observers.
   */
  game.settings.register("pf1", "obscureInlineRolls", {
    name: "PF1.SETTINGS.Chat.ObscureInlineRolls",
    hint: "PF1.SETTINGS.Chat.ObscureInlineRollsHint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true,
  });

  /**
   * Hide save DCs.
   */
  game.settings.register("pf1", "obscureSaveDCs", {
    name: "PF1.SETTINGS.Chat.ObscureSaveDCs",
    hint: "PF1.SETTINGS.Chat.ObscureSaveDCsHint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    requiresReload: true,
  });

  // COMBAT

  game.settings.register("pf1", "initiativeTiebreaker", {
    name: "PF1.SETTINGS.InitTiebreaker.Label",
    hint: "PF1.SETTINGS.InitTiebreaker.Hint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    requiresReload: true,
  });

  // USER INTERFACE

  /**
   * Skip action dialog prompts
   */
  game.settings.register("pf1", "skipActionDialogs", {
    name: "PF1.SETTINGS.SkipActionDialogsN",
    hint: "PF1.SETTINGS.SkipActionDialogsH",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  });

  /*
   * When skipping an action dialog prompt still place the template if one is configured
   */
  game.settings.register("pf1", "placeMeasureTemplateOnQuickRolls", {
    name: "PF1.SETTINGS.MeasureOnQuickUse",
    hint: "PF1.SETTINGS.MeasureOnQuickUseHint",
    scope: "client",
    config: true,
    default: true,
    type: Boolean,
  });

  /**
   * Invert filter Shift-clicking
   */
  game.settings.register("pf1", "invertSectionFilterShiftBehaviour", {
    name: "PF1.SETTINGS.Sheet.InvertFilters",
    hint: "PF1.SETTINGS.Sheet.InvertFiltersHint",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  });

  // TARGETING

  /**
   * Disable targets for attack cards
   */
  game.settings.register("pf1", "disableAttackCardTargets", {
    name: "PF1.SETTINGS.Chat.NoTargets",
    hint: "PF1.SETTINGS.Chat.NoTargetsHint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

  /**
   * Clear targets after attack
   */
  game.settings.register("pf1", "clearTargetsAfterAttack", {
    name: "PF1.SETTINGS.Chat.ClearTargets",
    hint: "PF1.SETTINGS.Chat.ClearTargetsHint",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  });
};

export const registerClientSettings = function () {};

export const migrateSystemSettings = async function () {
  // Delete now unused compendium browser cache
  game.settings.storage.get("client").removeItem("pf1.compendiumItems");

  if (!game.user.isGM) return;

  // Currently empty, since the last option was removed (2022-06-06)
};

/**
 * Returns whether the user's settings and key presses signal that dialogs should be skipped.
 *
 * @returns {boolean}
 */
export const getSkipActionPrompt = function () {
  return (
    (game.settings.get("pf1", "skipActionDialogs") && !pf1.skipConfirmPrompt) ||
    (!game.settings.get("pf1", "skipActionDialogs") && pf1.skipConfirmPrompt)
  );
};
