import { ActorSheetPFNPC } from "./npc-sheet.mjs";
import { CR } from "@utils/lib.mjs";

/**
 * An Actor sheet for Vehicle type characters in the game system.
 * Extends the base ActorSheetPF class.
 *
 * @type {ActorSheetPF}
 */
export class ActorSheetPFTrap extends ActorSheetPFNPC {
  /**
   * Define default rendering options for the NPC sheet
   *
   * @returns {object}
   */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "trap"],
      width: 500,
      height: 560,
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
    return "systems/pf1/templates/actors/trap-sheet.hbs";
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

    const notes = data.system.details?.notes?.value ?? "";
    data.notesHTML = notes
      ? await TextEditor.enrichHTML(notes, {
          secrets: isOwner,
          rollData: data.rollData,
          async: true,
          relativeTo: this.actor,
        })
      : null;

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
   * @param context
   * @private
   * @override
   */
  _prepareItems(context) {
    const attacks = context.items.filter((i) => i.type === "attack");

    const attackSections = Object.values(pf1.config.sheetSections.combatlite)
      .map((data) => ({ ...data }))
      .sort((a, b) => a.sort - b.sort);
    for (const i of attacks) {
      const section = attackSections.find((section) => this._applySectionFilter(i, section));
      if (section) {
        section.items ??= [];
        section.items.push(i);
      } else {
        console.warn("Could not find a sheet section for", i.name);
      }
    }

    context.attacks = attackSections;
  }
}
