export class ActiveEffectPF extends ActiveEffect {
  /**
   * @internal
   * @override
   * @param {object} data - Creation data
   * @param {object} context - Creation context
   * @param {User} user - Triggering user
   */
  async _preCreate(data, context, user) {
    await super._preCreate(data, context, user);

    const actor = this.actor;
    if (!actor) return;

    // Record current initiative
    // But only if the current actor is in combat
    const combat = actor.getCombatants()[0]?.combat;
    if (combat) {
      // Set flag only if it doesn't exist in the data already
      if (this.getFlag("pf1", "initiative") === undefined) {
        this.updateSource({ "flags.pf1.initiative": combat.initiative });
      }
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

    if (this.parent instanceof Actor) return;

    if (!this.isTracker) return;

    if (!this.isSuppressed && !this.parent.isActive) {
      this.parent.setActive(true, { pf1: { reason: "effect-creation" } });
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

    if (this.parent instanceof Actor) return;
    if (!this.isTracker) return;

    // Disable associated buff if found
    if (context.pf1?.delete !== this.parent.uuid && this.parent.isActive) {
      context.pf1 ??= {};
      context.pf1.startTime = this.duration.startTime;
      this.parent.setActive(false, context);
    }
  }

  /**
   * @override
   * @type {boolean}
   */
  _onUpdate(changed, context, userId) {
    super._onUpdate(changed, context, userId);

    if (game.user.id !== userId) return;

    if (this.isSuppressed) return;

    if (changed.disabled !== undefined) {
      if (this.parent instanceof Item) {
        this.parent.setActive?.(!this.disabled, context);
      }
    }
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
    if (this.getFlag("pf1", "show") === false || game.settings.get("pf1", "hideTokenConditions")) return false;

    return super.isTemporary || this.getFlag("pf1", "show") || false;
  }

  /** @type {number|undefined} - Initiative counter if this effect started during combat */
  get initiative() {
    return this.getFlag("pf1", "initiative");
  }

  /** @type {boolean} - Is this tracking buff active state and duration? */
  get isTracker() {
    return this.getFlag("pf1", "tracker") ?? false;
  }
}
