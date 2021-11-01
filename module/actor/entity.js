import { DicePF } from "../dice.js";
import { ItemPF } from "../item/entity.js";
import { createTag, convertDistance, convertWeight, enrichHTMLUnrolled } from "../lib.js";
import { createCustomChatMessage } from "../chat.js";
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
 * Extend the base Actor class to implement additional game system logic.
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

    /**
     * @property {object} _states
     * Tracks various states which need to be tracked.
     */
    if (this._states === undefined) this._states = {};
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
      for (const a of actors) {
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
      const entry = await pack.getDocument(entryId);
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
    const result = [];
    for (const t of canvas.tokens.controlled) {
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
    const skills = [];
    const subSkills = [];
    for (const [sklKey, skl] of Object.entries(this.data.data.skills)) {
      if (skl == null) continue;
      if (skl.subSkills != null) {
        for (const subSklKey of Object.keys(skl.subSkills)) {
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
      const nonGM = game.users.contents.filter((u) => !u.isGM);
      return nonGM.some((u) => {
        if (data.permission["default"] >= CONST.ENTITY_PERMISSIONS["OWNER"]) return true;
        return data.permission[u._id] >= CONST.ENTITY_PERMISSIONS["OWNER"];
      });
    }
    const hasPlayerOwner = this.hasPlayerOwner;
    return hasPlayerOwner;
  }

  _prepareContainerItems(items) {
    const collection = [];

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
    const bFlags = {};
    const dFlags = {};

    for (const i of items) {
      // Process boolean flags
      if (i.isActive) {
        const flags = getProperty(i.data, "data.flags.boolean") || [];
        for (const f of flags) {
          bFlags[f] = bFlags[f] || { sources: [] };
          bFlags[f].sources.push(i);
        }
      }

      // Process dictionary flags
      if (i.data.data.tag) {
        const flags = getProperty(i.data, "data.flags.dictionary") || [];
        for (const f of flags) {
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

    const changes = [];
    for (const i of this.changeItems) {
      changes.push(...i.changes);
    }
    addDefaultChanges.call(this, changes);

    const c = new Collection();
    for (const e of changes) {
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

  /**
   * Deletes expired temporary active effects and disables linked expired buffs.
   */
  async expireActiveEffects() {
    const temporaryEffects = this.temporaryEffects.filter(
      (ae) => Number.isFinite(ae.duration?.remaining) && ae.duration?.remaining <= 0
    );
    const toDelete = [],
      toDisable = [];
    for (const ae of temporaryEffects) {
      const re = ae.data.origin?.match(/Item\.(?<itemId>\w+)/);
      const item = this.items.get(re?.groups.itemId);
      if (!item || item.type !== "buff") {
        toDelete.push(ae.id);
      } else {
        toDisable.push({ _id: item.id, "data.active": false });
      }
    }
    if (toDelete.length) await this.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    if (toDisable.length) await this.updateEmbeddedDocuments("Item", toDisable);
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
    this.data.data.details.level.value = level;

    const mythicTier = classes
      .filter((o) => o.data.data.classType === "mythic")
      .reduce((cur, o) => cur + o.data.data.level, 0);
    this.data.data.details.mythicTier = mythicTier;

    // Populate conditions
    for (const condition of Object.keys(CONFIG.PF1.conditions)) {
      this.data.data.attributes.conditions[condition] ??= false;
    }

    // The following is not for NPCs
    if (this.data.type === "character") {
      const maxExp = this.getLevelExp(level);
      this.data.data.details.xp.max = maxExp;
    }

    // The following IS for NPCs
    else if (this.data.type === "npc") {
      this.data.data.details.cr.total = this.getCR(this.data.data);
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
                );
                const hasInfo = !!sInfo;
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
          this.data.data.traits[prof].total = [...proficiencies];
          this.data.data.traits[prof].customTotal = customProficiencies.join(";");
        }

        // Add .total getter for languages
        if (this.data.data.traits.languages.total === undefined) {
          Object.defineProperty(this.data.data.traits.languages, "total", {
            get: function () {
              return [
                ...this.value,
                ...this.custom
                  .split(";")
                  .map((l) => l?.trim())
                  .filter((l) => !!l),
              ];
            },
          });
        }
      }
    }

    // Refresh ability scores
    {
      const abs = Object.keys(this.data.data.abilities);
      for (const ab of abs) {
        const value = this.data.data.abilities[ab].value;
        if (value == null) {
          this.data.data.abilities[ab].total = null;
          this.data.data.abilities[ab].base = null;
          this.data.data.abilities[ab].baseMod = 0;
        } else {
          this.data.data.abilities[ab].total = value - this.data.data.abilities[ab].drain;
          this.data.data.abilities[ab].penalty =
            (this.data.data.abilities[ab].penalty || 0) + (this.data.data.abilities[ab].userPenalty || 0);
          this.data.data.abilities[ab].base = this.data.data.abilities[ab].total;
        }
      }
      this.refreshAbilityModifiers();
    }

    // Reset BAB
    {
      const useFractionalBaseBonuses = game.settings.get("pf1", "useFractionalBaseBonuses") === true;
      const k = "data.attributes.bab.total";
      if (useFractionalBaseBonuses) {
        const v = Math.floor(
          classes.reduce((cur, obj) => {
            const babScale = getProperty(obj, "data.data.bab") || "";
            if (babScale === "high") return cur + obj.data.data.level;
            if (babScale === "med") return cur + obj.data.data.level * 0.75;
            if (babScale === "low") return cur + obj.data.data.level * 0.5;
            return cur;
          }, 0)
        );
        this.data.data.attributes.bab.total = v;

        if (v !== 0) {
          getSourceInfo(this.sourceInfo, k).positive.push({
            name: game.i18n.localize("PF1.Base"),
            value: v,
          });
        }
      } else {
        this.data.data.attributes.bab.total = classes.reduce((cur, obj) => {
          const v = RollPF.safeRoll(CONFIG.PF1.classBABFormulas[obj.data.data.bab], { level: obj.data.data.level })
            .total;

          if (v !== 0) {
            getSourceInfo(this.sourceInfo, k).positive.push({
              name: obj.name ?? "",
              value: v,
            });
          }

          return cur + v;
        }, 0);
      }
    }

    // Prepare Character data
    if (this.data.type === "character") this._prepareCharacterData(this.data.data);
    else if (this.data.type === "npc") this._prepareNPCData(this.data.data);

    // Reset HD
    setProperty(this.data, "data.attributes.hd.total", this.data.data.details.level.value);

    // Apply ACP and Max Dexterity Bonus
    this._applyArmorPenalties();

    // Reset class skills
    for (const [k, s] of Object.entries(this.data.data.skills)) {
      if (!s) continue;
      const isClassSkill = classes.reduce((cur, o) => {
        if ((o.data.data.classSkills || {})[k] === true) return true;
        return cur;
      }, false);
      this.data.data.skills[k].cs = isClassSkill;
      for (const k2 of Object.keys(s.subSkills ?? {})) {
        setProperty(s, `subSkills.${k2}.cs`, isClassSkill);
      }
    }

    this.updateSpellbookInfo();

    // Add base initiative (for NPC Lite sheets)
    this.data.data.attributes.init.total = this.data.data.attributes.init.value;
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
    for (const [spellbookKey, spellbook] of Object.entries(this.data.data.attributes.spells.spellbooks)) {
      const spellbookAbility = this.data.data.abilities[spellbook.ability];
      let spellbookAbilityScore = spellbookAbility?.total ?? 10;

      // Add spell slots based on ability bonus slot formula
      {
        const formula = spellbook.spellSlotAbilityBonusFormula || "0";
        spellbookAbilityScore += RollPF.safeRoll(formula, rollData).total;
      }

      const spellbookAbilityMod = Math.floor((spellbookAbilityScore - 10) / 2);

      // Set CL
      let clTotal = 0;
      {
        const key = `data.attributes.spells.spellbooks.${spellbookKey}.cl.total`;
        const formula = spellbook.cl.formula || "0";
        let total = 0;

        // Add NPC base
        if (this.data.type === "npc") {
          const value = spellbook.cl.base || 0;
          total += value;
          clTotal += value;
          getSourceInfo(this.sourceInfo, key).positive.push({ name: game.i18n.localize("PF1.Base"), value: value });
        }
        // Add HD
        if (spellbook.class === "_hd") {
          const value = this.data.data.attributes.hd.total;
          total += value;
          clTotal += value;
          setSourceInfoByName(this.sourceInfo, key, game.i18n.localize("PF1.HitDie"), value);
        }
        // Add class levels
        else if (spellbook.class && rollData.classes[spellbook.class]) {
          const value = rollData.classes[spellbook.class].level;
          total += value;
          clTotal += value;

          setSourceInfoByName(this.sourceInfo, key, rollData.classes[spellbook.class].name, value);
        }

        // set auto spell level calculation offset
        if (spellbook.autoSpellLevelCalculation) {
          const autoFormula = spellbook.cl.autoSpellLevelCalculationFormula || "0";
          const autoBonus = RollPF.safeTotal(autoFormula, rollData);
          const autoTotal = Math.max(1, Math.min(20, total + autoBonus));
          spellbook.cl.autoSpellLevelTotal = autoTotal;

          clTotal += autoBonus;
          if (autoBonus !== 0) {
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
        clTotal += clBonus;
        if (clBonus > 0) {
          setSourceInfoByName(this.sourceInfo, key, game.i18n.localize("PF1.CasterLevelBonusFormula"), clBonus);
        } else if (clBonus < 0) {
          setSourceInfoByName(this.sourceInfo, key, game.i18n.localize("PF1.CasterLevelBonusFormula"), clBonus, false);
        }

        if (rollData.attributes.woundThresholds.penalty != null) {
          // Subtract Wound Thresholds penalty. Can't reduce below 1.
          if (rollData.attributes.woundThresholds.penalty > 0 && clTotal > 1) {
            clTotal = Math.max(1, clTotal - rollData.attributes.woundThresholds.penalty);
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
          clTotal = Math.max(0, clTotal - rollData.attributes.energyDrain);
          setSourceInfoByName(
            this.sourceInfo,
            key,
            game.i18n.localize("PF1.CondTypeEnergyDrain"),
            -Math.abs(rollData.attributes.energyDrain),
            false
          );
        }

        setProperty(this.data, key, clTotal);
      }

      // Set concentration bonus
      {
        // Temp fix for old actors that fail migration
        {
          const v = this.data.data.attributes.spells.spellbooks[spellbookKey].concentration;
          if (Number.isFinite(v)) this.data.data.attributes.spells.spellbooks[spellbookKey].concentration = {};
        }

        const concFormula = this.data.data.attributes.spells.spellbooks[spellbookKey].concentrationFormula;
        let formulaRoll = 0;
        if (concFormula.length) formulaRoll = RollPF.safeRoll(spellbook.concentrationFormula, rollData).total;

        const concentration = clTotal + spellbookAbilityMod + formulaRoll - rollData.attributes.energyDrain;
        this.data.data.attributes.spells.spellbooks[spellbookKey].concentration = {
          total: concentration,
        };
      }

      const getAbilityBonus = (a) =>
        a !== 0 && typeof spellbookAbilityMod === "number" ? ActorPF.getSpellSlotIncrease(spellbookAbilityMod, a) : 0;
      // Spell slots
      {
        const useAuto = spellbook.autoSpellLevelCalculation;
        if (useAuto) {
          let spellPrepMode = spellbook.spellPreparationMode;
          if (!spellPrepMode) {
            spellPrepMode = "spontaneous";
            spellbook.spellPreparationMode = spellPrepMode;
          }

          // turn off spell points
          spellbook.spellPoints.useSystem = false;

          // set base "spontaneous" based on spell prep mode
          if (spellPrepMode === "hybrid" || spellPrepMode === "prestige" || spellPrepMode === "spontaneous") {
            spellbook.spontaneous = true;
          } else {
            spellbook.spontaneous = false;
          }

          let casterType = spellbook.casterType;
          if (!casterType || (spellPrepMode === "hybrid" && casterType !== "high")) {
            casterType = "high";
            spellbook.casterType = casterType;
          }
          if (spellPrepMode === "prestige" && casterType !== "low") {
            casterType = "low";
            spellbook.casterType = casterType;
          }

          const castsForLevels =
            CONFIG.PF1.casterProgression[spellbook.spontaneous ? "castsPerDay" : "spellsPreparedPerDay"][spellPrepMode][
              casterType
            ];
          const classLevel = Math.max(Math.min(spellbook.cl.autoSpellLevelTotal, 20), 1);
          rollData.ablMod = spellbookAbilityMod;

          const allLevelModFormula =
            spellbook[spellbook.spontaneous ? "castPerDayAllOffsetFormula" : "preparedAllOffsetFormula"] || "0";
          const allLevelMod = RollPF.safeTotal(allLevelModFormula, rollData);

          for (let a = 0; a < 10; a++) {
            const spellLevel = spellbook.spells[`spell${a}`];
            // 0 is special because it doesn't get bonus preps and can cast them indefinitely so can't use the "cast per day" value
            const spellsForLevel =
              a === 0 && spellbook.spontaneous
                ? CONFIG.PF1.casterProgression.spellsPreparedPerDay[spellPrepMode][casterType][classLevel - 1][a]
                : castsForLevels[classLevel - 1][a];
            spellLevel.base = spellsForLevel;

            const offsetFormula =
              spellLevel[spellbook.spontaneous ? "castPerDayOffsetFormula" : "preparedOffsetFormula"] || "0";

            const max =
              typeof spellsForLevel === "number" || (a === 0 && spellbook.hasCantrips)
                ? spellsForLevel + getAbilityBonus(a) + allLevelMod + RollPF.safeTotal(offsetFormula, rollData)
                : null;

            spellLevel.max = max;
            if (!Number.isFinite(spellLevel.value)) spellLevel.value = max;
          }
        } else {
          for (let a = 0; a < 10; a++) {
            const spellLevel = spellbook.spells[`spell${a}`];
            let base = parseInt(spellLevel.base);
            if (Number.isNaN(base)) {
              spellLevel.base = null;
              spellLevel.max = 0;
            } else if (spellbook.autoSpellLevels) {
              base += getAbilityBonus(a);
              spellLevel.max = base;
            } else {
              spellLevel.max = base;
            }

            const max = spellLevel.max;
            const oldval = spellLevel.value;
            if (!Number.isFinite(oldval)) spellLevel.value = max;
          }
        }
      }

      // Set spontaneous spell slots to something sane
      {
        for (let a = 0; a < 10; a++) {
          const spellLevel = spellbook.spells[`spell${a}`];
          const current = spellLevel.value;
          spellLevel.value = current || 0;
        }
      }

      // Update spellbook slots
      {
        const slots = [];
        for (let a = 0; a < 10; a++) {
          const spellLevel = spellbook.spells[`spell${a}`];
          const currentLevel = {};
          currentLevel.value = spellLevel.max;
          currentLevel.domainSlots = spellbook.domainSlotValue;
          slots.push(currentLevel);
        }

        const spells = this.items.filter((o) => o.type === "spell" && o.data.data.spellbook === spellbookKey);
        if (!spellbook.spontaneous) {
          for (const i of spells) {
            const isDomain = i.data.data.domain === true;
            const a = i.data.data.level;
            const slotCost = i.data.data.slotCost ?? 1;
            let dSlots = slots[a].domainSlots;
            let uses = slots[a].value;
            if (Number.isFinite(i.maxCharges)) {
              const subtract = { domain: 0, uses: 0 };
              if (isDomain) {
                subtract.domain = Math.min(i.maxCharges, dSlots);
                subtract.uses = (i.maxCharges - subtract.domain) * slotCost;
              } else {
                subtract.uses = i.maxCharges * slotCost;
              }
              dSlots -= subtract.domain;
              uses -= subtract.uses;
            }
            slots[a].value = uses;
            slots[a].domainSlots = dSlots;
            spellbook.spells[`spell${a}`].value = uses;
          }
        }

        // Spells available hint text if auto spell levels is enabled
        {
          const useAuto = spellbook.autoSpellLevelCalculation;
          if (useAuto) {
            const spellPrepMode = spellbook.spellPreparationMode;
            const casterType = spellbook.casterType || "high";
            const classLevel = Math.max(Math.min(spellbook.cl.autoSpellLevelTotal, 20), 1);

            const spellbookAbilityScore = spellbookAbility?.total;

            const allLevelModFormula = spellbook.preparedAllOffsetFormula || "0";
            const allLevelMod = RollPF.safeTotal(allLevelModFormula, rollData);

            for (let a = 0; a < 10; a++) {
              const spellLevel = spellbook.spells[`spell${a}`];
              if (!isNaN(spellbookAbilityScore) && spellbookAbilityScore - 10 < a) {
                const message = game.i18n.localize("PF1.SpellScoreTooLow");
                spellLevel.spellMessage = message;
                continue;
              }

              let remaining;
              if (spellPrepMode === "prepared") {
                // for prepared casters, just use the 'value' calculated above
                remaining = spellLevel.value;
              } else {
                // spontaneous or hybrid
                // if not prepared then base off of casts per day
                let available =
                  CONFIG.PF1.casterProgression.spellsPreparedPerDay[spellPrepMode][casterType]?.[classLevel - 1][a];
                available += allLevelMod;

                const formula = spellLevel.preparedOffsetFormula || "0";
                available += RollPF.safeTotal(formula, rollData);

                const used = spells.reduce((acc, i) => {
                  const { level, spellbook, preparation, atWill } = i.data.data;
                  return level === a && spellbook === spellbookKey && !atWill && preparation.spontaneousPrepared
                    ? ++acc
                    : acc;
                }, 0);

                remaining = available - used;
              }

              if (!remaining) {
                spellLevel.spellMessage = "";
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
                spellLevel.spellMessage = remainingMessage;
              }
            }
          }
        }
      }

      // Spell points
      {
        const formula = spellbook.spellPoints.maxFormula || "0";
        rollData.cl = spellbook.cl.total;
        rollData.ablMod = spellbookAbilityMod;
        const spellClass = spellbook.class ?? "";
        rollData.classLevel = spellClass === "_hd" ? rollData.attributes.hd.total : rollData[spellClass]?.level || 0;
        const roll = RollPF.safeRoll(formula, rollData);
        spellbook.spellPoints.max = roll.total;
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
    this.data.data.attributes.maxDexBonus = null;

    {
      // Compute encumbrance
      const encPen = this._computeEncumbrance();

      // Apply armor penalties
      const gearPen = this._applyArmorPenalties();

      // Set armor check penalty
      this.data.data.attributes.acp.encumbrance = encPen.acp;
      this.data.data.attributes.acp.gear = gearPen.acp;
      this.data.data.attributes.acp.total = Math.max(encPen.acp, gearPen.acp);

      // Set maximum dexterity bonus
      if (encPen.maxDexBonus != null || gearPen.maxDexBonus != null) {
        this.data.data.attributes.maxDexBonus = Math.min(
          encPen.maxDexBonus ?? Number.POSITIVE_INFINITY,
          gearPen.maxDexBonus ?? Number.POSITIVE_INFINITY
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

    // Prepare CMB total
    {
      const shrAtk = getProperty(this.data, "data.attributes.attack.shared") ?? 0,
        genAtk = getProperty(this.data, "data.attributes.attack.general") ?? 0,
        cmbAbl = getProperty(this.data, "data.attributes.cmbAbility"),
        cmbAblMod = getProperty(this.data, `data.abilities.${cmbAbl}.mod`) ?? 0,
        size = getProperty(this.data, "data.traits.size"),
        szCMBMod = CONFIG.PF1.sizeSpecialMods[size] ?? 0,
        cmbBonus = getProperty(this.data, "data.attributes.cmb.bonus") ?? 0,
        cmb = shrAtk + genAtk + szCMBMod + cmbBonus + cmbAblMod;
      this.data.data.attributes.cmb.total = cmb;
    }

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
    for (const k of ["hp", "vigor"]) {
      this.data.data.attributes[k].max = round(this.data.data.attributes[k].max);
    }

    // Refresh HP
    this._applyPreviousAttributes();

    // Update wound threshold
    this.updateWoundThreshold();

    // Apply wound thresholds to skills
    const woundPenalty = this.data.data.attributes.woundThresholds?.penalty ?? 0;
    if (woundPenalty) {
      for (const k of this.allSkills) {
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
      // Total
      const totalAtk =
        this.data.data.attributes.bab.total -
        this.data.data.attributes.acp.attackPenalty -
        (this.data.data.attributes.energyDrain ?? 0);
      this.data.data.attributes.attack.shared = totalAtk;
    }

    // Create arbitrary skill slots
    for (const skillId of CONFIG.PF1.arbitrarySkills) {
      if (data.skills[skillId] == null) continue;
      const skill = data.skills[skillId];
      skill.subSkills = skill.subSkills || {};
      for (const subSkillId of Object.keys(skill.subSkills)) {
        if (skill.subSkills[subSkillId] == null) delete skill.subSkills[subSkillId];
      }
    }

    // Delete removed skills
    for (const skillId of Object.keys(data.skills)) {
      const skl = data.skills[skillId];
      if (skl == null) {
        delete data.skills[skillId];
      }
    }

    // Mark background skills
    for (const skillId of Object.keys(data.skills)) {
      if (CONFIG.PF1.backgroundSkills.includes(skillId)) {
        const skill = data.skills[skillId];
        skill.background = true;
        for (const subSkillId of Object.keys(skill.subSkills ?? {})) skill.subSkills[subSkillId].background = true;
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
          this.data.data.attributes.ac[k2].total += v;
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
      const cmdDexAblMod = getProperty(this.data, `data.abilities.${cmdDexAbl}.mod`) ?? 0;
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
        this.data.data.attributes.ac[k].total += v;
        getSourceInfo(this.sourceInfo, `data.attributes.ac.${k}.total`).positive.push({
          value: v,
          name: CONFIG.PF1.abilities[acAblKey[k]],
        });
      }
      for (const [k, v] of Object.entries(cmd)) {
        this.data.data.attributes.cmd[k] += v;
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
      const sInfo = { name: "", value: game.i18n.localize("PF1.ReducedMovementSpeed") };
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
          const value = getProperty(this.data, key);
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
    const broken = { armor: { value: 0, item: null }, shield: { value: 0, item: null } };
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

        let brokenACP = 0;
        if (obj.data.data.broken) {
          brokenACP = itemACP;
          itemACP *= 2;
        }

        if (itemACP) {
          const sInfo = getSourceInfo(this.sourceInfo, "data.attributes.acp.total").negative.find(
            (o) => o.itemId === obj.id
          );

          if (brokenACP) {
            broken[eqType].value = brokenACP;
            broken[eqType].item = obj;
          }

          if (sInfo) sInfo.value = itemACP;
          else {
            getSourceInfo(this.sourceInfo, "data.attributes.acp.total").negative.push({
              name: obj.name,
              itemId: obj.id,
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
          const mDex = Number.parseInt(obj.data.data.armor.dex, 10);
          if (Number.isInteger(mDex)) {
            const mod = getProperty(this.data, `data.attributes.mDex.${eqType}Bonus`) ?? 0;
            const itemMDex = mDex + mod;
            mdex[eqType] = Math.min(itemMDex, mdex[eqType] ?? Number.POSITIVE_INFINITY);

            const sInfo = getSourceInfo(this.sourceInfo, "data.attributes.maxDexBonus").negative.find(
              (o) => o.itemId === obj.id
            );
            if (sInfo) sInfo.value = mDex;
            else {
              getSourceInfo(this.sourceInfo, "data.attributes.maxDexBonus").negative.push({
                name: obj.name,
                itemId: obj.id,
                value: mDex,
                ignoreNull: false,
              });
            }
          }
        }
      });

    // Add Broken to sources
    {
      const name = game.i18n.localize("PF1.Broken");
      for (const eqType of Object.keys(broken)) {
        const value = broken[eqType].value;
        if (value == 0) continue;
        const brokenId = broken[eqType].item.id;
        const sInfo = getSourceInfo(this.sourceInfo, `data.attributes.acp.${eqType}Bonus`).negative.find(
          (o) => o.brokenId === brokenId
        );
        if (sInfo) sInfo.value = value;
        else
          getSourceInfo(this.sourceInfo, `data.attributes.acp.${eqType}Bonus`).negative.push({
            name,
            brokenId,
            value,
          });
      }
    }

    // Return result
    const totalACP = acp.armor + acp.shield;
    const result = {
      maxDexBonus: null,
      acp: totalACP,
    };
    this.data.data.attributes.acp.gear = totalACP;
    if (mdex.armor !== null || mdex.shield !== null)
      result.maxDexBonus = Math.min(mdex.armor ?? Number.POSITIVE_INFINITY, mdex.shield ?? Number.POSITIVE_INFINITY);

    // Set armor penalty to attack rolls
    this.data.data.attributes.acp.attackPenalty = attackACPPenalty;

    return result;
  }

  prepareItemLinks() {
    if (!this.items) return;

    for (const a of this.items) {
      if (a.data.data.links == null) continue;

      for (const l of Object.keys(a.data.data.links)) {
        if (LinkFunctions[l] != null) {
          LinkFunctions[l].call(this, a, a.data.data.links[l]);
        }
      }
    }
  }

  _setSourceDetails(extraData) {
    const actorData = this.data;
    const sourceDetails = {};
    // Get empty source arrays
    for (const b of Object.keys(CONFIG.PF1.buffTargets)) {
      let buffTargets = getChangeFlat.call(this, b, null);
      if (!(buffTargets instanceof Array)) buffTargets = [buffTargets];
      for (const bt of buffTargets) {
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
    for (const [a, abl] of Object.entries(actorData.data.abilities)) {
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
          const changeFlatKeys = ["~attackCore", "cmd", "init", "allSavingThrows", "ac", "skills", "abilityChecks"];
          for (const fk of changeFlatKeys) {
            let flats = getChangeFlat.call(this, fk, "penalty", actorData.data);
            if (!(flats instanceof Array)) flats = [flats];
            for (const k of flats) {
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
    for (const [changeTarget, changeGrp] of Object.entries(extraData)) {
      for (const grp of Object.values(changeGrp)) {
        if (grp.length > 0) {
          sourceDetails[changeTarget] = sourceDetails[changeTarget] || [];
          for (const src of grp) {
            if (!src.operator) src.operator = "add";
            const srcInfo = this.constructor._translateSourceInfo(src.type, src.subtype, src.name);
            let srcValue =
              src.value != null
                ? src.value
                : RollPF.safeRoll(src.formula || "0", rollData, [changeTarget, src, this], {
                    suppressError: !this.testUserPermission(game.user, "OWNER"),
                  }).total;
            if (src.operator === "set") srcValue = game.i18n.localize("PF1.SetTo").format(srcValue);
            if (!(src.operator === "add" && srcValue === 0) || src.ignoreNull === false) {
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
      "data.attributes.bab.total": 0,
      "data.attributes.bab.value": 0,
      "data.attributes.cmd.total": 10,
      "data.attributes.cmd.flatFootedTotal": 10,
      "data.attributes.acp.armorBonus": 0,
      "data.attributes.acp.shieldBonus": 0,
      "data.attributes.acp.gear": 0,
      "data.attributes.acp.encumbrance": 0,
      "data.attributes.acp.total": 0,
      "data.attributes.acp.attackPenalty": 0,
      "data.attributes.maxDexBonus": null,
      "temp.ac.armor": 0,
      "temp.ac.shield": 0,
      "temp.ac.natural": 0,
      "data.attributes.sr.total": 0,
      "data.attributes.init.bonus": 0,
      "data.attributes.init.total": 0,
      "data.attributes.cmb.bonus": 0,
      "data.attributes.cmb.total": 0,
      "data.attributes.cmb.value": 0,
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
      "data.attributes.woundThresholds.mod": 0,
      "data.attributes.woundThresholds.override": -1,
      "data.attributes.woundThresholds.penaltyBase": 0,
      "data.attributes.woundThresholds.penalty": 0,
      "data.abilities.str.checkMod": 0,
      "data.abilities.dex.checkMod": 0,
      "data.abilities.con.checkMod": 0,
      "data.abilities.int.checkMod": 0,
      "data.abilities.wis.checkMod": 0,
      "data.abilities.cha.checkMod": 0,
      "data.attributes.spells.primary.concentration.total": 0,
      "data.attributes.spells.secondary.concentration.total": 0,
      "data.attributes.spells.tertiary.concentration.total": 0,
      "data.attributes.spells.spelllike.concentration.total": 0,
      "data.details.carryCapacity.bonus.total": 0,
      "data.details.carryCapacity.multiplier.total": 0,
    };

    // Determine skill keys
    try {
      const skillKeys = getChangeFlat.call(this, "skills", "skills");
      for (const k of skillKeys) {
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
    const prior = this.getLevelExp(this.data.data.details.level.value - 1 || 0),
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

      for (const o of sbData) {
        if (o.inUse === true && !usedSpellbooks.includes(o.spellbook)) usedSpellbooks.push(o.spellbook);
        else if (o.inUse === false && usedSpellbooks.includes(o.spellbook))
          usedSpellbooks.splice(usedSpellbooks.indexOf(o.spellbook), 1);
      }
      data["data.attributes.spells.usedSpellbooks"] = usedSpellbooks;
    }

    // Apply changes in Actor size to Token width/height
    if (data["data.traits.size"] && this.data.data.traits.size !== data["data.traits.size"]) {
      const size = CONFIG.PF1.tokenSizes[data["data.traits.size"]];
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
    for (const [k, v] of Object.entries(data)) {
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
    const diff = diffObject(flattenObject(this.data), data);

    // Diff token data
    if (data.token != null) {
      diff.token = diffObject(this.data.token, data.token);
    }

    const result = diff;
    if (!isObjectEmpty(diff) && options.skipUpdate !== true) {
      return super.update(diff, mergeObject(options, { recursive: true }));
    }
    return result;
  }

  _onUpdate(data, options, userId, context) {
    super._onUpdate(data, options, userId, context);

    if (game.user.id === userId && hasProperty(data, "data.attributes.conditions")) {
      this.toggleConditionStatusIcons();
    }

    // Resize token(s)
    {
      const sizeKey = getProperty(data, "data.traits.size");
      if (sizeKey) {
        const size = CONFIG.PF1.tokenSizes[sizeKey];
        const tokens = this.getActiveTokens(false, true).filter((o) => {
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

  _onCreateEmbeddedDocuments(embeddedName, documents, result, options, userId) {
    if (userId === game.user.id && embeddedName === "Item") {
      this.toggleConditionStatusIcons();
    }
    super._onCreateEmbeddedDocuments(...arguments);
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
    // Work around the issue where updating embedded entities on Tokens used a parameter less
    // NOTE: This is a dirty workaround which is a bug in core Foundry. Once this is fixed in Foundry, this should be undone.
    if (!(documents instanceof Array && result instanceof Array)) {
      userId = options;
      options = result;
      result = documents;
    }

    if (userId === game.user.id && embeddedName === "Item") {
      this.toggleConditionStatusIcons();
    }

    super._preUpdateEmbeddedDocuments(...arguments);

    if (this.sheet) this.sheet.render();

    // Redraw token effects
    const tokens = this.getActiveTokens();
    for (const t of tokens) {
      t.drawEffects();
    }
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
      const curUses = itemData.data.uses;

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
    const t = itemData.type;
    const initial = {};
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
    const attackData = {};

    // Add ability modifiers
    attackData["data.ability.attack"] = item.data.data.ability.attack;
    attackData["data.ability.damage"] = item.data.data.ability.damage;
    attackData["data.ability.damageMult"] = item.data.data.ability.damageMult;
    attackData["data.held"] = item.data.data.held;

    // Add misc things
    attackData["type"] = "attack";
    attackData["name"] = item.data.name;
    attackData["data.masterwork"] = item.data.data.masterwork;
    attackData["data.nonlethal"] = item.data.data.nonlethal;
    attackData["data.attackType"] = item.data.data.attackType;
    attackData["data.enh"] = item.data.data.enh;
    attackData["data.ability.critRange"] = item.data.data.ability.critRange || 20;
    attackData["data.ability.critMult"] = item.data.data.ability.critMult || 2;
    attackData["data.actionType"] = item.data.data.actionType;
    attackData["data.activation.type"] = item.data.data.activation.type;
    attackData["data.duration.units"] = item.data.data.duration.units;
    attackData["data.range.units"] = item.data.data.range.units;
    attackData["data.broken"] = item.data.data.broken;
    attackData["img"] = item.data.img;
    attackData["data.soundEffect"] = item.data.data.soundEffect;

    // Add additional attacks
    attackData["data.attackParts"] = item.data.data.attackParts;
    attackData["data.formulaicAttacks"] = item.data._source.data.formulaicAttacks;
    attackData["data.critConfirmBonus"] = item.data.data.critConfirmBonus;

    // Add damage
    attackData["data.damage"] = item.data._source.data.damage;

    // Add attack bonus formula
    attackData["data.attackBonus"] = item.data.data.attackBonus;

    // Add range
    attackData["data.range"] = item.data._source.data.range;

    // Add measure template
    attackData["data.measureTemplate"] = item.data._source.data.measureTemplate;

    // Add notes
    attackData["data.effectNotes"] = item.data._source.data.effectNotes;
    attackData["data.attackNotes"] = item.data._source.data.attackNotes;

    // Add saving throw
    attackData["data.save"] = item.data._source.data.save;

    // Synthetic intermediate item
    const attackItem = new ItemPF(expandObject(attackData));
    // Create attack
    const itemData = await this.createOwnedItem(attackItem.data);

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
    const rollData = this.getRollData();
    const noteObjects = this.getContextNotes(`skill.${skillId}`);
    const notes = this.formatContextNotes(noteObjects, rollData);

    // Add untrained note
    if (skl.rt && !skl.rank) {
      notes.push(game.i18n.localize("PF1.Untrained"));
    }

    // Gather changes
    const parts = [];
    const changes = getHighestChanges(
      this.changes.filter((c) => {
        let cf = getChangeFlat.call(this, c.subTarget, c.modifier);
        if (!(cf instanceof Array)) cf = [cf];

        return cf.includes(`data.skills.${skillId}.changeBonus`);
      }),
      { ignoreTarget: true }
    );

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
    if (skl.acp && rollData.attributes.acp.total !== 0) {
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
    for (const c of changes) {
      if (!c.value) continue;
      parts.push(`${c.value}[${c.flavor}]`);
    }

    const props = [];
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

  rollCMB(options = { ability: null, chatMessage: true, noSound: false, dice: "1d20" }) {
    if (!this.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    const allowed = Hooks.call("actorRoll", this, "cmb", null, options);
    if (allowed === false) return;

    // Add contextual notes
    const rollData = this.getRollData();
    const noteObjects = this.getContextNotes("misc.cmb");
    const notes = this.formatContextNotes(noteObjects, rollData);

    const parts = [];

    const describePart = (value, label) => parts.push(`${value}[${label}]`);
    const srcDetails = (s) => s?.reverse().forEach((d) => describePart(d.value, d.name, -10));
    srcDetails(this.sourceDetails["data.attributes.cmb.bonus"]);
    srcDetails(this.sourceDetails["data.attributes.attack.shared"]);

    const size = getProperty(this.data, "data.traits.size") ?? "med";
    rollData.sizeBonus = CONFIG.PF1.sizeSpecialMods[size];
    if (rollData.sizeBonus != 0) parts.push(`@sizeBonus[${game.i18n.localize("PF1.Size")}]`);

    // Unreliable melee/ranged identification
    const isMelee =
      ["mwak", "msak", "mcman"].includes(this.data.data.actionType) ||
      ["melee", "reach"].includes(this.data.data.range.units);
    const isRanged =
      ["rwak", "rsak", "rcman"].includes(this.data.data.actionType) || this.data.data.weaponSubtype === "ranged";

    const changeSources = ["attack"];
    if (isRanged) changeSources.push("rattack");
    if (isMelee) changeSources.push("mattack");
    const effectiveChanges = getHighestChanges(
      this.changes.filter((c) => changeSources.includes(c.subTarget)),
      { ignoreTarget: true }
    );
    effectiveChanges.forEach((ic) => describePart(ic.value, ic.flavor));

    const abl = options.ability ?? this.data.data.attributes.cmbAbility;
    const ablMod = getProperty(this.data, `data.abilities.${abl}.mod`) ?? 0;
    if (ablMod != 0) describePart(ablMod, CONFIG.PF1.abilities[abl]);

    // Add grapple note
    if (this.data.data.attributes.conditions.grappled) {
      notes.push("+2 to Grapple");
    }

    const props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });
    return DicePF.d20Roll({
      event: options.event,
      parts,
      dice: options.dice,
      data: rollData,
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
    const rollData = this.getRollData();
    const noteObjects = [...this.getContextNotes("attacks.effect"), ...this.getContextNotes("attacks.attack")];
    const notes = this.formatContextNotes(noteObjects, rollData);
    rollData.item = {};

    const changes = sources
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

    const size = getProperty(this.data, "data.traits.size");
    rollData.sizeBonus = CONFIG.PF1.sizeMods[getProperty(this.data, "data.traits.size") ?? "med"];
    if (rollData.sizeBonus != 0) changes.push(`@sizeBonus[${game.i18n.localize("PF1.Size")}]`);

    const props = [];
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

    const props = [];
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

    const allowed = Hooks.call("actorRoll", this, "concentration", spellbookKey, options);
    if (allowed === false) return;

    // Add contextual concentration string
    const notes = this.getContextNotesParsed(`spell.concentration.${spellbookKey}`);

    // Wound Threshold penalty
    const wT = this.getWoundThresholdData();
    if (wT.valid) notes.push(game.i18n.localize(CONFIG.PF1.woundThresholdConditions[wT.level]));
    // TODO: Make the penalty show separate of the CL.total.

    const props = [];
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
        }] + @formulaBonus[${game.i18n.localize("PF1.ByBonus")}]`,
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
    const misc = [];

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
    const notes = this.getContextNotes("misc.init").reduce((arr, o) => {
      for (const n of o.notes) arr.push(...n.split(/[\n\r]+/));
      return arr;
    }, []);

    let notesHTML;
    if (notes.length > 0) {
      // Format notes if they're present
      const notesHTMLParts = [];
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
    const rollData = this.getRollData();
    const noteObjects = this.getContextNotes(`savingThrow.${savingThrowId}`);
    const notes = this.formatContextNotes(noteObjects, rollData);

    const parts = [];

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
    for (const c of changeBonus) {
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
    const props = this.getDefenseHeaders();
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
    const rollData = this.getRollData();
    const noteObjects = this.getContextNotes(`abilityChecks.${abilityId}`);
    const notes = this.formatContextNotes(noteObjects, rollData);

    const label = CONFIG.PF1.abilities[abilityId];
    const abl = this.data.data.abilities[abilityId];

    const parts = [`@abilities.${abilityId}.mod[${label}]`];
    if (abl.checkMod != 0) {
      const changes = this.sourceDetails[`data.abilities.${abilityId}.checkMod`];
      for (const c of changes) parts.push(`${c.value}[${c.name}]`);
    }
    if (this.data.data.attributes.energyDrain) {
      parts.push("-@attributes.energyDrain");
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

    const props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    return DicePF.d20Roll({
      event: options.event,
      parts,
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
    const rollData = this.getRollData();

    // Add contextual AC notes
    const acNoteObjects = this.getContextNotes("misc.ac");
    const acNotes = this.formatContextNotes(acNoteObjects, rollData);
    if (this.data.data.attributes.acNotes.length > 0)
      acNotes.push(...this.data.data.attributes.acNotes.split(/[\n\r]+/));

    // Add contextual CMD notes
    const cmdNoteObjects = this.getContextNotes("misc.cmd");
    const cmdNotes = this.formatContextNotes(cmdNoteObjects, rollData);
    if (this.data.data.attributes.cmdNotes.length > 0)
      cmdNotes.push(...this.data.data.attributes.cmdNotes.split(/[\n\r]+/));

    // Add contextual SR notes
    const srNoteObjects = this.getContextNotes("misc.sr");
    const srNotes = this.formatContextNotes(srNoteObjects, rollData);
    if (this.data.data.attributes.srNotes.length > 0)
      srNotes.push(...this.data.data.attributes.srNotes.split(/[\n\r]+/));

    // Add misc data
    const reSplit = CONFIG.PF1.re.traitSeparator;
    // Damage Reduction
    let drNotes = [];
    if (this.data.data.traits.dr.length) {
      drNotes = this.data.data.traits.dr.split(reSplit);
    }
    // Energy Resistance
    const energyResistance = [];
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
    let controlled = canvas.tokens.controlled,
      healingInvert = 1;
    const numReg = /(\d+)/g,
      sliceReg = /[^,;\n]*(\d+)[^,;\n]*/g,
      sliceReg2 = /[^,;\n]+/g;

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
        const checked = [...form.find(".tokenAffected:checked")].map((tok) => tok.name.replace("affect.", ""));
        controlled = controlled.filter((con) => checked.includes(con.id));
      }
      for (const t of controlled) {
        const a = t.actor,
          hp = a.data.data.attributes.hp,
          tmp = parseInt(hp.temp) || 0;

        // Handle nonlethal damage
        let nld = 0;
        if (asNonlethal && value > 0) {
          nld = Math.min(hp.max - hp.nonlethal, value);
          value -= nld;
        }

        // Temp HP adjustment
        const dt = value > 0 ? Math.min(tmp, value) : 0;

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
      const tokens = controlled.map((tok) => {
        return {
          _id: tok.id,
          name: tok.name,
          dr: tok.actor.data.data.traits.dr.match(sliceReg),
          eres: tok.actor.data.data.traits.eres.match(sliceReg),
          di: [
            ...tok.actor.data.data.traits.di.value,
            ...(tok.actor.data.data.traits.di.custom.match(sliceReg2) ?? []),
          ],
          dv: [
            ...tok.actor.data.data.traits.dv.value,
            ...(tok.actor.data.data.traits.dv.custom.match(sliceReg2) ?? []),
          ],
          checked: true,
        };
      });

      reductionDefault = reductionDefault ?? "";

      // Dialog configuration and callbacks
      const template = "systems/pf1/templates/apps/damage-dialog.hbs";
      const dialogData = {
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

        const d = new Dialog(
          {
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
                const checked = [...inp[0].querySelectorAll('.selected-tokens input[type="checkbox"]')];
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
          },
          {
            classes: ["dialog", "pf1", "apply-hit-points"],
          }
        );
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
      tempHP = getProperty(this.data, "data.attributes.hp.temp") || 0,
      maxHP = getProperty(this.data, "data.attributes.hp.max");

    let level = usage > 0 ? Math.clamped(4 - Math.ceil(((curHP + tempHP) / maxHP) * 4), 0, 3) : 0;
    if (Number.isNaN(level)) level = 0; // Division by 0 due to max HP on new actors.

    const wtMult = this.getWoundThresholdMultiplier();
    const wtMod = getProperty(this.data, "data.attributes.woundThresholds.mod") ?? 0;

    setProperty(this.data, "data.attributes.woundThresholds.level", level);
    setProperty(this.data, "data.attributes.woundThresholds.penaltyBase", level * wtMult); // To aid relevant formulas
    setProperty(this.data, "data.attributes.woundThresholds.penalty", level * wtMult + wtMod);

    const penalty = getProperty(this.data, "data.attributes.woundThresholds.penalty");
    const changeFlatKeys = ["cmb", "cmd", "init", "allSavingThrows", "ac", "skills", "allChecks"];
    for (const fk of changeFlatKeys) {
      let flats = getChangeFlat.call(this, fk, "penalty", this.data.data);
      if (!(flats instanceof Array)) flats = [flats];
      for (const k of flats) {
        if (!k) continue;
        const curValue = getProperty(this.data, k);
        setProperty(this.data, k, curValue - penalty);
      }
    }
  }

  get allSkills() {
    const result = [];
    for (const [k, s] of Object.entries(this.data.data.skills)) {
      if (!s) continue;
      result.push(k);
      if (s.subSkills) {
        for (const k2 of Object.keys(s.subSkills)) {
          result.push(`${k}.subSkills.${k2}`);
        }
      }
    }
    return result;
  }

  get allNotes() {
    const result = [];

    const noteItems = this.items.filter((o) => {
      return o.data.data.contextNotes != null;
    });

    for (const o of noteItems) {
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
    const result = this.allNotes;

    // Attacks
    if (context.match(/^attacks\.(.+)/)) {
      const key = RegExp.$1;
      for (const note of result) {
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
      for (const note of result) {
        note.notes = note.notes
          .filter((o) => {
            return (
              // Check for skill.context or skill.xyz.subSkills.context
              o.subTarget === context ||
              o.subTarget?.split(".")?.[3] === context?.split(".")?.[1] ||
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
      for (const note of result) {
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
      for (const note of result) {
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
      for (const note of result) {
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
      for (const note of result) {
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
      for (const note of result) {
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
      for (const note of result) {
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
      for (const note of o.notes) {
        cur.push(TextEditor.enrichHTML(note, { rollData: o.item != null ? o.item.getRollData() : this.getRollData() }));
      }

      return cur;
    }, []);
  }

  formatContextNotes(notes, rollData, { roll = true } = {}) {
    const result = [];
    rollData = rollData ?? this.getRollData();
    for (const noteObj of notes) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (const note of noteObj.notes) {
        result.push(...note.split(/[\n\r]+/).map((o) => enrichHTMLUnrolled(o, { rollData, rolls: roll })));
      }
    }
    return result;
  }

  async createEmbeddedDocuments(embeddedName, createData, options = {}) {
    createData = createData instanceof Array ? createData : [createData];
    const rv = await super.createEmbeddedDocuments(embeddedName, createData, options);

    // Create class
    for (const item of rv) {
      if (item.type === "class") {
        await item._onLevelChange(0, item.data.data.level);
      }
    }

    return rv;
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

    const result = {
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
    const carryCapacity = this.data.data.details.carryCapacity;
    const carryStr = this.data.data.abilities.str.total + carryCapacity.bonus.total;
    let carryMultiplier = carryCapacity.multiplier.total;
    const size = this.data.data.traits.size;
    if (this.data.data.attributes.quadruped) carryMultiplier *= CONFIG.PF1.encumbranceMultipliers.quadruped[size];
    else carryMultiplier *= CONFIG.PF1.encumbranceMultipliers.normal[size];
    const table = CONFIG.PF1.encumbranceLoads;

    let heavy = Math.floor(table[carryStr] * carryMultiplier);
    if (carryStr >= table.length) {
      const multiplierCount = (carryStr - (table.length - 1)) / 10;
      heavy = Math.floor(table[table.length - 1] * Math.pow(4, multiplierCount) * carryMultiplier);
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
   * @param root0
   * @param root0.inLowestDenomination
   * @returns {number} The total amount of currency this actor has, in gold pieces
   */
  mergeCurrency({ inLowestDenomination = false } = {}) {
    const total =
      this.getTotalCurrency("currency", { inLowestDenomination }) +
      this.getTotalCurrency("altCurrency", { inLowestDenomination });
    return inLowestDenomination ? total : total / 100;
  }

  getTotalCurrency(category = "currency", { inLowestDenomination = false } = {}) {
    const currencies = getProperty(this.data.data, category);
    const total = currencies.pp * 1000 + currencies.gp * 100 + currencies.sp * 10 + currencies.cp;
    return inLowestDenomination ? total : total / 100;
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
    const values = [0, 0, 0, 0];
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

    return pack.getDocument(entryId).then((ent) => {
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
    const skipRefresh = !options.refresh && this._rollData;
    if (skipRefresh) {
      result = this._rollData;

      // Clear certain fields
      const clearFields = CONFIG.PF1.temporaryRollDataFields.actor;
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

    // Add denied Dex to AC
    setProperty(result, "conditions.loseDexToAC", this.flags.loseDexToAC);

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

        for (const k of Object.keys(result.classes[tag].savingThrows)) {
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
      const eqArmor = { total: Number.NEGATIVE_INFINITY, ac: 0, enh: 0 };
      for (const o of armor) {
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
      const eqShield = { total: Number.NEGATIVE_INFINITY, ac: 0, enh: 0 };
      for (const o of shields) {
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
    const keyedBooks = [];
    for (const [k, book] of spellbooks) {
      setProperty(result, `spells.${k}`, book);
      setProperty(result, `spells.${k}.abilityMod`, result.abilities[book.ability]?.mod ?? "");
      keyedBooks.push(k);
    }
    const aliasBooks = spellbooks.map((x) => x[1]).filter((x) => !!x.class && x.class !== "_hd");
    for (const book of aliasBooks) {
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
    const result = {
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

  async deleteEmbeddedDocuments(embeddedName, data, options = {}) {
    if (embeddedName === "Item") {
      if (!(data instanceof Array)) data = [data];

      // Add children to list of items to be deleted
      const _addChildren = async function (id) {
        const item = this.items.find((o) => o._id === id);
        const children = await item.getLinkedItems("children");
        for (const child of children) {
          if (!data.includes(child._id)) {
            data.push(child._id);
            await _addChildren.call(this, child._id);
          }
        }
      };
      for (const id of data) {
        await _addChildren.call(this, id);
      }

      // Remove links to this item (and child items)
      for (const id of data) {
        for (const i of this.items) {
          await i.removeItemLink(id);
        }
      }
    }

    await super.deleteEmbeddedDocuments(embeddedName, data, options);
  }

  getQuickActions() {
    const actualChargeCost = (i) => (i != null ? Math.floor(i.charges / i.chargeCost) : 0),
      actualMaxCharge = (i) => (i != null ? Math.floor(i.maxCharges / i.chargeCost) : 0);
    return this.items
      .filter(
        (o) =>
          (o.data.type === "weapon" ||
            o.data.type === "attack" ||
            o.data.type === "spell" ||
            (o.data.type === "feat" && !o.data.data.disabled)) &&
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
    if (this._states.togglingStatusIcons) return;
    this._states.togglingStatusIcons = true;

    const buffTextures = this._calcBuffActiveEffects();
    if (!this.testUserPermission(game.user, "OWNER")) return;
    const fx = [...this.effects];

    // Create and delete buff ActiveEffects
    const toCreate = [];
    const toDelete = [];
    const toUpdate = [];
    for (const [id, obj] of Object.entries(buffTextures)) {
      const existing = fx.find((f) => f.data.origin === id);
      if (!existing) {
        if (obj.active) toCreate.push(obj.item.getRawEffectData());
      } else {
        if (!obj.active) toDelete.push(existing.id);
        else {
          const existingData = existing.data.toObject();
          const mergedData = mergeObject(existingData, obj.item.getRawEffectData(), { inplace: false });
          if (obj.item.data.data.hideFromToken) mergedData.icon = null;
          const diffData = diffObject(existingData, mergedData);
          if (!isObjectEmpty(diffData)) {
            diffData._id = existing.id;
            toUpdate.push(diffData);
          }
        }
      }
    }

    // Create and delete condition ActiveEffects
    for (const condKey of Object.keys(CONFIG.PF1.conditions)) {
      const idx = fx.findIndex((e) => e.getFlag("core", "statusId") === condKey);
      const hasCondition = this.data.data.attributes.conditions[condKey] === true;
      const hasEffectIcon = idx >= 0;

      if (hasCondition && !hasEffectIcon) {
        toCreate.push({
          "flags.core.statusId": condKey,
          name: CONFIG.PF1.conditions[condKey],
          icon: CONFIG.PF1.conditionTextures[condKey],
        });
      } else if (!hasCondition && hasEffectIcon) {
        const removeEffects = fx.filter((e) => e.getFlag("core", "statusId") === condKey);
        toDelete.push(...removeEffects.map((e) => e.id));
      }
    }

    if (toDelete.length) await this.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    if (toCreate.length) await this.createEmbeddedDocuments("ActiveEffect", toCreate);
    if (toUpdate.length) await this.updateEmbeddedDocuments("ActiveEffect", toUpdate);
    this._states.togglingStatusIcons = false;
  }

  // @Object { id: { title: String, type: buff/string, img: imgPath, active: true/false }, ... }
  _calcBuffActiveEffects() {
    const buffs = this.items.filter((o) => o.type === "buff");
    return buffs.reduce((acc, cur) => {
      const id = cur.uuid;
      if (!acc[id]) acc[id] = { id: cur.id, label: cur.name, icon: cur.img, item: cur };
      if (cur.data.data.hideFromToken) acc[id].icon = null;
      if (cur.data.data.active) acc[id].active = true;
      else acc[id].active = false;
      return acc;
    }, {});
  }

  /**
   * Determines what ability modifier is appropriate for a given score.
   *
   * @param {number} [score] - The score to find the modifier for.
   * @param {object} [options={}] - Options for this function.
   * @param {number} [options.penalty=0] - A penalty value to take into account.
   * @param {number} [options.damage=0] - Ability score damage to take into account.
   * @returns {number} The modifier for the given score.
   */
  static getAbilityModifier(score = null, options = {}) {
    if (score != null) {
      const penalty = Math.abs(options.penalty ?? 0);
      const damage = Math.abs(options.damage ?? 0);
      return Math.max(-5, Math.floor((score - 10) / 2) - Math.floor(penalty / 2) - Math.floor(damage / 2));
    }
    return 0;
  }

  refreshAbilityModifiers() {
    for (const k of Object.keys(this.data.data.abilities)) {
      const total = this.data.data.abilities[k].total;
      const penalty = Math.abs(this.data.data.abilities[k].penalty || 0);
      const damage = this.data.data.abilities[k].damage;
      const newMod = this.constructor.getAbilityModifier(total, { penalty, damage });
      this.data.data.abilities[k].mod = newMod;

      // Store previous ability score
      if (!game.pf1.isMigrating && this._initialized && this._prevAbilityScores) {
        const prevMod = this._prevAbilityScores?.[k].mod ?? 0;
        const diffMod = newMod - prevMod;
        const result = this.data.data.abilities[k].mod + diffMod;

        this._prevAbilityScores[k] = {
          total,
          mod: result,
        };
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
      const heal = {
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
      for (const [key, abl] of Object.entries(actorData.abilities)) {
        const dmg = Math.abs(abl.damage);
        updateData[`data.abilities.${key}.damage`] = Math.max(0, dmg - heal.abl);
      }
    }

    const itemUpdates = [];
    const spellbookUses = {};
    // Restore daily uses of spells, feats, etc.
    if (restoreDailyUses === true) {
      // Update spellbooks
      for (const [sbKey, sb] of Object.entries(getProperty(actorData, `attributes.spells.spellbooks`) || {})) {
        for (let a = 0; a < 10; a++) {
          updateData[`data.attributes.spells.spellbooks.${sbKey}.spells.spell${a}.value`] =
            getProperty(sb, `spells.spell${a}.max`) || 0;
        }
      }

      // Update charged items
      for (const item of this.items) {
        const itemUpdate = { _id: item.id };
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

      for (const [key, spellbook] of Object.entries(actorData.attributes.spells.spellbooks)) {
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
          if (prevValue !== newValue) this._queuedUpdates[`${k}.value`] = newValue;
        }
      }
      this._prevAttributes = null;

      // Clear previous ability score tracking
      this._prevAbilityScores = null;
    }
  }

  /**
   * @override
   */
  async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
    let entity = this;
    const current = getProperty(this.data.data, attribute),
      updates = {};
    if (attribute.startsWith("resources.")) {
      const itemTag = attribute.split(".").slice(-1)[0];
      entity = this.items.find((item) => item.data.data.tag === itemTag);
    }
    if (!entity) return;
    const updateData = {};

    // Special key
    if (attribute === "attributes.hp") {
      if (!isDelta) value = (current.temp + current.value - value) * -1;
      let dt = value;
      if (current.temp > 0 && value < 0) {
        dt = Math.min(0, current.temp + value);
        updates["data.attributes.hp.temp"] = Math.max(0, current.temp + value);
      }
      updates["data.attributes.hp.value"] = Math.min(current.value + dt, current.max);
      // Absolute
    } else if (!isDelta) {
      if (entity instanceof Actor) {
        if (isBar) updates[`data.${attribute}.value`] = value;
        else updates[`data.${attribute}`] = value;
      } else {
        updates["data.uses.value"] = value;
      }
      // Relative
    } else {
      if (entity instanceof Actor) {
        if (isBar)
          updates[`data.${attribute}.value`] = Math.clamped(current.min || 0, current.value + value, current.max);
        else updates[`data.${attribute}`] = current + value;
      } else {
        updates["data.uses.value"] = current.value + value;
      }
    }

    const allowed = Hooks.call("modifyTokenAttribute", { attribute, value, isDelta, isBar }, updates);
    return allowed !== false ? entity.update(updates) : this;
  }
}
