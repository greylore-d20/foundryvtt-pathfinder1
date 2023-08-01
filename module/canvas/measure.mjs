import { measureDistance } from "../utils/lib.mjs";

const withinAngle = (min, max, value) => {
  min = Math.normalizeDegrees(min);
  max = Math.normalizeDegrees(max);
  value = Math.normalizeDegrees(value);

  if (min < max) return value >= min && value <= max;
  return value >= min || value <= max;
};

/**
 * @param {Point} point
 * @param {Rectangle} rect
 * @returns {boolean}
 */
const withinRect = (point, rect) => {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
};

/**
 * Applies patches to core functions to integrate Pathfinder specific measurements.
 *
 * Replacement for `CONFIG.Canvas.layers.templates.layerClass`
 */
export class TemplateLayerPF extends TemplateLayer {
  /**
   * Foundry does not allow snapping template drag.
   *
   * @override
   * @param {Event} event
   */
  _onDragLeftMove(event) {
    if (!game.settings.get("pf1", "measureStyle")) return super._onDragLeftMove(event);

    const interaction = event.interactionData;
    const { destination, layerDragState, preview, origin } = interaction;
    if (layerDragState === 0) return;

    // Snap the destination to the grid
    const snapToGrid = !event.shiftKey;
    if (snapToGrid) {
      interaction.destination = canvas.grid.getSnappedPosition(destination.x, destination.y, this.gridPrecision);
    }

    // Compute the ray
    const ray = new Ray(origin, destination);
    const dist = canvas.dimensions.distance;
    const ratio = canvas.dimensions.size / dist;

    // Update the preview object
    const baseDistance = ray.distance / ratio;
    preview.document.distance = baseDistance;

    const baseDirection = Math.normalizeDegrees(Math.toDegrees(ray.angle));
    preview.document.direction = baseDirection;

    if (snapToGrid) {
      switch (preview.document.t) {
        case "cone": {
          const halfAngle = CONFIG.MeasuredTemplate.defaults.angle / 2;
          preview.document.direction = Math.floor((baseDirection + halfAngle / 2) / halfAngle) * halfAngle;
          break;
        }
      }
    }

    preview.renderFlags.set({ refreshShape: true });

    // Confirm the creation state
    interaction.layerDragState = 2;
  }
}

export class MeasuredTemplatePF extends MeasuredTemplate {
  /**
   * @deprecated
   */
  getHighlightedSquares() {
    foundry.utils.logCompatibilityWarning(
      "MeasuredTemplatePF.getHighlightedSquares() deprecated in favor of MeasuredTemplate._getGridHighlightPositions()",
      {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      }
    );
    return this._getGridHighlightPositions();
  }

  /**
   * Get highlighted square coordinates.
   *
   * Supports only circle, cone and ray templates.
   *
   * @protected
   * @override
   * @returns {Point[]} - Array of grid coordinates
   */
  _getGridHighlightPositions() {
    const templateType = this.document.t;
    if (!this.ray || !game.settings.get("pf1", "measureStyle") || !["circle", "cone", "ray"].includes(templateType)) {
      return super._getGridHighlightPositions();
    }

    const isCone = templateType === "cone",
      isRay = templateType === "ray";

    const grid = canvas.grid,
      // Size of each cell in pixels
      gridSizePxBase = canvas.dimensions.size,
      // Offset for uneven grids
      gridSizePxOffset = gridSizePxBase % 2,
      // Final grid size
      gridSizePx = gridSizePxBase + gridSizePxOffset,
      gridSizeUnits = canvas.dimensions.distance; // feet, meters, etc.

    const { direction, angle: docAngle, distance } = this.document;
    // If angle is 0, swap to default angle. Constrain it to 359 degrees, too. Angle of 360 is same as 0 for Foundry.
    const angle = Math.min(Math.abs(docAngle || CONFIG.MeasuredTemplate.defaults.angle), 359);

    // Parse rays as per Bresenham's algorithm
    if (isRay) {
      const result = [];

      const line = (x0, y0, x1, y1) => {
        x0 = Math.floor(x0 / gridSizePx);
        x1 = Math.floor(x1 / gridSizePx);
        y0 = Math.floor(y0 / gridSizePx);
        y1 = Math.floor(y1 / gridSizePx);

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (!(x0 === x1 && y0 === y1)) {
          result.push({ x: x0 * gridSizePx, y: y0 * gridSizePx });
          const e2 = err << 1;
          if (e2 > -dy) {
            err -= dy;
            x0 += sx;
          }
          if (e2 < dx) {
            err += dx;
            y0 += sy;
          }
        }
      };

      // Extend ray by half a square for better highlight calculation
      const ray = Ray.fromAngle(this.ray.A.x, this.ray.A.y, this.ray.angle, this.ray.distance + gridSizePx / 2);

      // Get resulting squares
      line(ray.A.x, ray.A.y, ray.B.x, ray.B.y);

      return result;
    }

    // Get number of rows and columns
    const nr = Math.ceil((distance * 1.5) / gridSizeUnits / (gridSizePx / grid.h)),
      nc = Math.ceil((distance * 1.5) / gridSizeUnits / (gridSizePx / grid.w));

    // Get the center of the grid position occupied by the template
    const { x, y } = this.document;

    const [cx, cy] = grid.getCenter(x, y),
      [col0, row0] = grid.grid.getGridPositionFromPixels(cx, cy),
      minAngle = Math.normalizeDegrees(direction - angle / 2),
      maxAngle = Math.normalizeDegrees(direction + angle / 2);

    // Origin offset multiplier
    const offsetMult = { x: 0, y: 0 };
    // Offset measurement for cones
    // Offset is to ensure that cones only start measuring from cell borders, as in https://www.d20pfsrd.com/magic/#Aiming_a_Spell
    if (isCone) {
      // Degrees anticlockwise from pointing right. In 45-degree increments from 0 to 360
      const dir = (direction >= 0 ? 360 - direction : -direction) % 360;
      // If we're not on a border for X, offset by 0.5 or -0.5 to the border of the cell in the direction we're looking on X axis
      // /2 turns from 1/0/-1 to 0.5/0/-0.5
      offsetMult.x = x % gridSizePxBase != 0 ? Math.sign(Math.round(Math.cos(Math.toRadians(dir)))) / 2 : 0;
      // Same for Y, but cos Y goes down on screens, we invert
      offsetMult.y = y % gridSizePxBase != 0 ? -Math.sign(Math.round(Math.sin(Math.toRadians(dir)))) / 2 : 0;
    }

    // Determine point of origin
    const origin = {
      x: x + offsetMult.x * gridSizePxBase,
      y: y + offsetMult.y * gridSizePxBase,
    };

    const result = [];
    for (let a = -nc; a < nc; a++) {
      for (let b = -nr; b < nr; b++) {
        // Position of cell's top-left corner, in pixels
        const [gx, gy] = canvas.grid.grid.getPixelsFromGridPosition(col0 + a, row0 + b);

        // Determine point we're measuring the distance to - always in the center of a grid square
        const destination = { x: gx + gridSizePx * 0.5, y: gy + gridSizePx * 0.5 };

        const ray = new Ray(origin, destination);
        if (isCone && ray.distance > 0) {
          const rayAngle = Math.normalizeDegrees(ray.angle / (Math.PI / 180));
          if (!withinAngle(minAngle, maxAngle, rayAngle)) {
            continue;
          }
        }

        // Check distance, add 1 pixel to avoid rounding issues
        const cdistance = measureDistance(origin, destination, { ray });
        if (cdistance <= distance + 1) {
          result.push({ x: gx, y: gy });
        }
      }
    }

    return result;
  }

  /**
   * Determine tokens residing within the template bounds, based on either grid higlight logic or token center.
   *
   * @public
   * @returns {Token[]} Tokens sufficiently within the template.
   */
  getTokensWithin() {
    const shape = this.document.t,
      dimensions = this.scene.dimensions,
      gridSizePx = dimensions.size,
      gridSizeUnits = dimensions.distance;

    const getCenter = () => {
      if (shape !== "rect") return this.center;
      // Hack: Fix for Foundry bug where .center for rectangle template returns top-left corner instead.
      return {
        x: this.x + this.width / 2,
        y: this.y + this.height / 2,
      };
    };

    const tCenter = getCenter();

    const { distance, angle, direction } = this.document;

    // Max distance from template center, +1 cell for proper detection, and +1 pixel for uneven grids and rounding protection
    const maxDistance = Math.max(this.height, this.width) + gridSizePx + 1;
    // Get tokens within max potential distance from the template
    const relevantTokens = new Set(
      canvas.tokens.placeables.filter((t) => new Ray(t.center, tCenter).distance - t.sizeErrorMargin <= maxDistance)
    );

    const results = new Set();

    const isLargeToken = (t) => t.document.width > 1 || t.document.height > 1;

    const withinCircle = (target) => {
      const ray = new Ray(tCenter, target);
      // Calculate ray length in relation to circle radius
      const raySceneLength = (ray.distance / gridSizePx) * gridSizeUnits;
      // Include this token if its center is within template radius
      return raySceneLength <= distance + 1;
    };

    const withinCone = (target, minAngle, maxAngle) => {
      const ray = new Ray(tCenter, target);
      const rayAngle = Math.normalizeDegrees(Math.toDegrees(ray.angle));
      const rayWithinAngle = withinAngle(minAngle, maxAngle, rayAngle);
      // Calculate ray length in relation to circle radius
      const raySceneLength = (ray.distance / gridSizePx) * gridSizeUnits;
      // Include token if its within template distance and within the cone's angle
      return rayWithinAngle && raySceneLength <= distance + 1;
    };

    // Rectangle has same handling everywhere
    if (shape === "rect") {
      const rect = {
        x: this.x,
        y: this.y,
        width: this.shape.width,
        height: this.shape.height,
      };

      for (const t of relevantTokens) {
        if (isLargeToken(t)) {
          const cells = t.getOccupiedCells({ center: true });
          if (cells.some((c) => withinRect(c, rect))) results.add(t);
        } else {
          if (withinRect(t.center, rect)) results.add(t);
        }
      }
    }
    // Special handling for gridless
    else if (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS && ["circle", "cone"].includes(shape)) {
      // Pre-calc cone data
      let minAngle, maxAngle;
      if (shape === "cone") {
        minAngle = Math.normalizeDegrees(direction - angle / 2);
        maxAngle = Math.normalizeDegrees(direction + angle / 2);
      }

      // TODO: Test against vision points and ensure ~third of them are inside the template instead.
      for (const t of relevantTokens) {
        const cells = isLargeToken(t) ? t.getOccupiedCells({ center: true }) : [t.center];

        switch (shape) {
          case "circle": {
            if (cells.some((c) => withinCircle(c))) results.add(t);
            break;
          }
          case "cone": {
            if (cells.some((c) => withinCone(c, minAngle, maxAngle))) results.add(t);
            break;
          }
        }
      }
    }
    // Non-gridless
    else {
      const mapCoordsToCell = ({ x, y }) => ({ x, y, width: gridSizePx, height: gridSizePx });

      // Ensure shape and related data exists (e.g. this.ray) for getHighlightedSquares to work correctly.
      if (!this.shape) this._applyRenderFlags({ refreshShape: true });

      const highlightSquares = this._getGridHighlightPositions().map(mapCoordsToCell);
      for (const cell of highlightSquares) {
        for (const t of relevantTokens) {
          const cells = isLargeToken(t) ? t.getOccupiedCells({ center: true }) : [t.center];

          if (cells.some((tc) => withinRect(tc, cell))) {
            results.add(t);
            relevantTokens.delete(t);
          }
        }
      }
    }

    return Array.from(results);
  }

  // Highlight grid in PF1 style
  highlightGrid() {
    if (
      !game.settings.get("pf1", "measureStyle") ||
      !["circle", "cone", "ray"].includes(this.document.t) ||
      canvas.grid.type !== CONST.GRID_TYPES.SQUARE
    )
      return super.highlightGrid();

    const grid = canvas.grid,
      bc = this.borderColor,
      fc = this.fillColor;

    // Only highlight for objects which have a defined shape
    if (!this.id || !this.shape) return;

    // Clear existing highlight
    const hl = this.getHighlightLayer();
    hl.clear();
    if (!this.isVisible) return;

    const checkCollisions = this._checkCollisions();

    const origin = { x: this.x, y: this.y };
    const offset = this.scene.grid.size / 2;

    // Get grid squares to highlight
    const highlightSquares = this._getGridHighlightPositions();
    for (const s of highlightSquares) {
      if (checkCollisions && this._testCollision(origin, { x: s.x + offset, y: s.y + offset })) continue;

      grid.grid.highlightGridPosition(hl, { x: s.x, y: s.y, color: fc, border: bc });
    }
  }

  /**
   * Determine whether to check for collisions.
   *
   * @private
   * @returns {boolean}
   */
  _checkCollisions() {
    return this.document.getFlag("pf1", "walls") ?? false;
  }

  /**
   * Tests for collisions between two points.
   *
   * @private
   * @param {{x:number,y:number}} origin
   * @param {{x:number,y:number}} point
   * @returns {boolean}
   */
  _testCollision(origin, point) {
    return CONFIG.Canvas.polygonBackends.move.testCollision(origin, point, { mode: "any", type: "move" });
  }

  getHighlightLayer() {
    return canvas.grid.getHighlightLayer(this.highlightId);
  }

  /**
   * Return origin item if any.
   *
   * @type {Item|pf1.components.ItemAction|null}
   */
  get origin() {
    const { uuid, action: actionId } = this.document.getFlag("pf1", "origin") ?? {};
    if (!uuid) return null;
    const item = fromUuidSync(uuid);
    const action = item?.actions?.get(actionId);
    return action ?? item ?? null;
  }
}
