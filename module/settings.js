export const registerSystemSettings = function() {

  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("pf1", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  /**
   * Auto calculate hit points
   */
  game.settings.register("pf1", "autoHPFormula", {
    name: "SETTINGS.pf1AutoHPFormulaN",
    hint: "SETTINGS.pf1AutoHPFormulaL",
    scope: "world",
    config: true,
    default: "manual",
    type: String,
    choices: {
      "manual": "SETTINGS.pf1AutoHPFormulaManual",
      "50": "SETTINGS.pf1AutoHPFormula50",
      "75": "SETTINGS.pf1AutoHPFormula75",
      "100": "SETTINGS.pf1AutoHPFormula100",
      "50F": "SETTINGS.pf1AutoHPFormula50F",
      "75F": "SETTINGS.pf1AutoHPFormula75F",
    },
    onChange: () => {
      game.actors.entities.forEach(o => { if (o.isPC) o.update({}); });
      Object.values(game.actors.tokens).forEach(o => { if (o.isPC) o.update({}); });
    }
  });

  /**
   * Auto calculate hit points
   */
  game.settings.register("pf1", "NPCAutoHPFormula", {
    name: "SETTINGS.pf1NPCAutoHPFormulaN",
    hint: "SETTINGS.pf1NPCAutoHPFormulaL",
    scope: "world",
    config: true,
    default: "manual",
    type: String,
    choices: {
      "manual": "SETTINGS.pf1AutoHPFormulaManual",
      "50": "SETTINGS.pf1AutoHPFormula50",
      "75": "SETTINGS.pf1AutoHPFormula75",
      "100": "SETTINGS.pf1AutoHPFormula100",
      "50F": "SETTINGS.pf1AutoHPFormula50F",
      "75F": "SETTINGS.pf1AutoHPFormula75F",
    },
    onChange: () => {
      game.actors.entities.forEach(o => { if (!o.isPC) o.update({}); });
      Object.values(game.actors.tokens).forEach(o => { if (!o.isPC) o.update({}); });
    }
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
      "555": "SETTINGS.pf1DiagPHB",
      "5105": "SETTINGS.pf1DiagDMG"
    },
    onChange: rule => canvas.grid.diagonalRule = rule
  });

  /**
   * Experience rate
   */
  game.settings.register("pf1", "experienceRate", {
    name: "SETTINGS.pf1ExpRateN",
    hint: "SETTINGS.pf1ExpRateL",
    scope: "world",
    config: true,
    default: "medium",
    type: String,
    choices: {
      "slow": "Slow",
      "medium": "Medium",
      "fast": "Fast",
    },
    onChange: () => {
      [...game.actors.entities, ...Object.values(game.actors.tokens)].filter(o => {
        return o.data.type === "character";
      }).forEach(o => {
        o.update({});
        if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
      });
    },
  });

  /**
   * Option to disable XP bar for session-based or story-based advancement.
   */
  game.settings.register("pf1", "disableExperienceTracking", {
    name: "SETTINGS.pf1NoExpN",
    hint: "SETTINGS.pf1NoExpL",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
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
      [...game.actors.entities, ...Object.values(game.actors.tokens)].filter(o => {
        return o.data.type === "character";
      }).forEach(o => {
        o.update({});
        if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
      });
    }
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
    }
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
    default: true,
    type: Boolean,
  });
};
