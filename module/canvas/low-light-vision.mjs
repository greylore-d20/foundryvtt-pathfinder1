/**
 * Add a checkbox to enable/disable low-light vision effects to a light's configuration
 *
 * @param {FormApplication} app - The LightConfig app
 * @param {jQuery} html - The jQuery of the inner html
 */
export const addLowLightVisionToLightConfig = function (app, html) {
  /** @type {AmbientLightDocument} */
  const light = app.object;

  // Create checkbox HTML element
  let checkboxStr = `<div class="form-group"><label>${game.i18n.localize("PF1.DisableLightLowLightVision")}</label>`;
  checkboxStr += '<input type="checkbox" name="flags.pf1.disableLowLight" data-dtype="Boolean"';
  if (light.getFlag("pf1", "disableLowLight")) checkboxStr += " checked";
  checkboxStr += "/></div>";
  const checkbox = $(checkboxStr);

  // Insert new checkbox
  html.find('div.tab[data-tab="basic"]').append(checkbox);
};

/**
 * Add a checkbox to enable/disable low-light vision to a token's configuration
 *
 * @param {FormApplication} app - The TokenConfig app
 * @param {jQuery} html - The jQuery of the inner html
 */
export const addLowLightVisionToTokenConfig = function (app, html) {
  /** @type {TokenDocument} */
  const token = app.object;

  // Create checkbox HTML element
  let checkboxStr = `<div class="form-group"><label>${game.i18n.localize("PF1.DisableLightLowLightVision")}</label>`;
  checkboxStr += '<input type="checkbox" name="flags.pf1.disableLowLight" data-dtype="Boolean"';
  if (token.getFlag("pf1", "disableLowLight")) checkboxStr += " checked";
  checkboxStr += "/></div>";
  const checkbox = $(checkboxStr);

  // Insert new checkbox
  html.find('.tab[data-group="light"][data-tab="basic"]').append(checkbox);
};

export const patchCore = function () {
  const LightSource_initialize = LightSource.prototype.initialize;
  LightSource.prototype.initialize = function (data = {}) {
    // Initialize new input data
    const changes = this._initializeData(data);
    this._initializeFlags();

    // Record the requested animation configuration
    const seed = this.animation.seed ?? data.seed ?? Math.floor(Math.random() * 100000);
    const animationConfig = foundry.utils.deepClone(CONFIG.Canvas.lightAnimations[this.data.animation.type] || {});
    this.animation = Object.assign(animationConfig, this.data.animation, { seed });

    // Compute dim and bright radius
    const { dim, bright } = this.getRadius();

    // Compute data attributes
    this.colorRGB = Color.from(this.data.color)?.rgb;
    this.radius = Math.max(Math.abs(dim), Math.abs(bright));
    this.ratio = Math.clamped(Math.abs(bright) / this.radius, 0, 1);
    this.isDarkness = this.data.luminosity < 0;

    // Compute the source polygon
    this.los = this._createPolygon();
    this._flags.renderSoftEdges =
      canvas.performance.lightSoftEdges && (!!this.los.rays?.length || this.data.angle < 360);

    // Initialize or update meshes with the los points array
    this._initializeMeshes(this.los);

    // Update shaders if the animation type or the constrained wall option changed
    const updateShaders = "animation.type" in changes || "walls" in changes;
    if (updateShaders) this._initializeShaders();
    else if (this.constructor._appearanceKeys.some((k) => k in changes)) {
      // Record status flags
      for (const k of Object.keys(this._resetUniforms)) {
        this._resetUniforms[k] = true;
      }
    }

    // Initialize blend modes and sorting
    this._initializeBlending();
    return this;
  };

  LightSource.prototype.getRadius = function () {
    const result = { dim: this.data.dim, bright: this.data.bright };
    let multiplier = { dim: 1, bright: 1 };

    if (this.object?.document.getFlag("pf1", "disableLowLight")) return result;

    const requiresSelection = game.user.isGM || game.settings.get("pf1", "lowLightVisionMode");
    const relevantTokens = canvas.tokens.placeables.filter(
      (o) =>
        !!o.actor && o.actor?.testUserPermission(game.user, "OBSERVER") && (requiresSelection ? o.controlled : true)
    );
    const lowLightTokens = relevantTokens.filter((o) => o.actorVision.lowLight === true);

    if (requiresSelection) {
      if (lowLightTokens.length === relevantTokens.length) {
        multiplier = { dim: 999, bright: 999 };
        for (const t of lowLightTokens) {
          const tokenVision = t.actorVision;
          multiplier.dim = Math.min(multiplier.dim, tokenVision.lowLightMultiplier);
          multiplier.bright = Math.min(multiplier.bright, tokenVision.lowLightMultiplierBright);
        }
      }
    } else {
      for (const t of lowLightTokens) {
        const tokenVision = t.actorVision;
        multiplier.dim = Math.max(multiplier.dim, tokenVision.lowLightMultiplier);
        multiplier.bright = Math.max(multiplier.bright, tokenVision.lowLightMultiplierBright);
      }
    }

    result.dim *= multiplier.dim;
    result.bright *= multiplier.bright;

    return result;
  };
};
