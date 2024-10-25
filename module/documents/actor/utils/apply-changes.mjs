import { RollPF } from "@dice/roll.mjs";

/**
 * @this {pf1.documents.actor.ActorPF}
 */
export function applyChanges() {
  this.changeOverrides = {};
  const changes = Array.from(this.changes);

  const { targets, types } = getSortChangePriority.call(this);
  const _sortChanges = function (a, b) {
    const targetA = targets.indexOf(a.target);
    const targetB = targets.indexOf(b.target);
    const typeA = types.indexOf(a.type);
    const typeB = types.indexOf(b.type);
    const prioA = a.priority ?? 0;
    const prioB = b.priority ?? 0;

    return prioB - prioA || targetA - targetB || typeA - typeB;
  };

  // Organize changes by priority
  changes.sort((a, b) => _sortChanges.call(this, a, b));

  this.changeFlags.immuneToMorale = this.system.traits?.ci?.value?.includes("moraleEffects") || false;

  // Get items with change flags
  const chflagItems = this.items.filter((i) => i.isActive && i.hasChanges && i.system.changeFlags);

  // Parse change flags
  for (const i of chflagItems) {
    if (!i.system.changeFlags) continue;
    for (const [k, v] of Object.entries(i.system.changeFlags)) {
      if (v !== true) continue;
      this.changeFlags[k] = true;
      if (k !== "loseDexToAC") continue;

      for (const k2 of ["normal", "touch"]) {
        getSourceInfo(this.sourceInfo, `system.attributes.ac.${k2}.total`).negative.push({
          value: game.i18n.localize("PF1.ChangeFlags.LoseDexToAC"),
          name: i.name,
          type: i.type,
        });
      }
      getSourceInfo(this.sourceInfo, "system.attributes.cmd.total").negative.push({
        value: game.i18n.localize("PF1.ChangeFlags.LoseDexToAC"),
        name: i.name,
        type: i.type,
      });
    }
  }
  this.refreshDerivedData();

  // Determine continuous changes
  const continuousChanges = changes.filter((o) => o.continuous === true);

  resetSkills.call(this);

  // Apply all changes
  for (const change of changes) {
    if (this.changeFlags.immuneToMorale && change.type === "morale") continue;

    const flats = change.getTargets(this);
    for (const f of flats) {
      if (!this.changeOverrides[f]) this.changeOverrides[f] = createOverride();
    }

    change._safeApplyChange(this, flats, { applySourceInfo: false });

    // Apply continuous changes
    for (const cc of continuousChanges) {
      if (cc === change) continue;
      const flats = cc.getTargets(this);
      for (const f of flats) {
        if (!this.changeOverrides[f]) this.changeOverrides[f] = createOverride();
      }

      cc._safeApplyChange(this, flats, { applySourceInfo: false });
    }

    this.refreshDerivedData();
  }

  // Apply source info for changes
  for (const change of changes) {
    change.applySourceInfo(this);
  }

  finalizeSkills.call(this);
}

const createOverride = function () {
  const result = {
    add: {},
    set: {},
  };

  for (const k of Object.keys(pf1.config.bonusTypes)) {
    result.add[k] = null;
    result.set[k] = null;
  }

  return result;
};

const getSortChangePriority = function () {
  /** @type {[string, {sort: number}][]}*/
  const skillTargets = this._skillTargets.map((target, index) => [target, { sort: 76000 + index * 10 }]);
  const buffTargets = Object.entries(pf1.config.buffTargets);
  const targets = [...skillTargets, ...buffTargets]
    .sort(([, { sort: aSort }], [, { sort: bSort }]) => aSort - bSort)
    .map(([target]) => target);

  return {
    targets,
    types: Object.keys(pf1.config.bonusTypes),
  };
};

/**
 * @this {ActorPF}
 * @param {BuffTarget} target Target (e.g. "ac" or "skills")
 * @param {ModifierType} modifierType Type (e.g. "profane", "untyped", or "dodge"). If undefined, all valid targets will be returned.
 * @param {number} [value]  Value, if known
 * @returns {Array<string>} Array of target paths to modify
 */
export const getChangeFlat = function (target, modifierType, value) {
  if (target == null) return [];

  const curData = this.system;
  /** @type {string[]} */
  const result = [];

  switch (target) {
    case "mhp":
      result.push("system.attributes.hp.max");
      break;
    case "wounds":
      result.push("system.attributes.wounds.max");
      break;
    case "woundThreshold":
      result.push("system.attributes.wounds.threshold");
      break;
    case "vigor":
      result.push("system.attributes.vigor.max");
      break;
    case "str":
    case "dex":
    case "con":
    case "int":
    case "wis":
    case "cha":
      if (["base", "untypedPerm"].includes(modifierType)) {
        result.push(`system.abilities.${target}.base`);
      }
      result.push(`system.abilities.${target}.total`, `system.abilities.${target}.undrained`);
      break;
    case "strPen":
    case "dexPen":
    case "conPen":
    case "intPen":
    case "wisPen":
    case "chaPen": {
      const ablKey = target.slice(0, -3);
      result.push(`system.abilities.${ablKey}.penalty`);
      break;
    }
    case "strMod":
    case "dexMod":
    case "conMod":
    case "intMod":
    case "wisMod":
    case "chaMod":
      result.push(`system.abilities.${target.slice(0, 3)}.mod`);
      break;
    case "carryStr":
      result.push("system.details.carryCapacity.bonus.total");
      break;
    case "carryMult":
      result.push("system.details.carryCapacity.multiplier.total");
      break;
    case "size":
      result.push("system.traits.size.value");
      result.push("system.traits.size.token");
      break;
    case "tokenSize":
      result.push("system.traits.size.token");
      break;
    case "ac":
      result.push("system.attributes.ac.normal.total", "system.attributes.ac.touch.total");

      switch (modifierType) {
        case "dodge":
        case "haste":
          result.push("system.attributes.cmd.total");
          break;
        case "deflection":
        case "circumstance":
        case "insight":
        case "luck":
        case "morale":
        case "profane":
        case "sacred":
          result.push(
            "system.attributes.ac.flatFooted.total",
            "system.attributes.cmd.total",
            "system.attributes.cmd.flatFootedTotal"
          );
          break;
        default:
          result.push("system.attributes.ac.flatFooted.total");
          // Other penalties also apply to CMD, but not bonuses
          if (value < 0) {
            result.push("system.attributes.cmd.total", "system.attributes.cmd.flatFootedTotal");
          }
          break;
      }
      break;
    case "aac": {
      const targets = ["system.ac.normal.total"];
      switch (modifierType) {
        case "base":
          targets.push("system.ac.normal.base");
          break;
        case "enh":
          targets.push("system.ac.normal.enh");
          break;
        default:
          targets.push("system.ac.normal.misc");
          break;
      }
      result.push(...targets);
      break;
    }
    case "sac": {
      const targets = ["system.ac.shield.total"];
      switch (modifierType) {
        case "base":
          targets.push("system.ac.shield.base");
          break;
        case "enh":
          targets.push("system.ac.shield.enh");
          break;
        default:
          targets.push("system.ac.shield.misc");
          break;
      }
      result.push(...targets);
      break;
    }
    case "nac": {
      const targets = ["system.ac.natural.total"];
      switch (modifierType) {
        case "base":
          targets.push("system.ac.natural.base");
          break;
        case "enh":
          targets.push("system.ac.natural.enh");
          break;
        default:
          targets.push("system.ac.natural.misc");
          break;
      }
      result.push(...targets);
      break;
    }
    case "tac":
      result.push("system.attributes.ac.touch.total");
      break;
    case "ffac":
      result.push("system.attributes.ac.flatFooted.total");
      break;
    case "ffcmd":
      result.push("system.attributes.cmd.flatFootedTotal");
      break;
    case "bab":
      result.push("system.attributes.bab.total");
      break;
    case "~attackCore":
      result.push("system.attributes.attack.shared");
      break;
    case "attack":
      result.push("system.attributes.attack.general");
      break;
    case "wattack":
      result.push("system.attributes.attack.weapon");
      break;
    case "sattack":
      result.push("system.attributes.attack.spell");
      break;
    case "mattack":
      result.push("system.attributes.attack.melee");
      break;
    case "nattack":
      result.push("system.attributes.attack.natural");
      break;
    case "rattack":
      result.push("system.attributes.attack.ranged");
      break;
    case "critConfirm":
      result.push("system.attributes.attack.critConfirm");
      break;
    case "allSavingThrows":
      result.push(
        "system.attributes.savingThrows.fort.total",
        "system.attributes.savingThrows.ref.total",
        "system.attributes.savingThrows.will.total"
      );
      break;
    case "fort":
      result.push("system.attributes.savingThrows.fort.total");
      break;
    case "ref":
      result.push("system.attributes.savingThrows.ref.total");
      break;
    case "will":
      result.push("system.attributes.savingThrows.will.total");
      break;
    case "skills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        result.push(`system.skills.${a}.mod`);

        if (skl.subSkills != null) {
          for (const b of Object.keys(skl.subSkills)) {
            result.push(`system.skills.${a}.subSkills.${b}.mod`);
          }
        }
      }
      break;
    case "unskills":
      // Untrained skills
      for (const [skillId, skill] of Object.entries(curData.skills)) {
        if (skill == null) continue;
        for (const [subSkillId, subskill] of Object.entries(skill.subSkills ?? {})) {
          if (subskill.rank > 0) continue;
          result.push(`system.skills.${skillId}.subSkills.${subSkillId}.mod`);
        }
        if (skill.rank > 0) continue;
        result.push(`system.skills.${skillId}.mod`);
      }
      break;
    case "reach":
      // Natural reach
      result.push("system.traits.reach.total.melee");
      result.push("system.traits.reach.total.reach");
      break;
    case "strSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "str") result.push(`system.skills.${a}.mod`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "str") result.push(`system.skills.${a}.subSkills.${b}.mod`);
          }
        }
      }
      break;
    case "dexSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "dex") result.push(`system.skills.${a}.mod`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "dex") result.push(`system.skills.${a}.subSkills.${b}.mod`);
          }
        }
      }
      break;
    case "conSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "con") result.push(`system.skills.${a}.mod`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "con") result.push(`system.skills.${a}.subSkills.${b}.mod`);
          }
        }
      }
      break;
    case "intSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "int") result.push(`system.skills.${a}.mod`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "int") result.push(`system.skills.${a}.subSkills.${b}.mod`);
          }
        }
      }
      break;
    case "wisSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "wis") result.push(`system.skills.${a}.mod`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "wis") result.push(`system.skills.${a}.subSkills.${b}.mod`);
          }
        }
      }
      break;
    case "chaSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "cha") result.push(`system.skills.${a}.mod`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "cha") result.push(`system.skills.${a}.subSkills.${b}.mod`);
          }
        }
      }
      break;
    case "allChecks":
      result.push(
        "system.abilities.str.checkMod",
        "system.abilities.dex.checkMod",
        "system.abilities.con.checkMod",
        "system.abilities.int.checkMod",
        "system.abilities.wis.checkMod",
        "system.abilities.cha.checkMod",
        ...(this.system.attributes.init.ability ? ["system.attributes.init.total"] : [])
      );
      break;
    case "strChecks":
      result.push(
        "system.abilities.str.checkMod",
        ...(this.system.attributes.init.ability === "str" ? ["system.attributes.init.total"] : [])
      );
      break;
    case "dexChecks":
      result.push(
        "system.abilities.dex.checkMod",
        ...(this.system.attributes.init.ability === "dex" ? ["system.attributes.init.total"] : [])
      );
      break;
    case "conChecks":
      result.push(
        "system.abilities.con.checkMod",
        ...(this.system.attributes.init.ability === "con" ? ["system.attributes.init.total"] : [])
      );
      break;
    case "intChecks":
      result.push(
        "system.abilities.int.checkMod",
        ...(this.system.attributes.init.ability === "int" ? ["system.attributes.init.total"] : [])
      );
      break;
    case "wisChecks":
      result.push(
        "system.abilities.wis.checkMod",
        ...(this.system.attributes.init.ability === "wis" ? ["system.attributes.init.total"] : [])
      );
      break;
    case "chaChecks":
      result.push(
        "system.abilities.cha.checkMod",
        ...(this.system.attributes.init.ability === "cha" ? ["system.attributes.init.total"] : [])
      );
      break;
    case "allSpeeds":
      for (const speedKey of Object.keys(curData.attributes.speed)) {
        result.push(`system.attributes.speed.${speedKey}.total`);
      }
      break;
    case "landSpeed":
      result.push("system.attributes.speed.land.total");
      break;
    case "climbSpeed":
      result.push("system.attributes.speed.climb.total");
      break;
    case "swimSpeed":
      result.push("system.attributes.speed.swim.total");
      break;
    case "burrowSpeed":
      result.push("system.attributes.speed.burrow.total");
      break;
    case "flySpeed":
      result.push("system.attributes.speed.fly.total");
      break;
    case "cmb":
      result.push("system.attributes.cmb.bonus");
      break;
    case "cmd":
      if (["dodge", "haste"].includes(modifierType)) {
        result.push("system.attributes.cmd.total");
        break;
      }
      result.push("system.attributes.cmd.total", "system.attributes.cmd.flatFootedTotal");
      break;
    case "init":
      result.push("system.attributes.init.total");
      break;
    case "acpA":
      result.push("system.attributes.acp.armorBonus");
      break;
    case "acpS":
      result.push("system.attributes.acp.shieldBonus");
      break;
    case "mDexA":
      result.push("system.attributes.mDex.armorBonus");
      break;
    case "mDexS":
      result.push("system.attributes.mDex.shieldBonus");
      break;
    case "spellResist":
      result.push("system.attributes.sr.total");
      break;
    case "damage":
      result.push("system.attributes.damage.general");
      break;
    case "mdamage":
      result.push("system.attributes.damage.meleeAll");
      break;
    case "rdamage":
      result.push("system.attributes.damage.rangedAll");
      break;
    case "wdamage":
      result.push("system.attributes.damage.weapon");
      break;
    case "rwdamage":
      result.push("system.attributes.damage.ranged");
      break;
    case "twdamage":
      result.push("system.attributes.damage.thrown");
      break;
    case "mwdamage":
      result.push("system.attributes.damage.melee");
      break;
    case "ndamage":
      result.push("system.attributes.damage.natural");
      break;
    case "sdamage":
      result.push("system.attributes.damage.spell");
      break;
    case "bonusFeats":
      result.push("system.details.feats.bonus");
      break;
    case "bonusSkillRanks":
      result.push("system.details.skills.bonus");
      break;
    case "concentration":
      result.push(
        "system.attributes.spells.spellbooks.primary.concentration.total",
        "system.attributes.spells.spellbooks.secondary.concentration.total",
        "system.attributes.spells.spellbooks.tertiary.concentration.total",
        "system.attributes.spells.spellbooks.spelllike.concentration.total"
      );
      break;
    case "cl":
      result.push(
        "system.attributes.spells.spellbooks.primary.cl.total",
        "system.attributes.spells.spellbooks.secondary.cl.total",
        "system.attributes.spells.spellbooks.tertiary.cl.total",
        "system.attributes.spells.spellbooks.spelllike.cl.total"
      );
      break;
    case "dc":
      result.push(`system.attributes.spells.school.all.dc`);
      break;
  }

  // Per school DC target
  const schoolDC = /^dc\.school\.(?<schoolId>\w+)/.exec(target);
  if (schoolDC) {
    const schoolId = schoolDC.groups.schoolId;
    result.push(`system.attributes.spells.school.${schoolId}.dc`);
  }

  // Per school CL target
  const schoolCL = /^cl\.school\.(?<schoolId>\w+)/.exec(target);
  if (schoolCL) {
    const schoolId = schoolCL.groups.schoolId;
    result.push(`system.attributes.spells.school.${schoolId}.cl`);
  }

  // Per book concentration target
  const concnMatch = /^concn\.(?<bookId>\w+)/.exec(target);
  if (concnMatch) {
    const bookId = concnMatch.groups.bookId;
    result.push(`system.attributes.spells.spellbooks.${bookId}.concentration.total`);
  }

  // Per book caster level target
  const bookCL = /^cl\.book\.(?<bookId>\w+)/.exec(target);
  if (bookCL) {
    const bookId = bookCL.groups.bookId;
    result.push(`system.attributes.spells.spellbooks.${bookId}.cl.bonus`);
  }

  if (/^skill\./.test(target)) {
    const parts = target.split(".").slice(1);
    const sklKey = parts.shift();
    const subSklKey = parts.pop();

    if (subSklKey) {
      if (curData.skills[sklKey]?.subSkills?.[subSklKey] != null) {
        result.push(`system.skills.${sklKey}.subSkills.${subSklKey}.mod`);
      }
    } else {
      const skillData = curData.skills[sklKey];
      if (skillData != null) {
        result.push(`system.skills.${sklKey}.mod`);
        // Apply to subskills also
        for (const subSklKey of Object.keys(skillData.subSkills ?? {})) {
          result.push(`system.skills.${sklKey}.subSkills.${subSklKey}.mod`);
        }
      }
    }
  }

  // Call hooks to enable modules to add or adjust the result array
  if (Hooks.events.pf1GetChangeFlat?.length) {
    Hooks.callAll("pf1GetChangeFlat", result, target, modifierType, value, this);
  }

  // Return results directly when deprecation is removed
  return result;
};

/**
 * Calculate actor health
 *
 * @param {ActorPF} actor - Actor
 * @param {ItemPF[]} allClasses - All classes from the actor
 * @param changes - Changes
 */
function calculateHealth(actor, allClasses, changes) {
  // Categorize classes
  const [pcClasses, npcClasses, racialHD] = allClasses.reduce(
    (all, cls) => {
      if (cls.subType === "racial") all[2].push(cls);
      else if (cls.subType === "npc") all[1].push(cls);
      else all[0].push(cls);
      return all;
    },
    [[], [], []]
  );

  const healthConfig = game.settings.get("pf1", "healthConfig");

  /**
   * @function
   * @param {number} value
   * @returns {number}
   */
  const round = { up: Math.ceil, nearest: Math.round, down: Math.floor }[healthConfig.rounding];
  const { continuous } = healthConfig;

  /**
   * @param {number} value - Amount of health to add
   * @param {ItemPF} source - Source item
   */
  function pushHealth(value, source) {
    const fcb = pf1.config.favoredClassTypes.includes(source.subType) ? source.system.fc?.hp?.value || 0 : 0;

    changes.push(
      new pf1.components.ItemChange({
        formula: value,
        target: "mhp",
        type: "untypedPerm",
        flavor: source.name,
      }),
      new pf1.components.ItemChange({
        formula: value,
        target: "vigor",
        type: "untypedPerm",
        flavor: source.name,
      })
    );
    if (fcb != 0) {
      changes.push(
        new pf1.components.ItemChange({
          formula: fcb,
          target: "mhp",
          type: "untypedPerm",
          flavor: game.i18n.format("PF1.SourceInfoSkillRank_ClassFC", { className: source.name }),
        }),
        new pf1.components.ItemChange({
          formula: fcb,
          target: "vigor",
          type: "untypedPerm",
          flavor: game.i18n.format("PF1.SourceInfoSkillRank_ClassFC", { className: source.name }),
        })
      );
    }
  }

  /**
   * @param {ItemPF} source - Source item
   */
  function manualHealth(source) {
    let health = source.system.hp;
    if (!continuous) health = round(health);

    pushHealth(health, source);
  }

  /**
   * @param {ItemPF} source - Class granting health
   * @param {object} config - Class type configuration
   * @param {number} config.rate - Automatic HP rate
   * @param {boolean} config.maximized - Is this class allowed to grant maximized HP
   * @param {object} state - State tracking
   */
  function autoHealth(source, { rate, maximized } = {}, state) {
    const hpPerHD = source.system.hd ?? 0;
    if (hpPerHD === 0) return;

    let health = 0;

    // Mythic
    if (source.subType === "mythic") {
      const hpPerTier = hpPerHD ?? 0;
      if (hpPerTier === 0) return;
      const tiers = source.system.level ?? 0;
      if (tiers === 0) return;
      health = hpPerTier * tiers;
    }
    // Everything else
    else {
      let dieHealth = 1 + (hpPerHD - 1) * rate;
      if (!continuous) dieHealth = round(dieHealth);

      const hitDice = source.hitDice;

      let maxedHD = 0;
      if (maximized) {
        maxedHD = Math.min(hitDice, state.maximized.remaining);
        state.maximized.value += maxedHD;
      }
      const maxedHp = maxedHD * hpPerHD;
      const levelHp = Math.max(0, hitDice - maxedHD) * dieHealth;
      health = maxedHp + levelHp;
    }

    pushHealth(health, source);
  }

  /**
   * Compute and push health, tracking the remaining maximized levels.
   *
   * @param {ItemPF[]} sources - Health source classes
   * @param {object} config - Configuration for this class type
   * @param {boolean} config.auto - Automatic health enabled
   * @param config
   * @param state
   */
  function computeHealth(sources, config, state) {
    if (config.auto) {
      for (const cls of sources) autoHealth(cls, config, state);
    } else {
      for (const cls of sources) manualHealth(cls);
    }
  }

  // State tracking
  const state = {
    maximized: {
      value: 0,
      max: healthConfig.maximized,
      get remaining() {
        return this.max - this.value;
      },
    },
  };

  computeHealth(racialHD, healthConfig.hitdice.Racial, state);
  computeHealth(pcClasses, healthConfig.hitdice.PC, state);
  computeHealth(npcClasses, healthConfig.hitdice.NPC, state);
}

export const addDefaultChanges = function (changes) {
  const actorData = this.system;
  // Call hook
  const tempChanges = [];
  if (Hooks.events.pf1AddDefaultChanges?.length) {
    Hooks.callAll("pf1AddDefaultChanges", this, tempChanges);
  }
  changes.push(...tempChanges.filter((c) => c instanceof pf1.components.ItemChange));

  const allClasses = this.itemTypes.class.sort((a, b) => a.sort - b.sort);

  calculateHealth(this, allClasses, changes);

  // Add class data to saving throws
  const useFractional = game.settings.get("pf1", "useFractionalBaseBonuses") === true;
  for (const a of Object.keys(actorData.attributes.savingThrows)) {
    let hasGoodSave = false;
    actorData.attributes.savingThrows[a].total = actorData.attributes.savingThrows[a]?.base ?? 0;

    const total = allClasses.reduce((cur, cls) => {
      const base = cls.system.savingThrows[a].base;

      if (!useFractional) {
        // Add per class change
        changes.push(
          new pf1.components.ItemChange({
            formula: base,
            target: a,
            type: "untypedPerm",
            flavor: cls.name,
          })
        );
      } else {
        if (cls.system.savingThrows[a].good === true) hasGoodSave = true;
      }
      return cur + base;
    }, 0);

    if (useFractional) {
      // Add shared change with fractional
      changes.push(
        new pf1.components.ItemChange({
          formula: Math.floor(total),
          target: a,
          type: "untypedPerm",
          flavor: game.i18n.localize("PF1.Base"),
        })
      );
    }

    // Fractional bonus +2 when one class has good save
    if (useFractional && hasGoodSave) {
      const goodSaveFormula = pf1.config.classFractionalSavingThrowFormulas.goodSaveBonus;
      const total = RollPF.safeRollSync(goodSaveFormula).total;
      changes.push(
        new pf1.components.ItemChange({
          formula: total,
          target: a,
          type: "untypedPerm",
          flavor: game.i18n.localize("PF1.SavingThrowGoodFractionalBonus"),
        })
      );
    }
  }

  // Add Constitution to HP
  const hpAbility = actorData.attributes.hpAbility;
  if (hpAbility) {
    changes.push(
      new pf1.components.ItemChange({
        formula: "@attributes.hpAbility.mod * @attributes.hd.total",
        operator: "add",
        target: "mhp",
        type: "base",
        flavor: pf1.config.abilities[hpAbility],
      })
    );

    if (!this.system.attributes.wounds?.base) {
      // > a creature has a number of wound points equal to twice its Constitution score.
      changes.push(
        new pf1.components.ItemChange({
          formula: "@attributes.hpAbility.undrained * 2",
          operator: "add",
          target: "wounds",
          type: "base",
          flavor: pf1.config.abilities[hpAbility],
        })
      );
      // > It also has a wound threshold equal to its Constitution score.
      changes.push(
        new pf1.components.ItemChange({
          formula: "@attributes.hpAbility.undrained",
          operator: "add",
          target: "woundThreshold",
          type: "base",
          flavor: pf1.config.abilities[hpAbility],
        })
      );
      // https://www.aonprd.com/Rules.aspx?ID=1157
      // >  For each point of Constitution damage a creature takes, it loses 2 wound points
      changes.push(
        new pf1.components.ItemChange({
          formula: "-(@attributes.hpAbility.damage * 2)",
          operator: "add",
          target: "wounds",
          type: "untyped",
          flavor: game.i18n.localize("PF1.AbilityDamage"),
        })
      );
      // > When a creature takes a penalty to its Constitution score or its Constitution is drained,
      // > it loses 1 wound point per point of drain or per penalty
      changes.push(
        new pf1.components.ItemChange({
          formula: "@attributes.hpAbility.penalty", // no minus since penalty is negative inherently
          operator: "add",
          target: "wounds",
          type: "untyped",
          flavor: game.i18n.localize(`PF1.Ability${hpAbility.capitalize()}Pen`),
        })
      );
      changes.push(
        new pf1.components.ItemChange({
          formula: "-@attributes.hpAbility.drain",
          operator: "add",
          target: "wounds",
          type: "untyped",
          flavor: game.i18n.localize("PF1.AbilityDrain"),
        })
      );
    }
  }

  // Add movement speed(s)
  for (const [k, s] of Object.entries(actorData.attributes.speed)) {
    let base = s.base;
    if (!base) base = 0;
    changes.push(
      new pf1.components.ItemChange({
        formula: base,
        target: `${k}Speed`,
        type: "base",
        operator: "set",
        priority: 1001,
        flavor: game.i18n.localize("PF1.Base"),
      })
    );
  }

  // Add base attack modifiers shared by all attacks
  {
    // BAB to attack
    changes.push(
      new pf1.components.ItemChange({
        _id: "_bab", // HACK: Force ID to be special
        formula: "@attributes.bab.total",
        operator: "add",
        target: "~attackCore",
        type: "untypedPerm",
        flavor: game.i18n.localize("PF1.BAB"),
      })
    );
    // Negative levels to attack
    changes.push(
      new pf1.components.ItemChange({
        formula: "-@attributes.energyDrain",
        operator: "add",
        target: "~attackCore",
        type: "untypedPerm",
        flavor: game.i18n.localize("PF1.NegativeLevels"),
      })
    );
    // ACP to attack
    changes.push(
      new pf1.components.ItemChange({
        formula: "-@attributes.acp.attackPenalty",
        operator: "add",
        target: "~attackCore",
        type: "untyped",
        flavor: game.i18n.localize("PF1.ArmorCheckPenalty"),
      })
    );
  }

  // Add variables to CMD
  {
    // BAB to CMD
    changes.push(
      new pf1.components.ItemChange({
        formula: "@attributes.bab.total",
        operator: "add",
        target: "cmd",
        type: "untypedPerm",
        flavor: game.i18n.localize("PF1.BAB"),
      })
    );
    // Strength or substitute to CMD
    const strAbl = actorData.attributes.cmd.strAbility;
    if (strAbl in pf1.config.abilities) {
      changes.push(
        new pf1.components.ItemChange({
          formula: `@abilities.${strAbl}.mod`,
          target: "cmd",
          type: "untypedPerm",
          flavor: pf1.config.abilities[strAbl],
        })
      );
    }
    // Negative levels to CMD
    changes.push(
      new pf1.components.ItemChange({
        formula: "-@attributes.energyDrain",
        operator: "add",
        target: "cmd",
        type: "untypedPerm",
        flavor: game.i18n.localize("PF1.NegativeLevels"),
      })
    );
  }

  // Add Dexterity Modifier to Initiative
  {
    const abl = actorData.attributes.init.ability;
    if (abl) {
      changes.push(
        new pf1.components.ItemChange({
          formula: `@abilities.${abl}.mod`,
          operator: "add",
          target: "init",
          type: "untypedPerm",
          priority: -100,
          flavor: pf1.config.abilities[abl],
        })
      );
    }

    // Add ACP penalty
    if (["str", "dex"].includes(abl)) {
      changes.push(
        new pf1.components.ItemChange({
          formula: "-@attributes.acp.attackPenalty",
          operator: "add",
          target: "init",
          type: "untyped",
          priority: -100,
          flavor: game.i18n.localize("PF1.ArmorCheckPenalty"),
        })
      );
    }
  }

  // Add Ability modifiers and negative levels to saving throws
  {
    // Ability Mod to Fortitude
    let abl = actorData.attributes.savingThrows.fort.ability;
    if (abl) {
      changes.push(
        new pf1.components.ItemChange({
          formula: `@abilities.${abl}.mod`,
          operator: "add",
          target: "fort",
          type: "untypedPerm",
          flavor: pf1.config.abilities[abl],
        })
      );
    }
    // Ability Mod to Reflex
    abl = actorData.attributes.savingThrows.ref.ability;
    if (abl) {
      changes.push(
        new pf1.components.ItemChange({
          formula: `@abilities.${abl}.mod`,
          operator: "add",
          target: "ref",
          type: "untypedPerm",
          flavor: pf1.config.abilities[abl],
        })
      );
    }
    // Ability Mod to Will
    abl = actorData.attributes.savingThrows.will.ability;
    if (abl) {
      changes.push(
        new pf1.components.ItemChange({
          formula: `@abilities.${abl}.mod`,
          operator: "add",
          target: "will",
          type: "untypedPerm",
          flavor: pf1.config.abilities[abl],
        })
      );
    }
    // Negative level to saves
    changes.push(
      new pf1.components.ItemChange({
        formula: "-@attributes.energyDrain",
        operator: "add",
        target: "allSavingThrows",
        type: "untyped",
        flavor: game.i18n.localize("PF1.NegativeLevels"),
      })
    );
  }
  // Spell Resistance
  {
    const sr = actorData.attributes.sr.formula || 0;
    changes.push(
      new pf1.components.ItemChange({
        formula: sr,
        target: "spellResist",
        type: "untyped",
        priority: 1000,
        flavor: game.i18n.localize("PF1.CustomBonus"),
      })
    );
  }
  {
    // Carry capacity strength bonus
    const cStr = actorData.details.carryCapacity.bonus.user || 0;
    changes.push(
      new pf1.components.ItemChange({
        formula: cStr,
        target: "carryStr",
        type: "untyped",
        priority: 1000,
        flavor: game.i18n.localize("PF1.Custom"),
      })
    );
    // Carry capacity multiplier
    const cMultBase = actorData.details.carryCapacity.multiplier.base ?? 1;
    changes.push(
      new pf1.components.ItemChange({
        formula: cMultBase,
        target: "carryMult",
        type: "base",
        priority: 1000,
        flavor: game.i18n.localize("PF1.Base"),
      })
    );
    const cMult = actorData.details.carryCapacity.multiplier.user || 0;
    changes.push(
      new pf1.components.ItemChange({
        formula: cMult,
        target: "carryMult",
        type: "untyped",
        priority: 1000,
        flavor: game.i18n.localize("PF1.Custom"),
      })
    );
  }

  // NPC Lite Sheet Values for Init, CMD, BAB and AC
  {
    const liteValues = {
      init: null,
      cmd: null,
      bab: null,
      ac: (data) => data.normal,
    };

    for (const [key, valfn] of Object.entries(liteValues)) {
      let value = actorData.attributes[key];
      if (typeof valfn === "function") value = valfn(value);
      value = value.value;

      if (value !== undefined) {
        changes.push(
          new pf1.components.ItemChange({
            formula: value,
            trget: key,
            type: "base",
            flavor: game.i18n.localize("PF1.Custom"),
            operator: "set",
          })
        );
      }
    }
  }

  // Natural armor
  {
    const ac = actorData.attributes.naturalAC || 0;
    changes.push(
      new pf1.components.ItemChange({
        formula: ac,
        target: "nac",
        type: "untyped",
        flavor: game.i18n.format("PF1.CustomBonusType", { type: game.i18n.localize("PF1.NaturalArmor") }),
      })
    );
  }
  // Add armor bonuses from equipment
  this.itemTypes.equipment
    .filter((item) => item.system.equipped)
    .forEach((item) => {
      let armorTarget = "aac";
      if (item.system.subType === "shield") armorTarget = "sac";
      // Push base armor
      if (item.system.armor.value || item.system.armor.enh) {
        const baseAC = item.isBroken ? Math.floor(item.system.armor.value / 2) : item.system.armor.value;
        const enhAC = item.system.armor.enh;
        changes.push(
          new pf1.components.ItemChange(
            {
              formula: baseAC,
              target: armorTarget,
              type: "base",
            },
            { parent: item }
          )
        );
        changes.push(
          new pf1.components.ItemChange(
            {
              formula: enhAC,
              target: armorTarget,
              type: "enhancement",
            },
            { parent: item }
          )
        );
      }
    });

  // Add fly bonuses or penalties based on maneuverability
  {
    const flyKey = actorData.attributes.speed.fly.maneuverability;
    let flyValue = 0;
    if (flyKey != null) flyValue = pf1.config.flyManeuverabilityValues[flyKey];
    if (flyValue !== 0) {
      changes.push(
        new pf1.components.ItemChange({
          formula: flyValue,
          target: "skill.fly",
          type: "racial",
          flavor: game.i18n.localize("PF1.Movement.FlyManeuverability.Label"),
        })
      );
    }
  }
  // Add swim and climb skill bonuses based on having speeds for them
  {
    changes.push(
      new pf1.components.ItemChange({
        formula: "(min(1, @attributes.speed.climb.total) * 8)",
        operator: "add",
        target: "skill.clm",
        type: "racial",
        priority: -1,
        flavor: game.i18n.localize("PF1.Movement.Mode.climb"),
      })
    );

    changes.push(
      new pf1.components.ItemChange({
        formula: "(min(1, @attributes.speed.swim.total) * 8)",
        operator: "add",
        target: "skill.swm",
        type: "racial",
        priority: -1,
        flavor: game.i18n.localize("PF1.Movement.Mode.swim"),
      })
    );
  }

  // Negative level to skills
  {
    changes.push(
      new pf1.components.ItemChange({
        formula: "-@attributes.energyDrain",
        operator: "add",
        target: "skills",
        type: "untypedPerm",
        flavor: game.i18n.localize("PF1.NegativeLevels"),
      })
    );
  }

  // Add size bonuses to various attributes
  // AC
  changes.push(
    new pf1.components.ItemChange({
      formula: "lookup(@size + 1, 0, " + Object.values(pf1.config.sizeMods).join(", ") + ")",
      target: "ac",
      type: "size",
      flavor: game.i18n.localize("PF1.ModifierType.size"),
      priority: -1000,
    })
  );
  // Stealth skill
  changes.push(
    new pf1.components.ItemChange({
      formula: "lookup(@size + 1, 0, " + Object.values(pf1.config.sizeStealthMods).join(", ") + ")",
      target: "skill.ste",
      type: "size",
      flavor: game.i18n.localize("PF1.ModifierType.size"),
      priority: -1000,
    })
  );
  // Fly skill
  changes.push(
    new pf1.components.ItemChange({
      formula: "lookup(@size + 1, 0, " + Object.values(pf1.config.sizeFlyMods).join(", ") + ")",
      target: "skill.fly",
      type: "size",
      flavor: game.i18n.localize("PF1.ModifierType.size"),
      priority: -1000,
    })
  );
  // CMD
  changes.push(
    new pf1.components.ItemChange({
      formula: "lookup(@size + 1, 0, " + Object.values(pf1.config.sizeSpecialMods).join(", ") + ")",
      target: "cmd",
      type: "size",
      flavor: game.i18n.localize("PF1.ModifierType.size"),
      priority: -1000,
    })
  );

  // Custom skill rank bonus from sheet
  if (this.system.details?.bonusSkillRankFormula) {
    changes.push(
      new pf1.components.ItemChange({
        formula: this.system.details.bonusSkillRankFormula,
        target: "bonusSkillRanks",
        type: "untyped",
        flavor: game.i18n.localize("PF1.SkillBonusRankFormula"),
      })
    );
  }

  // Add conditions
  for (const [con, v] of Object.entries(actorData.conditions)) {
    if (!v) continue;
    const condition = pf1.registry.conditions.get(con);
    if (!condition) continue;

    const mechanic = condition.mechanics;
    if (!mechanic) continue;

    // Add changes
    for (const change of mechanic.changes ?? []) {
      // Alter change data
      const changeData = { ...change, flavor: condition.name };

      // Create change object
      const changeObj = new pf1.components.ItemChange(changeData);
      changes.push(changeObj);
    }

    // Set flags
    for (const flag of mechanic.flags ?? []) {
      this.changeFlags[flag] = true;
    }
  }

  // Negative level to hit points and init
  if (actorData.attributes.energyDrain > 0) {
    changes.push(
      new pf1.components.ItemChange({
        formula: "-(@attributes.energyDrain * 5)",
        operator: "add",
        target: "mhp",
        type: "untyped",
        priority: -750,
        flavor: game.i18n.localize("PF1.NegativeLevels"),
      })
    );

    changes.push(
      new pf1.components.ItemChange({
        formula: "-(@attributes.energyDrain * 5)",
        operator: "add",
        target: "vigor",
        type: "untyped",
        priority: -750,
        flavor: game.i18n.localize("PF1.NegativeLevels"),
      })
    );
  }
};

/**
 * Set actor skill baseline values.
 */
function resetSkills() {
  const actorData = this.system;
  const skills = actorData.skills;

  const csBonus = pf1.config.classSkillBonus;

  const resetSkill = (skill) => {
    const rank = skill.rank || 0;
    skill.mod = rank + (skill.cs && rank > 0 ? csBonus : 0);
  };

  for (const [skillKey, skill] of Object.entries(skills)) {
    if (!skill) {
      console.warn(`Bad skill data for "${skillKey}"`, this);
      continue;
    }

    resetSkill(skill);

    for (const [subSkillKey, subSkill] of Object.entries(skill.subSkills || {})) {
      if (!subSkill) {
        console.warn(`Bad subskill data for "${skillKey}.${subSkillKey}"`, this);
      } else {
        resetSkill(subSkill);
      }
    }
  }
}

/**
 * Finalize actor skill values.
 */
function finalizeSkills() {
  const actorData = this.system;
  const skills = actorData.skills;
  if (!skills) return; // Vehicles, Traps and Haunts have no skills

  const abilities = actorData.abilities;

  const acpPenaltyValue = actorData.attributes?.acp?.skill ?? 0;

  const finalizeSkill = (skill) => {
    const acpPenalty = skill.acp ? acpPenaltyValue : 0;
    const abilityModifier = abilities[skill.ability]?.mod || 0;
    skill.mod += abilityModifier - acpPenalty;
  };

  for (const [skillKey, skill] of Object.entries(skills)) {
    if (!skill) continue;
    finalizeSkill(skill);
    for (const [subSkillKey, subSkill] of Object.entries(skill.subSkills || {})) {
      if (!subSkill) continue;
      finalizeSkill(subSkill);
    }
  }
}

export const getSourceInfo = function (obj, key) {
  obj[key] ??= { negative: [], positive: [] };
  return obj[key];
};

export const setSourceInfoByName = function (obj, key, name, value, positive = true) {
  const target = positive ? "positive" : "negative";
  const sourceInfo = getSourceInfo(obj, key)[target];
  const data = sourceInfo.find((o) => o.name === name);
  if (data) data.value = value;
  else {
    sourceInfo.push({
      name: name,
      value: value,
    });
  }
};

/**
 * @param {ItemChange[]} changes - An array containing all changes to check. Must be called after they received a value (by ItemChange.applyChange)
 * @param {object} [options]
 * @param {boolean} [options.ignoreTarget] - Whether to only check for modifiers such as enhancement, insight (true) or whether the target (AC, weapon damage) is also important (false)
 * @returns {ItemChange[]} - A list of processed changes, excluding the lower-valued ones inserted (if they don't stack)
 */
export const getHighestChanges = function (changes, options = { ignoreTarget: false }) {
  const highestTemplate = {
    value: 0,
    ids: [],
    highestID: null,
  };
  const highest = Object.keys(pf1.config.bonusTypes).reduce((cur, k) => {
    if (options.ignoreTarget) cur[k] = foundry.utils.deepClone(highestTemplate);
    else cur[k] = {};
    return cur;
  }, {});

  for (const c of changes) {
    let h;
    if (options.ignoreTarget) h = highest[c.type];
    else h = highest[c.type]?.[c.target];

    if (!h) continue; // Ignore bad changes
    h.ids.push(c._id);
    if (h.value < c.value || !h.highestID) {
      h.value = c.value;
      h.highestID = c._id;
    }
  }

  {
    let mod, h;
    const filterFunc = function (c) {
      if (h.highestID === c._id) return true;
      if (pf1.config.stackingBonusTypes.indexOf(mod) === -1 && h.ids.includes(c._id)) return false;
      return true;
    };

    for (mod of Object.keys(highest)) {
      if (options.ignoreTarget) {
        h = highest[mod];
        changes = changes.filter(filterFunc);
      } else {
        for (const subTarget of Object.keys(highest[mod])) {
          h = highest[mod][subTarget];
          changes = changes.filter(filterFunc);
        }
      }
    }
  }

  return changes;
};
