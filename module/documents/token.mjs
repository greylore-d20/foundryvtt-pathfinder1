import { PF1 } from "@config";

export class TokenDocumentPF extends TokenDocument {
  async _preCreate(data, options, userId) {
    this._preCreateSetSize();
  }

  async _preUpdate(updateData, options, user) {
    await super._preUpdate(updateData, options, user);

    const flags = updateData.flags?.pf1;
    if (flags) {
      // Delete flags instead of turning them false
      const deleteFlags = ["staticSize", "disableLowLight", "customVisionRules"];
      for (const flag of deleteFlags) {
        if (flags[flag] === false) {
          flags[`-=${flag}`] = null;
          delete flags[flag];
        }
      }
    }
  }

  /**
   * Handle actor size during token creation.
   */
  _preCreateSetSize() {
    if (!this.actor) return;

    // Apply token size
    if (this.getFlag("pf1", "staticSize")) return;
    const sizeConf = PF1.tokenSizes[this.actor.system.traits?.size];
    if (!sizeConf) return;

    this.updateSource({
      width: sizeConf.w,
      height: sizeConf.h,
      texture: {
        scaleY: sizeConf.scale,
        scaleX: sizeConf.scale,
      },
    });
  }

  // Todo: Declare this in TokenDocumentPF when/ if TokenDocument.getData calls the constructor's method
  getTrackedAttributes(data, path = []) {
    const attr = super.getTrackedAttributes(data, path);
    if (path.length === 0) attr.value.push(["attributes", "hp", "temp"], ["attributes", "hp", "nonlethal"]);
    return attr;
  }

  /**
   * Hijack Token health bar rendering to include temporary and temp-max health in the bar display
   *
   * @param barName
   * @param root0
   * @param root0.alternative
   */
  getBarAttribute(barName, { alternative = null } = {}) {
    let data;
    try {
      data = super.getBarAttribute(barName, { alternative: alternative });
    } catch (e) {
      data = null;
    }

    // Make resources editable
    if (data?.attribute.startsWith("resources.")) data.editable = true;

    return data;
  }

  /**
   * Refresh sight and detection modes according to the actor's senses associated with this token.
   */
  refreshDetectionModes() {
    if (!this.sight.enabled) return;
    if (!["character", "npc"].includes(this.actor?.type)) return;
    if (this.getFlag("pf1", "customVisionRules")) return;

    // Reset sight properties
    this.sight.visionMode = "basic";
    const baseRange = this.sight.range;

    // Prepare sight
    const darkvisionRange = this.actor?.system?.traits?.senses?.dv ?? 0;
    if (darkvisionRange > 0) {
      // Apply greater of darkvision and basic guaranteed vision
      this.sight.range = Math.max(baseRange, pf1.utils.convertDistance(darkvisionRange)[0]);
      this.sight.visionMode = "darkvision";
      // Copy over darkvision configuration to current mode (since we don't do .update on visionMode)
      const dvConf = CONFIG.Canvas.visionModes.darkvision.vision.defaults;
      this.sight.saturation = dvConf.saturation;
      this.sight.attenuation = dvConf.attenuation;
      this.sight.brightness = dvConf.brightness;
      this.sight.contrast = dvConf.contrast;
    } else {
      // Make sure sight is reset
      const baseSight = this._source.sight;
      this.sight.saturation = baseSight.saturation;
      this.sight.attenuation = baseSight.attenuation;
      this.sight.brightness = baseSight.brightness;
      this.sight.contrast = baseSight.contrast;
    }

    // Set basic detection mode
    const basicId = DetectionMode.BASIC_MODE_ID;
    const basicMode = this.detectionModes.find((m) => m.id === basicId);
    if (!basicMode) this.detectionModes.push({ id: basicId, enabled: true, range: baseRange });
    else basicMode.range = baseRange;

    // Set see invisibility detection mode
    const seeInvId = "seeInvisibility";
    const seeInvMode = this.detectionModes.find((m) => m.id === seeInvId);
    if (!seeInvMode && (this.actor?.system?.traits?.senses?.si || this.actor?.system?.traits?.senses?.tr)) {
      this.detectionModes.push({ id: seeInvId, enabled: true, range: this.sight.range });
    } else if (seeInvMode != null) {
      if (!(this.actor?.system?.traits?.senses?.si || this.actor?.system?.traits?.senses?.tr)) {
        this.detectionModes.splice(this.detectionModes.indexOf(seeInvMode, 1));
      } else {
        seeInvMode.range = this.sight.range;
      }
    }

    // Set blind sense detection mode
    const blindSenseId = "blindSense";
    const blindSenseMode = this.detectionModes.find((m) => m.id === blindSenseId);
    const blindSenseRange = this.actor?.system?.traits?.senses?.bse;
    if (!blindSenseMode && blindSenseRange) {
      this.detectionModes.push({ id: blindSenseId, enabled: true, range: blindSenseRange });
    } else if (blindSenseMode != null) {
      if (!blindSenseRange) {
        this.detectionModes.splice(this.detectionModes.indexOf(blindSenseMode, 1));
      } else {
        blindSenseMode.range = blindSenseRange;
      }
    }

    // Set blind sight detection mode
    const blindSightId = "blindSight";
    const blindSightMode = this.detectionModes.find((m) => m.id === blindSightId);
    const blindSightRange = this.actor?.system?.traits?.senses?.bs;
    if (!blindSightMode && blindSightRange) {
      this.detectionModes.push({ id: blindSightId, enabled: true, range: blindSightRange });
    } else if (blindSightMode != null) {
      if (!blindSightRange) {
        this.detectionModes.splice(this.detectionModes.indexOf(blindSightMode, 1));
      } else {
        blindSightMode.range = blindSightRange;
      }
    }

    // Set tremor sense detection mode
    const tremorSenseId = "feelTremor";
    const tremorSenseMode = this.detectionModes.find((m) => m.id === tremorSenseId);
    const tremorSenseRange = this.actor?.system?.traits?.senses?.ts;
    if (!blindSightMode && tremorSenseRange) {
      this.detectionModes.push({ id: tremorSenseId, enabled: true, range: tremorSenseRange });
    } else if (tremorSenseMode != null) {
      if (!tremorSenseRange) {
        this.detectionModes.splice(this.detectionModes.indexOf(tremorSenseMode, 1));
      } else {
        tremorSenseMode.range = tremorSenseRange;
      }
    }

    // Sort detection modes
    this.detectionModes.sort(this._sortDetectionModes.bind(this));
  }

  _sortDetectionModes(a, b) {
    if (a.id === DetectionMode.BASIC_MODE_ID) return -1;
    if (b.id === DetectionMode.BASIC_MODE_ID) return 1;

    const src = { a: CONFIG.Canvas.detectionModes[a.id], b: CONFIG.Canvas.detectionModes[b.id] };
    return (src.a?.constructor.PRIORITY ?? 0) - (src.b?.constructor.PRIORITY ?? 0);
  }
}
