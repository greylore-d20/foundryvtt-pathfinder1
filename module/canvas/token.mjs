import { hasTokenVision } from "../applications/vision-permission.mjs";

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
      updates["system.attributes.conditions." + effect.id] = !this.actor.system.attributes.conditions[effect.id];
      call = await this.actor.update(updates);
    } else if (effect) {
      call = await super.toggleEffect(effect, { active, overlay });
    }
    if (this.hasActiveHUD) canvas.tokens.hud.refreshStatusIcons();
    return call;
  }

  get actorVision() {
    return {
      lowLight: getProperty(this.actor, "system.traits.senses.ll.enabled"),
      lowLightMultiplier: getProperty(this.actor, "system.traits.senses.ll.multiplier.dim"),
      lowLightMultiplierBright: getProperty(this.actor, "system.traits.senses.ll.multiplier.bright"),
    };
  }

  get disableLowLight() {
    return getProperty(this, "flags.pf1.disableLowLight") === true;
  }

  // Token#observer patch to make use of vision permission settings
  get observer() {
    return game.user.isGM || hasTokenVision(this);
  }

  updateVisionSource(...args) {
    // Don't apply vision with custom vision rules flag set
    if (this.document.flags?.pf1?.customVisionRules) return super.updateVisionSource(...args);

    // Set bright vision from actor senses
    if (["character", "npc"].includes(this.actor?.type)) {
      const { dv, bs, bse, ts } = this.actor.system.traits.senses;
      if (this.actor.system.attributes?.conditions?.pf1_blind === true) {
        this.document.sight.range = 0;
        this.document.sight.visionMode = "blindness";
        this.document.sight.saturation = 0;
      } else if (dv > 0) {
        this.document.sight.range = game.pf1.utils.convertDistance(dv)[0];
        this.document.sight.visionMode = "darkvision";
        this.document.sight.saturation = -1;
      } else {
        this.document.sight.range = 0;
        this.document.sight.visionMode = "basic";
        this.document.sight.saturation = 0;
      }
    }

    super.updateVisionSource(...args);
  }

  _onUpdate(data, options, user) {
    if (options.render === false) return;
    else super._onUpdate(data, options, user);
  }
}
