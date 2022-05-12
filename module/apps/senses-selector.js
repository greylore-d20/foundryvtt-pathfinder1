export class SensesSelector extends DocumentSheet {
  static get defaultOptions() {
    const options = super.defaultOptions;
    return mergeObject(options, {
      classes: ["pf1", "senses-selector"],
      template: "systems/pf1/templates/apps/senses-selector.hbs",
      width: 500,
      closeOnSubmit: true,
    });
  }

  /* -------------------------------------------- */

  /**
   * Configure the title of the special traits selection window to include the Actor name
   *
   * @type {string}
   */
  get title() {
    return `${game.i18n.localize("PF1.Senses")}: ${this.object.name}`;
  }

  /**
   * Returns which keys to convert in distance or weight
   */
  get convertKeys() {
    return {
      "data.traits.senses.dv": "distance",
      "data.traits.senses.ts": "distance",
      "data.traits.senses.bse": "distance",
      "data.traits.senses.bs": "distance",
    };
  }

  async getData() {
    const data = {
      data: this.document.data,
      converted: Object.entries(this.convertKeys).reduce((cur, o) => {
        if (o[1] === "distance")
          setProperty(cur, o[0], game.pf1.utils.convertDistance(getProperty(this.document.data, o[0]))[0]);
        return cur;
      }, {}),
      gridUnits: game.settings.get("pf1", "units") === "imperial" ? "ft" : "m",
    };
    return data;
  }

  async _updateObject(event, formData) {
    // Convert data back
    Object.entries(this.convertKeys).forEach((o) => {
      if (o[1] === "distance") formData[o[0]] = game.pf1.utils.convertDistanceBack(formData[o[0]])[0];
    });

    // Update document
    const result = await super._updateObject(event, formData);

    // Refresh canvas perception
    canvas.perception.schedule({
      lighting: { initialize: true, refresh: true },
      sight: { initialize: true, refresh: true },
    });
    game.socket.emit("system.pf1", { eventType: "redrawCanvas" });

    return result;
  }
}
