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

  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    if (!changed.system) return;

    // Update experience
    this._updateExp(changed);
  }

  /**
   * Handle relative XP change and constrain it to appropriate minimum value.
   *
   * @private
   * @param {object} changed
   */
  _updateExp(changed) {
    const xpData = changed.system.details?.xp;

    if (xpData?.value === 0) {
      // Reset XP to minimum possible
      const level =
        this.itemTypes.class?.filter((o) => o.subType !== "mythic").reduce((cur, o) => cur + o.system.level, 0) ?? 0;

      xpData.value = level > 0 ? this.getLevelExp(level - 1) : 0;
    }
  }

  /**
   * Amount of experience required to gain next level at specific character level.
   *
   * @example
   * getLevelExp(1) // -> 3000, the XP needed for level 2
   *
   * @param {number} level - Desired level to level-up.
   * @returns {number} - The XP required for next level.
   * @throws {Error} - If invalid level is provided.
   */
  getLevelExp(level) {
    if (!Number.isInteger(level) || !(level >= 0)) throw new Error(`Level "${level}" must be zero or greater integer.`);

    const config = game.settings.get("pf1", "experienceConfig");
    const track = config.track;

    // Preset experience tracks
    if (["fast", "medium", "slow"].includes(track)) {
      const levels = pf1.config.CHARACTER_EXP_LEVELS[track];
      // Normal levels
      if (level < levels.length) return levels[level];
      // Otherwise return last possible
      else return levels.at(-1);
    }

    // Custom formula experience track
    let totalXP = 0;
    if (config.custom.formula.length > 0) {
      for (let a = 0; a < level; a++) {
        const rollData = this.getRollData();
        rollData.level = a + 1;
        const roll = RollPF.safeRoll(config.custom.formula, rollData);
        totalXP += roll.total;
      }
    }
    return Math.max(1, totalXP);
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
}
