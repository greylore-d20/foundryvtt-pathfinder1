import { ItemPF } from "../entity.js";
import { PF1 } from "../../config.js";

export class ItemFeatPF extends ItemPF {
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

  /** @inheritdoc */
  getLabels() {
    const labels = super.getLabels();
    const { featType, abilityType } = this.data.data;

    labels.featType = PF1.featTypes[featType];

    // Ability type
    if (abilityType && abilityType !== "none") {
      labels.abilityType = PF1.abilityTypes[abilityType].short;
    } else if (labels.abilityType) {
      delete labels.abilityType;
    }

    return labels;
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
