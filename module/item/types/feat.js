import { ItemPF } from "../entity.js";

export class ItemFeatPF extends ItemPF {
  get isActive() {
    return !this.data.data.disabled;
  }

  getTypeChatData(data, labels, props) {
    super.getTypeChatData(data, props);
    // Add ability type label
    if (this.type === "feat") {
      if (labels.abilityType) {
        props.push(labels.abilityType);
      }
    }
  }
}
