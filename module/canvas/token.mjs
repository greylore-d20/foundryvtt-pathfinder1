import { hasTokenVision } from "../applications/vision-permission.mjs";

export class TokenPF extends Token {
  async toggleEffect(effect, { active, overlay = false, midUpdate } = {}) {
    let call;
    if (typeof effect == "string") {
      const buffItem = this.actor.items.get(effect);
      if (buffItem) {
        call = await buffItem.setActive(!buffItem.isActive);
      } else call = await super.toggleEffect(effect, { active, overlay });
    } else if (effect && !midUpdate && Object.keys(pf1.config.conditions).includes(effect.id)) {
      const updates = {};
      updates["system.attributes.conditions." + effect.id] = !this.actor.system.attributes.conditions[effect.id];
      call = await this.actor.update(updates);
    } else if (effect) {
      call = await super.toggleEffect(effect, { active, overlay });
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
   * @override
   * @param {object} data
   * @param {object} context
   * @param {string} userId
   */
  _onUpdate(data, context, userId) {
    if (context.render === false) return;

    if (hasProperty(data, "flags.pf1.customVisionRules")) {
      // Make sure this token's perception changes
      data.sight ||= {};
    }

    super._onUpdate(data, context, userId);
  }

  updateVisionSource(...args) {
    this.document.refreshDetectionModes();
    super.updateVisionSource(...args);
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
}
