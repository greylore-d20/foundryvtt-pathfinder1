const darkVisionShader = CONFIG.Canvas.visionModes.darkvision.shader;

export const darkvision = new VisionMode({
  id: "darkvision",
  label: "VISION.ModeDarkvision",
  canvas: {
    shader: darkVisionShader,
    uniforms: { contrast: 0, saturation: -1.0, brightness: 0 },
  },
  lighting: {
    //levels: {[VisionMode.LIGHTING_LEVELS.DIM]: VisionMode.LIGHTING_LEVELS.BRIGHT}, // Foundry sets dim to bright by default
    background: { visibility: VisionMode.LIGHTING_VISIBILITY.REQUIRED },
  },
  vision: {
    darkness: { adaptive: false },
    defaults: { attenuation: 0, contrast: 0, saturation: -1.0, brightness: 0 },
  },
});
