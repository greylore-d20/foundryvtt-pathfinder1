import { degtorad } from "./lib.js";

/**
 * Applies patches to core functions to integrate Pathfinder specific measurements.
 */
export class TemplateLayerPF extends TemplateLayer {
  // Foundry does not respect CONFIG.MeasuredTemplate.documentClass and CONFIG.MeasuredTemplate.objectClass
  async _onDragLeftStart(event) {
    if (!game.settings.get("pf1", "measureStyle")) return super._onDragLeftStart(event);

    // Call placeables layer super instead of templatelayer
    const origin = duplicate(event.data.origin);
    await PlaceablesLayer.prototype._onDragLeftStart.call(this, event);

    // Create the new preview template
    const tool = game.activeTool;
    const { originalEvent } = event.data;

    // Snap to grid
    if (!originalEvent.shiftKey) {
      const pos = canvas.grid.getSnappedPosition(origin.x, origin.y, this.gridPrecision);
      origin.x = pos.x;
      origin.y = pos.y;
    }

    // Create the template
    const data = {
      user: game.user.id,
      t: tool,
      x: origin.x,
      y: origin.y,
      distance: 1,
      direction: 0,
      fillColor: game.user.data.color || "#FF0000",
    };

    // Apply some type-specific defaults
    const defaults = CONFIG.MeasuredTemplate.defaults;
    if (tool === "cone") data["angle"] = defaults.angle;
    else if (tool === "ray") data["width"] = defaults.width * canvas.dimensions.distance;

    // Create a preview template
    const doc = new CONFIG.MeasuredTemplate.documentClass(data, { parent: canvas.scene });
    const template = new CONFIG.MeasuredTemplate.objectClass(doc);
    event.data.preview = this.preview.addChild(template);
    return template.draw();
  }

  _onDragLeftMove(event) {
    if (!game.settings.get("pf1", "measureStyle")) return super._onDragLeftMove(event);

    const { destination, createState, preview, origin } = event.data;
    if (createState === 0) return;

    const { originalEvent } = event.data;

    // Snap the destination to the grid
    const snapToGrid = !originalEvent.shiftKey;
    if (snapToGrid) {
      event.data.destination = canvas.grid.getSnappedPosition(destination.x, destination.y, 2);
    }

    // Compute the ray
    const ray = new Ray(origin, destination);
    const dist = canvas.dimensions.distance;
    const ratio = canvas.dimensions.size / dist;

    // Update the preview object
    const type = event.data.preview.data.t;
    const cellSize = canvas.dimensions.distance;
    // Set direction
    const baseDirection = Math.normalizeDegrees(Math.toDegrees(ray.angle));
    if (snapToGrid && ["cone", "circle"].includes(type)) {
      const halfAngle = CONFIG.MeasuredTemplate.defaults.angle / 2;
      preview.data.direction = Math.floor((baseDirection + halfAngle / 2) / halfAngle) * halfAngle;
    } else if (snapToGrid && type === "ray") {
      preview.data.direction = Math.floor((baseDirection + cellSize / 2) / cellSize) * cellSize;
    } else {
      preview.data.direction = baseDirection;
    }
    // Set distance
    const baseDistance = ray.distance / ratio;
    if (snapToGrid && ["cone", "circle", "ray"].includes(type)) {
      preview.data.distance = Math.floor(baseDistance / dist) * dist;
    } else {
      preview.data.distance = baseDistance;
    }
    preview.refresh();

    // Confirm the creation state
    event.data.createState = 2;
  }
}

export class MeasuredTemplatePF extends MeasuredTemplate {
  getHighlightedSquares() {
    if (!game.settings.get("pf1", "measureStyle") || !["circle", "cone", "ray"].includes(this.data.t)) return [];

    const grid = canvas.grid,
      d = canvas.dimensions;

    if (!this.id || !this.shape) return [];

    // Parse rays as per Bresenham's algorithm
    if (this.data.t === "ray") {
      const result = [];

      const s = d.size;
      const line = function (x0, y0, x1, y1) {
        x0 = Math.floor(Math.floor(x0) / s);
        x1 = Math.floor(Math.floor(x1) / s);
        y0 = Math.floor(Math.floor(y0) / s);
        y1 = Math.floor(Math.floor(y1) / s);

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (!(x0 === x1 && y0 === y1)) {
          result.push({ x: x0 * s, y: y0 * s });
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
      const ray = Ray.fromAngle(this.ray.A.x, this.ray.A.y, this.ray.angle, this.ray.distance + s / 2);

      // Get resulting squares
      line(ray.A.x, ray.A.y, ray.B.x, ray.B.y);

      return result;
    }

    // Get number of rows and columns
    const nr = Math.ceil((this.data.distance * 1.5) / d.distance / (d.size / grid.h)),
      nc = Math.ceil((this.data.distance * 1.5) / d.distance / (d.size / grid.w));

    // Get the center of the grid position occupied by the template
    const x = this.data.x,
      y = this.data.y;

    const [cx, cy] = grid.getCenter(x, y),
      [col0, row0] = grid.grid.getGridPositionFromPixels(cx, cy),
      minAngle = (360 + ((this.data.direction - this.data.angle * 0.5) % 360)) % 360,
      maxAngle = (360 + ((this.data.direction + this.data.angle * 0.5) % 360)) % 360;

    const within_angle = function (min, max, value) {
      min = (360 + (min % 360)) % 360;
      max = (360 + (max % 360)) % 360;
      value = (360 + (value % 360)) % 360;

      if (min < max) return value >= min && value <= max;
      return value >= min || value <= max;
    };

    const measureDistance = function (p0, p1) {
      const gs = canvas.dimensions.size,
        ray = new Ray(p0, p1),
        // How many squares do we travel across to get there? If 2.3, we should count that as 3 instead of 2; hence, Math.ceil
        nx = Math.ceil(Math.abs(ray.dx / gs)),
        ny = Math.ceil(Math.abs(ray.dy / gs));

      // Get the number of straight and diagonal moves
      const nDiagonal = Math.min(nx, ny),
        nStraight = Math.abs(ny - nx);

      // Diagonals in PF pretty much count as 1.5 times a straight
      const distance = Math.floor(nDiagonal * 1.5 + nStraight);
      const distanceOnGrid = distance * canvas.dimensions.distance;
      return distanceOnGrid;
    };

    const originOffset = { x: 0, y: 0 };
    // Offset measurement for cones
    // Offset is to ensure that cones only start measuring from cell borders, as in https://www.d20pfsrd.com/magic/#Aiming_a_Spell
    if (this.data.t === "cone") {
      // Degrees anticlockwise from pointing right. In 45-degree increments from 0 to 360
      const dir = (this.data.direction >= 0 ? 360 - this.data.direction : -this.data.direction) % 360;
      // If we're not on a border for X, offset by 0.5 or -0.5 to the border of the cell in the direction we're looking on X axis
      const xOffset =
        this.data.x % d.size != 0
          ? Math.sign((1 * Math.round(Math.cos(degtorad(dir)) * 100)) / 100) / 2 // /2 turns from 1/0/-1 to 0.5/0/-0.5
          : 0;
      // Same for Y, but cos Y goes down on screens, we invert
      const yOffset =
        this.data.y % d.size != 0 ? -Math.sign((1 * Math.round(Math.sin(degtorad(dir)) * 100)) / 100) / 2 : 0;
      originOffset.x = xOffset;
      originOffset.y = yOffset;
    }

    const result = [];
    for (let a = -nc; a < nc; a++) {
      for (let b = -nr; b < nr; b++) {
        // Position of cell's top-left corner, in pixels
        const [gx, gy] = canvas.grid.grid.getPixelsFromGridPosition(col0 + a, row0 + b);
        // Position of cell's center, in pixels
        const [cellCenterX, cellCenterY] = [gx + d.size * 0.5, gy + d.size * 0.5];

        // Determine point of origin
        const origin = { x: this.data.x, y: this.data.y };
        origin.x += originOffset.x * d.size;
        origin.y += originOffset.y * d.size;

        const ray = new Ray(origin, { x: cellCenterX, y: cellCenterY });

        const rayAngle = (360 + ((ray.angle / (Math.PI / 180)) % 360)) % 360;
        if (this.data.t === "cone" && ray.distance > 0 && !within_angle(minAngle, maxAngle, rayAngle)) {
          continue;
        }

        // Determine point we're measuring the distance to - always in the center of a grid square
        const destination = { x: cellCenterX, y: cellCenterY };

        const distance = measureDistance(destination, origin);
        if (distance <= this.data.distance) {
          result.push({ x: gx, y: gy });
        }
      }
    }

    return result;
  }

  getTokensWithin() {
    const highlightSquares = this.getHighlightedSquares(),
      d = canvas.dimensions;

    const inRect = function (point, rect) {
      return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
    };

    const result = [];
    for (const s of highlightSquares) {
      for (const t of canvas.tokens.placeables) {
        if (result.includes(t)) continue;

        const tokenData = {
          x: Math.round(t.x / d.size),
          y: Math.round(t.y / d.size),
          width: Math.round(t.width / d.size),
          height: Math.round(t.height / d.size),
        };
        const squareData = {
          x: Math.round(s.x / d.size),
          y: Math.round(s.y / d.size),
        };

        if (inRect(squareData, tokenData)) result.push(t);
      }
    }

    return result;
  }

  // Highlight grid in PF1 style
  highlightGrid() {
    if (!game.settings.get("pf1", "measureStyle") || !["circle", "cone", "ray"].includes(this.data.t))
      return super.highlightGrid();

    const grid = canvas.grid,
      bc = this.borderColor,
      fc = this.fillColor;

    // Only highlight for objects which have a defined shape
    if (!this.id || !this.shape) return;

    // Clear existing highlight
    const hl = this.getHighlightLayer();
    hl.clear();

    // Get grid squares to highlight
    const highlightSquares = this.getHighlightedSquares();
    for (const s of highlightSquares) {
      grid.grid.highlightGridPosition(hl, { x: s.x, y: s.y, color: fc, border: bc });
    }
  }

  getHighlightLayer() {
    return canvas.grid.getHighlightLayer(`Template.${this.id}`) ?? canvas.grid.addHighlightLayer(`Template.${this.id}`);
  }
}
