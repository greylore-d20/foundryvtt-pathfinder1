import { ItemPF } from "./item-pf.mjs";
import { PF1 } from "@config";

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
    return this.update({ "system.disabled": !active }, context);
  }

  get isActive() {
    return !this.system.disabled;
  }

  /** @inheritDoc */
  getLabels({ actionId } = {}) {
    const labels = super.getLabels({ actionId });
    const { subType, abilityType } = this.system;

    labels.featType = PF1.featTypes[subType];
    labels.abilityType = CONFIG.PF1.abilityTypes[this.system.abilityType]?.short;
    labels.traitType = CONFIG.PF1.traitTypes[this.system.traitType];

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
