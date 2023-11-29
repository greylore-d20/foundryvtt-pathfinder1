export class ContentSourceEditor extends DocumentSheet {
  get title() {
    return game.i18n.format("PF1.ContentSource.Title", { name: this.document.name });
  }

  get template() {
    return "systems/pf1/templates/apps/content-source.hbs";
  }

  getRegistry() {
    return pf1.registry.sources.get(this.document.system.source?.id);
  }

  getData() {
    return {
      system: this.document.system,
      registry: this.getRegistry(),
      sources: pf1.registry.sources,
      uuid: this.document.uuid,
    };
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      width: 540,
      submitOnChange: true,
      submitOnClose: true,
      closeOnSubmit: false,
      sheetConfig: false,
      classes: [...options.classes, "pf1", "content-source-editor"],
    };
  }

  _updateObject(event, updateData) {
    updateData = foundry.utils.expandObject(updateData);
    const source = updateData.system.source;

    const registry = this.getRegistry();

    // Remove empty data
    let empty = true;
    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === "") {
        source[`-=${key}`] = null;
        delete source[key];
      } else empty = false;
    }

    // Empty data that is auto-filled from registry
    if (registry) {
      source["-=title"] = null;
      if (source.publisher === "Paizo") {
        source["-=publisher"] = null;
      }
    }

    if (empty) {
      updateData.system[`-=source`] = null;
      delete updateData.system.source;
    }

    return this.object.update(updateData);
  }

  /**
   * Open editor application for defined document.
   *
   * @param {Actor|Item} document Item or Actor reference
   * @returns {ContentSourceEditor} Reference to opened application.
   */
  static open(document) {
    const app =
      Object.values(ui.windows).find((app) => app instanceof this && app.object === document) ?? new this(document);
    app.render(true, { focus: true });
    return app;
  }
}
