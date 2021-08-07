import { DicePF } from "../dice.js";
import { ItemPF } from "../item/entity.js";
import { createTag, convertDistance, convertWeight } from "../lib.js";
import { createCustomChatMessage } from "../chat.js";
import { _getInitiativeFormula } from "../combat.js";
import { LinkFunctions } from "../misc/links.js";
import { getSkipActionPrompt } from "../settings.js";
import {
  applyChanges,
  addDefaultChanges,
  getChangeFlat,
  getSourceInfo,
  setSourceInfoByName,
  getHighestChanges,
} from "./apply-changes.js";
import { RollPF } from "../roll.js";
import { VisionPermissionSheet } from "../misc/vision-permission.js";

/**
 * Extend the base Actor class to implement additional logic specialized for D&D5e.
 */
export class ActorPF extends Actor {
  constructor(...args) {
    super(...args);

    /**
     * A list of all the active items with changes.
     *
     * @property
     * @type {Array}
     */
    if (this.changeItems === undefined) this.changeItems = [];

    /**
     * Stores all ItemChanges from carried items.
     *
     * @property
     * @public
     * @type {object}
     */
    if (this.changes === undefined) this.changes = new Collection();

    /**
     * Stores updates to be applied to the actor near the end of the _onUpdate method.
     *
     * @property
     * @private
     * @type {object.<string, any>}
     */
    if (this._queuedUpdates === undefined) this._queuedUpdates = {};

    /**
     * @property {object} _rollData
     * Cached roll data for this item.
     */
    if (this._rollData === undefined) this._rollData = null;

    /**
     * @property {object.<string>} _runningFunctions
     * Keeps track of currently running async functions that shouldn't run multiple times simultaneously.
     */
    if (this._runningFunctions === undefined) this._runningFunctions = {};

    /**
     * @property {object} _queuedItemUpdates
     * A dictionary of item IDs and the data to update. Will be called once this actor has been updated, and immediately cleared.
     */
    if (this._queuedItemUpdates === undefined) this._queuedItemUpdates = {};

    /**
     * @property {ItemPF[]} containerItems
     * All items this actor is holding in containers.
     */
    if (this.containerItems === undefined) this.containerItems = [];

    /**
     * @property {object} _prevAttributes
     * A list of attributes to remember between updates.
     */
    if (this._prevAttributes === undefined) this._prevAttributes = null;
  }

  /* -------------------------------------------- */

  static chatListeners(html) {
    html.on("click", "button[data-action], a[data-action]", this._onChatCardButtonAction.bind(this));
  }

  static async _onChatCardButtonAction(event) {
    event.preventDefault();

    // Extract card data
    const button = event.currentTarget;
    const card = button.closest(".chat-card");
    const action = button.dataset.action;

    // Roll saving throw
    if (action === "defense-save") {
      const actor = await ItemPF._getChatCardActor(card);
      const saveId = button.dataset.save;
      if (actor) actor.rollSavingThrow(saveId, { event: event, skipPrompt: getSkipActionPrompt() });
    } else if (action === "save") {
      const actors = ActorPF.getSelectedActors();
      const saveId = button.dataset.type;
      let noSound = false;
      for (let a of actors) {
        a[0].rollSavingThrow(saveId, { event: event, noSound: noSound, skipPrompt: getSkipActionPrompt() });
        noSound = true;
      }
    }
    // Show compendium entry
    else if (action === "open-compendium-entry") {
      const entryKey = button.dataset.compendiumEntry;
      const parts = entryKey.split(".");
      const packKey = parts.slice(0, 2).join(".");
      const entryId = parts.slice(-1)[0];
      const pack = game.packs.get(packKey);
      const entry = await pack.getEntity(entryId);
      entry.sheet.render(true);
    }
  }

  static getActiveActor({ actorName = null, actorId = null } = {}) {
    const speaker = ChatMessage.getSpeaker();
    let actor;

    if (actorName || actorId) {
      actor = game.actors.contents.find((o) => {
        if (actorName && o.name !== actorName) return false;
        if (actorId && o.id !== actorId) return false;
        return true;
      });
    }
    if (speaker.token && !actor) actor = canvas.tokens.placeables.find((o) => o.id === speaker.token)?.actor;
    if (!actor) actor = game.actors.get(speaker.actor);

    return actor;
  }

  /**
   * Returns an array of all selected tokens, along with their actors.
   *
   * @returns {Array.<ActorPF, Token>[]}
   */
  static getSelectedActors() {
    let result = [];
    for (let t of canvas.tokens.controlled) {
      result.push([t.actor, t]);
    }
    return result;
  }

  /* -------------------------------------------- */

  get spellFailure() {
    return this.items
      .filter((o) => {
        return o.type === "equipment" && o.data.data.equipped === true;
      })
      .reduce((cur, o) => {
        if (typeof o.data.data.spellFailure === "number") return cur + o.data.data.spellFailure;
        return cur;
      }, 0);
  }

  get race() {
    if (this.items == null) return null;
    return this.items.filter((o) => o.type === "race")[0];
  }

  get typeColor() {
    return "#FDE600";
  }

  static _translateSourceInfo(type, subtype, name) {
    let result = "";
    if (type === "size") result = game.i18n.localize("PF1.SourceInfoSize");
    if (type === "buff") {
      result = game.i18n.localize("PF1.SourceInfoBuffs");
      if (subtype === "temp") result = game.i18n.localize("PF1.SourceInfoTemporaryBuffs");
      if (subtype === "perm") result = game.i18n.localize("PF1.SourceInfoPermanentBuffs");
      if (subtype === "item") result = game.i18n.localize("PF1.SourceInfoItemBuffs");
      if (subtype === "misc") result = game.i18n.localize("PF1.SourceInfoMiscBuffs");
    }
    if (type === "equipment") result = game.i18n.localize("PF1.SourceInfoEquipment");
    if (type === "weapon") result = game.i18n.localize("PF1.SourceInfoWeapons");
    if (type === "feat") {
      result = game.i18n.localize("PF1.SourceInfoFeats");
      if (subtype === "classFeat") result = game.i18n.localize("PF1.SourceInfoClassFeatures");
      if (subtype === "trait") result = game.i18n.localize("PF1.SourceInfoTraits");
      if (subtype === "racial") result = game.i18n.localize("PF1.SourceInfoRacialTraits");
      if (subtype === "misc") result = game.i18n.localize("PF1.SourceInfoMiscFeatures");
      if (subtype === "template") result = game.i18n.localize("PF1.SourceInfoTemplate");
    }
    if (type === "race") {
      result = game.i18n.localize("PF1.SourceInfoRace");
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

  get _skillTargets() {
    let skills = [];
    let subSkills = [];
    for (let [sklKey, skl] of Object.entries(this.data.data.skills)) {
      if (skl == null) continue;
      if (skl.subSkills != null) {
        for (let subSklKey of Object.keys(skl.subSkills)) {
          subSkills.push(`skill.${sklKey}.subSkills.${subSklKey}`);
        }
      } else skills.push(`skill.${sklKey}`);
    }
    return [...skills, ...subSkills];
  }

  /**
   * The VisionPermissionSheet instance for this actor
   *
   * @type {VisionPermissionSheet}
   */
  get visionPermissionSheet() {
    if (!this._visionPermissionSheet) this._visionPermissionSheet = new VisionPermissionSheet(this);
    return this._visionPermissionSheet;
  }

  _dataIsPC(data) {
    if (data.permission != null) {
      const nonGM = game.users.entities.filter((u) => !u.isGM);
      return nonGM.some((u) => {
        if (data.permission["default"] >= CONST.ENTITY_PERMISSIONS["OWNER"]) return true;
        return data.permission[u._id] >= CONST.ENTITY_PERMISSIONS["OWNER"];
      });
    }
    const hasPlayerOwner = this.hasPlayerOwner;
    return hasPlayerOwner;
  }

  _prepareContainerItems(items) {
    let collection = [];

    const getContainerContents = function (item) {
      if (item.type !== "container") return;

      item.items.forEach((i) => {
        collection.push(i);
        getContainerContents(i);
      });
    };

    items.forEach((item) => {
      getContainerContents(item);
    });

    return collection;
  }

  _prepareItemFlags(items) {
    let bFlags = {};
    let dFlags = {};

    for (let i of items) {
      // Process boolean flags
      if (i.isActive) {
        const flags = getProperty(i.data, "data.flags.boolean") || [];
        for (let f of flags) {
          bFlags[f] = bFlags[f] || { sources: [] };
          bFlags[f].sources.push(i);
        }
      }

      // Process dictionary flags
      if (i.data.data.tag) {
        const flags = getProperty(i.data, "data.flags.dictionary") || [];
        for (let f of flags) {
          setProperty(dFlags, `${i.data.data.tag}.${f[0]}`, i.isActive ? f[1] : 0);
        }
      }
    }

    return {
      boolean: bFlags,
      dictionary: dFlags,
    };
  }

  _prepareChanges() {
    this.changeItems = this.items
      .filter((obj) => {
        return (
          (obj.data.data.changes instanceof Array && obj.data.data.changes.length) ||
          (obj.data.data.changeFlags && Object.values(obj.data.data.changeFlags).filter((o) => o === true).length)
        );
      })
      .filter((obj) => obj.isActive);

    let changes = [];
    for (let i of this.changeItems) {
      changes.push(...i.changes);
    }
    addDefaultChanges.call(this, changes);

    const c = new Collection();
    for (let e of changes) {
      c.set(e._id, e);
    }
    this.changes = c;
  }

  applyActiveEffects() {
    super.applyActiveEffects();

    this.containerItems = this._prepareContainerItems(this.items);
    this.itemFlags = this._prepareItemFlags(this.allItems);
    this._prepareChanges();
  }

  prepareData() {
    this.sourceInfo = {};
    this.flags = {};

    // Prepare data
    super.prepareData();

    this._initialized = true;
    this._setSourceDetails(this.sourceInfo);

    this.doQueuedUpdates();
  }

  prepareBaseData() {
    super.prepareBaseData();
    this._resetInherentTotals();
    Hooks.callAll("pf1.prepareBaseActorData", this);

    // Update total level and mythic tier
    const classes = this.data.items.filter((o) => o.type === "class");
    const level = classes
      .filter((o) => o.data.data.classType !== "mythic")
      .reduce((cur, o) => cur + o.data.data.level, 0);
    setProperty(this.data, "data.details.level.value", level);

    const mythicTier = classes
      .filter((o) => o.data.data.classType === "mythic")
      .reduce((cur, o) => cur + o.data.data.level, 0);
    setProperty(this.data, "data.details.mythicTier", mythicTier);

    // Populate conditions
    for (const condition of Object.keys(CONFIG.PF1.conditions)) {
      this.data.data.attributes.conditions[condition] ??= false;
    }

    // The following is not for NPCs
    if (this.data.type === "character") {
      const maxExp = this.getLevelExp(level);
      setProperty(this.data, "data.details.xp.max", maxExp);
    }

    {
      // Handle armor and weapon proficiencies for PCs
      // NPCs are considered proficient with their armor
      if (this.data.type === "character") {
        // Collect proficiencies from items, add them to actor's proficiency totals
        for (const prof of ["armorProf", "weaponProf"]) {
          // Custom proficiency baseline from actor
          const customProficiencies =
            this.data.data.traits[prof]?.custom.split(CONFIG.PF1.re.traitSeparator).filter((item) => item.length > 0) ||
            [];

          // Iterate over all items to create one array of non-custom proficiencies
          const proficiencies = this.data.items.reduce(
            (profs, item) => {
              // Check only items able to grant proficiencies
              if (hasProperty(item.data, `data.${prof}`)) {
                // Get existing sourceInfo for item with this name, create sourceInfo if none is found
                // Remember whether sourceInfo can be modified or has to be pushed at the end
                let sInfo = getSourceInfo(this.sourceInfo, `data.traits.${prof}`).positive.find(
                    (o) => o.name === item.name
                  ),
                  hasInfo = !!sInfo;
                if (!sInfo) sInfo = { name: item.name, value: [] };
                else if (typeof sInfo.value === "string") sInfo.value = sInfo.value.split(", ");

                // Regular proficiencies
                for (const proficiency of item.data.data[prof].value) {
                  // Add localized source info if item's info does not have this proficiency already
                  if (!sInfo.value.includes(proficiency)) sInfo.value.push(CONFIG.PF1[`${prof}iciencies`][proficiency]);
                  // Add raw proficiency key
                  if (!profs.includes(proficiency)) profs.push(proficiency);
                }

                // Collect trimmed but otherwise original proficiency strings, dedupe array for actor's total
                const customProfs =
                  item.data.data[prof].custom
                    ?.split(CONFIG.PF1.re.traitSeparator)
                    .map((i) => i.trim())
                    .filter((el, i, arr) => el.length > 0 && arr.indexOf(el) === i) || [];
                // Add readable custom profs to sources and overall collection
                sInfo.value.push(...customProfs);
                customProficiencies.push(...customProfs);

                if (sInfo.value.length > 0) {
                  // Dedupe if adding to existing sourceInfo
                  if (hasInfo) sInfo.value = [...new Set(sInfo.value)];
                  // Transform arrays into presentable strings
                  sInfo.value = sInfo.value.join(", ");
                  // If sourceInfo was not a reference to existing info, push it now
                  if (!hasInfo) getSourceInfo(this.sourceInfo, `data.traits.${prof}`).positive.push(sInfo);
                }
              }
              return profs;
            },
            [...this.data.data.traits[prof].value] // Default proficiency baseline from actor
          );

          // Save collected proficiencies in actor's data
          setProperty(this.data, `data.traits.${prof}.total`, [...proficiencies]);
          setProperty(this.data, `data.traits.${prof}.customTotal`, customProficiencies.join(";"));
        }
      }
    }

    // Refresh ability scores
    {
      const abs = Object.keys(this.data.data.abilities);
      for (let ab of abs) {
        const value = getProperty(this.data, `data.abilities.${ab}.value`);
        if (value == null) {
          setProperty(this.data, `data.abilities.${ab}.total`, null);
          setProperty(this.data, `data.abilities.${ab}.base`, null);
          setProperty(this.data, `data.abilities.${ab}.baseMod`, 0);
        } else {
          setProperty(
            this.data,
            `data.abilities.${ab}.total`,
            value - getProperty(this.data, `data.abilities.${ab}.drain`)
          );
          setProperty(
            this.data,
            `data.abilities.${ab}.penalty`,
            (getProperty(this.data, `data.abilities.${ab}.penalty`) || 0) +
              (getProperty(this.data, `data.abilities.${ab}.userPenalty`) || 0)
          );
          setProperty(this.data, `data.abilities.${ab}.base`, getProperty(this.data, `data.abilities.${ab}.total`));
        }
      }
      this.refreshAbilityModifiers();
    }

    // Reset BAB
    {
      const useFractionalBaseBonuses = game.settings.get("pf1", "useFractionalBaseBonuses") === true;
      const k = "data.attributes.bab.total";
      if (useFractionalBaseBonuses) {
        setProperty(
          this.data,
          k,
          Math.floor(
            classes.reduce((cur, obj) => {
              const babScale = getProperty(obj, "data.data.bab") || "";
              if (babScale === "high") return cur + obj.data.data.level;
              if (babScale === "med") return cur + obj.data.data.level * 0.75;
              if (babScale === "low") return cur + obj.data.data.level * 0.5;
              return cur;
            }, 0)
          )
        );

        const v = getProperty(this.data, k);
        if (v !== 0) {
          getSourceInfo(this.sourceInfo, k).positive.push({
            name: game.i18n.localize("PF1.Base"),
            value: v,
          });
        }
      } else {
        setProperty(
          this.data,
          k,
          classes.reduce((cur, obj) => {
            const v = RollPF.safeRoll(CONFIG.PF1.classBABFormulas[obj.data.data.bab], { level: obj.data.data.level })
              .total;

            if (v !== 0) {
              getSourceInfo(this.sourceInfo, k).positive.push({
                name: getProperty(obj, "name"),
                value: v,
              });
            }

            return cur + v;
          }, 0)
        );
      }
    }

    // Prepare Character data
    if (this.data.type === "character") this._prepareCharacterData(this.data.data);
    else if (this.data.type === "npc") this._prepareNPCData(this.data.data);

    // Reset HD
    setProperty(this.data, "data.attributes.hd.total", getProperty(this.data, "data.details.level.value"));

    // Apply ACP and Max Dexterity Bonus
    this._applyArmorPenalties();

    // Reset class skills
    for (let [k, s] of Object.entries(getProperty(this.data, "data.skills"))) {
      if (!s) continue;
      const isClassSkill = classes.reduce((cur, o) => {
        if ((getProperty(o.data, "data.classSkills") || {})[k] === true) return true;
        return cur;
      }, false);
      setProperty(this.data, `data.skills.${k}.cs`, isClassSkill);
      for (let k2 of Object.keys(getProperty(s, "subSkills") || {})) {
        setProperty(this.data, `data.skills.${k}.subSkills.${k2}.cs`, isClassSkill);
      }
    }

    this.updateSpellbookInfo();

    // Add base initiative (for NPC Lite sheets)
    {
      setProperty(this.data, "data.attributes.init.total", getProperty(this.data, "data.attributes.init.value"));
    }
  }

  /**
   * Checks if there's any matching proficiency
   *
   * @param {ItemPF } item - The item to check for.
   * @param {string} proficiencyName - The proficiency name to look for. e.g. 'lightShield' or 'mediumArmor'.
   * @returns {boolean} Whether the actor is proficient with that item.
   */
  hasArmorProficiency(item, proficiencyName) {
    // Assume NPCs to be proficient with their armor
    if (this.data.type === "npc") return true;

    // Check for item type
    if (item.type !== "equipment" || !["armor", "shield"].includes(item.data.data.equipmentType)) return true;

    // Custom proficiencies
    const customProficiencies =
      this.data.data.traits.armorProf?.customTotal
        ?.split(CONFIG.PF1.re.traitSeparator)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0) || [];

    const name = item.name.toLowerCase(),
      tag = item.data.tag;
    return (
      this.data.data.traits.armorProf.total.includes(proficiencyName) ||
      customProficiencies.find((prof) => prof.includes(name) || prof.includes(tag)) != undefined
    );
  }

  updateSpellbookInfo() {
    const rollData = this.getRollData();

    // Set spellbook info
    for (let [spellbookKey, spellbook] of Object.entries(getProperty(this.data, "data.attributes.spells.spellbooks"))) {
      const spellbookAbilityKey = spellbook.ability;
      let spellbookAbilityScore = getProperty(this.data, `data.abilities.${spellbookAbilityKey}.total`) ?? 10;

      // Add spell slots based on ability bonus slot formula
      {
        const formula = getProperty(spellbook, "spellSlotAbilityBonusFormula") || "0";
        spellbookAbilityScore += RollPF.safeRoll(formula, rollData).total;
      }

      const spellbookAbilityMod = Math.floor((spellbookAbilityScore - 10) / 2);

      // Set CL
      {
        const key = `data.attributes.spells.spellbooks.${spellbookKey}.cl.total`;
        const formula = getProperty(spellbook, "cl.formula") || "0";
        let total = 0;

        // Add NPC base
        if (this.data.type === "npc") {
          const value = getProperty(spellbook, "cl.base") || 0;
          total += value;
          getSourceInfo(this.sourceInfo, key).positive.push({ name: game.i18n.localize("PF1.Base"), value: value });
        }
        // Add HD
        if (spellbook.class === "_hd") {
          const value = getProperty(this.data, "data.attributes.hd.total");
          total += value;
          getSourceInfo(this.sourceInfo, key).positive.push({ name: game.i18n.localize("PF1.HitDie"), value: value });
        }
        // Add class levels
        else if (spellbook.class && rollData.classes[spellbook.class]) {
          const value = rollData.classes[spellbook.class].level;
          total += value;

          setSourceInfoByName(this.sourceInfo, key, rollData.classes[spellbook.class].name, value);
        }

        // set auto spell level calculation offset
        if (spellbook.autoSpellLevelCalculation) {
          const autoKey = `data.attributes.spells.spellbooks.${spellbookKey}.cl.autoSpellLevelTotal`;
          const autoFormula = getProperty(spellbook, "cl.autoSpellLevelCalculationFormula") || "0";
          const autoBonus = RollPF.safeTotal(autoFormula, rollData);
          const autoTotal = Math.max(1, Math.min(20, total + autoBonus));
          setProperty(this.data, autoKey, autoTotal);

          total += autoBonus;
          if (autoBonus !== 0) {
            const sign = autoBonus < 0 ? "negative" : "positive";
            setSourceInfoByName(
              this.sourceInfo,
              key,
              game.i18n.localize("PF1.AutoSpellClassLevelOffset.Formula"),
              autoBonus
            );
          }
        }

        // Add from bonus formula
        const clBonus = RollPF.safeRoll(formula, rollData).total;
        total += clBonus;
        if (clBonus > 0) {
          setSourceInfoByName(this.sourceInfo, key, game.i18n.localize("PF1.CasterLevelBonusFormula"), clBonus);
        } else if (clBonus < 0) {
          setSourceInfoByName(this.sourceInfo, key, game.i18n.localize("PF1.CasterLevelBonusFormula"), clBonus, false);
        }

        if (getProperty(rollData, "attributes.woundThresholds.penalty") != null) {
          // Subtract Wound Thresholds penalty. Can't reduce below 1.
          if (rollData.attributes.woundThresholds.penalty > 0 && total > 1) {
            total = Math.max(1, total - rollData.attributes.woundThresholds.penalty);
            setSourceInfoByName(
              this.sourceInfo,
              key,
              game.i18n.localize(CONFIG.PF1.woundThresholdConditions[rollData.attributes.woundThresholds.level]),
              -rollData.attributes.woundThresholds.penalty
            );
          }
        }

        // Subtract energy drain
        if (rollData.attributes.energyDrain) {
          total = Math.max(0, total - rollData.attributes.energyDrain);
          setSourceInfoByName(
            this.sourceInfo,
            key,
            game.i18n.localize("PF1.CondTypeEnergyDrain"),
            -Math.abs(rollData.attributes.energyDrain),
            false
          );
        }

        setProperty(this.data, key, total);
      }

      const getAbilityBonus = (a) =>
        a !== 0 && typeof spellbookAbilityMod === "number" ? ActorPF.getSpellSlotIncrease(spellbookAbilityMod, a) : 0;
      // Spell slots
      {
        const bookPath = `data.attributes.spells.spellbooks.${spellbookKey}`;

        const useAuto = getProperty(this.data, `${bookPath}.autoSpellLevelCalculation`);
        if (useAuto) {
          let spellPrepMode = spellbook.spellPreparationMode;
          if (!spellPrepMode || spellPrepMode === "null") {
            spellPrepMode = "spontaneous";
            setProperty(this.data, `${bookPath}.spellPreparationMode`, spellPrepMode);
          }

          // turn off spell points
          setProperty(this.data, `${bookPath}.spellPoints.useSystem`, false);

          // set base "spontaneous" based on spell prep mode
          if (spellPrepMode === "hybrid" || spellPrepMode === "prestige" || spellPrepMode === "spontaneous") {
            spellbook.spontaneous = true;
            setProperty(this.data, `${bookPath}.spontaneous`, true);
          } else {
            spellbook.spontaneous = false;
            setProperty(this.data, `${bookPath}.spontaneous`, false);
          }

          let casterType = getProperty(this.data, `${bookPath}.casterType`);
          if (!casterType || casterType === "null" || (spellPrepMode === "hybrid" && casterType !== "high")) {
            casterType = "high";
            setProperty(this.data, `${bookPath}.casterType`, casterType);
          }
          if (spellPrepMode === "prestige" && casterType !== "low") {
            casterType = "low";
            setProperty(this.data, `${bookPath}.casterType`, casterType);
          }

          const castsForLevels =
            CONFIG.PF1.casterProgression[spellbook.spontaneous ? "castsPerDay" : "spellsPreparedPerDay"][spellPrepMode][
              casterType
            ];
          const classLevel = Math.max(Math.min(getProperty(this.data, `${bookPath}.cl.autoSpellLevelTotal`), 20), 1);
          rollData.ablMod = spellbookAbilityMod;

          const allLevelModFormula =
            getProperty(
              this.data,
              `${bookPath}.${spellbook.spontaneous ? "castPerDayAllOffsetFormula" : "preparedAllOffsetFormula"}`
            ) || "0";
          const allLevelMod = RollPF.safeTotal(allLevelModFormula, rollData);

          for (let a = 0; a < 10; a++) {
            // 0 is special because it doesn't get bonus preps and can cast them indefinitely so can't use the "cast per day" value
            const spellsForLevel =
              a === 0 && spellbook.spontaneous
                ? CONFIG.PF1.casterProgression.spellsPreparedPerDay[spellPrepMode][casterType][classLevel - 1][a]
                : castsForLevels[classLevel - 1][a];
            setProperty(this.data, `${bookPath}.spells.spell${a}.base`, spellsForLevel);

            const offsetFormula =
              getProperty(
                this.data,
                `${bookPath}.spells.spell${a}.${[
                  spellbook.spontaneous ? "castPerDayOffsetFormula" : "preparedOffsetFormula",
                ]}`
              ) || "0";

            let max =
              typeof spellsForLevel === "number" || (a === 0 && spellbook.hasCantrips)
                ? spellsForLevel + getAbilityBonus(a) + allLevelMod + RollPF.safeTotal(offsetFormula, rollData)
                : null;

            setProperty(this.data, `${bookPath}.spells.spell${a}.max`, max);
            let oldval = getProperty(this.data, `${bookPath}.spells.spell${a}.value`);
            if (!Number.isFinite(oldval)) setProperty(this.data, `${bookPath}.spells.spell${a}.value`, max);
          }
        } else {
          for (let a = 0; a < 10; a++) {
            let base = parseInt(getProperty(this.data, `${bookPath}.spells.spell${a}.base`));
            if (Number.isNaN(base)) {
              setProperty(this.data, `${bookPath}.spells.spell${a}.base`, null);
              setProperty(this.data, `${bookPath}.spells.spell${a}.max`, 0);
            } else if (getProperty(this.data, `${bookPath}.autoSpellLevels`)) {
              base += getAbilityBonus(a);
              setProperty(this.data, `${bookPath}.spells.spell${a}.max`, base);
            } else {
              setProperty(this.data, `${bookPath}.spells.spell${a}.max`, base);
            }

            let max = getProperty(this.data, `${bookPath}.spells.spell${a}.max`);
            let oldval = getProperty(this.data, `${bookPath}.spells.spell${a}.value`);
            if (!Number.isFinite(oldval)) setProperty(this.data, `${bookPath}.spells.spell${a}.value`, max);
          }
        }
      }

      // Set spontaneous spell slots to something sane
      {
        for (let a = 0; a < 10; a++) {
          const k = `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.value`;
          const current = getProperty(this.data, k);
          setProperty(this.data, k, current || 0);
        }
      }

      // Update spellbook slots
      {
        const slots = {};
        for (let sbKey of Object.keys(getProperty(this.data, "data.attributes.spells.spellbooks"))) {
          for (let a = 0; a < 10; a++) {
            setProperty(
              slots,
              `${sbKey}.${a}.value`,
              getProperty(this.data, `data.attributes.spells.spellbooks.${sbKey}.spells.spell${a}.max`) || 0
            );
            setProperty(
              slots,
              `${sbKey}.${a}.domainSlots`,
              getProperty(this.data, `data.attributes.spells.spellbooks.${sbKey}.domainSlotValue`) || 0
            );
          }
        }

        const spells = this.items.filter((o) => o.type === "spell" && o.data.data.spellbook === spellbookKey);
        for (let i of spells) {
          const sb = i.spellbook;
          if (!sb || sb.spontaneous) {
            continue;
          }

          const sbKey = i.data.data.spellbook;
          const isDomain = getProperty(i.data, "data.domain") === true;
          const a = i.data.data.level;
          const slotCost = i.data.data.slotCost ?? 1;
          let dSlots = getProperty(slots, `${sbKey}.${a}.domainSlots`); // `
          let uses = getProperty(slots, `${sbKey}.${a}.value`);
          if (Number.isFinite(i.maxCharges)) {
            let subtract = { domain: 0, uses: 0 };
            if (isDomain) {
              subtract.domain = Math.min(i.maxCharges, dSlots);
              subtract.uses = (i.maxCharges - subtract.domain) * slotCost;
            } else {
              subtract.uses = i.maxCharges * slotCost;
            }
            dSlots -= subtract.domain;
            uses -= subtract.uses;
          }
          setProperty(slots, `${sbKey}.${a}.value`, uses);
          setProperty(slots, `${sbKey}.${a}.domainSlots`, dSlots);
          setProperty(this.data, `data.attributes.spells.spellbooks.${sbKey}.spells.spell${a}.value`, uses);
        }

        // Spells available hint text if auto spell levels is enabled
        {
          const bookPath = `data.attributes.spells.spellbooks.${spellbookKey}`;
          const useAuto = getProperty(this.data, `${bookPath}.autoSpellLevelCalculation`);
          if (useAuto) {
            const spellPrepMode = spellbook.spellPreparationMode;
            let casterType = getProperty(this.data, `${bookPath}.casterType`) || "high";
            const classLevel = Math.max(Math.min(getProperty(this.data, `${bookPath}.cl.autoSpellLevelTotal`), 20), 1);

            let spellbookAbilityScore = getProperty(this.data, `data.abilities.${spellbookAbilityKey}.total`);

            const allLevelModFormula =
              getProperty(
                this.data,
                `${bookPath}.${spellbook.spontaneous ? "castPerDayAllOffsetFormula" : "preparedAllOffsetFormula"}`
              ) || "0";
            const allLevelMod = RollPF.safeTotal(allLevelModFormula, rollData);

            for (let a = 0; a < 10; a++) {
              if (!isNaN(spellbookAbilityScore) && spellbookAbilityScore - 10 < a) {
                const message = game.i18n.localize("PF1.SpellScoreTooLow");
                setProperty(this.data, `${bookPath}.spells.spell${a}.spellMessage`, message);
                continue;
              }

              let remaining;
              if (spellPrepMode === "prepared") {
                // for prepared casters, just use the 'value' calculated above
                remaining = getProperty(this.data, `${bookPath}.spells.spell${a}.value`);
              } else {
                // spontaneous or hybrid
                // if not prepared then base off of casts per day
                let available =
                  CONFIG.PF1.casterProgression.spellsPreparedPerDay[spellPrepMode][casterType]?.[classLevel - 1][a];
                available += allLevelMod;

                const formula = getProperty(this.data, `${bookPath}.spells.spell${a}.preparedOffsetFormula`) || "0";
                available += RollPF.safeTotal(formula, rollData);

                const used = spells.reduce((acc, i) => {
                  const { level, spellbook, preparation } = i.data.data;
                  return level === a && spellbook === spellbookKey && preparation.spontaneousPrepared ? ++acc : acc;
                }, 0);

                remaining = available - used;
              }

              if (!remaining) {
                setProperty(this.data, `${bookPath}.spells.spell${a}.spellMessage`, "");
                continue;
              }

              let remainingMessage = "";
              if (remaining < 0) {
                remainingMessage = game.i18n.format("PF1.TooManySpells", { quantity: Math.abs(remaining) });
              } else if (remaining > 0) {
                if (spellPrepMode === "spontaneous") {
                  remainingMessage =
                    remaining === 1
                      ? game.i18n.localize("PF1.LearnMoreSpell")
                      : game.i18n.format("PF1.LearnMoreSpells", { quantity: remaining });
                } else {
                  // hybrid or prepared
                  remainingMessage =
                    remaining === 1
                      ? game.i18n.localize("PF1.PrepareMoreSpell")
                      : game.i18n.format("PF1.PrepareMoreSpells", { quantity: remaining });
                }
              }

              if (remainingMessage) {
                setProperty(this.data, `${bookPath}.spells.spell${a}.spellMessage`, remainingMessage);
              }
            }
          }
        }
      }

      // Spell points
      {
        const formula =
          getProperty(this.data, `data.attributes.spells.spellbooks.${spellbookKey}.spellPoints.maxFormula`) || "0";
        rollData.cl = getProperty(this.data, `data.attributes.spells.spellbooks.${spellbookKey}.cl.total`);
        rollData.ablMod = spellbookAbilityMod;
        const spellClass = getProperty(this.data, `data.attributes.spells.spellbooks.${spellbookKey}.class`) ?? "";
        rollData.classLevel =
          spellClass === "_hd"
            ? rollData.attributes.hd.total
            : spellClass?.length > 0
            ? getProperty(rollData, `classes.${spellClass}.level`) || 0 // `
            : 0;
        const roll = RollPF.safeRoll(formula, rollData);
        setProperty(this.data, `data.attributes.spells.spellbooks.${spellbookKey}.spellPoints.max`, roll.total);
      }

      // Set spellbook range
      const cl = spellbook.cl.total;
      spellbook.range = {
        close: convertDistance(25 + 5 * Math.floor(cl / 2))[0],
        medium: convertDistance(100 + 10 * cl)[0],
        long: convertDistance(400 + 40 * cl)[0],
      };
    }
  }

  /**
   * Called just before the first change is applied, and after every change is applied.
   * Sets additional variables (such as spellbook range)
   */
  refreshDerivedData() {
    // Reset maximum dexterity bonus
    setProperty(this.data, "data.attributes.maxDexBonus", null);

    {
      // Compute encumbrance
      const encPen = this._computeEncumbrance();

      // Apply armor penalties
      const gearPen = this._applyArmorPenalties();

      // Set armor check penalty
      setProperty(this.data, "data.attributes.acp.encumbrance", encPen.acp);
      setProperty(this.data, "data.attributes.acp.gear", gearPen.acp);
      setProperty(this.data, "data.attributes.acp.total", Math.max(encPen.acp, gearPen.acp));

      // Set maximum dexterity bonus
      if (encPen.maxDexBonus != null || gearPen.maxDexBonus != null) {
        setProperty(
          this.data,
          "data.attributes.maxDexBonus",
          Math.min(encPen.maxDexBonus ?? Number.POSITIVE_INFINITY, gearPen.maxDexBonus ?? Number.POSITIVE_INFINITY)
        );
      }
    }
  }

  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareDerivedData() {
    super.prepareDerivedData();

    // Refresh roll data
    // Some changes act wonky without this
    // Example: `@skills.hea.rank >= 10 ? 6 : 3` doesn't work well without this
    this.getRollData({ refresh: true });

    this.items.forEach((item) => {
      item.prepareDerivedItemData();
      this.updateItemResources(item.data);
    });

    applyChanges.call(this);

    // Prepare specific derived data
    this.prepareSpecificDerivedData();

    // Setup links
    this.prepareItemLinks();

    // Update item resources
    this.items.forEach((item) => {
      item.prepareDerivedItemData();
      this.updateItemResources(item.data);

      // Update tokens for resources
      const tokens = this.isToken ? [this.token] : this.getActiveTokens();
      tokens.forEach((t) => {
        try {
          t.drawBars();
        } catch (err) {
          // Drop the harmless error
        }
      });
    });
  }

  prepareSpecificDerivedData() {
    Hooks.callAll("pf1.prepareDerivedActorData", this);

    // Set base ability modifier
    for (const ab of Object.keys(this.data.data.abilities)) {
      setProperty(
        this.data,
        `data.abilities.${ab}.baseMod`,
        Math.floor((getProperty(this.data, `data.abilities.${ab}.base`) - 10) / 2)
      );
    }

    const actorData = this.data;
    const data = actorData.data;

    // Round health
    const healthConfig = game.settings.get("pf1", "healthConfig");
    const round = { up: Math.ceil, nearest: Math.round, down: Math.floor }[healthConfig.rounding];
    for (const k of ["data.attributes.hp.max", "data.attributes.vigor.max"]) {
      setProperty(this.data, `${k}`, round(getProperty(this.data, `${k}`)));
    }

    // Refresh HP
    this._applyPreviousAttributes();

    // Update wound threshold
    this.updateWoundThreshold();

    // Apply wound thresholds to skills
    const woundPenalty = this.data.data.attributes.woundThresholds?.penalty ?? 0;
    if (woundPenalty) {
      for (let k of this.allSkills) {
        const prevValue = getProperty(this.data, `data.skills.${k}.mod`);
        setProperty(this.data, `data.skills.${k}.mod`, prevValue - woundPenalty);
      }
    }

    // Reset CR
    if (this.data.type === "npc") {
      setProperty(this.data, "data.details.cr.total", this.getCR(this.data.data));

      // Reset experience value
      try {
        const crTotal = getProperty(this.data, "data.details.cr.total") || 0;
        setProperty(this.data, "data.details.xp.value", this.getCRExp(crTotal));
      } catch (e) {
        setProperty(this.data, "data.details.xp.value", this.getCRExp(1));
      }
    }

    // Shared attack bonuses
    {
      // Size
      const sizeMod = CONFIG.PF1.sizeMods[this.data.data.traits.size];
      // Total
      const totalAtk =
        (getProperty(this.data, "data.attributes.bab.total") ?? 0) -
        (getProperty(this.data, "data.attributes.acp.attackPenalty") ?? 0) -
        (getProperty(this.data, "data.attributes.energyDrain") ?? 0) +
        sizeMod;
      setProperty(this.data, "data.attributes.attack.shared", totalAtk);
    }

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

    // Mark background skills
    for (let skillId of Object.keys(data.skills)) {
      if (CONFIG.PF1.backgroundSkills.includes(skillId)) {
        let skill = data.skills[skillId];
        skill.background = true;
        for (let subSkillId of Object.keys(skill.subSkills ?? {})) skill.subSkills[subSkillId].background = true;
      }
    }

    // Prepare modifier containers
    data.attributes.mods = data.attributes.mods || {};
    data.attributes.mods.skills = data.attributes.mods.skills || {};

    // Set labels
    this.labels = {};
    this.labels.race =
      this.race == null ? game.i18n.localize("PF1.Race") : game.i18n.localize("PF1.RaceTitle").format(this.race.name);
    this.labels.alignment = CONFIG.PF1.alignments[this.data.data.details.alignment];

    // Set speed labels
    this.labels.speed = {};
    for (const [key, obj] of Object.entries(getProperty(this.data, "data.attributes.speed") || {})) {
      const dist = convertDistance(obj.total);
      this.labels.speed[key] = `${dist[0]} ${CONFIG.PF1.measureUnitsShort[dist[1]]}`;
    }

    // Combine AC types
    for (const k of ["temp.ac.armor", "temp.ac.shield", "temp.ac.natural"]) {
      const v = getProperty(this.data, k);
      if (v) {
        for (const k2 of ["normal", "flatFooted"]) {
          setProperty(
            this.data,
            `data.attributes.ac.${k2}.total`,
            getProperty(this.data, `data.attributes.ac.${k2}.total`) + v
          );
        }
      }
    }

    // Add Dexterity to AC
    {
      // get configured ability scores
      const acAbl = this.data.data.attributes.ac.normal.ability ?? "dex";
      const acTouchAbl = this.data.data.attributes.ac.touch.ability ?? "dex";
      const cmdDexAbl = this.data.data.attributes.cmd.dexAbility ?? "dex";
      let acAblMod = getProperty(this.data, `data.abilities.${acAbl}.mod`);
      let acTouchAblMod = getProperty(this.data, `data.abilities.${acTouchAbl}.mod`);
      let cmdDexAblMod = getProperty(this.data, `data.abilities.${cmdDexAbl}.mod`);

      if (this.flags["loseDexToAC"]) {
        acAblMod = Math.min(acAblMod, 0);
        acTouchAblMod = Math.min(acTouchAblMod, 0);
      }
      const maxDex = getProperty(this.data, "data.attributes.maxDexBonus") ?? null;
      const ac = {
        normal: maxDex !== null ? Math.min(maxDex, acAblMod) : acAblMod,
        touch: maxDex !== null ? Math.min(maxDex, acTouchAblMod) : acTouchAblMod,
        flatFooted: Math.min(0, acAblMod),
      };
      const acAblKey = {
        normal: acAbl,
        touch: acTouchAbl,
        flatFooted: acAbl,
      };
      const cmd = {
        total: cmdDexAblMod,
        flatFootedTotal: Math.min(0, cmdDexAblMod),
      };
      for (const [k, v] of Object.entries(ac)) {
        setProperty(
          this.data,
          `data.attributes.ac.${k}.total`,
          getProperty(this.data, `data.attributes.ac.${k}.total`) + v
        );
        getSourceInfo(this.sourceInfo, `data.attributes.ac.${k}.total`).positive.push({
          value: v,
          name: CONFIG.PF1.abilities[acAblKey[k]],
        });
      }
      for (const [k, v] of Object.entries(cmd)) {
        setProperty(this.data, `data.attributes.cmd.${k}`, getProperty(this.data, `data.attributes.cmd.${k}`) + v);
        getSourceInfo(this.sourceInfo, `data.attributes.cmd.${k}`).positive.push({
          value: v,
          name: CONFIG.PF1.abilities[cmdDexAbl],
        });
      }
    }

    // Reduce final speed under certain circumstances
    {
      const armorItems = this.items.filter((o) => o.data.type === "equipment");
      let reducedSpeed = false;
      let sInfo = { name: "", value: game.i18n.localize("PF1.ReducedMovementSpeed") };
      if (this.data.data.attributes.encumbrance.level >= 1 && !this.flags["noEncumbrance"]) {
        reducedSpeed = true;
        sInfo.name = game.i18n.localize("PF1.Encumbrance");
      }
      if (
        armorItems.filter((o) => getProperty(o.data.data, "equipmentSubtype") === "mediumArmor" && o.data.data.equipped)
          .length &&
        !this.flags["mediumArmorFullSpeed"]
      ) {
        reducedSpeed = true;
        sInfo.name = game.i18n.localize("PF1.EquipTypeMedium");
      }
      if (
        armorItems.filter((o) => getProperty(o.data.data, "equipmentSubtype") === "heavyArmor" && o.data.data.equipped)
          .length &&
        !this.flags["heavyArmorFullSpeed"]
      ) {
        reducedSpeed = true;
        sInfo.name = game.i18n.localize("PF1.EquipTypeHeavy");
      }
      if (reducedSpeed) {
        for (const speedKey of Object.keys(this.data.data.attributes.speed)) {
          const key = `data.attributes.speed.${speedKey}.total`;
          let value = getProperty(this.data, key);
          setProperty(this.data, key, this.constructor.getReducedMovementSpeed(value));
          if (value > 0) {
            getSourceInfo(this.sourceInfo, key).negative.push(sInfo);
          }
        }
      }
    }

    // Add encumbrance source details
    switch (getProperty(this.data, "data.attributes.encumbrance.level")) {
      case 1:
        getSourceInfo(this.sourceInfo, "data.attributes.acp.total").negative.push({
          name: game.i18n.localize("PF1.Encumbrance"),
          value: 3,
        });
        getSourceInfo(this.sourceInfo, "data.attributes.maxDexBonus").negative.push({
          name: game.i18n.localize("PF1.Encumbrance"),
          value: 3,
        });
        break;
      case 2:
        getSourceInfo(this.sourceInfo, "data.attributes.acp.total").negative.push({
          name: game.i18n.localize("PF1.Encumbrance"),
          value: 6,
        });
        getSourceInfo(this.sourceInfo, "data.attributes.maxDexBonus").negative.push({
          name: game.i18n.localize("PF1.Encumbrance"),
          value: 1,
        });
        break;
    }

    this.updateSpellbookInfo();

    this.refreshDerivedData();
  }

  /**
   * Computes armor penalties for this actor.
   *
   * @returns {MobilityPenaltyResult} The resulting penalties from armor.
   */
  _applyArmorPenalties() {
    // Item type to proficiency maps
    const proficiencyMaps = {
      armor: {
        lightArmor: "lgt",
        mediumArmor: "med",
        heavyArmor: "hvy",
      },
      shield: {
        other: "shl", // buckler
        lightShield: "shl",
        heavyShield: "shl",
        towerShield: "twr",
      },
    };

    let attackACPPenalty = 0; // ACP to attack penalty from lacking proficiency. Stacks infinitely.
    const acp = { armor: 0, shield: 0 };
    const mdex = { armor: null, shield: null };

    this.data.items
      .filter((obj) => {
        return obj.type === "equipment" && obj.data.data.equipped;
      })
      .forEach((obj) => {
        const eqType = obj.data.data.equipmentType;
        const isShieldOrArmor = ["armor", "shield"].includes(eqType);
        let itemACP = Math.abs(obj.data.data.armor.acp);
        if (obj.data.data.masterwork === true && isShieldOrArmor) itemACP = Math.max(0, itemACP - 1);

        if (isShieldOrArmor)
          itemACP = Math.max(0, itemACP + (getProperty(this.data, `data.attributes.acp.${eqType}Bonus`) ?? 0));

        if (obj.data.data.broken) {
          itemACP *= 2;
        }

        if (itemACP) {
          const sInfo = getSourceInfo(this.sourceInfo, "data.attributes.acp.total").negative.find(
            (o) => o.name === obj.name
          );
          if (sInfo) sInfo.value = itemACP;
          else {
            getSourceInfo(this.sourceInfo, "data.attributes.acp.total").negative.push({
              name: obj.name,
              value: itemACP,
            });
          }
        }

        if (isShieldOrArmor) {
          if (itemACP > acp[eqType]) acp[eqType] = itemACP;
          if (!this.hasArmorProficiency(obj, proficiencyMaps[eqType][obj.data.data.equipmentSubtype]))
            attackACPPenalty += itemACP;
        }

        if (obj.data.data.armor.dex !== null && isShieldOrArmor) {
          const mDex = Number.parseInt(obj.data.data.armor.dex);
          if (Number.isInteger(mDex)) {
            const itemMDex = mDex + (getProperty(this.data, `data.attributes.mDex.${eqType}Bonus`) ?? 0);
            mdex[eqType] = Math.min(itemMDex, mdex[eqType] ?? Number.POSITIVE_INFINITY);

            const sInfo = getSourceInfo(this.sourceInfo, "data.attributes.maxDexBonus").negative.find(
              (o) => o.name === obj.name
            );
            if (sInfo) sInfo.value = itemMDex;
            else {
              getSourceInfo(this.sourceInfo, "data.attributes.maxDexBonus").negative.push({
                name: obj.name,
                value: itemMDex,
              });
            }
          }
        }
      });

    // Return result
    const totalACP = acp.armor + acp.shield;
    let result = {
      maxDexBonus: null,
      acp: totalACP,
    };
    setProperty(this.data, "data.attributes.acp.gear", totalACP);
    if (mdex.armor !== null || mdex.shield !== null)
      result.maxDexBonus = Math.min(mdex.armor ?? Number.POSITIVE_INFINITY, mdex.shield ?? Number.POSITIVE_INFINITY);

    // Set armor penalty to attack rolls
    setProperty(this.data, "data.attributes.acp.attackPenalty", attackACPPenalty);

    return result;
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

  _setSourceDetails(extraData) {
    const actorData = this.data;
    let sourceDetails = {};
    // Get empty source arrays
    for (let b of Object.keys(CONFIG.PF1.buffTargets)) {
      let buffTargets = getChangeFlat.call(this, b, null);
      if (!(buffTargets instanceof Array)) buffTargets = [buffTargets];
      for (let bt of buffTargets) {
        if (!sourceDetails[bt]) sourceDetails[bt] = [];
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
        sourceDetails[`data.abilities.${a}.total`].push({
          name: game.i18n.localize("PF1.AbilityDamage"),
          value: `-${Math.floor(Math.abs(abl.damage) / 2)} (Mod only)`,
        });
      }
      if (abl.drain != null && abl.drain !== 0) {
        sourceDetails[`data.abilities.${a}.total`].push({
          name: game.i18n.localize("PF1.AbilityDrain"),
          value: -Math.abs(abl.drain),
        });
      }
    }

    // Add wound threshold data
    {
      const hpconf = game.settings.get("pf1", "healthConfig").variants;
      const wtUsage = this.data.type === "npc" ? hpconf.npc.useWoundThresholds : hpconf.pc.useWoundThresholds;
      if (wtUsage > 0) {
        const wtData = this.getWoundThresholdData(actorData);

        if (wtData.level > 0) {
          const changeFlatKeys = ["cmb", "cmd", "init", "allSavingThrows", "ac", "skills", "abilityChecks"];
          for (let fk of changeFlatKeys) {
            let flats = getChangeFlat.call(this, fk, "penalty", actorData.data);
            if (!(flats instanceof Array)) flats = [flats];
            for (let k of flats) {
              if (!k) continue;
              sourceDetails[k].push({
                name: game.i18n.localize(CONFIG.PF1.woundThresholdConditions[wtData.level]),
                value: -wtData.penalty,
              });
            }
          }
        }
      }
    }

    // Add extra data
    const rollData = this.getRollData();
    for (let [changeTarget, changeGrp] of Object.entries(extraData)) {
      for (let grp of Object.values(changeGrp)) {
        if (grp.length > 0) {
          sourceDetails[changeTarget] = sourceDetails[changeTarget] || [];
          for (let src of grp) {
            if (!src.operator) src.operator = "add";
            let srcInfo = this.constructor._translateSourceInfo(src.type, src.subtype, src.name);
            let srcValue =
              src.value != null
                ? src.value
                : RollPF.safeRoll(src.formula || "0", rollData, [changeTarget, src, this], {
                    suppressError: !this.testUserPermission(game.user, "OWNER"),
                  }).total;
            if (src.operator === "set") srcValue = game.i18n.localize("PF1.SetTo").format(srcValue);
            if (!(src.operator === "add" && srcValue === 0)) {
              sourceDetails[changeTarget].push({
                name: srcInfo,
                value: srcValue,
              });
            }
          }
        }
      }
    }

    this.sourceDetails = sourceDetails;
  }

  _getInherentTotalsKeys() {
    // Determine base keys
    const keys = {
      "data.attributes.ac.normal.total": 10,
      "data.attributes.ac.touch.total": 10,
      "data.attributes.ac.flatFooted.total": 10,
      "data.attributes.cmd.total": 10,
      "data.attributes.cmd.flatFootedTotal": 10,
      "data.attributes.acp.armorBonus": 0,
      "data.attributes.acp.shieldBonus": 0,
      "data.attributes.maxDexBonus": null,
      "temp.ac.armor": 0,
      "temp.ac.shield": 0,
      "temp.ac.natural": 0,
      "data.attributes.sr.total": 0,
      "data.attributes.init.bonus": 0,
      "data.attributes.init.total": 0,
      "data.attributes.cmb.total": 0,
      "data.attributes.hp.max": getProperty(this.data, "data.attributes.hp.base") ?? 0,
      "data.attributes.vigor.max": getProperty(this.data, "data.attributes.vigor.base") ?? 0,
      "data.attributes.wounds.max": getProperty(this.data, "data.attributes.wounds.base") ?? 0,
      "data.attributes.attack.general": 0,
      "data.attributes.attack.melee": 0,
      "data.attributes.attack.ranged": 0,
      "data.attributes.attack.critConfirm": 0,
      "data.attributes.mDex": { armorBonus: 0, shieldBonus: 0 },
      "data.attributes.damage.general": 0,
      "data.attributes.damage.weapon": 0,
      "data.attributes.damage.spell": 0,
      "data.attributes.damage.shared": 0,
      "data.attributes.woundThresholds.level": 0,
      "data.attributes.woundThresholds.penaltyBase": 0,
      "data.attributes.woundThresholds.penalty": 0,
    };

    // Determine skill keys
    try {
      const skillKeys = getChangeFlat.call(this, "skills", "skills");
      for (let k of skillKeys) {
        keys[k] = 0;
      }
    } catch (err) {
      console.warn("Could not determine skills for an unknown actor in the creation process", this);
    }

    return keys;
  }

  _resetInherentTotals() {
    const keys = this._getInherentTotalsKeys();

    // Reset totals
    for (const [k, v] of Object.entries(keys)) {
      setProperty(this.data, k, v);
    }
  }

  async refresh() {
    if (this.isOwner) {
      return this.update({});
    }
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData() {
    if (!hasProperty(this.data, "data.details.level.value")) return;

    // Experience bar
    let prior = this.getLevelExp(this.data.data.details.level.value - 1 || 0),
      max = this.getLevelExp(this.data.data.details.level.value || 1);

    this.data.data.details.xp.pct =
      ((Math.max(prior, Math.min(max, this.data.data.details.xp.value)) - prior) / (max - prior)) * 100 || 0;
  }

  /* -------------------------------------------- */

  /**
   * Prepare NPC type specific data
   */
  _prepareNPCData() {}

  /**
   * Return reduced movement speed.
   *
   * @param {number} value - The non-reduced movement speed.
   * @returns {number} The reduced movement speed.
   */
  static getReducedMovementSpeed(value) {
    const incr = 5;

    if (value <= 0) return value;
    if (value < 2 * incr) return incr;
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
   *
   * @param {number} mod - The associated ability modifier.
   * @param {number} level - Spell level.
   * @returns {number} Amount of spell levels to increase.
   */
  static getSpellSlotIncrease(mod, level) {
    if (level === 0) return 0;
    if (mod <= 0) return 0;
    return Math.max(0, Math.ceil((mod + 1 - level) / 4));
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
      const levels = CONFIG.PF1.CHARACTER_EXP_LEVELS[expTrack];
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

  /* -------------------------------------------- */

  /**
   * Return the amount of experience granted by killing a creature of a certain CR.
   *
   * @param cr {null | number}     The creature's challenge rating
   * @returns {number}       The amount of experience granted per kill
   */
  getCRExp(cr) {
    if (cr < 1.0) return Math.max(400 * cr, 0);
    return CONFIG.PF1.CR_EXP_LEVELS[cr];
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
  /* -------------------------------------------- */

  async preUpdate(data) {
    data = flattenObject(data);

    // Apply settings
    // Set used spellbook flags
    {
      const re = new RegExp(/^spellbook-([a-zA-Z]+)-inuse$/);
      const sbData = Object.entries(data)
        .filter((o) => {
          const result = o[0].match(re);
          if (result) delete data[o[0]];
          return result;
        })
        .map((o) => {
          return { spellbook: o[0].replace(re, "$1"), inUse: o[1] };
        });

      let usedSpellbooks = [];
      if (data["data.attributes.spells.usedSpellbooks"])
        usedSpellbooks = duplicate(data["data.attributes.spells.usedSpellbooks"]);
      else if (hasProperty(this.data, "data.attributes.spells.usedSpellbooks"))
        usedSpellbooks = duplicate(getProperty(this.data, "data.attributes.spells.usedSpellbooks"));

      for (let o of sbData) {
        if (o.inUse === true && !usedSpellbooks.includes(o.spellbook)) usedSpellbooks.push(o.spellbook);
        else if (o.inUse === false && usedSpellbooks.includes(o.spellbook))
          usedSpellbooks.splice(usedSpellbooks.indexOf(o.spellbook), 1);
      }
      data["data.attributes.spells.usedSpellbooks"] = usedSpellbooks;
    }

    // Apply changes in Actor size to Token width/height
    if (data["data.traits.size"] && this.data.data.traits.size !== data["data.traits.size"]) {
      let size = CONFIG.PF1.tokenSizes[data["data.traits.size"]];
      if (!this.isToken && !getProperty(this.data, "token.flags.pf1.staticSize")) {
        data["token.width"] = size.w;
        data["token.height"] = size.h;
        data["token.scale"] = size.scale;
      }
    }

    // Make certain variables absolute
    const _absoluteKeys = Object.keys(this.data.data.abilities)
      .reduce((arr, abl) => {
        arr.push(`data.abilities.${abl}.userPenalty`, `data.abilities.${abl}.damage`, `data.abilities.${abl}.drain`);
        return arr;
      }, [])
      .concat("data.attributes.energyDrain")
      .filter((k) => {
        return data[k] != null;
      });
    for (const k of _absoluteKeys) {
      data[k] = Math.abs(data[k]);
    }

    // Apply changes in resources
    for (let [k, v] of Object.entries(data)) {
      if (k.match(/^data\.resources\.([a-zA-Z0-9]+)\.value$/)) {
        const resKey = RegExp.$1;
        const itemId = getProperty(this.data, `data.resources.${resKey}._id`);
        if (itemId && itemId.length) {
          const updateData = mergeObject(this._queuedItemUpdates[itemId] ?? {}, {
            "data.uses.value": v,
          });
          if (!isObjectEmpty(updateData)) {
            this._queuedItemUpdates[itemId] = updateData;
          }
        }
      }
    }

    // Make only 1 fear condition active at most
    {
      const keys = ["shaken", "frightened", "panicked"];
      for (let k of keys) {
        k = `data.attributes.conditions.${k}`;
        if (data[k] === true) {
          for (let k2 of keys) {
            k2 = `data.attributes.conditions.${k2}`;
            if (k2 !== k) data[k2] = false;
          }
        }
      }
    }

    // Update experience
    this._updateExp(data);

    return data;
  }

  /**
   * Extend the default update method to enhance data before submission.
   * See the parent Entity.update method for full details.
   *
   * @param {object} data     The data with which to update the Actor
   * @param {object} options  Additional options which customize the update workflow
   * @returns {Promise}        A Promise which resolves to the updated Entity
   */
  async update(data, options = {}) {
    this._trackPreviousAttributes();

    // Avoid regular update flow for explicitly non-recursive update calls
    if (options.recursive === false) {
      return super.update(data, options);
    }

    data = await this.preUpdate(data);

    // Update changes
    let diff = diffObject(flattenObject(this.data), data);

    // Diff token data
    if (data.token != null) {
      diff.token = diffObject(this.data.token, data.token);
    }

    let result = diff;
    if (!isObjectEmpty(diff) && options.skipUpdate !== true) {
      return super.update(diff, mergeObject(options, { recursive: true }));
    }
    return result;
  }

  _onUpdate(data, options, userId, context) {
    if (userId === game.user.id) {
      this.toggleConditionStatusIcons();
    }

    super._onUpdate(data, options, userId, context);

    // Resize token(s)
    {
      const sizeKey = getProperty(data, "data.traits.size");
      if (sizeKey) {
        let size = CONFIG.PF1.tokenSizes[sizeKey];
        let tokens = this.getActiveTokens(false, true).filter((o) => {
          if (getProperty(o.data, "flags.pf1.staticSize")) return false;
          if (!getProperty(o.data, "actorLink")) return false;
          return true;
        });
        tokens.forEach((o) => {
          o.update({ width: size.w, height: size.h, scale: size.scale });
        });
      }
    }
  }

  async doQueuedUpdates() {
    if (!this.testUserPermission(game.user, "OWNER")) return;
    if (this._queuedUpdates == null) return;

    const diff = diffObject(duplicate(this.data._source), expandObject(this._queuedUpdates), { inner: true });
    this._queuedUpdates = {};
    if (!isObjectEmpty(diff)) {
      await this.update(diff);
    }
  }

  _preCreateEmbeddedDocuments(embeddedName, result, options, userId) {
    this._trackPreviousAttributes();

    super._preCreateEmbeddedDocuments(...arguments);
  }

  _preDeleteEmbeddedDocuments(embeddedName, result, options, userId) {
    this._trackPreviousAttributes();

    super._preDeleteEmbeddedDocuments(...arguments);
  }

  _preUpdateEmbeddedDocuments(embeddedName, result, options, userId) {
    this._trackPreviousAttributes();

    super._preUpdateEmbeddedDocuments(...arguments);
  }

  _onUpdateEmbeddedDocuments(embeddedName, documents, result, options, userId) {
    if (userId === game.user.id) {
      this.toggleConditionStatusIcons();
    }

    super._preUpdateEmbeddedDocuments(...arguments);

    if (this.sheet) this.sheet.render();
  }

  /**
   * Makes sure experience values are correct in update data.
   *
   * @param {object} data - The update data, as per ActorPF.update()
   * @param updateData
   */
  _updateExp(updateData) {
    // Get total level
    const classes = this.items.filter((o) => o.type === "class");
    const level = classes
      .filter((o) => o.data.data.classType !== "mythic")
      .reduce((cur, o) => cur + o.data.data.level, 0);

    // The following is not for NPCs
    if (this.data.type !== "character") return;

    if (updateData["data.details.xp.value"] == null) return;

    // Translate update exp value to number
    let newExp = updateData["data.details.xp.value"],
      resetExp = false;
    if (typeof newExp === "string") {
      const curExp =
        typeof this.data.data.details.xp.value === "number"
          ? this.data.data.details.xp.value
          : parseInt(this.data.data.details.xp.value);
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

      updateData["data.details.xp.value"] = newExp;
    }
    const maxExp = this.getLevelExp(level);
    updateData["data.details.xp.max"] = maxExp;

    if (resetExp) {
      const minExp = level > 0 ? this.getLevelExp(level - 1) : 0;
      updateData["data.details.xp.value"] = minExp;
    }
  }

  async _onCreate(data, options, userId, context) {
    if (game.userId === userId) {
      if (data.type === "character") this.update({ "token.actorLink": true }, { updateChanges: false });
    }

    super._onCreate(data, options, userId, context);
  }

  updateItemResources(itemData) {
    const activationType = game.settings.get("pf1", "unchainedActionEconomy")
      ? itemData.data.unchainedAction?.activation?.type
      : itemData.data.activation?.type;
    if (itemData.data.uses?.per && activationType) {
      const itemTag = !itemData.data.useCustomTag ? createTag(itemData.name) : itemData.data.tag;
      const resKey = `data.resources.${itemTag}`;
      let curUses = itemData.data.uses;

      const res = { value: 0, max: 0, _id: null };
      setProperty(this.data, resKey, res);
      res.value = curUses.value;
      res.max = curUses.max;
      res._id = itemData._id;
      return true;
    }

    return false;
  }

  /* -------------------------------------------- */

  /**
   * See the base Actor class for API documentation of this method
   *
   * @param itemData
   * @param options
   */
  async createOwnedItem(itemData, options) {
    let t = itemData.type;
    let initial = {};
    // Assume NPCs are always proficient with weapons and always have spells prepared
    const hasPlayerOwner = this.hasPlayerOwner;
    if (!hasPlayerOwner) {
      if (t === "weapon") initial["data.proficient"] = true;
      if (["weapon", "equipment"].includes(t)) initial["data.equipped"] = true;
    }
    if (t === "spell") {
      if (this.sheet != null && this.sheet._spellbookTab != null) {
        initial["data.spellbook"] = this.sheet._spellbookTab;
      }
    }

    // Alter change ids
    for (const c of getProperty(itemData, "data.changes") || []) {
      c._id = randomID(8);
    }

    mergeObject(itemData, initial);
    return ItemPF.create(itemData, { parent: this });
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  /**
   * Cast a Spell, consuming a spell slot of a certain level
   *
   * @param {ItemPF} item   The spell being cast by the actor
   * @param {MouseEvent} ev The click event
   * @param root0
   * @param root0.skipDialog
   */
  async useSpell(item, ev, { skipDialog = false } = {}) {
    if (!this.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }
    if (item.data.type !== "spell") throw new Error("Wrong Item type");

    if (
      getProperty(item.data, "data.preparation.mode") !== "atwill" &&
      item.getSpellUses() < item.chargeCost &&
      item.autoDeductCharges
    ) {
      const msg = game.i18n.localize("PF1.ErrorNoSpellsLeft");
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    // Invoke the Item roll
    return item.useAttack({ ev: ev, skipDialog: skipDialog });
  }

  async createAttackFromWeapon(item) {
    if (!this.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    if (item.data.type !== "weapon") throw new Error("Wrong Item type");

    // Get attack template
    let attackData = { data: {} };
    for (const template of game.data.system.template.Item.attack.templates) {
      mergeObject(attackData.data, game.data.system.template.Item.templates[template]);
    }
    mergeObject(attackData.data, duplicate(game.data.system.template.Item.attack));
    attackData = flattenObject(attackData);

    // Add ability modifiers
    const isMelee = getProperty(item.data, "data.weaponSubtype") !== "ranged";

    if (isMelee)
      attackData["data.ability.attack"] = getProperty(this.data, "data.attributes.attack.meleeAbility") || "str";
    else attackData["data.ability.attack"] = getProperty(this.data, "data.attributes.attack.rangedAbility") || "dex";

    if (isMelee) {
      attackData["data.ability.damage"] = "str";
      if (item.data.data.weaponSubtype === "2h" && isMelee) {
        attackData["data.ability.damageMult"] = 1.5;
        attackData["data.held"] = "2h";
      }
    }

    // Add misc things
    attackData["type"] = "attack";
    attackData["name"] = item.data.name;
    attackData["data.masterwork"] = item.data.data.masterwork;
    attackData["data.nonlethal"] = item.data.data.nonlethal;
    attackData["data.attackType"] = "weapon";
    attackData["data.enh"] = item.data.data.enh;
    attackData["data.ability.critRange"] = item.data.data.weaponData.critRange || 20;
    attackData["data.ability.critMult"] = item.data.data.weaponData.critMult || 2;
    attackData["data.actionType"] = isMelee ? "mwak" : "rwak";
    attackData["data.activation.type"] = "attack";
    attackData["data.duration.units"] = "inst";
    attackData["data.range.units"] = "melee";
    attackData["data.broken"] = item.data.data.broken;
    attackData["data.range.maxIncrements"] = item.data.data.weaponData.maxRangeIncrements;
    attackData["img"] = item.data.img;

    // Add additional attacks
    attackData["data.formulaicAttacks.count.formula"] = "ceil(@attributes.bab.total / 5) - 1";
    attackData["data.formulaicAttacks.bonus.formula"] = "@formulaicAttack * -5";

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
        part = `sizeRoll(${dieCount}, ${dieSides}, @size)`;
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

    // Set reach
    if (isMelee && getProperty(item.data, "data.properties.rch") === true) {
      attackData["data.range.units"] = "reach";
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
    if (itemData.type === "attack") {
      // check for correct itemData, Foundry #3419
      const newItem = this.items.find((o) => o.id === itemData.id);
      if (newItem) {
        await item.createItemLink("children", "data", newItem, itemData.id);
      }
    }

    ui.notifications.info(game.i18n.localize("PF1.NotificationCreatedAttack").format(item.data.name));
  }

  /* -------------------------------------------- */

  getSkillInfo(skillId) {
    let skl,
      sklName,
      parentSkill,
      isCustom = false;
    const skillParts = skillId.split("."),
      isSubSkill = skillParts[1] === "subSkills" && skillParts.length === 3;
    if (isSubSkill) {
      skillId = skillParts[0];
      skl = this.data.data.skills[skillId].subSkills[skillParts[2]];
      if (!skl) return null;
      sklName = `${CONFIG.PF1.skills[skillId]} (${skl.name})`;
      parentSkill = this.getSkillInfo(skillId);
    } else {
      skl = this.data.data.skills[skillId];
      if (!skl) return null;
      if (skl.name != null) {
        sklName = skl.name;
        isCustom = true;
      } else sklName = CONFIG.PF1.skills[skillId];
    }

    const result = duplicate(skl);
    result.id = skillId;
    result.name = sklName;
    result.bonus = skl.mod; // deprecated; backwards compatibility

    if (parentSkill) result.parentSkill = parentSkill;

    return result;
  }

  /**
   * Roll a Skill Check
   * Prompt the user for input regarding Take 10/Take 20 and any Situational Bonus
   *
   * @param {string} skillId      The skill id (e.g. "per", or "prf.subSkills.prf1")
   * @param {object} options      Options which configure how the skill check is rolled
   */
  rollSkill(
    skillId,
    options = { event: null, skipDialog: false, staticRoll: null, chatMessage: true, noSound: false, dice: "1d20" }
  ) {
    if (!this.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    const allowed = Hooks.call("actorRoll", this, "skill", skillId, options);
    if (allowed === false) return;

    const skl = this.getSkillInfo(skillId);

    // Add contextual attack string
    let notes = [];
    let rollData = this.getRollData();
    const noteObjects = this.getContextNotes(`skill.${skillId}`);
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (let note of noteObj.notes) {
        notes.push(...note.split(/[\n\r]+/).map((o) => TextEditor.enrichHTML(o, { rollData: rollData })));
      }
    }
    // Add untrained note
    if (skl.rt && !skl.rank) {
      notes.push(game.i18n.localize("PF1.Untrained"));
    }

    // Gather changes
    let parts = [];
    const changes = this.changes.filter((c) => {
      let cf = getChangeFlat.call(this, c.subTarget, c.modifier);
      if (!(cf instanceof Array)) cf = [cf];

      return cf.includes(`data.skills.${skillId}.changeBonus`);
    });

    // Add ability modifier
    if (skl.ability) {
      parts.push(`@abilities.${skl.ability}.mod[${CONFIG.PF1.abilities[skl.ability]}]`);
    }

    // Add rank
    if (skl.rank > 0) {
      parts.push(`${skl.rank}[${game.i18n.localize("PF1.SkillRankPlural")}]`);
      if (skl.cs) {
        parts.push(`3[${game.i18n.localize("PF1.CSTooltip")}]`);
      }
    }

    // Add armor check penalty
    if (skl.acp) {
      parts.push(`-@attributes.acp.total[${game.i18n.localize("PF1.ACPLong")}]`);
    }

    // Add Wound Thresholds info
    if (rollData.attributes.woundThresholds?.penalty > 0) {
      parts.push(
        `- @attributes.woundThresholds.penalty[${game.i18n.localize(
          CONFIG.PF1.woundThresholdConditions[rollData.attributes.woundThresholds.level]
        )}]`
      );
    }

    // Add changes
    for (let c of changes) {
      if (!c.value) continue;
      parts.push(`${c.value}[${c.flavor}]`);
    }

    let props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });
    return DicePF.d20Roll({
      event: options.event,
      fastForward: options.skipDialog === true,
      staticRoll: options.staticRoll,
      parts,
      dice: options.dice,
      data: rollData,
      subject: { skill: skillId },
      title: game.i18n.localize("PF1.SkillCheck").format(skl.name),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      chatTemplate: "systems/pf1/templates/chat/roll-ext.hbs",
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      chatMessage: options.chatMessage,
      noSound: options.noSound,
      compendiumEntry: CONFIG.PF1.skillCompendiumEntries[skillId],
    });
  }

  /* -------------------------------------------- */

  /**
   * Roll a generic ability test or saving throw.
   * Prompt the user for input on which variety of roll they want to do.
   *
   * @param {string} abilityId     The ability id (e.g. "str")
   * @param {object} options      Options which configure how ability tests or saving throws are rolled
   */
  rollAbility(abilityId, options = { noSound: false, dice: "1d20" }) {
    this.rollAbilityTest(abilityId, options);
  }

  rollBAB(options = { chatMessage: true, noSound: false, dice: "1d20" }) {
    if (!this.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    const allowed = Hooks.call("actorRoll", this, "bab", null, options);
    if (allowed === false) return;

    return DicePF.d20Roll({
      event: options.event,
      parts: [`@mod[${game.i18n.localize("PF1.BABAbbr")}]`],
      dice: options.dice,
      data: { mod: this.data.data.attributes.bab.total },
      subject: { core: "bab" },
      title: game.i18n.localize("PF1.BAB"),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      takeTwenty: false,
      chatTemplate: "systems/pf1/templates/chat/roll-ext.hbs",
      chatMessage: options.chatMessage,
      noSound: options.noSound,
    });
  }

  rollCMB(options = { chatMessage: true, noSound: false, dice: "1d20" }) {
    if (!this.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    const allowed = Hooks.call("actorRoll", this, "cmb", null, options);
    if (allowed === false) return;

    // Add contextual notes
    let notes = [];
    let rollData = this.getRollData();
    const noteObjects = this.getContextNotes("misc.cmb");
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (let note of noteObj.notes) {
        notes.push(...note.split(/[\n\r]+/).map((o) => TextEditor.enrichHTML(o, { rollData: rollData })));
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
      parts: [`@mod[${game.i18n.localize("PF1.CMBAbbr")}]`],
      dice: options.dice,
      data: { mod: this.data.data.attributes.cmb.total },
      subject: { core: "cmb" },
      title: game.i18n.localize("PF1.CMB"),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      takeTwenty: false,
      chatTemplate: "systems/pf1/templates/chat/roll-ext.hbs",
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      chatMessage: options.chatMessage,
      noSound: options.noSound,
    });
  }

  rollAttack(options = { melee: true, chatMessage: true, noSound: false, dice: "1d20" }) {
    if (!this.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    const sources = [
      ...this.sourceDetails["data.attributes.attack.shared"],
      // ...this.sourceDetails["data.attributes.attack.general"],
      // ...this.sourceDetails[`data.attributes.attack.${options.melee ? "melee" : "ranged"}`],
    ];

    // Add contextual notes
    let notes = [];
    let rollData = this.getRollData();
    const noteObjects = [...this.getContextNotes("attacks.effect"), ...this.getContextNotes("attacks.attack")];
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (let note of noteObj.notes) {
        notes.push(...note.split(/[\n\r]+/).map((o) => TextEditor.enrichHTML(o, { rollData: rollData })));
      }
    }
    rollData.item = {};

    let changes = sources
      .filter((item) => Number.isInteger(item.value))
      .map((i) => {
        return `${i.value}[${i.name}]`;
      });

    // Add attack bonuses from changes
    const attackTargets = ["attack"].concat(options.melee ? ["mattack"] : ["rattack"]);
    const attackChanges = this.changes.filter((c) => {
      return attackTargets.includes(c.subTarget);
    });
    changes.push(
      ...attackChanges.map((c) => {
        c.applyChange(this);
        return `${c.value}[${c.parent ? c.parent.name : c.data.modifier}]`;
      })
    );

    // Add ability modifier
    const atkAbl = getProperty(this.data, `data.attributes.attack.${options.melee ? "melee" : "ranged"}Ability`);
    changes.push(`${getProperty(this.data, `data.abilities.${atkAbl}.mod`)}[${CONFIG.PF1.abilities[atkAbl]}]`);

    let props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });
    return DicePF.d20Roll({
      event: options.event,
      parts: changes,
      dice: options.dice,
      data: rollData,
      subject: { core: "attack" },
      title: game.i18n.localize(`PF1.${options.melee ? "Melee" : "Ranged"}`),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      takeTwenty: false,
      chatTemplate: "systems/pf1/templates/chat/roll-ext.hbs",
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      chatMessage: options.chatMessage,
      noSound: options.noSound,
    });
  }

  rollCL(spellbookKey, options = { chatMessage: true, noSound: false, dice: "1d20" }) {
    const spellbook = this.data.data.attributes.spells.spellbooks[spellbookKey];
    const rollData = duplicate(this.getRollData());
    rollData.cl = spellbook.cl.total;

    const allowed = Hooks.call("actorRoll", this, "cl", spellbookKey, options);
    if (allowed === false) return;

    // Add contextual caster level string
    const notes = this.getContextNotesParsed(`spell.cl.${spellbookKey}`);

    // Wound Threshold penalty
    const wT = this.getWoundThresholdData();
    if (wT.valid) notes.push(game.i18n.localize(CONFIG.PF1.woundThresholdConditions[wT.level]));

    let props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });
    return DicePF.d20Roll({
      event: event,
      parts: [`@cl[${game.i18n.localize("PF1.CasterLevel")}]`],
      data: rollData,
      subject: { core: "cl" },
      title: game.i18n.localize("PF1.CasterLevelCheck"),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      takeTwenty: false,
      chatTemplate: "systems/pf1/templates/chat/roll-ext.hbs",
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      chatMessage: options.chatMessage,
      noSound: options.noSound,
    });
  }

  rollConcentration(spellbookKey, options = { chatMessage: true, noSound: false, dice: "1d20" }) {
    const spellbook = this.data.data.attributes.spells.spellbooks[spellbookKey];
    const rollData = duplicate(this.getRollData());
    rollData.cl = spellbook.cl.total;
    rollData.mod = this.data.data.abilities[spellbook.ability]?.mod ?? 0;
    rollData.concentrationBonus = spellbook.concentration;

    const allowed = Hooks.call("actorRoll", this, "concentration", spellbookKey, options);
    if (allowed === false) return;

    // Add contextual concentration string
    const notes = this.getContextNotesParsed(`spell.concentration.${spellbookKey}`);

    // Wound Threshold penalty
    const wT = this.getWoundThresholdData();
    if (wT.valid) notes.push(game.i18n.localize(CONFIG.PF1.woundThresholdConditions[wT.level]));
    // TODO: Make the penalty show separate of the CL.total.

    let props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    let formulaRoll = 0;
    if (spellbook.concentrationFormula.length)
      formulaRoll = RollPF.safeRoll(spellbook.concentrationFormula, rollData).total;
    rollData.formulaBonus = formulaRoll;

    return DicePF.d20Roll({
      event: event,
      parts: [
        `@cl[${game.i18n.localize("PF1.CasterLevel")}] + @mod[${
          CONFIG.PF1.abilities[spellbook.ability]
        }] + (@concentrationBonus + @formulaBonus)[${game.i18n.localize("PF1.ByBonus")}]`,
      ],
      dice: options.dice,
      data: rollData,
      subject: { core: "concentration" },
      title: game.i18n.localize("PF1.ConcentrationCheck"),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      takeTwenty: false,
      chatTemplate: "systems/pf1/templates/chat/roll-ext.hbs",
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      chatMessage: options.chatMessage,
      noSound: options.noSound,
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
        data.traits.dv.value.map((obj) => {
          return CONFIG.PF1.damageTypes[obj];
        }),
        data.traits.dv.custom.length > 0 ? data.traits.dv.custom.split(";") : []
      );
      headers.push({ header: game.i18n.localize("PF1.DamVuln"), value: value });
    }
    // Condition resistance
    if (data.traits.cres.length) {
      headers.push({ header: game.i18n.localize("PF1.ConRes"), value: data.traits.cres.split(reSplit) });
    }
    // Immunities
    if (
      data.traits.di.value.length ||
      data.traits.di.custom.length ||
      data.traits.ci.value.length ||
      data.traits.ci.custom.length
    ) {
      const value = [].concat(
        data.traits.di.value.map((obj) => {
          return CONFIG.PF1.damageTypes[obj];
        }),
        data.traits.di.custom.length > 0 ? data.traits.di.custom.split(";") : [],
        data.traits.ci.value.map((obj) => {
          return CONFIG.PF1.conditionTypes[obj];
        }),
        data.traits.ci.custom.length > 0 ? data.traits.ci.custom.split(";") : []
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

  getInitiativeContextNotes() {
    let notes = this.getContextNotes("misc.init").reduce((arr, o) => {
      for (let n of o.notes) arr.push(...n.split(/[\n\r]+/));
      return arr;
    }, []);

    let notesHTML;
    if (notes.length > 0) {
      // Format notes if they're present
      let notesHTMLParts = [];
      notes.forEach((note) => notesHTMLParts.push(`<span class="tag">${note}</span>`));
      notesHTML =
        '<div class="flexcol property-group gm-sensitive"><label>' +
        game.i18n.localize("PF1.Notes") +
        '</label> <div class="flexrow">' +
        notesHTMLParts.join("") +
        "</div></div>";
    }

    return [notes, notesHTML];
  }

  async rollInitiative({ createCombatants = false, rerollInitiative = false, initiativeOptions = {} } = {}) {
    // Obtain (or create) a combat encounter
    let combat = game.combat;
    if (!combat) {
      if (game.user.isGM && canvas.scene) {
        combat = await game.combats.documentClass.create({ scene: canvas.scene.id, active: true });
      } else {
        ui.notifications.warn(game.i18n.localize("COMBAT.NoneActive"));
        return null;
      }
    }

    // Create new combatants
    if (createCombatants) {
      const tokens = this.isToken ? [this.token] : this.getActiveTokens();
      const createData = tokens.reduce((arr, t) => {
        if (t.inCombat) return arr;
        arr.push({ tokenId: t.id, hidden: t.data.hidden });
        return arr;
      }, []);
      await combat.createEmbeddedDocuments("Combatant", createData);
    }

    // Iterate over combatants to roll for
    const combatantIds = combat.combatants.reduce((arr, c) => {
      if (c.actor.id !== this.id || (this.isToken && c.data.tokenId !== this.token.id)) return arr;
      if (c.initiative && !rerollInitiative) return arr;
      arr.push(c.id);
      return arr;
    }, []);
    return combatantIds.length ? combat.rollInitiative(combatantIds, initiativeOptions) : combat;
  }

  rollSavingThrow(
    savingThrowId,
    options = { event: null, chatMessage: true, noSound: false, skipPrompt: true, dice: "1d20" }
  ) {
    if (!this.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    const allowed = Hooks.call("actorRoll", this, "save", savingThrowId, options);
    if (allowed === false) return;

    // Add contextual notes
    let notes = [];
    let rollData = this.getRollData();
    const noteObjects = this.getContextNotes(`savingThrow.${savingThrowId}`);
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (let note of noteObj.notes) {
        notes.push(...note.split(/[\n\r]+/).map((o) => TextEditor.enrichHTML(o, { rollData: rollData })));
      }
    }

    let parts = [];

    // Get base
    const base = getProperty(this.data, `data.attributes.savingThrows.${savingThrowId}.base`);
    if (base) parts.push(`${base}[${game.i18n.localize("PF1.Base")}]`);

    // Add changes
    let changeBonus = [];
    const changes = this.changes.filter((c) => ["allSavingThrows", savingThrowId].includes(c.subTarget));
    {
      // Get damage bonus
      changeBonus = getHighestChanges(
        changes.filter((c) => {
          c.applyChange(this);
          return !["set", "="].includes(c.operator);
        }),
        { ignoreTarget: true }
      ).reduce((cur, c) => {
        if (c.value)
          cur.push({
            value: c.value,
            source: c.flavor,
          });
        return cur;
      }, []);
    }
    for (let c of changeBonus) {
      parts.push(`${c.value}[${c.source}]`);
    }

    // Wound Threshold penalty
    if (rollData.attributes.woundThresholds.penalty > 0) {
      notes.push(game.i18n.localize(CONFIG.PF1.woundThresholdConditions[rollData.attributes.woundThresholds.level]));
      parts.push(
        `- @attributes.woundThresholds.penalty[${game.i18n.localize(
          CONFIG.PF1.woundThresholdConditions[rollData.attributes.woundThresholds.level]
        )}]`
      );
    }

    // Roll saving throw
    let props = this.getDefenseHeaders();
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });
    const label = CONFIG.PF1.savingThrows[savingThrowId];
    return DicePF.d20Roll({
      event: options.event,
      parts,
      dice: options.dice,
      situational: true,
      data: rollData,
      subject: { save: savingThrowId },
      title: game.i18n.localize("PF1.SavingThrowRoll").format(label),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      takeTwenty: false,
      fastForward: options.skipPrompt !== false ? true : false,
      chatTemplate: "systems/pf1/templates/chat/roll-ext.hbs",
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      chatMessage: options.chatMessage,
      noSound: options.noSound,
    });
  }

  /* -------------------------------------------- */

  /**
   * Roll an Ability Test
   * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
   *
   * @param {string} abilityId    The ability ID (e.g. "str")
   * @param {object} options      Options which configure how ability tests are rolled
   */
  rollAbilityTest(abilityId, options = { chatMessage: true, noSound: false, dice: "1d20" }) {
    if (!this.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    const allowed = Hooks.call("actorRoll", this, "ability", abilityId, options);
    if (allowed === false) return;

    // Add contextual notes
    let notes = [];
    let rollData = this.getRollData();
    const noteObjects = this.getContextNotes(`abilityChecks.${abilityId}`);
    for (let noteObj of noteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (let note of noteObj.notes) {
        notes.push(...note.split(/[\n\r]+/).map((o) => TextEditor.enrichHTML(o, { rollData: rollData })));
      }
    }

    const label = CONFIG.PF1.abilities[abilityId];
    const abl = this.data.data.abilities[abilityId];

    let formula = `@abilities.${abilityId}.mod`;
    if (abl.checkMod) {
      formula += ` + @abilities.${abilityId}.checkMod`;
    }
    if (this.data.data.attributes.energyDrain) {
      formula += " - @attributes.energyDrain";
    }

    // Wound Threshold penalty
    if (rollData.attributes.woundThresholds.penalty > 0)
      notes.push(game.i18n.localize(CONFIG.PF1.woundThresholdConditions[rollData.attributes.woundThresholds.level]));

    let props = this.getDefenseHeaders();
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    return DicePF.d20Roll({
      event: options.event,
      parts: [formula],
      dice: options.dice,
      data: rollData,
      subject: { ability: abilityId },
      title: game.i18n.localize("PF1.AbilityTest").format(label),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      chatTemplate: "systems/pf1/templates/chat/roll-ext.hbs",
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      chatMessage: options.chatMessage,
      noSound: options.noSound,
    });
  }

  /**
   * Show defenses in chat
   */
  async rollDefenses() {
    if (!this.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }
    let rollData = this.getRollData();

    // Add contextual AC notes
    let acNotes = [];
    if (this.data.data.attributes.acNotes.length > 0) acNotes = this.data.data.attributes.acNotes.split(/[\n\r]+/);
    const acNoteObjects = this.getContextNotes("misc.ac");
    for (let noteObj of acNoteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (let note of noteObj.notes) {
        acNotes.push(...note.split(/[\n\r]+/).map((o) => TextEditor.enrichHTML(o, { rollData: rollData })));
      }
    }

    // Add contextual CMD notes
    let cmdNotes = [];
    if (this.data.data.attributes.cmdNotes.length > 0) cmdNotes = this.data.data.attributes.cmdNotes.split(/[\n\r]+/);
    const cmdNoteObjects = this.getContextNotes("misc.cmd");
    for (let noteObj of cmdNoteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (let note of noteObj.notes) {
        cmdNotes.push(...note.split(/[\n\r]+/).map((o) => TextEditor.enrichHTML(o, { rollData: rollData })));
      }
    }

    // Add contextual SR notes
    let srNotes = [];
    if (this.data.data.attributes.srNotes.length > 0) srNotes = this.data.data.attributes.srNotes.split(/[\n\r]+/);
    const srNoteObjects = this.getContextNotes("misc.sr");
    for (let noteObj of srNoteObjects) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (let note of noteObj.notes) {
        srNotes.push(...note.split(/[\n\r]+/).map((o) => TextEditor.enrichHTML(o, { rollData: rollData })));
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
        ...this.data.data.traits.di.value.map((obj) => {
          return CONFIG.PF1.damageTypes[obj];
        }),
        ...(this.data.data.traits.di.custom.length > 0 ? this.data.data.traits.di.custom.split(reSplit) : []),
      ];
      energyResistance.push(...values.map((o) => game.i18n.localize("PF1.ImmuneTo").format(o)));
    }
    // Damage Vulnerability
    if (this.data.data.traits.dv.value.length || this.data.data.traits.dv.custom.length) {
      const values = [
        ...this.data.data.traits.dv.value.map((obj) => {
          return CONFIG.PF1.damageTypes[obj];
        }),
        ...(this.data.data.traits.dv.custom.length > 0 ? this.data.data.traits.dv.custom.split(reSplit) : []),
      ];
      energyResistance.push(...values.map((o) => game.i18n.localize("PF1.VulnerableTo").format(o)));
    }

    // Wound Threshold penalty
    const wT = this.getWoundThresholdData();
    if (wT.valid) {
      const wTlabel = game.i18n.localize(CONFIG.PF1.woundThresholdConditions[wT.level]);
      acNotes.push(wTlabel);
      cmdNotes.push(wTlabel);
    }

    // Get actor's token
    const token =
      this.token instanceof TokenDocument
        ? this.token.object
        : this.token ?? canvas.tokens.placeables.find((t) => t.actor && t.actor.id === this.id);

    // Create message
    const d = this.data.data;
    const data = {
      actor: this,
      name: this.name,
      tokenId: this.token ? `${this.token.uuid}` : null,
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
      tokenUuid: token?.document.uuid,
    };
    // Add regeneration and fast healing
    if ((getProperty(d, "traits.fastHealing") || "").length || (getProperty(d, "traits.regen") || "").length) {
      data.regen = {
        regen: d.traits.regen,
        fastHealing: d.traits.fastHealing,
      };
    }

    setProperty(data, "flags.pf1.subject", "defenses");

    const msg = await createCustomChatMessage("systems/pf1/templates/chat/defenses.hbs", data, {
      speaker: ChatMessage.getSpeaker({ actor: this }),
    });
  }

  /* -------------------------------------------- */

  /**
   * Apply rolled dice damage to the token or tokens which are currently controlled.
   * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
   * If Shift is held, will prompt for adjustments based on damage reduction and energy resistances
   *
   * @param {number} value - The amount of damage to deal.
   * @param {object} [options] - Object containing default settings for overriding
   * @param {boolean} [options.forceDialog=true] - Forces the opening of a Dialog as if Shift was pressed
   * @param {string} [options.reductionDefault] - Default value for Damage Reduction
   * @param {boolean} [options.asNonlethal] - Marks the damage as non-lethal
   * @returns {Promise}
   */
  static async applyDamage(value, { forceDialog = false, reductionDefault = "", asNonlethal = false } = {}) {
    const promises = [];
    var controlled = canvas.tokens.controlled,
      healingInvert = 1,
      numReg = /(\d+)/g,
      sliceReg = /[^,;\n]*(\d+)[^,;\n]*/g;

    //if (!controlled) return;

    const _submit = async function (form, multiplier) {
      if (form) {
        value = form.find('[name="damage"]').val();
        let dR = form.find('[name="damage-reduction"]').val();
        value = value.length ? RollPF.safeRoll(value, {}, []).total : 0;
        dR = dR.length ? RollPF.safeRoll(dR, {}, []).total : 0;
        if (multiplier < 0) {
          value = Math.ceil(value * multiplier);
          value = Math.min(value - dR, 0);
        } else {
          value = Math.floor(value * (multiplier ?? 1));
          value = Math.max(value - dR, 0);
        }
        let checked = [...form.find(".tokenAffected:checked")].map((tok) => tok.name.replace("affect.", ""));
        controlled = controlled.filter((con) => checked.includes(con.id));
      }
      for (let t of controlled) {
        let a = t.actor,
          hp = a.data.data.attributes.hp,
          tmp = parseInt(hp.temp) || 0;

        // Handle nonlethal damage
        let nld = 0;
        if (asNonlethal && value > 0) {
          nld = Math.min(hp.max - hp.nonlethal, value);
          value -= nld;
        }

        // Temp HP adjustment
        let dt = value > 0 ? Math.min(tmp, value) : 0;

        if (!a.isOwner) {
          const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
          console.warn(msg);
          ui.notifications.warn(msg);
          continue;
        }
        promises.push(
          t.actor.update({
            "data.attributes.hp.nonlethal": hp.nonlethal + nld,
            "data.attributes.hp.temp": tmp - dt,
            "data.attributes.hp.value": Math.clamped(hp.value - (value - dt), -100, hp.max),
          })
        );
      }
      return Promise.all(promises);
    };

    if (game.keyboard.isDown("Shift") ? !forceDialog : forceDialog) {
      if (value < 0) {
        healingInvert = -1;
        value = -1 * value;
      }
      let tokens = controlled.map((tok) => {
        return {
          _id: tok.id,
          name: tok.name,
          dr: tok.actor.data.data.traits.dr.match(sliceReg),
          eres: tok.actor.data.data.traits.eres.match(sliceReg),
          checked: true,
        };
      });

      reductionDefault = reductionDefault ?? "";

      // Dialog configuration and callbacks
      let template = "systems/pf1/templates/apps/damage-dialog.hbs";
      let dialogData = {
        damage: value,
        healing: healingInvert == -1 ? true : false,
        damageReduction: reductionDefault,
        tokens: tokens,
        nonlethal: asNonlethal,
      };
      const html = await renderTemplate(template, dialogData);

      return new Promise((resolve) => {
        const buttons = {};
        buttons.normal = {
          label: game.i18n.localize("PF1.Apply"),
          callback: (html) => resolve(_submit.call(this, html, 1 * healingInvert)),
        };
        buttons.half = {
          label: game.i18n.localize("PF1.ApplyHalf"),
          callback: (html) => resolve(_submit.call(this, html, 0.5 * healingInvert)),
        };

        var d = new Dialog({
          title: healingInvert > 0 ? game.i18n.localize("PF1.ApplyDamage") : game.i18n.localize("PF1.ApplyHealing"),
          content: html,
          buttons: buttons,
          default: "normal",
          close: (html) => {
            resolve(false);
          },
          render: (inp) => {
            /**
             *
             */
            function swapSelected() {
              let checked = [...inp[0].querySelectorAll('.selected-tokens input[type="checkbox"]')];
              checked.forEach((chk) => (chk.checked = !chk.checked));
            }
            /**
             * @param e
             */
            function setReduction(e) {
              inp[0].querySelector('input[name="damage-reduction"]').value =
                e.currentTarget.innerText.match(numReg) ?? "";
            }
            /**
             * @param event
             */
            function mouseWheelAdd(event) {
              const el = event.currentTarget;

              //Digits with optional sign only
              if (/[^\d+-]|(?:\d[+-])/.test(el.value.trim())) return;

              const value = parseFloat(el.value) || 0;
              const increase = -Math.sign(event.originalEvent.deltaY);

              el.value = (value + increase).toString();
            }

            inp.on("click", 'a[name="swap-selected"]', swapSelected);
            inp.on("click", 'a[name="clear-reduction"], p.notes a', setReduction);
            inp.on("wheel", "input", mouseWheelAdd);
          },
        });
        d.render(true);
      });
    } else return _submit();
  }

  /**
   * Returns effective Wound Threshold multiplier with rules and overrides applied.
   *
   * @param data
   */
  getWoundThresholdMultiplier(data = null) {
    data = data ?? this.data;

    const hpconf = game.settings.get("pf1", "healthConfig").variants;
    const conf = this.data.type === "npc" ? hpconf.npc : hpconf.pc;
    const override = getProperty(data, "data.attributes.woundThresholds.override") ?? -1;
    return override >= 0 && conf.allowWoundThresholdOverride ? override : conf.useWoundThresholds;
  }

  /**
   * Returns Wound Threshold relevant data.
   *
   * @param {*} rollData Provided valid rollData
   * @param data
   */
  getWoundThresholdData(data = null) {
    data = data ?? this.data;

    const woundMult = this.getWoundThresholdMultiplier(data),
      woundLevel = getProperty(data, "data.attributes.woundThresholds.level") ?? 0,
      woundPenalty = woundLevel * woundMult + (getProperty(data, "data.attributes.woundThresholds.mod") ?? 0);
    return {
      level: woundLevel,
      penalty: woundPenalty,
      multiplier: woundMult,
      valid: woundLevel > 0 && woundMult > 0,
    };
  }

  /**
   * Updates attributes.woundThresholds.level variable.
   */
  updateWoundThreshold() {
    const hpconf = game.settings.get("pf1", "healthConfig").variants;
    const usage = this.data.type === "npc" ? hpconf.npc.useWoundThresholds : hpconf.pc.useWoundThresholds;
    if (!usage) {
      setProperty(this.data, "data.attributes.woundThresholds.level", 0);
      setProperty(this.data, "data.attributes.woundThresholds.penaltyBase", 0);
      setProperty(this.data, "data.attributes.woundThresholds.penalty", 0);
      return;
    }
    const curHP = getProperty(this.data, "data.attributes.hp.value"),
      maxHP = getProperty(this.data, "data.attributes.hp.max");

    let level = usage > 0 ? Math.min(3, 4 - Math.ceil((curHP / maxHP) * 4)) : 0;
    if (Number.isNaN(level)) level = 0; // BUG: This shouldn't happen, but it does.
    level = Math.max(0, level);

    const wtMult = this.getWoundThresholdMultiplier();
    const wtMod = getProperty(this.data, "data.attributes.woundThresholds.mod") ?? 0;

    setProperty(this.data, "data.attributes.woundThresholds.level", level);
    setProperty(this.data, "data.attributes.woundThresholds.penaltyBase", level * wtMult); // To aid relevant formulas
    setProperty(this.data, "data.attributes.woundThresholds.penalty", level * wtMult + wtMod);

    const penalty = getProperty(this.data, "data.attributes.woundThresholds.penalty");
    const changeFlatKeys = ["cmb", "cmd", "init", "allSavingThrows", "ac", "skills", "allChecks"];
    for (let fk of changeFlatKeys) {
      let flats = getChangeFlat.call(this, fk, "penalty", this.data.data);
      if (!(flats instanceof Array)) flats = [flats];
      for (let k of flats) {
        if (!k) continue;
        const curValue = getProperty(this.data, k);
        setProperty(this.data, k, curValue - penalty);
      }
    }
  }

  get allSkills() {
    let result = [];
    for (let [k, s] of Object.entries(this.data.data.skills)) {
      if (!s) continue;
      result.push(k);
      if (s.subSkills) {
        for (let k2 of Object.keys(s.subSkills)) {
          result.push(`${k}.subSkills.${k2}`);
        }
      }
    }
    return result;
  }

  get allNotes() {
    let result = [];

    const noteItems = this.items.filter((o) => {
      return o.data.data.contextNotes != null;
    });

    for (let o of noteItems) {
      if (!o.isActive) continue;
      if (!o.data.data.contextNotes || o.data.data.contextNotes.length === 0) continue;
      result.push({ notes: o.data.data.contextNotes, item: o });
    }

    return result;
  }

  /**
   * @returns {ItemPF[]} All items on this actor, including those in containers.
   */
  get allItems() {
    return [...this.containerItems, ...Array.from(this.items)];
  }

  /**
   * Generates an array with all the active context-sensitive notes for the given context on this actor.
   *
   * @param {string} context - The context to draw from.
   */
  getContextNotes(context) {
    let result = this.allNotes;

    // Attacks
    if (context.match(/^attacks\.(.+)/)) {
      const key = RegExp.$1;
      for (let note of result) {
        note.notes = note.notes
          .filter((o) => {
            return o.subTarget === key;
          })
          .map((o) => {
            return o.text;
          });
      }

      return result;
    }

    // Skill
    if (context.match(/^skill\.(.+)/)) {
      const skillKey = RegExp.$1;
      const skill = this.getSkillInfo(skillKey);
      const ability = skill.ability;
      for (let note of result) {
        note.notes = note.notes
          .filter((o) => {
            return (
              // Check for skill.context or skill.xyz.subSkills.context
              o.subTarget === context ||
              o.subTarget.split(".")?.[3] === context.split(".")?.[1] ||
              o.subTarget === `${ability}Skills` ||
              o.subTarget === "skills"
            );
          })
          .map((o) => {
            return o.text;
          });
      }

      return result;
    }

    // Saving throws
    if (context.match(/^savingThrow\.(.+)/)) {
      const saveKey = RegExp.$1;
      for (let note of result) {
        note.notes = note.notes
          .filter((o) => {
            return o.subTarget === saveKey || o.subTarget === "allSavingThrows";
          })
          .map((o) => {
            return o.text;
          });
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
        note.notes = note.notes
          .filter((o) => {
            return o.subTarget === `${ablKey}Checks` || o.subTarget === "allChecks";
          })
          .map((o) => {
            return o.text;
          });
      }

      return result;
    }

    // Misc
    if (context.match(/^misc\.(.+)/)) {
      const miscKey = RegExp.$1;
      for (let note of result) {
        note.notes = note.notes
          .filter((o) => {
            return o.subTarget === miscKey;
          })
          .map((o) => {
            return o.text;
          });
      }

      return result;
    }

    if (context.match(/^spell\.concentration\.([a-z]+)$/)) {
      const spellbookKey = RegExp.$1;
      for (let note of result) {
        note.notes = note.notes
          .filter((o) => {
            return o.subTarget === "concentration";
          })
          .map((o) => {
            return o.text;
          });
      }

      const spellbookNotes = getProperty(
        this.data,
        `data.attributes.spells.spellbooks.${spellbookKey}.concentrationNotes`
      );
      if (spellbookNotes.length) {
        result.push({ notes: spellbookNotes.split(/[\n\r]+/), item: null });
      }

      return result;
    }

    if (context.match(/^spell\.cl\.([a-z]+)$/)) {
      const spellbookKey = RegExp.$1;
      for (let note of result) {
        note.notes = note.notes
          .filter((o) => {
            return o.subTarget === "cl";
          })
          .map((o) => {
            return o.text;
          });
      }

      const spellbookNotes = getProperty(this.data, `data.attributes.spells.spellbooks.${spellbookKey}.clNotes`);
      if (spellbookNotes.length) {
        result.push({ notes: spellbookNotes.split(/[\n\r]+/), item: null });
      }

      return result;
    }

    if (context.match(/^spell\.effect$/)) {
      for (let note of result) {
        note.notes = note.notes.filter((o) => o.subTarget === "spellEffect").map((o) => o.text);
      }

      return result;
    }

    return [];
  }

  /**
   * Returns a list of already parsed context notes.
   *
   * @param {string} context - The context to draw notes from.
   * @returns {string[]} The resulting notes, already parsed.
   */
  getContextNotesParsed(context) {
    const noteObjects = this.getContextNotes(context);

    return noteObjects.reduce((cur, o) => {
      for (let note of o.notes) {
        cur.push(TextEditor.enrichHTML(note, { rollData: o.item != null ? o.item.getRollData() : this.getRollData() }));
      }

      return cur;
    }, []);
  }

  async createEmbeddedDocuments(embeddedName, createData, options = {}) {
    let noArray = false;
    if (!(createData instanceof Array)) {
      createData = [createData];
      noArray = true;
    }

    return super.createEmbeddedDocuments(embeddedName, noArray ? createData[0] : createData, options);
  }

  /**
   * @typedef {object} MobilityPenaltyResult
   * @property {number|null} maxDexBonus - The maximum dexterity bonus allowed for this result.
   * @property {number} acp - The armor check penalty of this result.
   */

  /**
   * Computes encumbrance values for this actor.
   *
   * @returns {MobilityPenaltyResult} The resulting penalties from encumbrance.
   */
  _computeEncumbrance() {
    const carry = this.getCarryCapacity();
    setProperty(this.data, "data.attributes.encumbrance.levels.light", carry.light);
    setProperty(this.data, "data.attributes.encumbrance.levels.medium", carry.medium);
    setProperty(this.data, "data.attributes.encumbrance.levels.heavy", carry.heavy);
    setProperty(this.data, "data.attributes.encumbrance.levels.carry", carry.heavy * 2);
    setProperty(this.data, "data.attributes.encumbrance.levels.drag", carry.heavy * 5);

    const carriedWeight = Math.max(0, this.getCarriedWeight());
    setProperty(this.data, "data.attributes.encumbrance.carriedWeight", Math.round(carriedWeight * 10) / 10);

    // Determine load level
    let encLevel = 0;
    if (carriedWeight > 0) {
      if (carriedWeight > this.data.data.attributes.encumbrance.levels.light) encLevel++;
      if (carriedWeight > this.data.data.attributes.encumbrance.levels.medium) encLevel++;
    }
    setProperty(this.data, "data.attributes.encumbrance.level", encLevel);

    let result = {
      maxDexBonus: null,
      acp: 0,
    };

    switch (getProperty(this.data, "data.attributes.encumbrance.level")) {
      case 1:
        result.acp = 3;
        result.maxDexBonus = 3;
        break;
      case 2:
        result.acp = 6;
        result.maxDexBonus = 1;
        break;
    }

    return result;
  }

  _calculateCoinWeight() {
    const coinWeightDivisor = game.settings.get("pf1", "coinWeight");
    if (!coinWeightDivisor) return 0;
    return (
      Object.values(this.data.data.currency).reduce((cur, amount) => {
        return cur + amount;
      }, 0) / coinWeightDivisor
    );
  }

  getCarryCapacity() {
    // Determine carrying capacity
    const carryStr = this.data.data.abilities.str.total + this.data.data.abilities.str.carryBonus;
    let carryMultiplier = this.data.data.abilities.str.carryMultiplier;
    const size = this.data.data.traits.size;
    if (this.data.data.attributes.quadruped) carryMultiplier *= CONFIG.PF1.encumbranceMultipliers.quadruped[size];
    else carryMultiplier *= CONFIG.PF1.encumbranceMultipliers.normal[size];
    const table = CONFIG.PF1.encumbranceLoads;

    let heavy = Math.floor(table[carryStr] * carryMultiplier);
    if (carryStr >= table.length) {
      heavy = Math.floor(table[table.length - 1] * (1 + 0.3 * (carryStr - (table.length - 1))));
    }
    // Convert to world unit system
    heavy = convertWeight(heavy);

    return {
      light: Math.floor(heavy / 3),
      medium: Math.floor((heavy / 3) * 2),
      heavy: heavy,
    };
  }

  getCarriedWeight() {
    // Determine carried weight
    const physicalItems = this.items.filter((o) => {
      return o.data.data.weight != null;
    });
    const weight = physicalItems.reduce((cur, o) => {
      if (!o.data.data.carried) return cur;
      return cur + o.data.data.weight * o.data.data.quantity;
    }, this._calculateCoinWeight());

    return convertWeight(weight);
  }

  /**
   * @returns {number} The total amount of currency this actor has, in gold pieces
   */
  mergeCurrency() {
    return this.getTotalCurrency("currency") + this.getTotalCurrency("altCurrency");
  }

  getTotalCurrency(category = "currency") {
    const currencies = getProperty(this.data.data, category);
    return (currencies.pp * 1000 + currencies.gp * 100 + currencies.sp * 10 + currencies.cp) / 100;
  }

  /**
   * Converts currencies of the given category to the given currency type
   *
   * @param {string} category - Either 'currency' or 'altCurrency'.
   * @param {string} type - Either 'pp', 'gp', 'sp' or 'cp'. Converts as much currency as possible to this type.
   */
  convertCurrency(category = "currency", type = "pp") {
    const totalValue =
      category === "currency" ? this.getTotalCurrency("currency") : this.getTotalCurrency("altCurrency");
    let values = [0, 0, 0, 0];
    switch (type) {
      case "pp":
        values[0] = Math.floor(totalValue / 10);
        values[1] = Math.max(0, Math.floor(totalValue) - values[0] * 10);
        values[2] = Math.max(0, Math.floor(totalValue * 10) - values[0] * 100 - values[1] * 10);
        values[3] = Math.max(0, Math.floor(totalValue * 100) - values[0] * 1000 - values[1] * 100 - values[2] * 10);
        break;
      case "gp":
        values[1] = Math.floor(totalValue);
        values[2] = Math.max(0, Math.floor(totalValue * 10) - values[1] * 10);
        values[3] = Math.max(0, Math.floor(totalValue * 100) - values[1] * 100 - values[2] * 10);
        break;
      case "sp":
        values[2] = Math.floor(totalValue * 10);
        values[3] = Math.max(0, Math.floor(totalValue * 100) - values[2] * 10);
        break;
      case "cp":
        values[3] = Math.floor(totalValue * 100);
        break;
    }

    const updateData = {};
    updateData[`data.${category}.pp`] = values[0];
    updateData[`data.${category}.gp`] = values[1];
    updateData[`data.${category}.sp`] = values[2];
    updateData[`data.${category}.cp`] = values[3];
    return this.update(updateData);
  }

  /**
   * Import a new owned Item from a compendium collection
   * The imported Item is then added to the Actor as an owned item.
   *
   * @param collection {String}     The name of the pack from which to import
   * @param entryId {String}        The ID of the compendium entry to import
   */
  importItemFromCollection(collection, entryId) {
    const pack = game.packs.find((p) => p.collection === collection);
    if (pack.metadata.entity !== "Item") return;

    return pack.getEntity(entryId).then((ent) => {
      console.log(`${vtt} | Importing Item ${ent.name} from ${collection}`);

      let data = duplicate(ent.data);
      if (this.sheet != null && this.sheet.rendered) {
        data = mergeObject(data, this.sheet.getDropData(data));
      }
      delete data._id;
      return this.createOwnedItem(data);
    });
  }

  getRollData(options = { refresh: false }) {
    let result = this.data.data;

    // Return cached data, if applicable
    let skipRefresh = !options.refresh && this._rollData;
    if (skipRefresh) {
      result = this._rollData;

      // Clear certain fields
      const clearFields = CONFIG.PF1.temporaryRollDataFields.actor;
      for (let k of clearFields) {
        const arr = k.split(".");
        const k2 = arr.slice(0, -1).join(".");
        const k3 = arr.slice(-1)[0];
        if (k2 === "") delete result[k];
        else {
          const obj = getProperty(result, k2);
          if (typeof obj === "object") delete obj[k3];
        }
      }
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
    if (skipRefresh) {
      Hooks.callAll("pf1.getRollData", this, result, false);

      return result;
    }

    /* ----------------------------- */
    /* Set the following data on a refresh
    /* ----------------------------- */
    // Set size index
    {
      const sizeChart = Object.keys(CONFIG.PF1.sizeChart);
      result.size = sizeChart.indexOf(getProperty(result, "traits.size"));
    }

    // Set class data
    const baseSavingThrows = {};
    result.classes = {};
    this.data.items
      .filter((obj) => {
        return obj.type === "class";
      })
      .forEach((cls) => {
        let tag = cls.data.data.tag;
        if (!tag) {
          if (cls.data.data["useCustomTag"] !== true) tag = createTag(cls.name);
          else return;
        }

        let healthConfig = game.settings.get("pf1", "healthConfig");
        const hasPlayerOwner = this.hasPlayerOwner;
        healthConfig =
          cls.data.data.classType === "racial"
            ? healthConfig.hitdice.Racial
            : hasPlayerOwner
            ? healthConfig.hitdice.PC
            : healthConfig.hitdice.NPC;
        const classType = cls.data.data.classType || "base";
        result.classes[tag] = {
          level: cls.data.data.level,
          name: cls.name,
          hd: cls.data.data.hd,
          bab: cls.data.data.bab,
          hp: healthConfig.auto,
          savingThrows: {
            fort: 0,
            ref: 0,
            will: 0,
          },
          fc: {
            hp: classType === "base" ? cls.data.data.fc.hp.value : 0,
            skill: classType === "base" ? cls.data.data.fc.skill.value : 0,
            alt: classType === "base" ? cls.data.data.fc.alt.value : 0,
          },
        };

        for (let k of Object.keys(result.classes[tag].savingThrows)) {
          let formula = CONFIG.PF1.classSavingThrowFormulas[classType][cls.data.data.savingThrows[k].value];
          if (formula == null) formula = "0";
          result.classes[tag].savingThrows[k] = RollPF.safeRoll(formula, { level: cls.data.data.level }).total;

          // Set base saving throws
          baseSavingThrows[k] = baseSavingThrows[k] ?? 0;
          baseSavingThrows[k] += result.classes[tag].savingThrows[k];
        }
      });

    // Add more info for formulas
    if (this.data.items) {
      result.armor = { type: 0 };
      result.shield = { type: 0 };

      // Determine equipped armor type
      const armor = this.data.items.filter(
        (o) => o.data.type === "equipment" && o.data.data.equipmentType === "armor" && o.data.data.equipped
      );
      let eqArmor = { total: Number.NEGATIVE_INFINITY, ac: 0, enh: 0 };
      for (let o of armor) {
        const subtype = o.data.data.equipmentSubtype;
        if (subtype === "lightArmor" && result.armor.type < 1) result.armor.type = 1;
        else if (subtype === "mediumArmor" && result.armor.type < 2) result.armor.type = 2;
        else if (subtype === "heavyArmor" && result.armor.type < 3) result.armor.type = 3;
        const enhAC = o.data.data.armor.enh ?? 0,
          baseAC = o.data.data.armor.value ?? 0,
          fullAC = baseAC + enhAC;
        if (eqArmor.total < fullAC) {
          eqArmor.ac = baseAC;
          eqArmor.total = fullAC;
          eqArmor.enh = enhAC;
        }
      }
      if (!Number.isFinite(eqArmor.total)) eqArmor.total = 0;
      mergeObject(result.armor, eqArmor);

      // Determine equipped shield type
      const shields = this.data.items.filter(
        (o) => o.data.type === "equipment" && o.data.data.equipmentType === "shield" && o.data.data.equipped
      );
      let eqShield = { total: Number.NEGATIVE_INFINITY, ac: 0, enh: 0 };
      for (let o of shields) {
        const subtype = o.data.data.equipmentSubtype;
        if (subtype === "other" && result.shield.type < 1) result.shield.type = 1;
        else if (subtype === "lightShield" && result.shield.type < 2) result.shield.type = 2;
        else if (subtype === "heavyShield" && result.shield.type < 3) result.shield.type = 3;
        else if (subtype === "towerShield" && result.shield.type < 4) result.shield.type = 4;
        const enhAC = o.data.data.armor.enh ?? 0,
          baseAC = o.data.data.armor.value ?? 0,
          fullAC = baseAC + enhAC;
        if (eqShield.total < fullAC) {
          eqShield.ac = baseAC;
          eqShield.total = fullAC;
          eqShield.enh = enhAC;
        }
      }
      if (!Number.isFinite(eqShield.total)) eqShield.total = 0;
      mergeObject(result.shield, eqShield);
    }

    // Add spellbook info
    const spellbooks = Object.entries(getProperty(result, "attributes.spells.spellbooks"));
    let keyedBooks = [];
    for (let [k, book] of spellbooks) {
      setProperty(result, `spells.${k}`, book);
      setProperty(result, `spells.${k}.abilityMod`, result.abilities[book.ability]?.mod ?? "");
      keyedBooks.push(k);
    }
    const aliasBooks = spellbooks.map((x) => x[1]).filter((x) => !!x.class && x.class !== "_hd");
    for (let book of aliasBooks) {
      if (!keyedBooks.includes(book.class)) {
        setProperty(result, `spells.${book.class}`, book);
        keyedBooks.push(book.class);
      }
    }

    // Add item dictionary flags
    if (this.itemFlags) result.dFlags = this.itemFlags.dictionary;

    // Add range info
    result.range = this.constructor.getReach(this.data.data.traits.size, this.data.data.traits.stature);

    this._rollData = result;

    // Call hook
    Hooks.callAll("pf1.getRollData", this, result, true);

    return result;
  }

  static getReach(size = "med", stature = "tall") {
    let result = {
      melee: 5,
      reach: 10,
    };

    switch (size) {
      case "fine":
      case "dim":
        result.melee = 0;
        result.reach = 0;
        break;
      case "tiny":
        result.melee = 0;
        result.reach = 5;
        break;
      case "lg":
        if (stature === "tall") {
          result.melee = 10;
          result.reach = 20;
        }
        break;
      case "huge":
        if (stature === "tall") {
          result.melee = 15;
          result.reach = 30;
        } else {
          result.melee = 10;
          result.reach = 20;
        }
        break;
      case "grg":
        if (stature === "tall") {
          result.melee = 20;
          result.reach = 40;
        } else {
          result.melee = 15;
          result.reach = 30;
        }
        break;
      case "col":
        if (stature === "tall") {
          result.melee = 30;
          result.reach = 60;
        } else {
          result.melee = 20;
          result.reach = 40;
        }
        break;
    }

    return result;
  }

  getCR() {
    if (this.data.type !== "npc") return 0;
    const data = this.data.data;

    const base = data.details.cr.base;
    if (this.items == null) return base;

    // Gather CR from templates
    const templates = this.items.filter(
      (o) => o.type === "feat" && o.data.data.featType === "template" && !o.data.data.disabled
    );
    return templates.reduce((cur, o) => {
      const crOffset = o.data.data.crOffset;
      if (typeof crOffset === "string" && crOffset.length)
        cur += RollPF.safeRoll(crOffset, this.getRollData(data)).total;
      return cur;
    }, base);
  }

  async deleteEmbeddedEntity(embeddedName, data, options = {}) {
    if (embeddedName === "Item") {
      if (!(data instanceof Array)) data = [data];

      // Add children to list of items to be deleted
      const _addChildren = async function (id) {
        const item = this.items.find((o) => o._id === id);
        const children = await item.getLinkedItems("children");
        for (let child of children) {
          if (!data.includes(child._id)) {
            data.push(child._id);
            await _addChildren.call(this, child._id);
          }
        }
      };
      for (let id of data) {
        await _addChildren.call(this, id);
      }

      // Remove links to this item (and child items)
      for (const id of data) {
        for (const i of this.items) {
          await i.removeItemLink(id);
        }
      }
    }

    super.deleteEmbeddedEntity(embeddedName, data, options);
  }

  getQuickActions() {
    const actualChargeCost = (i) => (i != null ? Math.floor(i.charges / i.chargeCost) : 0),
      actualMaxCharge = (i) => (i != null ? Math.floor(i.maxCharges / i.chargeCost) : 0);
    return this.items
      .filter(
        (o) =>
          (o.data.type === "attack" || o.data.type === "spell" || (o.data.type === "feat" && !o.data.data.disabled)) &&
          getProperty(o.data, "data.showInQuickbar") === true
      )
      .sort((a, b) => {
        return a.data.data.sort - b.data.data.sort;
      })
      .map((o) => {
        return {
          item: o,
          get haveAnyCharges() {
            return (this.item.isCharged && this.item.chargeCost !== 0) || this.hasAmmo;
          },
          maxCharge: o.isCharged ? actualMaxCharge(o) : 0,
          get charges() {
            return this.item.isCharged
              ? this.recharging
                ? -this.item.chargeCost
                : actualChargeCost(this.item)
              : this.ammoValue;
          },
          hasAmmo: o.data.data.links?.ammunition?.length > 0 ?? false,
          ammoValue:
            o.data.data.links?.ammunition
              ?.map((l) => this.items.get(l.id))
              .filter((l) => l != null)
              .map((l) => actualChargeCost(l))
              .reduce((a, b) => a + b, 0) ?? 0,
          recharging: o.isCharged && o.chargeCost < 0,
          color1: ItemPF.getTypeColor(o.type, 0),
          color2: ItemPF.getTypeColor(o.type, 1),
        };
      });
  }

  async toggleConditionStatusIcons() {
    if (this._runningFunctions["toggleConditionStatusIcons"]) return;
    this._runningFunctions["toggleConditionStatusIcons"] = {};

    const tokens = this.token ? [this.token] : this.getActiveTokens().filter((o) => o != null);
    const buffTextures = this._calcBuffTextures();

    for (let t of tokens) {
      // const isLinkedToken = getProperty(this.data, "token.actorLink");
      const actor = t.actor ? t.actor : this;
      if (!actor.testUserPermission(game.user, "OWNER")) continue;
      const fx = [...actor.effects];

      // Create and delete buff ActiveEffects
      let toCreate = [];
      let toDelete = [];
      for (let [id, obj] of Object.entries(buffTextures)) {
        const existing = fx.find((f) => f.data.origin === id);
        if (obj.active && !existing) toCreate.push(obj.item.getRawEffectData());
        else if (!obj.active && existing) toDelete.push(existing.id);
      }

      // Create and delete condition ActiveEffects
      for (let k of Object.keys(CONFIG.PF1.conditions)) {
        const idx = fx.findIndex((e) => e.getFlag("core", "statusId") === k);
        const hasCondition = actor.data.data.attributes.conditions[k] === true;
        const hasEffectIcon = idx >= 0;
        const obj = t.object ?? t;

        if (hasCondition && !hasEffectIcon) {
          toCreate.push({
            "flags.core.statusId": k,
            name: CONFIG.PF1.conditions[k],
            icon: CONFIG.PF1.conditionTextures[k],
          });
        } else if (!hasCondition && hasEffectIcon) {
          const removeEffects = fx.filter((e) => e.getFlag("core", "statusId") === k);
          toDelete.push(...removeEffects.map((e) => e.id));
        }
      }

      if (toDelete.length) await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
      if (toCreate.length) await actor.createEmbeddedDocuments("ActiveEffect", toCreate);
    }
    delete this._runningFunctions["toggleConditionStatusIcons"];
  }

  // @Object { id: { title: String, type: buff/string, img: imgPath, active: true/false }, ... }
  _calcBuffTextures() {
    const buffs = this.items.filter((o) => o.type === "buff");
    return buffs.reduce((acc, cur) => {
      const id = cur.uuid;
      if (cur.data.data.hideFromToken) return acc;

      if (!acc[id]) acc[id] = { id: cur.id, label: cur.name, icon: cur.data.img, item: cur };
      if (cur.data.data.active) acc[id].active = true;
      else acc[id].active = false;
      return acc;
    }, {});
  }

  refreshAbilityModifiers() {
    for (let k of Object.keys(this.data.data.abilities)) {
      const total = getProperty(this.data, `data.abilities.${k}.total`);
      if (total == null) {
        setProperty(this.data, `data.abilities.${k}.mod`, 0);
      } else {
        const penalty = Math.abs(getProperty(this.data, `data.abilities.${k}.penalty`) || 0);
        const damage = getProperty(this.data, `data.abilities.${k}.damage`);
        const newMod = Math.max(-5, Math.floor((total - 10) / 2) - Math.floor(penalty / 2) - Math.floor(damage / 2));
        setProperty(this.data, `data.abilities.${k}.mod`, newMod);

        // Store previous ability score
        if (!game.pf1.isMigrating && this._initialized && this._prevAbilityScores) {
          const prevMod = this._prevAbilityScores?.[k].mod ?? 0;
          const diffMod = newMod - prevMod;
          const result = getProperty(this.data, `data.abilities.${k}.mod`) + diffMod;

          setProperty(this._prevAbilityScores, `${k}.total`, total);
          setProperty(this._prevAbilityScores, `${k}.mod`, result);
        }
      }
    }
  }

  importFromJSON(json) {
    // Set _initialized flag to prevent faults (such as HP changing incorrectly)
    this._initialized = false;

    // Import from JSON
    const data = JSON.parse(json);
    delete data._id;
    data.effects = [];

    // Update data
    this.data.update(data, { recursive: false });
    return this.update(data, { diff: false, recursive: false });
  }

  /**
   * @typdef MaxAndValue
   * @type {object}
   * @property {number} max - The maximum value.
   * @property {number} value - The current value.
   *
   * @returns {MaxAndValue} An object with a property `value` which refers to the current used feats, and `max` which refers to the maximum available feats.
   */
  getFeatCount() {
    const result = { max: 0, value: 0 };
    result.value = this.items.filter((o) => {
      return o.type === "feat" && o.data.data.featType === "feat" && !o.data.data.disabled;
    }).length;

    // Add feat count by level
    const totalLevels = this.items
      .filter((o) => o.type === "class" && ["base", "npc", "prestige", "racial"].includes(o.data.data.classType))
      .reduce((cur, o) => {
        return cur + o.data.data.level;
      }, 0);
    result.max += Math.ceil(totalLevels / 2);

    // Bonus feat formula
    const featCountRoll = RollPF.safeRoll(this.data.data.details.bonusFeatFormula || "0", this.getRollData());
    result.max += featCountRoll.total;
    if (featCountRoll.err) {
      const msg = game.i18n
        .localize("PF1.ErrorActorFormula")
        .format(game.i18n.localize("PF1.BonusFeatFormula"), this.actor.name);
      console.error(msg);
      ui.notifications.error(msg);
    }

    // Changes
    this.changes
      .filter((o) => o.subTarget === "bonusFeats")
      .forEach((o) => {
        if (!o.value) return;

        result.max += o.value;
      });

    return result;
  }

  /**
   * @param {string} flagName - The name/key of the flag to search for.
   * @returns {boolean} Whether this actor has any owned item with the given flag.
   */
  hasItemBooleanFlag(flagName) {
    return getProperty(this, `itemFlags.boolean.${flagName}`) != null;
  }

  async performRest({ restoreHealth = true, longTermCare = false, restoreDailyUses = true, hours = 8 } = {}) {
    const actorData = this.data.data;

    const updateData = {};
    // Restore health and ability damage
    if (restoreHealth === true) {
      const hd = actorData.attributes.hd.total;
      let heal = {
        hp: hd,
        abl: 1,
        nonlethal: hours * hd,
      };
      if (longTermCare === true) {
        heal.hp *= 2;
        heal.abl *= 2;
      }

      updateData["data.attributes.hp.value"] = Math.min(
        actorData.attributes.hp.value + heal.hp,
        actorData.attributes.hp.max
      );
      updateData["data.attributes.hp.nonlethal"] = Math.max(
        0,
        (actorData.attributes.hp.nonlethal || 0) - heal.nonlethal
      );
      for (let [key, abl] of Object.entries(actorData.abilities)) {
        let dmg = Math.abs(abl.damage);
        updateData[`data.abilities.${key}.damage`] = Math.max(0, dmg - heal.abl);
      }
    }

    let itemUpdates = [];
    let spellbookUses = {};
    // Restore daily uses of spells, feats, etc.
    if (restoreDailyUses === true) {
      // Update spellbooks
      for (let [sbKey, sb] of Object.entries(getProperty(actorData, `attributes.spells.spellbooks`) || {})) {
        for (let a = 0; a < 10; a++) {
          updateData[`data.attributes.spells.spellbooks.${sbKey}.spells.spell${a}.value`] =
            getProperty(sb, `spells.spell${a}.max`) || 0;
        }
      }

      // Update charged items
      for (let item of this.items) {
        let itemUpdate = { _id: item.id };
        const itemData = item.data.data;

        if (itemData.uses && itemData.uses.per === "day" && itemData.uses.value !== itemData.uses.max) {
          itemUpdate["data.uses.value"] = itemData.uses.max;
          itemUpdates.push(itemUpdate);
        } else if (item.type === "spell") {
          const spellbook = getProperty(actorData, `attributes.spells.spellbooks.${itemData.spellbook}`),
            isSpontaneous = spellbook.spontaneous;
          if (!isSpontaneous) {
            if (itemData.preparation.preparedAmount < itemData.preparation.maxAmount) {
              itemUpdate["data.preparation.preparedAmount"] = itemData.preparation.maxAmount;
              itemUpdates.push(itemUpdate);
            }
            if (!getProperty(item.data, "data.domain")) {
              let sbUses =
                updateData[
                  `data.attributes.spells.spellbooks.${itemData.spellbook}.spells.spell${itemData.level}.value`
                ] || 0;
              sbUses -= itemData.preparation.maxAmount;
              updateData[
                `data.attributes.spells.spellbooks.${itemData.spellbook}.spells.spell${itemData.level}.value`
              ] = sbUses;
            }
          }
        }
      }

      for (let [key, spellbook] of Object.entries(actorData.attributes.spells.spellbooks)) {
        // Restore spellbooks using spell points
        if (spellbook.spellPoints.useSystem) {
          // Try to roll restoreFormula, fall back to restoring max spell points
          let restorePoints = spellbook.spellPoints.max;
          if (spellbook.spellPoints.restoreFormula) {
            const restoreRoll = RollPF.safeRoll(spellbook.spellPoints.restoreFormula, this.getRollData());
            if (restoreRoll.err) console.error(restoreRoll.err, spellbook.spellPoints.restoreFormula);
            else restorePoints = Math.min(spellbook.spellPoints.value + restoreRoll.total, spellbook.spellPoints.max);
          }
          updateData[`data.attributes.spells.spellbooks.${key}.spellPoints.value`] = restorePoints;
        }
      }
    }

    const proceed = Hooks.call(
      "actorRest",
      this,
      {
        restoreHealth,
        longTermCare,
        restoreDailyUses,
        hours,
      },
      updateData,
      itemUpdates
    );
    if (proceed === false) return false;

    await this.updateEmbeddedDocuments("Item", itemUpdates);
    return this.update(updateData);
  }

  _trackPreviousAttributes() {
    // Track HP, Wounds and Vigor
    this._prevAttributes = this._prevAttributes || {};
    for (const k of ["data.attributes.hp", "data.attributes.wounds", "data.attributes.vigor"]) {
      const max = getProperty(this.data, `${k}.max`);
      if (this._prevAttributes[k] != null) continue;
      this._prevAttributes[k] = max;
    }

    // Track ability scores
    this._prevAbilityScores = this._prevAbilityScores || {};
    for (const k of Object.keys(this.data.data.abilities)) {
      this._prevAbilityScores[k] = {
        total: this.data.data.abilities[k].total,
        mod: this.data.data.abilities[k].mod,
      };
    }
  }

  _applyPreviousAttributes() {
    if (!game.pf1.isMigrating && this._initialized) {
      // Apply HP, Wounds and Vigor
      if (this._prevAttributes) {
        for (const [k, prevMax] of Object.entries(this._prevAttributes)) {
          if (prevMax == null) continue;
          const newMax = getProperty(this.data, `${k}.max`) || 0;
          const prevValue = getProperty(this.data, `${k}.value`);
          const newValue = prevValue + (newMax - prevMax);
          // if (k === "data.attributes.hp") console.log(prevMax, newMax, prevValue, newValue);
          if (prevValue !== newValue) this._queuedUpdates[`${k}.value`] = newValue;
        }
      }
      this._prevAttributes = null;

      // Clear previous ability score tracking
      this._prevAbilityScores = null;
    }
  }
}
