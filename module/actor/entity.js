import { DicePF } from "../dice.js";
import { createTag, linkData } from "../lib.js";
import { refreshLightingAndSight } from "../low-light-vision.js";

/**
 * Extend the base Actor class to implement additional logic specialized for D&D5e.
 */
export class ActorPF extends Actor {
  get spellFailure() {
    return this.items.filter(o => { return o.type === "equipment" && o.data.data.equipped === true; }).reduce((cur, o) => {
      if (typeof o.data.data.spellFailure === "number") return cur + o.data.data.spellFailure;
      return cur;
    }, 0);
  }

  static _translateSourceInfo(type, subtype, name) {
    let result = "";
    if (type === "size") result = "Size";
    if (type === "buff") {
      result = "Buffs";
      if (subtype === "temp") result = "Temporary Buffs";
      if (subtype === "perm") result = "Permanent Buffs";
      if (subtype === "item") result = "Item Buffs";
      if (subtype === "misc") result = "Misc Buffs";
    }
    if (type === "equipment") result = "Equipment";
    if (type === "weapon") result = "Weapons";
    if (type === "feat") {
      result = "Feats";
      if (subtype === "classFeat") result = "Class Features";
      if (subtype === "trait") result = "Traits";
      if (subtype === "racial") result = "Racial Traits";
      if (subtype === "misc") result = "Misc Features";
    }

    if (!name || name.length === 0) return result;
    if (result === "") return name;
    return `${result} (${name})`;
  }

  static _getChangeItemSubtype(item) {
    if (item.type === "buff") return item.data.buffType;
    if (item.type === "feat") return item.data.featType;
    return "";
  }

  static _blacklistChangeData(data, changeTarget) {
    let result = duplicate(data.data);

    switch (changeTarget) {
      case "mhp":
        result.attributes.hp = null;
        result.skills = null;
        break;
      case "str":
        result.abilities.str = null;
        result.skills = null;
        result.attributes.savingThrows = null;
      case "con":
        result.abilities.con = null;
        result.attributes.hp = null;
        result.skills = null;
        result.attributes.savingThrows = null;
        break;
      case "dex":
        result.abilities.dex = null;
        result.attributes.ac = null;
        result.skills = null;
        result.attributes.savingThrows = null;
        break;
      case "int":
        result.abilities.int = null;
        result.skills = null;
        result.attributes.savingThrows = null;
        break;
      case "wis":
        result.abilities.wis = null;
        result.skills = null;
        result.attributes.savingThrows = null;
        break;
      case "cha":
        result.abilities.cha = null;
        result.skills = null;
        result.attributes.savingThrows = null;
        break;
      case "ac":
      case "aac":
      case "sac":
      case "nac":
        result.attributes.ac = null;
        break;
      case "attack":
      case "mattack":
      case "rattack":
        result.attributes.attack = null;
        break;
      case "damage":
      case "wdamage":
      case "sdamage":
        result.attributes.damage = null;
        break;
      case "allSavingThrows":
      case "fort":
      case "ref":
      case "will":
        result.attributes.savingThrows = null;
        break;
      case "skills":
      case "strSkills":
      case "dexSkills":
      case "conSkills":
      case "intSkills":
      case "wisSkills":
      case "chaSkills":
        result.skills = null;
        break;
      case "cmb":
        result.attributes.cmb = null;
        break;
      case "cmd":
        result.attributes.cmd = null;
        break;
      case "init":
        result.attributes.init = null;
        break;
    }

    if (changeTarget.match(/^data\.skills/)) {
      result.skills = null;
    }

    return result;
  }

  get _sortChangePriority() {
    const skillTargets = this._skillTargets;
    return { targets: [
      "ability", "misc", "ac", "attack", "damage", "savingThrows", "skills", "skill"
    ], types: [
        "str", "dex", "con", "int", "wis", "cha",
        "skills", "strSkills", "dexSkills", "conSkills", "intSkills", "wisSkills", "chaSkills", ...skillTargets,
        "allChecks", "strChecks", "dexChecks", "conChecks", "intChecks", "wisChecks", "chaChecks",
        "ac", "aac", "sac", "nac",
        "attack", "mattack", "rattack",
        "damage", "wdamage", "sdamage",
        "allSavingThrows", "fort", "ref", "will",
        "cmb", "cmd", "init", "mhp"
    ], modifiers: [
      "untyped", "base", "enh", "dodge", "inherent", "deflection",
      "morale", "luck", "sacred", "insight", "resist", "profane",
      "trait", "racial", "size", "competence", "circumstance",
      "alchemical", "penalty"
    ]};
  }

  get _skillTargets() {
    let skills = [];
    let subSkills = [];
    for (let [sklKey, skl] of Object.entries(this.data.data.skills)) {
      if (skl == null) continue;
      if (skl.subSkills != null) {
        for (let subSklKey of Object.keys(skl.subSkills)) {
          subSkills.push(`skill.${sklKey}.subSkills.${subSklKey}`);
        }
      }
      else skills.push(`skill.${sklKey}`);
    }
    return [...skills, ...subSkills];
  }

  _sortChanges(a, b) {
    const targetA = a.raw[1];
    const targetB = b.raw[1];
    const typeA = a.raw[2];
    const typeB = b.raw[2];
    const modA = a.raw[3];
    const modB = b.raw[3];
    const priority = this._sortChangePriority;
    let firstSort = priority.types.indexOf(typeA) - priority.types.indexOf(typeB);
    let secondSort = priority.modifiers.indexOf(modA) - priority.modifiers.indexOf(modB);
    let thirdSort = priority.targets.indexOf(targetA) - priority.targets.indexOf(targetB);
    secondSort += (Math.sign(firstSort) * priority.types.length);
    thirdSort += (Math.sign(secondSort) * priority.modifiers.length);
    return firstSort + secondSort + thirdSort;
  }

  _parseChange(change, changeData, flags) {
    if (flags == null) flags = {};
    const changeType = change.raw[3];
    const changeValue = change.raw[4];

    if (!changeData[changeType]) return;
    if (changeValue === 0) return;
    if (flags.loseDexToAC && changeType === "dodge") return;

    change.source.value = changeValue;

    const prevValue = { positive: changeData[changeType].positive.value, negative: changeData[changeType].negative.value };
    // Add value
    if (changeValue > 0) {
      if (["untyped", "dodge", "penalty"].includes(changeType)) changeData[changeType].positive.value += changeValue;
      else {
        changeData[changeType].positive.value = Math.max(changeData[changeType].positive.value, changeValue);
      }
    }
    else {
      if (["untyped", "dodge", "penalty"].includes(changeType)) changeData[changeType].negative.value += changeValue;
      else changeData[changeType].negative.value = Math.min(changeData[changeType].negative.value, changeValue);
    }

    // Add source
    if (changeValue > 0) {
      if (["untyped", "dodge", "penalty"].includes(changeType)) {
        const compareData = changeData[changeType].positive.sources.filter(o => { return o.type === change.source.type && o.subtype === change.source.subtype; });
        if (compareData.length > 0) compareData[0].value += changeValue;
        else {
          changeData[changeType].positive.sources.push(change.source);
        }
      }
      else if (prevValue.positive < changeValue) {
        changeData[changeType].positive.sources = [change.source];
      }
    }
    else {
      if (["untyped", "dodge", "penalty"].includes(changeType)) {
        const compareData = changeData[changeType].negative.sources.filter(o => { return o.type === change.source.type && o.subtype === change.source.subtype; });
        if (compareData.length > 0) compareData[0].value += changeValue;
        else {
          changeData[changeType].negative.sources.push(change.source);
        }
      }
      else if (prevValue.negative > changeValue) {
        changeData[changeType].negative.sources = [change.source];
      }
    }
  }

  _getChangeFlat(changeTarget, changeType, curData) {
    if (curData == null) curData = this.data.data;
    let result = [];

    switch(changeTarget) {
      case "mhp":
        return "data.attributes.hp.max";
      case "str":
        if (changeType === "penalty") return "data.abilities.str.penalty";
        return "data.abilities.str.total";
      case "dex":
        if (changeType === "penalty") return "data.abilities.dex.penalty";
        return "data.abilities.dex.total";
      case "con":
        if (changeType === "penalty") return "data.abilities.con.penalty";
        return "data.abilities.con.total";
      case "int":
        if (changeType === "penalty") return "data.abilities.int.penalty";
        return "data.abilities.int.total";
      case "wis":
        if (changeType === "penalty") return "data.abilities.wis.penalty";
        return "data.abilities.wis.total";
      case "cha":
        if (changeType === "penalty") return "data.abilities.cha.penalty";
        return "data.abilities.cha.total";
      case "ac":
        if (changeType === "dodge") return ["data.attributes.ac.normal.total", "data.attributes.ac.touch.total", "data.attributes.cmd.total"];
        else if (changeType === "deflection") {
          return ["data.attributes.ac.normal.total", "data.attributes.ac.touch.total",
          "data.attributes.ac.flatFooted.total", "data.attributes.cmd.total", "data.attributes.cmd.flatFootedTotal"];
        }
        return ["data.attributes.ac.normal.total", "data.attributes.ac.touch.total", "data.attributes.ac.flatFooted.total"];
      case "aac":
      case "sac":
      case "nac":
        return ["data.attributes.ac.normal.total", "data.attributes.ac.flatFooted.total"];
      case "attack":
        return "data.attributes.attack.general";
      case "mattack":
        return "data.attributes.attack.melee";
      case "rattack":
        return "data.attributes.attack.ranged";
      case "damage":
        return "data.attributes.damage.general";
      case "wdamage":
        return "data.attributes.damage.weapon";
      case "sdamage":
        return "data.attributes.damage.spell";
      case "allSavingThrows":
        return ["data.attributes.savingThrows.fort.total", "data.attributes.savingThrows.ref.total", "data.attributes.savingThrows.will.total"];
      case "fort":
        return "data.attributes.savingThrows.fort.total";
      case "ref":
        return "data.attributes.savingThrows.ref.total";
      case "will":
        return "data.attributes.savingThrows.will.total";
      case "skills":
        for (let [a, skl] of Object.entries(curData.skills)) {
          if (skl == null) continue;
          result.push(`data.skills.${a}.changeBonus`);

          if (skl.subSkills != null) {
            for (let b of Object.keys(skl.subSkills)) {
              result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
            }
          }
        }
        return result;
      case "strSkills":
        for (let [a, skl] of Object.entries(curData.skills)) {
          if (skl == null) continue;
          if (skl.ability === "str") result.push(`data.skills.${a}.changeBonus`);

          if (skl.subSkills != null) {
            for (let [b, subSkl] of Object.keys(skl.subSkills)) {
              if (subSkl != null && subSkl.ability === "str") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
            }
          }
        }
        return result;
      case "dexSkills":
        for (let [a, skl] of Object.entries(curData.skills)) {
          if (skl == null) continue;
          if (skl.ability === "dex") result.push(`data.skills.${a}.changeBonus`);

          if (skl.subSkills != null) {
            for (let [b, subSkl] of Object.keys(skl.subSkills)) {
              if (subSkl != null && subSkl.ability === "dex") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
            }
          }
        }
        return result;
      case "conSkills":
        for (let [a, skl] of Object.entries(curData.skills)) {
          if (skl == null) continue;
          if (skl.ability === "con") result.push(`data.skills.${a}.changeBonus`);

          if (skl.subSkills != null) {
            for (let [b, subSkl] of Object.keys(skl.subSkills)) {
              if (subSkl != null && subSkl.ability === "con") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
            }
          }
        }
        return result;
      case "intSkills":
        for (let [a, skl] of Object.entries(curData.skills)) {
          if (skl == null) continue;
          if (skl.ability === "int") result.push(`data.skills.${a}.changeBonus`);

          if (skl.subSkills != null) {
            for (let [b, subSkl] of Object.keys(skl.subSkills)) {
              if (subSkl != null && subSkl.ability === "int") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
            }
          }
        }
        return result;
      case "wisSkills":
        for (let [a, skl] of Object.entries(curData.skills)) {
          if (skl == null) continue;
          if (skl.ability === "wis") result.push(`data.skills.${a}.changeBonus`);

          if (skl.subSkills != null) {
            for (let [b, subSkl] of Object.keys(skl.subSkills)) {
              if (subSkl != null && subSkl.ability === "wis") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
            }
          }
        }
        return result;
      case "chaSkills":
        for (let [a, skl] of Object.entries(curData.skills)) {
          if (skl == null) continue;
          if (skl.ability === "cha") result.push(`data.skills.${a}.changeBonus`);

          if (skl.subSkills != null) {
            for (let [b, subSkl] of Object.keys(skl.subSkills)) {
              if (subSkl != null && subSkl.ability === "cha") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
            }
          }
        }
        return result;
      case "allChecks":
        return ["data.abilities.str.checkMod", "data.abilities.dex.checkMod", "data.abilities.con.checkMod",
          "data.abilities.int.checkMod", "data.abilities.wis.checkMod", "data.abilities.cha.checkMod"];
      case "strChecks":
        return "data.abilities.str.checkMod";
      case "dexChecks":
        return "data.abilities.dex.checkMod";
      case "conChecks":
        return "data.abilities.con.checkMod";
      case "intChecks":
        return "data.abilities.int.checkMod";
      case "wisChecks":
        return "data.abilities.wis.checkMod";
      case "chaChecks":
        return "data.abilities.cha.checkMod";
      case "cmb":
        return "data.attributes.cmb.total";
      case "cmd":
        return ["data.attributes.cmd.total", "data.attributes.cmd.flatFootedTotal"];
      case "init":
        return "data.attributes.init.total";
    }

    if (changeTarget.match(/^skill\.([a-zA-Z0-9]+)$/)) {
      const sklKey = RegExp.$1;
      if (curData.skills[sklKey] != null) {
        return `data.skills.${sklKey}.changeBonus`;
      }
    }
    else if (changeTarget.match(/^skill\.([a-zA-Z0-9]+)\.subSkills\.([a-zA-Z0-9]+)$/)) {
      const sklKey = RegExp.$1;
      const subSklKey = RegExp.$2;
      if (curData.skills[sklKey] != null && curData.skills[sklKey].subSkills[subSklKey] != null) {
        return `data.skills.${sklKey}.subSkills.${subSklKey}.changeBonus`;
      }
    }

    return null;
  }

  _addDefaultChanges(data, changes, flags, sourceInfo) {
    // Add Constitution to HP
    changes.push({
      raw: ["@abilities.con.mod * @attributes.hd.total", "misc", "mhp", "base", 0],
      source: {
        name: "Constitution"
      }
    });

    // Add armor bonuses from equipment
    this.data.items.filter(obj => { return obj.type === "equipment" && obj.data.equipped; }).forEach(item => {
      let armorTarget = "aac";
      if (item.data.armor.type === "shield") armorTarget = "sac";
      else if (item.data.armor.type === "natural") armorTarget = "nac";
      // Push base armor
      if (item.data.armor.value) {
        changes.push({
          raw: [item.data.armor.value.toString(), "ac", armorTarget, "base", 0],
          source: {
            type: item.type,
            name: item.name
          }
        });
      }
      // Push enhancement bonus to armor
      if (item.data.armor.enh) {
        changes.push({
          raw: [item.data.armor.enh.toString(), "ac", armorTarget, "enh", 0],
          source: {
            type: item.type,
            name: item.name
          }
        });
      }
    });

    // Add size bonuses to various attributes
    const sizeKey = data.traits.size;
    if (sizeKey !== "med") {
      // AC
      changes.push({
        raw: [CONFIG.PF1.sizeMods[sizeKey].toString(), "ac", "ac", "size", 0],
        source: {
          type: "size"
        }
      });
      // Stealth skill
      changes.push({
        raw: [CONFIG.PF1.sizeStealthMods[sizeKey].toString(), "skill", "skill.ste", "size", 0],
        source: {
          type: "size"
        }
      });
      // Fly skill
      changes.push({
        raw: [CONFIG.PF1.sizeFlyMods[sizeKey].toString(), "skill", "skill.fly", "size", 0],
        source: {
          type: "size"
        }
      });
      // CMB
      changes.push({
        raw: [CONFIG.PF1.sizeSpecialMods[sizeKey].toString(), "misc", "cmb", "size", 0],
        source: {
          type: "size"
        }
      });
      // CMD
      changes.push({
        raw: [CONFIG.PF1.sizeSpecialMods[sizeKey].toString(), "misc", "cmd", "size", 0],
        source: {
          type: "size"
        }
      });
    }

    // Add conditions
    for (let [con, v] of Object.entries(data.attributes.conditions || {})) {
      if (!v) continue;

      switch (con) {
        case "blind":
          changes.push({
            raw: ["-2", "ac", "ac", "penalty", 0],
            source: { name: "Blind" }
          });
          flags["loseDexToAC"] = true;
          sourceInfo["data.attributes.ac.normal.total"] = sourceInfo["data.attributes.ac.normal.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.ac.touch.total"] = sourceInfo["data.attributes.ac.touch.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.cmd.total"] = sourceInfo["data.attributes.cmd.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.ac.normal.total"].negative.push({ name: "Blind", value: "Lose Dex to AC" });
          sourceInfo["data.attributes.ac.touch.total"].negative.push({ name: "Blind", value: "Lose Dex to AC" });
          sourceInfo["data.attributes.cmd.total"].negative.push({ name: "Blind", value: "Lose Dex to AC" });
          break;
        case "dazzled":
          changes.push({
            raw: ["-1", "attack", "attack", "penalty", 0],
            source: { name: "Dazzled" }
          });
          break;
        case "deaf":
          changes.push({
            raw: ["-4", "misc", "init", "penalty", 0],
            source: { name: "Deaf" }
          });
          break;
        case "entangled":
          changes.push({
            raw: ["-4", "ability", "dex", "penalty", 0],
            source: { name: "Entangled" }
          });
          changes.push({
            raw: ["-2", "attack", "attack", "penalty", 0],
            source: { name: "Entangled" }
          });
          break;
        case "grappled":
          changes.push({
            raw: ["-4", "ability", "dex", "penalty", 0],
            source: { name: "Grappled" }
          });
          changes.push({
            raw: ["-2", "attack", "attack", "penalty", 0],
            source: { name: "Grappled" }
          });
          changes.push({
            raw: ["-2", "misc", "cmb", "penalty", 0],
            source: { name: "Grappled" }
          });
          break;
        case "helpless":
          flags["noDex"] = true;
          sourceInfo["data.abilities.dex.total"] = sourceInfo["data.abilities.dex.total"] || { positive: [], negative: [] };
          sourceInfo["data.abilities.dex.total"].negative.push({ name: "Helpless", value: "0 Dex" });
          break;
        case "paralyzed":
          flags["noDex"] = true;
          flags["noStr"] = true;
          sourceInfo["data.abilities.dex.total"] = sourceInfo["data.abilities.dex.total"] || { positive: [], negative: [] };
          sourceInfo["data.abilities.dex.total"].negative.push({ name: "Paralyzed", value: "0 Dex" });
          sourceInfo["data.abilities.str.total"] = sourceInfo["data.abilities.str.total"] || { positive: [], negative: [] };
          sourceInfo["data.abilities.str.total"].negative.push({ name: "Paralyzed", value: "0 Str" });
          break;
        case "pinned":
          flags["loseDexToAC"] = true;
          sourceInfo["data.attributes.ac.normal.total"] = sourceInfo["data.attributes.ac.normal.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.ac.touch.total"] = sourceInfo["data.attributes.ac.touch.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.cmd.total"] = sourceInfo["data.attributes.cmd.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.ac.normal.total"].negative.push({ name: "Pinned", value: "Lose Dex to AC" });
          sourceInfo["data.attributes.ac.touch.total"].negative.push({ name: "Pinned", value: "Lose Dex to AC" });
          sourceInfo["data.attributes.cmd.total"].negative.push({ name: "Pinned", value: "Lose Dex to AC" });
          break;
        case "fear":
          changes.push({
            raw: ["-2", "attack", "attack", "penalty", 0],
            source: { name: "Fear" }
          });
          changes.push({
            raw: ["-2", "savingThrows", "allSavingThrows", "penalty", 0],
            source: { name: "Fear" }
          });
          changes.push({
            raw: ["-2", "skills", "skills", "penalty", 0],
            source: { name: "Fear" }
          });
          changes.push({
            raw: ["-2", "abilityChecks", "allChecks", "penalty", 0],
            source: { name: "Fear" }
          });
          break;
        case "sickened":
          changes.push({
            raw: ["-2", "attack", "attack", "penalty", 0],
            source: { name: "Sickened" }
          });
          changes.push({
            raw: ["-2", "damage", "wdamage", "penalty", 0],
            source: { name: "Sickened" }
          });
          changes.push({
            raw: ["-2", "savingThrows", "allSavingThrows", "penalty", 0],
            source: { name: "Sickened" }
          });
          changes.push({
            raw: ["-2", "skills", "skills", "penalty", 0],
            source: { name: "Sickened" }
          });
          changes.push({
            raw: ["-2", "abilityChecks", "allChecks", "penalty", 0],
            source: { name: "Sickened" }
          });
          break;
        case "stunned":
          changes.push({
            raw: ["-2", "ac", "ac", "penalty", 0],
            source: { name: "Stunned" }
          });
          flags["loseDexToAC"] = true;
          sourceInfo["data.attributes.ac.normal.total"] = sourceInfo["data.attributes.ac.normal.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.ac.touch.total"] = sourceInfo["data.attributes.ac.touch.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.cmd.total"] = sourceInfo["data.attributes.cmd.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.ac.normal.total"].negative.push({ name: "Stunned", value: "Lose Dex to AC" });
          sourceInfo["data.attributes.ac.touch.total"].negative.push({ name: "Stunned", value: "Lose Dex to AC" });
          sourceInfo["data.attributes.cmd.total"].negative.push({ name: "Stunned", value: "Lose Dex to AC" });
          break;
      }
    }

    // Handle fatigue and exhaustion so that they don't stack
    if (data.attributes.conditions.exhausted) {
      changes.push({
        raw: ["-6", "ability", "str", "penalty", 0],
        source: { name: "Exhausted" }
      });
      changes.push({
        raw: ["-6", "ability", "dex", "penalty", 0],
        source: { name: "Exhausted" }
      });
    }
    else if (data.attributes.conditions.fatigued) {
      changes.push({
        raw: ["-2", "ability", "str", "penalty", 0],
        source: { name: "Fatigued" }
      });
      changes.push({
        raw: ["-2", "ability", "dex", "penalty", 0],
        source: { name: "Fatigued" }
      });
    }
  }

  async _updateChanges({ data=null, sourceOnly=false }={}) {
    const changeObjects = this.data.items.filter(obj => { return obj.data.changes != null; }).filter(obj => {
      if (obj.type === "buff") return obj.data.active;
      if (obj.type === "equipment" || obj.type === "weapon") return obj.data.equipped;
      return true;
    });
    let updateData = {};
    let srcData1 = mergeObject(this.data, expandObject(data || {}), { inplace: false });

    // Track previous values
    const prevValues = {
      mhp: this.data.data.attributes.hp.max
    };

    // Gather change types
    const changeData = {};
    const changeDataTemplate = {
      positive: {
        value: 0,
        sources: []
      },
      negative: {
        value: 0,
        sources: []
      }
    };
    for (let [key, buffTarget] of Object.entries(CONFIG.PF1.buffTargets)) {
      if (typeof buffTarget === "object") {
        // Add specific skills as targets
        if (key === "skill") {
          for (let [s, skl] of Object.entries(this.data.data.skills)) {
            if (skl == null) continue;
            if (!skl.subSkills) {
              changeData[`skill.${s}`] = {};
              Object.keys(CONFIG.PF1.bonusModifiers).forEach(b => {
                changeData[`skill.${s}`][b] = duplicate(changeDataTemplate);
              });
            }
            else {
              for (let s2 of Object.keys(skl.subSkills)) {
                changeData[`skill.${s}.subSkills.${s2}`] = {};
                Object.keys(CONFIG.PF1.bonusModifiers).forEach(b => {
                  changeData[`skill.${s}.subSkills.${s2}`][b] = duplicate(changeDataTemplate);
                });
              }
            }
          }
        }
        // Add static targets
        else {
          for (let subKey of Object.keys(buffTarget)) {
            if (subKey.startsWith("_")) continue;
            changeData[subKey] = {};
            Object.keys(CONFIG.PF1.bonusModifiers).forEach(b => {
              changeData[subKey][b] = duplicate(changeDataTemplate);
            });
          }
        }
      }
    };

    // Create an array of changes
    let allChanges = [];
    changeObjects.forEach(item => {
      item.data.changes.forEach(change => {
        allChanges.push({
          raw: change,
          source: {
            value: 0,
            type: item.type,
            subtype: this.constructor._getChangeItemSubtype(item),
            name: item.name,
            item: item
          }
        });
      });
    });

    // Add more changes
    let flags = {},
      sourceInfo = {};
    this._addDefaultChanges(srcData1.data, allChanges, flags, sourceInfo);

    // Check flags
    for (let obj of changeObjects) {
      if (!obj.data.changeFlags) continue;
      for (let [flagKey, flagValue] of Object.entries(obj.data.changeFlags)) {
        if (flagValue === true) {
          flags[flagKey] = true;

          let targets = [];
          let value = "";

          switch (flagKey) {
            case "loseDexToAC":
              sourceInfo["data.attributes.ac.normal.total"] = sourceInfo["data.attributes.ac.normal.total"] || { positive: [], negative: [] };
              sourceInfo["data.attributes.ac.touch.total"] = sourceInfo["data.attributes.ac.touch.total"] || { positive: [], negative: [] };
              sourceInfo["data.attributes.cmd.total"] = sourceInfo["data.attributes.cmd.total"] || { positive: [], negative: [] };
              targets = [
                sourceInfo["data.attributes.ac.normal.total"].negative,
                sourceInfo["data.attributes.ac.touch.total"].negative,
                sourceInfo["data.attributes.cmd.total"].negative
              ];
              value = "Lose Dex to AC";
              break;
            case "noDex":
              sourceInfo["data.abilities.dex.total"] = sourceInfo["data.abilities.dex.total"] || { positive: [], negative: [] };
              targets = [sourceInfo["data.abilities.dex.total"].negative];
              value = "0 Dex";
              break;
            case "noStr":
              sourceInfo["data.abilities.str.total"] = sourceInfo["data.abilities.str.total"] || { positive: [], negative: [] };
              targets = [sourceInfo["data.abilities.str.total"].negative];
              value = "0 Str";
              break;
            case "noInt":
              sourceInfo["data.abilities.int.total"] = sourceInfo["data.abilities.int.total"] || { positive: [], negative: [] };
              targets = [sourceInfo["data.abilities.int.total"].negative];
              value = "1 Int";
              break;
            case "noWis":
              sourceInfo["data.abilities.wis.total"] = sourceInfo["data.abilities.wis.total"] || { positive: [], negative: [] };
              targets = [sourceInfo["data.abilities.wis.total"].negative];
              value = "1 Wis";
              break;
            case "noCha":
              sourceInfo["data.abilities.cha.total"] = sourceInfo["data.abilities.cha.total"] || { positive: [], negative: [] };
              targets = [sourceInfo["data.abilities.cha.total"].negative];
              value = "1 Cha";
              break;
          }

          for (let t of Object.values(targets)) {
            t.push({ type: obj.type, subtype: this.constructor._getChangeItemSubtype(obj), value: value });
          }
        }
      }
    }
    for (let flagKey of Object.keys(flags)) {
      if (!flags[flagKey]) continue;

      switch (flagKey) {
        case "noDex":
          linkData(data1, updateData, "data.abilities.dex.total", 0);
          linkData(data1, updateData, "data.abilities.dex.mod", -5);
          break;
        case "noStr":
          linkData(data1, updateData, "data.abilities.str.total", 0);
          linkData(data1, updateData, "data.abilities.str.mod", -5);
          break;
        case "noInt":
          linkData(data1, updateData, "data.abilities.int.total", 1);
          linkData(data1, updateData, "data.abilities.int.mod", -5);
          break;
        case "noWis":
          linkData(data1, updateData, "data.abilities.wis.total", 1);
          linkData(data1, updateData, "data.abilities.wis.mod", -5);
          break;
        case "noCha":
          linkData(data1, updateData, "data.abilities.cha.total", 1);
          linkData(data1, updateData, "data.abilities.cha.mod", -5);
          break;
      }
    }

    // Initialize data
    if (!sourceOnly) this._resetData(updateData, srcData1, flags);

    // Sort changes
    allChanges.sort(this._sortChanges.bind(this));

    // Parse changes
    let temp = [];
    const origData = mergeObject(this.data, data != null ? expandObject(data) : {}, { inplace: false });
    updateData = flattenObject({ data: mergeObject(origData.data, expandObject(updateData).data, { inplace: false }) });
    this._addDynamicData(updateData, {}, flags, Object.keys(this.data.data.abilities), srcData1, true);
    allChanges.forEach((change, a) => {
      const formula = change.raw[0] || "";
      if (formula === "") return;
      const changeTarget = change.raw[2];
      if (changeData[changeTarget] == null) return;
      const rollData = this.constructor._blacklistChangeData(srcData1, changeTarget);

      rollData.item = {};
      if (change.source.item != null) {
        rollData.item = change.source.item.data;
      }

      const roll = new Roll(formula, rollData);

      change.raw[4] = roll.roll().total;
      this._parseChange(change, changeData[changeTarget], flags);
      temp.push(changeData[changeTarget]);

      if (allChanges.length <= a+1 || allChanges[a+1].raw[2] !== changeTarget) {
        const newData = this._applyChanges(changeTarget, temp, srcData1);
        if (!sourceOnly) this._addDynamicData(updateData, newData, flags, Object.keys(this.data.data.abilities), srcData1);
        temp = [];
      }
    });

    const finalData = mergeObject(this.data, updateData, { inplace: false });
    // Add dex mod to AC
    if (updateData["data.abilities.dex.mod"] < 0 || !flags.loseDexToAC) {
      const maxDexBonus = mergeObject(this.data, expandObject(updateData), { inplace: false }).data.attributes.maxDexBonus;
      const dexBonus = maxDexBonus != null ? Math.min(maxDexBonus, updateData["data.abilities.dex.mod"]) : updateData["data.abilities.dex.mod"];
      linkData(srcData1, updateData, "data.attributes.ac.normal.total", updateData["data.attributes.ac.normal.total"] + dexBonus);
      linkData(srcData1, updateData, "data.attributes.ac.touch.total", updateData["data.attributes.ac.touch.total"] + dexBonus);
      if (updateData["data.abilities.dex.mod"] < 0) {
        linkData(srcData1, updateData, "data.attributes.ac.flatFooted.total", updateData["data.attributes.ac.flatFooted.total"] + dexBonus);
      }
    }
    // Add current hit points
    if (updateData["data.attributes.hp.max"]) {
      const hpDiff = updateData["data.attributes.hp.max"] - prevValues.mhp;
      if (hpDiff !== 0) {
        linkData(srcData1, updateData, "data.attributes.hp.value", Math.min(updateData["data.attributes.hp.max"], finalData.data.attributes.hp.value + hpDiff));
      }
    }

    // Refresh source info
    for (let [bt, change] of Object.entries(changeData)) {
      for (let [ct, values] of Object.entries(change)) {
        let customBuffTargets = this._getChangeFlat(bt, ct, srcData1.data);
        if (!(customBuffTargets instanceof Array)) customBuffTargets = [customBuffTargets];

        // Replace certain targets
        // Replace ability penalties
        customBuffTargets = customBuffTargets.filter(t => { return t != null; }).map(t => {
          return t.replace(/^data\.abilities\.([a-zA-Z0-9]+)\.penalty$/, "data.abilities.$1.total");
        });

        // Add sources
        for (let ebt of Object.values(customBuffTargets)) {
            sourceInfo[ebt] = sourceInfo[ebt] || { positive: [], negative: [] };
            if (values.positive.value > 0) sourceInfo[ebt].positive.push(...values.positive.sources);
            if (values.negative.value < 0) sourceInfo[ebt].negative.push(...values.negative.sources);
        }
      }
    }

    this._setSourceDetails(mergeObject(this.data, srcData1, { inplace: false }), sourceInfo, flags);

    const diffData = diffObject(this.data, srcData1);

    // Apply changes
    if (this.collection != null && Object.keys(diffData).length > 0) {
      let newData = {};
      if (data != null) newData = flattenObject(mergeObject(data, flattenObject(diffData), { inplace: false }));
      return { data: newData, diff: diffData };
    }
    return { data: {}, diff: {} };
  }

  _applyChanges(buffTarget, changeData, rollData) {
    let consolidatedChanges = {};
    let changes = {};
    for (let change of changeData) {
      for (let b of Object.keys(change)) {
        changes[b] = { positive: 0, negative: 0 };
      }
      for (let [changeType, data] of Object.entries(change)) {
        // Add positive value
        if (data.positive.value !== 0) {
          changes[changeType].positive += data.positive.value;
        }
        // Add negative value
        if (data.negative.value !== 0) {
            changes[changeType].negative += data.negative.value;
        }
      }
    }

    for (let [changeTarget, value] of Object.entries(changes)) {
      if (value.positive !== 0 || value.negative !== 0) {
        let flatTargets = this._getChangeFlat(buffTarget, changeTarget, rollData.data);
        if (flatTargets == null) continue;

        if (!(flatTargets instanceof Array)) flatTargets = [flatTargets];
        for (let target of flatTargets) {
          consolidatedChanges[target] = consolidatedChanges[target] || 0;
          consolidatedChanges[target] = consolidatedChanges[target] + value.positive + value.negative;
        }
      }
    }

    return consolidatedChanges;
  }

  _resetData(updateData, data, flags) {
    const data1 = data.data;
    if (flags == null) flags = {};
    const items = this.data.items;
    const classes = items.filter(obj => { return obj.type === "class"; });

    // Reset HD
    linkData(data, updateData, "data.attributes.hd.total", (data1.attributes.hd.base || 0) + data1.details.level.value);

    // Reset abilities
    for (let [a, abl] of Object.entries(data1.abilities)) {
      linkData(data, updateData, `data.abilities.${a}.penalty`, 0);
      if (a === "str" && flags.noStr === true) continue;
      if (a === "dex" && flags.noDex === true) continue;
      if (a === "int" && flags.oneInt === true) continue;
      if (a === "wis" && flags.oneWis === true) continue;
      if (a === "cha" && flags.oneCha === true) continue;
      linkData(data, updateData, `data.abilities.${a}.checkMod`, 0);
      linkData(data, updateData, `data.abilities.${a}.total`, abl.value - Math.abs(abl.drain));
      linkData(data, updateData, `data.abilities.${a}.mod`, Math.floor((updateData[`data.abilities.${a}.total`] - 10) / 2));
    }

    // Reset maximum hit points
    let mhp = data1.attributes.hp.base;
    // Add class hp to hit points
    mhp += classes.reduce((cur, obj) => {
      return cur + obj.data.hp + obj.data.fc.hp.value;
    }, 0);
    // Apply level drain to hit points
    mhp -= data1.attributes.energyDrain * 5;
    // Set max hit points
    linkData(data, updateData, "data.attributes.hp.max", Math.max(0, mhp));

    // Reset AC
    for (let type of Object.keys(data1.attributes.ac)) {
      linkData(data, updateData, `data.attributes.ac.${type}.total`, 10);
    }

    // Reset attack and damage bonuses
    linkData(data, updateData, "data.attributes.attack.general", 0);
    linkData(data, updateData, "data.attributes.attack.melee", 0);
    linkData(data, updateData, "data.attributes.attack.ranged", 0);
    linkData(data, updateData, "data.attributes.damage.general", 0);
    linkData(data, updateData, "data.attributes.damage.weapon", 0);
    linkData(data, updateData, "data.attributes.damage.spell", 0);

    // Reset saving throws
    for (let [a, s] of Object.entries(data1.attributes.savingThrows)) {
      linkData(
        data,
        updateData,
        `data.attributes.savingThrows.${a}.total`,
        classes.reduce((cur, obj) => {
          return cur + obj.data.savingThrows[a].value;
        }, 0) + data1.attributes.savingThrows[a].value - data1.attributes.energyDrain
      );
    }

    // Reset ACP and Max Dex bonus
    linkData(data, updateData, "data.attributes.acp.gear", 0);
    linkData(data, updateData, "data.attributes.maxDexBonus", null);
    items.filter(obj => { return obj.type === "equipment" && obj.data.equipped; }).forEach(obj => {
      linkData(data, updateData, "data.attributes.acp.gear", updateData["data.attributes.acp.gear"] + Math.abs(obj.data.armor.acp));
      if(obj.data.armor.dex != null) {
        if (updateData["data.attributes.maxDexBonus"] == null) linkData(data, updateData, "data.attributes.maxDexBonus", Math.abs(obj.data.armor.dex));
        else {
          linkData(data, updateData, "data.attributes.maxDexBonus", Math.min(updateData["data.attributes.maxDexBonus"], Math.abs(obj.data.armor.dex)));
        }
      }
    });
    // Set encumbrance
    linkData(data, updateData, "data.attributes.acp.encumbrance", 0);
    switch (data1.attributes.encumbrance.level) {
      case 1:
        linkData(data, updateData, "data.attributes.acp.encumbrance", 3);
        linkData(data, updateData, "data.attributes.maxDexBonus", Math.min(updateData["data.attributes.maxDexBonus"] || Number.POSITIVE_INFINITY, 3));
        break;
      case 2:
        linkData(data, updateData, "data.attributes.acp.encumbrance", 6);
        linkData(data, updateData, "data.attributes.maxDexBonus", Math.min(updateData["data.attributes.maxDexBonus"] || Number.POSITIVE_INFINITY, 1));
        break;
    }
    // Set final ACP
    linkData(data, updateData, "data.attributes.acp.total", updateData["data.attributes.acp.gear"] + updateData["data.attributes.acp.encumbrance"]);

    // Reset specific skill bonuses
    for (let sklKey of this._getChangeFlat("skills", "", data1.data)) {
      if (hasProperty(data, sklKey)) linkData(data, updateData, sklKey, 0);
    }

    // Reset BAB, CMB and CMD
    linkData(data, updateData, "data.attributes.bab.total", data1.attributes.bab.value + classes.reduce((cur, obj) => {
      return cur + (obj.data.bab || 0);
    }, 0));
    linkData(data, updateData, "data.attributes.cmb.total", updateData["data.attributes.bab.total"] - data1.attributes.energyDrain);
    linkData(data, updateData, "data.attributes.cmd.total", 10 + updateData["data.attributes.bab.total"] - data1.attributes.energyDrain);
    linkData(data, updateData, "data.attributes.cmd.flatFootedTotal", 10 + updateData["data.attributes.bab.total"] - data1.attributes.energyDrain);

    // Reset initiative
    linkData(data, updateData, "data.attributes.init.total", 0);
  }

  _addDynamicData(updateData, changes, flags, abilities, data, forceModUpdate=false) {
    if (changes == null) changes = {};

    const prevMods = {};
    const modDiffs = {};
    // Reset ability modifiers
    for (let a of abilities) {
      prevMods[a] = forceModUpdate ? 0 : updateData[`data.abilities.${a}.mod`];
      if (a === "str" && flags.noStr ||
        a === "dex" && flags.noDex ||
        a === "int" && flags.noInt ||
        a === "wis" && flags.noWis ||
        a === "cha" && flags.noCha) {
        modDiffs[a] = forceModUpdate ? -5 : 0;
        if (changes[`data.abilities.${a}.total`]) delete changes[`data.abilities.${a}.total`]; // Remove used mods to prevent doubling
        continue;
      }
      const ablPenalty = Math.abs(updateData[`data.abilities.${a}.penalty`] || 0) + (updateData[`data.abilities.${a}.userPenalty`] || 0);

      linkData(data, updateData, `data.abilities.${a}.total`, updateData[`data.abilities.${a}.total`] + (changes[`data.abilities.${a}.total`] || 0));
      if (changes[`data.abilities.${a}.total`]) delete changes[`data.abilities.${a}.total`]; // Remove used mods to prevent doubling
      linkData(data, updateData, `data.abilities.${a}.mod`, Math.floor((updateData[`data.abilities.${a}.total`] - 10) / 2));
      linkData(data, updateData, `data.abilities.${a}.mod`, Math.max(-5, updateData[`data.abilities.${a}.mod`] - Math.floor(updateData[`data.abilities.${a}.damage`] / 2) - Math.floor(ablPenalty / 2)));
      modDiffs[a] = updateData[`data.abilities.${a}.mod`] - prevMods[a];
    }

    // Add ability mods to CMB and CMD
    linkData(data, updateData, "data.attributes.cmb.total", updateData["data.attributes.cmb.total"] + modDiffs["str"]);
    linkData(data, updateData, "data.attributes.cmd.total", updateData["data.attributes.cmd.total"] + modDiffs["str"]);
    if (!flags.loseDexToAC) linkData(data, updateData, "data.attributes.cmd.total", updateData["data.attributes.cmd.total"] + modDiffs["dex"]);
    linkData(data, updateData, "data.attributes.cmd.flatFootedTotal", updateData["data.attributes.cmd.flatFootedTotal"] + modDiffs["str"]);

    // Add dex mod to initiative
    linkData(data, updateData, "data.attributes.init.total", updateData["data.attributes.init.total"] + modDiffs["dex"]);

    // Add ability mods to saving throws
    for (let [s, a] of Object.entries(CONFIG.PF1.savingThrowMods)) {
      linkData(data, updateData, `data.attributes.savingThrows.${s}.total`, updateData[`data.attributes.savingThrows.${s}.total`] + modDiffs[a]);
    }

    // Apply changes
    for (let [changeTarget, value] of Object.entries(changes)) {
      linkData(data, updateData, changeTarget, (updateData[changeTarget] || 0) + value);
    }
    this._updateSkills(updateData, data);
  }

  _updateSkills(updateData, data) {
    const data1 = data.data;
    let energyDrainPenalty = Math.abs(data1.attributes.energyDrain);
    for (let [sklKey, skl] of Object.entries(data1.skills)) {
      if (skl == null) continue;
      
      let acpPenalty = (skl.acp ? data1.attributes.acp.total : 0);
      let ablMod = data1.abilities[skl.ability].mod;
      let specificSkillBonus = skl.changeBonus || 0;

      // Parse main skills
      let sklValue = skl.rank + (skl.cs && skl.rank > 0 ? 3 : 0) + ablMod + specificSkillBonus - acpPenalty - energyDrainPenalty;
      linkData(data, updateData, `data.skills.${sklKey}.mod`, sklValue);
      // Parse sub-skills
      for (let [subSklKey, subSkl] of Object.entries(skl.subSkills || {})) {
        if (subSkl == null) continue;
        if (updateData[`data.skills.${sklKey}.subSkills.${subSklKey}`] === null) continue;

        acpPenalty = (subSkl.acp ? data1.attributes.acp.total : 0);
        ablMod = data1.abilities[subSkl.ability].mod;
        specificSkillBonus = subSkl.changeBonus || 0;
        sklValue = subSkl.rank + (subSkl.cs && subSkl.rank > 0 ? 3 : 0) + ablMod + specificSkillBonus - acpPenalty - energyDrainPenalty;
        linkData(data, updateData, `data.skills.${sklKey}.subSkills.${subSklKey}.mod`, sklValue);
      }
    }
  }

  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    const actorData = this.data;
    const data = actorData.data;

    // Prepare Character data
    if ( actorData.type === "character" ) this._prepareCharacterData(actorData);
    else if ( actorData.type === "npc" ) this._prepareNPCData(data);

    // Create arbitrary skill slots
    for (let skillId of CONFIG.PF1.arbitrarySkills) {
      if (data.skills[skillId] == null) continue;
      let skill = data.skills[skillId];
      skill.subSkills = skill.subSkills || {};
      for (let subSkillId of Object.keys(skill.subSkills)) {
        if (skill.subSkills[subSkillId] == null) delete skill.subSkills[subSkillId];
      }
    }

    // Delete removed skills
    for (let skillId of Object.keys(data.skills)) {
      let skl = data.skills[skillId];
      if (skl == null) {
        delete data.skills[skillId];
      }
    }

    // Set class tags
    data.classes = {};
    actorData.items.filter(obj => { return obj.type === "class"; }).forEach(cls => {
      let tag = createTag(cls.name);
      let count = 1;
      while (actorData.items.filter(obj => { return obj.type === "class" && obj.data.tag === tag && obj !== cls; }).length > 0) {
        count++;
        tag = createTag(cls.name) + count.toString();
      }
      cls.data.tag = tag;
      data.classes[tag] = {
        level: cls.data.levels,
        name: cls.name
      };
    });

    // Prepare modifier containers
    data.attributes.mods = data.attributes.mods || {};
    data.attributes.mods.skills = data.attributes.mods.skills || {};

    // Set spell resistance
    if (typeof data.attributes.sr.formula === "string" && data.attributes.sr.formula.length) {
      let roll = new Roll(data.attributes.sr.formula, data).roll();
      data.attributes.sr.total = roll.total;
    }
    else {
      data.attributes.sr.total = 0;
    }

    // Set spellbook info
    for (let spellbook of Object.values(data.attributes.spells.spellbooks)) {
      // Set CL
      let roll = new Roll(spellbook.cl.formula, data).roll();
      spellbook.cl.total = roll.total || 0;
      if (actorData.type === "npc") spellbook.cl.total += spellbook.cl.base;
      if (spellbook.class === "_hd") {
        spellbook.cl.total += data.attributes.hd.total;
      }
      else if (spellbook.class !== "" && data.classes[spellbook.class] != null) {
        spellbook.cl.total += data.classes[spellbook.class].level;
      }
      // Add spell slots
      spellbook.spells = spellbook.spells || {};
      for (let a = 0; a < 10; a++) {
        spellbook.spells[`spell${a}`] = spellbook.spells[`spell${a}`] || { value: 0, max: 0 };
      }
    }
  }

  _setSourceDetails(actorData, extraData, flags) {
    if (flags == null) flags = {};
    let sourceDetails = {};
    // Get empty source arrays
    for (let obj of Object.values(CONFIG.PF1.buffTargets)) {
      for (let b of Object.keys(obj)) {
        if (!b.startsWith("_")) {
          let buffTargets = this._getChangeFlat(b, null, actorData.data);
          if (!(buffTargets instanceof Array)) buffTargets = [buffTargets];
          for (let bt of buffTargets) {
            if (!sourceDetails[bt]) sourceDetails[bt] = [];
          }
        }
      }
    }
    // Add additional source arrays not covered by changes
    sourceDetails["data.attributes.bab.total"] = [];


    // Add base values to certain bonuses
    sourceDetails["data.attributes.ac.normal.total"].push({ name: "Base", value: 10 });
    sourceDetails["data.attributes.ac.touch.total"].push({ name: "Base", value: 10 });
    sourceDetails["data.attributes.ac.flatFooted.total"].push({ name: "Base", value: 10 });
    sourceDetails["data.attributes.cmd.total"].push({ name: "Base", value: 10 });
    sourceDetails["data.attributes.cmd.flatFootedTotal"].push({ name: "Base", value: 10 });
    for (let [a, abl] of Object.entries(actorData.data.abilities)) {
      sourceDetails[`data.abilities.${a}.total`].push({ name: "Base", value: abl.value });
      // Add ability penalty, damage and drain
      if (abl.damage != null && abl.damage !== 0) {
        sourceDetails[`data.abilities.${a}.total`].push({ name: "Ability Damage", value: `-${Math.floor(Math.abs(abl.damage) / 2)} (Mod only)` });
      }
      if (abl.drain != null && abl.drain !== 0) {
        sourceDetails[`data.abilities.${a}.total`].push({ name: "Ability Drain", value: -Math.abs(abl.drain) });
      }
    }

    // HP from Classes
    sourceDetails["data.attributes.hp.max"].push(...actorData.items.filter(obj => { return obj.type === "class"; }).map(obj => {
      return {
        name: obj.name,
        value: obj.data.hp
      };
    }));
    // HP from Favoured Classes
    let fcHPBonus = actorData.items.filter(obj => { return obj.type === "class"; }).reduce((cur, obj) => {
      cur.value += obj.data.fc.hp.value;
      return cur;
    }, { name: "Favoured Classes", value: 0 });
    if (fcHPBonus.value !== 0) sourceDetails["data.attributes.hp.max"].push(fcHPBonus);
    // HP from Ability Drain
    if (actorData.data.attributes.energyDrain != null && actorData.data.attributes.energyDrain !== 0) {
      sourceDetails["data.attributes.hp.max"].push({
        name: "Energy Drain",
        value: -(actorData.data.attributes.energyDrain * 5)
      });
    }

    // BAB from Classes
    sourceDetails["data.attributes.bab.total"].push(...actorData.items.filter(obj => { return obj.type === "class"; }).map(obj => {
      return {
        name: obj.name,
        value: obj.data.bab
      }
    }));

    // Add CMB, CMD and initiative
    if (actorData.data.attributes.bab.total !== 0) {
      sourceDetails["data.attributes.cmb.total"].push({ name: "BAB", value: actorData.data.attributes.bab.total });
      sourceDetails["data.attributes.cmd.total"].push({ name: "BAB", value: actorData.data.attributes.bab.total });
      sourceDetails["data.attributes.cmd.flatFootedTotal"].push({ name: "BAB", value: actorData.data.attributes.bab.total });
    }
    if (actorData.data.abilities.str.mod !== 0) {
      sourceDetails["data.attributes.cmb.total"].push({ name: "Strength", value: actorData.data.abilities.str.mod });
      sourceDetails["data.attributes.cmd.total"].push({ name: "Strength", value: actorData.data.abilities.str.mod });
      sourceDetails["data.attributes.cmd.flatFootedTotal"].push({ name: "Strength", value: actorData.data.abilities.str.mod });
    }
    if (actorData.data.abilities.dex.mod !== 0) {
      sourceDetails["data.attributes.cmd.total"].push({ name: "Dexterity", value: actorData.data.abilities.dex.mod });
      sourceDetails["data.attributes.init.total"].push({ name: "Dexterity", value: actorData.data.abilities.dex.mod });
    }
    if (actorData.data.attributes.energyDrain != null && actorData.data.attributes.energyDrain !== 0) {
      sourceDetails["data.attributes.cmb.total"].push({ name: "Negative Levels", value: -actorData.data.attributes.energyDrain });
      sourceDetails["data.attributes.cmd.total"].push({ name: "Negative Levels", value: -actorData.data.attributes.energyDrain });
      sourceDetails["data.attributes.cmd.flatFootedTotal"].push({ name: "Negative Levels", value: -actorData.data.attributes.energyDrain });
    }

    // Add ability mods (and energy drain) to saving throws
    for (let [s, a] of Object.entries(CONFIG.PF1.savingThrowMods)) {
      if (actorData.data.abilities[a].mod !== 0) {
        sourceDetails[`data.attributes.savingThrows.${s}.total`].push({
          name: CONFIG.PF1.abilities[a],
          value: actorData.data.abilities[a].mod
        });
      }
      if (actorData.data.attributes.energyDrain != null && actorData.data.attributes.energyDrain !== 0) {
        sourceDetails[`data.attributes.savingThrows.${s}.total`].push({
          name: "Negative Levels",
          value: -actorData.data.attributes.energyDrain
        });
      }
    }
    // Add class bonuses to saving throws
    actorData.items.filter(obj => { return obj.type === "class"; }).forEach(obj => {
      for (let [s, sobj] of Object.entries(obj.data.savingThrows)) {
        const value = sobj.value;
        if (value !== 0) {
          sourceDetails[`data.attributes.savingThrows.${s}.total`].push({
            name: obj.name,
            value: value
          });
        }
      }
    });

    // AC from Dex mod
    const maxDexBonus = actorData.data.attributes.maxDexBonus;
    const dexBonus = maxDexBonus != null ? Math.min(maxDexBonus, actorData.data.abilities.dex.mod) : actorData.data.abilities.dex.mod;
    if (dexBonus < 0 || (!flags.loseDexToAC && dexBonus > 0)) {
      sourceDetails["data.attributes.ac.normal.total"].push({ name: "Dexterity", value: dexBonus });
      sourceDetails["data.attributes.ac.touch.total"].push({ name: "Dexterity", value: dexBonus });
      if (dexBonus < 0) {
        sourceDetails["data.attributes.ac.flatFooted.total"].push({ name: "Dexterity", value: dexBonus });
      }
    }
    
    // Add extra data
    for (let [changeTarget, changeGrp] of Object.entries(extraData)) {
      for (let grp of Object.values(changeGrp)) {
        if (grp.length > 0) {
          sourceDetails[changeTarget] = sourceDetails[changeTarget] || [];
          for (let src of grp) {
            let srcInfo = this.constructor._translateSourceInfo(src.type, src.subtype, src.name);
            sourceDetails[changeTarget].push({
              name: srcInfo,
              value: src.value
            });
          }
        }
      }
    }

    this.sourceDetails = sourceDetails;
  }

  async refresh() {
    if (this.hasPerm(game.user, "OWNER")) {
      return this.update({});
    }
  } 

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    const data = actorData.data;

    // Experience bar
    let prior = this.getLevelExp(data.details.level.value - 1 || 0),
          req = data.details.xp.max - prior;
    data.details.xp.value = Math.max(data.details.xp.value, prior);
    data.details.xp.pct = Math.min(Math.round((data.details.xp.value - prior) * 100 / (req || 1)), 99.5);
  }

  /* -------------------------------------------- */

  /**
   * Prepare NPC type specific data
   */
  _prepareNPCData(data) {
    // Kill Experience
    data.details.xp.value = this.getCRExp(data.details.cr);
  }

  /**
   * Return the amount of experience required to gain a certain character level.
   * @param level {Number}  The desired level
   * @return {Number}       The XP required
   */
  getLevelExp(level) {
    const expRate = game.settings.get("pf1", "experienceRate");
    const levels = CONFIG.PF1.CHARACTER_EXP_LEVELS[expRate];
    return levels[Math.min(level, levels.length - 1)];
  }

  /* -------------------------------------------- */

  /**
   * Return the amount of experience granted by killing a creature of a certain CR.
   * @param cr {Number}     The creature's challenge rating
   * @return {Number}       The amount of experience granted per kill
   */
  getCRExp(cr) {
    if (cr < 1.0) return Math.max(400 * cr, 10);
    return CONFIG.PF1.CR_EXP_LEVELS[cr];
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
  /* -------------------------------------------- */

  /**
   * Extend the default update method to enhance data before submission.
   * See the parent Entity.update method for full details.
   *
   * @param {Object} data     The data with which to update the Actor
   * @param {Object} options  Additional options which customize the update workflow
   * @return {Promise}        A Promise which resolves to the updated Entity
   */
  async update(data, options={}) {
    // Fix skill ranks after TinyMCE edit
    let expandedData = expandObject(data);
    if (expandedData.data != null && expandedData.data.skills != null) {
      for (let [s, skl] of Object.entries(expandedData.data.skills)) {
        let curSkl = this.data.data.skills[s];
        if (skl == null) continue;
        if (typeof skl.rank !== "number") skl.rank = 0;
        if (skl.subSkills != null) {
          for (let skl2 of Object.values(skl.subSkills)) {
            if (skl2 == null) continue;
            if (typeof skl2.rank !== "number") skl2.rank = 0;
          }
        }

        // Rename custom skills
        if (curSkl != null && curSkl.custom && skl.name != null) {
          let tag = createTag(skl.name);
          let count = 1;
          while (this.data.data.skills[tag] != null && this.data.data.skills[tag] != curSkl) {
            count++;
            tag = createTag(skillData.name) + count.toString();
          }

          if (s !== tag) {
            expandedData.data.skills[tag] = mergeObject(curSkl, skl);
            expandedData.data.skills[s] = null;
          }
        }
      }
      data = flattenObject(expandedData);
    }

    // Make certain variables absolute
    const _absoluteKeys = Object.keys(this.data.data.abilities).reduce((arr, abl) => {
      arr.push(`data.abilities.${abl}.userPenalty`, `data.abilities.${abl}.damage`, `data.abilities.${abl}.drain`);
      return arr;
    }, []).concat("data.attributes.energyDrain").filter(k => { return data[k] != null; });
    for (const k of _absoluteKeys) {
      data[k] = Math.abs(data[k]);
    }

    // Apply changes in Actor size to Token width/height
    if ( data["data.traits.size"] && this.data.data.traits.size !== data["data.traits.size"] ) {
      let size = CONFIG.PF1.tokenSizes[data["data.traits.size"]];
      let tokens = this.getActiveTokens();
      if (this.isToken) tokens.push(this.token);
      tokens.forEach(o => { o.update({ width: size.w, height: size.h, scale: size.scale }); });
      if (!this.isToken) {
        data["token.width"] = size.w;
        data["token.height"] = size.h;
        data["token.scale"] = size.scale;
      }
    }

    // Send resource updates to item
    let updatedResources = [];
    for (let key of Object.keys(data)) {
      if (key.match(/^data\.resources\.([a-zA-Z0-9]+)/)) {
        const resourceTag = RegExp.$1;
        if (updatedResources.includes(resourceTag)) continue;
        updatedResources.push(resourceTag);

        const resource = this.data.data.resources[resourceTag];
        if (resource != null) {
          const itemId = resource._id;
          const item = this.getOwnedItem(itemId);
          if (item == null) continue;

          const itemUpdateData = {};
          if (data[`data.resources.${resourceTag}.value`] !== item.data.data.uses.value) {
            itemUpdateData["data.uses.value"] = data[`data.resources.${resourceTag}.value`];
          }
          if (data[`data.resources.${resourceTag}.max`] !== item.data.data.uses.max) {
            itemUpdateData["data.uses.max"] = data[`data.resources.${resourceTag}.max`];
          }
          if (Object.keys(itemUpdateData).length > 0) item.update(itemUpdateData);
        }
      }
    }

    // Clean up old item resources
    for (let [tag, res] of Object.entries(this.data.data.resources)) {
      if (!res) continue;
      if (!res._id) continue;
      const itemId = res._id;
      const item = this.getOwnedItem(itemId);
      if (item == null) {
        // Remove resource from token bars
        const tokens = this.getActiveTokens();
        tokens.forEach(token => {
          ["bar1", "bar2"].forEach(b => {
            const barAttr = token.getBarAttribute(b);
            if (barAttr == null) return;
            if (barAttr.attribute === `resources.${tag}`) {
              const tokenUpdateData = {};
              tokenUpdateData[`${b}.attribute`] = null;
              token.update(token.scene._id, tokenUpdateData);
            }
          });
        });
        // Remove resource
        data[`data.resources.${tag}`] = null;
      }
    }

    // Update encumbrance
    this._computeEncumbrance(data);

    if (this._updateExp(data)) options.diff = false;

    // Update changes
    if (options.updateChanges !== false) {
      const updateObj = await this._updateChanges({ data: data });
      if (Object.keys(updateObj.data).length > 0) data = mergeObject(data, diffObject(data, updateObj.data));
    }

    return super.update(data, options);
  }

  _onUpdate(data, options, userId, context) {
    // Refresh immediately-visible item data
    if (userId === game.user._id) {
      this.items.forEach(item => {
        item.updateDirectData();
      });
    }

    if (hasProperty(data, "data.attributes.vision.lowLight")) {
      refreshLightingAndSight();
    }

    if (this.hasPerm(game.user, "LIMITED")) this._updateChanges({ sourceOnly: true });

    super._onUpdate(data, options, userId, context);
  }
  
  /**
   * Makes sure experience values are correct in update data.
   * @param {Object} data - The update data, as per ActorPF.update()
   * @returns {Boolean} Whether to force an update or not.
   */
  _updateExp(data) {
    const classes = this.items.filter(o => o.type === "class");
    const level = classes.reduce((cur, o) => {
      return cur + o.data.data.levels;
    }, 0);
    data["data.details.level.value"] = level;

    // The following is not for NPCs
    if (this.data.type !== "character") return;

    // Translate update exp value to number
    let newExp = data["data.details.xp.value"];
    if (typeof newExp === "string") {
      if (newExp.match(/^\+([0-9]+)$/)) {
        newExp = this.data.data.details.xp.value + parseInt(RegExp.$1);
      }
      else if (newExp.match(/^-([0-9]+)$/)) {
        newExp = this.data.data.details.xp.value - parseInt(RegExp.$1);
      }
      else {
        newExp = parseInt(newExp);
        if (Number.isNaN(newExp)) newExp = this.data.data.details.xp.value;
      }

      if (typeof newExp === "number" && newExp !== this.data.data.details.xp.value) {
        data["data.details.xp.value"] = newExp;
      }
    }
    data["data.details.xp.max"] = this.getLevelExp(level);

    const curExp = data["data.details.xp.value"] !== undefined ? data["data.details.xp.value"] : this.data.data.details.xp.value;
    const minExp = level > 0 ? this.getLevelExp(level - 1) : 0;
    if (curExp < minExp) data["data.details.xp.value"] = minExp;
  }

  async _onCreate(data, options, userId, context) {
    if (userId === game.user._id) {
      await this._updateChanges();
    }

    super._onCreate(data, options, userId, context);
  }

  updateItemResources(item) {
    if (!(item instanceof Item)) return;
    if (!this.hasPerm(game.user, "OWNER")) return;

    if (item.data.data.uses != null && item.data.data.activation != null && item.data.data.activation.type !== "") {
      const itemTag = createTag(item.data.name);
      let curUses = item.data.data.uses;

      if (this.data.data.resources == null) this.data.data.resources = {};
      if (this.data.data.resources[itemTag] == null) this.data.data.resources[itemTag] = { value: 0, max: 1, _id: "" };

      const updateData = {};
      if (this.data.data.resources[itemTag].value !== curUses.value) {
        updateData[`data.resources.${itemTag}.value`] = curUses.value;
      }
      if (this.data.data.resources[itemTag].max !== curUses.max) {
        updateData[`data.resources.${itemTag}.max`] = curUses.max;
      }
      if (this.data.data.resources[itemTag]._id !== item._id ) {
        updateData[`data.resources.${itemTag}._id`] = item._id;
      }
      if (Object.keys(updateData).length > 0) this.update(updateData);
    }
  }

  /* -------------------------------------------- */

  /**
   * See the base Actor class for API documentation of this method
   */
  async createOwnedItem(itemData, options) {
    let t = itemData.type;
    let initial = {};
    // Assume NPCs are always proficient with weapons and always have spells prepared
    if ( !this.isPC ) {
      if ( t === "weapon" ) initial["data.proficient"] = true;
      if ( ["weapon", "equipment"].includes(t) ) initial["data.equipped"] = true;
    }
    if ( t === "spell" ) {
      if (this.sheet != null && this.sheet._spellbookTab != null) {
        initial["data.spellbook"] = this.sheet._spellbookTab;
      }
    }

    mergeObject(itemData, initial);
    return super.createOwnedItem(itemData, options);
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  /**
   * Cast a Spell, consuming a spell slot of a certain level
   * @param {Item5e} item   The spell being cast by the actor
   * @param {Event} event   The originating user interaction which triggered the cast 
   */
  async useSpell(item, {configureDialog=true}={}) {
    if ( item.data.type !== "spell" ) throw new Error("Wrong Item type");

    // Determine if the spell uses slots
    // let lvl = item.data.data.level;
    // const usesSlots = (lvl > 0) && item.data.data.preparation.mode === "spontaneous";
    // if ( !usesSlots ) return item.roll();

    // Configure the casting level and whether to consume a spell slot
    // let consume = true;
    // if ( configureDialog ) {
    //   const spellFormData = await SpellCastDialog.create(this, item);
    //   lvl = parseInt(spellFormData.get("level"));
    //   consume = Boolean(spellFormData.get("consume"));
    //   if ( lvl !== item.data.data.level ) {
    //     item = item.constructor.createOwned(mergeObject(item.data, {"data.level": lvl}, {inplace: false}), this);
    //   } 
    // }

    // Update Actor data
    // if ( consume && (lvl > 0) ) {
    //   await this.update({
    //     [`data.spells.spell${lvl}.value`]: Math.max(parseInt(this.data.data.spells["spell"+lvl].value) - 1, 0)
    //   });
    // } 

    // Invoke the Item roll
    if (item.hasAction) return item.useAttack();
    return item.roll();
  }

  async createAttackFromWeapon(item) {
    if (item.data.type !== "weapon") throw new Error("Wrong Item tyupe");

    // Get attack template
    let attackData = { data: {} };
    for (const template of game.data.system.template.Item.attack.templates) {
      mergeObject(attackData.data, game.data.system.template.Item.templates[template]);
    }
    mergeObject(attackData.data, duplicate(game.data.system.template.Item.attack));
    attackData = flattenObject(attackData);

    attackData["type"] = "attack";
    attackData["name"] = item.data.name;
    attackData["data.masterwork"] = item.data.data.masterwork;
    attackData["data.attackType"] = "weapon";
    attackData["data.enh"] = item.data.data.enh;
    attackData["data.ability.critRange"] = item.data.data.weaponData.critRange || 20;
    attackData["data.ability.critMult"] = item.data.data.weaponData.critMult || 2;
    attackData["data.actionType"] = (item.data.data.weaponData.isMelee ? "mwak" : "rwak");
    attackData["data.damage.parts"] = [[item.data.data.weaponData.damageRoll || "1d4", item.data.data.weaponData.damageType || ""]];
    attackData["data.activation.type"] = "full";
    attackData["data.duration.units"] = "inst";
    attackData["img"] = item.data.img;

    // Add additional attacks
    let extraAttacks = [];
    for (let a = 5; a < this.data.data.attributes.bab.total; a += 5) {
      extraAttacks = extraAttacks.concat([["-5", `Attack ${Math.floor((a+5) / 5)}`]]);
    }
    if (extraAttacks.length > 0) attackData["data.attackParts"] = extraAttacks;

    // Add ability modifiers
    if (item.data.data.weaponData.isMelee) attackData["data.ability.attack"] = "str";
    else attackData["data.ability.attack"] = "dex";
    if (item.data.data.weaponData.isMelee || item.data.data.properties["thr"] === true) {
      attackData["data.ability.damage"] = "str";
      if (item.data.data.properties["two"] === true && item.data.data.weaponData.isMelee) attackData["data.ability.damageMult"] = 1.5;
    }

    // Add range
    if (!item.data.data.weaponData.isMelee && item.data.data.weaponData.range != null) {
      attackData["data.range.units"] = "ft";
      attackData["data.range.value"] = item.data.data.weaponData.range.toString();
    }
    
    if (hasProperty(attackData, "data.templates")) delete attackData["data.templates"];
    await this.createOwnedItem(expandObject(attackData));

    ui.notifications.info(`Created attack for weapon ${item.data.name}`);
  }

  /* -------------------------------------------- */

  /**
   * Roll a Skill Check
   * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
   * @param {string} skillId      The skill id (e.g. "ins")
   * @param {Object} options      Options which configure how the skill check is rolled
   * @param {Boolean} type        Type of skill to roll (0=normal, 1=sub skill, 2=custom skill)
   * @param {String} subSkillId   The sub skill id (e.g. "prf1")
   */
  rollSkill(skillId, options={}, type=0, subSkillId="") {
    let skl, sklName;
    if (type === 0) {
      skl = this.data.data.skills[skillId];
      if (skl.name != null) sklName = skl.name;
      else sklName = CONFIG.PF1.skills[skillId];
    }
    else if (type === 1) {
      skl = this.data.data.skills[skillId].subSkills[subSkillId];
      sklName = `${CONFIG.PF1.skills[skillId]} (${skl.name})`;
    }

    // Add contextual attack string
    let notes = [];
    const rollData = duplicate(this.data.data);
    const noteObjects = this.getContextNotes(`skill.${type === 1 ? subSkillId : skillId}`);
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        let noteStr = "";
        if (note.length > 0) {
          noteStr = DicePF.messageRoll({
            data: rollData,
            msgStr: note
          });
        }
        if (noteStr.length > 0) notes.push(...noteStr.split(/[\n\r]+/));
      }
    }
    // Add untrained note
    if (skl.rt && skl.rank === 0) {
      notes.push("Untrained");
    }

    let props = [];
    if (notes.length > 0) props.push({ header: "Notes", value: notes });
    return DicePF.d20Roll({
      event: options.event,
      parts: ["@mod"],
      data: {mod: skl.mod},
      title: `${sklName} Skill Check`,
      speaker: ChatMessage.getSpeaker({actor: this}),
      chatTemplate: "systems/pf1/templates/chat/roll-ext.html",
      chatTemplateData: { hasProperties: props.length > 0, properties: props }
    });
  }

  /* -------------------------------------------- */

  /**
   * Roll a generic ability test or saving throw.
   * Prompt the user for input on which variety of roll they want to do.
   * @param {String} abilityId     The ability id (e.g. "str")
   * @param {Object} options      Options which configure how ability tests or saving throws are rolled
   */
  rollAbility(abilityId, options={}) {
    this.rollAbilityTest(abilityId, options);
  }

  rollBAB(options={}) {
    return DicePF.d20Roll({
      event: options.event,
      parts: ["@mod - @drain"],
      data: {mod: this.data.data.attributes.bab.total, drain: this.data.data.attributes.energyDrain},
      title: "Base Attack Bonus",
      speaker: ChatMessage.getSpeaker({actor: this}),
      takeTwenty: false
    });
  }

  rollCMB(options={}) {
  
    // Add contextual notes
    let notes = [];
    const rollData = duplicate(this.data.data);
    const noteObjects = this.getContextNotes("misc.cmb");
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        let noteStr = "";
        if (note.length > 0) {
          noteStr = DicePF.messageRoll({
            data: rollData,
            msgStr: note
          });
        }
        if (noteStr.length > 0) notes.push(...noteStr.split(/[\n\r]+/));
      }
    }
    // Add grapple note
    if (this.data.data.attributes.conditions.grappled) {
      notes.push("+2 to Grapple");
    }

    let props = [];
    if (notes.length > 0) props.push({ header: "Notes", value: notes });
    return DicePF.d20Roll({
      event: options.event,
      parts: ["@mod - @drain"],
      data: {mod: this.data.data.attributes.cmb.total, drain: this.data.data.attributes.energyDrain},
      title: "Combat Maneuver Bonus",
      speaker: ChatMessage.getSpeaker({actor: this}),
      takeTwenty: false,
      chatTemplate: "systems/pf1/templates/chat/roll-ext.html",
      chatTemplateData: { hasProperties: props.length > 0, properties: props }
    });
  }

  getDefenseHeaders() {
    const data = this.data.data;
    const headers = [];

    const reSplit = CONFIG.PF1.re.traitSeparator;
    let misc = [];
    
    // Damage reduction
    if (data.traits.dr.length) {
      headers.push({ header: "Damage Reduction", value: data.traits.dr.split(reSplit) });
    }
    // Energy resistance
    if (data.traits.eres.length) {
      headers.push({ header: "Energy Resistance", value: data.traits.eres.split(reSplit) });
    }
    // Damage vulnerabilities
    if (data.traits.dv.value.length || data.traits.dv.custom.length) {
      const value = [].concat(
        data.traits.dv.value.map(obj => { return CONFIG.PF1.damageTypes[obj]; }),
        data.traits.dv.custom.length > 0 ? data.traits.dv.custom.split(";") : [],
      );
      headers.push({ header: "Damage Vulnerabilities", value: value });
    }
    // Condition resistance
    if (data.traits.cres.length) {
      headers.push({ header: "Condition Resistance", value: data.traits.cres.split(reSplit) });
    }
    // Immunities
    if (data.traits.di.value.length || data.traits.di.custom.length ||
      data.traits.ci.value.length || data.traits.ci.custom.length) {
      const value = [].concat(
        data.traits.di.value.map(obj => { return CONFIG.PF1.damageTypes[obj]; }),
        data.traits.di.custom.length > 0 ? data.traits.di.custom.split(";") : [],
        data.traits.ci.value.map(obj => { return CONFIG.PF1.conditionTypes[obj]; }),
        data.traits.ci.custom.length > 0 ? data.traits.ci.custom.split(";") : [],
      );
      headers.push({ header: "Immunities", value: value });
    }
    // Spell Resistance
    if (data.attributes.sr.total > 0) {
      misc.push(`Spell Resistance ${data.attributes.sr.total}`);
    }

    if (misc.length > 0) {
      headers.push({ header: "Misc", value: misc });
    }

    return headers;
  }

  rollSavingThrow(savingThrowId, options={}) {

    // Add contextual notes
    let notes = [];
    const rollData = duplicate(this.data.data);
    const noteObjects = this.getContextNotes(`savingThrow.${savingThrowId}`);
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        let noteStr = "";
        if (note.length > 0) {
          noteStr = DicePF.messageRoll({
            data: rollData,
            msgStr: note
          });
        }
        if (noteStr.length > 0) notes.push(...noteStr.split(/[\n\r]+/));
      }
    }

    // Roll saving throw
    let props = this.getDefenseHeaders();
    if (notes.length > 0) props.push({ header: "Notes", value: notes });
    const label = CONFIG.PF1.savingThrows[savingThrowId];
    const savingThrow = this.data.data.attributes.savingThrows[savingThrowId];
    return DicePF.d20Roll({
      event: options.event,
      parts: ["@mod - @drain"],
      situational: true,
      data: { mod: savingThrow.total, drain: this.data.data.attributes.energyDrain },
      title: `${label} Saving Throw`,
      speaker: ChatMessage.getSpeaker({actor: this}),
      takeTwenty: false,
      chatTemplate: "systems/pf1/templates/chat/roll-ext.html",
      chatTemplateData: { hasProperties: props.length > 0, properties: props }
    });
  };

  /* -------------------------------------------- */

  /**
   * Roll an Ability Test
   * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
   * @param {String} abilityId    The ability ID (e.g. "str")
   * @param {Object} options      Options which configure how ability tests are rolled
   */
  rollAbilityTest(abilityId, options={}) {

    // Add contextual notes
    let notes = [];
    const rollData = duplicate(this.data.data);
    const noteObjects = this.getContextNotes(`abilityChecks.${abilityId}`);
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        let noteStr = "";
        if (note.length > 0) {
          noteStr = DicePF.messageRoll({
            data: rollData,
            msgStr: note
          });
        }
        if (noteStr.length > 0) notes.push(...noteStr.split(/[\n\r]+/));
      }
    }

    let props = this.getDefenseHeaders();
    if (notes.length > 0) props.push({ header: "Notes", value: notes });
    const label = CONFIG.PF1.abilities[abilityId];
    const abl = this.data.data.abilities[abilityId];
    return DicePF.d20Roll({
      event: options.event,
      parts: ["@mod + @checkMod - @drain"],
      data: {mod: abl.mod, checkMod: abl.checkMod, drain: this.data.data.attributes.energyDrain},
      title: `${label} Ability Test`,
      speaker: ChatMessage.getSpeaker({actor: this}),
      chatTemplate: "systems/pf1/templates/chat/roll-ext.html",
      chatTemplateData: { hasProperties: props.length > 0, properties: props }
    });
  }

  /* -------------------------------------------- */

  /**
   * Roll an Ability Saving Throw
   * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
   * @param {String} abilityId    The ability ID (e.g. "str")
   * @param {Object} options      Options which configure how ability tests are rolled
   */
  rollAbilitySave(abilityId, options={}) {
    const label = CONFIG.PF1.abilities[abilityId];
    const abl = this.data.data.abilities[abilityId];
    return DicePF.d20Roll({
      event: options.event,
      parts: ["@mod"],
      data: {mod: abl.save},
      title: `${label} Saving Throw`,
      speaker: ChatMessage.getSpeaker({actor: this}),
      takeTwenty: false,
    });
  }

  /* -------------------------------------------- */

  /**
   * Apply rolled dice damage to the token or tokens which are currently controlled.
   * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
   *
   * @param {HTMLElement} roll    The chat entry which contains the roll data
   * @param {Number} multiplier   A damage multiplier to apply to the rolled damage.
   * @return {Promise}
   */
  static async applyDamage(roll, multiplier, critical=false) {
    let value = Math.floor(parseFloat(roll.find('.damage-roll .dice-total').text()) * multiplier);
    if (critical) value = Math.floor(parseFloat(roll.find('.crit-damage-roll .dice-total').text()) * multiplier);
    const promises = [];
    for ( let t of canvas.tokens.controlled ) {
      let a = t.actor,
          hp = a.data.data.attributes.hp,
          tmp = parseInt(hp.temp) || 0,
          dt = value > 0 ? Math.min(tmp, value) : 0;
      promises.push(t.actor.update({
        "data.attributes.hp.temp": tmp - dt,
        "data.attributes.hp.value": Math.clamped(hp.value - (value - dt), -100, hp.max)
      }));
    }
    return Promise.all(promises);
  }

  getSkill(key) {
    for (let [k, s] of Object.entries(this.data.data.skills)) {
      if (k === key) return s;
      if (s.subSkills != null) {
        for (let [k2, s2] of Object.entries(s.subSkills)) {
          if (k2 === key) return s2;
        }
      }
    }
    return null;
  }

  get allNotes() {
    let result = [];

    const noteItems = this.items.filter(o => { return o.data.data.contextNotes != null; });

    for (let o of noteItems) {
      if (o.type === "buff" && !o.data.data.active) continue;
      if ((o.type === "equipment" || o.type === "weapon") && !o.data.data.equipped) continue;
      if (!o.data.data.contextNotes || o.data.data.contextNotes.length === 0) continue;
      result.push({ notes: o.data.data.contextNotes, item: o });
    }

    return result;
  }

  /**
   * Generates an array with all the active context-sensitive notes for the given context on this actor.
   * @param {String} context - The context to draw from.
   */
  getContextNotes(context) {
    let result = this.allNotes;

    // Skill
    if (context.match(/^skill\.(.+)/)) {
      const skillKey = RegExp.$1;
      const skill = this.getSkill(skillKey);
      const ability = skill.ability;
      for (let note of result) {
        note.notes = note.notes.filter(o => {
          return (o[1] === "skill" && o[2] === context) || (o[1] === "skills" && (o[2] === `${ability}Skills` || o[2] === "skills"));
        }).map(o => { return o[0]; });
      }

      if (skill.notes != null && skill.notes !== "") {
        result.push({ notes: [skill.notes], item: null });
      }

      return result;
    }

    // Saving throws
    if (context.match(/^savingThrow\.(.+)/)) {
      const saveKey = RegExp.$1;
      for (let note of result) {
        note.notes = note.notes.filter(o => {
          return o[1] === "savingThrows" && (o[2] === saveKey || o[2] === "allSavingThrows");
        }).map(o => { return o[0]; });
      }

      if (this.data.data.attributes.saveNotes != null && this.data.data.attributes.saveNotes !== "") {
        result.push({ notes: [this.data.data.attributes.saveNotes], item: null });
      }

      return result;
    }

    // Ability checks
    if (context.match(/^abilityChecks\.(.+)/)) {
      const ablKey = RegExp.$1;
      for (let note of result) {
        note.notes = note.notes.filter(o => {
          return o[1] === "abilityChecks" && (o[2] === `${ablKey}Checks` || o[2] === "allChecks");
        }).map(o => { return o[0]; });
      }

      return result;
    }

    // Misc
    if (context.match(/^misc\.(.+)/)) {
      const miscKey = RegExp.$1;
      for (let note of result) {
        note.notes = note.notes.filter(o => {
          return o[1] === "misc" && o[2] === miscKey;
        }).map(o => { return o[0]; });
      }

      if (miscKey === "cmb" && this.data.data.attributes.cmbNotes != null && this.data.data.attributes.cmbNotes !== "") {
        result.push({ notes: [this.data.data.attributes.cmbNotes], item: null });
      }

      return result;
    }

    return [];
  }

  async createEmbeddedEntity(embeddedName, createData, options={}) {
    const t = createData.type;
    // Don't auto-equip transferred items
    if (createData._id != null && ["weapon", "equipment"].includes(t)) {
      createData.data.equipped = false;
    }
    
    super.createEmbeddedEntity(embeddedName, createData, options);
  }

  _computeEncumbrance(updateData) {
    const mergedData = mergeObject(this.data, updateData, { inplace: false });

    // Determine carrying capacity
    const carryStr = mergedData.data.abilities.str.value + mergedData.data.abilities.str.carryBonus;
    let carryMultiplier = mergedData.data.abilities.str.carryMultiplier;
    const size = mergedData.data.traits.size;
    if (mergedData.data.attributes.quadruped) carryMultiplier *= CONFIG.PF1.encumbranceMultipliers.quadruped[size];
    else carryMultiplier *= CONFIG.PF1.encumbranceMultipliers.normal[size];
    const table = CONFIG.PF1.encumbranceLoads;
    const heavy = updateData["data.attributes.encumbrance.levels.heavy"] = mergedData.data.attributes.encumbrance.levels.heavy = Math.floor(Math.max(
      3,
      carryStr >= table.length ?
        table[table.length - 1] + ((table[table.length - 1] - table[table.length - 2]) * (carryStr - (table.length - 1))) :
        table[carryStr]
    ) * carryMultiplier);
    updateData["data.attributes.encumbrance.levels.light"] = mergedData.data.attributes.encumbrance.levels.light =
      Math.floor(heavy / 3);
    updateData["data.attributes.encumbrance.levels.medium"] = mergedData.data.attributes.encumbrance.levels.medium =
      Math.floor(heavy / 3 * 2);
    updateData["data.attributes.encumbrance.levels.carry"] = mergedData.data.attributes.encumbrance.levels.carry =
      Math.floor(heavy * 2);
    updateData["data.attributes.encumbrance.levels.drag"] = mergedData.data.attributes.encumbrance.levels.drag =
      Math.floor(heavy * 5);

    // Determine carried weight
    const physicalItems = this.items.filter(o => { return o.data.data.weight != null; });
    const carriedWeight = physicalItems.reduce((cur, o) => {
      if (!o.data.data.carried) return cur;
      return cur + (o.data.data.weight * o.data.data.quantity);
    }, this._calculateCoinWeight(mergedData));
    updateData["data.attributes.encumbrance.carriedWeight"] = mergedData.data.attributes.encumbrance.carriedWeight = Math.round(carriedWeight * 10) / 10;

    // Determine load level
    let encLevel = 0;
    if (carriedWeight >= mergedData.data.attributes.encumbrance.levels.light) encLevel++;
    if (carriedWeight >= mergedData.data.attributes.encumbrance.levels.medium) encLevel++;
    updateData["data.attributes.encumbrance.level"] = mergedData.data.attributes.encumbrance.level = encLevel;
  }

  _calculateCoinWeight(data) {
    return Object.values(data.data.currency).reduce((cur, amount) => {
      return cur + amount;
    }, 0) / 50;
  }
}

