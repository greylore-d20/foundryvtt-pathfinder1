export class TokenPF extends Token {
  /**
   * Synced with Foundry 11.315
   *
   * @override
   * @param {string|object} effect
   * @param {object} options
   * @param {boolean} options.active - Force active state
   * @param {boolean} [options.overlay=false] - Overlay effect
   * @returns {boolean} - was it applied or removed
   */
  async toggleEffect(effect, { active, overlay = false } = {}) {
    const effectId = typeof effect === "string" ? effect : effect?.id;
    if (this.actor) {
      const buff = this.actor.items.get(effectId);
      if (buff) {
        foundry.utils.logCompatibilityWarning("Toggling buffs via TokenPF.toggleEffect() is deprecated.", {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        });

        await buff.setActive(active ?? !buff.isActive);
        return buff.isActive;
      }
    }

    if (this.actor && pf1.registry.conditions.has(effectId) && typeof this.actor.toggleCondition === "function") {
      let rv;
      if (active === undefined) rv = await this.actor.toggleCondition(effectId);
      else rv = await this.actor.setCondition(effectId, active);
      return rv[effectId];
    } else {
      return super.toggleEffect(effect, { active, overlay });
    }
  }

  get actorVision() {
    const ll = this.actor.system.traits?.senses?.ll ?? {};
    return {
      lowLight: ll.enabled,
      lowLightMultiplier: ll.multiplier?.dim,
      lowLightMultiplierBright: ll.multiplier?.bright,
    };
  }

  get disableLowLight() {
    return this.document.getFlag("pf1", "disableLowLight") === true;
  }

  /**
   * Synced with Foundry v11.315
   *
   * @override
   * @since PF1 vNEXT
   */
  _isVisionSource() {
    if (!canvas.effects.visibility.tokenVision || !this.hasSight) return false;

    // Only display hidden tokens for the GM
    const isGM = game.user.isGM;
    if (this.document.hidden && !isGM) return false;

    // Always display controlled tokens which have vision
    if (this.controlled) return true;

    // Otherwise, vision is ignored for GM users
    if (isGM) return false;

    // Vision sharing
    if (this.actor?.sharesVision) return true;

    // If a non-GM user controls no other tokens with sight, display sight
    const guarantee = game.settings.get("pf1", "guaranteedVision");
    const canObserve = this.actor?.testUserPermission(game.user, guarantee) ?? false;
    if (!canObserve) return false;
    const others = this.layer.controlled.filter((t) => !t.document.hidden && t.hasSight);
    return !others.length;
  }

  /**
   * @param {object} data         Resource data for this bar
   * @returns {number|null}       The number to boost the bar by, if any.
   * @protected
   */
  _getBarBoost(data) {
    if (data.attribute === "attributes.hp") return { value: this.actor.system.attributes.hp.temp, color: 0xc0d6e4 };
    if (data.attribute === "attributes.vigor")
      return { value: this.actor.system.attributes.vigor.temp, color: 0xc0d6e4 };
    return null;
  }

  /**
   * Determines the length of the underline (bottom half-height bar overlay) on a token bar.
   *
   * @param {object} data         Resource data for this bar
   * @returns {number|null}       The value of the bar underline, if any.
   * @protected
   */
  _getBarUnderline(data) {
    if (data.attribute === "attributes.hp")
      return { value: this.actor.system.attributes.hp.nonlethal, color: 0x7d2828 };
    return null;
  }

  /**
   * Draw a single resource bar, given provided data.
   *
   * @param {number} number       The Bar number>
   * @param {PIXI.Graphics} bar   The Bar container.
   * @param {object} data         Resource data for this bar.
   * @protected
   */
  _drawBar(number, bar, data) {
    // Get boost value (such as temporary hit points
    const boost = this._getBarBoost(data);
    const underline = this._getBarUnderline(data);
    const boostlessMax = data.max;

    const val = Number(data.value);
    data.max = Math.max(data.max, (boost?.value ?? 0) + val);
    const pct = Math.clamped(val, 0, data.max) / data.max;
    const boostlessPct = Math.clamped(val, 0, boostlessMax) / boostlessMax;

    // Determine sizing
    let h = Math.max(canvas.dimensions.size / 12, 8);
    const w = this.w;
    const bs = Math.clamped(h / 8, 1, 2);
    if (this.document.height >= 2) h *= 1.6; // Enlarge the bar for large tokens

    // Determine the color to use
    const blk = 0x000000;
    let color;
    if (number === 0) color = Color.fromRGBvalues(1 - boostlessPct / 2, boostlessPct, 0);
    else color = Color.fromRGBvalues(0.5 * boostlessPct, 0.7 * boostlessPct, 0.5 + boostlessPct / 2);

    // Draw the bar
    bar.clear();
    // Draw background of bar
    bar.beginFill(blk, 0.5).lineStyle(bs, blk, 1.0).drawRoundedRect(0, 0, this.w, h, 3);
    // Draw bar boost
    if (boost?.value > 0) {
      const pct = Math.clamped(val + boost.value, 0, data.max) / data.max;
      bar
        .beginFill(boost.color, 1.0)
        .lineStyle(bs, blk, 1.0)
        .drawRoundedRect(0, 0, pct * w, h, 2);
    }

    // Draw normal value
    bar
      .beginFill(color, 1.0)
      .lineStyle(bs, blk, 1.0)
      .drawRoundedRect(0, 0, pct * w, h, 2);
    // Draw bar underline
    if (underline?.value > 0) {
      const pct = Math.clamped(underline.value, 0, data.max) / data.max;
      bar
        .beginFill(underline.color, 1.0)
        .lineStyle(bs, blk, 1.0)
        .drawRoundedRect(0, h / 2, pct * w, h / 2, 2);
    }

    // Set position
    const posY = number === 0 ? this.h - h : 0;
    bar.position.set(0, posY);
  }

  /**
   * Returns error margin, in pixels, for measuring to and from token center.
   *
   * Defined as larger of half the token's width and height.
   *
   * @type {number}
   */
  get sizeErrorMargin() {
    return Math.max(this.w / 2, this.h / 2);
  }

  /**
   * Return coordinates of cells the token occupies.
   *
   * Bug: Does not work with hex grid.
   * Bug: Does not account for rotation.
   *
   * @param {object} [options={}] - Additional options
   * @param {boolean} [options.center=false] - Return cell centers instead of origins
   * @returns {Point[]} - Occupied cell coordinates.
   */
  getOccupiedCells({ center = false } = {}) {
    const doc = this.document;
    const gridSizePx = this.scene.grid.size ?? 1;
    const { x, y, width, height } = doc;

    // Offset for returning cell center
    const offset = center ? gridSizePx / 2 : 0;

    const squares = [];

    const wr = width - 1,
      hr = height - 1;

    for (let x0 = 0; x0 <= wr; x0++) {
      for (let y0 = 0; y0 <= hr; y0++) {
        squares.push({ x: x + x0 * gridSizePx + offset, y: y + y0 * gridSizePx + offset });
      }
    }

    return squares;
  }

  /**
   * @type {boolean} - Is this token a square?
   */
  get isSquare() {
    return this.document.width === this.document.height;
  }

  /**
   * Get current light level of a token.
   *
   * @param {object} [options] - Additional options.
   * @param {number} [options.points=2] - Number of visibility points needed to qualify for light. Max 5.
   * @param {number} [options.maxRange=Infinity] - Maximum range (in scene scale units) to seek relevant lights from.
   * @param {boolean} [options.visualize=false] - Draw debug visualizations.
   * @param {number} [options.tolerance=0.05] - Extra distance granted to lights, relative to scene scale. Max 0.3, min 0.
   * @returns {-1|0|1|2} Light level. 0 for dark, 1 for dim, 2 for bright. -1 is returned if token is not visible.
   * @todo Allow defining observer token for darkvision handling.
   */
  getLightLevel({ points = 2, maxRange = Infinity, tolerance = 0.05, visualize = false } = {}) {
    if (!this.isVisible) return -1;

    const tokenCenter = this.center;

    tolerance = Math.clamped(tolerance, 0, 0.3);
    points = Math.clamped(points, 1, 5);

    const { size: gridPx, distance: gridScale } = this.scene.grid;

    if (maxRange <= gridScale / 2)
      throw new Error(`getLightLevel() maxRange parameter must be a decent positive value`);

    const errorMargin = this.sizeErrorMargin;
    const errorMarginScaled = (errorMargin / gridPx) * gridScale;

    // Arbitrary reduction in size to not get light level from corners
    const t = errorMargin * 0.65;

    // Token offset points for light tests
    // TODO: Add option of more or less points, and different patterns
    const offsets = [
      [0, 0],
      [-t, -t],
      [-t, t],
      [t, t],
      [t, -t],
      [-t, 0],
      [t, 0],
      [0, -t],
      [0, t],
    ].map(([x, y]) => ({ x: tokenCenter.x + x, y: tokenCenter.y + y }));

    const drawDot = ({ x, y } = {}, color, { r = 3, z = 1000 } = {}) => {
      const drawing = new PIXI.Graphics();
      drawing.zIndex = z;
      drawing.beginFill(color);
      drawing.lineStyle(1, 0x000000, 0, 1);
      drawing.drawCircle(x, y, r);
      canvas.interface.addChild(drawing);
      drawings.push(drawing);
    };

    const drawings = [];
    if (visualize) offsets.forEach((point) => drawDot(point.x, point.y, 0xff0000, { r: 5, z: 500 }));

    const getSceneDistance = (p0, p1) => (new Ray(p0, p1).distance / gridPx) * gridScale;

    const halfGrid = gridScale / 2;

    // TODO: Account for token lights, too.
    const relevantLights = this.scene.lights
      .filter((light) => !light.hidden)
      .map((light) => {
        const distance = getSceneDistance(tokenCenter, light);
        const { bright, dim } = light.config;
        // Treat the light somewhat closer based on how large the token is
        const relaxedDistance = distance - errorMarginScaled;

        return {
          light,
          x: light.x,
          y: light.y,
          range: Math.max(bright, dim) + gridScale * tolerance,
          dim,
          bright,
          inBright: bright >= relaxedDistance,
          isBright: false,
          inDim: dim >= relaxedDistance,
          isDim: false,
          distance,
          relaxedDistance,
        };
      })
      .filter(
        (light) =>
          light.relaxedDistance <= light.range && light.distance <= maxRange && light.range + halfGrid >= light.distance
      )
      // Filter lights based on wall collisions and inject
      .filter((light) => {
        light.brights = 0;
        light.dims = 0;
        light.points = 0;

        // Test if there's sufficiently many points we can get no collision with
        offsets.forEach((target, idx) => {
          const source = { x: light.x, y: light.y };
          // Ignore points too far away
          const distance = getSceneDistance(source, target);
          if (distance > light.range) return;

          // Test light blocking walls
          if (!ClockwiseSweepPolygon.testCollision(source, target, { type: "light", mode: "any" })) {
            light.points += 1;
            const isBright = distance <= light.bright;

            if (isBright) light.brights += 1;
            else light.dims += 1;

            if (visualize) {
              const line = new PIXI.Graphics();
              line.position.set(source.x, source.y);
              line.lineStyle(isBright ? 3 : 2, isBright ? 0xf9ee13 : 0x795e13);
              line.zIndex = isBright ? 1050 : 1000;
              line.lineTo(target.x - source.x, target.y - source.y);
              canvas.interface.addChild(line);
              drawings.push(line);

              drawDot(target, 0x00ff00, { r: 3, z: 1200 });
            }
          } else {
            if (visualize) drawDot(target, 0x773300, { r: 5, z: 700 });
          }
        });

        if (light.brights >= points) {
          light.isBright = true;
        } else if (light.dims + light.brights >= points) {
          light.isDim = true;
        }

        if (visualize)
          drawDot(light, light.isBright ? 0xffdf00 : light.isDim ? 0xdfaf00 : 0x7f3f00, { r: 10, z: 1500 });

        return light.points > 0;
      })
      // Try to sort "better" lights front
      .sort((a, b) => {
        if (a.isBright && !b.isBright) return -1;
        if (!a.isBright && b.isBright) return 1;
        if (a.isDim && !b.isDim) return -1;
        if (!a.isDim && b.isDim) return 1;
        return a.points - b.points;
      });

    // Remove visualizations after a period
    if (visualize) setTimeout(() => drawings.forEach((p) => canvas.interface.removeChild(p)), 5_000);

    // Without this loop, we may incorrectly return dim light when they in fact are not in such
    for (const light of relevantLights) {
      if (light.isBright) return 2;
      if (light.isDim) return 1;
    }

    // Alternative (and probably incorrect):
    // const bestLight = relevantLights[0];
    // return bestLight ? (bestLight.isBright ? 2 : 1) : 0;

    return 0;
  }
}
