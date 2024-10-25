const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * An application that allows a user to configure an actors senses.
 *
 * @augments {DocumentSheetV2&HandlebarsApplicationMixin}
 * @param {ActorPF} actor     The Actor instance for which to configure senses
 */
export class SensesSelector extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: SensesSelector._save,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    classes: ["pf1-v2", "senses-selector"],
    window: {
      minimizable: false,
      resizable: false,
    },
    position: {
      width: 375,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/senses-selector.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  /* -------------------------------------------- */

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
      tr: "distance",
    };
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const actor = this.document;

    const senses = actor.toObject().system.traits?.senses ?? {};
    for (const [key, type] of Object.entries(this.constructor.convertKeys)) {
      const value = senses[key];
      if (type === "distance" && value.value > 0) {
        senses[key].value = pf1.utils.convertDistance(value.value)[0];
      }
    }

    const isMetric = pf1.utils.getDistanceSystem() !== "imperial";

    return {
      actor: this.actor,
      noSystemVision:
        !game.settings.get("pf1", "systemVision") ||
        (actor.token?.getFlag("pf1", "customVisionRules") ??
          actor.prototypeToken?.getFlag("pf1", "customVisionRules")) ||
        false,
      senses,
      isMetric,
      gridUnits: isMetric ? game.i18n.localize("PF1.Distance.mShort") : game.i18n.localize("PF1.Distance.ftShort"),
      buttons: [{ type: "submit", label: "PF1.Save", icon: "far fa-save" }],
    };
  }

  /* -------------------------------------------- */

  /**
   * Alias the document property to actor
   *
   * @type {ActorPF}
   */
  get actor() {
    return this.document;
  }

  /* -------------------------------------------- */

  /**
   * Configure the title of the vision configuration window to include the Actor name
   *
   * @type {string}
   */
  get title() {
    return `${game.i18n.localize("PF1.Senses")}: ${this.document.name}`;
  }

  /* -------------------------------------------- */

  /**
   * Save the new vision details for the actor.
   *
   * @internal
   * @this {DocumentSheetV2&ActorRestDialog}
   * @param {SubmitEvent} event                The originating form submission event
   * @param {HTMLFormElement} form             The form element that was submitted
   * @param {FormDataExtended} formData        Processed data for the submitted form
   * @param {object} formData.object           The parsed form data object
   * @returns {Promise<void>}
   */
  static async _save(event, form, formData) {
    formData = foundry.utils.expandObject(formData.object);
    const senses = formData.system.traits.senses;

    // Convert data back
    Object.entries(this.constructor.convertKeys).forEach(([key, type]) => {
      const value = senses[key];
      if (value.value > 0 && type === "distance") {
        senses[key].value = pf1.utils.convertDistanceBack(value.value)[0];
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

    this.document.update({ "system.traits.senses": senses });
  }
}
