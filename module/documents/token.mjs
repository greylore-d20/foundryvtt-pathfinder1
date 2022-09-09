export class TokenDocumentPF extends TokenDocument {
  async update(data, options) {
    // Resize token with actor size change
    const sizeKey = getProperty(data, "actordata.traits.size");
    if (sizeKey) {
      const size = CONFIG.PF1.tokenSizes[sizeKey];
      setProperty(data, "width", size.w);
      setProperty(data, "height", size.h);
      setProperty(data, "scale", size.scale);
    }

    return super.update(data, options);
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
    // Prepare sight
    const darkvisionRange = this.actor?.system?.traits?.senses?.dv ?? 0;
    if (darkvisionRange > 0) {
      this.sight.range = pf1.utils.convertDistance(darkvisionRange)[0];
      this.sight.visionMode = "darkvision";
      this.sight.saturation = -1;
    }
    // Prepare normal sight
    else {
      this.sight.range = 0;
      this.sight.visionMode = "basic";
      this.sight.saturation = 0;
    }

    // Set basic detection mode
    const basicId = DetectionMode.BASIC_MODE_ID;
    const basicMode = this.detectionModes.find((m) => m.id === basicId);
    if (!basicMode) this.detectionModes.push({ id: basicId, enabled: true, range: this.sight.range });

    // Set see invisibility detection mode
    const seeInvId = "seeInvisibility";
    const seeInvMode = this.detectionModes.find((m) => m.id === seeInvId);
    if (!seeInvMode && this.actor?.system?.traits?.senses?.si) {
      this.detectionModes.push({ id: seeInvId, enabled: true, range: this.sight.range });
    } else if (seeInvMode != null) {
      if (!this.actor?.system?.traits?.senses?.si) {
        this.detectionModes.splice(this.detectionModes.indexOf(seeInvMode, 1));
      } else {
        seeInvMode.range = this.sight.range;
      }
    }
  }
}
