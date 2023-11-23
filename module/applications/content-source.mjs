export class ContentSourceEditor extends DocumentSheet {
  get title() {
    return game.i18n.format("PF1.ContentSource.Title", { name: this.object.name });
  }

  get template() {
    return "systems/pf1/templates/apps/content-source.hbs";
  }

  getData() {
    return {
      system: this.object.system,
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
    let empty = true;
    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === "") {
        source[`-=${key}`] = null;
        delete source[key];
      } else empty = false;
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
