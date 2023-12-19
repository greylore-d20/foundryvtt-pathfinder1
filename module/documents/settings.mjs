import { HealthConfig, HealthConfigModel } from "../applications/settings/health.mjs";
import { ExperienceConfig, ExperienceConfigModel } from "../applications/settings/experience.mjs";
import { AccessibilityConfig, AccessibilityConfigModel } from "../applications/settings/accessibility.mjs";
import { TooltipConfig, TokenTooltipConfigModel } from "../applications/settings/tooltip.mjs";
import { TooltipWorldConfig, TokenTooltipWorldConfigModel } from "../applications/settings/tooltip_world.mjs";
import { IntegrationConfig, IntegrationModel } from "module/applications/settings/integration.mjs";
import { TooltipPF } from "../applications/tooltip.mjs";
import { setDefaultSceneScaling } from "@utils";

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
    default: new HealthConfigModel(),
    type: HealthConfigModel,
    config: false,
    onChange: () => pf1.utils.refreshActors(),
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
    default: new ExperienceConfigModel(),
    type: ExperienceConfigModel,
    config: false,
    onChange: () => pf1.utils.refreshActors({ renderOnly: true }),
  });

  // Accessibility configuration
  /*
  game.settings.registerMenu("pf1", "accessibilityConfig", {
    name: "PF1.AccessibilityConfigName",
    label: "PF1.AccessibilityConfigLabel",
    hint: "PF1.AccessibilityConfigHint",
    restricted: false,
    icon: "fas fa-wheelchair",
    type: AccessibilityConfig,
  });
  */
  game.settings.register("pf1", "accessibilityConfig", {
    name: "PF1.AccessibilityConfigName",
    scope: "client",
    default: new AccessibilityConfigModel(),
    type: AccessibilityConfigModel,
    config: false,
    onChange: () => pf1.utils.refreshActors(),
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
    name: "PF1.Application.Integration.Title",
    label: "PF1.Application.Integration.Label",
    hint: "PF1.Application.Integration.Hint",
    restricted: true,
    icon: "fa-solid fa-check-to-slot",
    type: IntegrationConfig,
  });

  // MEASURING

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
  });

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
    onChange: () => {
      pf1.utils.refreshActors();
      setDefaultSceneScaling();
    },
  });

  /**
   * System of units override for distances.
   */
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
    onChange: () => {
      pf1.utils.refreshActors({ renderOnly: true });
      setDefaultSceneScaling();
    },
  });

  /**
   * System of units override for weights.
   */
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
    onChange: () => pf1.utils.refreshActors(),
  });

  /**
   * Overland speed variant for metric.
   */
  game.settings.register("pf1", "overlandMetricVariant", {
    name: "SETTINGS.pf1OverlandVariantN",
    hint: "SETTINGS.pf1OverlandVariantL",
    scope: "world",
    config: true,
    default: "rounded",
    choices: {
      rounded: "SETTINGS.pf1OverlandMetricRounded",
      exact: "SETTINGS.pf1OverlandMetricExact",
    },
  });

  // OPTIONAL RULES

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
    onChange: () => pf1.utils.refreshActors({ renderOnly: true }),
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
    onChange: () => pf1.utils.refreshActors(),
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
    onChange: () => pf1.utils.refreshActors({ renderOnly: true }),
  });

  // VISION

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
    name: "SETTINGS.pf1SharedVisionModeN",
    hint: "SETTINGS.pf1SharedVisionModeH",
    scope: "world",
    config: false, // Hidden as it is unused; TODO: Re-implement #187's setting usage or remove setting/feature completely
    default: "0",
    type: String,
    choices: {
      0: "SETTINGS.pf1SharedVisionWithoutSelection",
      1: "SETTINGS.pf1SharedVisionWithSelection",
    },
    onChange: () => canvas.perception.update({ refreshLighting: true, refreshVision: true }, true),
  });

  /**
   * Enable vision for player characters by default.
   */
  game.settings.register("pf1", "characterVision", {
    name: "SETTINGS.pf1characterVisionN",
    hint: "SETTINGS.pf1characterVisionH",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  game.settings.register("pf1", "pcDisposition", {
    name: "SETTINGS.pf1pcDispositionN",
    hint: "SETTINGS.pf1pcDispositionH",
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
    name: "SETTINGS.pf1npcDispositionN",
    hint: "SETTINGS.pf1npcDispositionH",
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
    name: "SETTINGS.pf1systemVisionN",
    hint: "SETTINGS.pf1systemVisionH",
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
    name: "SETTINGS.pf1AutoCollapseCardN",
    hint: "SETTINGS.pf1AutoCollapseCardL",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => ui.chat.render(),
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
    onChange: () => ui.chat.render(),
  });

  // HOMEBREW

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
    onChange: () => pf1.utils.refreshActors(),
  });

  /**
   * Default spellpoint cost
   */
  game.settings.register("pf1", "spellPointCost", {
    name: "SETTINGS.pf1SpellPointCostN",
    hint: "SETTINGS.pf1SpellPointCostH",
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
    name: "SETTINGS.pf1AlternativeReachCornerRuleN",
    hint: "SETTINGS.pf1AlternativeReachCornerRuleH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

  /**
   * Allow proficiencies on NPCs.
   */
  game.settings.register("pf1", "npcProficiencies", {
    name: "SETTINGS.pf1NPCProficienciesN",
    hint: "SETTINGS.pf1NPCProficienciesH",
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
    name: "SETTINGS.pf1CoreEffectsN",
    hint: "SETTINGS.pf1CoreEffectsH",
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
    name: "SETTINGS.pf1HideTokenConditionsN",
    hint: "SETTINGS.pf1HideTokenConditionsH",
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
    name: "SETTINGS.pf1obscureInlineRollsN",
    hint: "SETTINGS.pf1obscureInlineRollsH",
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
    name: "SETTINGS.pf1obscureSaveDCsN",
    hint: "SETTINGS.pf1obscureSaveDCsH",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    requiresReload: true,
  });

  // COMBAT

  game.settings.register("pf1", "initiativeTiebreaker", {
    name: "SETTINGS.pf1InitTiebreakerN",
    hint: "SETTINGS.pf1InitTiebreakerH",
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

  // TARGETING

  /**
   * Disable targets for attack cards
   */
  game.settings.register("pf1", "disableAttackCardTargets", {
    name: "SETTINGS.pf1DisableAttackCardTargetsN",
    hint: "SETTINGS.pf1DisableAttackCardTargetsH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

  /**
   * Clear targets after attack
   */
  game.settings.register("pf1", "clearTargetsAfterAttack", {
    name: "SETTINGS.pf1ClearTargetsAfterAttackN",
    hint: "SETTINGS.pf1ClearTargetsAfterAttackH",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  });

  // SECURITY

  /**
   * Allow Script type Changes.
   */
  game.settings.register("pf1", "allowScriptChanges", {
    name: "SETTINGS.pf1AllowScriptChangesN",
    hint: "SETTINGS.pf1AllowScriptChangesH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: (value) => {
      if (!value || !game.user.isGM) return;
      // Flash scare message and confirmation
      const d = Dialog.confirm({
        title: game.i18n.localize("SETTINGS.pf1AllowScriptChangesN"),
        content: game.i18n.localize("SETTINGS.pf1AllowScriptChangesW"),
        defaultYes: false,
      });
      d.then((result) => {
        if (!result) game.settings.set("pf1", "allowScriptChanges", false);
      });
    },
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
