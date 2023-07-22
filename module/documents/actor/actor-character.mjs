import { ActorPF } from "./actor-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";

export class ActorCharacterPF extends ActorPF {
  /**
   * @override
   * @param {object} data
   * @param {object} context
   * @param {User} user
   */
  async _preCreate(data, context, user) {
    await super._preCreate(data, context, user);

    const tokenUpdate = {};

    // Link token data by default
    if (data.prototypeToken?.actorLink === undefined) {
      tokenUpdate.actorLink = true;
    }

    // Enable vision by default
    if (game.settings.get("pf1", "characterVision") && data.prototypeToken?.sight?.enabled === undefined) {
      tokenUpdate.sight = { enabled: true };
    }

    if (!foundry.utils.isEmpty(tokenUpdate)) {
      this.prototypeToken.updateSource(tokenUpdate);
    }
  }

  prepareBaseData() {
    super.prepareBaseData();

    const actorData = this.system;

    const maxExp = this.getLevelExp(actorData.details.level.value);
    actorData.details.xp.max = maxExp;

    if (!hasProperty(this, "system.details.level.value")) return;

    // Experience bar
    const prior = this.getLevelExp(actorData.details.level.value - 1 || 0),
      max = this.getLevelExp(actorData.details.level.value || 1);

    actorData.details.xp.pct =
      ((Math.max(prior, Math.min(max, actorData.details.xp.value)) - prior) / (max - prior)) * 100 || 0;
  }

  _updateExp(updateData) {
    const xpData = updateData.details?.xp;
    if (xpData?.value == undefined) return;

    // Get total level
    const classes = this.items.filter((o) => o.type === "class");
    const level = classes.filter((o) => o.system.subType !== "mythic").reduce((cur, o) => cur + o.system.level, 0);

    const oldData = this.system;

    // Translate update exp value to number
    let newExp = xpData.value,
      resetExp = false;
    if (typeof newExp === "string") {
      const curExp = Number(oldData.details.xp.value);
      if (newExp.match(/^\+([0-9]+)$/)) {
        newExp = curExp + parseInt(RegExp.$1);
      } else if (newExp.match(/^-([0-9]+)$/)) {
        newExp = curExp - parseInt(RegExp.$1);
      } else if (newExp === "") {
        resetExp = true;
      } else if (newExp.match(/^([0-9]+)$/)) {
        newExp = parseInt(newExp);
      } else {
        newExp = curExp;
      }

      xpData.value = newExp;
    }
    const maxExp = this.getLevelExp(level);
    xpData.max = maxExp;

    if (resetExp) {
      const minExp = level > 0 ? this.getLevelExp(level - 1) : 0;
      xpData.value = minExp;
    }
  }

  /**
   * Return the amount of experience required to gain a certain character level.
   *
   * @param level {number}  The desired level
   * @returns {number}       The XP required
   */
  getLevelExp(level) {
    const expConfig = game.settings.get("pf1", "experienceConfig");
    const expTrack = expConfig.track;
    // Preset experience tracks
    if (["fast", "medium", "slow"].includes(expTrack)) {
      const levels = pf1.config.CHARACTER_EXP_LEVELS[expTrack];
      return levels[Math.min(level, levels.length - 1)];
    }
    // Custom formula experience track
    let totalXP = 0;
    if (expConfig.custom.formula.length > 0) {
      for (let a = 0; a < level; a++) {
        const rollData = this.getRollData();
        rollData.level = a + 1;
        const roll = RollPF.safeRoll(expConfig.custom.formula, rollData);
        totalXP += roll.total;
      }
    }
    return Math.max(1, totalXP);
  }
}
