import { PF1 } from "../../../config.mjs";
import { RollPF } from "../../../dice/roll.mjs";
import { fractionalToString } from "@utils";
import { callOldNamespaceHookAll } from "@utils/hooks.mjs";

/**
 * @this {import("@actor/actor-pf.mjs").ActorPF}
 */
export function applyChanges() {
  this.changeOverrides = {};
  const changes = Array.from(this.changes);

  const priority = getSortChangePriority.call(this);
  const _sortChanges = function (a, b) {
    const typeA = priority.types.indexOf(a.subTarget);
    const typeB = priority.types.indexOf(b.subTarget);
    const modA = priority.modifiers.indexOf(a.modifier);
    const modB = priority.modifiers.indexOf(b.modifier);
    let prioA = typeof a.priority === "string" ? parseInt(a.priority) : a.priority;
    let prioB = typeof b.priority === "string" ? parseInt(b.priority) : b.priority;
    prioA = (prioA || 0) + 1000;
    prioB = (prioB || 0) + 1000;

    return prioB - prioA || typeA - typeB || modA - modB;
  };

  // Organize changes by priority
  changes.sort((a, b) => _sortChanges.call(this, a, b));

  // Parse change flags
  for (const i of this.changeItems) {
    for (const [k, v] of Object.entries(i.system.changeFlags)) {
      if (v === true) {
        this.changeFlags[k] = true;

        if (k === "loseDexToAC") {
          for (const k2 of ["normal", "touch"]) {
            getSourceInfo(this.sourceInfo, `system.attributes.ac.${k2}.total`).negative.push({
              value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC"),
              name: i.name,
              type: i.type,
            });
          }
          getSourceInfo(this.sourceInfo, "system.attributes.cmd.total").negative.push({
            value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC"),
            name: i.name,
            type: i.type,
          });
        }
      }
    }
  }
  this.refreshDerivedData();

  // Determine continuous changes
  const continuousChanges = changes.filter((o) => o.continuous === true);

  // Apply all changes
  for (let a = 0; a < changes.length; a++) {
    const change = changes[a];
    let flats = getChangeFlat.call(this, change.subTarget, change.modifier);
    if (!(flats instanceof Array)) flats = [flats];
    for (const f of flats) {
      if (!this.changeOverrides[f]) this.changeOverrides[f] = createOverride();
    }

    change.applyChange(this, flats, { applySourceInfo: false });

    // Apply continuous changes
    for (const cc of continuousChanges) {
      if (cc === change) continue;

      let flats = getChangeFlat.call(this, cc.subTarget, cc.modifier);
      if (!(flats instanceof Array)) flats = [flats];
      for (const f of flats) {
        if (!this.changeOverrides[f]) this.changeOverrides[f] = createOverride();
      }

      cc.applyChange(this, flats, { applySourceInfo: false });
    }

    this.refreshDerivedData();
  }

  // Apply source info for changes
  for (const change of changes) {
    change.applySourceInfo(this);
  }

  resetSkills.call(this);
}

const createOverride = function () {
  const result = {
    add: {},
    set: {},
  };

  for (const k of Object.keys(CONFIG.PF1.bonusModifiers)) {
    result.add[k] = null;
    result.set[k] = null;
  }

  return result;
};

const getSortChangePriority = function () {
  /** @type {[string, {sort: number}][]}*/
  const skillTargets = this._skillTargets.map((target, index) => [target, { sort: 76000 + index * 10 }]);
  const buffTargets = Object.entries(PF1.buffTargets);
  const types = [...skillTargets, ...buffTargets]
    .sort(([, { sort: aSort }], [, { sort: bSort }]) => aSort - bSort)
    .map(([target]) => target);

  return {
    types: types,
    modifiers: [
      "untyped",
      "untypedPerm",
      "base",
      "enh",
      "dodge",
      "inherent",
      "deflection",
      "morale",
      "luck",
      "sacred",
      "insight",
      "resist",
      "profane",
      "trait",
      "racial",
      "size",
      "competence",
      "circumstance",
      "alchemical",
      "penalty",
    ],
  };
};

export const getChangeFlat = function (changeTarget, changeType, curData = null) {
  if (changeTarget == null) return null;

  curData = curData ?? this.system;
  /** @type {string[]} */
  const result = [];

  switch (changeTarget) {
    case "mhp":
      result.push("system.attributes.hp.max");
      break;
    case "wounds":
      result.push("system.attributes.wounds.max");
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
      if (changeType === "penalty") {
        result.push(`system.abilities.${changeTarget}.penalty`);
        break;
      }
      if (["base", "untypedPerm"].includes(changeType)) {
        result.push(`system.abilities.${changeTarget}.total`, `system.abilities.${changeTarget}.base`);
        break;
      }
      result.push(`system.abilities.${changeTarget}.total`);
      break;
    case "strMod":
    case "dexMod":
    case "conMod":
    case "intMod":
    case "wisMod":
    case "chaMod":
      result.push(`system.abilities.${changeTarget.slice(0, 3)}.mod`);
      break;
    case "carryStr":
      result.push("system.details.carryCapacity.bonus.total");
      break;
    case "carryMult":
      result.push("system.details.carryCapacity.multiplier.total");
      break;
    case "ac":
      switch (changeType) {
        case "dodge":
          result.push(
            "system.attributes.ac.normal.total",
            "system.attributes.ac.touch.total",
            "system.attributes.cmd.total"
          );
          break;
        case "deflection":
          result.push(
            "system.attributes.ac.normal.total",
            "system.attributes.ac.touch.total",
            "system.attributes.ac.flatFooted.total",
            "system.attributes.cmd.total",
            "system.attributes.cmd.flatFootedTotal"
          );
          break;
        case "circumstance":
        case "insight":
        case "luck":
        case "morale":
        case "profane":
        case "sacred":
          result.push(
            "system.attributes.ac.normal.total",
            "system.attributes.ac.touch.total",
            "system.attributes.ac.flatFooted.total",
            "system.attributes.cmd.total",
            "system.attributes.cmd.flatFootedTotal"
          );
          break;
        default:
          result.push(
            "system.attributes.ac.normal.total",
            "system.attributes.ac.touch.total",
            "system.attributes.ac.flatFooted.total"
          );
          break;
      }
      break;
    case "aac": {
      const targets = ["system.ac.normal.total"];
      switch (changeType) {
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
      switch (changeType) {
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
      switch (changeType) {
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
    case "mattack":
      result.push("system.attributes.attack.melee");
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
        result.push(`system.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (const b of Object.keys(skl.subSkills)) {
            result.push(`system.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      break;
    case "~skillMods":
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
    case "strSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "str") result.push(`system.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "str")
              result.push(`system.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      break;
    case "dexSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "dex") result.push(`system.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "dex")
              result.push(`system.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      break;
    case "conSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "con") result.push(`system.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "con")
              result.push(`system.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      break;
    case "intSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "int") result.push(`system.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "int")
              result.push(`system.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      break;
    case "wisSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "wis") result.push(`system.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "wis")
              result.push(`system.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      break;
    case "chaSkills":
      for (const [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "cha") result.push(`system.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (const [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "cha")
              result.push(`system.skills.${a}.subSkills.${b}.changeBonus`);
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
        const base = curData.attributes.speed[speedKey]?.base;
        if (base !== undefined) result.push(`system.attributes.speed.${speedKey}.total`);
      }
      break;
    case "landSpeed":
      if (changeType === "base") return ["system.attributes.speed.land.total"];
      result.push("system.attributes.speed.land.add", "system.attributes.speed.land.total");
      break;
    case "climbSpeed":
      if (changeType === "base") {
        result.push("system.attributes.speed.climb.total");
        break;
      }
      result.push("system.attributes.speed.climb.add", "system.attributes.speed.climb.total");
      break;
    case "swimSpeed":
      if (changeType === "base") {
        result.push("system.attributes.speed.swim.total");
        break;
      }
      result.push("system.attributes.speed.swim.add", "system.attributes.speed.swim.total");
      break;
    case "burrowSpeed":
      if (changeType === "base") {
        result.push("system.attributes.speed.burrow.total");
        break;
      }
      result.push("system.attributes.speed.burrow.add", "system.attributes.speed.burrow.total");
      break;
    case "flySpeed":
      if (changeType === "base") {
        result.push("system.attributes.speed.fly.total");
        break;
      }
      result.push("system.attributes.speed.fly.add", "system.attributes.speed.fly.total");
      break;
    case "cmb":
      result.push("system.attributes.cmb.bonus");
      break;
    case "cmd":
      if (changeType === "dodge") {
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
    case "wdamage":
      result.push("system.attributes.damage.weapon");
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
  }

  if (changeTarget.match(/^skill\.([a-zA-Z0-9]+)$/)) {
    const sklKey = RegExp.$1;
    if (curData.skills[sklKey] != null) {
      result.push(`system.skills.${sklKey}.changeBonus`);
    }
  } else if (changeTarget.match(/^skill\.([a-zA-Z0-9]+)\.subSkills\.([a-zA-Z0-9_]+)$/)) {
    const sklKey = RegExp.$1;
    const subSklKey = RegExp.$2;
    if (curData.skills[sklKey]?.subSkills?.[subSklKey] != null) {
      result.push(`system.skills.${sklKey}.subSkills.${subSklKey}.changeBonus`);
    }
  }

  // Call hooks to enable modules to add or adjust the result array
  callOldNamespaceHookAll("pf1.getChangeFlat", "pf1GetChangeFlat", changeTarget, changeType, { keys: result });
  Hooks.callAll("pf1GetChangeFlat", changeTarget, changeType, result, curData);

  // Return results directly when deprecation is removed
  return result.map((key) => {
    if (key.startsWith("data.")) {
      const fixedKey = key.replace("data.", "system.");
      foundry.utils.logCompatibilityWarning(
        `Change targets pointing towards "data." (${key}) are deprecated. Use "system." (${fixedKey}) instead.`,
        { since: "PF1 0.82.0", until: "PF1 0.83.0" }
      );
      return fixedKey;
    }
    return key;
  });
};

const getBabTotal = function (d) {
  return d.attributes.bab.total;
};

const getNegativeEnergyDrain = function (d) {
  return -d.attributes.energyDrain;
};

const getAbilityMod = function (ability) {
  return function (d) {
    return d.abilities[ability]?.mod ?? 0;
  };
};

export const addDefaultChanges = function (changes) {
  const actorData = this.system;
  // Call hook
  const tempChanges = [];
  callOldNamespaceHookAll("pf1.addDefaultChanges", "pf1AddDefaultChanges", this, tempChanges);
  Hooks.callAll("pf1AddDefaultChanges", this, tempChanges);
  changes.push(...tempChanges.filter((c) => c instanceof pf1.components.ItemChange));

  // Class hit points
  const allClasses = this.items.filter((item) => item.type === "class").sort((a, b) => a.sort - b.sort);
  // Categorize classes
  const [classes, racialHD] = allClasses.reduce(
    (all, cls) => {
      if (cls.subType === "racial") all[1].push(cls);
      else all[0].push(cls);
      return all;
    },
    [[], []]
  );

  const healthConfig = game.settings.get("pf1", "healthConfig");
  const classOptions = this.type === "character" ? healthConfig.hitdice.PC : healthConfig.hitdice.NPC;
  const raceOptions = healthConfig.hitdice.Racial;
  const round = { up: Math.ceil, nearest: Math.round, down: Math.floor }[healthConfig.rounding];
  const continuous = { discrete: false, continuous: true }[healthConfig.continuity];

  const pushHealth = (value, source) => {
    changes.push(
      new pf1.components.ItemChange({
        formula: value,
        target: "misc",
        subTarget: "mhp",
        modifier: "untypedPerm",
        flavor: source.name,
      })
    );
    changes.push(
      new pf1.components.ItemChange({
        formula: value,
        target: "misc",
        subTarget: "vigor",
        modifier: "untypedPerm",
        flavor: source.name,
      })
    );
  };
  const manualHealth = (healthSource) => {
    let health = healthSource.system.hp + (healthSource.system.subType === "base") * healthSource.system.fc.hp.value;

    if (!continuous) health = round(health);
    pushHealth(health, healthSource);
  };
  const autoHealth = (healthSource, options, maximized = 0) => {
    if (healthSource.system.hd === 0) return;

    let dieHealth = 1 + (healthSource.system.hd - 1) * options.rate;
    if (!continuous) dieHealth = round(dieHealth);

    const hitDice = healthSource.hitDice;
    const maxedHealth = Math.min(hitDice, maximized) * healthSource.system.hd;
    const levelHealth = Math.max(0, hitDice - maximized) * dieHealth;
    const favorHealth = (healthSource.system.subType === "base") * healthSource.system.fc.hp.value;
    const health = maxedHealth + levelHealth + favorHealth;

    pushHealth(health, healthSource);
  };
  const computeHealth = (healthSources, options) => {
    // Compute and push health, tracking the remaining maximized levels.
    if (options.auto) {
      let maximized = options.maximized;
      for (const hd of healthSources) {
        autoHealth(hd, options, maximized);
        const hitDice = hd.hitDice;
        maximized = Math.max(0, maximized - hitDice);
      }
    } else healthSources.forEach((race) => manualHealth(race));
  };

  computeHealth(racialHD, raceOptions);
  computeHealth(classes, classOptions);

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
            target: "savingThrows",
            subTarget: a,
            modifier: "untypedPerm",
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
          target: "savingThrows",
          subTarget: a,
          modifier: "untypedPerm",
          flavor: game.i18n.localize("PF1.Base"),
        })
      );
    }

    // Fractional bonus +2 when one class has good save
    if (useFractional && hasGoodSave) {
      const goodSaveFormula = CONFIG.PF1.classFractionalSavingThrowFormulas.goodSaveBonus;
      const total = RollPF.safeRoll(goodSaveFormula).total;
      changes.push(
        new pf1.components.ItemChange({
          formula: total,
          target: "savingThrows",
          subTarget: a,
          modifier: "untypedPerm",
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
        formula: (d) => d.abilities[hpAbility].mod * d.attributes.hd.total,
        operator: "function",
        target: "misc",
        subTarget: "mhp",
        modifier: "base",
        flavor: CONFIG.PF1.abilities[hpAbility],
      })
    );

    if (!getProperty(this, "system.attributes.wounds.base")) {
      changes.push(
        new pf1.components.ItemChange({
          formula: (d) => d.abilities[hpAbility].total * 2 + d.abilities[hpAbility].drain,
          operator: "function",
          target: "misc",
          subTarget: "wounds",
          modifier: "base",
          flavor: CONFIG.PF1.abilities[hpAbility],
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
        target: "speed",
        subTarget: `${k}Speed`,
        modifier: "base",
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
        formula: getBabTotal,
        operator: "function",
        target: "attack",
        subTarget: "~attackCore",
        modifier: "untypedPerm",
        flavor: game.i18n.localize("PF1.BAB"),
      })
    );
    // Energy drain to attack
    changes.push(
      new pf1.components.ItemChange({
        formula: getNegativeEnergyDrain,
        operator: "function",
        target: "attack",
        subTarget: "~attackCore",
        modifier: "untypedPerm",
        flavor: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      })
    );
    // ACP to attack
    changes.push(
      new pf1.components.ItemChange({
        formula: (d) => -d.attributes.acp.attackPenalty,
        operator: "function",
        target: "attack",
        subTarget: "~attackCore",
        modifier: "penalty",
        flavor: game.i18n.localize("PF1.ArmorCheckPenalty"),
      })
    );
  }

  // Add variables to CMD
  {
    // BAB to CMD
    changes.push(
      new pf1.components.ItemChange({
        formula: getBabTotal,
        operator: "function",
        target: "misc",
        subTarget: "cmd",
        modifier: "untypedPerm",
        flavor: game.i18n.localize("PF1.BAB"),
      })
    );
    // Strength or substitute to CMD
    const strAbl = actorData.attributes.cmd.strAbility;
    if (strAbl in CONFIG.PF1.abilities) {
      changes.push(
        new pf1.components.ItemChange({
          formula: `@abilities.${strAbl}.mod`,
          target: "misc",
          subTarget: "cmd",
          modifier: "untypedPerm",
          flavor: CONFIG.PF1.abilities[strAbl],
        })
      );
    }
    // Energy Drain to CMD
    changes.push(
      new pf1.components.ItemChange({
        formula: getNegativeEnergyDrain,
        operator: "function",
        target: "misc",
        subTarget: "cmd",
        modifier: "untypedPerm",
        flavor: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      })
    );
  }

  // Add Dexterity Modifier to Initiative
  {
    const abl = actorData.attributes.init.ability;
    if (abl) {
      changes.push(
        new pf1.components.ItemChange({
          formula: getAbilityMod(abl),
          operator: "function",
          target: "misc",
          subTarget: "init",
          modifier: "untypedPerm",
          priority: -100,
          flavor: CONFIG.PF1.abilities[abl],
        })
      );
    }

    // Add ACP penalty
    if (["str", "dex"].includes(abl)) {
      changes.push(
        new pf1.components.ItemChange({
          formula: (d) => -d.attributes.acp.attackPenalty,
          operator: "function",
          target: "misc",
          subTarget: "init",
          modifier: "penalty",
          priority: -100,
          flavor: game.i18n.localize("PF1.ArmorCheckPenalty"),
        })
      );
    }
  }

  // Add Ability modifiers and Energy Drain to saving throws
  {
    // Ability Mod to Fortitude
    let abl = actorData.attributes.savingThrows.fort.ability;
    if (abl) {
      changes.push(
        new pf1.components.ItemChange({
          formula: getAbilityMod(abl),
          operator: "function",
          target: "savingThrows",
          subTarget: "fort",
          modifier: "untypedPerm",
          flavor: CONFIG.PF1.abilities[abl],
        })
      );
    }
    // Ability Mod to Reflex
    abl = actorData.attributes.savingThrows.ref.ability;
    if (abl) {
      changes.push(
        new pf1.components.ItemChange({
          formula: getAbilityMod(abl),
          operator: "function",
          target: "savingThrows",
          subTarget: "ref",
          modifier: "untypedPerm",
          flavor: CONFIG.PF1.abilities[abl],
        })
      );
    }
    // Ability Mod to Will
    abl = actorData.attributes.savingThrows.will.ability;
    if (abl) {
      changes.push(
        new pf1.components.ItemChange({
          formula: getAbilityMod(abl),
          operator: "function",
          target: "savingThrows",
          subTarget: "will",
          modifier: "untypedPerm",
          flavor: CONFIG.PF1.abilities[abl],
        })
      );
    }
    // Energy Drain
    changes.push(
      new pf1.components.ItemChange({
        formula: getNegativeEnergyDrain,
        operator: "function",
        target: "savingThrows",
        subTarget: "allSavingThrows",
        modifier: "penalty",
        flavor: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      })
    );
  }
  // Spell Resistance
  {
    const sr = actorData.attributes.sr.formula || 0;
    changes.push(
      new pf1.components.ItemChange({
        formula: sr,
        target: "misc",
        subTarget: "spellResist",
        modifier: "base",
        priority: 1000,
        flavor: game.i18n.localize("PF1.Base"),
      })
    );
  }
  {
    // Carry capacity strength bonus
    const cStr = actorData.details.carryCapacity.bonus.user || 0;
    changes.push(
      new pf1.components.ItemChange({
        formula: cStr,
        target: "misc",
        subTarget: "carryStr",
        modifier: "untyped",
        priority: 1000,
        flavor: game.i18n.localize("PF1.Custom"),
      })
    );
    // Carry capacity multiplier
    const cMultBase = actorData.details.carryCapacity.multiplier.base ?? 1;
    changes.push(
      new pf1.components.ItemChange({
        formula: cMultBase,
        target: "misc",
        subTarget: "carryMult",
        modifier: "base",
        priority: 1000,
        flavor: game.i18n.localize("PF1.Base"),
      })
    );
    const cMult = actorData.details.carryCapacity.multiplier.user || 0;
    changes.push(
      new pf1.components.ItemChange({
        formula: cMult,
        target: "misc",
        subTarget: "carryMult",
        modifier: "untyped",
        priority: 1000,
        flavor: game.i18n.localize("PF1.Custom"),
      })
    );
  }
  // Natural armor
  {
    const ac = actorData.attributes.naturalAC || 0;
    changes.push(
      new pf1.components.ItemChange({
        formula: ac,
        subTarget: "nac",
        modifier: "base",
        flavor: game.i18n.localize("PF1.EquipTypeNatural"),
      })
    );
  }
  // Add armor bonuses from equipment
  this.items
    .filter((obj) => {
      return obj.type === "equipment" && obj.system.equipped;
    })
    .forEach((item) => {
      let armorTarget = "aac";
      if (item.system.subType === "shield") armorTarget = "sac";
      // Push base armor
      if (item.system.armor.value || item.system.armor.enh) {
        const baseAC = item.system.broken ? Math.floor(item.system.armor.value / 2) : item.system.armor.value;
        const enhAC = item.system.armor.enh;
        changes.push(
          new pf1.components.ItemChange(
            {
              formula: baseAC,
              subTarget: armorTarget,
              modifier: "base",
            },
            item
          )
        );
        changes.push(
          new pf1.components.ItemChange(
            {
              formula: enhAC,
              subTarget: armorTarget,
              modifier: "enhancement",
            },
            item
          )
        );
      }
    });

  // Add fly bonuses or penalties based on maneuverability
  {
    const flyKey = actorData.attributes.speed.fly.maneuverability;
    let flyValue = 0;
    if (flyKey != null) flyValue = CONFIG.PF1.flyManeuverabilityValues[flyKey];
    if (flyValue !== 0) {
      changes.push(
        new pf1.components.ItemChange({
          formula: flyValue,
          target: "skill",
          subTarget: "skill.fly",
          modifier: "racial",
          flavor: game.i18n.localize("PF1.FlyManeuverability"),
        })
      );
    }
  }
  // Add swim and climb skill bonuses based on having speeds for them
  {
    changes.push(
      new pf1.components.ItemChange({
        formula: (d) => (d.attributes.speed.climb.total > 0 ? 8 : 0),
        operator: "function",
        target: "skill",
        subTarget: "skill.clm",
        modifier: "racial",
        priority: -1,
        flavor: game.i18n.localize("PF1.SpeedClimb"),
      })
    );

    changes.push(
      new pf1.components.ItemChange({
        formula: (d) => (d.attributes.speed.swim.total > 0 ? 8 : 0),
        operator: "function",
        target: "skill",
        subTarget: "skill.swm",
        modifier: "racial",
        priority: -1,
        flavor: game.i18n.localize("PF1.SpeedSwim"),
      })
    );
  }

  // Add energy drain to skills
  {
    changes.push(
      new pf1.components.ItemChange({
        formula: getNegativeEnergyDrain,
        operator: "function",
        target: "skills",
        subTarget: "skills",
        modifier: "untypedPerm",
        flavor: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      })
    );
  }

  // Add size bonuses to various attributes
  const sizeKey = actorData.traits.size;
  if (sizeKey !== "med") {
    // AC
    changes.push(
      new pf1.components.ItemChange({
        formula: CONFIG.PF1.sizeMods[sizeKey],
        target: "ac",
        subTarget: "ac",
        modifier: "size",
        flavor: game.i18n.localize("PF1.BonusModifierSize"),
      })
    );
    // Stealth skill
    changes.push(
      new pf1.components.ItemChange({
        formula: CONFIG.PF1.sizeStealthMods[sizeKey],
        target: "skill",
        subTarget: "skill.ste",
        modifier: "size",
        flavor: game.i18n.localize("PF1.BonusModifierSize"),
      })
    );
    // Fly skill
    changes.push(
      new pf1.components.ItemChange({
        formula: CONFIG.PF1.sizeFlyMods[sizeKey],
        target: "skill",
        subTarget: "skill.fly",
        modifier: "size",
        flavor: game.i18n.localize("PF1.BonusModifierSize"),
      })
    );
    // CMD
    changes.push(
      new pf1.components.ItemChange({
        formula: CONFIG.PF1.sizeSpecialMods[sizeKey],
        target: "misc",
        subTarget: "cmd",
        modifier: "size",
        flavor: game.i18n.localize("PF1.BonusModifierSize"),
      })
    );
  }

  // Add conditions
  for (const [con, v] of Object.entries(actorData.attributes.conditions || {})) {
    if (!v) continue;

    const mechanic = CONFIG.PF1.conditionMechanics[con];
    if (!mechanic) continue;

    // Add changes
    for (const change of mechanic.changes ?? []) {
      // Alter change data
      const changeData = deepClone(change);
      changeData.flavor = CONFIG.PF1.conditions[con];

      // Create change object
      const changeObj = new pf1.components.ItemChange(changeData);
      changes.push(changeObj);
    }

    // Set flags
    for (const flag of mechanic.flags ?? []) {
      this.changeFlags[flag] = true;
    }
  }

  // Apply level drain to hit points
  if (!Number.isNaN(actorData.attributes.energyDrain) && actorData.attributes.energyDrain > 0) {
    changes.push(
      new pf1.components.ItemChange({
        formula: (d) => -d.attributes.energyDrain * 5,
        operator: "function",
        subTarget: "mhp",
        modifier: "untyped",
        priority: -750,
        flavor: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      })
    );

    changes.push(
      new pf1.components.ItemChange({
        formula: (d) => -d.attributes.energyDrain * 5,
        operator: "function",
        subTarget: "vigor",
        modifier: "untyped",
        priority: -750,
        flavor: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      })
    );
  }
};

const resetSkills = function () {
  const actorData = this.system;
  const skills = actorData.skills;

  for (const [skillKey, skill] of Object.entries(skills)) {
    if (!skill) {
      console.warn(`Bad skill data for "${skillKey}"`, this);
      continue;
    }

    let acpPenalty = skill.acp ? actorData.attributes.acp.total : 0;
    let ablMod = actorData.abilities[skill.ability]?.mod || 0;
    let specificSkillBonus = skill.changeBonus || 0;

    // Parse main skills
    let sklValue = skill.rank + (skill.cs && skill.rank > 0 ? 3 : 0) + ablMod + specificSkillBonus - acpPenalty;
    skill.mod = sklValue;

    // Parse sub-skills
    for (const [subSkillKey, subSkill] of Object.entries(skill.subSkills || {})) {
      if (!subSkill) {
        console.warn(`Bad subskill data for "${skillKey}.${subSkillKey}"`, this);
        continue;
      }

      acpPenalty = subSkill.acp ? actorData.attributes.acp.total : 0;
      ablMod = actorData.abilities[subSkill.ability]?.mod || 0;
      specificSkillBonus = subSkill.changeBonus || 0;
      sklValue = subSkill.rank + (subSkill.cs && subSkill.rank > 0 ? 3 : 0) + ablMod + specificSkillBonus - acpPenalty;
      subSkill.mod = sklValue;
    }
  }
};

export const getSourceInfo = function (obj, key) {
  if (!obj[key]) {
    obj[key] = { negative: [], positive: [] };
  }
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
  const highest = Object.keys(CONFIG.PF1.bonusModifiers).reduce((cur, k) => {
    if (options.ignoreTarget) cur[k] = duplicate(highestTemplate);
    else cur[k] = {};
    return cur;
  }, {});

  for (const c of changes) {
    let h;
    if (options.ignoreTarget) h = highest[c.modifier];
    else h = highest[c.modifier]?.[c.subTarget];

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
      if (CONFIG.PF1.stackingBonusModifiers.indexOf(mod) === -1 && h.ids.includes(c._id)) return false;
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
