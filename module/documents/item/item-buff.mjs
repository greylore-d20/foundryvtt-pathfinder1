import { ItemPF } from "./item-pf.mjs";
import { RollPF } from "@dice/roll.mjs";

/**
 * Buff item
 *
 * More or less ephemeral effects, such as spell buffs.
 */
export class ItemBuffPF extends ItemPF {
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

    // Add activation time when not present
    if (changed.system?.active && changed.system?.duration?.start === undefined) {
      foundry.utils.setProperty(changed, "system.duration.start", game.time.worldTime);
    }

    if (this.isActive && changed.system?.active == false) {
      const effect = this.effect;
      context.pf1 ??= {};
      context.pf1.startTime = effect?.duration.startTime;
    }
  }

  /**
   * @override
   * @param {object} changed - Update data
   * @param {object} context - Update context options
   * @param {string} userId - User ID
   */
  _onUpdate(changed, context, userId) {
    super._onUpdate(changed, context, userId);

    if (changed.system === undefined) return; // No system data updates

    // Following requires actor
    const actor = this.actor;
    if (!actor) return;

    // Toggle buff hook
    const isActive = changed.system?.active;
    if (isActive !== undefined) {
      Hooks.callAll("pf1ToggleActorBuff", actor, this, isActive);
    }

    // Following should only run on triggering user
    if (game.user.id !== userId) return;

    this._updateTrackingEffect(changed);
  }

  /**
   * @override
   * @param {object} data - Creation data
   * @param {object} context - Creation context
   * @param {string} userId - User ID
   */
  _onCreate(data, context, userId) {
    super._onCreate(data, context, userId);

    const actor = this.actor;
    const isActive = this.isActive;
    if (actor && isActive) {
      Hooks.callAll("pf1ToggleActorBuff", actor, this, true);
    }

    if (game.user.id !== userId) return;

    if (isActive) {
      this._updateTrackingEffect(data);
    }
  }

  /**
   * @override
   * @param {object} context - Delete context options
   * @param {string} userId - Triggering user ID
   */
  _onDelete(context, userId) {
    super._onDelete(context, userId);

    // Run script call(s)
    if (game.users.get(userId)?.isSelf) {
      if (this.isActive) {
        const startTime = context.pf1?.startTime;
        this.executeScriptCalls("toggle", { state: false, startTime });
      }
    }

    const actor = this.actor;
    if (!actor) return;

    // Call buff removal hook
    if (this.isActive) {
      Hooks.callAll("pf1ToggleActorBuff", actor, this, false);
    }
  }

  /**
   * Toggle active effect icon as necessary.
   *
   * @param {object} changed Update data
   * @param {string} userId  User ID
   */
  async _updateTrackingEffect(changed, userId) {
    // Toggle icon if active state has changed
    const isActive = changed.system.active;
    if (isActive === undefined) return;

    const oldEffect = this.effect;

    // Remove old AE
    if (!isActive) {
      oldEffect?.delete({ render: false });
    }
    // Add new AE or update old AE
    else {
      const aeData = await this.getRawEffectData();
      aeData.active = isActive;
      aeData.transfer = true;
      foundry.utils.setProperty(aeData, "flags.pf1.tracker", true);

      // Update old
      if (oldEffect) oldEffect.update(aeData);
      // Create new
      else ActiveEffect.implementation.create(aeData, { parent: this });
    }
  }

  /**
   * @internal
   * @override
   * @param {object} context
   * @param {User} user
   */
  async _preDelete(context, user) {
    const effect = this.effect;
    if (effect) {
      context.pf1 ??= {};
      context.pf1.startTime = effect?.duration.startTime;
      // Delete associated effect
      // TODO: Remove this eventually, it is only needed by old items/actors
      if (effect?.parent !== this) {
        await effect.delete({ pf1: { delete: this.uuid } });
      }
    }

    await super._preDelete(context, user);
  }

  /** @inheritDoc */
  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });

    const itemData = this.system;
    labels.subType = pf1.config.buffTypes[itemData.subType];

    if (this.system.duration) {
      const duration = this.system.duration;
      const unit = pf1.config.timePeriodsShort[duration.units];
      if (unit === "turn") {
        labels.duration = game.i18n.format("PF1.Time.Format", { value: 1, unit });
      } else if (unit && duration.value) {
        try {
          // TODO: Durations can be variable, variable durations need to be supported.
          rollData ??= this.getRollData();
          const roll = RollPF.safeRollSync(
            duration.value,
            rollData,
            { formula: duration.value, item: this },
            {},
            { maximize: true }
          );
          let value;
          if (roll.isDeterministic) {
            value = roll.total ?? 0;
          } else {
            value = pf1.utils.formula.simplify(duration.value, rollData);
          }
          labels.duration = game.i18n.format("PF1.Time.Format", { value, unit });
        } catch (e) {
          console.warn(`Error with buff duration formula "${duration.value}"`, this);
        }
      }
    }

    return labels;
  }

  /**
   * @inheritDoc
   */
  _prepareDependentData(final = false) {
    super._prepareDependentData(final);

    this._prepareTraits();
  }

  /**
   * Prepare trait selector managed data.
   *
   * @internal
   */
  _prepareTraits() {
    const conds = (this.system.conditions ??= {});
    conds.all = new Set([...(conds.value ?? []), ...(conds.custom ?? [])]);
  }

  /**
   * Duration of the buff in seconds.
   *
   * @internal
   * @param {object} [options]
   * @param {object} [options.rollData]
   * @returns {number|null} Duration in seconds or null if if it has no duration.
   */
  async getDuration({ rollData } = {}) {
    const duration = this.system.duration ?? {};
    const { units, value: formula } = duration;
    if (!units) return null;

    rollData ??= this.getRollData();

    // Add total duration in seconds
    let seconds = 0;
    if (units === "turn") {
      seconds = CONFIG.time.roundTime;
    } else {
      if (!formula) return;
      rollData ??= this.getRollData();
      // TODO: Make this roll somehow known
      const droll = await RollPF.safeRoll(formula, rollData);
      const duration = droll.total;
      switch (units) {
        case "hour":
          seconds = duration * 60 * 60;
          break;
        case "minute":
          seconds = duration * 60;
          break;
        case "round":
          seconds = duration * CONFIG.time.roundTime;
          break;
      }
    }
    return seconds;
  }

  /**
   * Create basic Active Effect data based on the item.
   *
   * @internal
   * @param {object} options
   * @param {object} options.rollData
   * @returns {object}
   */
  async getRawEffectData({ rollData } = {}) {
    const createData = await super.getRawEffectData();

    createData.type = "buff";

    createData.statuses = Array.from(this.system.conditions.all);

    // Add buff durations
    const duration = this.system.duration;

    let endTiming = this.system.duration.end || "turnStart";

    let seconds;
    if (duration.units === "turn") {
      endTiming = "turnEnd";
      seconds = 0;
    } else if (duration.value) {
      seconds = await this.getDuration({ rollData });
    }

    if (Number.isFinite(seconds)) {
      createData.duration.seconds = seconds;
    }

    // Record timing
    createData.system ??= {};
    createData.system.end = endTiming;
    createData.system.initiative = game.combat?.initiative;

    return createData;
  }

  /**
   * @override
   */
  getRollData() {
    const result = super.getRollData();

    result.item.level = this.system.level;

    return result;
  }

  /**
   * @inheritDoc
   */
  get isActive() {
    return this.system.active ?? false;
  }

  /**
   * Retrieve associated tracking Active Effect
   *
   * @type {ActiveEffect|undefined}
   */
  get effect() {
    return this.effects.find((ae) => ae.getFlag("pf1", "tracker") === true);
  }

  /**
   * @inheritDoc
   */
  async setActive(active, context) {
    return this.update({ "system.active": active }, context);
  }
}
