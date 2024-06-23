import { ItemPF } from "./item-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";

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
      setProperty(aeData, "flags.pf1.tracker", true);

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
          const roll = RollPF.safeRollSync(duration.value, rollData, {}, {}, { maximize: true });
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
      } else {
        labels.duration = "";
      }
    }

    return labels;
  }

  /**
   * @inheritDoc
   */
  _prepareDependentData(final = false) {
    super._prepareDependentData(final);

    this._prepareDuration();
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
   * Prepare .system.duration
   *
   * @deprecated Remove with PF1 v11
   * @internal
   * @param {object} [options] Additional options
   * @param {object} [options.rollData] Roll data instance. New instance is generated if undefined and needed.
   */
  _prepareDuration({ rollData } = {}) {
    const itemData = this.system;

    const duration = itemData.duration ?? {};
    const { units, value: formula } = duration;
    if (!units) return;

    // Add total duration in seconds
    let seconds = NaN;
    if (units === "turn") {
      seconds = CONFIG.time.roundTime;
    } else {
      if (!formula) return;
      rollData ??= this.getRollData();
      const roll = RollPF.safeRollSync(formula, rollData, {}, {}, { minimize: true });
      if (!roll.isDeterministic) return;
      const duration = roll.isDeterministic ? roll.total : roll.formula;
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
    itemData.duration.totalSeconds = seconds;
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
      const duration = await RollPF.safeRollAsync(formula, rollData).total;
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

  // Determines the starting data for an ActiveEffect based off this item
  async getRawEffectData({ rollData } = {}) {
    const createData = await super.getRawEffectData();

    createData.statuses = Array.from(this.system.conditions.all);

    const hideIcon = this.system.hideFromToken;
    const flags = { duration: {} };
    flags.show = !hideIcon;

    // Add buff durations
    const duration = this.system.duration;
    const formula = `${duration.value}`;

    let seconds = 0;
    let endTiming = this.system.duration.end || "turnStart";
    if (duration.units === "turn") {
      endTiming = "turnEnd";
    } else if (formula) {
      seconds = await this.getDuration({ rollData });
    }

    // Record end timing
    flags.duration.end = endTiming;

    // Record initiative
    flags.duration.initiative = game.combat?.initiative;

    foundry.utils.mergeObject(createData, { "flags.pf1": flags });

    if (seconds >= 0) createData.duration.seconds = seconds;

    return createData;
  }

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
