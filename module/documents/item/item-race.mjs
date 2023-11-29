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
   * @param {object} data Creation data
   * @param {object} context Create context
   * @param {string} userId User ID
   */
  _onCreate(data, context, userId) {
    super._onCreate(data, context, userId);

    if (game.user.id !== userId) return;

    // Update owning actor speed to match racial speed.
    // TODO: Make this derived data on the actor instead, eliminating the update.
    if (this.actor) {
      const speedUpdates = {};
      for (const [key, value] of Object.entries(this.system.speeds ?? {})) {
        speedUpdates[key] = { base: value };
      }
      this.actor.update({ "system.attributes.speed": speedUpdates });
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

    // Reset race reference
    const actor = this.actor;
    if (actor?.race === this) {
      actor.race = null;

      if (game.user.id === userId) {
        actor.update({
          "system.attributes.speed": {
            "land.base": 30,
            "fly.base": 0,
            "swim.base": 0,
            "climb.base": 0,
            "burrow.base": 0,
          },
        });
      }
    }
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
