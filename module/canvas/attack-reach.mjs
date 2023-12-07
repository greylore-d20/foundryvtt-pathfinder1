import { convertDistance, measureDistance, calculateRangeFormula } from "../utils/lib.mjs";
import { RollPF } from "../dice/roll.mjs";

const rangeColor = {
  fill: Color.from("#FF0000"),
  border: Color.from("#FF0000").multiply(0.9),
};
const reachColor = {
  fill: Color.from("#FFFF00"),
  border: Color.from("#FFFF00").multiply(0.9),
};

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
    for (const s of this._squares) {
      const x = Math.floor(this.origin.x - s.x) * gridSize;
      const y = Math.floor(this.origin.y - s.y) * gridSize;
      grid.grid.highlightGridPosition(hl, { x: x, y: y, border: this.borderColor, color: this.fillColor });
    }
  }
}

/**
 * @typedef {object} AttackReachHighlight
 * An object containing highlights belonging to a specific attack
 * @property {SquareHighlight} normal - Highlight for normal range
 * @property {SquareHighlight} reach - Highlight for reach range
 * @property {SquareHighlight[]} extra - Additional highlights
 */

/** @type {AttackReachHighlight|undefined} */
let currentHighlight;

/**
 * Calculates the {@link AttackReachHighlight} for a token's attack.
 *
 * @param {Token} token - The token to calculate the attack reach for
 * @param {import("../documents/item/item-pf.mjs").ItemPF} attack - The attack to calculate the reach for
 * @param {import("../components/action.mjs").ItemAction} action - The action to calculate the reach for
 * @returns {AttackReachHighlight | undefined} Highlights for this attack, if any
 */
const getAttackReach = function (token, attack, action) {
  const grid = canvas.grid;
  const gridSize = grid.size;
  const tw = token.document.width;
  const th = token.document.height;
  const origin = {
    x: Math.floor((token.x + tw * gridSize - 0.5 * gridSize) / gridSize),
    y: Math.floor((token.y + th * gridSize - 0.5 * gridSize) / gridSize),
  };

  if (!action) return;
  const rollData = action.getRollData();

  // Determine whether reach
  const rangeKey = action.data.range.units;
  if (!["melee", "touch", "reach", "ft", "close", "medium"].includes(rangeKey)) return;
  const isReach = rangeKey === "reach";
  const range = rollData.range;

  // Determine minimum range
  const minRangeKey = action.data.range.minUnits;
  let minRange = null;
  if (["melee", "touch"].includes(minRangeKey)) minRange = range.melee;
  if (minRangeKey === "reach") minRange = range.reach;
  if (minRangeKey === "ft") {
    minRange = RollPF.safeRoll(action.data.range.minValue || "0", rollData).total;
  }

  const squares = {
    normal: [],
    reach: [],
    extra: [],
  };
  const useReachRule = game.settings.get("pf1", "alternativeReachCornerRule") !== true;

  if (["melee", "touch", "reach"].includes(rangeKey)) {
    squares.normal = getReachSquares(token, range.melee, minRange, null, { useReachRule });
    squares.reach = getReachSquares(token, range.reach, range.melee, null, { useReachRule });
  } else if (rangeKey === "ft") {
    const r = calculateRangeFormula(action.data.range.value || "0", "ft", rollData);
    squares.normal = getReachSquares(token, r, minRange, null, { useReachRule: true });

    // Add range increments
    const maxSquareRange = Math.min(
      60, // arbitrary limit to enhance performance on large canvases
      Math.max(
        (canvas.dimensions.width / canvas.dimensions.size) * canvas.dimensions.distance,
        (canvas.dimensions.height / canvas.dimensions.size) * canvas.dimensions.distance
      ) + convertDistance(r)[0]
    );
    const rangeIncrements = action.data.range.maxIncrements;
    for (let a = 1; a < rangeIncrements; a++) {
      if ((a + 1) * convertDistance(r)[0] <= maxSquareRange) {
        squares.extra.push(getReachSquares(token, (a + 1) * r, a * r, null, { useReachRule }));
      }
    }
  } else if (["close", "medium"].includes(rangeKey) && attack.type === "spell") {
    const range = calculateRangeFormula(null, rangeKey, rollData);
    squares.normal = getReachSquares(token, range, minRange, null, { useReachRule });
  }

  const result = {
    normal: new SquareHighlight(origin, rangeColor.fill, rangeColor.border),
    reach: new SquareHighlight(origin, reachColor.fill, reachColor.border),
    extra: [],
  };
  for (const s of squares.normal) {
    result.normal.addSquare(s[0], s[1]);
  }
  if (isReach) {
    for (const s of squares.reach) {
      result.reach.addSquare(s[0], s[1]);
    }
  }

  // Add extra range squares
  {
    for (let a = 0; a < squares.extra.length; a++) {
      const squaresExtra = squares.extra[a];

      const color = {
        fill: a % 2 === 1 ? rangeColor.fill : reachColor.fill,
        border: a % 2 === 1 ? rangeColor.border : reachColor.border,
      };

      const hl = new SquareHighlight(origin, color.fill, color.border);
      for (const s of squaresExtra) {
        hl.addSquare(s[0], s[1]);
      }
      result.extra.push(hl);
    }
  }

  return result;
};

/**
 * Calculates and renders the {@link AttackReachHighlight} for a token's attack.
 * If a highlight already exists, it will be removed.
 *
 * @param {Token} token - The token to calculate the attack reach for
 * @param {import("../documents/item/item-pf.mjs").ItemPF} attack - The attack to calculate the reach for
 * @param {import("../components/action.mjs").ItemAction} action - The action to calculate the reach for
 */
export const showAttackReach = function (token, attack, action) {
  // Clear previous highlight
  clearHighlight();

  const highlight = getAttackReach(token, attack, action);

  // If a highlight could be created, make it the current highlight and render it
  if (!highlight) return;
  currentHighlight = highlight;
  renderHighlight();
};

export const clearHighlight = function () {
  if (currentHighlight) {
    currentHighlight.normal.clear();
    currentHighlight.reach.clear();
    for (const h of currentHighlight.extra) {
      h.clear();
    }
    currentHighlight = undefined;
  }
};

const renderHighlight = function () {
  if (currentHighlight) {
    currentHighlight.normal.render();
    currentHighlight.reach.render();
    for (const h of currentHighlight.extra) {
      h.render();
    }
  }
};

/**
 * Returns a token belonging to either an actor's UUID or a token's UUID
 *
 * @async
 * @param {string} uuid - UUID of an actor or token
 * @returns {Promise<Token|null>} A Token, if one can be found
 */
const _getTokenByUuid = async function (uuid) {
  if (!uuid) return;
  /** @type {TokenDocument | Actor} */
  const actor = await fromUuid(uuid);
  if (actor instanceof TokenDocument) return actor.object;
  return actor?.token ?? (actor != null ? canvas.tokens.placeables.find((o) => o.actor === actor) : null);
};

/**
 * Add listeners on the {@link ChatLog}'s HTML element, checking for hover events involving
 * chat cards' range element using event delegation.
 *
 * @param {JQuery<HTMLElement>} html - The chat log
 */
export function addReachListeners(html) {
  html.on("mouseenter", ".card-range", onMouseEnterReach);
  html.on("mouseleave", ".card-range", onMouseLeaveReach);
}

/**
 * Handle display of reach when a chat card's reach element is hovered
 *
 * @param {JQuery.MouseEnterEvent<HTMLElement>} event - A `mouseEnter` event
 */
const onMouseEnterReach = (event) => {
  event.preventDefault();

  const reachElement = event.currentTarget;
  const card = reachElement.closest(".chat-card");
  const { tokenUuid, actionId, itemId } = card.dataset;
  if (!(itemId && actionId && tokenUuid)) return;

  _getTokenByUuid(tokenUuid).then((token) => {
    if (!token) return;
    const item = token.actor.allItems.find((item) => item.id === itemId);
    if (!item) return;
    if (!game.settings.get("pf1", "hideReachMeasurements")) showAttackReach(token, item, item.actions.get(actionId));
  });
};

/**
 * Handle clearing of reach highlights created by {@link onMouseEnterReach}
 *
 * @param {JQuery.MouseLeaveEvent} event - A `mouseLeave` event
 */
const onMouseLeaveReach = (event) => {
  event.preventDefault();
  clearHighlight();
};

const getReachSquares = function (token, range, minRange = 0, addSquareFunction = null, options) {
  range = convertDistance(range)[0];
  if (typeof minRange === "number") minRange = convertDistance(minRange)[0];

  const result = [];

  if (canvas.grid.type !== CONST.GRID_TYPES.SQUARE) return result;
  if (!addSquareFunction) addSquareFunction = shouldAddReachSquare;

  // Initialize variables
  const gridDist = canvas.scene.grid.distance;
  const gridSize = canvas.grid.size;

  // Determine token squares
  const tokenSquares = [];
  for (let a = 0; a < Math.floor(token.w / gridSize); a++) {
    for (let b = 0; b < Math.floor(token.h / gridSize); b++) {
      const x = Math.floor((token.x + gridSize * 0.5) / gridSize + a);
      const y = Math.floor((token.y + gridSize * 0.5) / gridSize + b);
      tokenSquares.push([x, y]);
    }
  }

  // Determine token-based variables
  const tokenRect = [
    Math.floor((token.x + gridSize * 0.5) / gridSize),
    Math.floor((token.y + gridSize * 0.5) / gridSize),
    Math.floor(token.w / gridSize),
    Math.floor(token.h / gridSize),
  ];

  // Create function to determine closest token square
  const getClosestTokenSquare = function (pos) {
    const lowest = { square: null, dist: null };
    for (const s of tokenSquares) {
      const dist = Math.sqrt((s[0] - pos[0]) ** 2 + (s[1] - pos[1]) ** 2);
      if (lowest.dist == null || dist < lowest.dist) {
        lowest.square = s;
        lowest.dist = dist;
      }
    }

    return lowest.square;
  };

  // Gather potential squares
  const squareRange = Math.round(range / gridDist);
  const wMax = squareRange * 2 + tokenRect[2];
  const hMax = squareRange * 2 + tokenRect[3];
  const tl = [tokenRect[0] - squareRange, tokenRect[1] - squareRange];
  for (let a = tl[0]; a < tl[0] + wMax; a++) {
    for (let b = tl[1]; b < tl[1] + hMax; b++) {
      const closestSquare = getClosestTokenSquare([a, b]);

      const offset = [a - tokenRect[0], b - tokenRect[1]];
      if (
        !(
          a >= tokenRect[0] &&
          a < tokenRect[0] + tokenRect[2] &&
          b >= tokenRect[1] &&
          b < tokenRect[1] + tokenRect[2] &&
          minRange != null
        )
      ) {
        if (addSquareFunction(token, [a, b], closestSquare, range, minRange, tokenRect, options)) {
          result.push(offset);
        }
      }
    }
  }

  return result;
};

const shouldAddReachSquare = function (
  token,
  pos,
  closestTokenSquare,
  range,
  minRange,
  tokenRect,
  options = { useReachRule: false }
) {
  const gridDist = canvas.scene.grid.distance;
  const gridSize = canvas.grid.size;
  const p0 = { x: closestTokenSquare[0] * gridSize, y: closestTokenSquare[1] * gridSize };
  const p1 = { x: pos[0] * gridSize, y: pos[1] * gridSize };

  const dist = measureDistance(p0, p1);
  const dist2 = options.useReachRule ? measureDistance(p0, p1, { diagonalRule: "555" }) : null;
  const reachRuleRange = convertDistance(10)[0];
  if (dist > range) {
    // Special rule for 10-ft. reach
    if (!(options.useReachRule && range === reachRuleRange)) {
      return false;
    }
  }

  if (minRange != null && dist <= minRange) {
    return false;
  }

  // Special rule for minimum ranges >= 10-ft.
  if (options.useReachRule && minRange >= reachRuleRange && dist2 <= reachRuleRange) {
    return false;
  }

  return true;
};
