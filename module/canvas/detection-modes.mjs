/**
 * See invisibility detection mode with respect to sight (light & darkvision)
 */
export class DetectionModeInvisibilityPF extends DetectionModeInvisibility {
  static ID = "seeInvisibility";
  static LABEL = "PF1.Sense.seeInvis";
  static PRIORITY = 100000;

  /**
   * Copy of DetectionModeBasicSight._testPoint instead of the one inherited from DetectionMode.
   *
   * Allows seeing invisible in lit areas.
   *
   * @override
   */
  _testPoint(visionSource, mode, target, test) {
    // Blocked by walls
    if (!this._testLOS(visionSource, mode, target, test)) return false;
    // Otherwise allowed within range
    if (this._testRange(visionSource, mode, target, test)) return true;

    // If limited (e.g. true seeing), do not care about other light sources beyond range
    if (mode.limited) return false;

    // Allowed outside of range if lit
    const { x, y } = test.point;
    for (const lightSource of canvas.effects.lightSources.values()) {
      if (!lightSource.active) continue;
      if (lightSource.shape.contains(x, y)) return true;
    }
    return false;
  }
}

/**
 * Blindsense
 */
export class DetectionModeBlindSensePF extends DetectionMode {
  static ID = "blindSense";
  static LABEL = "PF1.Sense.blindsense";
  static DETECTION_TYPE = DetectionMode.DETECTION_TYPES.OTHER;
  static PRIORITY = 200100;

  constructor(data = {}, ...args) {
    data.walls = true;
    super(data, ...args);
  }

  /** @override */
  static getDetectionFilter() {
    return (this._detectionFilter ??= OutlineOverlayFilter.create({
      outlineColor: [0, 0.33, 0.6, 1],
      knockout: false,
      wave: this.ID === "blindSense",
    }));
  }

  /** @override */
  _canDetect(visionSource, target) {
    return true;
  }
}

/**
 * Blindsight
 */
export class DetectionModeBlindSightPF extends DetectionModeBlindSensePF {
  static ID = "blindSight";
  static LABEL = "PF1.Sense.blindsight";
  static DETECTION_TYPE = DetectionMode.DETECTION_TYPES.OTHER;
  static PRIORITY = 200000;

  /** @override */
  static getDetectionFilter() {
    return (this._detectionFilter ??= OutlineOverlayFilter.create({
      outlineColor: [0, 0.33, 0.6, 1],
      knockout: false,
      wave: false,
    }));
  }
}

/**
 * Tremorsense
 *
 * Unlike base implementation, does not block with walls.
 */
export class DetectionModeTremorPF extends DetectionModeTremor {
  static ID = "feelTremor";
  static LABEL = "PF1.Sense.tremorsense";
  static DETECTION_TYPE = DetectionMode.DETECTION_TYPES.MOVE;
  static PRIORITY = 201000;

  constructor(data = {}, ...args) {
    data.walls = false;
    super(data, ...args);
  }
}
