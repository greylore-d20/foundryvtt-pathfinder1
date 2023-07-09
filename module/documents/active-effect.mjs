export class ActiveEffectPF extends ActiveEffect {
  async create(data, context = {}) {
    const statusId = this.flags?.core?.statusId,
      origin = this.origin,
      updates = {};
    if (statusId && this.parent?.system.attributes.conditions[statusId] === false) {
      updates[`system.attributes.conditions.${statusId}`] = true;
      await this.parent.update(updates);
      const created = this.parent.effects.find((e) => e.getFlag("core", "statusId") === statusId);
      if (created) return created;
    }
    if (origin) {
      const buffItem = this.parent.items.get(origin.split(".")[3]);
      if (buffItem && !buffItem.system.active) await buffItem.setActive(true);
    }
    return super.create(data, context);
  }

  async delete(context = {}) {
    const statusId = this.getFlag("core", "statusId"),
      re = this.origin?.match(/Item\.(?<itemId>\w+)/),
      origin = re?.groups.itemId,
      parentActor = this.parent,
      secondaryContext = statusId || origin ? { render: false } : {},
      returnVal = await super.delete(mergeObject(secondaryContext, context));
    if (statusId && parentActor.system.attributes.conditions[statusId]) {
      const updates = { [`system.attributes.conditions.${statusId}`]: false };
      await parentActor.update(updates, context);
    } else if (origin) {
      const item = parentActor.items.get(origin);
      // Avoid looping
      if (context.pf1?.delete !== item.uuid) {
        item?.setActive(false, context);
      }
    }
    return returnVal;
  }

  get isTemporary() {
    const duration = this.duration.seconds ?? (this.duration.rounds || this.duration.turns) ?? 0;
    return duration > 0 || this.getFlag("core", "statusId") || this.getFlag("pf1", "show");
  }
}
