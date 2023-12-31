/**
 * Rules accurate darkvision override.
 *
 * @remarks
 * Compared to example implementation, this does not turn dim light into bright.
 */
export const darkvision = (() => {
  const data = CONFIG.Canvas.visionModes.darkvision.toObject();
  delete data.lighting.levels[VisionMode.LIGHTING_LEVELS.DIM];
  return new VisionMode(data);
})();
