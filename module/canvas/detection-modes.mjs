export class DetectionModeInvisibilityPF extends DetectionModeInvisibility {
  static ID = "seeInvisibility";
  static LABEL = "DETECTION.SeeInvisibility";

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
