export class ActiveEffectPF extends ActiveEffect {
  /**
   * @override
   * @param {object} data - Creation data
   * @param {object} context - Creation context
   * @param {User} user - Triggering user
   */
  async _preCreate(data, context, user) {
    await super._preCreate(data, context, user);

    const parent = this.parent;
    const actor = parent instanceof Actor ? parent : parent.actor;
    if (!actor) return;

    // Record current initiative
    // But only if the current actor is in combat
    const combat = actor.getCombatants()[0]?.combat;
    if (combat) {
      this.updateSource({ "flags.pf1.initiative": combat.initiative });
    }
  }

  /**
   * @override
   * @param {object} data - Creation data
   * @param {object} context - Context
   * @param {string} userId - Triggering user
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
    if (this.origin) {
      const item = fromUuidSync(this.origin, { relative: actor });
      if (item && !item.isActive) item.setActive(true);
    }
  }

  /**
   * @override
   * @param {object} context - Delete context
   * @param {string} userId - Triggering user
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
    if (this.origin) {
      const item = fromUuidSync(this.origin, { relative: actor });
      // Avoid looping
      if (context.pf1?.delete !== item?.uuid && item?.isActive) {
        item.setActive(false, context);
      }
    }
  }

  /**
   * @override
   * @type {boolean}
   */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);

    if (game.user.id !== userId) return;

    if (changed.disabled !== undefined) {
      this._setOriginDocumentState(!this.disabled);
    }
  }

  /**
   * @internal
   * @param {boolean} [state=false]
   * @param {object} context
   * @returns {Promise<Item|undefined>}
   */
  async _setOriginDocumentState(state = false, context) {
    const origin = await fromUuid(this.origin || "", { relative: this.actor });
    if (origin) return origin.setActive(!this.disabled, context);
  }

  /**
   * @type {Actor|null} Parent actor or null.
   */
  get actor() {
    const parent = this.parent;
    if (parent instanceof Actor) return parent;
    else return parent?.actor || null;
  }

  /**
   * @override
   * @type {boolean}
   */
  get isTemporary() {
    const duration = this.duration.seconds ?? (this.duration.rounds || this.duration.turns) ?? 0;
    return duration > 0 || this.statuses.size || this.getFlag("pf1", "show") || false;
  }

  /** @type {number|undefined} - Initiative counter if this effect started during combat */
  get initiative() {
    return this.getFlag("pf1", "initiative");
  }
}
