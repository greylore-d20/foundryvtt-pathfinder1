import { hasTokenVision } from "../misc/vision-permission";

export class TokenPF extends Token {
  async _onUpdate(data, options, ...args) {
    await super._onUpdate(data, options, ...args);

    // Get the changed attributes
    const keys = Object.keys(data).filter((k) => k !== "_id");
    const changed = new Set(keys);
    const changedFlags = new Set(Object.keys(data.flags?.pf1 ?? {}));

    const testFlags =
      new Set(
        [
          "disableLowLight",
          "lowLightVision",
          "lowLightVisionMultiplier",
          "lowLightVisionMultiplierBright",
        ].filter((s) => changedFlags.has(s))
      ).size > 0;
    if (testFlags || changed.has("light")) {
      canvas.perception.schedule({
        lighting: { initialize: true, refresh: true },
        sight: { refresh: true },
      });
    }
  }

  async toggleEffect(effect, { active, overlay = false, midUpdate } = {}) {
    let call;
    if (typeof effect == "string") {
      const buffItem = this.actor.items.get(effect);
      if (buffItem) {
        call = await buffItem.update({ "data.active": !buffItem.data.data.active });
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
      lowLight: getProperty(this.data, "flags.pf1.lowLightVision"),
      lowLightMultiplier: getProperty(this.data, "flags.pf1.lowLightVisionMultiplier"),
      lowLightMultiplierBright: getProperty(this.data, "flags.pf1.lowLightVisionMultiplierBright"),
    };
  }

  get disableLowLight() {
    return getProperty(this.data, "flags.pf1.disableLowLight") === true;
  }

  // TODO: Remove noUpdateFog after 0.8.X
  updateSource({ defer = false, deleted = false, noUpdateFog = false, skipUpdateFog = false } = {}) {
    if (CONFIG.debug.sight) {
      SightLayer._performance = { start: performance.now(), tests: 0, rays: 0 };
    }

    // Prepare some common data
    const origin = this.getSightOrigin();
    const sourceId = this.sourceId;
    const d = canvas.dimensions;
    const maxR = canvas.lighting.globalLight ? Math.hypot(d.sceneWidth, d.sceneHeight) : null;
    const lowLightMultiplier = canvas.sight.lowLightMultiplier();

    // Update light source
    const isLightSource = this.emitsLight && !this.data.hidden;
    if (isLightSource && !deleted) {
      const bright =
        this.getLightRadius(this.data.brightLight) * (!this.disableLowLight ? lowLightMultiplier.bright : 1);
      const dim = this.getLightRadius(this.data.dimLight) * (!this.disableLowLight ? lowLightMultiplier.dim : 1);
      this.light.initialize({
        x: origin.x,
        y: origin.y,
        dim: dim,
        bright: bright,
        angle: this.data.lightAngle,
        rotation: this.data.rotation,
        color: this.data.lightColor,
        alpha: this.data.lightAlpha,
        animation: this.data.lightAnimation,
      });
      canvas.lighting.sources.set(sourceId, this.light);
      if (!defer) {
        this.light.drawLight();
        this.light.drawColor();
      }
    } else {
      canvas.lighting.sources.delete(sourceId);
      if (isLightSource && !defer) canvas.lighting.refresh();
    }

    // Update vision source
    const isVisionSource = this._isVisionSource();
    if (isVisionSource && !deleted) {
      //-Override token vision sources to not receive low-light bonus-
      let dim = maxR ?? this.getLightRadius(this.data.dimSight);
      const bright = this.getLightRadius(this.data.brightSight);
      //-End change-
      if (dim === 0 && bright === 0) dim = d.size * 0.6;
      this.vision.initialize({
        x: origin.x,
        y: origin.y,
        dim: dim,
        bright: bright,
        angle: this.data.sightAngle,
        rotation: this.data.rotation,
      });
      canvas.sight.sources.set(sourceId, this.vision);
      if (!defer) {
        this.vision.drawLight();
        canvas.perception.schedule({ sight: { refresh: true, skipUpdateFog, noUpdateFog } });
      }
    } else {
      canvas.sight.sources.delete(sourceId);
      if (isVisionSource && !defer) canvas.perception.refresh();
    }
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
      const dim = this.getLightRadius(
        Math.max(
          this.data.light.dim,
          this.disableLowLight ? this.data.light.dim : this.data.light.dim * canvas.sight.lowLightMultiplier().dim
        )
      );
      const bright = this.getLightRadius(
        Math.max(
          this.data.light.bright,
          this.disableLowLight
            ? this.data.light.bright
            : this.data.light.bright * canvas.sight.lowLightMultiplier().bright
        )
      );

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
}
