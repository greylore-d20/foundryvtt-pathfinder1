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
    const attackSections = Object.values(pf1.config.sheetSections.combatlite)
      .map((data) => ({ ...data }))
      .sort((a, b) => a.sort - b.sort);
    for (const i of data.items) {
      const section = attackSections.find((section) => this._applySectionFilter(i, section));
      if (section) {
        section.items ??= [];
        section.items.push(i);
      } else {
        console.warn("Could not find a sheet section for", i.name);
      }
    }

    data.attacks = attackSections;
  }
}
