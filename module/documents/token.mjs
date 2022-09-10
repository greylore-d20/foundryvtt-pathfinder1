export class TokenDocumentPF extends TokenDocument {
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

    if (data != null) {
      // Add temp HP to current current health value for HP and Vigor
      if (data.attribute === "attributes.hp") {
        data.value += parseInt(getProperty(this.actor, "system.attributes.hp.temp") || 0);
      } else if (data.attribute === "attributes.vigor") {
        data.value += parseInt(getProperty(this.actor, "system.attributes.vigor.temp") || 0);
      }

      // Make resources editable
      if (data.attribute.startsWith("resources.")) data.editable = true;
    }

    return data;
  }

  /**
   * Refresh sight and detection modes according to the actor's senses associated with this token.
   */
  refreshDetectionModes() {
    if (!["character", "npc"].includes(this.actor?.type)) return;
    if (this.getFlag("pf1", "customVisionRules")) return;

    // Reset sight properties
    this.sight.color = null;
    this.sight.attenuation = 0;
    this.sight.brightness = 0;
    this.sight.contrast = 0;
    this.sight.saturation = 0;
    this.sight.enabled = true;
    this.sight.visionMode = "basic";
    this.sight.range = 0;

    // Prepare sight
    const darkvisionRange = this.actor?.system?.traits?.senses?.dv ?? 0;
    if (darkvisionRange > 0) {
      this.sight.range = pf1.utils.convertDistance(darkvisionRange)[0];
      this.sight.visionMode = "darkvision";
      this.sight.saturation = -1;
    }

    // Set basic detection mode
    const basicId = DetectionMode.BASIC_MODE_ID;
    const basicMode = this.detectionModes.find((m) => m.id === basicId);
    if (!basicMode) this.detectionModes.push({ id: basicId, enabled: true, range: this.sight.range });
    else basicMode.range = this.sight.range;

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
    if (!blindSenseMode && this.actor?.system?.traits?.senses?.bse) {
      this.detectionModes.push({ id: blindSenseId, enabled: true, range: this.actor.system.traits.senses.bse });
    } else if (blindSenseMode != null) {
      if (!this.actor?.system?.traits?.senses?.bse) {
        this.detectionModes.splice(this.detectionModes.indexOf(blindSenseMode, 1));
      } else {
        blindSenseMode.range = this.actor.system.traits.senses.bse;
      }
    }

    // Set blind sight detection mode
    const blindSightId = "blindSight";
    const blindSightMode = this.detectionModes.find((m) => m.id === blindSightId);
    if (!blindSightMode && this.actor?.system?.traits?.senses?.bs) {
      this.detectionModes.push({ id: blindSightId, enabled: true, range: this.actor.system.traits.senses.bs });
    } else if (blindSightMode != null) {
      if (!this.actor?.system?.traits?.senses?.bs) {
        this.detectionModes.splice(this.detectionModes.indexOf(blindSightMode, 1));
      } else {
        blindSightMode.range = this.actor.system.traits.senses.bs;
      }
    }

    // Set tremor sense detection mode
    const tremorSenseId = "feelTremor";
    const tremorSenseMode = this.detectionModes.find((m) => m.id === tremorSenseId);
    if (!blindSightMode && this.actor?.system?.traits?.senses?.ts) {
      this.detectionModes.push({ id: tremorSenseId, enabled: true, range: this.actor.system.traits.senses.ts });
    } else if (tremorSenseMode != null) {
      if (!this.actor?.system?.traits?.senses?.ts) {
        this.detectionModes.splice(this.detectionModes.indexOf(tremorSenseMode, 1));
      } else {
        tremorSenseMode.range = this.actor.system.traits.senses.ts;
      }
    }

    // Sort detection modes
    this.detectionModes.sort(this._sortDetectionModes.bind(this));
  }

  _sortDetectionModes(a, b) {
    if (a.id === DetectionMode.BASIC_MODE_ID) return -1;
    if (b.id === DetectionMode.BASIC_MODE_ID) return 1;

    const src = { a: CONFIG.Canvas.detectionModes[a.id], b: CONFIG.Canvas.detectionModes[b.id] };
    return (src.a.constructor.PRIORITY ?? 0) - (src.b.constructor.PRIORITY ?? 0);
  }
}
