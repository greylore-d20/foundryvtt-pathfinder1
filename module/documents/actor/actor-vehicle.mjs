import { ActorPF } from "./actor-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";

export class ActorVehiclePF extends ActorPF {
  prepareBaseData() {
    // Add base initiative
    this.system.attributes.init.total = this.system.attributes.init.value;
    this.system.attributes.cmd.total = this.system.attributes.cmd.value;
    this.system.attributes.ac.normal.total = this.system.attributes.ac.normal.base;
    this.system.attributes.savingThrows.save.total = this.system.attributes.savingThrows.save.base;

    // Needed for getRollData and ActorPF, but useless for the actor
    const strValue = this.system.abilities.str.value;
    this.system.abilities = {
      str: {
        value: strValue,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
      dex: {
        value: 10,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
      con: {
        value: 10,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
      int: {
        value: 10,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
      wis: {
        value: 10,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
      cha: {
        value: 10,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
    };

    // Needed for getRollData and ActorPF, but useless for the actor
    this.system.attributes = {
      ...this.system.attributes,
      cmb: {
        bonus: this.system.abilities.str.value,
      },
    };

    // Needed for getRollData and ActorPF, but useless for the actor
    this.sourceDetails = {
      "system.attributes.cmb.bonus": [
        { name: game.i18n.localize("PF1.Base"), value: this.system.attributes.cmb.bonus },
      ],
    };

    // Needed for getRollData and ActorPF, but useless for the actor
    this.system.attributes.conditions = {
      grappled: false,
    };
  }

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  _resetInherentTotals() {}

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  _setSourceDetails() {}

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  prepareDerivedData() {}

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  _prepareChanges() {
    this.changeItems = this.items
      .filter((obj) => {
        return (
          (obj.system.changes instanceof Array && obj.system.changes.length) ||
          (obj.system.changeFlags && Object.values(obj.system.changeFlags).filter((o) => o === true).length)
        );
      })
      .filter((obj) => obj.isActive);

    const changes = [];
    for (const i of this.changeItems) {
      changes.push(...i.changes);
    }

    const c = new Collection();
    for (const change of changes) {
      c.set(change._id, change);
    }
    this.changes = c;
  }

  getRollData(options = { refresh: false }) {
    let result;

    // Return cached data, if applicable
    const skipRefresh = !options.refresh && this._rollData;
    if (skipRefresh) {
      result = this._rollData;

      // Clear certain fields
      const clearFields = ["ablMod", "sizeBonus"];
      for (const k of clearFields) {
        const arr = k.split(".");
        const k2 = arr.slice(0, -1).join(".");
        const k3 = arr.slice(-1)[0];
        if (k2 === "") delete result[k];
        else {
          const obj = getProperty(result, k2);
          if (typeof obj === "object") delete obj[k3];
        }
      }
    } else {
      result = deepClone(this.system);
    }

    /* ----------------------------- */
    /* Always add the following data
      /* ----------------------------- */

    // Add combat round, if in combat
    if (game.combats?.viewed) {
      result.combat = {
        round: game.combat.round || 0,
      };
    }

    // Return cached data, if applicable
    if (skipRefresh) return result;

    /* ----------------------------- */
    /* Set the following data on a refresh
      /* ----------------------------- */

    // Set size index
    const sizeChart = Object.keys(pf1.config.sizeChart);
    result.size = sizeChart.indexOf(result.traits.size);

    // Add range info
    result.range = this.constructor.getReach(this.system.traits.size, this.system.traits.stature);

    // Wound Threshold isn't applicable
    result.attributes.woundThresholds = { level: 0 };

    // Traps don't have ACP
    result.attributes.acp = { attackPenalty: 0 };

    this._rollData = result;
    return result;
  }
}
