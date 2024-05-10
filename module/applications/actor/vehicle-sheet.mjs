import { ActorSheetPF } from "./actor-sheet.mjs";

/**
 * An Actor sheet for Vehicle type characters in the game system.
 * Extends the base ActorSheetPF class.
 *
 * @type {ActorSheetPF}
 */
export class ActorSheetPFVehicle extends ActorSheetPF {
  /**
   * Define default rendering options for the NPC sheet
   *
   * @returns {object}
   */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "vehicle"],
      width: 680,
      height: 680,
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
    return "systems/pf1/templates/actors/vehicle-sheet.hbs";
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
    };

    data.system = foundry.utils.deepClone(this.document.system);

    data.vehicleSizes = Object.fromEntries(
      Object.entries(pf1.config.vehicles.size).map(([key, data]) => [key, data.label])
    );

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
}
