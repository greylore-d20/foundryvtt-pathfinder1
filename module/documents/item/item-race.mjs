import { ItemPF } from "./item-pf.mjs";

/**
 * Race item
 */
export class ItemRacePF extends ItemPF {
  /**
   * @override
   */
  static system = Object.freeze({
    ...super.system,
    hasIdentifier: false,
    hasActions: false,
  });

  /**
   * @internal
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
      const oldRace = actor.itemTypes.race.find((r) => r !== this);
      if (oldRace) {
        const oldSize = oldRace.system.size;
        await oldRace.delete();

        const context = {};
        // Ensure actor size is updated to match the race, but only if it's same as old race
        const actorSize = actor.system.traits.size;
        if (actorSize !== this.system.size && oldSize === actorSize) context._pf1SizeChanged = true;
      }
    }
  }

  /**
   * @internal
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);
    if (!changed.system) return;
    if (context.diff === false || context.recursive === false) return; // Don't diff if we were told not to diff

    const actor = this.actor;

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
      if (this.system.speeds?.fly > 0) {
        speedUpdates.fly.maneuverability = this.system.speeds.flyManeuverability || "average";
      }
      this.actor.update({
        "system.attributes.speed": speedUpdates,
      });
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

    if (game.user.id !== userId) return;

    const actor = this.actor;
    if (actor?.itemTypes.race.length === 0) {
      // Reset some race dependant details
      actor.update({
        "system.attributes.speed": {
          "land.base": 30,
          "fly.base": 0,
          "fly.maneuverability": "average",
          "swim.base": 0,
          "climb.base": 0,
          "burrow.base": 0,
        },
      });
    }
  }

  /**
   * @remarks This item type can not be recharged.
   * @override
   */
  recharge() {
    return;
  }
}
