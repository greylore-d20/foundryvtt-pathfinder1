/**
 * Add a checkbox to enable/disable low-light vision effects to a light's configuration
 *
 * @param {AmbientLightConfig} app - The LightConfig app
 * @param {Element} html - The application HTML element
 */
export const addLowLightVisionToLightConfig = function (app, html) {
  /** @type {AmbientLightDocument} */
  const light = app.document;

  // Create checkbox HTML element
  const bf = new foundry.data.fields.BooleanField();

  /** @type {Element} */
  const el = bf.toFormGroup(
    {
      label: game.i18n.localize("PF1.SETTINGS.DisableLLV.Label"),
      hint: game.i18n.localize("PF1.SETTINGS.DisableLLV.Hint"),
    },
    {
      name: "flags.pf1.disableLowLight",
      value: light.getFlag("pf1", "disableLowLight") ?? false,
    }
  );

  // Create containing fieldset
  const field = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.innerText = game.i18n.localize("PF1.Title");
  field.append(legend, el);

  // Insert new checkbox
  html.querySelector('section.tab[data-tab="advanced"]').append(field);
};

/**
 * LLV support mixin for AmbientLight and Token
 *
 * @param {*} Base - Base class
 * @returns {*} - Mixin class
 */
export const LLVMixin = (Base) =>
  class extends Base {
    /** @override */
    _getLightSourceData() {
      const data = super._getLightSourceData();

      const { dim, bright } = this.getRadius(data.dim, data.bright);

      // Avoid NaN and introducing keys that shouldn't be in the data
      // Without undefined check, global illumination will cause darkvision and similar vision modes to glitch.
      // We're assuming getRadius gives sensible values otherwise.
      if (data.dim !== undefined) data.dim = dim;
      if (data.bright !== undefined) data.bright = bright;

      return data;
    }

    /**
     * @param {number} dim - Dim radius
     * @param {number} bright - Bright radius
     * @returns {{dim:number,bright:number}} - Adjusted distances
     */
    getRadius(dim, bright) {
      const result = { dim, bright };
      let multiplier = { dim: 1, bright: 1 };

      if (!game.settings.get("pf1", "systemVision")) return result;

      /**
       * @param {TokenDocument} token
       * @returns {boolean}
       */
      const hasSystemVision = (token) =>
        token.getFlag("pf1", "disableLowLight") !== true && token.getFlag("pf1", "customVisionRules") !== true;

      const token = this.object?.document;
      if (token && !hasSystemVision(token)) return result;

      const requiresSelection = game.user.isGM || game.settings.get("pf1", "lowLightVisionMode");
      const relevantTokens = canvas.tokens.placeables.filter((token) => {
        const tokenDoc = token.document;
        return (
          token.actor?.testUserPermission(game.user, "OBSERVER") &&
          (requiresSelection ? token.controlled : true) &&
          hasSystemVision(tokenDoc)
        );
      });
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
    }
  };

/**
 * Re-initialize light sources.
 *
 * @remarks
 * Foundry v12 no longer initializes the lights fully on calling perception manager to do so, making the following insufficient.
 * ```js
 * canvas.perception.update({ initializeLighting: true }, true);
 * ```
 */
export function reinitLightSources() {
  for (const { object } of canvas.effects.lightSources) {
    if (!(object instanceof AmbientLight || object instanceof Token)) continue;
    object.initializeLightSource();
  }
}

/**
 * @see {@link reinitLightSources}
 */
export const debouncedLightSourceReInit = foundry.utils.debounce(reinitLightSources, 100);

Hooks.on("renderAmbientLightConfig", (app, html) =>
  pf1.canvas.lowLightVision.addLowLightVisionToLightConfig(app, html)
);
