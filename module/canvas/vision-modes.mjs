export const darkvision = (() => {
  const data = CONFIG.Canvas.visionModes.darkvision.toObject();
  delete data.lighting.levels[VisionMode.LIGHTING_LEVELS.DIM];
  return new VisionMode(data);
})();
