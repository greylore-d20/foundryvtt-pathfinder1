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
   * Adjust template size.
   *
   * @override
   */
  static getConeShape(distance, direction, angle) {
    distance = Math.max(distance - 1.001 / canvas.dimensions.distancePixels, 0);
    return super.getConeShape(distance, direction, angle);
  }

  /**
   * Adjust template size.
   *
   * @override
   */
  static getCircleShape(distance) {
    distance = Math.max(distance - 1.001 / canvas.dimensions.distancePixels, 0);
    return super.getCircleShape(distance);
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
    const isCone = templateType === "cone";
    const isCircle = templateType === "circle";
    // In case this is not initialized, not circle or cone, or system measure templates are disabled, let Foundry handle it.
    // Foundry's handling of Ray is perfectly usable even if slightly wrong, so no override needed.
    if (!(isCircle || isCone) || !game.settings.get("pf1", "measureStyle")) {
      return super._getGridHighlightPositions();
    }

    const grid = canvas.grid;
    const { x: ox, y: oy } = this.document;
    const shape = this.shape;
    const bounds = shape.getBounds();

    let origin = { x: ox, y: oy };
    console.log("Origin", { ...origin });
    const radius = this.document.distance;
    const direction = this.document.direction;

    // Shift origin of a cone towards nearest edge or corner
    const edgeSnapMode = CONST.GRID_SNAPPING_MODES.SIDE_MIDPOINT | CONST.GRID_SNAPPING_MODES.CORNER;
    const snapped = canvas.grid.getSnappedPoint(origin, { mode: edgeSnapMode | CONST.GRID_SNAPPING_MODES.CENTER });
    const centered = canvas.grid.getSnappedPoint(origin, { mode: CONST.GRID_SNAPPING_MODES.CENTER });

    let isCentered = false;
    if (snapped.x == centered.x && snapped.y === centered.y) {
      isCentered = true;
      origin = centered;
    }
    // Shift cone origin towards direction of the cone if centered, snapping to nearest corner or side midpoint.
    if (isCentered && isCone) {
      const ray = Ray.fromAngle(centered.x, centered.y, direction, canvas.dimensions.distancePixels / 2 + 25);
      origin = canvas.grid.getSnappedPoint(ray.B, { mode: edgeSnapMode });
      console.log("CenterToEdge", { ...origin });
    }

    // Adjust bounds
    bounds.x += origin.x;
    bounds.y += origin.y;
    bounds.fit(canvas.dimensions.rect);
    bounds.pad(1);

    // Identify grid space that have their center points covered by the template shape
    const positions = [];
    const [i0, j0, i1, j1] = grid.getOffsetRange(bounds);
    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        const offset = { i, j };
        const { x: cx, y: cy } = grid.getCenterPoint(offset);

        // If the origin of the template is a grid space center, this grid space is highlighted
        let covered = Math.max(Math.abs(cx - ox), Math.abs(cy - oy)) < 1;

        if (!covered) {
          for (let dx = -0.5; dx <= 0.5; dx += 0.5) {
            for (let dy = -0.5; dy <= 0.5; dy += 0.5) {
              if (shape.contains(cx - ox + dx, cy - oy + dy)) {
                covered = true;
                break;
              }
            }
          }
        }
        if (!covered) continue;

        if (canvas.grid.measurePath([origin, { x: cx, y: cy }]).distance > radius) continue;

        positions.push(grid.getTopLeftPoint(offset));
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

  // Highlight grid in PF1 style
  highlightGrid() {
    if (
      !game.settings.get("pf1", "measureStyle") ||
      !["circle", "cone", "ray"].includes(this.document.t) ||
      canvas.grid.type !== CONST.GRID_TYPES.SQUARE
    )
      return super.highlightGrid();

    // Only highlight for objects which have a defined shape
    if (!this.id || !this.shape) return;

    // Clear existing highlight
    const hl = this.getHighlightLayer();
    hl.clear();
    if (!this.isVisible) return;

    const grid = canvas.interface.grid,
      bc = this.document.borderColor,
      fc = this.document.fillColor;

    // Get grid squares to highlight
    const highlightSquares = this._getGridHighlightPositions();

    for (const s of highlightSquares) {
      grid.highlightPosition(hl.name, { x: s.x, y: s.y, color: fc, border: bc });
    }
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
