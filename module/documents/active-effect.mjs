export class ActiveEffectPF extends ActiveEffect {
  /**
   * @override
   * @param {object} data - Creation data
   * @param {object} context - Context
   * @param {string} userId
   */
  _onCreate(data, context, userId) {
    super._onCreate(data, context, userId);

    if (userId !== game.user.id) return;

    const actor = this.actor;
    if (!actor) return;

    const statuses = this.statuses;
    if (statuses.size) {
      const condData = {};
      for (const statusId of statuses) {
        if (statusId in pf1.config.conditions) {
          condData[statusId] = true;
        }
      }
      if (!foundry.utils.isEmpty(condData)) {
        actor.update({ "system.attributes.conditions": condData });
      }
    }

    // Enable related item if it exists
    const origin = this.origin;
    if (origin) {
      const re = /Item\.(?<itemId>\w{16})/.exec(origin);
      const item = actor?.items.get(re?.groups.itemId);
      if (item && !item.isActive) item.setActive(true);
    }
  }

  /**
   * @override
   * @param {object} context - Delete context
   * @param {string} userId
   */
  _onDelete(context, userId) {
    super._onDelete(context, userId);

    if (userId !== game.user.id) return;

    const actor = this.actor;
    if (!actor) return;

    const statuses = this.statuses;
    if (statuses.size) {
      // BUG: This will fail if multiple AEs provide same condition
      const condData = {};
      for (const statusId of statuses) {
        if (statusId in pf1.config.conditions) {
          // TODO: v11, check if actor.statuses still has the effect
          condData[statusId] = false;
        }
      }

      if (!foundry.utils.isEmpty(condData)) {
        actor.update({ "system.attributes.conditions": condData }, context);
      }
    }

    // Disable associated buff if found
    const re = this.origin?.match(/Item\.(?<itemId>\w+)/),
      origin = re?.groups.itemId;
    if (origin) {
      const item = actor.items.get(origin);
      // Avoid looping
      if (context.pf1?.delete !== item?.uuid && item?.isActive) {
        item.setActive(false, context);
      }
    }
  }

  /**
   * @type {Actor|null} Parent actor or null.
   */
  get actor() {
    const parent = this.parent;
    if (parent instanceof Actor) return parent;
    return null;
  }

  get isTemporary() {
    const duration = this.duration.seconds ?? (this.duration.rounds || this.duration.turns) ?? 0;
    return duration > 0 || this.statuses.size || this.getFlag("pf1", "show") || false;
  }
}
