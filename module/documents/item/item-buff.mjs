import { ItemPF } from "./item-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";

export class ItemBuffPF extends ItemPF {
  /**
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
   * @param {object} options - Delete context options
   * @param {string} userId - Triggering user ID
   */
  _onDelete(options, userId) {
    super._onDelete(options, userId);

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
  _updateTrackingEffect(changed, userId) {
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
      const aeData = this.getRawEffectData();
      aeData.active = isActive;
      aeData.transfer = true;
      setProperty(aeData, "flags.pf1.tracker", true);

      // Update old
      if (oldEffect) oldEffect.update(aeData, { render: false });
      // Create new
      else ActiveEffect.implementation.create(aeData, { parent: this, render: false });
    }
  }

  /**
   * @override
   * @param {object} context
   * @param {User} user
   */
  async _preDelete(context, user) {
    // Delete associated effect
    const effect = this.effect;

    const startTime = effect?.duration.startTime;
    context.pf1 ??= {};
    context.pf1.startTime = startTime;

    if (effect) {
      await effect.delete({ pf1: { delete: this.uuid } });
    }

    // Run script call(s)
    if (user.isSelf) {
      if (this.isActive) {
        this.executeScriptCalls("toggle", { state: false, startTime });
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
        const value = RollPF.safeTotal(duration.value, this.getRollData());
        labels.duration = game.i18n.format("PF1.Time.Format", { value, unit });
      } else {
        labels.duration = "";
      }
    }

    return labels;
  }

  prepareDerivedItemData() {
    super.prepareDerivedItemData();
    this._prepareDuration();
  }

  /**
   * Prepare .system.duration
   *
   * @param {object} [options] Additional options
   * @param {object} [options.rollData] Roll data instance. New instance is generated if undefined and needed.
   * @private
   */
  _prepareDuration({ rollData } = {}) {
    const itemData = this.system;

    const duration = itemData.duration ?? {};
    const { units, value: formula } = duration;
    if (!units) return;

    // Add total duration in seconds
    let seconds = 0;
    if (units === "turn") {
      seconds = CONFIG.time.roundTime;
    } else {
      if (!formula) return;
      rollData ??= this.getRollData();
      const duration = RollPF.safeRoll(formula, rollData).total;
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

  // Determines the starting data for an ActiveEffect based off this item
  getRawEffectData() {
    const createData = super.getRawEffectData();

    const hideIcon = this.system.hideFromToken;
    foundry.utils.setProperty(createData, "flags.pf1.show", !hideIcon);

    // Add buff durations
    const duration = this.system.duration;
    let formula = duration.value || "";
    if (typeof formula == "number") formula += "";
    let seconds = 0;
    const units = duration.units;
    if (units === "turn") {
      createData.duration.turns = 1;
      seconds = CONFIG.time.roundTime;
    } else if (formula) {
      switch (units) {
        case "minute":
        case "hour": {
          seconds = this.totalDurationSeconds;
          break;
        }
        case "round": {
          const rounds = RollPF.safeRoll(formula, this.getRollData()).total;
          if (rounds > 0) {
            createData.duration.rounds = rounds;
            seconds = rounds * CONFIG.time.roundTime;
          }
          break;
        }
      }
    }

    if (seconds > 0) createData.duration.seconds = seconds;

    return createData;
  }

  getRollData() {
    const result = super.getRollData();

    result.item.level = this.system.level;

    return result;
  }

  get isActive() {
    return this.system.active;
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
   * @param {boolean} active
   * @param {object} context Optional update context
   * @returns {Promise} Update promise
   * @override
   */
  async setActive(active, context) {
    return this.update({ "system.active": active }, context);
  }

  /**
   * @remarks This item type can not be recharged.
   * @override
   */
  recharge() {
    return;
  }
}
