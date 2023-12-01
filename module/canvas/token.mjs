import { hasTokenVision } from "../applications/vision-permission.mjs";

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
    let call;
    if (typeof effect == "string") {
      const buffItem = this.actor.items.get(effect);
      if (buffItem) {
        await buffItem.setActive(active ?? !buffItem.isActive);
        call = buffItem.isActive;
      } else {
        return super.toggleEffect(effect, { active, overlay });
      }
    } else if (Object.keys(pf1.config.conditions).includes(effect.id)) {
      if (active === undefined) await this.actor.toggleCondition(effect.id);
      else await this.actor.setCondition(effect.id, active);
      call = this.actor.hasCondition(effect.id);
    } else {
      return super.toggleEffect(effect, { active, overlay });
    }

    if (this.hasActiveHUD) canvas.tokens.hud.refreshStatusIcons();
    return call;
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

  // Token#observer patch to make use of vision permission settings
  get observer() {
    return game.user.isGM || hasTokenVision(this);
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
    if (number === 0) color = PIXI.utils.rgb2hex([1 - boostlessPct / 2, boostlessPct, 0]);
    else color = PIXI.utils.rgb2hex([0.5 * boostlessPct, 0.7 * boostlessPct, 0.5 + boostlessPct / 2]);

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
   * Return origins of cells the token occupies.
   *
   * Bug: Does not work with hex grid.
   * Bug: Does not account for rotation.
   *
   * @returns {Point[]} - Occupied cell origins.
   */
  getOccupiedCells() {
    const doc = this.document;
    const gridSizePx = this.scene.grid.size ?? 1;
    const { x, y, width, height } = doc;

    const squares = [];

    const wr = width - 1,
      hr = height - 1;

    for (let x0 = 0; x0 <= wr; x0++) {
      for (let y0 = 0; y0 <= hr; y0++) {
        squares.push({ x: x + x0 * gridSizePx, y: y + y0 * gridSizePx });
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
