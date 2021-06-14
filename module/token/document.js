export class TokenDocumentPF extends TokenDocument {
  async update(data, options) {
    // Resize token with actor size change
    const sizeKey = getProperty(data, "actorData.data.traits.size");
    if (sizeKey) {
      const size = CONFIG.PF1.tokenSizes[sizeKey];
      setProperty(data, "width", size.w);
      setProperty(data, "height", size.h);
      setProperty(data, "scale", size.scale);
    }

    return super.update(data, options);
  }
}
