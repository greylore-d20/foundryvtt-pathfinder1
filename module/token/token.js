import { hasTokenVision } from "../misc/vision-permission.js";

export class TokenPF extends Token {
  async toggleEffect(effect, { active, overlay = false, midUpdate } = {}) {
    let call;
    if (typeof effect == "string") {
      const buffItem = this.actor.items.get(effect);
      if (buffItem) {
        call = await buffItem.setActive(!buffItem.isActive);
      } else call = await super.toggleEffect(effect, { active, overlay });
    } else if (effect && !midUpdate && Object.keys(CONFIG.PF1.conditions).includes(effect.id)) {
      const updates = {};
      updates["data.attributes.conditions." + effect.id] = !this.actor.data.data.attributes.conditions[effect.id];
      call = await this.actor.update(updates);
    } else if (effect) {
      call = await super.toggleEffect(effect, { active, overlay });
    }
    if (this.hasActiveHUD) canvas.tokens.hud.refreshStatusIcons();
    return call;
  }

  get actorVision() {
    return {
      lowLight: getProperty(this.actor.data, "data.traits.senses.ll.enabled"),
      lowLightMultiplier: getProperty(this.actor.data, "data.traits.senses.ll.multiplier.dim"),
      lowLightMultiplierBright: getProperty(this.actor.data, "data.traits.senses.ll.multiplier.bright"),
    };
  }

  get disableLowLight() {
    return getProperty(this.data, "flags.pf1.disableLowLight") === true;
  }

  // Token patch for shared vision
  _isVisionSource() {
    if (!canvas.sight.tokenVision || !this.hasSight) return false;

    // Only display hidden tokens for the GM
    const isGM = game.user.isGM;
    if (this.data.hidden && !isGM) return false;

    // Always display controlled tokens which have vision
    if (this._controlled) return true;

    // Otherwise vision is ignored for GM users
    if (isGM) return false;

    // If a non-GM user controls no other tokens with sight, display sight anyways
    const canObserve = this.actor && hasTokenVision(this);
    if (!canObserve) return false;
    const others = this.layer.controlled.filter((t) => !t.data.hidden && t.hasSight);
    return !others.length || game.settings.get("pf1", "sharedVisionMode") === "1";
  }

  // Token#observer patch to make use of vision permission settings
  get observer() {
    return game.user.isGM || hasTokenVision(this);
  }

  /**
   * @override
   * Update an emitted light source associated with this Token.
   * @param {boolean} [defer]           Defer refreshing the LightingLayer to manually call that refresh later.
   * @param {boolean} [deleted]         Indicate that this light source has been deleted.
   */
  updateLightSource({ defer = false, deleted = false } = {}) {
    // Prepare data
    const origin = this.getSightOrigin();
    const sourceId = this.sourceId;
    const d = canvas.dimensions;
    const isLightSource = this.emitsLight && !this.data.hidden;

    // Initialize a light source
    if (isLightSource && !deleted) {
      let dim = this.getLightRadius(this.data.light.dim);
      let bright = this.getLightRadius(this.data.light.bright);
      if (this.data.light.luminosity >= 0 && !this.disableLowLight) {
        dim *= canvas.sight.lowLightMultiplier().dim;
        bright *= canvas.sight.lowLightMultiplier().bright;
      }

      const lightConfig = foundry.utils.mergeObject(this.data.light.toObject(false), {
        x: origin.x,
        y: origin.y,
        dim: Math.clamped(dim, 0, d.maxR),
        bright: Math.clamped(bright, 0, d.maxR),
        z: this.document.getFlag("core", "priority"),
        seed: this.document.getFlag("core", "animationSeed"),
        rotation: this.data.rotation,
      });
      this.light.initialize(lightConfig);
      canvas.lighting.sources.set(sourceId, this.light);
    }

    // Remove a light source
    else canvas.lighting.sources.delete(sourceId);

    // Schedule a perception update
    if (!defer && (isLightSource || deleted)) {
      canvas.perception.schedule({
        lighting: { refresh: true },
        sight: { refresh: true },
      });
    }
  }

  updateVisionSource(...args) {
    // Don't apply vision with custom vision rules flag set
    if (this.data.flags?.pf1?.customVisionRules) return super.updateVisionSource(...args);

    // Set bright vision from actor senses
    if (["character", "npc"].includes(this.actor?.type)) {
      const { dv, bs, bse, ts } = this.actor.data.data.traits.senses;
      const highestVision = Math.max(dv, Math.max(bs, Math.max(bse, ts)));
      this.data.brightSight = game.pf1.utils.convertDistance(highestVision)[0];
    }

    super.updateVisionSource(...args);
  }
}
