/**
 * Apply patches to Core Foundry to implement Pathfinder's Low-Light Vision rules
 */
export function patchLowLightVision() {
  SightLayer.prototype.hasLowLight = function () {
    console.warn("SightLayer#hasLowLight is deprecated in favor of SightLayer#lowLightMultiplier");

    const relevantTokens = canvas.tokens.placeables.filter((o) => {
      return o.actor && o.actor.testUserPermission(game.user, "OBSERVER");
    });
    const lowLightTokens = relevantTokens.filter((o) => getProperty(o, "actorVision.lowLight"));
    if (game.user.isGM) {
      return lowLightTokens.filter((o) => o._controlled).length > 0;
    }
    if (game.settings.get("pf1", "lowLightVisionMode")) {
      return lowLightTokens.filter((o) => o._controlled).length > 0;
    }

    const hasControlledTokens = relevantTokens.filter((o) => o._controlled).length > 0;
    const hasControlledLowLightTokens = lowLightTokens.filter((o) => o._controlled).length > 0;
    const hasLowLightTokens = lowLightTokens.length > 0;
    return (!hasControlledTokens && hasLowLightTokens) || hasControlledLowLightTokens;
  };

  SightLayer.prototype.lowLightMultiplier = function () {
    const result = {
      dim: 1,
      bright: 1,
    };

    const relevantTokens = canvas.tokens.placeables.filter((o) => {
      return o.actor && o.actor.testUserPermission(game.user, "OBSERVER");
    });
    const lowLightTokens = relevantTokens.filter((o) => getProperty(o, "actorVision.lowLight"));

    if (game.user.isGM || game.settings.get("pf1", "lowLightVisionMode")) {
      for (const t of lowLightTokens.filter((o) => o._controlled)) {
        const multiplier = getProperty(t, "actorVision.lowLightMultiplier") || 2;
        const multiplierBright = getProperty(t, "actorVision.lowLightMultiplierBright") || 2;
        result.dim = Math.max(result.dim, multiplier);
        result.bright = Math.max(result.bright, multiplierBright);
      }
    } else {
      const hasControlledTokens = relevantTokens.filter((o) => o._controlled).length > 0;
      const hasControlledLowLightTokens = lowLightTokens.filter((o) => o._controlled).length > 0;
      const hasLowLightTokens = lowLightTokens.length > 0;
      if ((!hasControlledTokens && hasLowLightTokens) || hasControlledLowLightTokens) {
        for (const t of lowLightTokens) {
          const multiplier = getProperty(t, "actorVision.lowLightMultiplier") || 2;
          const multiplierBright = getProperty(t, "actorVision.lowLightMultiplierBright") || 2;
          result.dim = Math.max(result.dim, multiplier);
          result.bright = Math.max(result.bright, multiplierBright);
        }
      }
    }

    return result;
  };

  Object.defineProperty(AmbientLight.prototype, "disableLowLight", {
    get: function () {
      return getProperty(this.data, "flags.pf1.disableLowLight") === true;
    },
  });

  const AmbientLight__get__dimRadius = Object.getOwnPropertyDescriptor(AmbientLight.prototype, "dimRadius").get;
  Object.defineProperty(AmbientLight.prototype, "dimRadius", {
    get: function () {
      const result = AmbientLight__get__dimRadius.call(this);
      if (!this.disableLowLight) return result * canvas.sight.lowLightMultiplier().dim;
      return result;
    },
  });

  const AmbientLight__get__brightRadius = Object.getOwnPropertyDescriptor(AmbientLight.prototype, "brightRadius").get;
  Object.defineProperty(AmbientLight.prototype, "brightRadius", {
    get: function () {
      const result = AmbientLight__get__brightRadius.call(this);
      if (!this.disableLowLight) return result * canvas.sight.lowLightMultiplier().bright;
      return result;
    },
  });
}

/**
 * Add a checkbox to enable/disable low-light vision effects to a light's configuration
 *
 * @param {FormApplication} app - The LightConfig app
 * @param {jQuery} html - The jQuery of the inner html
 */
export const addLowLightVisionToLightConfig = function (app, html) {
  const obj = app.object;

  // Create checkbox HTML element
  let checkboxStr = `<div class="form-group"><label>${game.i18n.localize(
    "PF1.DisableLightLowLightVision"
  )}</label><div class="form-group">`;
  checkboxStr += '<input type="checkbox" name="flags.pf1.disableLowLight" data-dtype="Boolean"';
  if (getProperty(obj.data, "flags.pf1.disableLowLight")) checkboxStr += " checked";
  checkboxStr += "/></div></div>";
  const checkbox = $(checkboxStr);

  // Insert new checkbox
  checkbox.insertBefore(html.find('button[type="submit"]'));
};

/**
 * Add a checkbox to enable/disable low-light vision to a token's configuration
 *
 * @param {FormApplication} app - The TokenConfig app
 * @param {jQuery} html - The jQuery of the inner html
 */
export const addLowLightVisionToTokenConfig = function (app, html) {
  const obj = app.object;

  // Create checkbox HTML element
  let checkboxStr = `<div class="form-group"><label>${game.i18n.localize(
    "PF1.DisableLightLowLightVision"
  )}</label><div class="form-group">`;
  checkboxStr += '<input type="checkbox" name="flags.pf1.disableLowLight" data-dtype="Boolean"';
  if (getProperty(obj.data, "flags.pf1.disableLowLight")) checkboxStr += " checked";
  checkboxStr += "/></div></div>";
  const checkbox = $(checkboxStr);

  // Insert new checkbox
  html.find('.tab[data-tab="vision"]').append(checkbox);
};
