import { ActorSheetPFNPC } from "./npc-sheet.mjs";

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

  /** @type {CoinType} */
  get itemValueDenomination() {
    return "gp";
  }

  async getData() {
    const data = await super.getData();

    data.isLootSheet = true;
    data.sellMultiplier = this.actor.getFlag("pf1", "sellMultiplier");

    const baseCurrency = this.actor.getTotalCurrency({ inLowestDenomination: true });

    // Get total value
    const cpValue = this.calculateTotalItemValue({ inLowestDenomination: true, recursive: true }) + baseCurrency;
    const cpSellValue = this.calculateSellItemValue({ inLowestDenomination: true, recursive: true }) + baseCurrency;

    data.totalValue = pf1.utils.currency.split(cpValue);
    data.sellValue = pf1.utils.currency.split(cpSellValue);

    // Set labels
    if (!data.labels) data.labels = {};
    data.labels.totalValue = game.i18n.format("PF1.Containers.TotalValue", data.totalValue);
    data.labels.sellValue = game.i18n.format("PF1.Containers.SellValue", data.sellValue);

    // Alter inventory columns
    for (const inv of Object.values(data.inventory)) {
      inv.hasActions = false;
      inv.canEquip = false;
      inv.showValue = true;
    }

    data.labels.currency = `PF1.Currency.Inline.${this.itemValueDenomination}`;

    return data;
  }
}
