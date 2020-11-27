export class SquareHighlight {
  constructor(origin, fillColor = 0x00ff00, borderColor = 0x000000) {
    this.origin = origin;
    this.borderColor = borderColor;
    this.fillColor = fillColor;
    this._squares = [];

    this._id = randomID();

    canvas.grid.addHighlightLayer(`AttackHighlight.${this._id}`);
  }

  addSquare(x, y) {
    this._squares.push({ x: x, y: y });
  }

  clear(permanent = false) {
    const hl = canvas.grid.getHighlightLayer(`AttackHighlight.${this._id}`);
    if (!hl) return;
    hl.clear();

    if (permanent) canvas.grid.destroyHighlightLayer(`AttackHighlight.${this._id}`);
  }

  render() {
    const grid = canvas.grid;
    const gridSize = grid.size;
    const hl = canvas.grid.getHighlightLayer(`AttackHighlight.${this._id}`);

    this.clear();

    // Highlight squares
    for (let s of this._squares) {
      const x = Math.floor(this.origin.x - s.x) * gridSize;
      const y = Math.floor(this.origin.y - s.y) * gridSize;
      grid.grid.highlightGridPosition(hl, { x: x, y: y, border: this.borderColor, color: this.fillColor });
    }
  }
}

/**
 * Highlights the reach of an attack for a token.
 * @param {Token} token
 * @param {ItemPF} attack
 * @returns SquareHighlight
 */
export const showAttackReach = function (token, attack) {
  const grid = canvas.grid;
  const gridSize = grid.size;
  const tw = token.data.width;
  const th = token.data.height;
  const origin = {
    x: Math.floor((token.x + tw * gridSize - 0.5 * gridSize) / gridSize),
    y: Math.floor((token.y + th * gridSize - 0.5 * gridSize) / gridSize),
  };

  // Get stature type
  const stature = getProperty(token.actor.data, "data.traits.stature");
  let size = getProperty(token.actor.data, "data.traits.size");

  // Determine size by token size, if possible
  if (tw === 2 && th === 2) size = "lg";
  else if (tw === 3 && th === 3) size = "huge";
  else if (tw === 4 && th === 4) size = "grg";
  else if (tw === 6 && th === 6) size = "col";
  else if (!(tw === 1 && th === 1)) return;

  // Determine whether reach
  const rangeKey = getProperty(attack.data, "data.range.units");
  if (!["melee", "touch", "reach"].includes(rangeKey)) return;
  const isReach = rangeKey === "reach";

  const squares = getProperty(CONFIG.PF1.REACH_HIGHLIGHT_SQUARES, `${size}.${stature}`);
  if (!squares) return;

  const result = {
    normal: new SquareHighlight(origin, 0xff0000, 0x660000),
    reach: new SquareHighlight(origin, 0xffff00, 0x666600),
  };
  for (let s of squares.normal) {
    result.normal.addSquare(s[0], s[1]);
  }
  if (isReach) {
    for (let s of squares.reach) {
      result.reach.addSquare(s[0], s[1]);
    }
  }
  return result;
};

export const addReachCallback = function (data, html) {
  let results = [];

  // Don't do anything under certain circumstances
  const itemID = getProperty(data, "flags.pf1.metadata.item");
  if (!itemID) return results;

  // console.log(app, html, data, itemID);

  const speakerData = data.speaker;
  // console.log(speakerData);
  if (canvas.scene._id !== speakerData.scene) return results;

  const token = canvas.tokens.placeables.find((o) => o.id === speakerData.token);
  if (!token) return results;

  const item = token.actor.items.find((o) => o._id === itemID);
  if (!item) return results;

  let highlight;
  // Add mouse enter callback
  const mouseEnterCallback = function () {
    if (token._destroyed) return;
    if (!game.settings.get("pf1", "hideReachMeasurements")) highlight = showAttackReach(token, item);

    if (!highlight) return;

    highlight.normal.render();
    highlight.reach.render();
  };
  html.on("mouseenter", mouseEnterCallback);

  // Add mouse leave callback
  const mouseLeaveCallback = function () {
    if (token._destroyed) return;
    if (!highlight) return;

    highlight.normal.clear(true);
    highlight.reach.clear(true);
  };
  html.on("mouseleave", mouseLeaveCallback);
  // Add 'click' event as a safeguard to remove highlights
  html.on("click", mouseLeaveCallback);

  // Add results
  results.push(
    {
      event: "mouseenter",
      callback: mouseEnterCallback,
      elem: html,
    },
    {
      event: "mouseleave",
      callback: mouseLeaveCallback,
      elem: html,
    },
    {
      event: "click",
      callback: mouseLeaveCallback,
      elem: html,
    }
  );

  return results;
};
