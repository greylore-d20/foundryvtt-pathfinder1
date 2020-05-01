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

  game.settings.registerMenu("system", "healthConfig", {
    name: "SETTINGS.pf1HealthConfigName",
    label: "SETTINGS.pf1HealthConfigLabel",
    hint: "SETTINGS.pf1HealthConfigHint",
    icon: "fas fa-heartbeat",
    type: HealthConfig,
    restricted: true
  })

  game.settings.register("pf1", "healthConfig", {
    name: "SETTINGS.pf1HealthConfigName",
    scope: "world",
    default: {},
    type: Object,
    config: false,
    onChange: () => {
      game.actors.entities.forEach(o => { o.update({}) })
      Object.values(game.actors.tokens).forEach(o => { o.update({}) })
    }
  })

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
    onChange: () => {
      game.actors.entities.forEach(o => { if (o.sheet && o.sheet.rendered) o.sheet.render(true); });
      Object.values(game.actors.tokens).forEach(o => { if (o.sheet && o.sheet.rendered) o.sheet.render(true); });
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
      game.actors.entities.forEach(o => { o.update({}); });
      Object.values(game.actors.tokens).forEach(o => { o.update({}); });
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
    default: false,
    type: Boolean,
  });
};


class HealthConfig extends FormApplication {
  constructor(object, options) {
    super(object || HealthConfig.defaultSettings, options)
  }

  /** Collect data for the template. @override */
  async getData() {
    let settings = await game.settings.get("pf1", "healthConfig")
    settings = mergeObject(HealthConfig.defaultSettings, settings)
    return settings
  }

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title:  game.i18n.localize("SETTINGS.pf1HealthConfigName"),
      id: 'health-config',
      template: "systems/pf1/templates/settings/health.html",
      width: 480,
      height: "auto",
      tabs: [{
        navSelector: ".tabs",
        contentSelector: ".tabbed",
        initial: "base"
      }]
    })
  }

  static get defaultSettings() {
    return {
      hitdice: {
        PC:     {auto: false, rate: 0.5, maximized: 1},
        NPC:    {auto: false, rate: 0.5, maximized: 0},
        Racial: {auto: false, rate: 0.5, maximized: 0}
      },
      hitdieOptions: ["Compute", "Rate", "Maximized"],
      rounding: "up",
      continuity: "discrete",
      variants: {
        pc:  {useWoundsAndVigor: false},
        npc: {useWoundsAndVigor: false}
      }
    }
  }

  /**
   * Activate the default set of listeners for the Entity sheet These listeners handle basic stuff like form submission or updating images.
   * @override
   */
  activateListeners(html) {
    super.activateListeners(html)
    html.find('button[name="reset"]').click(this._onReset.bind(this))
    html.find('button[name="submit"]').click(this._onSubmit.bind(this))
  }

  /**
   * Handle button click to reset default settings
   * @param event {Event}   The initial button click event
   * @private
   */
  async _onReset(event) {
    event.preventDefault();
    await game.settings.set("pf1", "healthConfig", HealthConfig.defaultSettings)
    ui.notifications.info(`Reset Pathfinder health configuration.`)
    return this.render()
  }

  _onSubmit(event) {
    super._onSubmit(event)
  }

  /**
   * This method is called upon form submission after form data is validated.
   * @override
   */
  async _updateObject(event, formData) {
    const settings = expandObject(formData)
    // Some mild sanitation for the numeric values.
    for (const hd of Object.values(settings.hitdice)) {
      hd.rate = Math.max(0, Math.min(hd.rate, 100))
      hd.maximized = Math.max(0, Math.min(Math.floor(hd.maximized), 100))
    }
    await game.settings.set("pf1", "healthConfig", settings)
    ui.notifications.info(`Updated Pathfinder health configuration.`)
  }
}
