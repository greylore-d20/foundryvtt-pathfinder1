import { ActorSheetPFNPC } from "./npc.js";
import { createTabs, splitCurrency } from "../../lib.js";

export class ActorSheetPFNPCLoot extends ActorSheetPFNPC {
  /**
   * Define default rendering options for the NPC sheet
   *
   * @returns {object}
   */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pf1", "sheet", "actor", "npc", "loot"],
      width: 620,
      height: 420,
    });
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
    data.labels.totalValue = game.i18n
      .localize("PF1.ItemContainerTotalValue")
      .format(data.totalValue.gp, data.totalValue.sp, data.totalValue.cp);
    data.labels.sellValue = game.i18n
      .localize("PF1.ItemContainerSellValue")
      .format(data.sellValue.gp, data.sellValue.sp, data.sellValue.cp);

    // Alter inventory columns
    for (const inv of Object.values(data.inventory)) {
      inv.hasActions = false;
      inv.canEquip = false;
      inv.showValue = true;
    }

    return data;
  }

  createTabs(html) {
    const tabGroups = {
      primary: {
        inventory: {},
      },
    };
    this._tabsAlt = createTabs.call(this, html, tabGroups, this._tabsAlt);
  }
}
