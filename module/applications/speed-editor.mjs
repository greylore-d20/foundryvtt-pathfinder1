const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * An application that renders the movement speed configuration of an item
 *
 * @augments {DocumentSheetV2&HandlebarsApplicationMixin}
 * @param {ActorPF} actor     The Actor instance for which to configure resting
 */
export class SpeedEditor extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: SpeedEditor._save,
      submitOnChange: false,
      submitOnClose: false,
      closeOnSubmit: true,
    },
    classes: ["pf1-v2", "speed-editor"],
    window: {
      minimizable: false,
      resizable: false,
    },
    position: {
      width: 400,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/speed-editor.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const itemData = this.document.system;
    const speeds = {};

    this.constructor.movementKeys.forEach((key) => {
      let value = itemData.speeds?.[key];
      if (value > 0) value = pf1.utils.convertDistance(value)[0];
      speeds[key] = value;
    });

    speeds.flyManeuverability = itemData.speeds.flyManeuverability || "average";

    return {
      speeds,
      item: this.document,
      system: itemData,
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
      buttons: [{ type: "submit", label: "PF1.Save", icon: "fas fa-save" }],
    };
  }

  /* -------------------------------------------- */

  /**
   * Configure the title of the speed editor window to include document name, and optionally the actors name, if present
   *
   * @override
   * @type {string}
   */
  get title() {
    const actor = this.document.actor;
    let title = `${game.i18n.localize("PF1.Movement.Label")}: ${this.document.name}`;
    if (actor) title += ` — ${actor.name}`;
    return title;
  }

  /* -------------------------------------------- */

  /**
   * Provide a list of movement speed keys
   *
   * @type {string[]}
   */
  static get movementKeys() {
    return ["land", "swim", "fly", "climb", "burrow"];
  }

  /* -------------------------------------------- */

  /**
   * Save the movement speed data back to the item
   *
   * @internal
   * @this {DocumentSheetV2&SpeedEditor}
   * @param {SubmitEvent} event                                     The originating form submission event
   * @param {HTMLFormElement} form                                  The form element that was submitted
   * @param {FormDataExtended} formData                             Processed data for the submitted form
   * @param {{[key: string]: string|number}} formData.object        The movement speed configuration
   * @returns {Promise<void>}
   */
  static async _save(event, form, formData) {
    formData = formData.object;

    // Convert data back
    for (const [key, value] of Object.entries(formData)) {
      if (Number.isNumeric(value)) {
        formData[key] = pf1.utils.convertDistanceBack(value)[0];
      }
    }

    this.document.update(formData);
  }
}
