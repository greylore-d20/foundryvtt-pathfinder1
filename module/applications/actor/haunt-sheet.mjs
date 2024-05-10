import { ActorSheetPF } from "./actor-sheet.mjs";
import { CR } from "../../utils/lib.mjs";

/**
 * An Actor sheet for Vehicle type characters in the game system.
 * Extends the base ActorSheetPF class.
 *
 * @type {ActorSheetPF}
 */
export class ActorSheetPFHaunt extends ActorSheetPF {
  /**
   * Define default rendering options for the NPC sheet
   *
   * @returns {object}
   */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "haunt"],
      width: 820,
      height: 700,
      tabs: [{ navSelector: "nav.tabs", contentSelector: "section.primary-body", initial: "summary" }],
      scrollY: [".tab.summary"],
    };
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Get the correct HTML template path to use for rendering this particular sheet
   *
   * @type {string}
   */
  get template() {
    if (this.actor.limited) return "systems/pf1/templates/actors/limited-sheet.hbs";
    return "systems/pf1/templates/actors/haunt-sheet.hbs";
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  async getData() {
    const isOwner = this.document.isOwner;
    const data = {
      owner: isOwner,
      limited: this.document.limited,
      editable: this.isEditable,
      cssClass: isOwner ? "editable" : "locked",
      config: pf1.config,
      isGM: game.user.isGM,
      system: this.document.system,
      hasHD: false,
    };

    // Challenge Rating
    data.labels = {
      cr: CR.fromNumber(data.system.details.cr.total),
    };

    // Reset experience value
    let newXP = 0;
    try {
      const crTotal = data.system.details?.cr?.total || 0;
      newXP = this.getCRExp(crTotal);
    } catch (e) {
      newXP = this.getCRExp(1);
    }
    data.system.details.xp = { value: newXP };

    data.notesHTML = await TextEditor.enrichHTML(data.system.details.notes?.value ?? "", {
      secrets: isOwner,
      rollData: data.rollData,
      async: true,
      relativeTo: this.actor,
    });

    // The Actor and its Items
    data.actor = this.actor;
    data.token = this.token;
    data.items = this.document.items
      .map((item) => this._prepareItem(item))
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));

    // Prepare owned items
    this._prepareItems(data);

    return data;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Organize and classify Owned Items - We just need attacks
   *
   * @param data
   * @private
   * @override
   */
  _prepareItems(data) {
    const [attacks] = data.items.reduce(
      (arr, item) => {
        item.img = item.img || Item.implementation.getDefaultArtwork(item);
        item.hasUses = item.uses && item.uses.max > 0;
        item.isCharged = ["day", "week", "charges"].includes(foundry.utils.getProperty(item, "uses.per"));

        const itemCharges =
          foundry.utils.getProperty(item, "uses.value") != null ? foundry.utils.getProperty(item, "uses.value") : 1;

        if (item.type === "attack") arr[0].push(item);
        return arr;
      },
      [[]]
    );

    const attackSections = {
      all: {
        label: game.i18n.localize("PF1.ActionPlural"),
        items: [],
        canCreate: true,
        initial: true,
        showTypes: true,
        dataset: { type: "attack", "sub-type": "weapon" },
      },
    };

    for (const a of attacks) {
      attackSections.all.items.push(a);
    }

    data.attacks = attackSections;
  }

  /**
   * Return the amount of experience granted by killing a creature of a certain CR.
   *
   * @param cr {null | number}     The creature's challenge rating
   * @returns {number}       The amount of experience granted per kill
   */
  getCRExp(cr) {
    if (cr < 1.0) return Math.max(400 * cr, 0);
    return pf1.config.CR_EXP_LEVELS[cr];
  }
}
