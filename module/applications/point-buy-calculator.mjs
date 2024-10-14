const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * An application offering the user an interface to use the point-buy rules
 * described in the Pathfinder CRB to determine their characters ability
 * scores.
 *
 * @augments {DocumentSheetV2&HandlebarsApplicationMixin}
 * @property {number} min                       The minimum value an ability score can be set to.
 * @property {number} max                       The maximum value an ability score can be set to.
 * @property {{key: string, name: string, value: number}[]} abilities  The actors current ability scores.
 * @property {number} spentPoints               The number of points spent on ability scores.
 * @property {ActorPF} actor                    The actor for which the ability scores are being set. Alias for document.
 */
export class PointBuyCalculator extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: PointBuyCalculator._save,
      submitOnChange: false,
      submitOnClose: false,
      closeOnSubmit: true,
    },
    classes: ["pf1-v2", "pointbuy-calculator"],
    window: {
      minimizable: false,
      resizable: false,
    },
    actions: {
      control: PointBuyCalculator._onAbilityControl,
    },
    position: {
      width: 320,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/point-buy-calculator.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  constructor(options) {
    super(options);

    const ablValues = Object.keys(pf1.config.abilityCost).map((i) => Number(i));

    this.abilities = Object.entries(pf1.config.abilities).map(([k, name]) => ({
      key: k,
      name: name,
      value: this.actor.system.abilities[k]?.value ?? 10,
    }));
    this.min = Math.min(...ablValues);
    this.max = Math.max(...ablValues);
  }

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const usedPoints = this.spentPoints;

    const pointBuy = pf1.config.pointBuy;
    const limitsArr = Object.entries(pointBuy).map(([key, ldata]) => ({ ...ldata, key }));
    limitsArr.sort((a, b) => a.points - b.points);

    // Find most relevant category
    let closest = limitsArr[0].key;
    for (const l of limitsArr) {
      const prev = pointBuy[closest].points;
      if (prev < usedPoints) closest = l.key;
    }

    return {
      min: this.min,
      max: this.max,
      abilities: this.abilities,
      points: usedPoints,
      limits: limitsArr,
      closest,
      invalidPoints: pointBuy[closest].points !== usedPoints,
      buttons: [{ type: "submit", label: "PF1.Confirm", icon: "far fa-save" }],
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
   * Configure the title of the point buy calculator window to include the actors name.
   *
   * @override
   * @type {string}
   */
  get title() {
    return `${game.i18n.localize("PF1.Application.PointBuy.Title")}: ${this.actor.name}`;
  }

  /* -------------------------------------------- */

  /**
   * Get the number of points spent on ability scores.
   *
   * @type {number}
   */
  get spentPoints() {
    let result = 0;

    for (const a of this.abilities) {
      result += pf1.config.abilityCost[a.value];
    }

    return result;
  }

  /* -------------------------------------------- */

  /**
   * Update ability score value display and remaining points on
   * subtract/add operations.
   *
   * @param event
   * @param target
   * @static
   * @internal
   * @this {PointBuyCalculator&DocumentSheetV2}
   * @returns {Promise<void>}
   */
  static async _onAbilityControl(event, target) {
    event.preventDefault();
    const ablKey = target.closest(".ability").dataset.ability;
    const abl = this.abilities.find((o) => o.key === ablKey);

    if (target.classList.contains("add")) {
      abl.value = Math.min(this.max, abl.value + 1);
    } else if (target.classList.contains("subtract")) {
      abl.value = Math.max(this.min, abl.value - 1);
    }
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Update the actors ability scores based on the current input values.
   *
   * @static
   * @internal
   * @this {PointBuyCalculator&DocumentSheetV2}
   * @returns {Promise<void>}
   */
  static async _save() {
    const updateData = {};
    for (const a of this.abilities) {
      updateData[`system.abilities.${a.key}.value`] = a.value;
    }
    await this.actor.update(updateData);
  }
}
