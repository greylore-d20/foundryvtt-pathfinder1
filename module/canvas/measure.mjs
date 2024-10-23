import { measureDistance } from "@utils";

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
   * Override to provide snapped drag for cone template direction.
   *
   * @override
   * @param {Event} event
   * Synced with Foundry v12.331
   */
  _onDragLeftMove(event) {
    if (!game.settings.get("pf1", "measureStyle")) return super._onDragLeftMove(event);

    const interaction = event.interactionData;

    // Snap the destination to the grid
    const snapToGrid = !event.shiftKey;
    if (snapToGrid) {
      const snapMode =
        CONST.GRID_SNAPPING_MODES.CENTER | CONST.GRID_SNAPPING_MODES.EDGE_MIDPOINT | CONST.GRID_SNAPPING_MODES.CORNER;
      interaction.destination = this.getSnappedPoint(interaction.destination, { mode: snapMode });
    }

    // Compute the ray
    const { origin, destination, preview } = interaction;
    const ray = new Ray(origin, destination);
    let distance;

    // Grid type
    if (game.settings.get("core", "gridTemplates")) {
      distance = canvas.grid.measurePath([origin, destination]).distance;
    }
    // Euclidean type
    else {
      const ratio = canvas.dimensions.size / canvas.dimensions.distance;
      distance = ray.distance / ratio;
    }

    // Update the preview object
    if (snapToGrid && preview.document.t === "cone") {
      const halfAngle = CONFIG.MeasuredTemplate.defaults.angle / 2;
      const baseDirection = Math.normalizeDegrees(Math.toDegrees(ray.angle));
      preview.document.direction = Math.floor((baseDirection + halfAngle / 2) / halfAngle) * halfAngle;
    } else {
      preview.document.direction = Math.normalizeDegrees(Math.toDegrees(ray.angle));
    }
    preview.document.distance = distance;
    preview.renderFlags.set({ refreshShape: true });
  }
}

export class MeasuredTemplatePF extends MeasuredTemplate {
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
    // In case this is not initialized, not circle or cone, or system measure templates are disabled, let Foundry handle it.
    // Foundry's handling of Ray is perfectly usable even if slightly wrong, so no override needed.
    if (
      !game.settings.get("pf1", "measureStyle") ||
      (templateType !== "circle" && (templateType !== "cone" || canvas.grid.isHexagonal))
    ) {
      return super._getGridHighlightPositions();
    }

    const grid = canvas.grid;
    let { x: ox, y: oy } = this.document;

    // Snap cones to the closest corner or vertex based on their direction
    if (templateType === "cone") {
      const angle = this.document.direction;

      if (angle <= 45 || angle >= 315) {
        ox = Math.ceil(ox / grid.size) * grid.size;
      } else if (angle >= 135 && angle <= 225) {
        ox = Math.floor(ox / grid.size) * grid.size;
      }

      if (angle >= 45 && angle <= 135) {
        oy = Math.ceil(oy / grid.size) * grid.size;
      } else if (angle >= 225 && angle <= 315) {
        oy = Math.floor(oy / grid.size) * grid.size;
      }
    }

    // Test if template origin is in the center of a grid space. Apply a grace margin for odd grid sizes
    const originInCenter = ox % grid.size === Math.ceil(grid.size / 2) && oy % grid.size === Math.ceil(grid.size / 2);

    const shape = this.shape;
    const bounds = shape.getBounds();
    bounds.x += ox;
    bounds.y += oy;
    bounds.fit(canvas.dimensions.rect);
    bounds.pad(1);

    // Identify grid spaces that are in "walking distance" of the template origin
    const positions = [];
    const [i0, j0, i1, j1] = grid.getOffsetRange(bounds);
    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        const offset = { i, j };
        const { x: cx, y: cy } = grid.getCenterPoint(offset);

        const distance = grid.measurePath([
          { x: cx, y: cy },
          { x: ox, y: oy },
        ]).distance;

        switch (templateType) {
          case "cone": {
            // Include all squares that are within "walking distance"" and within 45 degrees of the cone direction
            const angle = (Math.atan2(cy - oy, cx - ox) * 180) / Math.PI;
            const angleDiff = Math.abs(angle - this.document.direction) % 360;

            if (distance < this.document.distance && (angleDiff <= 45 || angleDiff >= 315)) {
              positions.push(grid.getTopLeftPoint(offset));
            }
            break;
          }

          case "circle":
            // If template origin lies in grid center, include all squares that have their center within the distance, otherwise only those that are strictly within
            // Centered circles get a 2% grace margin in distance calculation to deal with uneven grid sizes
            if (
              originInCenter || canvas.grid.isHexagonal
                ? distance <= this.document.distance * 1.02
                : distance < this.document.distance
            ) {
              positions.push(grid.getTopLeftPoint(offset));
            }
            break;
        }
      }
    }
    return positions;
  }

  /**
   * Determine tokens residing within the template bounds, based on either grid higlight logic or token center.
   *
   * @public
   * @returns {Promise<Token[]>} Tokens sufficiently within the template.
   */
  async getTokensWithin() {
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

    // Ensure shape and related data exists (e.g. this.ray) for getHighlightedSquares to work correctly.
    // this.width, this.height, etc. are wrong without this
    if (!this.shape) {
      this._applyRenderFlags({ refreshShape: true });
      // HACK: Wait for next tick, the template won't be finalized by Foundry until then.
      // Likely breaks with Foundry v12 with newer PIXI version
      await new Promise((resolve) => canvas.app.ticker.addOnce(() => resolve()), undefined, PIXI.UPDATE_PRIORITY.LOW);
    }

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

  getHighlightLayer() {
    return canvas.interface.grid.getHighlightLayer(this.highlightId);
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
