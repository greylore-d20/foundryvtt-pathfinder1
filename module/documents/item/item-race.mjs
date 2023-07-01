import { ItemPF } from "./item-pf.mjs";

export class ItemRacePF extends ItemPF {
  /**
   * @override
   * @param {object} data
   * @param {object} context
   * @param {User} user
   */
  async _preCreate(data, context, user) {
    await super._preCreate(data, context, user);

    const actor = this.actor;

    // Overwrite race
    if (actor) {
      const oldRace = actor.items.find((o) => o.type === "race" && o !== this);
      if (oldRace) {
        await oldRace.delete();

        const context = {};
        // Ensure actor size is updated to match the race, but only if it's same as old race
        const actorSize = actor.system.traits.size;
        if (actorSize !== this.system.size && oldRace.system.size === actorSize) context._pf1SizeChanged = true;
      }
    }
  }

  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    const actor = this.actor;
    if (actor?.type === "basic") return;

    // Track size change
    const newSize = changed.system?.size;
    if (actor && newSize !== undefined) {
      const oldSize = actor.system.traits?.size;
      if (this.system.size === oldSize && newSize !== oldSize) {
        context._pf1SizeChanged = true;
      }
    }
  }

  /**
   * @override
   * @param {object} data
   * @param {object} context
   * @param {string} userId
   */
  _onUpdate(data, context, userId) {
    super._onUpdate(data, context, userId);

    const actor = this.actor;
    // Change actor size if the old size is same as old race size.
    if (actor && context._pf1SizeChanged && game.user.id === userId) {
      actor.update({ "system.traits.size": this.system.size });
    }
  }

  /**
   * @override
   * @param {object} context
   * @param {string} userId
   */
  _onDelete(context, userId) {
    super._onDelete(context, userId);

    if (this.actor?.race === this) this.actor.race = null;
  }

  /**
   * @override
   */
  prepareBaseData() {
    super.prepareBaseData();
    const actor = this.actor;
    // Self-register on actor
    if (actor) actor.race = this;
  }

  /**
   * @remarks This item type can not be recharged.
   * @override
   */
  recharge() {
    return;
  }
}
