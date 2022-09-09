export class DetectionModeInvisibilityPF extends DetectionModeInvisibility {
  static ID = "seeInvisibility";
  static LABEL = "DETECTION.SeeInvisibility";
  static PRIORITY = 100000;

  /** @override */
  _testPoint(visionSource, mode, target, test) {
    if (!this._testLOS(visionSource, mode, target, test)) return false;
    if (this._testRange(visionSource, mode, target, test)) return true;
    for (const lightSource of canvas.effects.lightSources.values()) {
      if (!lightSource.active || lightSource.disabled) continue;
      if (lightSource.los.contains(test.point.x, test.point.y)) return true;
    }
    return false;
  }
}

export class DetectionModeBlindSensePF extends DetectionMode {
  static ID = "blindSense";
  static LABEL = "PF1.SenseBSense";
  static DETECTION_TYPE = DetectionMode.DETECTION_TYPES.OTHER;
  static PRIORITY = 200100;

  constructor(data = {}, ...args) {
    data.walls = false;
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

export class DetectionModeBlindSightPF extends DetectionModeBlindSensePF {
  static ID = "blindSight";
  static LABEL = "PF1.SenseBS";
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

export class DetectionModeTremorPF extends DetectionModeTremor {
  static ID = "feelTremor";
  static LABEL = "DETECTION.FeelTremor";
  static DETECTION_TYPE = DetectionMode.DETECTION_TYPES.MOVE;
  static PRIORITY = 201000;
}
