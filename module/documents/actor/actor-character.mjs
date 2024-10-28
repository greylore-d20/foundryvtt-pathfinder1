import { ActorPF } from "./actor-pf.mjs";
import { RollPF } from "@dice/roll.mjs";
import { addDefaultChanges } from "./utils/apply-changes.mjs";

export class ActorCharacterPF extends ActorPF {
  /**
   * @internal
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

    if (data.prototypeToken?.disposition === undefined) {
      const disposition = game.settings.get("pf1", "pcDisposition");
      if (disposition !== "NONE") {
        tokenUpdate.disposition = CONST.TOKEN_DISPOSITIONS[disposition];
      }
    }

    if (!foundry.utils.isEmpty(tokenUpdate)) {
      this.prototypeToken.updateSource(tokenUpdate);
    }
  }

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

    // Update experience
    this._updateExp(changed);
  }

  /**
   * Handle relative XP change and constrain it to appropriate minimum value.
   *
   * @protected
   * @param {object} changed
   */
  _updateExp(changed) {
    const xpData = changed.system.details?.xp;

    if (xpData?.value <= 0) {
      // Reset XP to minimum possible
      // BUG: This will have stale value if the update changed classes, too
      const level = this.system.details?.level?.value ?? 0;
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
   * @param {object} [options] - Additional options
   * @param {object} [options.rollData] - Roll data instance
   * @returns {number} - The XP required for next level.
   * @throws {Error} - If invalid level is provided.
   */
  getLevelExp(level, { rollData = null } = {}) {
    if (!Number.isInteger(level) || !(level >= 0)) throw new Error(`Level "${level}" must be zero or greater integer.`);
    if (level === 0) return 0; // Explicit case for absolute minimum.

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
      rollData ??= this.getRollData();
      for (let a = 0; a < level; a++) {
        rollData.level = a + 1;
        const roll = RollPF.safeRollSync(config.custom.formula, rollData);
        totalXP += roll.total;
      }
      delete rollData.level; // Cleanup
    }

    return totalXP;
  }

  /**
   * @protected
   * @override
   */
  _prepareTypeChanges(changes) {
    addDefaultChanges.call(this, changes);
  }

  /**
   * @protected
   * @override
   */
  prepareBaseData() {
    super.prepareBaseData();
    const actorData = this.system;

    actorData.traits ??= {};
    // Prepare age category data
    actorData.traits.ageCategory ??= { base: "adult" };
    const ageCategoryChart = Object.keys(pf1.config.ageCategories);
    const ageCategoryValue = ageCategoryChart.indexOf(actorData.traits.ageCategory.base);
    Object.assign(actorData.traits.ageCategory, {
      value: ageCategoryValue,
      physical: ageCategoryValue,
      mental: ageCategoryValue,
    });
  }

  /**
   * @protected
   * @override
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    const actorData = this.system;

    actorData.details ??= {};

    // Prepare experience data
    const level = actorData.details.level?.value || 1;

    actorData.details.xp ??= {};

    const maxExp = this.getLevelExp(level);
    actorData.details.xp.max = maxExp;

    // Experience bar
    const curXp = actorData.details.xp.value;
    // Maxed out XP needs no math
    if (curXp >= maxExp) {
      actorData.details.xp.pct = 100;
    } else {
      const prior = this.getLevelExp(level - 1 || 0);
      actorData.details.xp.pct = ((Math.clamp(curXp, prior, maxExp) - prior) / (maxExp - prior)) * 100;
    }
  }
}
