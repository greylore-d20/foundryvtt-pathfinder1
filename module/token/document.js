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

  // Todo: Declare this in TokenDocumentPF when/ if TokenDocument.getData calls the constructor's method
  getTrackedAttributes(data, path = []) {
    const attr = super.getTrackedAttributes(data, path);
    if (path.length === 0) attr.value.push(["attributes", "hp", "temp"], ["attributes", "hp", "nonlethal"]);
    return attr;
  }

  /**
   * Hijack Token health bar rendering to include temporary and temp-max health in the bar display
   */
  getBarAttribute(barName, { alternative = null } = {}) {
    let data;
    try {
      data = super.getBarAttribute(barName, { alternative: alternative });
    } catch (e) {
      data = null;
    }
    if (data != null && data.attribute === "attributes.hp") {
      data.value += parseInt(getProperty(this.actor.data, "data.attributes.hp.temp") || 0);
    }

    // Make resources editable
    if (data?.attribute.startsWith("resources.")) data.editable = true;

    return data;
  }
}
