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

class SquareHighlight {
  constructor(origin, fillColor = 0x00ff00, borderColor = 0x000000) {
    this.origin = origin;
    this.borderColor = borderColor;
    this.fillColor = fillColor;
    this._squares = [];

    this._id = foundry.utils.randomID();

    canvas.interface.grid.addHighlightLayer(`AttackHighlight.${this._id}`);
  }

  addSquare(x, y) {
    this._squares.push({ x: x, y: y });
  }

  clear() {
    const hl = canvas.interface.grid.getHighlightLayer(`AttackHighlight.${this._id}`);
    if (!hl) return;
    hl.clear();
  }

  render() {
    const grid = canvas.grid;
    const gridSize = grid.size;
    const hl = canvas.interface.grid.getHighlightLayer(`AttackHighlight.${this._id}`);

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
 * Calculates the attack for a token's attack.
 */
class AttackHighlightBase {
  /** @abstract */
  clearHighlight() {
    throw new Error("must be overridden");
  }
  /** @abstract */
  renderHighlight() {
    throw new Error("must be overridden");
  }

  /**
   * @abstract
   * @returns {boolean}
   */
  get isValid() {
    throw new Error("must be overridden");
  }

  /**
   * @param {Token} token - The token to calculate the attack reach for
   * @param {pf1.components.ItemAction} action - The action to calculate the reach for
   */
  constructor(token, action) {
    const attack = action?.item;
    if (!action || !token || !attack) throw new Error("Invalid arguments.");
  }
}

class GridlessHighlight extends AttackHighlightBase {
  /** @type {number[]|undefined} */
  #rangeStops;

  /** @override */
  get isValid() {
    return (this.#rangeStops?.length ?? 0) >= 2;
  }

  /** @type {{x: number, y: number} | undefined} */
  #center;

  /**
   * @param {Token} token - The token to calculate the attack reach for
   * @param {pf1.components.ItemAction} action - The action to calculate the reach for
   */
  constructor(token, action) {
    super(token, action);
    const attack = action?.item;

    const grid = canvas.grid;
    const gridSize = grid.size;
    const tw = token.document.width;
    const th = token.document.height;
    this.#center = {
      x: Math.floor(token.x + (tw * gridSize) / 2),
      y: Math.floor(token.y + (th * gridSize) / 2),
    };

    const rollData = action.getRollData();

    // Determine whether reach
    const rangeKey = action.data.range.units;
    if (!["melee", "touch", "reach", "ft", "close", "medium"].includes(rangeKey)) return;
    const isReach = rangeKey === "reach";

    // Determine minimum range
    const minRange = pf1.utils.convertDistanceBack(action.getRange({ type: "min", rollData }))[0];
    const r = pf1.utils.convertDistanceBack(action.getRange({ type: "single", rollData }))[0];

    const rangeMeasurements = [minRange || 0, r];

    if (rangeKey === "ft") {
      // Add range increments
      const rangeIncrements = action.data.range.maxIncrements;
      for (let a = 1; a < rangeIncrements; a++) {
        rangeMeasurements.push((a + 1) * r);
      }
    }

    this.#rangeStops = rangeMeasurements.map((r) => {
      const tokenOffset = r === 0 ? 0 : (tw * gridSize) / 2;
      return (r * canvas.dimensions.size) / canvas.dimensions.distance + tokenOffset;
    });

    this._id = foundry.utils.randomID();
    canvas.interface.grid.addHighlightLayer(`AttackHighlight.${this._id}`);
  }

  clearHighlight() {
    if (this.isValid) {
      const hl = canvas.interface.grid.getHighlightLayer(`AttackHighlight.${this._id}`);
      if (!hl) return;
      hl.removeChildren();
      this.#rangeStops = undefined;
    }
  }

  renderHighlight() {
    if (this.isValid) {
      const hl = canvas.interface.grid.getHighlightLayer(`AttackHighlight.${this._id}`);
      if (!hl) return;
      hl.clear();

      const { x, y } = this.#center;

      const circle = new PIXI.Graphics();

      const stops = /** @type {!number[]} */ (this.#rangeStops);
      for (let i = stops.length - 1; i > 0; i--) {
        const outer = stops[i];
        const inner = stops[i - 1];

        const color = [rangeColor, reachColor][(i + 1) % 2];

        circle.beginFill(color.fill, 0.1);
        circle.drawCircle(x, y, outer);

        // if inner has a defined value and is not 0, then cut a hole for either the next increment or because it's the minimum range
        if (inner) {
          circle.beginHole();
          circle.beginFill(reachColor.fill, 0.1);
          circle.drawCircle(x, y, inner);
          circle.endHole();
        }
      }
      circle.endFill();

      hl.addChild(circle);
    }
  }
}

class SquareGridHighlight extends AttackHighlightBase {
  /**
   * @typedef {object} AttackReachHighlight
   * An object containing highlights belonging to a specific attack
   * @property {SquareHighlight} normal - Highlight for normal range
   * @property {SquareHighlight[]} extra - Additional highlights
   */

  /** @type {AttackReachHighlight|undefined} */
  #currentHighlight;

  /** @override */
  get isValid() {
    return !!this.#currentHighlight;
  }

  /**
   * @inheritdoc
   */
  constructor(token, action) {
    super(token, action);
    const attack = action?.item;

    const grid = canvas.grid;
    const gridSize = grid.size;
    const tw = token.document.width;
    const th = token.document.height;
    const origin = {
      x: Math.floor((token.x + tw * gridSize - 0.5 * gridSize) / gridSize),
      y: Math.floor((token.y + th * gridSize - 0.5 * gridSize) / gridSize),
    };

    const rollData = action.getRollData();

    // Determine whether reach
    const rangeKey = action.data.range.units;
    if (!["melee", "touch", "reach", "ft", "close", "medium"].includes(rangeKey)) return;
    const isReach = rangeKey === "reach";
    const isFeet = rangeKey === "ft";

    // Determine minimum range
    const minRange = pf1.utils.convertDistanceBack(action.getRange({ type: "min", rollData }))[0];

    const r = pf1.utils.convertDistanceBack(action.getRange({ type: "single", rollData }))[0];

    const squares = {
      normal: [],
      reach: [],
      extra: [],
    };
    const useReachRule = game.settings.get("pf1", "alternativeReachCornerRule") !== true;

    squares.normal = this.#getReachSquares(token, r, minRange, { useReachRule: isFeet ? true : useReachRule });

    if (isFeet) {
      // Add range increments
      const ftDistance = convertDistance(r)[0];
      const userLimit = game.settings.get("pf1", "performance").reachLimit;
      const maxSquareRange = Math.min(
        userLimit, // arbitrary limit to enhance performance on large canvases
        Math.max(
          (canvas.dimensions.width / canvas.dimensions.size) * canvas.dimensions.distance,
          (canvas.dimensions.height / canvas.dimensions.size) * canvas.dimensions.distance
        ) + ftDistance
      );
      const rangeIncrements = action.data.range.maxIncrements;
      for (let a = 1; a < rangeIncrements; a++) {
        if ((a + 1) * ftDistance <= maxSquareRange) {
          squares.extra.push(this.#getReachSquares(token, (a + 1) * r, a * r, { useReachRule }));
        }
      }
    }

    const result = {
      normal: new SquareHighlight(origin, rangeColor.fill, rangeColor.border),
      extra: [],
    };

    for (const s of squares.normal) {
      result.normal.addSquare(s[0], s[1]);
    }

    // Add extra range squares
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

    this.#currentHighlight = result;
  }

  /**
   *
   * @param {Token} token
   * @param {number} range
   * @param {number} minRange
   * @param {object} options
   * @returns {Array<Array<number,number>>} - Array of x,y coordinate tuples
   */
  #getReachSquares(token, range, minRange = 0, options) {
    const result = [];
    if (canvas.grid.type !== CONST.GRID_TYPES.SQUARE) return result;

    range = convertDistance(range)[0];
    if (typeof minRange === "number") minRange = convertDistance(minRange)[0];

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
          ) &&
          this.#shouldAddReachSquare([a, b], closestSquare, range, minRange, options)
        ) {
          result.push(offset);
        }
      }
    }

    return result;
  }

  #shouldAddReachSquare(pos, closestTokenSquare, range, minRange, options = { useReachRule: false }) {
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
  }

  clearHighlight() {
    if (this.#currentHighlight) {
      this.#currentHighlight.normal.clear();
      for (const h of this.#currentHighlight.extra) {
        h.clear();
      }
      this.#currentHighlight = undefined;
    }
  }

  renderHighlight() {
    if (this.#currentHighlight) {
      this.#currentHighlight.normal.render();
      for (const h of this.#currentHighlight.extra) {
        h.render();
      }
    }
  }
}

/** @type {AttackHighlightbase|undefined} */
let attackReachHighlight;

/**
 * Calculates and renders the {@link AttackReachHighlight} for a token's attack.
 * If a highlight already exists, it will be removed.
 *
 * @param {Token} token - The token to calculate the attack reach for
 * @param {pf1.components.ItemAction} action - The action to calculate the reach for
 */
export const showAttackReach = (token, action) => {
  // Clear previous highlight
  clearHighlight();

  const cls = canvas.grid.type === CONST.GRID_TYPES.SQUARE ? SquareGridHighlight : GridlessHighlight;

  try {
    const highlight = new cls(token, action);

    // If a highlight could be created, make it the current highlight and render it
    if (!highlight.isValid) return;
    attackReachHighlight = highlight;
    attackReachHighlight.renderHighlight();
  } catch {
    // no action, token, or item to use to render the highlight
  }
};

export const clearHighlight = () => {
  attackReachHighlight?.clearHighlight();
  attackReachHighlight = undefined;
};

/**
 * Returns a token belonging to either an actor's UUID or a token's UUID
 *
 * @async
 * @param {string} uuid - UUID of an actor or token
 * @returns {Promise<Token|null|undefined>} A Token, if one can be found
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
  html.on("pointerenter", ".card-range", _onMouseEnterReach);
  html.on("pointerleave", ".card-range", _onMouseLeaveReach);
}

/**
 * Handle display of reach when a chat card's reach element is hovered
 *
 * @param {JQuery.MouseEnterEvent<HTMLElement>} event - A `mouseEnter` event
 */
const _onMouseEnterReach = (event) => {
  event.preventDefault();
  if (game.settings.get("pf1", "performance").reachLimit < 10) return;

  const reachElement = event.currentTarget;
  const card = reachElement.closest(".chat-card");
  const { tokenUuid, actionId, itemId } = card.dataset;
  if (!(itemId && actionId && tokenUuid)) return;

  _getTokenByUuid(tokenUuid).then((token) => {
    if (!token) return;

    const item = token.actor.allItems.find((item) => item.id === itemId);
    const action = item?.actions.get(actionId);
    if (!action) return;

    showAttackReach(token, action);
  });
};

/**
 * Handle clearing of reach highlights created by {@link _onMouseEnterReach}
 *
 * @param {JQuery.MouseLeaveEvent} event - A `mouseLeave` event
 */
const _onMouseLeaveReach = (event) => {
  event.preventDefault();
  clearHighlight();
};
