import { getDistanceSystem } from "@utils";

export class SpeedEditor extends DocumentSheet {
  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      classes: ["pf1", "speed-editor"],
      template: "systems/pf1/templates/apps/speed-editor.hbs",
      width: 320,
      submitOnChange: true,
      submitOnClose: true,
      closeOnSubmit: false,
    };
  }

  get id() {
    return `${this.object.uuid}-movement-editor`;
  }

  get title() {
    const actor = this.document.actor;
    let title = `${game.i18n.localize("PF1.Movement.Label")}: ${this.document.name}`;
    if (actor) title += ` — ${actor.name}`;
    return title;
  }

  static get movementKeys() {
    return ["land", "swim", "fly", "climb", "burrow"];
  }

  async getData() {
    const itemData = this.document.system;
    const context = {
      system: itemData,
      speeds: {},
      units: game.i18n.localize(getDistanceSystem() === "imperial" ? "PF1.DistFtShort" : "PF1.DistMShort"),
    };

    this.constructor.movementKeys.forEach((key) => {
      let value = itemData.speeds?.[key];
      if (value > 0) value = pf1.utils.convertDistance(value)[0];
      context.speeds[key] = value;
    });

    return context;
  }

  async _updateObject(event, formData) {
    // Convert data back
    for (const [key, value] of Object.entries(formData)) {
      formData[key] = pf1.utils.convertDistanceBack(value)[0];
    }

    return super._updateObject(event, formData);
  }
}
