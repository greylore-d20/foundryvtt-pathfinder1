import { measureDistance as unifiedMeasureDistance } from "./lib.mjs";

/**
 * Measure the distance between two pixel coordinates
 * See BaseGrid.measureDistance for more details
 *
 * @param segments
 * @param options
 */
export const measureDistances = function (segments, options = {}) {
  if (!options.gridSpaces) return BaseGrid.prototype.measureDistances.call(this, segments, options);

  // Track the total number of diagonals
  const diagonalRule = game.settings.get("pf1", "diagonalMovement");
  const state = { diagonals: 0 };

  // Iterate over measured segments
  return segments.map((s) => unifiedMeasureDistance(null, null, { ray: s.ray, diagonalRule, state }));
};

/* -------------------------------------------- */

const _TokenHUD_getStatusEffectChoices = TokenHUD.prototype._getStatusEffectChoices;
TokenHUD.prototype._getStatusEffectChoices = function () {
  const core = _TokenHUD_getStatusEffectChoices.call(this),
    buffs = {};

  const items = this.object.actor?.itemTypes.buff ?? [];
  for (const buff of items) {
    buffs[`buff-${buff.id}`] = {
      id: buff.id,
      title: buff.name,
      src: buff.img,
      isActive: buff.isActive,
      isOverlay: false,
      cssClass: buff.isActive ? "active" : "",
    };
  }

  return { ...core, ...buffs };
};

//const TokenHUD__onToggleEffect = TokenHUD.prototype._onToggleEffect;
TokenHUD.prototype._onToggleEffect = function (event, { overlay = false } = {}) {
  event.preventDefault();
  const img = event.currentTarget;
  const statusId = img.dataset.statusId;
  const effect =
    statusId && this.object.actor
      ? CONFIG.statusEffects.find((e) => e.id === statusId) ?? statusId
      : img.getAttribute("src");

  return this.object.toggleEffect(effect, { overlay });
};
