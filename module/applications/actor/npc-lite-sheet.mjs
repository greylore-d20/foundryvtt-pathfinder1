import { ActorSheetPFNPC } from "./npc-sheet.mjs";

export class ActorSheetPFNPCLite extends ActorSheetPFNPC {
  /**
   * Define default rendering options for the NPC sheet
   *
   * @returns {object}
   */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "lite"],
      width: 440,
      height: 640,
      tabs: [
        { navSelector: "nav.tabs", contentSelector: "section.primary-body", initial: "summary", group: "primary" },
      ],
    };
  }

  get template() {
    if (!game.user.isGM && this.actor.limited) return "systems/pf1/templates/actors/limited-sheet.hbs";
    return "systems/pf1/templates/actors/npc-sheet-lite.hbs";
  }

  async getData() {
    const context = await super.getData();
    context.hasHD = false;
    return context;
  }

  _prepareItems(data) {
    const attackSections = {
      all: {
        label: game.i18n.localize("PF1.ActionPlural"),
        items: data.itemTypes.attack,
        canCreate: true,
        initial: true,
        showTypes: true,
        dataset: { type: "attack", "sub-type": "weapon" },
      },
    };

    data.attacks = attackSections;
  }
}
