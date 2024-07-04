export class TokenDocumentPF extends TokenDocument {
  /**
   * @internal
   * @override
   * @param {object} data
   * @param {object} context
   * @param {User} user
   */
  async _preCreate(data, context, user) {
    await super._preCreate(data, context, user);

    this._preCreateSetSize();
  }

  /**
   * @internal
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    if (context.recursive === false) return;

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
        scaleX: sizeConf.scale * this.actor.prototypeToken.texture.scaleX,
        scaleY: sizeConf.scale * this.actor.prototypeToken.texture.scaleY,
      },
    });
  }

  static getTrackedAttributes(data, path = []) {
    const attr = super.getTrackedAttributes(data, path);

    // Only append extra vars when not dealing with specific document type to avoid inserting them multiple times
    if (!data) {
      attr.value.push(
        ["attributes", "hp", "temp"],
        ["attributes", "hp", "nonlethal"],
        ["attributes", "ac", "normal", "total"]
      );
    }

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

    const offsetAttributes = ["attributes.hp", "attributes.wounds", "attributes.vigor"];
    if (offsetAttributes.includes(data?.attribute)) {
      // Add temp HP on top
      const temp = foundry.utils.getProperty(this.actor?.system, data.attribute + ".temp") || 0;
      data.value += temp;
      // Allow editing
      data.editable = true;
    }

    return data;
  }

  prepareBaseData() {
    this._syncSenses();

    super.prepareBaseData();
  }

  /**
   * Synchronize senses from actor.
   */
  _syncSenses() {
    if (!this.actor) return;
    if (!game.settings.get("pf1", "systemVision")) return;
    if (this.getFlag("pf1", "customVisionRules")) return;

    this.detectionModes = [];

    if (!this.sight.enabled) return;

    // Get base range from source data
    const baseRange = this._source.sight.range;

    this.detectionModes = [];

    this.sight.visionMode = "basic";

    // Basic detection
    const basicMode = { id: DetectionMode.BASIC_MODE_ID, enabled: true, range: baseRange };
    this.detectionModes.push(basicMode);

    const senses = this.actor?.system?.traits?.senses ?? {};

    const convertDistance = (d) => pf1.utils.convertDistance(d)[0];

    // Darkvision
    const darkvision = senses.dv?.total ?? 0;
    if (darkvision > 0) {
      this.sight.visionMode = "darkvision";
      // Upgrade basic mode range if greater
      basicMode.range = Math.max(baseRange, convertDistance(darkvision));
    }

    // -----------------------

    // See invisibility
    if (senses.si) {
      this.detectionModes.push({ id: "seeInvisibility", enabled: true, range: basicMode.range });
    }

    // True seeing
    const trueseeing = senses.tr?.total ?? 0;
    if (trueseeing > 0) {
      // Add normal vision within range of true seeing
      const trr = convertDistance(trueseeing);
      basicMode.range = Math.max(trr, basicMode.range);
      if (trueseeing > darkvision) this.sight.visionMode = "basic";

      this.detectionModes.push({ id: "seeInvisibility", enabled: true, range: trr, limited: true });
    }

    this.sight.range = Math.max(baseRange, basicMode.range);

    // Tremor sense
    if (senses.ts?.total) {
      this.detectionModes.push({ id: "feelTremor", enabled: true, range: convertDistance(senses.ts?.total) });
    }

    // Blind sense
    if (senses.bse?.total) {
      this.detectionModes.push({ id: "blindSense", enabled: true, range: convertDistance(senses.bse?.total) });
    }

    // Blind sight
    if (senses.bs?.total) {
      this.detectionModes.push({ id: "blindSight", enabled: true, range: convertDistance(senses.bs?.total) });
    }

    // Sort detection modes
    this.detectionModes.sort(this.constructor._sortDetectionModes);

    // Update vision advanced fields with current mode's defaults
    const visionDefaults = CONFIG.Canvas.visionModes[this.sight.visionMode]?.vision?.defaults || {};
    for (const fieldName of ["attenuation", "brightness", "saturation", "contrast"]) {
      if (fieldName in visionDefaults) {
        this.sight[fieldName] = visionDefaults[fieldName];
      }
    }
  }

  static _sortDetectionModes(a, b) {
    if (a.id === DetectionMode.BASIC_MODE_ID) return -1;
    if (b.id === DetectionMode.BASIC_MODE_ID) return 1;

    const src = { a: CONFIG.Canvas.detectionModes[a.id], b: CONFIG.Canvas.detectionModes[b.id] };
    return (src.a?.constructor.PRIORITY ?? 0) - (src.b?.constructor.PRIORITY ?? 0);
  }
}
