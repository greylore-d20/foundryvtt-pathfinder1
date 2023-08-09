import { ActorSheetPFNPC } from "./npc-sheet.mjs";
import { splitCurrency } from "../../utils/lib.mjs";

export class ActorSheetPFNPCLoot extends ActorSheetPFNPC {
  /**
   * Define default rendering options for the NPC sheet
   *
   * @returns {object}
   */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "loot"],
      tabs: [
        { navSelector: "nav.tabs", contentSelector: "section.primary-body", initial: "inventory", group: "primary" },
      ],
      width: 620,
      height: 420,
    };
  }

  get template() {
    return "systems/pf1/templates/actors/npc-sheet-loot.hbs";
  }

  get currentPrimaryTab() {
    return "inventory";
  }

  async getData() {
    const data = await super.getData();

    data.isLootSheet = true;
    data.sellMultiplier = this.actor.getFlag("pf1", "sellMultiplier");

    // Get total value
    const cpValue =
      this.calculateTotalItemValue({ inLowestDenomination: true }) +
      this.actor.mergeCurrency({ inLowestDenomination: true });
    const cpSellValue =
      this.calculateSellItemValue({ inLowestDenomination: true }) +
      this.actor.mergeCurrency({ inLowestDenomination: true });

    data.totalValue = splitCurrency(cpValue);
    data.sellValue = splitCurrency(cpSellValue);

    // Set labels
    if (!data.labels) data.labels = {};
    data.labels.totalValue = game.i18n.format("PF1.ItemContainerTotalValue", data.totalValue);
    data.labels.sellValue = game.i18n.format("PF1.ItemContainerSellValue", data.sellValue);

    // Alter inventory columns
    for (const inv of Object.values(data.inventory)) {
      inv.hasActions = false;
      inv.canEquip = false;
      inv.showValue = true;
    }

    return data;
  }
}
