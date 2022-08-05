import { PF1 } from "../../../config.mjs";
import { RollPF } from "../../../dice/roll.mjs";
import { fractionalToString } from "@utils";

/**
 *
 */
export function applyChanges() {
  this.changeOverrides = {};
  const c = Array.from(this.changes);

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
  c.sort((a, b) => _sortChanges.call(this, a, b));

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
  const continuousChanges = c.filter((o) => o.continuous === true);

  // Apply all changes
  for (const change of c) {
    let flats = getChangeFlat.call(this, change.subTarget, change.modifier);
    if (!(flats instanceof Array)) flats = [flats];
    for (const f of flats) {
      if (!this.changeOverrides[f]) this.changeOverrides[f] = createOverride();
    }

    change.applyChange(this, flats, this.changeFlags);

    // Apply continuous changes
    for (const cc of continuousChanges) {
      if (cc === change) continue;

      let flats = getChangeFlat.call(this, cc.subTarget, cc.modifier);
      if (!(flats instanceof Array)) flats = [flats];
      for (const f of flats) {
        if (!this.changeOverrides[f]) this.changeOverrides[f] = createOverride();
      }

      cc.applyChange(this, flats, this.changeFlags);
    }

    this.refreshDerivedData();
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
  const result = [];

  switch (changeTarget) {
    case "mhp":
      return "system.attributes.hp.max";
    case "wounds":
      return "system.attributes.wounds.max";
    case "vigor":
      return "system.attributes.vigor.max";
    case "str":
    case "dex":
    case "con":
    case "int":
    case "wis":
    case "cha":
      if (changeType === "penalty") return `system.abilities.${changeTarget}.penalty`;
      if (["base", "untypedPerm"].includes(changeType))
        return [`system.abilities.${changeTarget}.total`, `system.abilities.${changeTarget}.base`];
      return `system.abilities.${changeTarget}.total`;
    case "strMod":
    case "dexMod":
    case "conMod":
    case "intMod":
    case "wisMod":
    case "chaMod":
      return `system.abilities.${changeTarget.slice(0, 3)}.mod`;
    case "carryStr":
      return "system.details.carryCapacity.bonus.total";
    case "carryMult":
      return "system.details.carryCapacity.multiplier.total";
    case "ac":
      switch (changeType) {
        case "dodge":
          return [
            "system.attributes.ac.normal.total",
            "system.attributes.ac.touch.total",
            "system.attributes.cmd.total",
          ];
        case "deflection":
          return [
            "system.attributes.ac.normal.total",
            "system.attributes.ac.touch.total",
            "system.attributes.ac.flatFooted.total",
            "system.attributes.cmd.total",
            "system.attributes.cmd.flatFootedTotal",
          ];
        case "circumstance":
        case "insight":
        case "luck":
        case "morale":
        case "profane":
        case "sacred":
          return [
            "system.attributes.ac.normal.total",
            "system.attributes.ac.touch.total",
            "system.attributes.ac.flatFooted.total",
            "system.attributes.cmd.total",
            "system.attributes.cmd.flatFootedTotal",
          ];
        default:
          return [
            "system.attributes.ac.normal.total",
            "system.attributes.ac.touch.total",
            "system.attributes.ac.flatFooted.total",
          ];
      }
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
      return targets;
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
      return targets;
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
      return targets;
    }
    case "tac":
      return "system.attributes.ac.touch.total";
    case "ffac":
      return "system.attributes.ac.flatFooted.total";
    case "ffcmd":
      return "system.attributes.cmd.flatFootedTotal";
    case "bab":
      return "system.attributes.bab.total";
    case "~attackCore":
      return "system.attributes.attack.shared";
    case "attack":
      return "system.attributes.attack.general";
    case "mattack":
      return "system.attributes.attack.melee";
    case "rattack":
      return "system.attributes.attack.ranged";
    case "critConfirm":
      return "system.attributes.attack.critConfirm";
    case "allSavingThrows":
      return [
        "system.attributes.savingThrows.fort.total",
        "system.attributes.savingThrows.ref.total",
        "system.attributes.savingThrows.will.total",
      ];
    case "fort":
      return "system.attributes.savingThrows.fort.total";
    case "ref":
      return "system.attributes.savingThrows.ref.total";
    case "will":
      return "system.attributes.savingThrows.will.total";
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
      return result;
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
      return result;
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
      return result;
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
      return result;
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
      return result;
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
      return result;
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
      return result;
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
      return result;
    case "allChecks":
      return [
        "system.abilities.str.checkMod",
        "system.abilities.dex.checkMod",
        "system.abilities.con.checkMod",
        "system.abilities.int.checkMod",
        "system.abilities.wis.checkMod",
        "system.abilities.cha.checkMod",
        ...(this.system.attributes.init.ability ? ["system.attributes.init.total"] : []),
      ];
    case "strChecks":
      return [
        "system.abilities.str.checkMod",
        ...(this.system.attributes.init.ability === "str" ? ["system.attributes.init.total"] : []),
      ];
    case "dexChecks":
      return [
        "system.abilities.dex.checkMod",
        ...(this.system.attributes.init.ability === "dex" ? ["system.attributes.init.total"] : []),
      ];
    case "conChecks":
      return [
        "system.abilities.con.checkMod",
        ...(this.system.attributes.init.ability === "con" ? ["system.attributes.init.total"] : []),
      ];
    case "intChecks":
      return [
        "system.abilities.int.checkMod",
        ...(this.system.attributes.init.ability === "int" ? ["system.attributes.init.total"] : []),
      ];
    case "wisChecks":
      return [
        "system.abilities.wis.checkMod",
        ...(this.system.attributes.init.ability === "wis" ? ["system.attributes.init.total"] : []),
      ];
    case "chaChecks":
      return [
        "system.abilities.cha.checkMod",
        ...(this.system.attributes.init.ability === "cha" ? ["system.attributes.init.total"] : []),
      ];
    case "allSpeeds":
      for (const speedKey of Object.keys(curData.attributes.speed)) {
        const base = curData.attributes.speed[speedKey]?.base;
        if (base !== undefined) result.push(`system.attributes.speed.${speedKey}.total`);
      }
      return result;
    case "landSpeed":
      if (changeType === "base") return ["system.attributes.speed.land.total"];
      return ["system.attributes.speed.land.add", "system.attributes.speed.land.total"];
    case "climbSpeed":
      if (changeType === "base") return ["system.attributes.speed.climb.total"];
      return ["system.attributes.speed.climb.add", "system.attributes.speed.climb.total"];
    case "swimSpeed":
      if (changeType === "base") return ["system.attributes.speed.swim.total"];
      return ["system.attributes.speed.swim.add", "system.attributes.speed.swim.total"];
    case "burrowSpeed":
      if (changeType === "base") return ["system.attributes.speed.burrow.total"];
      return ["system.attributes.speed.burrow.add", "system.attributes.speed.burrow.total"];
    case "flySpeed":
      if (changeType === "base") return ["system.attributes.speed.fly.total"];
      return ["system.attributes.speed.fly.add", "system.attributes.speed.fly.total"];
    case "cmb":
      return "system.attributes.cmb.bonus";
    case "cmd":
      if (changeType === "dodge") return "system.attributes.cmd.total";
      return ["system.attributes.cmd.total", "system.attributes.cmd.flatFootedTotal"];
    case "init":
      return "system.attributes.init.total";
    case "acpA":
      return "system.attributes.acp.armorBonus";
    case "acpS":
      return "system.attributes.acp.shieldBonus";
    case "mDexA":
      return "system.attributes.mDex.armorBonus";
    case "mDexS":
      return "system.attributes.mDex.shieldBonus";
    case "spellResist":
      return "system.attributes.sr.total";
    case "damage":
      return "system.attributes.damage.general";
    case "wdamage":
      return "system.attributes.damage.weapon";
    case "sdamage":
      return "system.attributes.damage.spell";
  }

  if (changeTarget.match(/^skill\.([a-zA-Z0-9]+)$/)) {
    const sklKey = RegExp.$1;
    if (curData.skills[sklKey] != null) {
      return `system.skills.${sklKey}.changeBonus`;
    }
  } else if (changeTarget.match(/^skill\.([a-zA-Z0-9]+)\.subSkills\.([a-zA-Z0-9]+)$/)) {
    const sklKey = RegExp.$1;
    const subSklKey = RegExp.$2;
    if (curData.skills[sklKey]?.subSkills?.[subSklKey] != null) {
      return `system.skills.${sklKey}.subSkills.${subSklKey}.changeBonus`;
    }
  }

  // Try to determine a change flat from hooks
  {
    const result = { keys: [] };
    Hooks.callAll("pf1.getChangeFlat", changeTarget, changeType, result);
    if (result.keys && result.keys.length) return result.keys;
  }
  return null;
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
  Hooks.callAll("pf1.addDefaultChanges", this, tempChanges);
  changes.push(...tempChanges.filter((c) => c instanceof pf1.documentComponents.ItemChange));

  // Class hit points
  const classes = this.items
    .filter((o) => o.type === "class" && !["racial"].includes(o.classType))
    .sort((a, b) => {
      return a.sort - b.sort;
    });
  const racialHD = this.items
    .filter((o) => o.type === "class" && o.classType === "racial")
    .sort((a, b) => {
      return a.sort - b.sort;
    });

  const healthConfig = game.settings.get("pf1", "healthConfig");
  const cls_options = this.type === "character" ? healthConfig.hitdice.PC : healthConfig.hitdice.NPC;
  const race_options = healthConfig.hitdice.Racial;
  const round = { up: Math.ceil, nearest: Math.round, down: Math.floor }[healthConfig.rounding];
  const continuous = { discrete: false, continuous: true }[healthConfig.continuity];

  const push_health = (value, source) => {
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: value,
        target: "misc",
        subTarget: "mhp",
        modifier: "untypedPerm",
        source: source.name,
      })
    );
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: value,
        target: "misc",
        subTarget: "vigor",
        modifier: "untypedPerm",
        source: source.name,
      })
    );
  };
  const manual_health = (health_source) => {
    let health =
      health_source.system.hp + (health_source.system.classType === "base") * health_source.system.fc.hp.value;

    getSourceInfo(this.sourceInfo, "system.attributes.hp.max").positive.push({
      value: health_source.system.hp,
      name: game.i18n.format("PF1.SourceInfoSkillRank_ClassBase", { className: health_source.name }),
    });
    getSourceInfo(this.sourceInfo, "system.attributes.vigor.max").positive.push({
      value: health_source.system.hp,
      name: game.i18n.format("PF1.SourceInfoSkillRank_ClassBase", { className: health_source.name }),
    });
    if (health_source.system.fc.hp.value > 0) {
      getSourceInfo(this.sourceInfo, "system.attributes.hp.max").positive.push({
        value: health_source.system.fc.hp.value,
        name: game.i18n.format("PF1.SourceInfoSkillRank_ClassFC", { className: health_source.name }),
      });
      getSourceInfo(this.sourceInfo, "system.attributes.vigor.max").positive.push({
        value: health_source.system.fc.hp.value,
        name: game.i18n.format("PF1.SourceInfoSkillRank_ClassFC", { className: health_source.name }),
      });
    }

    if (!continuous) health = round(health);
    push_health(health, health_source);
  };
  const auto_health = (health_source, options, maximized = 0) => {
    if (health_source.system.hd === 0) return;

    let die_health = 1 + (health_source.system.hd - 1) * options.rate;
    if (!continuous) die_health = round(die_health);

    const maxed_health = Math.min(health_source.system.level, maximized) * health_source.system.hd;
    const level_health = Math.max(0, health_source.system.level - maximized) * die_health;
    const favor_health = (health_source.system.classType === "base") * health_source.system.fc.hp.value;
    const health = maxed_health + level_health + favor_health;

    getSourceInfo(this.sourceInfo, "system.attributes.hp.max").positive.push({
      value: maxed_health + level_health,
      name: game.i18n.format("PF1.SourceInfoSkillRank_ClassBase", { className: health_source.name }),
    });
    getSourceInfo(this.sourceInfo, "system.attributes.vigor.max").positive.push({
      value: maxed_health + level_health,
      name: game.i18n.format("PF1.SourceInfoSkillRank_ClassBase", { className: health_source.name }),
    });
    if (health_source.system.fc.hp.value > 0) {
      getSourceInfo(this.sourceInfo, "system.attributes.hp.max").positive.push({
        value: health_source.system.fc.hp.value,
        name: game.i18n.format("PF1.SourceInfoSkillRank_ClassFC", { className: health_source.name }),
      });
      getSourceInfo(this.sourceInfo, "system.attributes.vigor.max").positive.push({
        value: health_source.system.fc.hp.value,
        name: game.i18n.format("PF1.SourceInfoSkillRank_ClassFC", { className: health_source.name }),
      });
    }

    push_health(health, health_source);
  };
  const compute_health = (health_sources, options) => {
    // Compute and push health, tracking the remaining maximized levels.
    if (options.auto) {
      let maximized = options.maximized;
      for (const hd of health_sources) {
        auto_health(hd, options, maximized);
        maximized = Math.max(0, maximized - hd.system.level);
      }
    } else health_sources.forEach((race) => manual_health(race));
  };

  compute_health(racialHD, race_options);
  compute_health(classes, cls_options);

  // Add class data to saving throws
  const allClasses = [...classes, ...racialHD];
  const useFractional = game.settings.get("pf1", "useFractionalBaseBonuses") === true;
  for (const a of Object.keys(actorData.attributes.savingThrows)) {
    let hasGoodSave = false;
    const k = `system.attributes.savingThrows.${a}.total`;
    actorData.attributes.savingThrows[a].total = actorData.attributes.savingThrows[a]?.base ?? 0;

    const total = allClasses.reduce((cur, cls) => {
      const base = cls.system.savingThrows[a].base;

      if (!useFractional) {
        // Add per class change
        changes.push(
          new pf1.documentComponents.ItemChange({
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

      getSourceInfo(this.sourceInfo, k).positive.push({
        value: useFractional ? fractionalToString(base) : base,
        name: cls.name,
      });
      return cur + base;
    }, 0);

    if (useFractional) {
      // Add shared change with fractional
      changes.push(
        new pf1.documentComponents.ItemChange({
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
        new pf1.documentComponents.ItemChange({
          formula: total,
          target: "savingThrows",
          subTarget: a,
          modifier: "untypedPerm",
          flavor: game.i18n.localize("PF1.SavingThrowGoodFractionalBonus"),
        })
      );
      getSourceInfo(this.sourceInfo, k).positive.push({
        value: fractionalToString(total),
        name: game.i18n.localize("PF1.SavingThrowGoodFractionalBonus"),
      });
    }
  }

  // Add Constitution to HP
  const hpAbility = actorData.attributes.hpAbility;
  if (hpAbility) {
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: (d) => d.abilities[hpAbility].mod * d.attributes.hd.total,
        operator: "function",
        target: "misc",
        subTarget: "mhp",
        modifier: "base",
      })
    );
    getSourceInfo(this.sourceInfo, "system.attributes.hp.max").positive.push({
      formula: `@abilities.${hpAbility}.mod * @attributes.hd.total`,
      name: CONFIG.PF1.abilities[hpAbility],
    });

    if (!getProperty(this, "system.attributes.wounds.base")) {
      const woundFormula = `(@abilities.${hpAbility}.total * 2) + @abilities.${hpAbility}.drain`;
      changes.push(
        new pf1.documentComponents.ItemChange({
          formula: (d) => d.abilities[hpAbility].total * 2 + d.abilities[hpAbility].drain,
          operator: "function",
          target: "misc",
          subTarget: "wounds",
          modifier: "base",
        })
      );
      getSourceInfo(this.sourceInfo, "system.attributes.wounds.max").positive.push({
        formula: woundFormula,
        name: CONFIG.PF1.abilities[hpAbility],
      });
    }
  }

  // Add movement speed(s)
  for (const [k, s] of Object.entries(actorData.attributes.speed)) {
    let base = s.base;
    if (!base) base = 0;
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: base,
        target: "speed",
        subTarget: `${k}Speed`,
        modifier: "base",
        operator: "set",
        priority: 1001,
      })
    );
    if (base > 0) {
      getSourceInfo(this.sourceInfo, `system.attributes.speed.${k}.base`).positive.push({
        value: base,
        name: game.i18n.localize("PF1.Base"),
      });
    }
  }

  // Add base attack modifiers shared by all attacks
  {
    // BAB to attack
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: getBabTotal,
        operator: "function",
        target: "attack",
        subTarget: "~attackCore",
        modifier: "untypedPerm",
      })
    );
    getSourceInfo(this.sourceInfo, "system.attributes.attack.shared").positive.push({
      formula: "@attributes.bab.total",
      name: game.i18n.localize("PF1.BAB"),
    });
    // Energy drain to attack
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: getNegativeEnergyDrain,
        operator: "function",
        target: "attack",
        subTarget: "~attackCore",
        modifier: "untypedPerm",
      })
    );
    getSourceInfo(this.sourceInfo, "system.attributes.attack.shared").negative.push({
      formula: "-@attributes.energyDrain",
      name: game.i18n.localize("PF1.CondTypeEnergyDrain"),
    });
    // ACP to attack
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: (d) => -d.attributes.acp.attackPenalty,
        operator: "function",
        target: "attack",
        subTarget: "~attackCore",
        modifier: "penalty",
      })
    );
    getSourceInfo(this.sourceInfo, "system.attributes.attack.shared").negative.push({
      formula: "-@attributes.acp.attackPenalty",
      name: game.i18n.localize("PF1.ArmorCheckPenalty"),
    });
  }

  // Add variables to CMD
  {
    // BAB to CMD
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: getBabTotal,
        operator: "function",
        target: "misc",
        subTarget: "cmd",
        modifier: "untypedPerm",
      })
    );
    for (const k of ["total", "flatFootedTotal"]) {
      getSourceInfo(this.sourceInfo, `system.attributes.cmd.${k}`).positive.push({
        formula: "@attributes.bab.total",
        name: game.i18n.localize("PF1.BAB"),
      });
    }
    // Strength or substitute to CMD
    const strAbl = actorData.attributes.cmd.strAbility;
    if (strAbl in CONFIG.PF1.abilities) {
      changes.push(
        new pf1.documentComponents.ItemChange({
          formula: `@abilities.${strAbl}.mod`,
          target: "misc",
          subTarget: "cmd",
          modifier: "untypedPerm",
        })
      );
      for (const k of ["total", "flatFootedTotal"]) {
        getSourceInfo(this.sourceInfo, `system.attributes.cmd.${k}`).positive.push({
          formula: `@abilities.${strAbl}.mod`,
          name: CONFIG.PF1.abilities[strAbl],
        });
      }
    }
    // Energy Drain to CMD
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: getNegativeEnergyDrain,
        operator: "function",
        target: "misc",
        subTarget: "cmd",
        modifier: "untypedPerm",
        source: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      })
    );
    for (const k of ["total", "flatFootedTotal"]) {
      getSourceInfo(this.sourceInfo, `system.attributes.cmd.${k}`).negative.push({
        formula: "-@attributes.energyDrain",
        name: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      });
    }
  }

  // Add Dexterity Modifier to Initiative
  {
    const abl = actorData.attributes.init.ability;
    if (abl) {
      changes.push(
        new pf1.documentComponents.ItemChange({
          formula: getAbilityMod(abl),
          operator: "function",
          target: "misc",
          subTarget: "init",
          modifier: "untypedPerm",
          priority: -100,
        })
      );
      getSourceInfo(this.sourceInfo, "system.attributes.init.total").positive.push({
        formula: `@abilities.${abl}.mod`,
        name: CONFIG.PF1.abilities[abl],
      });
    }

    // Add ACP penalty
    if (["str", "dex"].includes(abl)) {
      changes.push(
        new pf1.documentComponents.ItemChange({
          formula: (d) => -d.attributes.acp.attackPenalty,
          operator: "function",
          target: "misc",
          subTarget: "init",
          modifier: "penalty",
          priority: -100,
        })
      );
      getSourceInfo(this.sourceInfo, "system.attributes.init.total").negative.push({
        formula: "-@attributes.acp.attackPenalty",
        name: game.i18n.localize("PF1.ArmorCheckPenalty"),
      });
    }
  }

  // Add Ability modifiers and Energy Drain to saving throws
  {
    // Ability Mod to Fortitude
    let abl = actorData.attributes.savingThrows.fort.ability;
    if (abl) {
      changes.push(
        new pf1.documentComponents.ItemChange({
          formula: getAbilityMod(abl),
          operator: "function",
          target: "savingThrows",
          subTarget: "fort",
          modifier: "untypedPerm",
          flavor: CONFIG.PF1.abilities[abl],
        })
      );
      getSourceInfo(this.sourceInfo, "system.attributes.savingThrows.fort.total").positive.push({
        formula: `@abilities.${abl}.mod`,
        name: CONFIG.PF1.abilities[abl],
      });
    }
    // Ability Mod to Reflex
    abl = actorData.attributes.savingThrows.ref.ability;
    if (abl) {
      changes.push(
        new pf1.documentComponents.ItemChange({
          formula: getAbilityMod(abl),
          operator: "function",
          target: "savingThrows",
          subTarget: "ref",
          modifier: "untypedPerm",
          flavor: CONFIG.PF1.abilities[abl],
        })
      );
      getSourceInfo(this.sourceInfo, "system.attributes.savingThrows.ref.total").positive.push({
        formula: `@abilities.${abl}.mod`,
        name: CONFIG.PF1.abilities[abl],
      });
    }
    // Ability Mod to Will
    abl = actorData.attributes.savingThrows.will.ability;
    if (abl) {
      changes.push(
        new pf1.documentComponents.ItemChange({
          formula: getAbilityMod(abl),
          operator: "function",
          target: "savingThrows",
          subTarget: "will",
          modifier: "untypedPerm",
          flavor: CONFIG.PF1.abilities[abl],
        })
      );
      getSourceInfo(this.sourceInfo, "system.attributes.savingThrows.will.total").positive.push({
        formula: `@abilities.${abl}.mod`,
        name: CONFIG.PF1.abilities[abl],
      });
    }
    // Energy Drain
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: getNegativeEnergyDrain,
        operator: "function",
        target: "savingThrows",
        subTarget: "allSavingThrows",
        modifier: "penalty",
        flavor: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      })
    );
    for (const k of Object.keys(actorData.attributes.savingThrows)) {
      getSourceInfo(this.sourceInfo, `system.attributes.savingThrows.${k}.total`).positive.push({
        formula: "-@attributes.energyDrain",
        name: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      });
    }
  }
  // Spell Resistance
  {
    const sr = actorData.attributes.sr.formula || 0;
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: sr,
        target: "misc",
        subTarget: "spellResist",
        modifier: "base",
        priority: 1000,
      })
    );
    getSourceInfo(this.sourceInfo, "system.attributes.sr.total").positive.push({
      formula: sr,
      name: game.i18n.localize("PF1.Base"),
    });
  }
  {
    // Carry capacity strength bonus
    const cStr = actorData.details.carryCapacity.bonus.user || 0;
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: cStr,
        target: "misc",
        subTarget: "carryStr",
        modifier: "untyped",
        priority: 1000,
      })
    );
    getSourceInfo(this.sourceInfo, "system.details.carryCapacity.bonus.total").positive.push({
      formula: cStr.toString(),
      name: game.i18n.localize("PF1.Custom"),
    });
    // Carry capacity multiplier
    const cMultBase = actorData.details.carryCapacity.multiplier.base ?? 1;
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: cMultBase,
        target: "misc",
        subTarget: "carryMult",
        modifier: "base",
        priority: 1000,
      })
    );
    getSourceInfo(this.sourceInfo, "system.details.carryCapacity.multiplier.total").positive.push({
      formula: cMultBase.toString(),
      name: game.i18n.localize("PF1.Base"),
    });
    const cMult = actorData.details.carryCapacity.multiplier.user || 0;
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: cMult,
        target: "misc",
        subTarget: "carryMult",
        modifier: "untyped",
        priority: 1000,
      })
    );
    getSourceInfo(this.sourceInfo, "system.details.carryCapacity.multiplier.total").positive.push({
      formula: cMult.toString(),
      name: game.i18n.localize("PF1.Custom"),
    });
  }
  // Natural armor
  {
    const ac = actorData.attributes.naturalAC || 0;
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: ac,
        target: "ac",
        subTarget: "nac",
        modifier: "base",
      })
    );
    for (const k of ["normal", "flatFooted"]) {
      getSourceInfo(this.sourceInfo, `system.attributes.ac.${k}.total`).positive.push({
        formula: ac.toString(),
        name: game.i18n.localize("PF1.BuffTarACNatural"),
      });
    }
  }
  // Add armor bonuses from equipment
  this.items
    .filter((obj) => {
      return obj.type === "equipment" && obj.system.equipped;
    })
    .forEach((item) => {
      let armorTarget = "aac";
      if (item.system.equipmentType === "shield") armorTarget = "sac";
      // Push base armor
      if (item.system.armor.value || item.system.armor.enh) {
        let ac = item.system.armor.value + item.system.armor.enh;
        if (item.system.broken) ac = Math.floor(ac / 2);
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: item.system.armor.value,
            target: "ac",
            subTarget: armorTarget,
            modifier: "base",
          })
        );
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: item.system.armor.enh,
            target: "ac",
            subTarget: armorTarget,
            modifier: "enhancement",
          })
        );
        for (const k of ["normal", "flatFooted"]) {
          getSourceInfo(this.sourceInfo, `system.attributes.ac.${k}.total`).positive.push({
            value: ac,
            name: item.name,
            type: item.type,
          });
        }
      }
    });

  // Add fly bonuses or penalties based on maneuverability
  {
    const flyKey = actorData.attributes.speed.fly.maneuverability;
    let flyValue = 0;
    if (flyKey != null) flyValue = CONFIG.PF1.flyManeuverabilityValues[flyKey];
    if (flyValue !== 0) {
      changes.push(
        new pf1.documentComponents.ItemChange({
          formula: flyValue,
          target: "skill",
          subTarget: "skill.fly",
          modifier: "racial",
        })
      );
      getSourceInfo(this.sourceInfo, "system.skills.fly.changeBonus").positive.push({
        value: flyValue,
        name: game.i18n.localize("PF1.FlyManeuverability"),
      });
    }
  }
  // Add swim and climb skill bonuses based on having speeds for them
  {
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: (d) => (d.attributes.speed.climb.total > 0 ? 8 : 0),
        operator: "function",
        target: "skill",
        subTarget: "skill.clm",
        modifier: "racial",
        priority: -1,
      })
    );
    getSourceInfo(this.sourceInfo, "system.skills.clm.changeBonus").positive.push({
      formula: "@attributes.speed.climb.total > 0 ? 8 : 0",
      name: game.i18n.localize("PF1.SpeedClimb"),
    });

    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: (d) => (d.attributes.speed.swim.total > 0 ? 8 : 0),
        operator: "function",
        target: "skill",
        subTarget: "skill.swm",
        modifier: "racial",
        priority: -1,
      })
    );
    getSourceInfo(this.sourceInfo, "system.skills.swm.changeBonus").positive.push({
      formula: "@attributes.speed.swim.total > 0 ? 8 : 0",
      name: game.i18n.localize("PF1.SpeedSwim"),
    });
  }

  // Add energy drain to skills
  {
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: getNegativeEnergyDrain,
        operator: "function",
        target: "skills",
        subTarget: "skills",
        modifier: "untypedPerm",
        flavor: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      })
    );
    const flats = getChangeFlat.call(this, "skills", "untyped");
    for (const f of flats) {
      getSourceInfo(this.sourceInfo, f).positive.push({
        formula: "-@attributes.energyDrain",
        name: game.i18n.localize("PF1.CondTypeEnergyDrain"),
      });
    }
  }

  // Add size bonuses to various attributes
  const sizeKey = actorData.traits.size;
  if (sizeKey !== "med") {
    // AC
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: CONFIG.PF1.sizeMods[sizeKey],
        target: "ac",
        subTarget: "ac",
        modifier: "size",
      })
    );
    for (const k of ["normal", "touch", "flatFooted"]) {
      getSourceInfo(this.sourceInfo, `system.attributes.ac.${k}.total`).positive.push({
        value: CONFIG.PF1.sizeMods[sizeKey],
        type: "size",
      });
    }
    // Stealth skill
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: CONFIG.PF1.sizeStealthMods[sizeKey],
        target: "skill",
        subTarget: "skill.ste",
        modifier: "size",
      })
    );
    getSourceInfo(this.sourceInfo, "system.skills.ste.changeBonus").positive.push({
      value: CONFIG.PF1.sizeStealthMods[sizeKey],
      type: "size",
    });
    // Fly skill
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: CONFIG.PF1.sizeFlyMods[sizeKey],
        target: "skill",
        subTarget: "skill.fly",
        modifier: "size",
      })
    );
    getSourceInfo(this.sourceInfo, "system.skills.fly.changeBonus").positive.push({
      value: CONFIG.PF1.sizeFlyMods[sizeKey],
      type: "size",
    });
    // CMD
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: CONFIG.PF1.sizeSpecialMods[sizeKey],
        target: "misc",
        subTarget: "cmd",
        modifier: "size",
      })
    );
    for (const k of ["total", "flatFootedTotal"]) {
      getSourceInfo(this.sourceInfo, `system.attributes.cmd.${k}`).positive.push({
        value: CONFIG.PF1.sizeSpecialMods[sizeKey],
        type: "size",
      });
    }
  }

  // Add conditions
  for (const [con, v] of Object.entries(actorData.attributes.conditions || {})) {
    if (!v) continue;

    switch (con) {
      case "pf1_blind":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -2,
            target: "ac",
            subTarget: "ac",
            modifier: "penalty",
          })
        );
        this.changeFlags["loseDexToAC"] = true;

        for (const k of [
          "system.attributes.ac.normal.total",
          "system.attributes.ac.touch.total",
          "system.attributes.ac.flatFooted.total",
          "system.attributes.cmd.total",
          "system.attributes.cmd.flatFootedTotal",
        ]) {
          getSourceInfo(this.sourceInfo, k).negative.push({
            value: -2,
            name: game.i18n.localize("PF1.CondBlind"),
          });
        }
        for (const k of [
          "system.attributes.ac.normal.total",
          "system.attributes.ac.touch.total",
          "system.attributes.cmd.total",
          "system.attributes.cmd.flatFootedTotal",
        ]) {
          getSourceInfo(this.sourceInfo, k).negative.push({
            value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC"),
            name: game.i18n.localize("PF1.CondBlind"),
          });
        }
        break;
      case "dazzled":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -1,
            target: "attack",
            subTarget: "attack",
            modifier: "penalty",
          })
        );
        getSourceInfo(this.sourceInfo, "system.attributes.attack.general").negative.push({
          value: -1,
          name: game.i18n.localize("PF1.CondDazzled"),
        });
        break;
      case "pf1_deaf":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -4,
            target: "misc",
            subTarget: "init",
            modifier: "penalty",
          })
        );
        getSourceInfo(this.sourceInfo, "system.attributes.init.total").negative.push({
          value: -4,
          name: game.i18n.localize("PF1.CondDeaf"),
        });
        break;
      case "entangled":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -4,
            target: "ability",
            subTarget: "dex",
            modifier: "penalty",
          })
        );
        getSourceInfo(this.sourceInfo, "system.abilities.dex.total").negative.push({
          value: -4,
          name: game.i18n.localize("PF1.CondEntangled"),
        });

        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -2,
            target: "attack",
            subTarget: "attack",
            modifier: "penalty",
            flavor: game.i18n.localize("PF1.CondEntangled"),
          })
        );
        getSourceInfo(this.sourceInfo, "system.attributes.attack.general").negative.push({
          value: -2,
          name: game.i18n.localize("PF1.CondEntangled"),
        });
        break;
      case "grappled":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -4,
            target: "ability",
            subTarget: "dex",
            modifier: "penalty",
          })
        );
        getSourceInfo(this.sourceInfo, "system.abilities.dex.total").negative.push({
          value: -4,
          name: game.i18n.localize("PF1.CondGrappled"),
        });

        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -2,
            target: "attack",
            subTarget: "attack",
            modifier: "penalty",
            flavor: game.i18n.localize("PF1.CondGrappled"),
          })
        );
        getSourceInfo(this.sourceInfo, "system.attributes.attack.general").negative.push({
          value: -2,
          name: game.i18n.localize("PF1.CondGrappled"),
        });
        break;
      case "helpless":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: 0,
            target: "ability",
            subTarget: "dex",
            modifier: "untypedPerm",
            operator: "set",
            priority: 1001,
            continuous: true,
          })
        );
        getSourceInfo(this.sourceInfo, "system.abilities.dex.total").negative.push({
          name: game.i18n.localize("PF1.CondHelpless"),
          value: game.i18n.localize("PF1.ChangeFlagNoDex"),
        });
        break;
      case "pf1_sleep":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: 0,
            target: "ability",
            subTarget: "dex",
            modifier: "untypedPerm",
            operator: "set",
            priority: 1001,
            continuous: true,
          })
        );
        getSourceInfo(this.sourceInfo, "system.abilities.dex.total").negative.push({
          name: game.i18n.localize("PF1.CondSleep"),
          value: game.i18n.localize("PF1.ChangeFlagNoDex"),
        });
        break;
      case "paralyzed":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: 0,
            target: "ability",
            subTarget: "dex",
            modifier: "untypedPerm",
            operator: "set",
            priority: 1001,
            continuous: true,
          })
        );
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: 0,
            target: "ability",
            subTarget: "str",
            modifier: "untypedPerm",
            operator: "set",
            priority: 1001,
            continuous: true,
          })
        );
        getSourceInfo(this.sourceInfo, "system.abilities.dex.total").negative.push({
          name: game.i18n.localize("PF1.CondParalyzed"),
          value: game.i18n.localize("PF1.ChangeFlagNoDex"),
        });
        getSourceInfo(this.sourceInfo, "system.abilities.str.total").negative.push({
          name: game.i18n.localize("PF1.CondParalyzed"),
          value: game.i18n.localize("PF1.ChangeFlagNoStr"),
        });
        break;
      case "pf1_prone":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -4,
            target: "attack",
            subTarget: "mattack",
            modifier: "penalty",
          })
        );
        getSourceInfo(this.sourceInfo, "system.attributes.attack.melee").negative.push({
          name: game.i18n.localize("PF1.CondProne"),
          value: -4,
        });
        break;
      case "pinned":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: "min(0, @abilities.dex.mod)",
            target: "ability",
            subTarget: "dexMod",
            modifier: "untyped",
            operator: "set",
            flavor: game.i18n.localize("PF1.CondPinned"),
            priority: 1001,
            continuous: true,
          })
        );
        this.changeFlags["loseDexToAC"] = true;
        getSourceInfo(this.sourceInfo, "system.abilities.dex.total").negative.push({
          name: game.i18n.localize("PF1.CondPinned"),
          value: game.i18n.localize("PF1.DenyDexBonus"),
        });
        for (const k of [
          "system.attributes.ac.normal.total",
          "system.attributes.ac.touch.total",
          "system.attributes.cmd.total",
        ]) {
          getSourceInfo(this.sourceInfo, k).negative.push({
            name: game.i18n.localize("PF1.CondPinned"),
            value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC"),
          });
        }

        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -4,
            target: "ac",
            subTarget: "ac",
            modifier: "penalty",
          })
        );
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -4,
            target: "misc",
            subTarget: "cmd",
            modifier: "penalty",
          })
        );
        for (const k of [
          "system.attributes.ac.normal.total",
          "system.attributes.ac.touch.total",
          "system.attributes.ac.flatFooted.total",
          "system.attributes.cmd.total",
          "system.attributes.cmd.flatFootedTotal",
        ]) {
          getSourceInfo(this.sourceInfo, k).negative.push({
            name: game.i18n.localize("PF1.CondPinned"),
            value: -4,
          });
        }
        break;
      case "cowering":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -2,
            target: "defense",
            subTarget: "ac",
            modifier: "penalty",
            flavor: game.i18n.localize("PF1.CondCowering"),
          })
        );
        this.changeFlags["loseDexToAC"] = true;

        for (const k of [
          "system.attributes.ac.normal.total",
          "system.attributes.ac.touch.total",
          "system.attributes.ac.flatFooted.total",
        ]) {
          getSourceInfo(this.sourceInfo, k).negative.push({
            name: game.i18n.localize("PF1.CondCowering"),
            value: -2,
          });
          getSourceInfo(this.sourceInfo, k).negative.push({
            name: game.i18n.localize("PF1.CondCowering"),
            value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC"),
          });
        }
        break;
      case "shaken":
      case "frightened":
      case "panicked":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -2,
            target: "attack",
            subTarget: "attack",
            modifier: "penalty",
            flavor: game.i18n.localize("PF1.CondFear"),
          })
        );
        getSourceInfo(this.sourceInfo, "system.attributes.attack.general").negative.push({
          value: -2,
          name: game.i18n.localize("PF1.CondFear"),
        });

        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -2,
            target: "savingThrows",
            subTarget: "allSavingThrows",
            modifier: "penalty",
            flavor: game.i18n.localize("PF1.CondFear"),
          })
        );
        for (const k of Object.keys(actorData.attributes.savingThrows)) {
          getSourceInfo(this.sourceInfo, `system.attributes.savingThrows.${k}.total`).negative.push({
            value: -2,
            name: game.i18n.localize("PF1.CondFear"),
          });
        }

        {
          changes.push(
            new pf1.documentComponents.ItemChange({
              formula: -2,
              target: "skills",
              subTarget: "skills",
              modifier: "penalty",
              flavor: game.i18n.localize("PF1.CondFear"),
            })
          );
          const flats = getChangeFlat.call(this, "skills", "penalty");
          for (const f of flats) {
            getSourceInfo(this.sourceInfo, f).negative.push({
              value: -2,
              name: game.i18n.localize("PF1.CondFear"),
            });
          }
        }

        {
          changes.push(
            new pf1.documentComponents.ItemChange({
              formula: -2,
              target: "abilityChecks",
              subTarget: "allChecks",
              modifier: "penalty",
              flavor: game.i18n.localize("PF1.CondFear"),
            })
          );
          const flats = getChangeFlat.call(this, "allChecks", "penalty");
          for (const f of flats) {
            getSourceInfo(this.sourceInfo, f).negative.push({
              value: -2,
              name: game.i18n.localize("PF1.CondFear"),
            });
          }
        }
        break;
      case "sickened":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -2,
            target: "attack",
            subTarget: "attack",
            modifier: "penalty",
            flavor: game.i18n.localize("PF1.CondSickened"),
          })
        );
        getSourceInfo(this.sourceInfo, "system.attributes.attack.general").negative.push({
          value: -2,
          name: game.i18n.localize("PF1.CondSickened"),
        });

        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -2,
            target: "damage",
            subTarget: "wdamage",
            modifier: "penalty",
            flavor: game.i18n.localize("PF1.CondSickened"),
          })
        );
        getSourceInfo(this.sourceInfo, "system.attributes.damage.weapon").negative.push({
          value: -2,
          name: game.i18n.localize("PF1.CondSickened"),
        });

        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -2,
            target: "savingThrows",
            subTarget: "allSavingThrows",
            modifier: "penalty",
          })
        );
        for (const k of Object.keys(actorData.attributes.savingThrows)) {
          getSourceInfo(this.sourceInfo, `system.attributes.savingThrows.${k}.total`).negative.push({
            value: -2,
            name: game.i18n.localize("PF1.CondSickened"),
          });
        }

        {
          changes.push(
            new pf1.documentComponents.ItemChange({
              formula: -2,
              target: "skills",
              subTarget: "skills",
              modifier: "penalty",
            })
          );
          const flats = getChangeFlat.call(this, "skills", "penalty");
          for (const f of flats) {
            getSourceInfo(this.sourceInfo, f).negative.push({
              value: -2,
              name: game.i18n.localize("PF1.CondSickened"),
            });
          }
        }

        {
          changes.push(
            new pf1.documentComponents.ItemChange({
              formula: -2,
              target: "abilityChecks",
              subTarget: "allChecks",
              modifier: "penalty",
            })
          );
          const flats = getChangeFlat.call(this, "allChecks", "penalty");
          for (const f of flats) {
            getSourceInfo(this.sourceInfo, f).negative.push({
              value: -2,
              name: game.i18n.localize("PF1.CondSickened"),
            });
          }
        }
        break;
      case "stunned":
        changes.push(
          new pf1.documentComponents.ItemChange({
            formula: -2,
            target: "ac",
            subTarget: "ac",
            modifier: "penalty",
          })
        );
        for (const k of Object.keys(actorData.attributes.ac)) {
          getSourceInfo(this.sourceInfo, `system.attributes.ac.${k}.total`).negative.push({
            value: -2,
            name: game.i18n.localize("PF1.CondStunned"),
          });
        }
        this.changeFlags["loseDexToAC"] = true;
        getSourceInfo(this.sourceInfo, "system.attributes.ac.normal.total").negative.push({
          name: game.i18n.localize("PF1.CondStunned"),
          value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC"),
        });
        getSourceInfo(this.sourceInfo, "system.attributes.ac.touch.total").negative.push({
          name: game.i18n.localize("PF1.CondStunned"),
          value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC"),
        });
        getSourceInfo(this.sourceInfo, "system.attributes.cmd.total").negative.push({
          name: game.i18n.localize("PF1.CondStunned"),
          value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC"),
        });
        break;
    }
  }

  // Handle fatigue and exhaustion so that they don't stack
  if (actorData.attributes.conditions.exhausted) {
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: -6,
        target: "ability",
        subTarget: "str",
        modifier: "penalty",
      })
    );
    getSourceInfo(this.sourceInfo, "system.abilities.str.total").negative.push({
      value: -6,
      name: game.i18n.localize("PF1.CondExhausted"),
    });

    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: -6,
        target: "ability",
        subTarget: "dex",
        modifier: "penalty",
      })
    );
    getSourceInfo(this.sourceInfo, "system.abilities.dex.total").negative.push({
      value: -6,
      name: game.i18n.localize("PF1.CondExhausted"),
    });
  } else if (actorData.attributes.conditions.fatigued) {
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: -2,
        target: "ability",
        subTarget: "str",
        modifier: "penalty",
      })
    );
    getSourceInfo(this.sourceInfo, "system.abilities.str.total").negative.push({
      value: -2,
      name: game.i18n.localize("PF1.CondFatigued"),
    });

    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: -2,
        target: "ability",
        subTarget: "dex",
        modifier: "penalty",
      })
    );
    getSourceInfo(this.sourceInfo, "system.abilities.dex.total").negative.push({
      value: -2,
      name: game.i18n.localize("PF1.CondFatigued"),
    });
  }

  // Apply level drain to hit points
  if (!Number.isNaN(actorData.attributes.energyDrain) && actorData.attributes.energyDrain > 0) {
    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: (d) => -d.attributes.energyDrain * 5,
        operator: "function",
        target: "misc",
        subTarget: "mhp",
        modifier: "untyped",
        priority: -750,
      })
    );
    getSourceInfo(this.sourceInfo, "system.attributes.hp.max").negative.push({
      formula: "-(@attributes.energyDrain * 5)",
      name: game.i18n.localize("PF1.CondTypeEnergyDrain"),
    });

    changes.push(
      new pf1.documentComponents.ItemChange({
        formula: (d) => -d.attributes.energyDrain * 5,
        operator: "function",
        target: "misc",
        subTarget: "vigor",
        modifier: "untyped",
        priority: -750,
      })
    );
    getSourceInfo(this.sourceInfo, "system.attributes.vigor.max").negative.push({
      formula: "-(@attributes.energyDrain * 5)",
      name: game.i18n.localize("PF1.CondTypeEnergyDrain"),
    });
  }
};

const resetSkills = function () {
  const actorData = this.system;
  const skills = actorData.skills;

  for (const [sklKey, skl] of Object.entries(skills)) {
    if (!skl) continue;

    let acpPenalty = skl.acp ? actorData.attributes.acp.total : 0;
    let ablMod = actorData.abilities[skl.ability]?.mod || 0;
    let specificSkillBonus = skl.changeBonus || 0;

    // Parse main skills
    let sklValue = skl.rank + (skl.cs && skl.rank > 0 ? 3 : 0) + ablMod + specificSkillBonus - acpPenalty;
    skl.mod = sklValue;

    // Parse sub-skills
    for (const [subSklKey, subSkl] of Object.entries(skl.subSkills || {})) {
      if (!subSkl) continue;
      const subSkill = skl.subSkills?.[subSklKey];
      if (!subSkill) continue;

      acpPenalty = subSkl.acp ? actorData.attributes.acp.total : 0;
      ablMod = actorData.abilities[subSkl.ability]?.mod || 0;
      specificSkillBonus = subSkl.changeBonus || 0;
      sklValue = subSkl.rank + (subSkl.cs && subSkl.rank > 0 ? 3 : 0) + ablMod + specificSkillBonus - acpPenalty;
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
    else h = highest[c.modifier][c.subTarget];

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
