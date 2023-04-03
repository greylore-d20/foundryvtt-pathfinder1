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
  const LightSource_initializeData = LightSource.prototype._initializeData;

  LightSource.prototype._initializeData = function (data = {}) {
    const rv = LightSource_initializeData.call(this, data);
    const { dim, bright } = this.getRadius(this.data.dim, this.data.bright);
    this.data.dim = dim;
    this.data.bright = bright;
    return rv;
  };

  LightSource.prototype.getRadius = function (dim, bright) {
    const result = { dim, bright };
    let multiplier = { dim: 1, bright: 1 };

    if (this.object?.document.getFlag("pf1", "disableLowLight")) return result;

    const requiresSelection = game.user.isGM || game.settings.get("pf1", "lowLightVisionMode");
    const relevantTokens = canvas.tokens.placeables.filter(
      (o) =>
        !!o.actor && o.actor?.testUserPermission(game.user, "OBSERVER") && (requiresSelection ? o.controlled : true)
    );
    const lowLightTokens = relevantTokens.filter((o) => o.actorVision.lowLight === true);

    if (requiresSelection) {
      if (lowLightTokens.length && lowLightTokens.length === relevantTokens.length) {
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
