import { ItemPF } from "../entity.js";

export class ItemBuffPF extends ItemPF {
  async _preUpdate(changed, options, userId) {
    // Add activation time when not present
    if (changed.data?.active && changed.data?.duration?.start === undefined) {
      setProperty(changed, "data.duration.start", game.time.worldTime);
    }

    return super._preUpdate(changed, options, userId);
  }

  prepareData() {
    const itemData = super.prepareData();
    const data = itemData.data;
    const labels = this.labels;
    const C = CONFIG.PF1;

    labels.buffType = C.buffTypes[data.buffType];

    if (this.data.data.duration) {
      const dur = this.data.data.duration;
      const unit = C.timePeriodsShort[dur.units];
      if (unit && dur.value) {
        const val = RollPF.safeTotal(dur.value, this.getRollData());
        labels.duration = [val, unit].filterJoin(" ");
      } else {
        labels.duration = null;
      }
    }
  }

  prepareDerivedItemData() {
    super.prepareDerivedItemData();
    const itemData = this.data.data;

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
        case "rounds":
          seconds = duration * 6;
          break;
      }

      itemData.duration.totalSeconds = seconds;
    }
  }

  //Creates a simple ActiveEffect from a buff item. Returns the effect
  async toEffect({ noCreate = false } = {}) {
    if (!this.parent) return;

    const existing = this.parent.effects.find((e) => e.data.origin == this.uuid);
    if (existing || noCreate) return existing;

    // Add a new effect
    const createData = { label: this.name, icon: this.img, origin: this.uuid, disabled: !this.data.data.active };
    createData["flags.pf1.show"] = !this.data.data.hideFromToken && !game.settings.get("pf1", "hideTokenConditions");
    const effect = ActiveEffect.create(createData, { parent: this.parent });

    return effect;
  }

  // Determines the starting data for an ActiveEffect based off this item
  getRawEffectData() {
    const createData = super.getRawEffectData();

    createData["flags.pf1.show"] = !this.data.data.hideFromToken && !game.settings.get("pf1", "hideTokenConditions");
    if (this.data.data.hideFromToken) createData.icon = null;

    // Add buff durations
    const durationValue = this.data.data.duration.value ?? null;
    if (durationValue) {
      let seconds = 0;
      switch (this.data.data.duration.units) {
        case "minute":
        case "hour": {
          seconds = this.totalDurationSeconds;
          break;
        }
        case "turn": {
          const turns = RollPF.safeRoll(durationValue, this.getRollData()).total;
          if (turns > 0) {
            createData.duration.turns = turns;
            seconds = turns * 6;
          }
          break;
        }
        case "round": {
          const rounds = RollPF.safeRoll(durationValue, this.getRollData()).total;
          if (rounds > 0) {
            createData.duration.rounds = rounds;
            seconds = rounds * 6;
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

    result.item.level = this.data.data.level;

    return result;
  }

  get isActive() {
    return this.data.data.active;
  }

  get subType() {
    return this.data.data.buffType;
  }
}
