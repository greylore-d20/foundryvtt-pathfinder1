/**
 * Measure the distance between two pixel coordinates
 * See BaseGrid.measureDistance for more details
 *
 * @deprecated
 * @param segments
 * @param options
 */
export const measureDistances = function (segments, options = {}) {
  foundry.utils.logCompatibilityWarning(
    "pf1.utils.canvas.measureDistances() is deprecated in favor of canvas.grid.measurePath()",
    {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    }
  );
  return canvas.grid.measureDistances(segments, options);
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
