import { getDistanceSystem } from "@utils";

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
      "system.traits.senses.dv": "distance",
      "system.traits.senses.ts": "distance",
      "system.traits.senses.bse": "distance",
      "system.traits.senses.bs": "distance",
    };
  }

  async getData() {
    const data = {
      system: this.document.system,
      converted: Object.entries(this.convertKeys).reduce((cur, [path, type]) => {
        if (type === "distance") setProperty(cur, path, pf1.utils.convertDistance(getProperty(this.document, path))[0]);
        return cur;
      }, {}),
      gridUnits: getDistanceSystem() === "imperial" ? "ft" : "m",
    };
    return data;
  }

  async _updateObject(event, formData) {
    // Convert data back
    Object.entries(this.convertKeys).forEach((o) => {
      if (o[1] === "distance") formData[o[0]] = pf1.utils.convertDistanceBack(formData[o[0]])[0];
    });

    // Update document
    const result = await super._updateObject(event, formData);

    return result;
  }
}
