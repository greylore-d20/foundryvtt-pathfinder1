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
  let nDiagonal = 0;
  const rule = this.parent.diagonalRule;
  const d = canvas.dimensions;

  // Iterate over measured segments
  return segments.map((s) => {
    const r = s.ray;

    // Determine the total distance traveled
    const nx = Math.abs(Math.ceil(r.dx / d.size));
    const ny = Math.abs(Math.ceil(r.dy / d.size));

    // Determine the number of straight and diagonal moves
    const nd = Math.min(nx, ny);
    const ns = Math.abs(ny - nx);
    nDiagonal += nd;

    // Alternative DMG Movement
    if (rule === "5105") {
      const nd10 = Math.floor(nDiagonal / 2) - Math.floor((nDiagonal - nd) / 2);
      const spaces = nd10 * 2 + (nd - nd10) + ns;
      return spaces * canvas.dimensions.distance;
    }

    // Standard PHB Movement
    else return (ns + nd) * canvas.scene.data.gridDistance;
  });
};

export const measureDistance = function (p0, p1, { gridSpaces = true } = {}) {
  if (!gridSpaces) return BaseGrid.prototype.measureDistance.bind(this)(p0, p1, { gridSpaces });
  const gs = canvas.dimensions.size,
    ray = new Ray(p0, p1),
    nx = Math.abs(Math.ceil(ray.dx / gs)),
    ny = Math.abs(Math.ceil(ray.dy / gs));

  // Get the number of straight and diagonal moves
  const nDiagonal = Math.min(nx, ny),
    nStraight = Math.abs(ny - nx);

  // Alternative DMG Movement
  if (this.parent.diagonalRule === "5105") {
    const nd10 = Math.floor(nDiagonal / 2);
    const spaces = nd10 * 2 + (nDiagonal - nd10) + nStraight;
    return spaces * canvas.dimensions.distance;
  }

  // Standard PHB Movement
  else return (nStraight + nDiagonal) * canvas.scene.data.gridDistance;
};

/* -------------------------------------------- */

/**
 * Condition/ status effects section
 */
export const getConditions = function () {
  const core = CONFIG.statusEffects;
  let sys = Object.keys(CONFIG.PF1.conditions).map((c) => ({
    id: c,
    label: CONFIG.PF1.conditions[c],
    icon: CONFIG.PF1.conditionTextures[c],
  }));
  if (game.settings.get("pf1", "coreEffects")) sys.push(...core);
  else sys = [core[0]].concat(sys);
  return sys;
};

const _TokenHUD_getStatusEffectChoices = TokenHUD.prototype._getStatusEffectChoices;
TokenHUD.prototype._getStatusEffectChoices = function () {
  const core = _TokenHUD_getStatusEffectChoices.call(this),
    buffs = {};
  Object.entries(this.object.actor._calcBuffActiveEffects()).forEach((obj, ind) => {
    const [idx, buff] = obj;
    if (buffs[buff.icon] && buff.label) buff.icon += "?" + ind;
    if (buff) {
      buffs[buff.icon] = {
        id: buff.id,
        title: buff.label,
        src: buff.icon,
        isActive: buff.active,
        isOverlay: false,
        cssClass: buff.active ? "active" : "",
      };
    }
  });
  return Object.assign({}, core, buffs);
};

//const TokenHUD__onToggleEffect = TokenHUD.prototype._onToggleEffect;
TokenHUD.prototype._onToggleEffect = function (event, { overlay = false } = {}) {
  event.preventDefault();
  const img = event.currentTarget;
  const effect =
    img.dataset.statusId && this.object.actor
      ? CONFIG.statusEffects.find((e) => e.id === img.dataset.statusId) ?? img.dataset.statusId
      : img.getAttribute("src");
  return this.object.toggleEffect(effect, { overlay });
};
