import { ItemPF } from "../entity.js";

export class ItemRacePF extends ItemPF {
  async _preUpdate(update, context, user) {
    await super._preUpdate(update, context, user);

    if (this.parent?.type == "basic") return;

    // Track size change
    const newSize = getProperty(update, "data.size");
    if (this.parent && newSize !== undefined) {
      const oldSize = this.parent.data.data.traits.size;
      if (this.data.data.size === oldSize && newSize !== oldSize) {
        context._pf1SizeChanged = true;
      }
    }
  }

  _onUpdate(data, context, userId) {
    super._onUpdate(data, context, userId);

    // Change actor size if the old size is same as old race size.
    if (this.parent && context._pf1SizeChanged) {
      if (this.parent.type == "basic") return;
      this.parent.update({ "data.traits.size": this.data.data.size });
    }
  }
}
