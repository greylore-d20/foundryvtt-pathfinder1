import { DicePF } from "../dice.js";
import { ItemPF } from "../item/entity.js";
import { createTag, linkData, isMinimumCoreVersion, CR } from "../lib.js";
import { createCustomChatMessage } from "../chat.js";
import { _getInitiativeFormula } from "../combat.js";
import { LinkFunctions } from "../misc/links.js";

/**
 * Extend the base Actor class to implement additional logic specialized for D&D5e.
 */
export class ActorPF extends Actor {

  /* -------------------------------------------- */

  static chatListeners(html) {
    html.on('click', 'button[data-action]', this._onChatCardButtonAction.bind(this));
  }

  static async _onChatCardButtonAction(event) {
    event.preventDefault();

    // Extract card data
    const button = event.currentTarget;
    const card = button.closest(".chat-card");
    const action = button.dataset.action;

    // Roll saving throw
    if (action === "defense-save") {
      const actor = ItemPF._getChatCardActor(card);
      const saveId = button.dataset.save;
      if (actor) actor.rollSavingThrow(saveId, { event: event });
    }
    else if (action === "save") {
      const actor = ActorPF.getActiveActor()
      const saveId = button.dataset.type;
      if (actor) actor.rollSavingThrow(saveId, { event: event });
    }
  }

  static getActiveActor({actorName=null, actorId=null}={}) {
    const speaker = ChatMessage.getSpeaker();
    let actor = game.actors.entities.filter(o => {
      if (!actorName && !actorId) return false;
      if (actorName && o.name !== actorName) return false;
      if (actorId && o._id !== actorId) return false;
      return true;
    })[0];
    if (speaker.token && !actor) actor = game.actors.tokens[speaker.token];
    if (!actor) actor = game.actors.get(speaker.actor);
    return actor;
  }

  /* -------------------------------------------- */

  get spellFailure() {
    return this.items.filter(o => { return o.type === "equipment" && o.data.data.equipped === true; }).reduce((cur, o) => {
      if (typeof o.data.data.spellFailure === "number") return cur + o.data.data.spellFailure;
      return cur;
    }, 0);
  }

  get race() {
    if (this.items == null) return null;
    return this.items.filter(o => o.type === "race")[0];
  }

  get typeColor() {
    return "#FDE600";
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
    if (type === "race") {
      result = "Race";
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
    let result = duplicate(data);

    switch (changeTarget) {
      case "mhp":
        result.attributes.hp = null;
        result.skills = null;
        break;
      case "wounds":
        result.attributes.wounds = null;
        result.skills = null;
        break;
      case "vigor":
        result.attributes.vigor = null;
        result.skills = null;
        break;
      case "str":
        result.abilities.str = null;
        result.skills = null;
        result.attributes.savingThrows = null;
      case "con":
        result.abilities.con = null;
        result.attributes.hp = null;
        result.attributes.wounds = null;
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
        "allSpeeds", "landSpeed", "climbSpeed", "swimSpeed", "burrowSpeed", "flySpeed",
        "ac", "aac", "sac", "nac",
        "attack", "mattack", "rattack",
        "damage", "wdamage", "sdamage",
        "allSavingThrows", "fort", "ref", "will",
        "cmb", "cmd", "init", "mhp", "wounds", "vigor"
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
    const priority = this._sortChangePriority;
    const targetA = priority.targets.indexOf(a.raw.target);
    const targetB = priority.targets.indexOf(b.raw.target);
    const typeA = priority.types.indexOf(a.raw.subTarget);
    const typeB = priority.types.indexOf(b.raw.subTarget);
    const modA = priority.modifiers.indexOf(a.raw.modifier);
    const modB = priority.modifiers.indexOf(b.raw.modifier);
    let prioA = (typeof a.raw.priority === "string") ? parseInt(a.raw.priority) : a.raw.priority;
    let prioB = (typeof b.raw.priority === "string") ? parseInt(b.raw.priority) : b.raw.priority;
    prioA = (prioA || 0) + 1000;
    prioB = (prioB || 0) + 1000;

    return targetA - targetB || typeA - typeB || prioB - prioA || modA - modB;
  }

  _parseChange(change, changeData, flags) {
    if (flags == null) flags = {};
    const changeType = change.raw.modifier;
    const changeValue = change.raw.value;

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

    // Add positive source
    if (changeValue > 0) {
      if (["untyped", "dodge", "penalty"].includes(changeType)) {
        changeData[changeType].positive.sources.push(change.source);
      }
      else if (prevValue.positive < changeValue) {
        changeData[changeType].positive.sources = [change.source];
      }
    }
    // Add negative source
    else {
      if (["untyped", "dodge", "penalty"].includes(changeType)) {
        changeData[changeType].negative.sources.push(change.source);
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
      case "wounds":
        return "data.attributes.wounds.max";
      case "vigor":
        return "data.attributes.vigor.max";
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
            for (let [b, subSkl] of Object.entries(skl.subSkills)) {
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
            for (let [b, subSkl] of Object.entries(skl.subSkills)) {
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
            for (let [b, subSkl] of Object.entries(skl.subSkills)) {
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
            for (let [b, subSkl] of Object.entries(skl.subSkills)) {
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
            for (let [b, subSkl] of Object.entries(skl.subSkills)) {
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
            for (let [b, subSkl] of Object.entries(skl.subSkills)) {
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
      case "allSpeeds":
        for (let speedKey of Object.keys(curData.attributes.speed)) {
          if (getProperty(curData, `attributes.speed.${speedKey}.base`)) result.push(`data.attributes.speed.${speedKey}.total`);
        }
        return result;
      case "landSpeed":
        return "data.attributes.speed.land.total";
      case "climbSpeed":
        return "data.attributes.speed.climb.total";
      case "swimSpeed":
        return "data.attributes.speed.swim.total";
      case "burrowSpeed":
        return "data.attributes.speed.burrow.total";
      case "flySpeed":
        return "data.attributes.speed.fly.total";
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

  _dataIsPC(data) {
    if (data.permission != null) {
      const nonGM = game.users.entities.filter(u => !u.isGM);
      return nonGM.some(u => {
        if (data.permission["default"] >= CONST.ENTITY_PERMISSIONS["OWNER"]) return true;
        return data.permission[u._id] >= CONST.ENTITY_PERMISSIONS["OWNER"];
      });
    }
    return this.isPC;
  }

  _addDefaultChanges(data, changes, flags, sourceInfo) {
    // Class hit points
    const classes = data.items.filter(o => o.type === "class" && getProperty(o.data, "classType") !== "racial").sort((a, b) => {
      return a.sort - b.sort;
    });
    const racialHD = data.items.filter(o => o.type === "class" && getProperty(o.data, "classType") === "racial").sort((a, b) => {
      return a.sort - b.sort;
    });

    const healthConfig = game.settings.get("pf1", "healthConfig");
    const cls_options  = this.data.type === "character" ? healthConfig.hitdice.PC : healthConfig.hitdice.NPC;
    const race_options = healthConfig.hitdice.Racial;
    const round = {up: Math.ceil, nearest: Math.round, down: Math.floor}[healthConfig.rounding];
    const continuous = {discrete: false, continuous: true}[healthConfig.continuity];

    const push_health = (value, source) => {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: value.toString(), target: "misc", subTarget: "mhp", modifier: "untyped" }, {inplace: false}),
        source: {name: source.name, subtype: source.name.toString()}
      });
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: value.toString(), target: "misc", subTarget: "vigor", modifier: "untyped" }, {inplace: false}),
        source: {name: source.name, subtype: source.name.toString()}
      });
    }
    const manual_health = (health_source) => {
      let health = health_source.data.hp + (health_source.data.classType === "base") * health_source.data.fc.hp.value;
      if (!continuous) health = round(health);
      push_health(health, health_source);
    }
    const auto_health = (health_source, options, maximized=0) => {
      let die_health = 1 + (health_source.data.hd-1) * options.rate;
      if (!continuous) die_health = round(die_health);

      const maxed_health = Math.min(health_source.data.level, maximized) * health_source.data.hd;
      const level_health = Math.max(0, health_source.data.level - maximized) * die_health;
      const favor_health = (health_source.data.classType === "base") * health_source.data.fc.hp.value;
      let   health = maxed_health + level_health + favor_health;

      push_health(health, health_source);
    }
    const compute_health = (health_sources, options) => {
      // Compute and push health, tracking the remaining maximized levels.
      if (options.auto) {
        let maximized = options.maximized;
        for (const hd of health_sources) {
          auto_health(hd, options, maximized);
          maximized = Math.max(0, maximized - hd.data.level);
        }
      } else health_sources.forEach(race => manual_health(race));
    }

    compute_health(racialHD, race_options);
    compute_health(classes, cls_options);

    // Add Constitution to HP
    let hpAbility = getProperty(data, "data.attributes.hpAbility");
    if (hpAbility == null) hpAbility = "con";
    if (hpAbility !== "") {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: `@abilities.${hpAbility}.mod * @attributes.hd.total`, target: "misc", subTarget: "mhp", modifier: "base" }, {inplace: false}),
        source: {name: "Constitution"}
      });
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: `2 * (@abilities.${hpAbility}.total + @abilities.${hpAbility}.drain)`, target: "misc", subTarget: "wounds", modifier: "base" }, {inplace: false}),
        source: {name: "Constitution"}
      });
    }

    // Add variables to CMD and CMD
    {
      // BAB to CMB
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "@attributes.bab.total", target: "misc", subTarget: "cmb", modifier: "untyped" }, {inplace: false}),
        source: {name: game.i18n.localize("PF1.BAB")},
      });
      // Strength to CMB
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "@abilities.str.mod", target: "misc", subTarget: "cmb", modifier: "untyped" }, {inplace: false}),
        source: {name: CONFIG.PF1.abilities["str"]},
      });
      // Energy Drain to CMB
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "-@attributes.energyDrain", target: "misc", subTarget: "cmb", modifier: "untyped" }, {inplace: false}),
        source: {name: game.i18n.localize("PF1.CondTypeEnergyDrain")},
      });

      // BAB to CMD
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "@attributes.bab.total", target: "misc", subTarget: "cmd", modifier: "untyped" }, {inplace: false}),
        source: {name: game.i18n.localize("PF1.BAB")},
      });
      // Strength to CMD
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "@abilities.str.mod", target: "misc", subTarget: "cmd", modifier: "untyped" }, {inplace: false}),
        source: {name: CONFIG.PF1.abilities["str"]},
      });
      // Energy Drain to CMD
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "-@attributes.energyDrain", target: "misc", subTarget: "cmd", modifier: "untyped" }, {inplace: false}),
        source: {name: game.i18n.localize("PF1.CondTypeEnergyDrain")},
      });
    }
    
    // Add Dexterity Modifier to Initiative
    {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "@abilities.dex.mod", target: "misc", subTarget: "init", modifier: "untyped", priority: -100 }, {inplace: false}),
        source: {name: CONFIG.PF1.abilities["dex"]},
      });
    }

    // Add Ability modifiers and Energy Drain to saving throws
    {
      let abl;
      // Ability Mod to Fortitude
      abl = getProperty(data, "data.attributes.savingThrows.fort.ability");
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: `@abilities.${abl}.mod`, target: "savingThrows", subTarget: "fort", modifier: "untyped" }, {inplace: false}),
        source: {name: CONFIG.PF1.abilities[abl]},
      });
      // Ability Mod to Reflex
      abl = getProperty(data, "data.attributes.savingThrows.ref.ability");
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: `@abilities.${abl}.mod`, target: "savingThrows", subTarget: "ref", modifier: "untyped" }, {inplace: false}),
        source: {name: CONFIG.PF1.abilities[abl]},
      });
      // Ability Mod to Will
      abl = getProperty(data, "data.attributes.savingThrows.will.ability");
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: `@abilities.${abl}.mod`, target: "savingThrows", subTarget: "will", modifier: "untyped" }, {inplace: false}),
        source: {name: CONFIG.PF1.abilities[abl]},
      });
      // Energy Drain
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "-@attributes.energyDrain", target: "savingThrows", subTarget: "allSavingThrows", modifier: "penalty" }, {inplace: false}),
        source: {name: game.i18n.localize("PF1.CondTypeEnergyDrain")},
      });
    }
    // Natural armor
    {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "@attributes.naturalAC", target: "ac", subTarget: "nac", modifier: "base" }, {inplace: false}),
        source: {
          name: game.i18n.localize("PF1.BuffTarACNatural"),
        }
      });
    }
    // Add armor bonuses from equipment
    data.items.filter(obj => { return obj.type === "equipment" && obj.data.equipped; }).forEach(item => {
      let armorTarget = "aac";
      if (item.data.equipmentType === "shield") armorTarget = "sac";
      // Push base armor
      if (item.data.armor.value) {
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: item.data.armor.value.toString(), target: "ac", subTarget: armorTarget, modifier: "base" }, {inplace: false}),
          source: {
            type: item.type,
            name: item.name
          }
        });
      }
      // Push enhancement bonus to armor
      if (item.data.armor.enh) {
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: item.data.armor.enh.toString(), target: "ac", subTarget: armorTarget, modifier: "enh" }, {inplace: false}),
          source: {
            type: item.type,
            name: item.name
          }
        });
      }
    });

    // Add fly bonuses or penalties based on maneuverability
    const flyKey = getProperty(data, "data.attributes.speed.fly.maneuverability");
    let flyValue = 0;
    if (flyKey != null) flyValue = CONFIG.PF1.flyManeuverabilityValues[flyKey];
    if (flyValue !== 0) {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: flyValue.toString(), target: "skill", subTarget: "skill.fly", modifier: "untyped" }, {inplace: false}),
        source: {
          name: game.i18n.localize("PF1.FlyManeuverability"),
        },
      });
    }
    // Add swim and climb skill bonuses based on having speeds for them
    {
      const climbSpeed = getProperty(data, "data.attributes.speed.climb.total") || 0;
      const swimSpeed = getProperty(data, "data.attributes.speed.swim.total") || 0;
      if (climbSpeed > 0) {
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "8", target: "skill", subTarget: "skill.clm", modifier: "racial" }, {inplace: false}),
          source: {
            name: game.i18n.localize("PF1.SpeedClimb"),
          },
        });
      }
      if (swimSpeed > 0) {
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "8", target: "skill", subTarget: "skill.swm", modifier: "racial" }, {inplace: false}),
          source: {
            name: game.i18n.localize("PF1.SpeedSwim"),
          },
        });
      }
    }

    // Add size bonuses to various attributes
    const sizeKey = data.data.traits.size;
    if (sizeKey !== "med") {
      // AC
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: CONFIG.PF1.sizeMods[sizeKey].toString(), target: "ac", subTarget: "ac", modifier: "size" }, {inplace: false}),
        source: {
          type: "size"
        }
      });
      // Stealth skill
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: CONFIG.PF1.sizeStealthMods[sizeKey].toString(), target: "skill", subTarget: "skill.ste", modifier: "size" }, {inplace: false}),
        source: {
          type: "size"
        }
      });
      // Fly skill
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: CONFIG.PF1.sizeFlyMods[sizeKey].toString(), target: "skill", subTarget: "skill.fly", modifier: "size" }, {inplace: false}),
        source: {
          type: "size"
        }
      });
      // CMB
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: CONFIG.PF1.sizeSpecialMods[sizeKey].toString(), target: "misc", subTarget: "cmb", modifier: "size" }, {inplace: false}),
        source: {
          type: "size"
        }
      });
      // CMD
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: CONFIG.PF1.sizeSpecialMods[sizeKey].toString(), target: "misc", subTarget: "cmd", modifier: "size" }, {inplace: false}),
        source: {
          type: "size"
        }
      });
    }

    // Add conditions
    for (let [con, v] of Object.entries(data.data.attributes.conditions || {})) {
      if (!v) continue;

      switch (con) {
        case "blind":
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "ac", subTarget: "ac", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondBlind") }
          });
          flags["loseDexToAC"] = true;
          sourceInfo["data.attributes.ac.normal.total"] = sourceInfo["data.attributes.ac.normal.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.ac.touch.total"] = sourceInfo["data.attributes.ac.touch.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.cmd.total"] = sourceInfo["data.attributes.cmd.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.cmd.flatFootedTotal"] = sourceInfo["data.attributes.cmd.flatFootedTotal"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.ac.normal.total"].negative.push({ name: game.i18n.localize("PF1.CondBlind"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
          sourceInfo["data.attributes.ac.touch.total"].negative.push({ name: game.i18n.localize("PF1.CondBlind"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
          sourceInfo["data.attributes.cmd.total"].negative.push({ name: game.i18n.localize("PF1.CondBlind"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
          sourceInfo["data.attributes.cmd.flatFootedTotal"].negative.push({ name: game.i18n.localize("PF1.CondBlind"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
          break;
        case "dazzled":
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-1", target: "attack", subTarget: "attack", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondDazzled") }
          });
          break;
        case "deaf":
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-4", target: "misc", subTarget: "init", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondDeaf") }
          });
          break;
        case "entangled":
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-4", target: "ability", subTarget: "dex", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondEntangled") }
          });
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "attack", subTarget: "attack", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondEntangled") }
          });
          break;
        case "grappled":
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-4", target: "ability", subTarget: "dex", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondGrappled") }
          });
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "attack", subTarget: "attack", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondGrappled") }
          });
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "misc", subTarget: "cmb", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondGrappled") }
          });
          break;
        case "helpless":
          flags["noDex"] = true;
          sourceInfo["data.abilities.dex.total"] = sourceInfo["data.abilities.dex.total"] || { positive: [], negative: [] };
          sourceInfo["data.abilities.dex.total"].negative.push({ name: game.i18n.localize("PF1.CondHelpless"), value: game.i18n.localize("PF1.ChangeFlagNoDex") });
          break;
        case "paralyzed":
          flags["noDex"] = true;
          flags["noStr"] = true;
          sourceInfo["data.abilities.dex.total"] = sourceInfo["data.abilities.dex.total"] || { positive: [], negative: [] };
          sourceInfo["data.abilities.dex.total"].negative.push({ name: game.i18n.localize("PF1.CondParalyzed"), value: game.i18n.localize("PF1.ChangeFlagNoDex") });
          sourceInfo["data.abilities.str.total"] = sourceInfo["data.abilities.str.total"] || { positive: [], negative: [] };
          sourceInfo["data.abilities.str.total"].negative.push({ name: game.i18n.localize("PF1.CondParalyzed"), value: game.i18n.localize("PF1.ChangeFlagNoStr") });
          break;
        case "pinned":
          flags["loseDexToAC"] = true;
          sourceInfo["data.attributes.ac.normal.total"] = sourceInfo["data.attributes.ac.normal.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.ac.touch.total"] = sourceInfo["data.attributes.ac.touch.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.cmd.total"] = sourceInfo["data.attributes.cmd.total"] || { positive: [], negative: [] };
          sourceInfo["data.attributes.ac.normal.total"].negative.push({ name: game.i18n.localize("PF1.CondPinned"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
          sourceInfo["data.attributes.ac.touch.total"].negative.push({ name: game.i18n.localize("PF1.CondPinned"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
          sourceInfo["data.attributes.cmd.total"].negative.push({ name: game.i18n.localize("PF1.CondPinned"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
          break;
        case "fear":
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "attack", subTarget: "attack", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondFear") }
          });
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "savingThrows", subTarget: "allSavingThrows", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondFear") }
          });
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "skills", subTarget: "skills", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondFear") }
          });
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "abilityChecks", subTarget: "allChecks", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondFear") }
          });
          break;
        case "sickened":
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "attack", subTarget: "attack", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondSickened") }
          });
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "damage", subTarget: "wdamage", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondSickened") }
          });
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "savingThrows", subTarget: "allSavingThrows", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondSickened") }
          });
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "skills", subTarget: "skills", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondSickened") }
          });
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "abilityChecks", subTarget: "allChecks", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondSickened") }
          });
          break;
        case "stunned":
          changes.push({
            raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "ac", subTarget: "ac", modifier: "penalty" }, {inplace: false}),
            source: { name: game.i18n.localize("PF1.CondStunned") }
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
    if (data.data.attributes.conditions.exhausted) {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "-6", target: "ability", subTarget: "str", modifier: "penalty" }, {inplace: false}),
        source: { name: game.i18n.localize("PF1.CondExhausted") }
      });
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "-6", target: "ability", subTarget: "dex", modifier: "penalty" }, {inplace: false}),
        source: { name: game.i18n.localize("PF1.CondExhausted") }
      });
    }
    else if (data.data.attributes.conditions.fatigued) {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "ability", subTarget: "str", modifier: "penalty" }, {inplace: false}),
        source: { name: game.i18n.localize("PF1.CondFatigued") }
      });
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "ability", subTarget: "dex", modifier: "penalty" }, {inplace: false}),
        source: { name: game.i18n.localize("PF1.CondFatigued") }
      });
    }

    // Apply level drain to hit points
    if (!Number.isNaN(data.data.attributes.energyDrain) && data.data.attributes.energyDrain > 0) {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "-(@attributes.energyDrain * 5)", target: "misc", subTarget: "mhp", modifier: "untyped" }, {inplace: false}),
        source: { name: game.i18n.localize("PF1.CondTypeEnergyDrain") }
      });
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "-(@attributes.energyDrain * 5)", target: "misc", subTarget: "vigor", modifier: "untyped" }, {inplace: false}),
        source: { name: game.i18n.localize("PF1.CondTypeEnergyDrain") }
      });
    }
  }

  async _updateChanges({data=null}={}) {
    let updateData = {};
    let srcData1 = mergeObject(this.data, expandObject(data || {}), { inplace: false });
    srcData1.items = this.items.reduce((cur, i) => {
      const otherItem = srcData1.items.filter(o => o._id === i._id)[0];
      if (otherItem) cur.push(mergeObject(i.data, otherItem, { inplace: false }));
      else cur.push(i.data);
      return cur;
    }, []);
    const changeObjects = srcData1.items.filter(obj => { return obj.data.changes != null; }).filter(obj => {
      if (obj.type === "buff") return obj.data.active;
      if (obj.type === "equipment" || obj.type === "weapon") return obj.data.equipped;
      return true;
    });

    // Track previous values
    const prevValues = {
      mhp: this.data.data.attributes.hp.max,
      wounds: getProperty(this.data, "data.attributes.wounds.max") || 0,
      vigor: getProperty(this.data, "data.attributes.vigor.max") || 0,
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

    // Initialize data
    let flags = {},
      sourceInfo = {};
    this._resetData(updateData, srcData1, flags, sourceInfo);
    this._addDefaultChanges(srcData1, allChanges, flags, sourceInfo);

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
            case "oneInt":
              sourceInfo["data.abilities.int.total"] = sourceInfo["data.abilities.int.total"] || { positive: [], negative: [] };
              targets = [sourceInfo["data.abilities.int.total"].negative];
              value = "1 Int";
              break;
            case "oneWis":
              sourceInfo["data.abilities.wis.total"] = sourceInfo["data.abilities.wis.total"] || { positive: [], negative: [] };
              targets = [sourceInfo["data.abilities.wis.total"].negative];
              value = "1 Wis";
              break;
            case "oneCha":
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
          linkData(srcData1, updateData, "data.abilities.dex.total", 0);
          linkData(srcData1, updateData, "data.abilities.dex.mod", -5);
          break;
        case "noStr":
          linkData(srcData1, updateData, "data.abilities.str.total", 0);
          linkData(srcData1, updateData, "data.abilities.str.mod", -5);
          break;
        case "oneInt":
          linkData(srcData1, updateData, "data.abilities.int.total", 1);
          linkData(srcData1, updateData, "data.abilities.int.mod", -5);
          break;
        case "oneWis":
          linkData(srcData1, updateData, "data.abilities.wis.total", 1);
          linkData(srcData1, updateData, "data.abilities.wis.mod", -5);
          break;
        case "oneCha":
          linkData(srcData1, updateData, "data.abilities.cha.total", 1);
          linkData(srcData1, updateData, "data.abilities.cha.mod", -5);
          break;
      }
    }

    // Sort changes
    allChanges.sort(this._sortChanges.bind(this));

    // Parse changes
    let temp = [];
    const origData = mergeObject(this.data, data != null ? expandObject(data) : {}, { inplace: false });
    updateData = flattenObject({ data: mergeObject(origData.data, expandObject(updateData).data, { inplace: false }) });
    this._addDynamicData({ updateData: updateData, data: srcData1, forceModUpdate: true, flags: flags });
    allChanges.forEach((change, a) => {
      const formula = change.raw.formula || "";
      if (formula === "") return;
      const changeTarget = change.raw.subTarget;
      if (changeData[changeTarget] == null) return;
      const rollData = this.getRollData(srcData1.data);

      rollData.item = {};
      if (change.source.item != null) {
        rollData.item = change.source.item.data;
      }

      const roll = new Roll(formula, rollData);

      try {
        change.raw.value = roll.roll().total;
      }
      catch (e) {
        ui.notifications.error(game.i18n.localize("PF1.ErrorItemFormula").format(change.source.item.name, this.name));
      }
      this._parseChange(change, changeData[changeTarget], flags);
      temp.push(changeData[changeTarget]);

      if (allChanges.length <= a+1 || allChanges[a+1].raw.subTarget !== changeTarget) {
        const newData = this._applyChanges(changeTarget, temp, srcData1);
        this._addDynamicData({ updateData: updateData, data: srcData1, changes: newData, flags: flags });
        temp = [];
      }
    });

    // Update encumbrance
    this._computeEncumbrance(updateData, srcData1);
    switch (srcData1.data.attributes.encumbrance.level) {
      case 0:
        linkData(srcData1, updateData, "data.attributes.acp.encumbrance", 0);
        break;
      case 1:
        linkData(srcData1, updateData, "data.attributes.acp.encumbrance", 3);
        linkData(srcData1, updateData, "data.attributes.maxDexBonus", Math.min(updateData["data.attributes.maxDexBonus"] || Number.POSITIVE_INFINITY, 3));
        break;
      case 2:
        linkData(srcData1, updateData, "data.attributes.acp.encumbrance", 6);
        linkData(srcData1, updateData, "data.attributes.maxDexBonus", Math.min(updateData["data.attributes.maxDexBonus"] || Number.POSITIVE_INFINITY, 1));
        break;
    }
    linkData(srcData1, updateData, "data.attributes.acp.total", Math.max(updateData["data.attributes.acp.gear"], updateData["data.attributes.acp.encumbrance"]));

    // Update skills and AC and CMD from Dexterity
    {
      this._updateSkills(updateData, srcData1);
      const dex = srcData1.data.abilities.dex.mod;
      const maxDex = srcData1.data.attributes.maxDexBonus;
      const ac = {
        normal: srcData1.data.attributes.ac.normal.total,
        touch: srcData1.data.attributes.ac.touch.total,
        ff: srcData1.data.attributes.ac.flatFooted.total,
      };
      const cmd = {
        normal: srcData1.data.attributes.cmd.total,
        ff: srcData1.data.attributes.cmd.flatFootedTotal,
      };
      linkData(srcData1, updateData, "data.attributes.ac.normal.total", ac.normal + (maxDex != null ? Math.min(maxDex, dex) : dex));
      linkData(srcData1, updateData, "data.attributes.ac.touch.total", ac.touch + (maxDex != null ? Math.min(maxDex, dex) : dex));
      linkData(srcData1, updateData, "data.attributes.ac.flatFooted.total", ac.ff + Math.min(0, dex));
      linkData(srcData1, updateData, "data.attributes.cmd.total", cmd.normal + (maxDex != null ? Math.min(maxDex, dex) : dex));
      linkData(srcData1, updateData, "data.attributes.cmd.flatFootedTotal", cmd.ff + Math.min(0, dex));
    }

    // Reduce final speed under certain circumstances
    let armorItems = srcData1.items.filter(o => o.type === "equipment");
    if ((updateData["data.attributes.encumbrance.level"] >= 1 && !flags.noEncumbrance) ||
    (armorItems.filter(o => getProperty(o.data, "equipmentSubtype") === "mediumArmor" && o.data.equipped).length && !flags.mediumArmorFullSpeed) ||
    (armorItems.filter(o => getProperty(o.data, "equipmentSubtype") === "heavyArmor" && o.data.equipped).length && !flags.heavyArmorFullSpeed)) {
      for (let speedKey of Object.keys(srcData1.data.attributes.speed)) {
        let value = updateData[`data.attributes.speed.${speedKey}.total`];
        linkData(srcData1, updateData, `data.attributes.speed.${speedKey}.total`, ActorPF.getReducedMovementSpeed(value));
      }
    }
    // Reset spell slots
    for (let spellbookKey of Object.keys(getProperty(srcData1, "data.attributes.spells.spellbooks"))) {
      const spellbookAbilityKey = getProperty(srcData1, `data.attributes.spells.spellbooks.${spellbookKey}.ability`);
      const spellbookAbilityMod = getProperty(srcData1, `data.abilities.${spellbookAbilityKey}.mod`);

      for (let a = 0; a < 10; a++) {
        let base = parseInt(getProperty(srcData1, `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.base`));
        if (Number.isNaN(base)) {
          linkData(srcData1, updateData, `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.base`, null);
          linkData(srcData1, updateData, `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.max`, 0);
        }
        else {
          const value = (typeof spellbookAbilityMod === "number") ? (base + ActorPF.getSpellSlotIncrease(spellbookAbilityMod, a)) : base;
          if (getProperty(srcData1, `data.attributes.spells.spellbooks.${spellbookKey}.autoSpellLevels`)) {
            linkData(srcData1, updateData, `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.max`, value);
          }
          else {
            linkData(srcData1, updateData, `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.max`, base);
          }
        }
      }
    }

    // Add current hit points
    if (updateData["data.attributes.hp.max"]) {
      const hpDiff = updateData["data.attributes.hp.max"] - prevValues.mhp;
      if (hpDiff !== 0) {
        linkData(srcData1, updateData, "data.attributes.hp.value", Math.min(updateData["data.attributes.hp.max"], srcData1.data.attributes.hp.value + hpDiff));
      }
    }
    if (updateData["data.attributes.wounds.max"]) {
      const wDiff = updateData["data.attributes.wounds.max"] - prevValues.wounds;
      if (wDiff !== 0) {
        linkData(srcData1, updateData, "data.attributes.wounds.value", Math.min(updateData["data.attributes.wounds.max"], srcData1.data.attributes.wounds.value + wDiff));
      }
    }
    if (updateData["data.attributes.vigor.max"]) {
      const vDiff = updateData["data.attributes.vigor.max"] - prevValues.vigor;
      if (vDiff !== 0) {
        linkData(srcData1, updateData, "data.attributes.vigor.value", Math.min(updateData["data.attributes.vigor.max"], srcData1.data.attributes.vigor.value + vDiff));
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
          consolidatedChanges[target] = (consolidatedChanges[target] || 0) + value.positive + value.negative;

           // Apply final rounding of health, if required.
          if (["data.attributes.hp.max", "data.attributes.wounds.max", "data.attributes.vigor.max"].includes(target)) {
            const healthConfig = game.settings.get("pf1", "healthConfig")
            const continuous = {discrete: false, continuous: true}[healthConfig.continuity]
            if (continuous) {
              const round = {up: Math.ceil, nearest: Math.round, down: Math.floor}[healthConfig.rounding]
              consolidatedChanges[target] = round(consolidatedChanges[target])
            }
          }
        }
      }
    }
    return consolidatedChanges;
  }

  _resetData(updateData, data, flags, sourceInfo) {
    const data1 = data.data;
    if (flags == null) flags = {};
    const items = data.items;
    const classes = items.filter(obj => { return obj.type === "class"; });
    const useFractionalBaseBonuses = game.settings.get("pf1", "useFractionalBaseBonuses") === true;

    // Reset HD
    linkData(data, updateData, "data.attributes.hd.total", data1.details.level.value);

    // Reset CR
    if (this.data.type === "npc") {
      linkData(data, updateData, "data.details.cr.total", this.getCR(data1));
    }

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
    linkData(data, updateData, "data.attributes.hp.max", getProperty(data, "data.attributes.hp.base") || 0);
    linkData(data, updateData, "data.attributes.wounds.max", getProperty(data, "data.attributes.wounds.base") || 0);
    linkData(data, updateData, "data.attributes.vigor.max", getProperty(data, "data.attributes.vigor.base") || 0);

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
    for (let a of Object.keys(data1.attributes.savingThrows)) {
      {
        const k = `data.attributes.savingThrows.${a}.total`;
        if (useFractionalBaseBonuses) {
          let highStart = false;
          linkData(data, updateData, k,
            Math.floor(classes.reduce((cur, obj) => {
              const saveScale = getProperty(obj, `data.savingThrows.${a}.value`) || "";
              if (saveScale === "high"){
                const acc = highStart ? 0 : 2;
                highStart = true;
                return cur + obj.data.level / 2 + acc;
              }
              if (saveScale === "low") return cur + obj.data.level / 3;
              return cur;
            }, 0))
          );

          const v = updateData[k];
          if (v !== 0) {
            sourceInfo[k] = sourceInfo[k] || { positive: [], negative: [] };
            sourceInfo[k].positive.push({ name: game.i18n.localize("PF1.Base"), value: updateData[k] });
          }
        }
        else {
          linkData(data, updateData, k,
            classes.reduce((cur, obj) => {
              const classType = getProperty(obj.data, "classType") || "base";
              let formula = CONFIG.PF1.classSavingThrowFormulas[classType][obj.data.savingThrows[a].value];
              if (formula == null) formula = "0";
              const v = Math.floor(new Roll(formula, {level: obj.data.level}).roll().total);

              if (v !== 0) {
                sourceInfo[k] = sourceInfo[k] || { positive: [], negative: [] };
                sourceInfo[k].positive.push({ name: getProperty(obj, "name"), value: v });
              }

              return cur + v;
            }, 0)
          );
        }
      }
    }

    // Reset ACP and Max Dex bonus
    linkData(data, updateData, "data.attributes.acp.gear", 0);
    linkData(data, updateData, "data.attributes.maxDexBonus", null);
    items.filter(obj => { return obj.type === "equipment" && obj.data.equipped; }).forEach(obj => {
      let itemACP = Math.abs(obj.data.armor.acp);
      if (obj.data.masterwork === true && (["armor", "shield"].includes(obj.data.equipmentType))) {
        itemACP = Math.max(0, itemACP - 1);
      }
      
      linkData(data, updateData, "data.attributes.acp.gear", updateData["data.attributes.acp.gear"] + itemACP);
      if(obj.data.armor.dex != null) {
        if (updateData["data.attributes.maxDexBonus"] == null) linkData(data, updateData, "data.attributes.maxDexBonus", Math.abs(obj.data.armor.dex));
        else {
          linkData(data, updateData, "data.attributes.maxDexBonus", Math.min(updateData["data.attributes.maxDexBonus"], Math.abs(obj.data.armor.dex)));
        }
      }
    });

    // Reset specific skill bonuses
    for (let sklKey of this._getChangeFlat("skills", "", this.data.data)) {
      if (hasProperty(data, sklKey)) linkData(data, updateData, sklKey, 0);
    }

    // Reset movement speed
    for (let speedKey of Object.keys(this.data.data.attributes.speed)) {
      const base = getProperty(data, `data.attributes.speed.${speedKey}.base`);
      linkData(data, updateData, `data.attributes.speed.${speedKey}.total`, base || 0);
    }

    // Reset BAB, CMB and CMD
    {
      const k = "data.attributes.bab.total";
      if (useFractionalBaseBonuses) {
        linkData(data, updateData, k, Math.floor(classes.reduce((cur, obj) => {
          const babScale = getProperty(obj, "data.bab") || "";
          if (babScale === "high") return cur + obj.data.level;
          if (babScale === "med") return cur + obj.data.level * 0.75;
          if (babScale === "low") return cur + obj.data.level * 0.5;
          return cur;
        }, 0)));

        const v = updateData[k];
        if (v !== 0) {
          sourceInfo[k] = sourceInfo[k] || { positive: [], negative: [] };
          sourceInfo[k].positive.push({ name: game.i18n.localize("PF1.Base"), value: v });
        }
      }
      else {
        linkData(data, updateData, k, classes.reduce((cur, obj) => {
          const formula = CONFIG.PF1.classBABFormulas[obj.data.bab] != null ? CONFIG.PF1.classBABFormulas[obj.data.bab] : "0";
          const v = new Roll(formula, {level: obj.data.level}).roll().total;

          if (v !== 0) {
            sourceInfo[k] = sourceInfo[k] || { positive: [], negative: [] };
            sourceInfo[k].positive.push({ name: getProperty(obj, "name"), value: v });
          }

          return cur + v;
        }, 0));
      }
    }
    linkData(data, updateData, "data.attributes.cmb.total", 0);
    linkData(data, updateData, "data.attributes.cmd.total", 10);
    linkData(data, updateData, "data.attributes.cmd.flatFootedTotal", 10);

    // Reset initiative
    linkData(data, updateData, "data.attributes.init.total", getProperty(data, "data.attributes.init.value") || 0);

    // Reset class skills
    for (let [k, s] of Object.entries(getProperty(data, "data.skills"))) {
      if (!s) continue;
      const isClassSkill = classes.reduce((cur, o) => {
        if ((getProperty(o, "data.classSkills") || {})[k] === true) return true;
        return cur;
      }, false);
      linkData(data, updateData, `data.skills.${k}.cs`, isClassSkill);
      for (let k2 of Object.keys(getProperty(s, "subSkills") || {})) {
        linkData(data, updateData, `data.skills.${k}.subSkills.${k2}.cs`, isClassSkill);
      }
    }
  }

  _addDynamicData({updateData={}, data={}, changes={}, flags={}, forceModUpdate=false}={}) {
    const prevMods = {};
    const modDiffs = {};

    // Reset ability modifiers
    const abilities = Object.keys(getProperty(data, "data.abilities") || {});
    for (let a of abilities) {
      prevMods[a] = forceModUpdate ? 0 : updateData[`data.abilities.${a}.mod`];
      if (a === "str" && flags.noStr ||
        a === "dex" && flags.noDex ||
        a === "int" && flags.oneInt ||
        a === "wis" && flags.oneWis ||
        a === "cha" && flags.oneCha) {
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

    // Apply changes
    for (let [changeTarget, value] of Object.entries(changes)) {
      linkData(data, updateData, changeTarget, (updateData[changeTarget] || 0) + value);
    }
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
        if (getProperty(data1, `skills.${sklKey}.subSkills.${subSklKey}`) == null) continue;

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

      let healthConfig = game.settings.get("pf1", "healthConfig");
      healthConfig  = cls.data.classType === "racial" ? healthConfig.hitdice.Racial : this.isPC ? healthConfig.hitdice.PC : healthConfig.hitdice.NPC;
      const classType = cls.data.classType || "base";
      data.classes[tag] = {
        level: cls.data.level,
        name: cls.name,
        hd: cls.data.hd,
        bab: cls.data.bab,
        hp: healthConfig.auto,
        savingThrows: {
          fort: 0,
          ref: 0,
          will: 0,
        },
        fc: {
          hp: classType === "base" ? cls.data.fc.hp.value : 0,
          skill: classType === "base" ? cls.data.fc.skill.value : 0,
          alt: classType === "base" ? cls.data.fc.alt.value : 0,
        },
      };

      for (let k of Object.keys(data.classes[tag].savingThrows)) {
        let formula = CONFIG.PF1.classSavingThrowFormulas[classType][cls.data.savingThrows[k].value];
        if (formula == null) formula =  "0";
        data.classes[tag].savingThrows[k] = new Roll(formula, {level: cls.data.level}).roll().total;
      }
    });


    // Prepare modifier containers
    data.attributes.mods = data.attributes.mods || {};
    data.attributes.mods.skills = data.attributes.mods.skills || {};

    // Set spell resistance
    if (typeof data.attributes.sr.formula === "string" && data.attributes.sr.formula.length) {
      try {
        let roll = new Roll(data.attributes.sr.formula, data).roll();
        data.attributes.sr.total = roll.total;
      }
      catch (e) {
        console.error(`Could not calculate SR for actor ${this.name} with the following formula: '${data.attributes.sr.formula}'`);
        data.attributes.sr.total = 0;
      }
    }
    else {
      data.attributes.sr.total = 0;
    }

    // Set spellbook info
    for (let spellbook of Object.values(data.attributes.spells.spellbooks)) {
      // Set CL
      spellbook.cl.total = 0;
      if (spellbook.cl.formula.length > 0) {
        let roll = new Roll(spellbook.cl.formula, data).roll();
        spellbook.cl.total += roll.total;
      }
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
        spellbook.spells[`spell${a}`] = spellbook.spells[`spell${a}`] || { value: 0, max: 0, base: null };
      }
    }

    // Set labels
    this.labels = {};
    this.labels.race = this.race == null ? game.i18n.localize("PF1.Race") : game.i18n.localize("PF1.RaceTitle").format(this.race.name);
    this.labels.alignment = CONFIG.PF1.alignments[this.data.data.details.alignment];

    // Setup links
    this.prepareItemLinks();
  }

  prepareItemLinks() {
    if (!this.items) return;

    for (let a of this.items) {
      if (a.data.data.links == null) continue;

      for (let l of Object.keys(a.data.data.links)) {
        if (LinkFunctions[l] != null) {
          LinkFunctions[l].call(this, a, a.data.data.links[l]);
        }
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
    sourceDetails["data.attributes.ac.normal.total"].push({ name: game.i18n.localize("PF1.Base"), value: 10 });
    sourceDetails["data.attributes.ac.touch.total"].push({ name: game.i18n.localize("PF1.Base"), value: 10 });
    sourceDetails["data.attributes.ac.flatFooted.total"].push({ name: game.i18n.localize("PF1.Base"), value: 10 });
    sourceDetails["data.attributes.cmd.total"].push({ name: game.i18n.localize("PF1.Base"), value: 10 });
    sourceDetails["data.attributes.cmd.flatFootedTotal"].push({ name: game.i18n.localize("PF1.Base"), value: 10 });
    for (let [a, abl] of Object.entries(actorData.data.abilities)) {
      sourceDetails[`data.abilities.${a}.total`].push({ name: game.i18n.localize("PF1.Base"), value: abl.value });
      // Add ability penalty, damage and drain
      if (abl.damage != null && abl.damage !== 0) {
        sourceDetails[`data.abilities.${a}.total`].push({ name: game.i18n.localize("PF1.AbilityDamage"), value: `-${Math.floor(Math.abs(abl.damage) / 2)} (Mod only)` });
      }
      if (abl.drain != null && abl.drain !== 0) {
        sourceDetails[`data.abilities.${a}.total`].push({ name: game.i18n.localize("PF1.AbilityDrain"), value: -Math.abs(abl.drain) });
      }
    }

    // Add AC and CMD details
    {
      const dex = actorData.data.abilities.dex.mod;
      const maxDex = actorData.data.attributes.maxDexBonus;
      const ac = {
        normal: maxDex != null ? Math.min(maxDex, dex) : dex,
        touch: maxDex != null ? Math.min(maxDex, dex) : dex,
        ff: Math.min(0, dex),
      };
      const cmd = {
        normal: maxDex != null ? Math.min(maxDex, dex) : dex,
        ff: Math.min(0, dex),
      };
      if (ac.normal  !== 0) sourceDetails["data.attributes.ac.normal.total"].push({ name: game.i18n.localize("PF1.AbilityDex"), value: ac.normal });
      if (ac.touch   !== 0) sourceDetails["data.attributes.ac.touch.total"].push({ name: game.i18n.localize("PF1.AbilityDex"), value: ac.touch });
      if (ac.ff      !== 0) sourceDetails["data.attributes.ac.flatFooted.total"].push({ name: game.i18n.localize("PF1.AbilityDex"), value: ac.ff });
      if (cmd.normal !== 0) sourceDetails["data.attributes.cmd.total"].push({ name: game.i18n.localize("PF1.AbilityDex"), value: cmd.normal });
      if (cmd.ff     !== 0) sourceDetails["data.attributes.cmd.flatFootedTotal"].push({ name: game.i18n.localize("PF1.AbilityDex"), value: cmd.ff });
    }

    // Add extra data
    for (let [changeTarget, changeGrp] of Object.entries(extraData)) {
      for (let grp of Object.values(changeGrp)) {
        if (grp.length > 0) {
          sourceDetails[changeTarget] = sourceDetails[changeTarget] || [];
          for (let src of grp) {
            let srcInfo = this.constructor._translateSourceInfo(src.type, src.subtype, src.name);
            // if (this.name === "Testy") console.log(changeTarget, src, srcInfo)
            sourceDetails[changeTarget].push({
              name: srcInfo,
              value: src.value
            });
          }
        }
      }
    }

    // if (this.name === "Testy") console.log(sourceDetails)
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
    data.details.xp.pct = Math.min(Math.round((data.details.xp.value - prior) * 100 / (req || 1)), 99.5);
  }

  /* -------------------------------------------- */

  /**
   * Prepare NPC type specific data
   */
  _prepareNPCData(data) {
    // Kill Experience
    try {
      const crTotal = getProperty(this.data, "data.details.cr.total") || 1;
      data.details.xp.value = this.getCRExp(crTotal);
    }
    catch (e) {
      data.details.xp.value = this.getCRExp(1);
    }
  }

  /**
   * Return reduced movement speed.
   * @param {Number} value - The non-reduced movement speed.
   * @returns {Number} The reduced movement speed.
   */
  static getReducedMovementSpeed(value) {
    const incr = game.settings.get("pf1", "units") === "metric" ? 1.5 : 5
    
    if (value <= 0) return value;
    if (value < 2*incr) return incr;
    value = Math.floor(value / incr) * incr;

    let result = 0,
      counter = 2;
    for (let a = incr; a <= value; a += counter * incr) {
      result += incr;
      if (counter === 1) counter = 2;
      else counter = 1;
    }

    return result;
  }

  /**
   * Return increased amount of spell slots by ability score modifier.
   * @param {Number} mod - The associated ability modifier.
   * @param {Number} level - Spell level.
   * @returns {Number} Amount of spell levels to increase.
   */
  static getSpellSlotIncrease(mod, level) {
    if (level === 0) return 0;
    if (mod <= 0) return 0;
    return Math.max(0, Math.ceil(((mod + 1) - level) / 4));
  }

  /**
   * Return the amount of experience required to gain a certain character level.
   * @param level {Number}  The desired level
   * @return {Number}       The XP required
   */
  getLevelExp(level) {
    const expConfig = game.settings.get("pf1", "experienceConfig");
    const expTrack = expConfig.track;
    // Preset experience tracks
    if (["fast", "medium", "slow"].includes(expTrack)) {
      const levels = CONFIG.PF1.CHARACTER_EXP_LEVELS[expTrack];
      return levels[Math.min(level, levels.length - 1)];
    }
    // Custom formula experience track
    let totalXP = 0;
    if (expConfig.custom.formula.length > 0) {
      for (let a = 0; a < level; a++) {
        const rollData = this.getRollData();
        rollData.level = a+1;
        const roll = new Roll(expConfig.custom.formula, rollData).roll();
        totalXP += roll.total;
      }
    }
    return Math.max(1, totalXP);
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
          let tag = createTag(skl.name || "skill");
          let count = 1;
          const skillData = getProperty(this.data, `data.skills.${tag}`) || {};
          while (this.data.data.skills[tag] != null && this.data.data.skills[tag] != curSkl) {
            count++;
            tag = createTag(skillData.name || "skill") + count.toString();
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
          let key = `data.resources.${resourceTag}.value`;
          if (data[key] != null && data[key] !== item.data.data.uses.value) {
            itemUpdateData["data.uses.value"] = data[key];
          }
          key = `data.resources.${resourceTag}.max`;
          if (data[key] != null && data[key] !== item.data.data.uses.max) {
            itemUpdateData["data.uses.max"] = data[key];
          }
          if (Object.keys(itemUpdateData).length > 0) item.update(itemUpdateData);
        }
      }
    }

    // Clean up old item resources
    for (let [tag, res] of Object.entries(getProperty(this.data, "data.resources") || {})) {
      if (!res) continue;
      if (!res._id) continue;
      const itemId = res._id;
      const item = this.getOwnedItem(itemId);
      // Remove resource from token bars
      if (item == null) {
        const tokens = this.getActiveTokens();
        tokens.forEach(token => {
          ["bar1", "bar2"].forEach(b => {
            const barAttr = token.getBarAttribute(b);
            if (barAttr == null) {
              return;
            }
            if (barAttr.attribute === `resources.${tag}`) {
              const tokenUpdateData = {};
              tokenUpdateData[`${b}.attribute`] = null;
              token.update(token.scene._id, tokenUpdateData);
            }
          });
        });
      }
      // Remove resource
      if (item == null || createTag(item.name) !== tag) {
        data[`data.resources.-=${tag}`] = null;
      }
    }

    this._updateExp(data);

    // Update changes
    let diff = data;
    if (options.updateChanges !== false) {
      const updateObj = await this._updateChanges({ data: data });
      if (updateObj.diff.items) delete updateObj.diff.items;
      diff = mergeObject(diff, updateObj.diff);
    }
    // Diff token data
    if (data.token != null) {
      diff.token = diffObject(this.data.token, data.token);
    }

    if (Object.keys(diff).length) {
      return super.update(diff, options);
    }
    return false;
  }

  _onUpdate(data, options, userId, context) {
    if (hasProperty(data, "data.attributes.vision.lowLight") || hasProperty(data, "data.attributes.vision.darkvision")) {
      canvas.sight.initializeTokens();
    }

    for (let i of this.items.values()) {
      let itemUpdateData = {};

      i._updateMaxUses(itemUpdateData, { actorData: data });

      const itemDiff = diffObject(flattenObject(i.data), itemUpdateData);
      if (Object.keys(itemDiff).length > 0) i.update(itemDiff);
    }

    return super._onUpdate(data, options, userId, context);
  }

  /**
   * Makes sure experience values are correct in update data.
   * @param {Object} data - The update data, as per ActorPF.update()
   * @returns {Boolean} Whether to force an update or not.
   */
  _updateExp(data) {
    const classes = this.items.filter(o => o.type === "class" && o.data.data.classType !== "mythic");
    console.log(classes);
    const level = classes.reduce((cur, o) => {
      return cur + o.data.data.level;
    }, 0);
    if (getProperty(this.data, "data.details.level.value") !== level) {
      data["data.details.level.value"] = level;
    }

    // The following is not for NPCs
    if (this.data.type !== "character") return;

    // Translate update exp value to number
    let newExp = data["data.details.xp.value"],
      resetExp = false;
    if (typeof newExp === "string") {
      if (newExp.match(/^\+([0-9]+)$/)) {
        newExp = this.data.data.details.xp.value + parseInt(RegExp.$1);
      }
      else if (newExp.match(/^-([0-9]+)$/)) {
        newExp = this.data.data.details.xp.value - parseInt(RegExp.$1);
      }
      else if (newExp === "") {
        resetExp = true;
      }
      else {
        newExp = parseInt(newExp);
        if (Number.isNaN(newExp)) newExp = this.data.data.details.xp.value;
      }

      if (typeof newExp === "number" && newExp !== getProperty(this.data, "data.details.xp.value")) {
        data["data.details.xp.value"] = newExp;
      }
    }
    const maxExp = this.getLevelExp(level);
    if (maxExp !== getProperty(this.data, "data.details.xp.max")) {
      data["data.details.xp.max"] = maxExp;
    }

    const minExp = level > 0 ? this.getLevelExp(level - 1) : 0;
    if (resetExp) data["data.details.xp.value"] = minExp;
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
   * @param {ItemPF} item   The spell being cast by the actor
   * @param {MouseEvent} ev The click event
   */
  async useSpell(item, ev, {skipDialog=false}={}) {
    if (!this.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));
    if ( item.data.type !== "spell" ) throw new Error("Wrong Item type");

    if (getProperty(item.data, "data.preparation.mode") !== "atwill" && item.getSpellUses() <= 0) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoSpellsLeft"));

    // Invoke the Item roll
    if (item.hasAction) return item.useAttack({ev: ev, skipDialog: skipDialog});
    item.addSpellUses(-1);
    return item.roll();
  }

  async createAttackFromWeapon(item) {
    if (!this.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));

    if (item.data.type !== "weapon") throw new Error("Wrong Item type");

    // Get attack template
    let attackData = { data: {} };
    for (const template of game.data.system.template.Item.attack.templates) {
      mergeObject(attackData.data, game.data.system.template.Item.templates[template]);
    }
    mergeObject(attackData.data, duplicate(game.data.system.template.Item.attack));
    attackData = flattenObject(attackData);

    // Add ability modifiers
    const isMelee = getProperty(item.data, "data.weaponSubtype") !== "ranged" && !getProperty(item.data, "data.properties.thr");
    if (isMelee) attackData["data.ability.attack"] = "str";
    else attackData["data.ability.attack"] = "dex";
    if (isMelee || item.data.data.properties["thr"] === true) {
      attackData["data.ability.damage"] = "str";
      if (item.data.data.weaponSubtype === "2h" && isMelee) attackData["data.ability.damageMult"] = 1.5;
    }

    // Add misc things
    attackData["type"] = "attack";
    attackData["name"] = item.data.name;
    attackData["data.masterwork"] = item.data.data.masterwork;
    attackData["data.attackType"] = "weapon";
    attackData["data.enh"] = item.data.data.enh;
    attackData["data.ability.critRange"] = item.data.data.weaponData.critRange || 20;
    attackData["data.ability.critMult"] = item.data.data.weaponData.critMult || 2;
    attackData["data.actionType"] = isMelee ? "mwak" : "rwak";
    attackData["data.activation.type"] = "attack";
    attackData["data.duration.units"] = "inst";
    attackData["img"] = item.data.img;

    // Add additional attacks
    let extraAttacks = [];
    for (let a = 5; a < this.data.data.attributes.bab.total; a += 5) {
      extraAttacks = extraAttacks.concat([[`-${a}`, `${game.i18n.localize("PF1.Attack")} ${Math.floor((a+5) / 5)}`]]);
    }
    if (extraAttacks.length > 0) attackData["data.attackParts"] = extraAttacks;

    // Add damage formula
    if (item.data.data.weaponData.damageRoll) {
      const die = item.data.data.weaponData.damageRoll || "1d4";
      let part = die;
      let dieCount = 1,
        dieSides = 4;
      if (die.match(/^([0-9]+)d([0-9]+)$/)) {
        dieCount = parseInt(RegExp.$1);
        dieSides = parseInt(RegExp.$2);
        // const weaponSize = Object.keys(CONFIG.PF1.sizeChart).indexOf(item.data.data.weaponData.size) - 4;
        part = `sizeRoll(${dieCount}, ${dieSides}, @size, @critMult)`;
      }
      const bonusFormula = getProperty(item.data, "data.weaponData.damageFormula");
      if (bonusFormula != null && bonusFormula.length) part = `${part} + ${bonusFormula}`;
      attackData["data.damage.parts"] = [[part, item.data.data.weaponData.damageType || ""]];
    }

    // Add attack bonus formula
    {
      const bonusFormula = getProperty(item.data, "data.weaponData.attackFormula");
      if (bonusFormula != null && bonusFormula.length) attackData["data.attackBonus"] = bonusFormula;
    }

    // Add range
    if (!isMelee && getProperty(item.data, "data.weaponData.range") != null) {
      attackData["data.range.units"] = "ft";
      attackData["data.range.value"] = getProperty(item.data, "data.weaponData.range").toString();
    }

    // Create attack
    if (hasProperty(attackData, "data.templates")) delete attackData["data.templates"];
    const itemData = await this.createOwnedItem(expandObject(attackData));

    // Create link
    const link = {
      id: itemData._id,
      dataType: "data",
    };
    const links = [...(getProperty(item.data, "data.links.children") || []), link];
    await item.update({"data.links.children": links});

    ui.notifications.info(game.i18n.localize("PF1.NotificationCreatedAttack").format(item.data.name));
  }

  /* -------------------------------------------- */

  /**
   * Roll a Skill Check
   * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
   * @param {string} skillId      The skill id (e.g. "ins")
   * @param {Object} options      Options which configure how the skill check is rolled
   */
  rollSkill(skillId, options={}) {
    if (!this.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));

    let skl, sklName;
    const skillParts = skillId.split("."),
      isSubSkill = skillParts[1] === "subSkills" && skillParts.length === 3;
    if (isSubSkill) {
      skillId = skillParts[0];
      skl = this.data.data.skills[skillId].subSkills[skillParts[2]];
      sklName = `${CONFIG.PF1.skills[skillId]} (${skl.name})`;
    }
    else {
      skl = this.data.data.skills[skillId];
      if (skl.name != null) sklName = skl.name;
      else sklName = CONFIG.PF1.skills[skillId];
    }

    // Add contextual attack string
    let notes = [];
    const rollData = duplicate(this.data.data);
    const noteObjects = this.getContextNotes(`skill.${isSubSkill ? skillParts[2] : skillId}`);
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        notes.push(...note.split(/[\n\r]+/).map(o => TextEditor.enrichHTML(o, {rollData: rollData})));
      }
    }
    // Add untrained note
    if (skl.rt && skl.rank === 0) {
      notes.push(game.i18n.localize("PF1.Untrained"));
    }

    let props = [];
    if (notes.length > 0) props.push({ header: "Notes", value: notes });
    return DicePF.d20Roll({
      event: options.event,
      fastForward: options.skipDialog === true,
      staticRoll: options.staticRoll,
      parts: ["@mod"],
      data: {mod: skl.mod},
      title: game.i18n.localize("PF1.SkillCheck").format(sklName),
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
    if (!this.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));

    return DicePF.d20Roll({
      event: options.event,
      parts: ["@mod"],
      data: {mod: this.data.data.attributes.bab.total},
      title: game.i18n.localize("PF1.BAB"),
      speaker: ChatMessage.getSpeaker({actor: this}),
      takeTwenty: false
    });
  }

  rollCMB(options={}) {
    if (!this.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));

    // Add contextual notes
    let notes = [];
    const rollData = duplicate(this.data.data);
    const noteObjects = this.getContextNotes("misc.cmb");
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        if (!isMinimumCoreVersion("0.5.2")) {
          let noteStr = "";
          if (note.length > 0) {
            noteStr = DicePF.messageRoll({
              data: rollData,
              msgStr: note
            });
          }
          if (noteStr.length > 0) notes.push(...noteStr.split(/[\n\r]+/));
        }
        else notes.push(...note.split(/[\n\r]+/).map(o => TextEditor.enrichHTML(o, {rollData: rollData})));
      }
    }
    // Add grapple note
    if (this.data.data.attributes.conditions.grappled) {
      notes.push("+2 to Grapple");
    }

    let props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });
    return DicePF.d20Roll({
      event: options.event,
      parts: ["@mod"],
      data: {mod: this.data.data.attributes.cmb.total},
      title: game.i18n.localize("PF1.CMB"),
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
      headers.push({ header: game.i18n.localize("PF1.DamRed"), value: data.traits.dr.split(reSplit) });
    }
    // Energy resistance
    if (data.traits.eres.length) {
      headers.push({ header: game.i18n.localize("PF1.EnRes"), value: data.traits.eres.split(reSplit) });
    }
    // Damage vulnerabilities
    if (data.traits.dv.value.length || data.traits.dv.custom.length) {
      const value = [].concat(
        data.traits.dv.value.map(obj => { return CONFIG.PF1.damageTypes[obj]; }),
        data.traits.dv.custom.length > 0 ? data.traits.dv.custom.split(";") : [],
      );
      headers.push({ header: game.i18n.localize("PF1.DamVuln"), value: value });
    }
    // Condition resistance
    if (data.traits.cres.length) {
      headers.push({ header: game.i18n.localize("PF1.ConRes"), value: data.traits.cres.split(reSplit) });
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
      headers.push({ header: game.i18n.localize("PF1.ImmunityPlural"), value: value });
    }
    // Spell Resistance
    if (data.attributes.sr.total > 0) {
      misc.push(game.i18n.localize("PF1.SpellResistanceNote").format(data.attributes.sr.total));
    }

    if (misc.length > 0) {
      headers.push({ header: game.i18n.localize("PF1.MiscShort"), value: misc });
    }

    return headers;
  }

  async rollInitiative() {
    if (!this.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));

    let formula = _getInitiativeFormula(this);
    let overrideRollMode = null,
      bonus = "",
      stop = false;
    if (keyboard.isDown("Shift")) {
      const dialogData = await Combat.showInitiativeDialog(formula);
      overrideRollMode = dialogData.rollMode;
      bonus = dialogData.bonus || "";
      stop = dialogData.stop || false;
    }

    if (stop) return;

    const actorData = this.getRollData();
    // Add bonus
    actorData.bonus = bonus;
    if (bonus.length > 0) formula += " + @bonus";

    // Roll initiative
    const rollMode = overrideRollMode;
    const roll = new Roll(formula, actorData).roll();

    // Construct chat message data
    let messageData = {
      speaker: {
        scene: canvas.scene._id,
        actor: this._id,
        token: this.token ? this.token._id : null,
        alias: this.token ? this.token.name : null,
      },
      flavor: game.i18n.localize("PF1.RollsForInitiative").format(this.token ? this.token.name : this.name),
    };
    roll.toMessage(messageData, {rollMode});
  }

  rollSavingThrow(savingThrowId, options={}) {
    if (!this.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));

    // Add contextual notes
    let notes = [];
    const rollData = duplicate(this.data.data);
    const noteObjects = this.getContextNotes(`savingThrow.${savingThrowId}`);
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        if (!isMinimumCoreVersion("0.5.2")) {
          let noteStr = "";
          if (note.length > 0) {
            noteStr = DicePF.messageRoll({
              data: rollData,
              msgStr: note
            });
          }
          if (noteStr.length > 0) notes.push(...noteStr.split(/[\n\r]+/));
        }
        else notes.push(...note.split(/[\n\r]+/).map(o => TextEditor.enrichHTML(o, {rollData: rollData})));
      }
    }

    // Roll saving throw
    let props = this.getDefenseHeaders();
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });
    const label = CONFIG.PF1.savingThrows[savingThrowId];
    const savingThrow = this.data.data.attributes.savingThrows[savingThrowId];
    return DicePF.d20Roll({
      event: options.event,
      parts: ["@mod"],
      situational: true,
      data: { mod: savingThrow.total },
      title: game.i18n.localize("PF1.SavingThrowRoll").format(label),
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
    if (!this.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));

    // Add contextual notes
    let notes = [];
    const rollData = duplicate(this.data.data);
    const noteObjects = this.getContextNotes(`abilityChecks.${abilityId}`);
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        if (!isMinimumCoreVersion("0.5.2")) {
          let noteStr = "";
          if (note.length > 0) {
            noteStr = DicePF.messageRoll({
              data: rollData,
              msgStr: note
            });
          }
          if (noteStr.length > 0) notes.push(...noteStr.split(/[\n\r]+/));
        }
        else notes.push(...note.split(/[\n\r]+/).map(o => TextEditor.enrichHTML(o, {rollData: rollData})));
      }
    }

    let props = this.getDefenseHeaders();
    if (notes.length > 0) props.push({ header: "Notes", value: notes });
    const label = CONFIG.PF1.abilities[abilityId];
    const abl = this.data.data.abilities[abilityId];
    return DicePF.d20Roll({
      event: options.event,
      parts: ["@mod + @checkMod - @energyDrain"],
      data: {mod: abl.mod, checkMod: abl.checkMod, energyDrain: this.data.data.attributes.energyDrain},
      title: game.i18n.localize("PF1.AbilityTest").format(label),
      speaker: ChatMessage.getSpeaker({actor: this}),
      chatTemplate: "systems/pf1/templates/chat/roll-ext.html",
      chatTemplateData: { hasProperties: props.length > 0, properties: props }
    });
  }

  /**
   * Show defenses in chat
   */
  rollDefenses() {
    if (!this.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));
    const rollData = duplicate(this.data.data);

    // Add contextual AC notes
    let acNotes = [];
    if (this.data.data.attributes.acNotes.length > 0) acNotes = this.data.data.attributes.acNotes.split(/[\n\r]+/);
    const acNoteObjects = this.getContextNotes("misc.ac");
    for (let noteObj of acNoteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        if (!isMinimumCoreVersion("0.5.2")) {
          let noteStr = "";
          if (note.length > 0) {
            noteStr = DicePF.messageRoll({
              data: rollData,
              msgStr: note
            });
          }
          if (noteStr.length > 0) acNotes.push(...noteStr.split(/[\n\r]+/));
        }
        else acNotes.push(...note.split(/[\n\r]+/).map(o => TextEditor.enrichHTML(o, {rollData: rollData})));
      }
    }

    // Add contextual CMD notes
    let cmdNotes = [];
    if (this.data.data.attributes.cmdNotes.length > 0) cmdNotes = this.data.data.attributes.cmdNotes.split(/[\n\r]+/);
    const cmdNoteObjects = this.getContextNotes("misc.cmd");
    for (let noteObj of cmdNoteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        if (!isMinimumCoreVersion("0.5.2")) {
          let noteStr = "";
          if (note.length > 0) {
            noteStr = DicePF.messageRoll({
              data: rollData,
              msgStr: note
            });
          }
          if (noteStr.length > 0) cmdDotes.push(...noteStr.split(/[\n\r]+/));
        }
        else cmdNotes.push(...note.split(/[\n\r]+/).map(o => TextEditor.enrichHTML(o, {rollData: rollData})));
      }
    }

    // Add contextual SR notes
    let srNotes = [];
    if (this.data.data.attributes.srNotes.length > 0) srNotes = this.data.data.attributes.srNotes.split(/[\n\r]+/);
    const srNoteObjects = this.getContextNotes("misc.sr");
    for (let noteObj of srNoteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData.item = duplicate(noteObj.item.data.data);

      for (let note of noteObj.notes) {
        if (!isMinimumCoreVersion("0.5.2")) {
          let noteStr = "";
          if (note.length > 0) {
            noteStr = DicePF.messageRoll({
              data: rollData,
              msgStr: note
            });
          }
          if (noteStr.length > 0) srNotes.push(...noteStr.split(/[\n\r]+/));
        }
        else srNotes.push(...note.split(/[\n\r]+/).map(o => TextEditor.enrichHTML(o, {rollData: rollData})));
      }
    }

    // Add misc data
    const reSplit = CONFIG.PF1.re.traitSeparator;
    // Damage Reduction
    let drNotes = [];
    if (this.data.data.traits.dr.length) {
      drNotes = this.data.data.traits.dr.split(reSplit);
    }
    // Energy Resistance
    let energyResistance = [];
    if (this.data.data.traits.eres.length) {
      energyResistance.push(...this.data.data.traits.eres.split(reSplit));
    }
    // Damage Immunity
    if (this.data.data.traits.di.value.length || this.data.data.traits.di.custom.length) {
      const values = [
        ...this.data.data.traits.di.value.map(obj => { return CONFIG.PF1.damageTypes[obj]; }),
        ...this.data.data.traits.di.custom.length > 0 ? this.data.data.traits.di.custom.split(reSplit) : [],
      ];
      energyResistance.push(...values.map(o => game.i18n.localize("PF1.ImmuneTo").format(o)));
    }
    // Damage Vulnerability
    if (this.data.data.traits.dv.value.length || this.data.data.traits.dv.custom.length) {
      const values = [
        ...this.data.data.traits.dv.value.map(obj => { return CONFIG.PF1.damageTypes[obj]; }),
        ...this.data.data.traits.dv.custom.length > 0 ? this.data.data.traits.dv.custom.split(reSplit) : [],
      ];
      energyResistance.push(...values.map(o => game.i18n.localize("PF1.VulnerableTo").format(o)));
    }

    // Create message
    const d = this.data.data;
    const data = {
      actor: this,
      name: this.name,
      tokenId: this.token ? `${this.token.scene._id}.${this.token.id}` : null,
      ac: {
        normal: d.attributes.ac.normal.total,
        touch: d.attributes.ac.touch.total,
        flatFooted: d.attributes.ac.flatFooted.total,
        notes: acNotes,
      },
      cmd: {
        normal: d.attributes.cmd.total,
        flatFooted: d.attributes.cmd.flatFootedTotal,
        notes: cmdNotes,
      },
      misc: {
        sr: d.attributes.sr.total,
        srNotes: srNotes,
        drNotes: drNotes,
        energyResistance: energyResistance,
      },
    };
    // Add regeneration and fast healing
    if ((getProperty(d, "traits.fastHealing") || "").length || (getProperty(d, "traits.regen") || "").length) {
      data.regen = {
        regen: d.traits.regen,
        fastHealing: d.traits.fastHealing,
      };
    }
    createCustomChatMessage("systems/pf1/templates/chat/defenses.html", data, {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    });
  }

  /* -------------------------------------------- */

  /**
   * Apply rolled dice damage to the token or tokens which are currently controlled.
   * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
   *
   * @param {Number} value   The amount of damage to deal.
   * @return {Promise}
   */
  static async applyDamage(value) {
    const promises = [];
    for (let t of canvas.tokens.controlled) {
      let a = t.actor,
          hp = a.data.data.attributes.hp,
          tmp = parseInt(hp.temp) || 0,
          dt = value > 0 ? Math.min(tmp, value) : 0;
      if (!a.hasPerm(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));
        continue;
      }
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

    // Attacks
    if (context.match(/^attacks\.(.+)/)) {
      const key = RegExp.$1;
      for (let note of result) {
        note.notes = note.notes.filter(o => {
          return (o.target === "attacks" && o.subTarget === key);
        }).map(o => { return o.text; });
      }

      return result;
    }

    // Skill
    if (context.match(/^skill\.(.+)/)) {
      const skillKey = RegExp.$1;
      const skill = this.getSkill(skillKey);
      const ability = skill.ability;
      for (let note of result) {
        note.notes = note.notes.filter(o => {
          return (o.target === "skill" && o.subTarget === context) || (o.target === "skills" && (o.subTarget === `${ability}Skills` || o.subTarget === "skills"));
        }).map(o => { return o.text; });
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
          return o.target === "savingThrows" && (o.subTarget === saveKey || o.subTarget === "allSavingThrows");
        }).map(o => { return o.text; });
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
          return o.target === "abilityChecks" && (o.subTarget === `${ablKey}Checks` || o.subTarget === "allChecks");
        }).map(o => { return o.text; });
      }

      return result;
    }

    // Misc
    if (context.match(/^misc\.(.+)/)) {
      const miscKey = RegExp.$1;
      for (let note of result) {
        note.notes = note.notes.filter(o => {
          return o.target === "misc" && o.subTarget === miscKey;
        }).map(o => { return o.text; });
      }

      if (miscKey === "cmb" && this.data.data.attributes.cmbNotes != null && this.data.data.attributes.cmbNotes !== "") {
        result.push({ notes: [this.data.data.attributes.cmbNotes], item: null });
      }

      return result;
    }

    return [];
  }

  async createEmbeddedEntity(embeddedName, createData, options={}) {
    let noArray = false;
    if (!(createData instanceof Array)) {
      createData = [createData];
      noArray = true;
    }

    for (let obj of createData) {
      // Don't auto-equip transferred items
      if (obj._id != null && ["weapon", "equipment"].includes(obj.type)) {
        obj.data.equipped = false;
      }
    }

    return super.createEmbeddedEntity(embeddedName, (noArray ? createData[0] : createData), options);
  }

  _computeEncumbrance(updateData, srcData) {
    const carry = this.getCarryCapacity(srcData);
    linkData(srcData, updateData, "data.attributes.encumbrance.levels.light", carry.light);
    linkData(srcData, updateData, "data.attributes.encumbrance.levels.medium", carry.medium);
    linkData(srcData, updateData, "data.attributes.encumbrance.levels.heavy", carry.heavy);
    linkData(srcData, updateData, "data.attributes.encumbrance.levels.carry", carry.heavy * 2);
    linkData(srcData, updateData, "data.attributes.encumbrance.levels.drag", carry.heavy * 5);

    const carriedWeight = Math.max(0, this.getCarriedWeight(srcData));
    linkData(srcData, updateData, "data.attributes.encumbrance.carriedWeight", Math.round(carriedWeight * 10) / 10);

    // Determine load level
    let encLevel = 0;
    if (carriedWeight > 0) {
      if (carriedWeight >= srcData.data.attributes.encumbrance.levels.light) encLevel++;
      if (carriedWeight >= srcData.data.attributes.encumbrance.levels.medium) encLevel++;
    }
    linkData(srcData, updateData, "data.attributes.encumbrance.level", encLevel);
  }

  _calculateCoinWeight(data) {
    return Object.values(data.data.currency).reduce((cur, amount) => {
      return cur + amount;
    }, 0) / 50;
  }

  getCarryCapacity(srcData) {
    // Determine carrying capacity
    const carryStr = srcData.data.abilities.str.total + srcData.data.abilities.str.carryBonus;
    let carryMultiplier = srcData.data.abilities.str.carryMultiplier;
    const size = srcData.data.traits.size;
    if (srcData.data.attributes.quadruped) carryMultiplier *= CONFIG.PF1.encumbranceMultipliers.quadruped[size];
    else carryMultiplier *= CONFIG.PF1.encumbranceMultipliers.normal[size];
    const table = CONFIG.PF1.encumbranceLoads;

    let heavy = Math.floor(table[carryStr] * carryMultiplier);
    if (carryStr >= table.length) {
      heavy = Math.floor(table[table.length-1] * (1 + (0.3 * (carryStr - (table.length-1)))));
    }
    // 1 Kg = 0.5 Kg
    if(game.settings.get("pf1", "units") === "metric") {
      heavy = heavy / 2
    }
      
    return {
      light: Math.floor(heavy / 3),
      medium: Math.floor(heavy / 3 * 2),
      heavy: heavy,
    };
  }

  getCarriedWeight(srcData) {
    // Determine carried weight
    const physicalItems = srcData.items.filter(o => { return o.data.weight != null; });
    return physicalItems.reduce((cur, o) => {
      if (!o.data.carried) return cur;
      return cur + (o.data.weight * o.data.quantity);
    }, this._calculateCoinWeight(srcData));
  }

  /**
   * @returns {number} The total amount of currency this actor has, in gold pieces
   */
  mergeCurrency() {
    const carried = getProperty(this.data.data, "currency");
    const alt = getProperty(this.data.data, "altCurrency");
    return (carried ? carried.pp * 10 + carried.gp + carried.sp / 10 + carried.cp / 100 : 0) +
      (alt ? alt.pp * 10 + alt.gp + alt.sp / 10 + alt.cp / 100 : 0);
  }

  /**
   * Import a new owned Item from a compendium collection
   * The imported Item is then added to the Actor as an owned item.
   *
   * @param collection {String}     The name of the pack from which to import
   * @param entryId {String}        The ID of the compendium entry to import
   */
  importItemFromCollection(collection, entryId) {
    const pack = game.packs.find(p => p.collection === collection);
    if (pack.metadata.entity !== "Item") return;

    return pack.getEntity(entryId).then(ent => {
      console.log(`${vtt} | Importing Item ${ent.name} from ${collection}`);

      let data = duplicate(ent.data);
      if (this.sheet != null && this.sheet.rendered) {
        data = mergeObject(data, this.sheet.getDropData(data));
      }
      delete data._id;
      return this.createOwnedItem(data);
    });
  }

  _createConsumableSpellDialog(itemData) {
    new Dialog({
      title: game.i18n.localize("PF1.CreateItemForSpell").format(itemData.name),
      content: game.i18n.localize("PF1.CreateItemForSpell").format(itemData.name),
      buttons: {
        potion: {
          icon: '<i class="fas fa-prescription-bottle"></i>',
          label: "Potion",
          callback: () => this.createConsumableSpell(itemData, "potion"),
        },
        scroll: {
          icon: '<i class="fas fa-scroll"></i>',
          label: "Scroll",
          callback: () => this.createConsumableSpell(itemData, "scroll"),
        },
        wand: {
          icon: '<i class="fas fa-magic"></i>',
          label: "Wand",
          callback: () => this.createConsumableSpell(itemData, "wand"),
        },
      },
      default: "potion",
    }).render(true);
  }

  async createConsumableSpell(itemData, type) {
    let data = await ItemPF.toConsumable(itemData, type);

    if (data._id) delete data._id;
    this.createEmbeddedEntity("OwnedItem", data);
  }

  getRollData(data=null) {
    if (data == null) data = this.data.data;
    const result = mergeObject(data, {
      size: Object.keys(CONFIG.PF1.sizeChart).indexOf(getProperty(data, "traits.size")) - 4,
    }, { inplace: false });

    return result;
  }

  getCR(data=null) {
    if (this.data.type !== "npc") return 0;
    if (data == null) data = this.data.data;

    const base = data.details.cr.base;
    if (this.items == null) return base;

    // Gather CR from templates
    const templates = this.items.filter(o => o.type === "feat" && o.data.data.featType === "template");
    return templates.reduce((cur, o) => {
      const crOffset = o.data.data.crOffset;
      if (typeof crOffset === "string" && crOffset.length) cur += new Roll(crOffset, this.getRollData(data)).roll().total;
      return cur;
    }, base);
  }

  async deleteEmbeddedEntity(embeddedName, data, options={}) {
    if (embeddedName === "OwnedItem") {
      if (!(data instanceof Array)) data = [data];

      // Add children to list of items to be deleted
      const _addChildren = async function(id) {
        const item = this.items.find(o => o._id === id);
        const children = await item.getLinkedItems("children");
        for (let child of children) {
          if (!data.includes(child._id)) {
            data.push(child._id);
            await _addChildren.call(this, child._id);
          }
        }
      }
      for (let id of data) {
        await _addChildren.call(this, id);
      }
    }

    super.deleteEmbeddedEntity(embeddedName, data, options);
  }
}
