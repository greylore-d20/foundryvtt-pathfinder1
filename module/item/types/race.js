import { ItemPF } from "../entity.js";

export class ItemRacePF extends ItemPF {
  async _preCreate(data, options, user) {
    const actor = this.parent instanceof Actor ? this.parent : null;

    // Overwrite race
    if (actor) {
      const oldRace = actor.items.find((o) => o.type === "race" && o !== this);
      if (oldRace) {
        oldRace.delete();

        const context = {};
        // Ensure actor size is updated to match the race, but only if it's same as old race
        const actorSize = actor.system.traits.size;
        if (actorSize !== this.system.size && oldRace.system.size === actorSize) context._pf1SizeChanged = true;
      }
    }
  }

  async _preUpdate(update, context, user) {
    await super._preUpdate(update, context, user);

    if (this.parent?.type === "basic") return;

    // Track size change
    const newSize = getProperty(update, "system.size");
    if (this.parent && newSize !== undefined) {
      const oldSize = this.parent.system.traits.size;
      if (this.system.size === oldSize && newSize !== oldSize) {
        context._pf1SizeChanged = true;
      }
    }
  }

  _onUpdate(data, context, userId) {
    super._onUpdate(data, context, userId);

    // Change actor size if the old size is same as old race size.
    if (this.parent && context._pf1SizeChanged) {
      if (this.parent.type === "basic") return;
      this.parent.update({ "system.traits.size": this.system.size });
    }
  }

  _onDelete(data, context, userId) {
    super._onDelete(data, context, userId);

    if (this.parent?.race === this) this.parent._race = null;
  }

  /**
   * @override
   */
  prepareBaseData() {
    super.prepareBaseData();
    const actor = this.actor;
    // Self-register on actor
    if (actor) actor._race = this;
  }
}
