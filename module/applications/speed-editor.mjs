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
      units: game.i18n.localize(
        pf1.utils.getDistanceSystem() === "imperial" ? "PF1.Distance.ftShort" : "PF1.Distance.mShort"
      ),
      flyManeuverability: {
        clumsy: "PF1.Movement.FlyManeuverability.Quality.clumsy",
        poor: "PF1.Movement.FlyManeuverability.Quality.poor",
        average: "PF1.Movement.FlyManeuverability.Quality.average",
        good: "PF1.Movement.FlyManeuverability.Quality.good",
        perfect: "PF1.Movement.FlyManeuverability.Quality.perfect",
      },
    };

    this.constructor.movementKeys.forEach((key) => {
      let value = itemData.speeds?.[key];
      if (value > 0) value = pf1.utils.convertDistance(value)[0];
      context.speeds[key] = value;
    });

    context.speeds.flyManeuverability = itemData.speeds.flyManeuverability || "average";

    return context;
  }

  async _updateObject(event, formData) {
    // Convert data back
    for (const [key, value] of Object.entries(formData)) {
      if (Number.isNumeric(value)) {
        formData[key] = pf1.utils.convertDistanceBack(value)[0];
      }
    }

    return super._updateObject(event, formData);
  }
}
