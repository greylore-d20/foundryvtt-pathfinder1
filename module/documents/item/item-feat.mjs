import { ItemPF } from "./item-pf.mjs";

export class ItemFeatPF extends ItemPF {
  /**
   * @internal
   * @override
   * @param {object} context
   * @param {User} userId
   */
  _onDelete(context, userId) {
    super._onDelete(context, userId);

    if (game.users.get(userId)?.isSelf) {
      if (this.isActive) {
        this.executeScriptCalls("toggle", { state: false });
      }
    }
  }

  /**
   * @inheritDoc
   */
  async setActive(active, context) {
    return this.update({ "system.disabled": !active }, context);
  }

  /**
   * @inheritDoc
   */
  get isActive() {
    return this.system.disabled !== true;
  }

  /** @inheritDoc */
  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });
    const { subType, abilityType } = this.system;

    labels.subType = pf1.config.featTypes[subType];
    labels.featType = pf1.config.featTypes[subType];

    labels.abilityType = pf1.config.abilityTypes[this.system.abilityType]?.short;
    labels.traitType = pf1.config.traitTypes[this.system.traitType];

    // Ability type
    if (abilityType && abilityType !== "none") {
      labels.abilityType = pf1.config.abilityTypes[abilityType].short;
      labels.abilityTypeLong = pf1.config.abilityTypes[abilityType].long;
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
