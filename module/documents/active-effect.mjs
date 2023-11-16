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

    if (this.parent instanceof Item) return;
    if (userId !== game.user.id) return;

    const actor = this.actor;
    if (!actor || !this.origin) return;

    const item = fromUuidSync(this.origin);
    if (!item || item.isActive) return;

    if (!this.isSuppressed) {
      item.setActive(true, { pf1: { reason: "effect-creation" } });
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

    const item = fromUuidSync(this.origin, { relative: actor });

    // Disable associated buff if found
    if (context.pf1?.delete !== item?.uuid && item?.isActive) {
      context.pf1 ??= {};
      context.pf1.startTime = this.duration.startTime;
      item.setActive(false, context);
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
