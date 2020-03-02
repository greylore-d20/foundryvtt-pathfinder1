/**
 * Measure the distance between two pixel coordinates
 * See BaseGrid.measureDistance for more details
 *
 * @param {Object} p0           The origin coordinate {x, y}
 * @param {Object} p1           The destination coordinate {x, y}
 * @param {boolean} gridSpaces  Enforce grid distance (if true) vs. direct point-to-point (if false)
 * @return {number}             The distance between p1 and p0
 */
export const measureDistance = function(p0, p1, {gridSpaces=true}={}) {
  if ( !gridSpaces ) return BaseGrid.prototype.measureDistance.bind(this)(p0, p1, {gridSpaces});
  let gs = canvas.dimensions.size,
      ray = new Ray(p0, p1),
      nx = Math.abs(Math.ceil(ray.dx / gs)),
      ny = Math.abs(Math.ceil(ray.dy / gs));

  // Get the number of straight and diagonal moves
  let nDiagonal = Math.min(nx, ny),
      nStraight = Math.abs(ny - nx);

  // Alternative DMG Movement
  if ( this.parent.diagonalRule === "5105" ) {
    let nd10 = Math.floor(nDiagonal / 2);
    let spaces = (nd10 * 2) + (nDiagonal - nd10) + nStraight;
    return spaces * canvas.dimensions.distance;
  }

  // Standard PHB Movement
  else return (nStraight + nDiagonal) * canvas.scene.data.gridDistance;
};

/* -------------------------------------------- */

/**
 * Hijack Token health bar rendering to include temporary and temp-max health in the bar display
 * TODO: This should probably be replaced with a formal Token class extension
 */
const _TokenGetBarAttribute = Token.prototype.getBarAttribute;
Token.prototype.getBarAttribute = function(barName, {alternative=null}={}) {
  let data = _TokenGetBarAttribute.call(this, barName, {alternative: alternative});
  if (data != null && data.attribute === "attributes.hp") {
    data.value += parseInt(data['temp'] || 0);
  }
  return data;
};

TokenHUD.prototype._onAttributeUpdate = function(event) {
  // Filter keydown events for Enter
  if ( event.type === "keydown" ) {
    if (event.keyCode === KEYS.ENTER) this.clear();
    return;
  }
  event.preventDefault();

  // Determine new bar value
  let input = event.currentTarget,
      strVal = input.value.trim(),
      isDelta = strVal.startsWith("+") || strVal.startsWith("-"),
      value = Number(strVal);
  if ( !Number.isFinite(value) ) return;

  // For attribute bar values, update the associated Actor
  let bar = input.dataset.bar;
  if ( bar ) {
    const actor = this.object.actor;
    const data = this.object.getBarAttribute(bar);
    const current = getProperty(actor.data.data, data.attribute);
    const updateData = {};
    let dt = value;
    if (data.attribute === "attributes.hp" && actor.data.data.attributes.hp.temp > 0 && isDelta && value < 0) {
      dt = Math.min(0, actor.data.data.attributes.hp.temp + value);
      updateData["data.attributes.hp.temp"] = Math.max(0, actor.data.data.attributes.hp.temp + value);
      value = Math.min(0, value - dt);
    }
    if ( isDelta ) value = Math.clamped(current.min || 0, current.value + dt, current.max);
    updateData[`data.${data.attribute}.value`] = value;
    actor.update(updateData);
  }

  // Otherwise update the Token
  else this.object.update({[input.name]: value});
};
