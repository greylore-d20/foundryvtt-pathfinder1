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
    // Add activation time when not present
    if (changed.system?.active && changed.system?.duration?.start === undefined) {
      setProperty(changed, "system.duration.start", game.time.worldTime);
    }

    await super._preUpdate(changed, context, user);
  }

  /**
   * @override
   * @param {object} context
   * @param {User} user
   */
  async _preDelete(context, user) {
    // Delete associated effect
    const effect = this.effect;
    if (effect) {
      await effect.delete({ pf1: { delete: this.uuid } });
    }

    // Run script call(s)
    if (user.isSelf) {
      if (this.isActive) {
        this.executeScriptCalls("toggle", { state: false });
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
        labels.duration = game.i18n.format("PF1.TimeFormat", { value: 1, unit });
      } else if (unit && duration.value) {
        const value = RollPF.safeTotal(duration.value, this.getRollData());
        labels.duration = game.i18n.format("PF1.TimeFormat", { value, unit });
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

  // Creates a simple ActiveEffect from a buff item. Returns the effect
  async toEffect({ noCreate = false } = {}) {
    const actor = this.actor;
    if (!actor) return;

    const existing = actor.effects.find((e) => e.origin == this.uuid);
    if (existing || noCreate) return existing;

    // Add a new effect
    const createData = this.getRawEffectData();
    const doSHow = !this.system.hideFromToken && !game.settings.get("pf1", "hideTokenConditions");
    setProperty(createData, "flags.pf1.show", doSHow);
    return ActiveEffect.implementation.create(createData, { parent: actor });
  }

  // Determines the starting data for an ActiveEffect based off this item
  getRawEffectData() {
    const createData = super.getRawEffectData();

    const hideIcon = this.system.hideFromToken || game.settings.get("pf1", "hideTokenConditions");
    createData["flags.pf1.show"] = !hideIcon;
    if (hideIcon) createData.icon = null;

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

  get effect() {
    return this.actor?.effects.find((o) => o.origin?.indexOf(`Item.${this.id}`) > 0);
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
