import { getDistanceSystem } from "@utils";

export class SensesSelector extends DocumentSheet {
  static get defaultOptions() {
    const options = super.defaultOptions;
    return foundry.utils.mergeObject(options, {
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
  static get convertKeys() {
    return {
      dv: "distance",
      ts: "distance",
      bse: "distance",
      bs: "distance",
      sc: "distance",
    };
  }

  async getData() {
    const actor = this.document;

    const senses = foundry.utils.deepClone(actor.system.traits?.senses ?? {});
    for (const [key, type] of Object.entries(this.constructor.convertKeys)) {
      const value = senses[key];
      if (type === "distance" && value > 0) {
        senses[key] = pf1.utils.convertDistance(value)[0];
      }
    }

    return {
      noSystemVision:
        !game.settings.get("pf1", "systemVision") ||
        (actor.token?.getFlag("pf1", "customVisionRules") ??
          actor.prototypeToken?.getFlag("pf1", "customVisionRules")) ||
        false,
      senses,
      gridUnits:
        getDistanceSystem() === "imperial"
          ? game.i18n.localize("PF1.Distance.ftShort")
          : game.i18n.localize("PF1.Distance.mShort"),
    };
  }

  async _updateObject(event, formData) {
    formData = foundry.utils.expandObject(formData);
    const senses = formData.system.traits.senses;

    // Convert data back
    Object.entries(this.constructor.convertKeys).forEach(([key, type]) => {
      const value = senses[key];
      if (value > 0 && type === "distance") {
        senses[key] = pf1.utils.convertDistanceBack(value)[0];
      }
    });

    // Delete undefined or disabled senses
    // But only for linked actor since otherwise you can not override them to be disabled
    if (!this.document.isToken) {
      for (const [key, value] of Object.entries(senses)) {
        if (!value) {
          delete senses[key];
          senses[`-=${key}`] = null;
        }
      }
    }

    // Update document
    return super._updateObject(event, formData);
  }
}
