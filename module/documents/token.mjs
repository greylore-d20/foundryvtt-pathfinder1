export class TokenDocumentPF extends TokenDocument {
  /**
   * @override
   * @param {object} data
   * @param {object} context
   * @param {User} user
   */
  async _preCreate(data, context, user) {
    await super._preCreate(data, context, user);

    this._preCreateSetSize();

    const visionUpdate = this._getSyncVisionData();
    if (visionUpdate) this.updateSource(visionUpdate);
  }

  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    const flags = changed.flags?.pf1;
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
    const sizeConf = pf1.config.tokenSizes[this.actor.system.traits?.size];
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
   * Synchronize vision from actor.
   *
   * @returns {object|null} - Update object or null.
   */
  _getSyncVisionData() {
    if (this.getFlag("pf1", "customVisionRules")) return null;

    if (!this.actor?.isOwner) return;

    const baseRange = 0;
    const detectionModes = [];

    const sightUpdate = { visionMode: "basic", range: baseRange };
    const updateData = { sight: sightUpdate, detectionModes };

    const senses = this.actor?.system?.traits?.senses ?? {};

    // Basic detection
    const basicMode = { id: DetectionMode.BASIC_MODE_ID, enabled: true, range: baseRange };
    detectionModes.push(basicMode);

    // Darkvision
    const darkvision = senses.dv ?? 0;
    if (darkvision > 0) {
      sightUpdate.visionMode = "darkvision";
      // Upgrade basic mode range if greater
      basicMode.range = Math.max(baseRange, pf1.utils.convertDistance(darkvision)[0]);
      // Clobber guaranteed vision
      sightUpdate.range = basicMode.range;
    }

    // -----------------------
    // See invisibility or Truesight
    if (senses.si || senses.tr) {
      detectionModes.push({ id: "seeInvisibility", enabled: true, range: basicMode.range });
    }

    // Tremor sense
    if (senses.ts) {
      detectionModes.push({ id: "feelTremor", enabled: true, range: senses.ts });
    }

    // Blind sense
    if (senses.bse) {
      detectionModes.push({ id: "blindSense", enabled: true, range: senses.bse });
    }

    // Blind sight
    if (senses.bs) {
      detectionModes.push({ id: "blindSight", enabled: true, range: senses.bs });
    }

    // Sort detection modes
    detectionModes.sort(this._sortDetectionModes);

    // Update vision advanced fields with current mode's defaults
    const visionDefaults = CONFIG.Canvas.visionModes[sightUpdate.visionMode]?.vision?.defaults || {};
    for (const fieldName of ["attenuation", "brightness", "saturation", "contrast"]) {
      if (fieldName in visionDefaults) {
        sightUpdate[fieldName] = visionDefaults[fieldName];
      }
    }

    return updateData;
  }

  _syncVision() {
    const updateData = this._getSyncVisionData();
    if (updateData) return this.update(updateData);
    return null;
  }

  _sortDetectionModes(a, b) {
    if (a.id === DetectionMode.BASIC_MODE_ID) return -1;
    if (b.id === DetectionMode.BASIC_MODE_ID) return 1;

    const src = { a: CONFIG.Canvas.detectionModes[a.id], b: CONFIG.Canvas.detectionModes[b.id] };
    return (src.a?.constructor.PRIORITY ?? 0) - (src.b?.constructor.PRIORITY ?? 0);
  }
}
