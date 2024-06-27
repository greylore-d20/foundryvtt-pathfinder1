import { ItemPhysicalPF } from "./item-physical.mjs";

/**
 * Implant item
 *
 * Cybernetics, magic tattoos, necrografts, demonic implants, piercings, etc.
 */
export class ItemImplantPF extends ItemPhysicalPF {
  /** @override */
  _onCreate(data, context, userId) {
    super._onCreate(data, context, userId);

    // Simulate equipping items    {
    if (this.system.implanted === true) {
      this.executeScriptCalls("implant", { implanted: true });
    }
  }

  /**
   * @internal
   * @override
   * @param {object} context
   * @param {string} userId
   */
  _onDelete(context, userId) {
    super._onDelete(context, userId);

    if (game.users.get(userId)?.isSelf) {
      if (this.system.implanted === true) {
        this.executeScriptCalls("implant", { implanted: false });
      }
    }
  }

  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {string} userId
   */
  _onUpdate(changed, context, userId) {
    super._onUpdate(changed, context, userId);

    // Call 'implant' script calls
    const implanted = changed.system?.implanted;
    if (implanted != null) {
      this.executeScriptCalls("implant", { implanted });
    }
  }

  /** @inheritDoc */
  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });

    labels.subType = pf1.config.implantTypes[this.subType];

    switch (this.subType) {
      case "cybertech":
        labels.slot = pf1.config.implantSlots.cybertech[this.system.slot] ?? pf1.config.implantSlots.cybertech.none;
        break;
    }

    const checkYes = '<i class="fas fa-check"></i>';
    const checkNo = '<i class="fas fa-times"></i>';
    labels.equipped = this.system.implanted ? checkYes : checkNo;

    return labels;
  }

  /** @inheritDoc */
  adjustContained() {
    // Everything in containers count as carried
    this.system.carried = true;

    // Auto-unimplant
    this.system.implanted = false;
  }

  /** @inheritDoc */
  prepareWeight() {
    super.prepareWeight();

    // Implanted items weigh nothing
    const itemData = this.system;
    const weight = itemData.weight;
    if (itemData.implanted) {
      weight.total = 0;
      weight.converted.total = 0;

      // If there's more than 1 in stack, restore part of the weight
      if (itemData.quantity > 1) {
        // Partial duplication from base physical item
        const baseWeight = weight.value * this.getWeightMultiplier();
        weight.total = baseWeight * (itemData.quantity - 1);
        weight.converted.total = pf1.utils.convertWeight(weight.total);
      }
    }
  }

  /** @inheritDoc */
  get isActive() {
    if (this.system.quantity <= 0) return false;
    if (this.subType === "cybertech" && this.system.disabled) return false;
    return this.system.implanted || false;
  }

  /**
   * Determines if the item implanted.
   *
   * @inheritDoc
   */
  get activeState() {
    return this.system.implanted || false;
  }

  /** @inheritDoc */
  async setActive(active, context) {
    return this.update({ "system.implanted": active }, context);
  }
}
