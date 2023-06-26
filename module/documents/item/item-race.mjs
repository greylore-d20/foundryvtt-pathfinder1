import { ItemPF } from "./item-pf.mjs";

export class ItemRacePF extends ItemPF {
  async _preCreate(data, options, user) {
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

  async _preUpdate(update, context, user) {
    await super._preUpdate(update, context, user);

    const actor = this.actor;
    if (actor?.type === "basic") return;

    // Track size change
    const newSize = update.system?.size;
    if (actor && newSize !== undefined) {
      const oldSize = actor.system.traits?.size;
      if (this.system.size === oldSize && newSize !== oldSize) {
        context._pf1SizeChanged = true;
      }
    }
  }

  _onUpdate(data, context, userId) {
    super._onUpdate(data, context, userId);

    const actor = this.actor;
    // Change actor size if the old size is same as old race size.
    if (actor && context._pf1SizeChanged && game.user.id === userId) {
      actor.update({ "system.traits.size": this.system.size });
    }
  }

  _onDelete(data, context, userId) {
    super._onDelete(data, context, userId);

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
