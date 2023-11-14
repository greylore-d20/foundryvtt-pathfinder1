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
  const diagonalRule = this.parent.diagonalRule;
  const state = { diagonals: 0 };

  // Iterate over measured segments
  return segments.map((s) => unifiedMeasureDistance(null, null, { ray: s.ray, diagonalRule, state }));
};

/* -------------------------------------------- */

/**
 * Condition/ status effects section
 */
export const getConditions = function () {
  const core = CONFIG.statusEffects;
  let sys = Object.keys(pf1.config.conditions).map((c) => ({
    id: c,
    label: pf1.config.conditions[c],
    icon: pf1.config.conditionTextures[c],
  }));
  if (game.settings.get("pf1", "coreEffects")) sys.push(...core);
  else sys = [core[0]].concat(sys);
  return sys.sort((a, b) => a.label.localeCompare(b.label));
};

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
