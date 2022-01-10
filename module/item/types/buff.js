import { ItemPF } from "../entity.js";

export class ItemBuffPF extends ItemPF {
  prepareDerivedItemData() {
    super.prepareDerivedItemData();
    const itemData = this.data.data;

    // Add total duration in seconds
    if (itemData.duration.value?.length) {
      let seconds = 0;
      const rollData = this.getRollData();
      const duration = RollPF.safeRoll(itemData.duration.value || "0", rollData).total;
      switch (itemData.duration.units) {
        case "hour":
          seconds = duration * 60 * 60;
          break;
        case "minute":
          seconds = duration * 60;
          break;
        case "rounds":
          seconds = duration * 6;
          break;
      }

      itemData.duration.totalSeconds = seconds;
    }
  }

  getRollData() {
    const result = super.getRollData();

    result.item.level = this.data.data.level;

    return result;
  }

  get isActive() {
    return this.data.data.active;
  }
}
