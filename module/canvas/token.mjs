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
   * @since PF1 v10
   */
  _isVisionSource() {
    if (!canvas.visibility.tokenVision || !this.hasSight) return false;

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
    const pct = Math.clamp(val, 0, data.max) / data.max;
    const boostlessPct = Math.clamp(val, 0, boostlessMax) / boostlessMax;

    // Determine sizing
    let h = Math.max(canvas.dimensions.size / 12, 8);
    const w = this.w;
    const bs = Math.clamp(h / 8, 1, 2);
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
      const pct = Math.clamp(val + boost.value, 0, data.max) / data.max;
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
      const pct = Math.clamp(underline.value, 0, data.max) / data.max;
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
}
