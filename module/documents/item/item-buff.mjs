import { ItemPF } from "./item-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";
import { PF1 } from "@config";

export class ItemBuffPF extends ItemPF {
  async _preUpdate(changed, options, userId) {
    // Add activation time when not present
    if (changed.system?.active && changed.system?.duration?.start === undefined) {
      setProperty(changed, "system.duration.start", game.time.worldTime);
    }

    return super._preUpdate(changed, options, userId);
  }

  async _preDelete(options, user) {
    // Delete associated effect
    const effect = this.effect;
    if (effect) {
      await effect.delete({ type: "delete", document: this });
    }

    // Run script call(s)
    if (user.id === game.user.id) {
      if (this.isActive) {
        this.executeScriptCalls("toggle", { state: false });
      }
    }

    return super._preDelete(options, user);
  }

  /** @inheritDoc */
  getLabels({ actionId } = {}) {
    const labels = super.getLabels({ actionId });

    const itemData = this.system;
    labels.subType = PF1.buffTypes[itemData.subType];

    if (this.system.duration) {
      const dur = this.system.duration;
      const unit = PF1.timePeriodsShort[dur.units];
      if (unit && dur.value) {
        const val = RollPF.safeTotal(dur.value, this.getRollData());
        labels.duration = [val, unit].filterJoin(" ");
      } else {
        labels.duration = "";
      }
    }

    return labels;
  }

  prepareDerivedItemData() {
    super.prepareDerivedItemData();
    const itemData = this.system;

    // Add total duration in seconds
    if (itemData.duration.value?.length) {
      let seconds = 0;
      const rollData = this.getRollData();
      const duration = RollPF.safeRoll(itemData.duration.value || "0", rollData).total;
      switch (itemData.duration.units) {
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

      itemData.duration.totalSeconds = seconds;
    }
  }

  // Creates a simple ActiveEffect from a buff item. Returns the effect
  async toEffect({ noCreate = false } = {}) {
    if (!this.parent) return;

    const existing = this.parent.effects.find((e) => e.origin == this.uuid);
    if (existing || noCreate) return existing;

    // Add a new effect
    const createData = {
      label: this.name,
      icon: this.img,
      origin: this.uuid,
      disabled: !this.isActive,
      flags: {
        pf1: {
          show: !this.system.hideFromToken && !game.settings.get("pf1", "hideTokenConditions"),
          origin: { item: this.id },
        },
      },
    };
    const effect = ActiveEffect.create(createData, { parent: this.parent });

    return effect;
  }

  // Determines the starting data for an ActiveEffect based off this item
  getRawEffectData() {
    const createData = super.getRawEffectData();

    const hideIcon = this.system.hideFromToken || game.settings.get("pf1", "hideTokenConditions");
    createData["flags.pf1.show"] = !hideIcon;
    if (hideIcon) createData.icon = null;

    // Add buff durations
    let durationValue = this.system.duration.value ?? null;
    if (typeof durationValue == "number") durationValue += "";
    if (durationValue) {
      let seconds = 0;
      switch (this.system.duration.units) {
        case "minute":
        case "hour": {
          seconds = this.totalDurationSeconds;
          break;
        }
        case "turn": {
          const turns = RollPF.safeRoll(durationValue, this.getRollData()).total;
          if (turns > 0) {
            createData.duration.turns = turns;
            seconds = turns * CONFIG.time.roundTime;
          }
          break;
        }
        case "round": {
          const rounds = RollPF.safeRoll(durationValue, this.getRollData()).total;
          if (rounds > 0) {
            createData.duration.rounds = rounds;
            seconds = rounds * CONFIG.time.roundTime;
          }
          break;
        }
      }
      if (seconds > 0) createData.duration.seconds = seconds;
    }

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
    return this.parentActor?.effects.find((o) => o.origin?.indexOf(`Item.${this.id}`) > 0);
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
