import { ItemPF } from "../entity.js";

export class ItemFeatPF extends ItemPF {
  prepareData() {
    const itemData = super.prepareData();
    const data = itemData.data;
    const labels = this.labels;
    const C = CONFIG.PF1;

    labels.featType = C.featTypes[data.featType];

    // Ability type
    if (data.abilityType && data.abilityType !== "none") {
      labels.abilityType = C.abilityTypes[data.abilityType].short;
    } else if (labels.abilityType) {
      delete labels.abilityType;
    }
  }

  /**
   * @param {boolean} active
   * @param {object} context Optional update context
   * @returns {Promise} Update promise
   * @override
   */
  async setActive(active, context) {
    return this.update({ "data.disabled": !active }, context);
  }

  get isActive() {
    return !this.data.data.disabled;
  }

  get subType() {
    return this.data.data.featType;
  }

  getTypeChatData(data, labels, props) {
    super.getTypeChatData(data, labels, props);
    // Add ability type label
    if (this.type === "feat") {
      if (labels.abilityType) {
        props.push(labels.abilityType);
      }
    }
  }
}
