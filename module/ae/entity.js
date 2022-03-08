export class ActiveEffectPF extends ActiveEffect {
  async create(data, context = {}) {
    const statusId = this.data["flags.core.statusId"],
      origin = this.data.origin, // DEPRECATED: Use origin flag instead.
      originItem = this.getFlag("pf1", "origin")?.item,
      updates = {};
    if (statusId && this.parent?.data.data.attributes.conditions[statusId] === false) {
      updates[`data.attributes.conditions.${statusId}`] = true;
      await this.parent.update(updates);
      const created = this.parent.effects.find((e) => e.getFlag("core", "statusId") === statusId);
      if (created) return created;
    }

    // Activate associated buff item.
    let buffItem;
    if (originItem) buffItem = this.parent.items.get(originItem);

    // DEPRECATED: Use origin flag instead.
    if (!buffItem && origin) {
      const re = origin.match(/Item\.(?<itemId>\w+)/);
      buffItem = this.parent.items.get(re?.groups.itemId);
    }

    if (buffItem && !buffItem.isActive) await buffItem.update({ "data.active": true });

    return super.create(data, context);
  }

  async delete(context = {}) {
    const statusId = this.getFlag("core", "statusId"),
      originItem = this.getFlag("pf1", "origin")?.item,
      re = this.data.origin?.match(/Item\.(?<itemId>\w+)/), // DEPRECATED: Use origin flag instead.
      origin = re?.groups.itemId,
      parentActor = this.parent,
      secondaryContext = statusId || origin ? { render: false } : {},
      returnVal = await super.delete(mergeObject(secondaryContext, context));
    if (statusId && parentActor.data.data.attributes.conditions[statusId]) {
      const updates = { [`data.attributes.conditions.${statusId}`]: false };
      await parentActor.update(updates, context);
    } else if (originItem || origin) {
      let buffItem = parentActor.items.get(originItem);
      if (!buffItem) buffItem = parentActor.items.get(origin); // DEPRECATED
      if (buffItem && buffItem.isActive) buffItem.update({ "data.active": false }, context);
    }
    return returnVal;
  }

  get isTemporary() {
    const duration = this.data.duration.seconds ?? (this.data.duration.rounds || this.data.duration.turns) ?? 0;
    return duration > 0 || this.getFlag("core", "statusId") || this.getFlag("pf1", "show");
  }
}
