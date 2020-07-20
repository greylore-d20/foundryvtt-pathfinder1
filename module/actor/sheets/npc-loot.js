import { ActorSheetPFNPC } from "./npc.js";
import { createTabs } from "../../lib.js";

export class ActorSheetPFNPCLoot extends ActorSheetPFNPC {

  /**
   * Define default rendering options for the NPC sheet
   * @return {Object}
   */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      classes: ["pf1", "sheet", "actor", "npc", "loot"],
      width: 560,
      height: 420,
    });
  }
    
  get template() {
    return "systems/pf1/templates/actors/npc-sheet-loot.html";
  }

  static get name() {
    return game.i18n.localize("PF1.ActorSheetPFNPCLoot");
  }

  get currentPrimaryTab() {
    return "inventory";
  }

  async getData() {
    const data = super.getData();

    data.isLootSheet = true;
    data.sellMultiplier = this.actor.getFlag("pf1", "sellMultiplier");

    // Get total value
    const gpValue = this.calculateTotalItemValue() + this.actor.mergeCurrency();
    const sellValue = this.calculateSellItemValue() + this.actor.mergeCurrency();
    data.totalValue = {
      gp: Math.floor(gpValue),
      sp: Math.floor(gpValue*10 - Math.floor(gpValue)*10),
      cp: Math.floor(Math.floor(gpValue*100 - Math.floor(gpValue)*100) - (Math.floor(gpValue*10 - Math.floor(gpValue)*10)*10)),
    };
    data.sellValue = {
      gp: Math.floor(sellValue),
      sp: Math.floor(sellValue*10 - Math.floor(sellValue)*10),
      cp: Math.floor(Math.floor(sellValue*100 - Math.floor(sellValue)*100) - (Math.floor(sellValue*10 - Math.floor(sellValue)*10)*10)),
    };
    
    // Set labels
    if (!data.labels) data.labels = {};
    data.labels.totalValue = game.i18n.localize("PF1.ItemContainerTotalValue").format(data.totalValue.gp, data.totalValue.sp, data.totalValue.cp);
    data.labels.sellValue = game.i18n.localize("PF1.ItemContainerSellValue").format(data.sellValue.gp, data.sellValue.sp, data.sellValue.cp);

    // Alter inventory columns
    for (let inv of data.inventory) {
      inv.hasActions = false;
      inv.canEquip = false;
      inv.showValue = true;
    }

    return data;
  }

  calculateTotalItemValue() {
    const items = this.actor.items.filter(o => o.data.data.price != null);
    return Math.floor(items.reduce((cur, i) => {
      return cur + (i.data.data.price * i.data.data.quantity);
    }, 0) * 100) / 100;
  }

  calculateSellItemValue() {
    const items = this.actor.items.filter(o => o.data.data.price != null);
    const sellMultiplier = this.actor.getFlag("pf1", "sellMultiplier") || 0.5;
    return Math.floor(items.reduce((cur, i) => {
      if (i.data.type === "loot" && i.data.data.subType === "tradeGoods") return cur + (i.data.data.price * i.data.data.quantity);
      return cur + (i.data.data.price * i.data.data.quantity) * sellMultiplier;
    }, 0) * 100) / 100;
  }

  createTabs(html) {
    const tabGroups = {
      "inventory": {},
    };
    createTabs.call(this, html, tabGroups);
  }
}