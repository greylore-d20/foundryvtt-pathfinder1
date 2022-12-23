import { ItemPF } from "./item-pf.mjs";
import { PF1 } from "../../config.mjs";

export class ItemFeatPF extends ItemPF {
  async _preDelete(options, user) {
    if (user.id === game.user.id) {
      if (this.isActive) {
        this.executeScriptCalls("toggle", { state: false });
      }
    }

    return super._preDelete(options, user);
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
    return !this.system.disabled;
  }

  get subType() {
    return this.system.featType;
  }

  /** @inheritdoc */
  getLabels({ actionId } = {}) {
    const labels = super.getLabels({ actionId });
    const { featType, abilityType } = this.system;

    labels.featType = PF1.featTypes[featType];

    // Ability type
    if (abilityType && abilityType !== "none") {
      labels.abilityType = PF1.abilityTypes[abilityType].short;
    } else if (labels.abilityType) {
      delete labels.abilityType;
    }

    return labels;
  }

  /** @inheritDoc */
  getTypeChatData(data, labels, props, rollData) {
    super.getTypeChatData(data, labels, props, rollData);
    // Add ability type label
    if (labels.abilityType) {
      props.push(labels.abilityType);
    }
  }
}
