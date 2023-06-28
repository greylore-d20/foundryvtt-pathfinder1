import { getAbilityModifier } from "@utils";
import { ItemPF, ItemRacePF } from "@item/_module.mjs";
import { createTag, fractionalToString, enrichHTMLUnrolled } from "../../utils/lib.mjs";
import { createCustomChatMessage } from "../../utils/chat.mjs";
import { LinkFunctions } from "../../utils/links.mjs";
import {
  applyChanges,
  addDefaultChanges,
  getChangeFlat,
  getSourceInfo,
  setSourceInfoByName,
  getHighestChanges,
} from "./utils/apply-changes.mjs";
import { RollPF } from "../../dice/roll.mjs";
import { Spellbook, SpellRanges, SpellbookMode, SpellbookSlots } from "./utils/spellbook.mjs";
import { ItemChange } from "../../components/change.mjs";
import { callOldNamespaceHook, callOldNamespaceHookAll } from "@utils/hooks.mjs";
import { VisionPermissionSheet } from "module/applications/vision-permission.mjs";

/**
 * Extend the base Actor class to implement additional game system logic.
 */
export class ActorPF extends Actor {
  constructor(...args) {
    super(...args);

    if (this.itemFlags === undefined)
      /**
       * Init item flags.
       */
      this.itemFlags = { boolean: {}, dictionary: {} };

    if (this.changeItems === undefined)
      /**
       * A list of all the active items with changes.
       *
       * @type {ItemPF[]}
       */
      this.changeItems = [];

    if (this.changes === undefined)
      /**
       * Stores all ItemChanges from carried items.
       *
       * @public
       * @type {Collection<ItemChange>}
       */
      this.changes = new Collection();

    if (this._queuedUpdates === undefined)
      /**
       * Stores updates to be applied to the actor near the end of the _onUpdate method.
       *
       * @private
       * @type {Object<string, any>}
       */
      this._queuedUpdates = {};

    if (this._rollData === undefined)
      /**
       * Cached roll data for this item.
       *
       * @type {object}
       */
      this._rollData = null;

    if (this._runningFunctions === undefined)
      /**
       * Keeps track of currently running async functions that shouldn't run multiple times simultaneously.
       *
       * @type {Object<string>}
       */
      this._runningFunctions = {};

    if (this.containerItems === undefined)
      /**
       * All items this actor is holding in containers.
       *
       * @type {ItemPF[]}
       */
      this.containerItems = [];

    if (this._states === undefined)
      /**
       * Tracks various states which need to be tracked.
       *
       * @type {object}
       */
      this._states = {};

    // Init race reference
    this.race ??= null;

    this._itemTypes ??= null;
    this._visionPermissionSheet ??= null;
  }

  /**
   * @override
   * @param {object} data Creation data
   * @param {object} options Options
   * @param {string} userId Invoking user's ID
   */
  _preCreate(data, options, userId) {
    super._preCreate(data, options, userId);

    const updates = this.preCreateData(data, options, userId);

    // Set typed image
    if (data.img === undefined) {
      const image = pf1.config.defaultIcons.actors[this.type];
      if (image) this.updateSource({ img: image });
    }

    if (Object.keys(updates).length) this.updateSource(updates);
  }

  /**
   * Meant to be overridden.
   *
   * @abstract
   * @augments _preCreate
   * @param data
   * @param options
   * @param userId
   * @returns {object} Update data to replace with.
   */
  preCreateData(data, options, userId) {
    return {};
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
      if (actor) actor.rollSavingThrow(saveId, { event: event });
    } else if (action === "save") {
      const tokens = canvas.tokens.controlled;
      const saveId = button.dataset.type;
      let noSound = false;
      for (const token of tokens) {
        const actor = token.actor;
        actor?.rollSavingThrow(saveId, { event: event, noSound: noSound });
        noSound = true;
      }
    }
    // Show compendium entry
    else if (action === "open-compendium-entry") {
      const uuid = button.dataset.compendiumEntry;
      const document = await fromUuid(uuid);

      if (document instanceof JournalEntryPage) {
        document.parent.sheet.render(true, { pageId: document.id });
      } else {
        document.sheet.render(true);
      }
    }
  }

  /**
   * @param root0
   * @param root0.actorName
   * @param root0.actorId
   * @deprecated
   */
  static getActiveActor({ actorName = null, actorId = null } = {}) {
    foundry.utils.logCompatibilityWarning(
      "ActorPF.getActiveActor() is deprecated in favor of ChatMessage.getSpeakerActor(ChatMessage.getSpeaker())",
      {
        since: "PF1 0.83.0",
        until: "PF1 0.84.0",
      }
    );

    const speaker = ChatMessage.implementation.getSpeaker();
    let actor;

    if (actorName || actorId) {
      actor = game.actors.contents.find((o) => {
        if (actorName && o.name !== actorName) return false;
        if (actorId && o.id !== actorId) return false;
        return true;
      });
    }
    if (speaker.token && !actor) actor = canvas.tokens.get(speaker.token)?.actor;
    if (!actor) actor = game.actors.get(speaker.actor);

    return actor;
  }

  /**
   * Returns an array of all selected tokens, along with their actors.
   *
   * @returns {Array.<ActorPF, Token>[]}
   * @deprecated
   */
  static getSelectedActors() {
    foundry.utils.logCompatibilityWarning(
      "ActorPF.getSelectedActors() is deprecated in favor of canvas.tokens.controlled",
      {
        since: "PF1 0.83.0",
        until: "PF1 0.84.0",
      }
    );

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
        return o.type === "equipment" && o.system.equipped === true;
      })
      .reduce((cur, o) => {
        if (typeof o.system.spellFailure === "number") return cur + o.system.spellFailure;
        return cur;
      }, 0);
  }

  /**
   * Actor's current race item.
   *
   * @type {pf1.documents.item.ItemRacePF|null}
   */
  get race() {
    return this._race;
  }

  /**
   * Set reference to actor's current race (item).
   * Fill in any additional info, such as easy reference to creature type.
   *
   * @type {ItemRacePF|null}
   */
  set race(item) {
    this._race = item;
    const creatureType = item?.system.creatureType;
    this.system.traits ??= {};
    this.system.traits.type = creatureType;
    this.system.traits.humanoid = creatureType === "humanoid";
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
    if (item.type === "buff" || item.type === "feat") return item.system.subType;
    return "";
  }

  get _skillTargets() {
    const skills = [];
    for (const [sklKey, skl] of Object.entries(this.system.skills)) {
      if (skl == null) continue;
      // Add main skill
      skills.push(`skill.${sklKey}`);
      // Add subskills if present
      for (const subSklKey of Object.keys(skl.subSkills ?? [])) {
        skills.push(`skill.${sklKey}.subSkills.${subSklKey}`);
      }
    }
    return skills;
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

    for (const item of items) {
      // Process boolean flags
      if (item.isActive) {
        const flags = item.system.flags?.boolean || {};
        for (const flag of Object.keys(flags)) {
          bFlags[flag] ??= { sources: [] };
          bFlags[flag].sources.push(item);
        }
      }

      // Process dictionary flags
      const tag = item.system.tag;
      if (tag) {
        const flags = item.system.flags?.dictionary || {};
        for (const [key, value] of Object.entries(flags)) {
          setProperty(dFlags, `${tag}.${key}`, item.isActive ? value : 0);
        }
      }
    }

    this.itemFlags = {
      boolean: bFlags,
      dictionary: dFlags,
    };
  }

  _prepareChanges() {
    this.changeItems = this.items
      .filter((obj) => {
        return (
          (obj.system.changes instanceof Array && obj.system.changes.length) ||
          (obj.system.changeFlags && Object.values(obj.system.changeFlags).filter((o) => o === true).length)
        );
      })
      .filter((obj) => obj.isActive);

    const changes = [];
    for (const i of this.changeItems) {
      changes.push(...i.changes);
    }
    addDefaultChanges.call(this, changes);

    const c = new Collection();
    for (const change of changes) {
      c.set(change._id, change);
    }
    this.changes = c;
  }

  applyActiveEffects() {
    this.containerItems = this._prepareContainerItems(this.items);
    this._prepareItemFlags(this.allItems);
    this._prepareChanges();
  }

  prepareData() {
    this.sourceInfo = {};
    this.changeFlags = {};

    // Prepare data
    super.prepareData();

    this._initialized = true;
    this._setSourceDetails(this.sourceInfo);
  }

  /**
   * Deletes expired temporary active effects and disables linked expired buffs.
   *
   * @param {DocumentModificationContext} [context] Document update context
   */
  async expireActiveEffects(context = {}) {
    const worldTime = game.time.worldTime;
    const temporaryEffects = this.temporaryEffects.filter((ae) => {
      const { seconds, startTime } = ae.duration;
      // Calculate remaining duration.
      // AE.duration.remaining is updated by Foundry only in combat and is unreliable.
      if (seconds > 0) {
        const elapsed = worldTime - startTime,
          remaining = seconds - elapsed;
        return remaining <= 0;
      }
      return false;
    });
    const disableActiveEffects = [],
      disableBuffs = [];
    for (const ae of temporaryEffects) {
      const re = ae.origin?.match(/Item\.(?<itemId>\w+)/);
      const item = this.items.get(re?.groups.itemId);
      if (!item || item.type !== "buff") {
        disableActiveEffects.push({ _id: ae.id, active: false });
      } else {
        disableBuffs.push({ _id: item.id, "system.active": false });
      }
    }

    // Add context info for why this update happens to allow modules to understand the cause.
    context.pf1 ??= {};
    context.pf1.reason = "duration";

    const disableAEContext = mergeObject({ render: !disableBuffs.length }, context);
    if (disableActiveEffects.length)
      await this.updateEmbeddedDocuments("ActiveEffect", disableActiveEffects, disableAEContext);
    if (disableBuffs.length) await this.updateEmbeddedDocuments("Item", disableBuffs, context);
  }

  /**
   * Prepare actor data before items are prepared.
   *
   * @override
   */
  prepareBaseData() {
    super.prepareBaseData();

    // Reset item types cache
    this._itemTypes = null;

    // Reset equipment info
    this.equipment = {
      shield: { type: pf1.config.shieldTypes.none, id: undefined },
      armor: { type: pf1.config.armorTypes.none, id: undefined },
    };

    // Reset class info
    this.classes = {};

    //  Init resources structure
    this.system.resources ??= {};

    this._resetInherentTotals();
    callOldNamespaceHookAll("pf1.prepareBaseActorData", "pf1PrepareBaseActorData", this);
    Hooks.callAll("pf1PrepareBaseActorData", this);

    // Update total level and mythic tier
    const classes = this.items.filter((o) => o.type === "class");
    const { level, mythicTier } = classes.reduce(
      (cur, o) => {
        o.prepareDerivedData(); // HACK: Out of order preparation for later.
        cur.level += o.hitDice;
        cur.mythicTier += o.mythicTier;
        return cur;
      },
      { level: 0, mythicTier: 0 }
    );

    this.system.details.level.value = level;
    this.system.details.mythicTier = mythicTier;

    // Populate conditions
    for (const condition of Object.keys(pf1.config.conditions)) {
      this.system.attributes.conditions[condition] ??= false;
    }

    // Refresh ability scores
    {
      const abs = Object.keys(this.system.abilities);
      for (const ab of abs) {
        const value = this.system.abilities[ab].value;
        if (value == null) {
          this.system.abilities[ab].total = null;
          this.system.abilities[ab].base = null;
          this.system.abilities[ab].baseMod = 0;
        } else {
          this.system.abilities[ab].total = value - this.system.abilities[ab].drain;
          this.system.abilities[ab].penalty =
            (this.system.abilities[ab].penalty || 0) - Math.abs(this.system.abilities[ab].userPenalty || 0);
          this.system.abilities[ab].base = this.system.abilities[ab].total;
        }
      }
      this.refreshAbilityModifiers();
    }

    // Reset BAB
    {
      const k = "system.attributes.bab.total";
      const v = Math.floor(
        classes.reduce((cur, cls) => {
          // HACK: Depends on earlier out of order preparation
          const bab = cls.system.babBase;
          if (bab !== 0) {
            getSourceInfo(this.sourceInfo, k).positive.push({
              name: cls.name,
              value: fractionalToString(bab),
            });
          }
          return cur + bab;
        }, 0)
      );
      this.system.attributes.bab.total = Math.floor(v);
    }

    this._prepareClassSkills();

    // Reset HD
    setProperty(this.system, "attributes.hd.total", this.system.details.level.value);
  }

  /**
   * Reset class skills.
   *
   * @protected
   */
  _prepareClassSkills() {
    const skillSet = new Set();
    this.items
      .filter((actorItems) => ["class", "race", "feat"].includes(actorItems.type))
      .forEach((relevantActorItems) => {
        for (const [classSkillName, isClassSkill] of Object.entries(relevantActorItems.system.classSkills || {})) {
          if (isClassSkill === true) skillSet.add(classSkillName);
        }
      });

    for (const [skillKey, skillData] of Object.entries(this.system.skills)) {
      if (!skillData) {
        console.warn(`Bad skill data for "${skillKey}"`, this);
        continue;
      }
      this.system.skills[skillKey].cs = skillSet.has(skillKey);
      for (const k2 of Object.keys(skillData.subSkills ?? {})) {
        setProperty(skillData, `subSkills.${k2}.cs`, skillSet.has(skillKey));
      }
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
    // Check for item type
    if (item.type !== "equipment" || !["armor", "shield"].includes(item.system.subType)) return true;

    // Custom proficiencies
    const customProficiencies =
      this.system.traits.armorProf?.customTotal
        ?.split(pf1.config.re.traitSeparator)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0) || [];

    const name = item.name.toLowerCase(),
      tag = item.system.tag;
    return (
      this.system.traits.armorProf.total.includes(proficiencyName) ||
      customProficiencies.find((prof) => prof.includes(name) || prof.includes(tag)) != undefined
    );
  }

  /**
   * Update specific spellbook.
   *
   * @param {string} bookId Spellbook identifier
   * @param {object} [rollData] Roll data instance
   * @param {object} cache Pre-calculated data for re-use from _generateSpellbookCache
   */
  _updateSpellBook(bookId, rollData, cache) {
    const actorData = this.system;
    const book = actorData.attributes.spells.spellbooks[bookId];
    if (!book) {
      console.error(`Spellbook data not found for "${bookId} on actor`, this);
      return;
    }

    // Set spellbook label
    book.label = book.name || game.i18n.localize(`PF1.SpellBook${bookId.capitalize()}`);

    // Do not process spellbooks that are not in use
    if (!book.inUse) return;

    // Use custom name if present
    if (book.name) book.label = book.name;
    // Get name from class if selected
    else if (book.class) {
      if (book.class === "_hd") book.label = book.name || game.i18n.localize("PF1.SpellBookSpelllike");
      else {
        const bookClassId = this.classes[book.class]?._id;
        const bookClass = this.items.get(bookClassId);
        if (bookClass) book.label = bookClass.name;
      }
    }

    rollData ??= this.getRollData({ refresh: true });
    cache ??= this._generateSpellbookCache();

    const bookInfo = cache.books[bookId];

    const spellbookAbility = actorData.abilities[book.ability];

    // Add spell slots based on ability bonus slot formula
    const spellSlotAbilityScoreBonus = RollPF.safeRoll(book.spellSlotAbilityBonusFormula || "0", rollData).total,
      spellSlotAbilityScore = (spellbookAbility?.total ?? 10) + spellSlotAbilityScoreBonus,
      spellSlotAbilityMod = getAbilityModifier(spellSlotAbilityScore);

    // Set CL
    let clTotal = 0;
    {
      const key = `system.attributes.spells.spellbooks.${bookId}.cl.total`;
      const formula = book.cl.formula || "0";
      let total = 0;

      // Add NPC base
      if (this.type === "npc") {
        const value = book.cl.base || 0;
        total += value;
        clTotal += value;
        setSourceInfoByName(this.sourceInfo, key, game.i18n.localize("PF1.Base"), value);
      }
      // Add HD
      if (book.class === "_hd") {
        const value = actorData.attributes.hd.total;
        total += value;
        clTotal += value;
        setSourceInfoByName(this.sourceInfo, key, game.i18n.localize("PF1.HitDie"), value);
      }
      // Add class levels
      else if (book.class && rollData.classes[book.class]) {
        const value = rollData.classes[book.class].level;
        total += value;
        clTotal += value;

        setSourceInfoByName(this.sourceInfo, key, rollData.classes[book.class].name, value);
      }

      // Set auto spell level calculation offset
      if (book.autoSpellLevelCalculation) {
        const autoFormula = book.cl.autoSpellLevelCalculationFormula || "0";
        const autoBonus = RollPF.safeTotal(autoFormula, rollData);
        const autoTotal = Math.clamped(total + autoBonus, 1, 20);
        book.cl.autoSpellLevelTotal = autoTotal;

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
            game.i18n.localize(pf1.config.woundThresholdConditions[rollData.attributes.woundThresholds.level]),
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

      const prevTotal = book.cl.total ?? 0;
      clTotal += prevTotal;
      book.cl.total = clTotal;
    }

    // Set concentration bonus
    {
      // Temp fix for old actors that fail migration
      if (Number.isFinite(book.concentration)) {
        console.error(`Bad spellbook concentration value "${book.concentration}" in spellbook "${bookId}"`);
        book.concentration = {};
      }
      const concFormula = book.concentrationFormula;
      const formulaRoll = concFormula.length ? RollPF.safeRoll(concFormula, rollData).total : 0;
      const classAbilityMod = actorData.abilities[book.ability]?.mod ?? 0;
      const concentration = clTotal + classAbilityMod + formulaRoll;
      const prevTotal = book.concentration.total ?? 0;

      // Set source info
      setSourceInfoByName(
        this.sourceInfo,
        `system.attributes.spells.spellbooks.${bookId}.concentration.total`,
        game.i18n.localize("PF1.CasterLevel"),
        clTotal,
        false
      );
      setSourceInfoByName(
        this.sourceInfo,
        `system.attributes.spells.spellbooks.${bookId}.concentration.total`,
        game.i18n.localize("PF1.SpellcastingAbility"),
        classAbilityMod,
        false
      );
      setSourceInfoByName(
        this.sourceInfo,
        `system.attributes.spells.spellbooks.${bookId}.concentration.total`,
        game.i18n.localize("PF1.ByBonus"),
        formulaRoll,
        false
      );

      // Apply value
      book.concentration = { total: prevTotal + concentration };
    }

    const getAbilityBonus = (a) => (a !== 0 ? ActorPF.getSpellSlotIncrease(spellSlotAbilityMod, a) : 0);

    const mode = new SpellbookMode(book);
    const useSpellPoints = book.spellPoints.useSystem === true;

    // Spell slots
    const useAuto = book.autoSpellLevelCalculation;
    if (useAuto) {
      // turn off spell points
      book.spellPoints.useSystem = false;

      // set base "spontaneous" based on spell prep mode
      book.spontaneous = mode.isSemiSpontaneous;

      let casterType = book.casterType;
      if (!casterType || (mode.isHybrid && casterType !== "high")) {
        book.casterType = casterType = "high";
      }
      if (mode.isPrestige && casterType !== "low") {
        book.casterType = casterType = "low";
      }

      const castsForLevels =
        pf1.config.casterProgression[book.spontaneous ? "castsPerDay" : "spellsPreparedPerDay"][mode.raw][casterType];
      let classLevel = Math.clamped(book.cl.autoSpellLevelTotal, 1, 20);

      // Protect against invalid class level bricking actors
      if (!Number.isSafeInteger(classLevel)) {
        const msg = `Actor ${this.id} has invalid caster class level.`;
        console.error(msg, classLevel);
        ui.notifications?.error(msg);
        classLevel = Math.floor(classLevel);
      }

      rollData.ablMod = spellSlotAbilityMod;

      const allLevelModFormula =
        book[book.spontaneous ? "castPerDayAllOffsetFormula" : "preparedAllOffsetFormula"] || "0";
      const allLevelMod = RollPF.safeTotal(allLevelModFormula, rollData);

      for (let level = 0; level < 10; level++) {
        const levelData = book.spells[`spell${level}`];
        // 0 is special because it doesn't get bonus preps and can cast them indefinitely so can't use the "cast per day" value
        const spellsForLevel =
          level === 0 && book.spontaneous
            ? pf1.config.casterProgression.spellsPreparedPerDay[mode.raw][casterType][classLevel - 1][level]
            : castsForLevels[classLevel - 1][level];
        levelData.base = spellsForLevel;

        const offsetFormula = levelData[book.spontaneous ? "castPerDayOffsetFormula" : "preparedOffsetFormula"] || "0";

        const max =
          typeof spellsForLevel === "number" || (level === 0 && book.hasCantrips)
            ? spellsForLevel + getAbilityBonus(level) + allLevelMod + RollPF.safeTotal(offsetFormula, rollData)
            : null;

        levelData.max = max;
        if (!Number.isFinite(levelData.value)) levelData.value = max;
      }
    } else {
      for (let level = book.hasCantrips ? 0 : 1; level < 10; level++) {
        const spellLevel = book.spells[`spell${level}`];
        let base = parseInt(spellLevel.base);
        if (Number.isNaN(base)) {
          spellLevel.base = null;
          spellLevel.max = 0;
        } else if (book.autoSpellLevels) {
          base += getAbilityBonus(level);
          spellLevel.max = base;
        } else {
          spellLevel.max = base;
        }

        const max = spellLevel.max;
        const oldval = spellLevel.value;
        if (!Number.isFinite(oldval)) spellLevel.value = max;
      }
    }

    // Set spontaneous spell slots to something sane
    for (let a = 0; a < 10; a++) {
      const spellLevel = book.spells[`spell${a}`];
      const current = spellLevel.value;
      spellLevel.value = current || 0;
    }

    // Update spellbook slots
    {
      const slots = {};
      for (let spellLevel = 0; spellLevel < 10; spellLevel++) {
        slots[spellLevel] = new SpellbookSlots({
          value: book.spells[`spell${spellLevel}`].max,
          domain: book.domainSlotValue ?? 0,
        });
      }

      // Slot usage
      if (!book.spontaneous) {
        for (let level = 0; level < 10; level++) {
          const levelSpells = bookInfo.level[level]?.spells ?? [];
          const lvlSlots = slots[level];
          for (const spell of levelSpells) {
            if (Number.isFinite(spell.maxCharges)) {
              const slotCost = spell.slotCost;
              const subtract = { domain: 0, uses: 0 };
              if (spell.isDomain) {
                subtract.domain = Math.min(spell.maxCharges, lvlSlots.domain);
                subtract.uses = (spell.maxCharges - subtract.domain) * slotCost;
              } else {
                subtract.uses = spell.maxCharges * slotCost;
              }
              lvlSlots.domain -= subtract.domain;
              lvlSlots.value -= subtract.uses;
            }
          }
          book.spells[`spell${level}`].value = lvlSlots.value;
        }
      }

      // Spells available hint text if auto spell levels is enabled
      const useAuto = book.autoSpellLevelCalculation;
      if (useAuto) {
        const maxLevelByAblScore = (spellbookAbility?.total ?? 0) - 10;

        const allLevelModFormula = book.preparedAllOffsetFormula || "0";
        const allLevelMod = RollPF.safeTotal(allLevelModFormula, rollData);

        const casterType = book.casterType || "high";
        const classLevel = Math.floor(Math.clamped(book.cl.autoSpellLevelTotal, 1, 20));

        for (let spellLevel = 0; spellLevel < 10; spellLevel++) {
          const spellLevelData = book.spells[`spell${spellLevel}`];
          if (maxLevelByAblScore < spellLevel) {
            spellLevelData.lowAbilityScore = true;
            continue;
          }

          spellLevelData.known = { unused: 0, max: 0 };
          spellLevelData.preparation = { unused: 0, max: 0 };

          let remaining;
          if (mode.isPrepared) {
            // for prepared casters, just use the 'value' calculated above
            remaining = spellLevelData.value;
            spellLevelData.preparation.max = spellLevelData.max;
          } else {
            // spontaneous or hybrid
            // if not prepared then base off of casts per day
            let available =
              pf1.config.casterProgression.spellsPreparedPerDay[mode.raw][casterType]?.[classLevel - 1][spellLevel];
            available += allLevelMod;

            const formula = spellLevelData.preparedOffsetFormula || "0";
            available += RollPF.safeTotal(formula, rollData);

            // Leave record of max known
            spellLevelData.known.max = available;

            // Count spell slots used
            let dSlots = slots[spellLevel].domain;
            const used =
              bookInfo.level[spellLevel]?.spells.reduce((acc, i) => {
                const { preparation, atWill, domain } = i.system;
                if (!atWill && preparation.spontaneousPrepared) {
                  const slotCost = i.slotCost;
                  if (domain && dSlots > 0) dSlots -= slotCost;
                  else acc += slotCost;
                }
                return acc;
              }, 0) ?? 0;
            slots[spellLevel].domainUnused = dSlots;
            slots[spellLevel].used = used;

            remaining = available - used;
          }

          if (!remaining) {
            spellLevelData.spellMessage = "";
            continue;
          }

          let spellRemainingMsg = "";

          if (remaining < 0) {
            spellRemainingMsg = game.i18n.format("PF1.TooManySpells", { quantity: Math.abs(remaining) });
            if (mode.isSpontaneous) spellLevelData.unusedKnown = remaining;
            else spellLevelData.preparation.unused = remaining;
          } else if (remaining > 0) {
            if (mode.isSpontaneous) {
              spellRemainingMsg =
                remaining === 1
                  ? game.i18n.localize("PF1.LearnMoreSpell")
                  : game.i18n.format("PF1.LearnMoreSpells", { quantity: remaining });
              spellLevelData.known.unused = remaining;
            } else {
              // hybrid or prepared
              spellRemainingMsg =
                remaining === 1
                  ? game.i18n.localize("PF1.PrepareMoreSpell")
                  : game.i18n.format("PF1.PrepareMoreSpells", { quantity: remaining });
              spellLevelData.preparation.unused = remaining;
            }
          }

          spellLevelData.spellMessage = spellRemainingMsg;
        }
      }
    }

    // Spell points
    if (useSpellPoints) {
      const formula = book.spellPoints.maxFormula || "0";
      rollData.cl = book.cl.total;
      rollData.ablMod = spellSlotAbilityMod;
      const spellClass = book.class ?? "";
      rollData.classLevel =
        spellClass === "_hd"
          ? rollData.attributes.hd?.total ?? rollData.details.level.value
          : rollData.classes[spellClass]?.level || 0;

      const roll = RollPF.safeRoll(formula, rollData);
      book.spellPoints.max = roll.total;
    } else {
      book.spellPoints.max = 0;
    }

    // Set spellbook ranges
    book.range = new SpellRanges(book.cl.total);
  }

  /**
   * Collect some basic spellbook info so it doesn't need to be gathered again for each spellbook.
   *
   * @returns {object} Spellbook cache
   */
  _generateSpellbookCache() {
    const bookKeys = Object.keys(this.system.attributes.spells.spellbooks);

    const allSpells = this.items.filter((i) => i.type === "spell");

    const cache = {
      spells: allSpells,
      books: {},
    };

    // Prepare spellbooks
    bookKeys.forEach((bookKey) => {
      cache.books[bookKey] ??= new Spellbook(bookKey, this);
    });

    // Spread out spells to books
    allSpells.forEach((spell) => {
      const bookKey = spell.system.spellbook;
      if (!bookKeys.includes(bookKey)) return console.error("Spell has invalid book", spell);
      cache.books[bookKey].addSpell(spell);
    });

    return cache;
  }

  /**
   * Update all spellbooks
   *
   * @param {object} [rollData] Roll data instance
   * @param {object} [cache] Spellbook cache
   */
  updateSpellbookInfo(rollData, cache) {
    rollData ??= this.getRollData({ refresh: true });
    cache ??= this._generateSpellbookCache();

    const spellbooks = this.system.attributes.spells.spellbooks;

    // Set spellbook info
    for (const bookKey of Object.keys(spellbooks)) {
      this._updateSpellBook(bookKey, rollData, cache);
    }

    // usedSpellbooks backwards compatibility. Mostly unused by the system itself
    this.system.attributes.spells.usedSpellbooks = Object.keys(spellbooks).filter((book) => spellbooks[book].inUse);
  }

  /**
   * Called just before the first change is applied, and after every change is applied.
   * Sets additional variables (such as spellbook range)
   */
  refreshDerivedData() {
    // Reset maximum dexterity bonus
    this.system.attributes.maxDexBonus = null;
    this.system.abilities.dex.maxBonus = this.system.abilities.dex.mod;

    {
      // Compute encumbrance
      const encPen = this._computeEncumbrance();

      // Apply armor penalties
      const gearPen = this._applyArmorPenalties();

      // Set armor check penalty
      this.system.attributes.acp.encumbrance = encPen.acp;
      this.system.attributes.acp.gear = gearPen.acp;
      this.system.attributes.acp.total = Math.max(encPen.acp, gearPen.acp);

      // Set maximum dexterity bonus
      if (encPen.maxDexBonus != null || gearPen.maxDexBonus != null) {
        this.system.attributes.maxDexBonus = Math.min(
          encPen.maxDexBonus ?? Number.POSITIVE_INFINITY,
          gearPen.maxDexBonus ?? Number.POSITIVE_INFINITY
        );
        this.system.abilities.dex.maxBonus = Math.min(
          this.system.abilities.dex.maxBonus,
          this.system.attributes.maxDexBonus
        );
      }
    }
  }

  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareDerivedData() {
    super.prepareDerivedData();

    this.prepareProficiencies();

    // Refresh roll data
    // Some changes act wonky without this
    // Example: `@skills.hea.rank >= 10 ? 6 : 3` doesn't work well without this
    this.getRollData({ refresh: true });

    this.items.forEach((item) => {
      item.prepareDerivedItemData();
      this.updateItemResources(item);
    });

    applyChanges.call(this);

    // Prepare specific derived data
    this.prepareSpecificDerivedData();

    // Prepare CMB total
    this.prepareCMB();

    // Setup links
    this.prepareItemLinks();

    // Refresh roll data again to include processed  info
    this.getRollData({ refresh: true });

    // Update item resources
    this.items.forEach((item) => {
      item.prepareDerivedItemData();
      this.updateItemResources(item);
    });
  }

  /**
   * Prepare armor, weapon, and language proficiencies.
   */
  prepareProficiencies() {
    const actorData = this.system;
    // Handle armor and weapon proficiencies for PCs
    // NPCs are considered proficient with their armor
    // Collect proficiencies from items, add them to actor's proficiency totals
    const proficiencies = {
      armorProf: pf1.config.armorProficiencies,
      weaponProf: pf1.config.weaponProficiencies,
      languages: pf1.config.languages,
    };
    for (const [prof, translations] of Object.entries(proficiencies)) {
      // Custom proficiency baseline from actor
      const customProficiencies =
        actorData.traits[prof]?.custom?.split(pf1.config.re.traitSeparator).filter((item) => item.length > 0) || [];

      // Iterate over all items to create one array of non-custom proficiencies
      const proficiencies = this.items.reduce(
        (profs, item) => {
          // Check only items able to grant proficiencies
          if (hasProperty(item, `system.${prof}`)) {
            // Get existing sourceInfo for item with this name, create sourceInfo if none is found
            // Remember whether sourceInfo can be modified or has to be pushed at the end
            let sInfo = getSourceInfo(this.sourceInfo, `system.traits.${prof}`).positive.find(
              (o) => o.name === item.name
            );
            const hasInfo = !!sInfo;
            if (!sInfo) sInfo = { name: item.name, value: [] };
            else if (typeof sInfo.value === "string") sInfo.value = sInfo.value.split(", ");

            // Regular proficiencies
            for (const proficiency of item.system[prof].value) {
              // Add localized source info if item's info does not have this proficiency already
              if (!sInfo.value.includes(proficiency)) sInfo.value.push(translations[proficiency]);
              // Add raw proficiency key
              if (!profs.includes(proficiency)) profs.push(proficiency);
            }

            // Collect trimmed but otherwise original proficiency strings, dedupe array for actor's total
            const customProfs =
              item.system[prof].custom
                ?.split(pf1.config.re.traitSeparator)
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
              if (!hasInfo) getSourceInfo(this.sourceInfo, `system.traits.${prof}`).positive.push(sInfo);
            }
          }
          return profs;
        },
        [...(actorData.traits[prof]?.value ?? [])] // Default proficiency baseline from actor
      );

      // Save collected proficiencies in actor's data
      actorData.traits[prof] ??= {}; // In case the data structure is missing
      actorData.traits[prof].total = [...proficiencies];
      actorData.traits[prof].customTotal = customProficiencies.join(";");
    }
  }

  prepareCMB() {
    const shrAtk = this.system.attributes.attack.shared ?? 0,
      genAtk = this.system.attributes.attack.general ?? 0,
      cmbAbl = this.system.attributes.cmbAbility,
      cmbAblMod = this.system.abilities[cmbAbl]?.mod ?? 0,
      size = this.system.traits.size,
      szCMBMod = pf1.config.sizeSpecialMods[size] ?? 0,
      cmbBonus = this.system.attributes.cmb.bonus ?? 0,
      cmb = shrAtk + genAtk + szCMBMod + cmbBonus + cmbAblMod;
    this.system.attributes.cmb.total = cmb;
  }

  prepareSpecificDerivedData() {
    callOldNamespaceHookAll("pf1.prepareDerivedActorData", "pf1PrepareDerivedActorData", this);
    Hooks.callAll("pf1PrepareDerivedActorData", this);

    this.refreshDerivedData();

    const attributes = this.system.attributes,
      abilities = this.system.abilities;

    // Set base ability modifier
    for (const ab of Object.keys(abilities)) {
      const total = abilities[ab].base;
      const penalty = abilities[ab].penalty || 0;
      const damage = abilities[ab].damage;
      abilities[ab].baseMod = getAbilityModifier(total, { penalty, damage });
    }

    const actorData = this.system;
    const data = actorData;

    // Round health
    const healthConfig = game.settings.get("pf1", "healthConfig");
    const round = { up: Math.ceil, nearest: Math.round, down: Math.floor }[healthConfig.rounding];
    for (const k of ["hp", "vigor"]) {
      attributes[k].max = round(attributes[k].max);
    }

    // Offset relative health
    for (const key of ["hp", "wounds", "vigor"]) {
      const hp = this.system.attributes[key];
      if (Number.isFinite(hp?.offset)) {
        hp.value = hp.max + hp.offset;
      }
    }

    // Shared attack bonuses
    {
      // Total
      const totalAtk = attributes.bab.total - attributes.acp.attackPenalty - (attributes.energyDrain ?? 0);
      attributes.attack.shared = totalAtk;
    }

    // Update wound threshold
    this.updateWoundThreshold();

    // Create arbitrary skill slots
    for (const skillId of pf1.config.arbitrarySkills) {
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
      if (pf1.config.backgroundSkills.includes(skillId)) {
        const skill = data.skills[skillId];
        skill.background = true;
        for (const subSkillId of Object.keys(skill.subSkills ?? {})) skill.subSkills[subSkillId].background = true;
      }
    }

    // Combine AC types
    for (const k of ["ac.normal.total", "ac.shield.total", "ac.natural.total"]) {
      const v = getProperty(actorData, k);
      if (v) {
        for (const k2 of ["normal", "flatFooted"]) {
          attributes.ac[k2].total += v;
        }
      }
    }

    // Add Dexterity to AC
    {
      // get configured ability scores
      const acAbl = attributes.ac.normal.ability ?? "dex";
      const acTouchAbl = attributes.ac.touch.ability ?? "dex";
      const cmdDexAbl = attributes.cmd.dexAbility ?? "dex";
      let acAblMod = abilities[acAbl]?.mod ?? 0;
      let acTouchAblMod = abilities[acTouchAbl]?.mod ?? 0;
      const cmdDexAblMod = abilities[cmdDexAbl]?.mod ?? 0;
      if (this.changeFlags["loseDexToAC"]) {
        acAblMod = Math.min(acAblMod, 0);
        acTouchAblMod = Math.min(acTouchAblMod, 0);
      }
      const maxDex = attributes.maxDexBonus ?? null;
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
        attributes.ac[k].total += v;
        getSourceInfo(this.sourceInfo, `system.attributes.ac.${k}.total`).positive.push({
          value: v,
          name: pf1.config.abilities[acAblKey[k]],
        });
      }
      for (const [k, v] of Object.entries(cmd)) {
        attributes.cmd[k] += v;
        getSourceInfo(this.sourceInfo, `system.attributes.cmd.${k}`).positive.push({
          value: v,
          name: pf1.config.abilities[cmdDexAbl],
        });
      }
    }

    // Reduce final speed under certain circumstances
    {
      const armorItems = this.items.filter((o) => o.type === "equipment");
      let reducedSpeed = false;
      const sInfo = { name: "", value: game.i18n.localize("PF1.ReducedMovementSpeed") };
      if (attributes.encumbrance.level >= pf1.config.encumbranceLevels.medium && !this.changeFlags["noEncumbrance"]) {
        reducedSpeed = true;
        sInfo.name = game.i18n.localize("PF1.Encumbrance");
      }
      if (
        armorItems.filter((o) => o.system.equipmentSubtype === "mediumArmor" && o.system.equipped).length &&
        !this.changeFlags["mediumArmorFullSpeed"]
      ) {
        reducedSpeed = true;
        sInfo.name = game.i18n.localize("PF1.EquipTypeMedium");
      }
      if (
        armorItems.filter((o) => o.system.equipmentSubtype === "heavyArmor" && o.system.equipped).length &&
        !this.changeFlags["heavyArmorFullSpeed"]
      ) {
        reducedSpeed = true;
        sInfo.name = game.i18n.localize("PF1.EquipTypeHeavy");
      }
      if (reducedSpeed) {
        for (const speedKey of Object.keys(this.system.attributes.speed)) {
          const speedValue = this.system.attributes.speed[speedKey].total;
          this.system.attributes.speed[speedKey].total = this.constructor.getReducedMovementSpeed(speedValue);
          if (speedValue > 0) {
            getSourceInfo(this.sourceInfo, `system.attributes.speed.${speedKey}.add`).negative.push(sInfo);
          }
        }
      }
    }

    // Add encumbrance source details
    switch (attributes.encumbrance.level) {
      case pf1.config.encumbranceLevels.medium:
        getSourceInfo(this.sourceInfo, "system.attributes.acp.total").negative.push({
          name: game.i18n.localize("PF1.Encumbrance"),
          value: 3,
        });
        getSourceInfo(this.sourceInfo, "system.attributes.maxDexBonus").negative.push({
          name: game.i18n.localize("PF1.Encumbrance"),
          value: 3,
        });
        break;
      case pf1.config.encumbranceLevels.heavy:
        getSourceInfo(this.sourceInfo, "system.attributes.acp.total").negative.push({
          name: game.i18n.localize("PF1.Encumbrance"),
          value: 6,
        });
        getSourceInfo(this.sourceInfo, "system.attributes.maxDexBonus").negative.push({
          name: game.i18n.localize("PF1.Encumbrance"),
          value: 1,
        });
        break;
    }

    this.updateSpellbookInfo();
  }

  /**
   * Returns this actor's labels
   *
   * @returns {Record<string, string>}
   */
  getLabels() {
    const labels = {};
    // Race
    labels.race = this.race
      ? game.i18n.format("PF1.RaceTitle", { name: this.race.name })
      : game.i18n.localize("PF1.Race");
    labels.alignment = pf1.config.alignments[this.system.details.alignment];

    // Speed
    labels.speed = {};
    for (const [key, obj] of Object.entries(this.system.attributes.speed ?? {})) {
      const dist = pf1.utils.convertDistance(obj.total);
      labels.speed[key] = `${dist[0]} ${pf1.config.measureUnitsShort[dist[1]]}`;
    }

    return labels;
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

    this.items
      .filter((obj) => {
        return obj.type === "equipment" && obj.system.equipped;
      })
      .forEach((obj) => {
        const eqType = obj.system.subType;
        const isShieldOrArmor = ["armor", "shield"].includes(eqType);
        let itemACP = Math.abs(obj.system.armor.acp);
        if (obj.system.masterwork === true && isShieldOrArmor) itemACP = Math.max(0, itemACP - 1);

        if (isShieldOrArmor) {
          itemACP = Math.max(0, itemACP + (this.system.attributes?.acp?.[`${eqType}Bonus`] ?? 0));
        }

        let brokenACP = 0;
        if (obj.system.broken) {
          brokenACP = itemACP;
          itemACP *= 2;
        }

        if (itemACP) {
          const sInfo = getSourceInfo(this.sourceInfo, "system.attributes.acp.total").negative.find(
            (o) => o.itemId === obj.id
          );

          if (brokenACP) {
            broken[eqType].value = brokenACP;
            broken[eqType].item = obj;
          }

          if (sInfo) sInfo.value = itemACP;
          else {
            getSourceInfo(this.sourceInfo, "system.attributes.acp.total").negative.push({
              name: obj.name,
              itemId: obj.id,
              value: itemACP,
            });
          }
        }

        if (isShieldOrArmor) {
          if (itemACP > acp[eqType]) acp[eqType] = itemACP;
          if (!this.hasArmorProficiency(obj, proficiencyMaps[eqType][obj.system.equipmentSubtype]))
            attackACPPenalty += itemACP;
        }

        if (obj.system.armor.dex !== null && isShieldOrArmor) {
          const mDex = Number.parseInt(obj.system.armor.dex, 10);
          if (Number.isInteger(mDex)) {
            const mod = this.system.attributes?.mDex?.[`${eqType}Bonus`] ?? 0;
            const itemMDex = mDex + mod;
            mdex[eqType] = Math.min(itemMDex, mdex[eqType] ?? Number.POSITIVE_INFINITY);

            const sInfo = getSourceInfo(this.sourceInfo, "system.attributes.maxDexBonus").negative.find(
              (o) => o.itemId === obj.id
            );
            if (sInfo) sInfo.value = mDex;
            else {
              getSourceInfo(this.sourceInfo, "system.attributes.maxDexBonus").negative.push({
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
        const sInfo = getSourceInfo(this.sourceInfo, `system.attributes.acp.${eqType}Bonus`).negative.find(
          (o) => o.brokenId === brokenId
        );
        if (sInfo) sInfo.value = value;
        else
          getSourceInfo(this.sourceInfo, `system.attributes.acp.${eqType}Bonus`).negative.push({
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
    this.system.attributes.acp.gear = totalACP;
    if (mdex.armor !== null || mdex.shield !== null)
      result.maxDexBonus = Math.min(mdex.armor ?? Number.POSITIVE_INFINITY, mdex.shield ?? Number.POSITIVE_INFINITY);

    // Set armor penalty to attack rolls
    this.system.attributes.acp.attackPenalty = attackACPPenalty;

    return result;
  }

  prepareItemLinks() {
    if (!this.items) return;

    for (const a of this.items) {
      if (a.system.links == null) continue;

      for (const l of Object.keys(a.system.links)) {
        if (LinkFunctions[l] != null) {
          LinkFunctions[l].call(this, a, a.system.links[l]);
        }
      }
    }
  }

  _setSourceDetails(extraData) {
    const actorData = this.system;
    const sourceDetails = {};
    // Get empty source arrays
    for (const b of Object.keys(pf1.config.buffTargets)) {
      let buffTargets = getChangeFlat.call(this, b, null);
      if (!(buffTargets instanceof Array)) buffTargets = [buffTargets];
      for (const bt of buffTargets) {
        if (!sourceDetails[bt]) sourceDetails[bt] = [];
      }
    }
    // Add additional source arrays not covered by changes
    sourceDetails["system.attributes.bab.total"] = [];

    // Add base values to certain bonuses
    sourceDetails["system.attributes.ac.normal.total"].push({ name: game.i18n.localize("PF1.Base"), value: 10 });
    sourceDetails["system.attributes.ac.touch.total"].push({ name: game.i18n.localize("PF1.Base"), value: 10 });
    sourceDetails["system.attributes.ac.flatFooted.total"].push({ name: game.i18n.localize("PF1.Base"), value: 10 });
    sourceDetails["system.attributes.cmd.total"].push({ name: game.i18n.localize("PF1.Base"), value: 10 });
    sourceDetails["system.attributes.cmd.flatFootedTotal"].push({ name: game.i18n.localize("PF1.Base"), value: 10 });
    // Add ability score data
    for (const [a, abl] of Object.entries(actorData.abilities)) {
      sourceDetails[`system.abilities.${a}.total`].push({ name: game.i18n.localize("PF1.Base"), value: abl.value });
      // Add ability penalty, damage and drain
      if (abl.damage != null && abl.damage !== 0) {
        sourceDetails[`system.abilities.${a}.total`].push({
          name: game.i18n.localize("PF1.AbilityDamage"),
          value: `-${Math.floor(Math.abs(abl.damage) / 2)} (Mod only)`,
        });
      }
      if (abl.drain != null && abl.drain !== 0) {
        sourceDetails[`system.abilities.${a}.total`].push({
          name: game.i18n.localize("PF1.AbilityDrain"),
          value: -Math.abs(abl.drain),
        });
      }
    }

    // Add wound threshold data
    {
      const hpconf = game.settings.get("pf1", "healthConfig").variants;
      const wtUsage = this.type === "npc" ? hpconf.npc.useWoundThresholds : hpconf.pc.useWoundThresholds;
      if (wtUsage > 0) {
        const wtData = this.getWoundThresholdData(actorData);

        if (wtData.level > 0) {
          const changeFlatKeys = ["~attackCore", "cmd", "init", "allSavingThrows", "ac", "skills", "abilityChecks"];
          for (const fk of changeFlatKeys) {
            let flats = getChangeFlat.call(this, fk, "penalty");
            if (!(flats instanceof Array)) flats = [flats];
            for (const k of flats) {
              if (!k) continue;
              sourceDetails[k].push({
                name: game.i18n.localize(pf1.config.woundThresholdConditions[wtData.level]),
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
            const srcMod = pf1.config.bonusModifiers[src.modifier] || src.modifier || "";
            let srcValue =
              src.value != null
                ? src.value
                : RollPF.safeRoll(src.formula || "0", rollData, [changeTarget, src, this], {
                    suppressError: !this.testUserPermission(game.user, "OWNER"),
                  }).total;
            if (src.operator === "set") srcValue = game.i18n.format("PF1.SetTo", { value: srcValue });
            if (!(src.operator === "add" && srcValue === 0) || src.ignoreNull === false) {
              sourceDetails[changeTarget].push({
                name: srcInfo.replace(/[[\]]/g, ""),
                modifier: srcMod,
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
      "attributes.ac.normal.total": 10,
      "attributes.ac.touch.total": 10,
      "attributes.ac.flatFooted.total": 10,
      "attributes.bab.total": 0,
      "attributes.bab.value": 0,
      "attributes.cmd.total": 10,
      "attributes.cmd.flatFootedTotal": 10,
      "attributes.acp.armorBonus": 0,
      "attributes.acp.shieldBonus": 0,
      "attributes.acp.gear": 0,
      "attributes.acp.encumbrance": 0,
      "attributes.acp.total": 0,
      "attributes.acp.attackPenalty": 0,
      "attributes.maxDexBonus": null,
      "ac.normal.total": 0,
      "ac.normal.base": 0,
      "ac.normal.enh": 0,
      "ac.normal.misc": 0,
      "ac.natural.total": 0,
      "ac.natural.base": 0,
      "ac.natural.misc": 0,
      "ac.natural.enh": 0,
      "ac.shield.total": 0,
      "ac.shield.base": 0,
      "ac.shield.enh": 0,
      "ac.shield.misc": 0,
      "attributes.sr.total": 0,
      "attributes.init.bonus": 0,
      "attributes.init.total": 0,
      "attributes.cmb.bonus": 0,
      "attributes.cmb.total": 0,
      "attributes.cmb.value": 0,
      "attributes.hp.max": this.system.attributes.hp.base ?? 0,
      "attributes.vigor.max": this.system.attributes.vigor.base ?? 0,
      "attributes.wounds.max": this.system.attributes.wounds.base ?? 0,
      "attributes.attack.general": 0,
      "attributes.attack.melee": 0,
      "attributes.attack.ranged": 0,
      "attributes.attack.critConfirm": 0,
      "attributes.mDex": { armorBonus: 0, shieldBonus: 0 },
      "attributes.damage.general": 0,
      "attributes.damage.weapon": 0,
      "attributes.damage.spell": 0,
      "attributes.damage.shared": 0,
      "attributes.woundThresholds.level": 0,
      "attributes.woundThresholds.mod": 0,
      "attributes.woundThresholds.override": -1,
      "attributes.woundThresholds.penaltyBase": 0,
      "attributes.woundThresholds.penalty": 0,
      "abilities.str.checkMod": 0,
      "abilities.dex.checkMod": 0,
      "abilities.con.checkMod": 0,
      "abilities.int.checkMod": 0,
      "abilities.wis.checkMod": 0,
      "abilities.cha.checkMod": 0,
      "attributes.spells.spellbooks.primary.concentration.total": 0,
      "attributes.spells.spellbooks.secondary.concentration.total": 0,
      "attributes.spells.spellbooks.tertiary.concentration.total": 0,
      "attributes.spells.spellbooks.spelllike.concentration.total": 0,
      "attributes.spells.spellbooks.primary.cl.total": 0,
      "attributes.spells.spellbooks.secondary.cl.total": 0,
      "attributes.spells.spellbooks.tertiary.cl.total": 0,
      "attributes.spells.spellbooks.spelllike.cl.total": 0,
      "details.carryCapacity.bonus.total": 0,
      "details.carryCapacity.multiplier.total": 0,
    };

    // Determine skill keys
    try {
      const skillKeys = getChangeFlat.call(this, "skills");
      for (const k of skillKeys) {
        keys[k.replace(/^system\./, "")] = 0;
      }
    } catch (err) {
      console.error("Could not determine skills for an actor", this);
    }

    return keys;
  }

  _resetInherentTotals() {
    const keys = this._getInherentTotalsKeys();

    // Reset totals
    for (const [k, v] of Object.entries(keys)) {
      try {
        setProperty(this.system, k, v);
      } catch (err) {
        console.log(err, k);
      }
    }
  }

  /**
   * Return reduced movement speed.
   *
   * @param {number} value - The non-reduced movement speed.
   * @returns {number} The reduced movement speed.
   */
  static getReducedMovementSpeed(value) {
    return value - Math.floor(value / 5 / 3) * 5;
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
   * @abstract
   * @param {number} level The desired level
   * @returns {number} The XP required
   */
  getLevelExp(level) {
    return 0; // Only used by PCs
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
  /* -------------------------------------------- */

  async _preUpdate(update, options, userId) {
    await super._preUpdate(update, options, userId);

    this._syncTokenImage(update);

    if (!update.system) return; // No system updates.

    const oldData = this.system;

    // Offset HP values
    const attributes = update.system.attributes;
    if (this._initialized && attributes != undefined) {
      for (const key of ["hp", "wounds", "vigor"]) {
        const hp = attributes[key];
        if (!hp) continue;
        if (hp.value !== undefined && hp.offset === undefined) {
          const max = hp.max ?? oldData.attributes[key]?.max;
          hp.offset = hp.value - max;
        }
      }
    }

    // Apply changes in Actor size to Token width/height
    const newSize = update.system.traits?.size;
    if (newSize !== undefined && oldData.traits.size !== undefined) {
      const size = pf1.config.tokenSizes[newSize];
      if (!this.isToken && !this.prototypeToken.flags?.pf1?.staticSize) {
        if (!update.token) update.token = {};
        update.token.width = size.w;
        update.token.height = size.h;
        update.token.scale = size.scale;
      }
    }

    // Make certain variables absolute
    const abilities = update.system.abilities;
    if (abilities) {
      const absoluteKeys = ["userPenalty", "damage", "drain"];
      const keys = Object.keys(abilities);
      for (const abl of keys) {
        for (const absKey of absoluteKeys) {
          if (abilities[abl][absKey] !== undefined) {
            abilities[abl][absKey] = Math.abs(abilities[abl][absKey]);
          }
        }
      }
    }

    const energyDrain = update.system.attributes?.energyDrain;
    if (energyDrain !== undefined) {
      update.system.attributes.energyDrain = Math.abs(energyDrain);
    }

    // Make only 1 fear or fatigue condition active at most
    const conditions = update.system.attributes?.conditions;
    if (conditions) {
      const keys = Object.keys(conditions);
      for (const conditionGroup of Object.values(pf1.config.conditionTracks)) {
        const conditionKey = keys.find((condition) => conditionGroup.includes(condition));
        if (!conditionKey) continue;
        for (const key of conditionGroup) {
          if (key !== conditionKey) {
            conditions[`-=${key}`] = null;
          }
        }
      }
    }

    // Update experience
    this._updateExp(update);
  }

  /**
   * Sync images in _preUpdate when moving away from default
   *
   * @param {object} update Update data
   */
  _syncTokenImage(update) {
    // No image update
    if (!update.img) return;
    // Explicit token image update
    if (update.prototypeToken?.texture?.src !== undefined) return;
    // Old token image mismatch with default
    if (this.prototypeToken.texture.src !== pf1.config.defaultIcons.actors[this.type]) return;
    // Portrait and token image mismatch
    if (this.img !== this.prototypeToken.texture.src) return;

    this.updateSource({ "prototypeToken.texture.src": update.img });
  }

  _onUpdate(updateData, options, userId, context = {}) {
    super._onUpdate(updateData, options, userId, context);

    // No system data updated
    if (!updateData.system) return;

    const sourceUser = game.user.id === userId;

    let refreshVision = false;
    if (hasProperty(updateData, "system.attributes.conditions")) {
      if (game.user.id === userId) this.toggleConditionStatusIcons({ render: false });
      refreshVision = true;
    } else if (hasProperty(updateData, "system.traits.senses")) {
      refreshVision = true;
    } else if (updateData.flags?.pf1?.visionPermissions) {
      refreshVision = true;
    }

    if (refreshVision) {
      if (this.testUserPermission(game.user, "OBSERVER")) {
        // Refresh canvas perception
        canvas.perception.update(
          {
            initializeVision: true,
            refreshLighting: true,
            refreshVision: true,
          },
          true
        );
      }
    }

    // Resize token(s)
    const sizeKey = updateData.system.traits?.size;
    if (sourceUser && sizeKey) {
      const size = CONFIG.PF1.tokenSizes[sizeKey];
      const tokens = this.getActiveTokens(false, true).filter((token) => !token.getFlag("pf1", "staticSize"));

      const scene = tokens[0]?.object.scene;
      scene?.updateEmbeddedDocuments(
        "Token",
        tokens.map((t) => ({
          _id: t.id,
          width: size.w,
          height: size.h,
          texture: { scaleX: size.scale, scaleY: size.scale },
        }))
      );
    }
  }

  _onCreateEmbeddedDocuments(embeddedName, documents, result, options, userId) {
    super._onCreateEmbeddedDocuments(...arguments);

    if (userId === game.user.id && embeddedName === "Item") {
      // Creating anything but active buffs should not prompt toggling conditions
      if (documents.some((item) => item.type === "buff" && item.isActive)) {
        this.toggleConditionStatusIcons({ render: false });
      }

      // Apply race size to actor
      const race = documents.find((d) => d.type === "race");
      if (race?.system.size) {
        if (this.system.traits.size !== race.system.size) this.update({ "system.traits.size": race.system.size });
      }
    }
  }

  _onUpdateEmbeddedDocuments(embeddedName, documents, result, options, userId) {
    super._onUpdateEmbeddedDocuments(embeddedName, documents, result, options, userId);

    if (userId === game.user.id && embeddedName === "Item") {
      // Toggle conditions only if updated items included buffs and the buff's active state was changed
      if (
        documents.some(
          (item) => item.type === "buff" && result.some((ri) => ri._id == item.id && ri.system?.active !== undefined)
        )
      ) {
        this.toggleConditionStatusIcons({ render: false });
      }
    }
  }

  updateItemResources(item) {
    if (item.isCharged) {
      if (item.isSingleUse) return false;

      const itemTag = !item.system.useCustomTag ? createTag(item.name) : item.system.tag;

      const res = {
        value: item.charges,
        max: item.maxCharges,
        _id: item.id,
      };
      this.system.resources[itemTag] = res;
      return true;
    }

    return false;
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  async createAttackFromWeapon(item) {
    if (item.type !== "weapon") throw new Error("Wrong Item type");

    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: this.name }));
    }

    const srcData = item.toObject().system;

    // Get attack template
    const attackItem = {
      name: item.name,
      type: "attack",
      img: item.img,
      system: {
        subType: "weapon",
        held: srcData.held,
        masterwork: srcData.masterwork,
        proficient: srcData.proficient,
        enh: srcData.enh,
        broken: srcData.broken,
        weaponGroups: srcData.weaponGroups,
        actions: deepClone(srcData.actions ?? []),
      },
    };

    // Add ensure action IDs are correct and unique
    for (const action of attackItem.system.actions) {
      action._id = randomID(16);
    }

    // Create attack
    const [newItem] = await this.createEmbeddedDocuments("Item", [attackItem]);
    if (!newItem) throw new Error("Failed to create attack from weapon");

    // Create link
    await item.createItemLink("children", "data", newItem, newItem.id);

    // Notify user
    ui.notifications.info(game.i18n.format("PF1.NotificationCreatedAttack", { item: item.name }));

    // Disable quick use of weapon
    await item.update({ "system.showInQuickbar": false });

    return newItem;
  }

  /**
   * Enable and configure a new spellbook.
   *
   * @param {object} [casting] Book casting configuration
   * @param {"prepared"|"spontaneous"|"hybrid"} [casting.type="prepared"] Spellbook type
   * @param {"high"|"med"|"low"} [casting.progression="high"] Casting progression type
   * @param {string} [casting.ability="int"] Spellcasting ability score ID
   * @param {"arcane"|"divine"|"psychic"|"alchemy"} [casting.spells="arcane"] Spell/spellcasting type
   * @param {string} [casting.class="_hd"] Class tag
   * @param {boolean} [casting.cantrips=true] Has cantrips?
   * @param {number} [casting.domainSlots=1] Number of domain slots.
   * @returns {Promise<this>} Promise to updated document
   */
  createSpellbook(casting = {}) {
    const books = this.system.attributes.spells.spellbooks ?? {};
    const oldBook = casting.class
      ? Object.entries(books).find(([_, book]) => !!book.class && book.class === casting.class)
      : null;

    let bookId;
    if (oldBook) {
      if (oldBook[1].inUse) return void ui.notifications.warn(game.i18n.localize("PF1.ErrorSpellbookExists"));
      bookId = oldBook[0]; // Reuse old book
    } else {
      const available = Object.entries(books).find(([bookId, bookData]) => bookData.inUse !== true);
      if (available === undefined) return void ui.notifications.warn(game.i18n.localize("PF1.ErrorNoFreeSpellbooks"));
      bookId = available[0];
    }

    // Add defaults when unconfigured
    // `class` causes problems if destructured, hence why it is here.
    casting.type ??= "prepared";
    casting.class ??= "_hd";
    casting.progression ??= "high";
    casting.spells ??= "arcane";
    casting.ability ??= "int";
    casting.cantrips ??= true;
    casting.domainSlots ??= 1;

    const updateData = {
      [`system.attributes.spells.spellbooks.${bookId}`]: {
        inUse: true,
        class: casting.class,
        spellPreparationMode: casting.type,
        casterType: casting.progression,
        ability: casting.ability,
        psychic: casting.spells === "psychic",
        arcaneSpellFailure: casting.spells === "arcane",
        hasCantrips: casting.cantrips,
        domainSlotValue: casting.domainSlots,
      },
    };

    return this.update(updateData);
  }

  /* -------------------------------------------- */

  getSkillInfo(skillId) {
    let skill, skillName, parentSkill;
    const [mainSkillId, subSkillDelim, subSkillId] = skillId.split(".", 3),
      isSubSkill = subSkillDelim === "subSkills" && !!subSkillId,
      mainSkill = this.system.skills[mainSkillId];
    if (!mainSkill) return null;

    if (isSubSkill) {
      skill = mainSkill.subSkills[subSkillId];
      if (!skill) return null;
      skillName = `${pf1.config.skills[mainSkillId]} (${skill.name})`;
      parentSkill = this.getSkillInfo(mainSkillId);
    } else {
      skill = mainSkill;
      skillName = skill.name ?? pf1.config.skills[skillId];
    }

    const result = duplicate(skill);
    result.id = skillId;
    result.name = skillName;

    if (parentSkill) result.parentSkill = parentSkill;

    return result;
  }

  /**
   * Roll a Skill Check
   *
   * @param {string} skillId      The skill id (e.g. "per", or "prf.subSkills.prf1")
   * @param {ActorRollOptions} [options={}]      Options which configure how the skill check is rolled
   * @returns {ChatMessage|object|void} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollSkill(skillId, options = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: this.name }));
    }

    if (callOldNamespaceHook("actorRoll", "pf1PreActorRollSkill", undefined, this, "skill", skillId, options) === false)
      return;

    const skl = this.getSkillInfo(skillId);

    const skillMatch = /^(?<mainSkillId>\w+).subSkills.(?<subSkillId>\w+)$/.exec(skillId);
    const { mainSkillId, subSkillId } = skillMatch?.groups ?? {};
    const haveParentSkill = !!subSkillId;

    // Add contextual attack string
    const rollData = this.getRollData();
    const noteObjects = this.getContextNotes(`skill.${skillId}`);
    if (haveParentSkill) noteObjects.push(...this.getContextNotes(`skill.${mainSkillId}`));
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

        if (haveParentSkill && cf.includes(`system.skills.${mainSkillId}.changeBonus`)) return true;
        return cf.includes(`system.skills.${skillId}.changeBonus`);
      }),
      { ignoreTarget: true }
    );

    // Add ability modifier
    if (skl.ability) {
      parts.push(`@abilities.${skl.ability}.mod[${pf1.config.abilities[skl.ability]}]`);
    }

    // Add rank
    if (skl.rank > 0) {
      parts.push(`${skl.rank}[${game.i18n.localize("PF1.SkillRankPlural")}]`);
      if (skl.cs) {
        parts.push(`${pf1.config.classSkillBonus}[${game.i18n.localize("PF1.CSTooltip")}]`);
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
          pf1.config.woundThresholdConditions[rollData.attributes.woundThresholds.level]
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

    const token = options.token ?? this.token;

    const rollOptions = {
      ...options,
      parts,
      rollData,
      flavor: game.i18n.format("PF1.SkillCheck", { skill: skl.name }),
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      compendium: { entry: pf1.config.skillCompendiumEntries[skillId] ?? skl.journal, type: "JournalEntry" },
      subject: { skill: skillId },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollSkill", this, rollOptions, skillId) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    if (result) Hooks.callAll("pf1ActorRollSkill", this, result, skillId);
    return result;
  }

  /* -------------------------------------------- */

  /**
   * Roll a 1d20 adding the actor's BAB
   *
   * @param {ActorRollOptions} [options]
   * @returns {ChatMessage|object|void} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollBAB(options = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: this.name }));
    }

    if (callOldNamespaceHook("actorRoll", "pf1PreActorRollBab", undefined, this, "bab", null, options) === false)
      return;

    const token = options.token ?? this.token;

    const rollOptions = {
      ...options,
      parts: [`${this.system.attributes.bab.total}[${game.i18n.localize("PF1.BABAbbr")}]`],
      subject: { core: "bab" },
      flavor: game.i18n.localize("PF1.BAB"),
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollBab", this, rollOptions) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    Hooks.callAll("pf1ActorRollBab", this, result);
    return result;
  }

  /**
   * Roll a basic CMB check for this actor
   *
   * @param {ActorRollOptions & {ranged: boolean, ability: string | null}} [options={}]
   * @returns {ChatMessage|object|void} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollCMB(options = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: this.name }));
    }

    options.ranged ??= false;
    options.ability ??= null;

    if (callOldNamespaceHook("actorRoll", "pf1PreActorRollCmb", undefined, this, "cmb", null, options) === false)
      return;

    // Add contextual notes
    const rollData = this.getRollData();
    const noteObjects = this.getContextNotes("misc.cmb");
    const notes = this.formatContextNotes(noteObjects, rollData);

    const parts = [];

    const describePart = (value, label) => parts.push(`${value}[${label}]`);
    const srcDetails = (s) => s?.reverse().forEach((d) => describePart(d.value, d.name, -10));
    srcDetails(this.sourceDetails["system.attributes.cmb.bonus"]);
    srcDetails(this.sourceDetails["system.attributes.attack.shared"]);

    const size = this.system.traits.size ?? "med";
    rollData.sizeBonus = pf1.config.sizeSpecialMods[size];
    if (rollData.sizeBonus != 0) parts.push(`@sizeBonus[${game.i18n.localize("PF1.Size")}]`);

    const changeSources = ["attack"];
    if (options.ranged === true) changeSources.push("rattack");
    else changeSources.push("mattack");
    const effectiveChanges = getHighestChanges(
      this.changes.filter((c) => changeSources.includes(c.subTarget)),
      { ignoreTarget: true }
    );
    effectiveChanges.forEach((ic) => describePart(ic.value, ic.flavor));

    const abl = options.ability ?? this.system.attributes.cmbAbility;
    const ablMod = this.system.abilities[abl]?.mod ?? 0;
    if (ablMod != 0) describePart(ablMod, pf1.config.abilities[abl]);

    // Add grapple note
    if (this.system.attributes.conditions.grappled) {
      notes.push("+2 to Grapple");
    }

    const props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    const token = options.token ?? this.token;

    const rollOptions = {
      ...options,
      parts,
      rollData,
      subject: { core: "cmb" },
      flavor: game.i18n.localize("PF1.CMB"),
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollCmb", this, rollOptions) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    Hooks.callAll("pf1ActorRollCmb", this, result);
    return result;
  }

  /**
   * Roll a generic attack
   *
   * @param {ActorRollOptions & {melee?: boolean}} [options={}]
   * @returns {ChatMessage|object|void} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollAttack(options = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: this.name }));
    }

    // Default to melee attacks
    options.melee ??= true;

    const sources = [
      ...this.sourceDetails["system.attributes.attack.shared"],
      // ...this.sourceDetails["system.attributes.attack.general"],
      // ...this.sourceDetails[`system.attributes.attack.${options.melee ? "melee" : "ranged"}`],
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
    const atkAbl = this.system.attributes?.attack?.[`${options.melee ? "melee" : "ranged"}Ability`];
    changes.push(`${this.system.abilities[atkAbl].mod}[${pf1.config.abilities[atkAbl]}]`);

    const size = this.system.traits.size ?? "med";
    rollData.sizeBonus = pf1.config.sizeMods[size];
    if (rollData.sizeBonus != 0) changes.push(`@sizeBonus[${game.i18n.localize("PF1.Size")}]`);

    const props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    const token = options.token ?? this.token;

    const rollOptions = {
      ...options,
      parts: changes,
      rollData,
      subject: { core: "attack" },
      flavor: game.i18n.localize(`PF1.${options.melee ? "Melee" : "Ranged"}`),
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollAttack", this, rollOptions) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    Hooks.callAll("pf1ActorRollAttack", this, result);
    return result;
  }

  /**
   * Roll a Caster Level check using a particular spellbook of this actor
   *
   * @param {string} bookId Spellbook identifier
   * @param {ActorRollOptions} [options={}] Roll options
   * @returns {ChatMessage|object|void} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollCL(bookId, options = {}) {
    const spellbook = this.system.attributes.spells.spellbooks[bookId];
    const rollData = duplicate(this.getRollData());
    rollData.cl = spellbook.cl.total;

    if (callOldNamespaceHook("actorRoll", "pf1PreActorRollCl", undefined, this, "cl", bookId, options) === false)
      return;

    // Set up roll parts
    const parts = [];

    const describePart = (value, label) => parts.push(`${value}[${label}]`);
    const srcDetails = (s) => s?.reverse().forEach((d) => describePart(d.value, d.name, -10));
    srcDetails(this.sourceDetails[`system.attributes.spells.spellbooks.${bookId}.cl.total`]);

    // Add contextual caster level string
    const notes = this.getContextNotesParsed(`spell.cl.${bookId}`);

    // Wound Threshold penalty
    const wT = this.getWoundThresholdData();
    if (wT.valid) notes.push(game.i18n.localize(pf1.config.woundThresholdConditions[wT.level]));

    const props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    const token = options.token ?? this.token;

    const rollOptions = {
      ...options,
      parts,
      rollData,
      subject: { core: "cl", spellbook: bookId },
      flavor: game.i18n.localize("PF1.CasterLevelCheck"),
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollCl", this, bookId, rollOptions) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    Hooks.callAll("pf1ActorRollCl", this, result, bookId);
    return result;
  }

  /**
   * Roll a concentration check using a particular spellbook of this actor
   *
   * @param {string} bookId Spellbook identifier
   * @param {ActorRollOptions} [options={}] Roll options
   * @returns {ChatMessage|object|void} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollConcentration(bookId, options = {}) {
    const spellbook = this.system.attributes.spells.spellbooks[bookId];
    const rollData = duplicate(this.getRollData());
    rollData.cl = spellbook.cl.total;
    rollData.mod = this.system.abilities[spellbook.ability]?.mod ?? 0;

    if (
      Hooks.call("actorRoll", "pf1PreActorRollConcentration", undefined, this, "concentration", bookId, options) ===
      false
    )
      return;

    // Set up roll parts
    const parts = [];

    const describePart = (value, label) => parts.push(`${value}[${label}]`);
    const srcDetails = (s) => s?.reverse().forEach((d) => describePart(d.value, d.name, -10));
    srcDetails(this.sourceDetails[`system.attributes.spells.spellbooks.${bookId}.concentration.total`]);

    // Add contextual concentration string
    const notes = this.getContextNotesParsed(`spell.concentration.${bookId}`);

    // Wound Threshold penalty
    const wT = this.getWoundThresholdData();
    if (wT.valid) notes.push(game.i18n.localize(pf1.config.woundThresholdConditions[wT.level]));
    // TODO: Make the penalty show separate of the CL.total.

    const props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    let formulaRoll = 0;
    if (spellbook.concentrationFormula.length)
      formulaRoll = RollPF.safeRoll(spellbook.concentrationFormula, rollData).total;
    rollData.formulaBonus = formulaRoll;

    const token = options.token ?? this.token;

    const rollOptions = {
      ...options,
      parts,
      rollData,
      subject: { core: "concentration", spellbook: bookId },
      flavor: game.i18n.localize("PF1.ConcentrationCheck"),
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollConcentration", this, rollOptions, bookId) === false) return;
    const result = pf1.dice.d20Roll(rollOptions);
    Hooks.callAll("pf1ActorRollConcentration", this, result, bookId);
    return result;
  }

  /**
   * @param {object} [options] Additional options
   * @param {boolean} [options.damageResistances=true] If false, damage resistances (DR, ER) are omitted.
   * @param {boolean} [options.damageVulnerabilities=true] If false, damage vulnerabilities are omitted.
   */
  getDefenseHeaders({ damageResistances = true, damageVulnerabilities = true } = {}) {
    const actorData = this.system;
    const headers = [];

    const reSplit = pf1.config.re.traitSeparator;
    const misc = [];
    const damageTypes = pf1.registry.damageTypes.getLabels();

    if (damageResistances) {
      // Damage reduction
      if (actorData.traits.dr.length) {
        headers.push({ header: game.i18n.localize("PF1.DamRed"), value: actorData.traits.dr.split(reSplit) });
      }
      // Energy resistance
      if (actorData.traits.eres.length) {
        headers.push({ header: game.i18n.localize("PF1.EnRes"), value: actorData.traits.eres.split(reSplit) });
      }
    }
    if (damageVulnerabilities) {
      // Damage vulnerabilities
      if (actorData.traits.dv.value.length || actorData.traits.dv.custom.length) {
        const value = [].concat(
          actorData.traits.dv.value.map((obj) => damageTypes[obj]),
          actorData.traits.dv.custom.length > 0 ? actorData.traits.dv.custom.split(";") : []
        );
        headers.push({ header: game.i18n.localize("PF1.DamVuln"), value: value });
      }
    }
    // Condition resistance
    if (actorData.traits.cres.length) {
      headers.push({ header: game.i18n.localize("PF1.ConRes"), value: actorData.traits.cres.split(reSplit) });
    }
    // Immunities
    if (
      actorData.traits.di.value.length ||
      actorData.traits.di.custom.length ||
      actorData.traits.ci.value.length ||
      actorData.traits.ci.custom.length
    ) {
      const value = [].concat(
        actorData.traits.di.value.map((obj) => damageTypes[obj]),
        actorData.traits.di.custom.length > 0 ? actorData.traits.di.custom.split(";") : [],
        actorData.traits.ci.value.map((obj) => {
          return pf1.config.conditionTypes[obj];
        }),
        actorData.traits.ci.custom.length > 0 ? actorData.traits.ci.custom.split(";") : []
      );
      headers.push({ header: game.i18n.localize("PF1.ImmunityPlural"), value: value });
    }
    // Spell Resistance
    if (actorData.attributes.sr.total > 0) {
      misc.push(game.i18n.format("PF1.SpellResistanceNote", { value: actorData.attributes.sr.total }));
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
        '</label> <div class="flexrow tag-list">' +
        notesHTMLParts.join("") +
        "</div></div>";
    }

    return [notes, notesHTML];
  }

  /**
   * Roll initiative for one or multiple Combatants associated with this actor.
   * If no combat exists, GMs have the option to create one.
   * If viewing a full Actor document, all Tokens which map to that actor will be targeted for initiative rolls.
   * If viewing a synthetic Token actor, only that particular Token will be targeted for an initiative roll.
   *
   * @override
   * @see {@link pf1.documents.CombatPF#rollInitiative}
   * @param {object} [options={}] Options which configure how initiative is rolled
   * @param {boolean} [options.createCombatants=false] - Create new Combatant entries for tokens associated with this actor.
   * @param {boolean} [options.rerollInitiative=false] - Reroll initiative for existing Combatants
   * @param {string|null} [options.dice=null] - Formula override for dice to roll
   * @param {string|null} [options.bonus=null] - Formula for bonus to initiative
   * @param {boolean} [options.skipDialog] - Skip roll dialog
   * @param {string} [options.rollMode] - Roll mode override
   * @returns {Promise<pf1.documents.CombatPF|null>} The updated Combat document in which initiative was rolled, or null if no initiative was rolled
   */
  async rollInitiative({
    createCombatants = false,
    rerollInitiative = false,
    initiativeOptions = {},
    dice = null,
    bonus = null,
    rollMode = null,
    skipDialog,
  } = {}) {
    // Obtain (or create) a combat encounter
    let combat = game.combat;
    if (!combat) {
      if (game.user.isGM && canvas.scene) {
        const cls = getDocumentClass("Combat");
        combat = await cls.create({ scene: canvas.scene.id, active: true });
      } else {
        ui.notifications.warn("COMBAT.NoneActive", { localize: true });
        return null;
      }
    }

    // Create new combatants
    if (createCombatants) {
      const tokens = this.isToken ? [this.token] : this.getActiveTokens().map((t) => t.document);
      const toCreate = [];
      if (tokens.length) {
        for (const t of tokens) {
          if (t.inCombat) continue;
          toCreate.push({ tokenId: t.id, sceneId: t.parent.id, actorId: this.id, hidden: t.hidden });
        }
      } else toCreate.push({ actorId: this.id, hidden: false });
      await combat.createEmbeddedDocuments("Combatant", toCreate);
    }

    // Roll initiative for combatants
    const combatants = combat.combatants
      .filter((c) => {
        if (c.actor?.id !== this.id) return false;
        return rerollInitiative || c.initiative === null;
      })
      .map((c) => c.id);

    // No combatants. Possibly from reroll being disabled.
    if (combatants.length == 0) return combat;

    mergeObject(initiativeOptions, { formula: dice, bonus, rollMode, skipDialog });
    await combat.rollInitiative(combatants, initiativeOptions);
    return combat;
  }

  /**
   * Roll a specific saving throw
   *
   * @param {"ref"|"fort"|"will"} savingThrowId Identifier for saving throw type.
   * @param {ActorRollOptions} [options={}] Roll options.
   * @returns {ChatMessage|object|void} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollSavingThrow(savingThrowId, options = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: this.name }));
    }

    if (
      callOldNamespaceHook("actorRoll", "pf1PreActorRollSave", undefined, this, "save", savingThrowId, options) ===
      false
    )
      return;

    // Add contextual notes
    const rollData = this.getRollData();
    const noteObjects = this.getContextNotes(`savingThrow.${savingThrowId}`);
    const notes = this.formatContextNotes(noteObjects, rollData);

    const parts = [];

    // Get base
    const base = this.system.attributes.savingThrows[savingThrowId]?.base;
    if (base) parts.push(`${base}[${game.i18n.localize("PF1.Base")}]`);

    // Add changes
    let changeBonus = [];
    const changes = this.changes.filter((c) => ["allSavingThrows", savingThrowId].includes(c.subTarget));
    {
      // Get damage bonus
      changeBonus = getHighestChanges(
        changes.filter((c) => {
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
      notes.push(game.i18n.localize(pf1.config.woundThresholdConditions[rollData.attributes.woundThresholds.level]));
      parts.push(
        `- @attributes.woundThresholds.penalty[${game.i18n.localize(
          pf1.config.woundThresholdConditions[rollData.attributes.woundThresholds.level]
        )}]`
      );
    }

    // Roll saving throw
    const props = this.getDefenseHeaders({ damageResistances: false, damageVulnerabilities: false });
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });
    const label = pf1.config.savingThrows[savingThrowId];

    const token = options.token ?? this.token;

    const rollOptions = {
      ...options,
      parts,
      rollData,
      flavor: game.i18n.format("PF1.SavingThrowRoll", { save: label }),
      subject: { save: savingThrowId },
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollSave", this, rollOptions, savingThrowId) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    Hooks.callAll("pf1ActorRollSave", this, result, savingThrowId);
    return result;
  }

  /* -------------------------------------------- */

  /**
   * Roll an Ability Test
   * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
   *
   * @param {string} abilityId    The ability ID (e.g. "str")
   * @param {object} [options={}]      Options which configure how ability tests are rolled
   * @returns {ChatMessage|object|void} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollAbilityTest(abilityId, options = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: this.name }));
    }

    if (
      callOldNamespaceHook("actorRoll", "pf1PreActorRollAbility", undefined, this, "ability", abilityId, options) ===
      false
    )
      return;

    // Add contextual notes
    const rollData = this.getRollData();
    const noteObjects = this.getContextNotes(`abilityChecks.${abilityId}`);
    const notes = this.formatContextNotes(noteObjects, rollData);

    const label = pf1.config.abilities[abilityId];
    const abl = this.system.abilities[abilityId];

    const parts = [`@abilities.${abilityId}.mod[${label}]`];
    if (abl.checkMod != 0) {
      const changes = this.sourceDetails[`system.abilities.${abilityId}.checkMod`];
      for (const c of changes) parts.push(`${c.value}[${c.name}]`);
    }
    if (this.system.attributes.energyDrain) {
      parts.push("-@attributes.energyDrain");
    }

    // Wound Threshold penalty
    if (rollData.attributes.woundThresholds.penalty > 0) {
      notes.push(game.i18n.localize(pf1.config.woundThresholdConditions[rollData.attributes.woundThresholds.level]));
      parts.push(
        `- @attributes.woundThresholds.penalty[${game.i18n.localize(
          pf1.config.woundThresholdConditions[rollData.attributes.woundThresholds.level]
        )}]`
      );
    }

    const props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    const token = options.token ?? this.token;

    const rollOptions = {
      ...options,
      parts,
      rollData,
      flavor: game.i18n.format("PF1.AbilityTest", { ability: label }),
      subject: { ability: abilityId },
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollAbility", this, rollOptions, abilityId) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    Hooks.callAll("pf1ActorRollAbility", this, result, abilityId);
    return result;
  }

  async rollDefenses(options) {
    foundry.utils.logCompatibilityWarning("Actor.rollDefenses is deprecated in favor of Actor.displayDefenseCard", {
      since: "PF1 0.82.3",
      until: "PF1 0.83.0",
    });

    return this.displayDefenseCard(options);
  }

  /**
   * Show defenses in chat
   *
   * @param {object} [options={}] Additional options
   * @param {string | null} [options.rollMode=null]   The roll mode to use for the roll; defaults to the user's current preference when `null`.
   * @param {TokenDocument} [options.token] Relevant token if any.
   */
  async displayDefenseCard({ rollMode = null, token } = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: this.name }));
    }
    const rollData = this.getRollData();
    const damageTypes = pf1.registry.damageTypes.getLabels();

    // Add contextual AC notes
    const acNoteObjects = this.getContextNotes("misc.ac");
    const acNotes = this.formatContextNotes(acNoteObjects, rollData);
    if (this.system.attributes.acNotes.length > 0) acNotes.push(...this.system.attributes.acNotes.split(/[\n\r]+/));

    // Add contextual CMD notes
    const cmdNoteObjects = this.getContextNotes("misc.cmd");
    const cmdNotes = this.formatContextNotes(cmdNoteObjects, rollData);
    if (this.system.attributes.cmdNotes.length > 0) cmdNotes.push(...this.system.attributes.cmdNotes.split(/[\n\r]+/));

    // Add contextual SR notes
    const srNoteObjects = this.getContextNotes("misc.sr");
    const srNotes = this.formatContextNotes(srNoteObjects, rollData);
    if (this.system.attributes.srNotes.length > 0) srNotes.push(...this.system.attributes.srNotes.split(/[\n\r]+/));

    // Add misc data
    const reSplit = pf1.config.re.traitSeparator;
    // Damage Reduction
    let drNotes = [];
    if (this.system.traits.dr.length) {
      drNotes = this.system.traits.dr.split(reSplit);
    }
    // Energy Resistance
    const energyResistance = [];
    if (this.system.traits.eres.length) {
      energyResistance.push(...this.system.traits.eres.split(reSplit));
    }
    // Damage Immunity
    if (this.system.traits.di.value.length || this.system.traits.di.custom.length) {
      const values = [
        ...this.system.traits.di.value.map((obj) => damageTypes[obj]),
        ...(this.system.traits.di.custom.length > 0 ? this.system.traits.di.custom.split(reSplit) : []),
      ];
      energyResistance.push(...values.map((o) => game.i18n.format("PF1.ImmuneTo", { immunity: o })));
    }
    // Damage Vulnerability
    if (this.system.traits.dv.value.length || this.system.traits.dv.custom.length) {
      const values = [
        ...this.system.traits.dv.value.map((obj) => damageTypes[obj]),
        ...(this.system.traits.dv.custom.length > 0 ? this.system.traits.dv.custom.split(reSplit) : []),
      ];
      energyResistance.push(...values.map((o) => game.i18n.format("PF1.VulnerableTo", { vulnerability: o })));
    }

    // Wound Threshold penalty
    const wT = this.getWoundThresholdData();
    if (wT.valid) {
      const wTlabel = game.i18n.localize(pf1.config.woundThresholdConditions[wT.level]);
      acNotes.push(wTlabel);
      cmdNotes.push(wTlabel);
    }

    // Get actor's token
    token ??= this.token;

    // Create message
    const actorData = this.system;
    const data = {
      actor: this,
      name: token?.name ?? this.name,
      tokenUuid: token?.uuid ?? null,
      ac: {
        normal: actorData.attributes.ac.normal.total,
        touch: actorData.attributes.ac.touch.total,
        flatFooted: actorData.attributes.ac.flatFooted.total,
        notes: acNotes,
      },
      cmd: {
        normal: actorData.attributes.cmd.total,
        flatFooted: actorData.attributes.cmd.flatFootedTotal,
        notes: cmdNotes,
      },
      misc: {
        sr: actorData.attributes.sr.total,
        srNotes: srNotes,
        drNotes: drNotes,
        energyResistance: energyResistance,
      },
    };
    // Add regeneration and fast healing
    if ((actorData.traits?.fastHealing || "").length || (actorData.traits?.regen || "").length) {
      data.regen = {
        regen: actorData.traits.regen,
        fastHealing: actorData.traits.fastHealing,
      };
    }

    setProperty(data, "flags.pf1.subject", "defenses");

    const chatData = {
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
      rollMode,
      flags: {
        core: {
          canPopout: true,
        },
      },
    };

    const msg = await createCustomChatMessage("systems/pf1/templates/chat/defenses.hbs", data, chatData);
  }

  /**
   * Easy way to toggle a condition.
   *
   * @param {string} conditionId A direct condition identiifer, as per PF1.conditions, such as `shaken` or `dazed`.
   * @returns {Promise<this>|undefined} Promise to updated document, or nothing if no update occurs.
   */
  async toggleCondition(conditionId) {
    conditionId = `system.attributes.conditions.${conditionId}`;

    const newStatus = !getProperty(this, conditionId);
    const deleteKey = conditionId.replace(/(\w+)$/, (condition) => `-=${condition}`);
    const updateData = newStatus ? { [conditionId]: true } : { [deleteKey]: null };
    await this.update(updateData);
  }

  /**
   * Easy way to set a condition.
   *
   * @param {string} key - A direct condition key, as per PF1.conditions, such as `shaken` or `dazed`.
   * @param {boolean} enabled - Whether to enable (true) the condition, or disable (false) it.
   */
  async setCondition(key, enabled) {
    key = `system.attributes.conditions.${key}`;

    const newStatus = !getProperty(this, key);
    if (newStatus !== enabled) return;
    const deleteKey = key.replace(/(\w+)$/, (condition) => `-=${condition}`);
    const updateData = newStatus ? { [key]: true } : { [deleteKey]: null };
    await this.update(updateData);
  }

  /**
   * Easy way to determine whether this actor has a condition.
   *
   * @param {string} conditionId Condition identifier, as per PF1.conditions, such as `shaken` or `dazed`.
   * @returns {boolean} Confirmation as boolean.
   */
  hasCondition(conditionId) {
    return this.system.attributes?.conditions?.[conditionId] === true;
  }

  /* -------------------------------------------- */

  /**
   * Wrapper for the static function, taking this actor as the only target.
   *
   * @param {number} value Value to adjust health by.
   * @param {object} options Additional options.
   */
  async applyDamage(value, options = {}) {
    return this.constructor.applyDamage(
      value,
      mergeObject(options, {
        targets: [this],
      })
    );
  }

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
   * @param {Array.<Token|Actor>} [options.targets] - Override the targets to apply damage to
   * @param {number} options.critMult - Critical multiplier as needed for Wounds & Vigor variant health rule. Set to 0 for non-critical hits.
   * @param {boolean} options.asWounds - Apply damage to wounds directly instead of vigor, as needed for Wounds & Vigor variant health rule.
   * @returns {Promise}
   */
  static async applyDamage(
    value,
    {
      forceDialog = false,
      reductionDefault = "",
      asNonlethal = false,
      targets = null,
      critMult = 0,
      asWounds = false,
    } = {}
  ) {
    const promises = [];
    let controlled = canvas.tokens.controlled,
      healingInvert = 1;

    // Override targets, if supplied
    if (targets instanceof Array) {
      controlled = targets.filter((o) => o instanceof Token || o instanceof Actor);
    }

    const healthConfig = game.settings.get("pf1", "healthConfig");

    const numReg = /(\d+)/g,
      sliceReg = /[^,;\n]*(\d+)[^,;\n]*/g,
      sliceReg2 = /[^,;\n]+/g;

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

      if (value == 0) return; // Early exit

      for (const t of controlled) {
        const a = t instanceof Token ? t.actor : t;

        if (!a.isOwner) {
          ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: this.name }));
          continue;
        }

        const actorType = { character: "pc", npc: "npc" }[a.type];
        const useWoundsAndVigor = healthConfig.variants[actorType]?.useWoundsAndVigor ?? false,
          hp = !useWoundsAndVigor ? a.system.attributes.hp : a.system.attributes.vigor,
          tmp = hp.temp || 0;

        const update = {};

        if (useWoundsAndVigor) {
          const currentHealth = hp.value;
          let woundAdjust = 0;

          if (asWounds) {
            woundAdjust -= value;
            value = 0;
          }

          // Temp HP adjustment
          const dt = value > 0 ? Math.min(tmp, value) : 0;
          value -= dt;

          // Nonlethal damage
          if (asNonlethal && value > 0) {
            // Wounds & Vigor
            if (currentHealth > 0) {
              value = Math.min(currentHealth, value);
            } else {
              woundAdjust -= critMult > 1 ? critMult : 1;
              value = 0; // No other bleedover to wounds
            }
          }

          // Create update data
          if (dt != 0) update["system.attributes.vigor.temp"] = tmp - dt;
          if (value != 0) {
            let newHP = Math.min(hp.value - value, hp.max);
            if (value > 0) {
              if (hp.value > 0) {
                if (newHP < 0) {
                  if (critMult > 0) {
                    woundAdjust -= -newHP;
                    woundAdjust -= critMult;
                  }
                  newHP = 0;
                }
              } else {
                woundAdjust -= value;
              }
            }

            if (newHP != hp.value) update["system.attributes.vigor.value"] = newHP;
          }
          if (woundAdjust != 0) {
            const wounds = a.data.attributes.wounds;
            update["system.attributes.wounds.value"] = Math.clamped(wounds.value + woundAdjust, 0, wounds.max);
          }
        }
        // Normal Hit Points
        else {
          // Nonlethal damage
          let nld = 0;
          if (asNonlethal && value > 0) {
            nld = Math.min(hp.max - hp.nonlethal, value);
            value -= nld;
          }

          // Temp HP adjustment
          const dt = value > 0 ? Math.min(tmp, value) : 0;

          // Create update data
          update["system.attributes.hp.nonlethal"] = hp.nonlethal + nld;
          update["system.attributes.hp.temp"] = tmp - dt;
          update["system.attributes.hp.value"] = Math.min(hp.value - (value - dt), hp.max);
        }

        promises.push(a.update(update));
      }
      return Promise.all(promises);
    };

    if (pf1.skipConfirmPrompt ? !forceDialog : forceDialog) {
      if (value < 0) {
        healingInvert = -1;
        value = -1 * value;
      }
      const tokens = controlled.map((tok) => {
        const isToken = tok instanceof Token;
        const actor = isToken ? tok.actor : tok;
        return {
          _id: isToken ? tok.id : actor.id,
          name: isToken ? tok.name : actor.name,
          isToken,
          dr: actor.system.traits.dr.match(sliceReg),
          eres: actor.system.traits.eres.match(sliceReg),
          di: [...actor.system.traits.di.value, ...(actor.system.traits.di.custom.match(sliceReg2) ?? [])],
          dv: [...actor.system.traits.dv.value, ...(actor.system.traits.dv.custom.match(sliceReg2) ?? [])],
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

        new Dialog(
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
               * @param {Element} e
               */
              function setReduction(e) {
                inp[0].querySelector('input[name="damage-reduction"]').value =
                  e.currentTarget.innerText.match(numReg) ?? "";
              }
              /**
               * @param {WheelEvent} event
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
            classes: [...Dialog.defaultOptions.classes, "pf1", "apply-hit-points"],
          }
        ).render(true);
      });
    } else return _submit();
  }

  /**
   * Returns effective Wound Threshold multiplier with rules and overrides applied.
   *
   * @param {object} [data]
   * @returns {number} Multiplier
   */
  getWoundThresholdMultiplier(data = null) {
    data = data ?? this.system;

    const hpconf = game.settings.get("pf1", "healthConfig").variants;
    const conf = this.type === "npc" ? hpconf.npc : hpconf.pc;
    const override = data.attributes.woundThresholds.override ?? -1;
    return override >= 0 && conf.allowWoundThresholdOverride ? override : conf.useWoundThresholds;
  }

  /**
   * Returns Wound Threshold relevant data.
   *
   * @param {object} data Provided valid rollData
   * @returns {{level:number,penalty:number,multiplier:number,valid:boolean}}
   */
  getWoundThresholdData(data = null) {
    data = data ?? this.system;

    const woundMult = this.getWoundThresholdMultiplier(data),
      woundLevel = data.attributes.woundThresholds.level ?? 0,
      woundPenalty = woundLevel * woundMult + (data.attributes.woundThresholds.mod ?? 0);
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
    const usage = this.type === "npc" ? hpconf.npc.useWoundThresholds : hpconf.pc.useWoundThresholds;
    const wt = this.system.attributes.woundThresholds;
    if (!usage) {
      wt.level = 0;
      wt.penaltyBase = 0;
      wt.penalty = 0;
      wt.mod = 0;
      return;
    }
    const hp = this.system.attributes.hp,
      curHP = hp.value,
      tempHP = hp.temp ?? 0,
      maxHP = hp.max;

    let level = usage > 0 ? Math.clamped(4 - Math.ceil(((curHP + tempHP) / maxHP) * 4), 0, 3) : 0;
    if (Number.isNaN(level)) level = 0; // Division by 0 due to max HP on new actors.

    const wtMult = this.getWoundThresholdMultiplier();
    const wtMod = wt.mod ?? 0;

    wt.level = level;
    wt.penaltyBase = level * wtMult; // To aid relevant formulas
    wt.penalty = level * wtMult + wtMod;

    const penalty = wt.penalty;
    const changeFlatKeys = pf1.config.woundThresholdChangeTargets;
    for (const fk of changeFlatKeys) {
      let flats = getChangeFlat.call(this, fk, "penalty");
      if (!(flats instanceof Array)) flats = [flats];
      for (const k of flats) {
        if (!k) continue;
        const curValue = getProperty(this, k) ?? 0;
        setProperty(this, k, curValue - penalty);
      }
    }
  }

  get allSkills() {
    const result = [];
    for (const [k, s] of Object.entries(this.system.skills)) {
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

  /**
   * An array of all context note data for this actor.
   *
   * @type {{notes: {text: string, subTarget: string}[], item: ItemPF}[]}
   */
  get allNotes() {
    return this.items
      .filter((item) => item.isActive && item.system.contextNotes?.length > 0)
      .map((item) => ({ notes: item.system.contextNotes, item }));
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
   * @param {string|Handlebars.SafeString} context - The context to draw from.
   */
  getContextNotes(context) {
    if (context.string) context = context.string;
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
          .filter(
            (note) => note.subTarget === context || note.subTarget === `${ability}Skills` || note.subTarget === "skills"
          )
          .map((note) => note.text);
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

      if (this.system.attributes.saveNotes != null && this.system.attributes.saveNotes !== "") {
        result.push({ notes: [this.system.attributes.saveNotes], item: null });
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

      const spellbookNotes = this.system.attributes?.spells?.spellbooks?.[spellbookKey]?.concentrationNotes;
      if (spellbookNotes?.length) {
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

      const spellbookNotes = this.system.attributes?.spells?.spellbooks?.[spellbookKey]?.clNotes;
      if (spellbookNotes?.length) {
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
   * @param {object} [options] Additional options
   * @param {boolean} [options.roll=true] Whether to roll inline rolls or not.
   * @returns {string[]} The resulting notes, already parsed.
   */
  getContextNotesParsed(context, { roll = true } = {}) {
    const noteObjects = this.getContextNotes(context);

    return noteObjects.reduce((cur, o) => {
      for (const note of o.notes) {
        const enrichOptions = {
          rollData: o.item != null ? o.item.getRollData() : this.getRollData(),
          rolls: roll,
          async: false,
        };
        cur.push(enrichHTMLUnrolled(note, enrichOptions));
      }

      return cur;
    }, []);
  }

  formatContextNotes(notes, rollData, { roll = true } = {}) {
    const result = [];
    rollData ??= this.getRollData();
    for (const noteObj of notes) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (const note of noteObj.notes) {
        result.push(...note.split(/[\n\r]+/).map((subnote) => enrichHTMLUnrolled(subnote, { rollData, rolls: roll })));
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
        await item._onLevelChange(0, item.system.level);
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
    // Init base data
    const attributes = this.system.attributes;
    if (attributes.encumbrance === undefined) attributes.encumbrance = {};
    const encumbrance = attributes.encumbrance;

    const carry = this.getCarryCapacity();
    // Set levels
    encumbrance.levels = carry;
    encumbrance.levels.carry = carry.heavy * 2;
    encumbrance.levels.drag = carry.heavy * 5;

    const carriedWeight = Math.max(0, this.getCarriedWeight());
    encumbrance.carriedWeight = Math.round(carriedWeight * 10) / 10;

    // Determine load level
    let encLevel = pf1.config.encumbranceLevels.light;
    if (carriedWeight > 0) {
      if (carriedWeight > encumbrance.levels.medium) encLevel = pf1.config.encumbranceLevels.heavy;
      else if (carriedWeight > encumbrance.levels.light) encLevel = pf1.config.encumbranceLevels.medium;
    }
    encumbrance.level = encLevel;

    const result = {
      maxDexBonus: null,
      acp: 0,
    };

    switch (encumbrance.level) {
      case pf1.config.encumbranceLevels.medium:
        result.acp = 3;
        result.maxDexBonus = 3;
        break;
      case pf1.config.encumbranceLevels.heavy:
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
      Object.values(this.system.currency).reduce((cur, amount) => {
        return (parseInt(cur) || 0) + amount;
      }, 0) / coinWeightDivisor
    );
  }

  getCarryCapacity() {
    // Determine carrying capacity
    const carryCapacity = this.system.details.carryCapacity;
    const carryStr = this.system.abilities.str.total + carryCapacity.bonus.total;
    let carryMultiplier = carryCapacity.multiplier.total;
    const size = this.system.traits.size;
    if (this.system.attributes.quadruped) carryMultiplier *= pf1.config.encumbranceMultipliers.quadruped[size];
    else carryMultiplier *= pf1.config.encumbranceMultipliers.normal[size];
    const table = pf1.config.encumbranceLoads;

    let heavy = Math.floor(table[carryStr] * carryMultiplier);
    if (carryStr >= table.length) {
      const multiplierCount = (carryStr - (table.length - 1)) / 10;
      heavy = Math.floor(table[table.length - 1] * Math.pow(4, multiplierCount) * carryMultiplier);
    }
    // Convert to world unit system
    heavy = pf1.utils.convertWeight(heavy);

    return {
      light: Math.floor(heavy / 3),
      medium: Math.floor((heavy / 3) * 2),
      heavy: heavy,
    };
  }

  getCarriedWeight() {
    // Determine carried weight
    const physicalItems = this.items.filter((o) => {
      return o.system.weight != null;
    });
    const weight = physicalItems.reduce((cur, o) => {
      if (!o.system.carried) return cur;
      return cur + o.system.weight.total;
    }, this._calculateCoinWeight());

    return pf1.utils.convertWeight(weight);
  }

  /**
   * @param {object} [options] Additional options
   * @param {boolean} [options.inLowestDenomination=false] Use copper for calculations and return.
   * @returns {number} The total amount of currency this actor has, in gold pieces.
   */
  mergeCurrency({ inLowestDenomination = false } = {}) {
    const total =
      this.getTotalCurrency("currency", { inLowestDenomination }) +
      this.getTotalCurrency("altCurrency", { inLowestDenomination });
    return inLowestDenomination ? total : total / 100;
  }

  getTotalCurrency(category = "currency", { inLowestDenomination = false } = {}) {
    const currencies = this.system[category];
    if (!currencies) {
      console.error(`Currency type "${category}" not found.`);
      return NaN;
    }
    const total = currencies.pp * 1000 + currencies.gp * 100 + currencies.sp * 10 + currencies.cp;
    return inLowestDenomination ? total : total / 100;
  }

  /**
   * Converts currencies of the given category to the given currency type
   *
   * @param {string} category Either 'currency' or 'altCurrency'.
   * @param {string} type Either 'pp', 'gp', 'sp' or 'cp'. Converts as much currency as possible to this type.
   * @returns {Promise<this>|undefined} Updated document or undefined if no update occurred.
   */
  convertCurrency(category = "currency", type = "pp") {
    const currency = {
      pp: 0,
      gp: 0,
      sp: 0,
      cp: this.getTotalCurrency(category, { inLowestDenomination: true }),
    };

    if (!Number.isFinite(currency.cp)) {
      console.error(`Invalid total currency "${currency.cp}" in "${category}" category`);
      return;
    }

    const types = { pp: 3, gp: 2, sp: 1, cp: 0 };
    const largestType = types[type];

    if (largestType >= types.pp) {
      currency.pp = Math.floor(currency.cp / 1_000);
      currency.cp -= currency.pp * 1_000;
    }
    if (largestType >= types.gp) {
      currency.gp = Math.max(0, Math.floor(currency.cp / 100));
      currency.cp -= currency.gp * 100;
    }
    if (largestType >= types.sp) {
      currency.sp = Math.max(0, Math.floor(currency.cp / 10));
      currency.cp -= currency.sp * 10;
    }

    // Sanity check
    if (currency.cp < 0) currency.cp = 0;

    const updateData = { system: { [category]: currency } };

    return this.update(updateData);
  }

  /**
   * Prepare armor/shield data for roll data
   *
   * @param {object} equipment Equipment info
   * @param {string} equipment.id Item ID
   * @param {string} equipment.type Armor/Shield type
   * @param {object} armorData Armor data object
   * @private
   */
  _prepareArmorData({ id, type } = {}, armorData) {
    armorData.type = type ?? null;

    const itemData = this.items.get(id)?.system;
    if (!itemData) return;

    armorData.ac = itemData.armor.value ?? 0;
    armorData.enh = itemData.armor.enh ?? 0;
    armorData.total = armorData.ac + armorData.enh;
    if (!Number.isFinite(armorData.total)) armorData.total = 0;
  }

  getRollData(options = { refresh: false }) {
    let result;

    // Return cached data, if applicable
    const skipRefresh = !options.refresh && this._rollData;
    if (skipRefresh) {
      result = this._rollData;

      // Clear certain fields
      const clearFields = pf1.config.temporaryRollDataFields.actor;
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
    } else {
      result = deepClone(this.system);
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
    result.conditions ??= {};
    result.conditions.loseDexToAC = this.changeFlags?.loseDexToAC ?? false;

    // Return cached data, if applicable
    if (skipRefresh) return result;

    /* ----------------------------- */
    /* Set the following data on a refresh
    /* ----------------------------- */

    // Set size index
    const sizeChart = Object.keys(pf1.config.sizeChart);
    result.size = sizeChart.indexOf(result.traits.size);

    // Add more info for formulas
    result.armor = { type: 0, total: 0, ac: 0, enh: 0 };
    result.shield = { type: 0, total: 0, ac: 0, enh: 0 };

    // Determine equipped armor type
    const eqData = this.equipment;
    if (eqData) {
      this._prepareArmorData(eqData.armor, result.armor);
      this._prepareArmorData(eqData.shield, result.shield);
    }

    // Add spellbook info
    result.spells = result.attributes.spells.spellbooks;
    for (const [k, book] of Object.entries(result.spells)) {
      book.abilityMod = result.abilities[book.ability]?.mod ?? 0;
      // Add alias
      if (book.class && book.class !== "_hd") result.spells[book.class] ??= book;
    }

    // Add item dictionary flags
    result.dFlags = this.itemFlags?.dictionary ?? {};

    // Add range info
    result.range = this.constructor.getReach(this.system.traits.size, this.system.traits.stature);

    // Add class info
    result.classes = this.classes;

    this._rollData = result;

    // Call hook
    if (Hooks.events["pf1GetRollData"]?.length > 0) Hooks.callAll("pf1GetRollData", this, result);
    callOldNamespaceHookAll("pf1.getRollData", "pf1GetRollData", this, result, true);

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

  async deleteEmbeddedDocuments(embeddedName, data, options = {}) {
    if (embeddedName === "Item") {
      if (!(data instanceof Array)) data = [data];

      // Add children to list of items to be deleted
      const _addChildren = async function (id) {
        const item = this.items.get(id);
        const children = await item.getLinkedItems("children");
        for (const child of children) {
          if (!data.includes(child.id)) {
            data.push(child.id);
            await _addChildren.call(this, child.id);
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
    return this.items
      .filter(
        (o) =>
          o.isActive &&
          o.system.showInQuickbar === true &&
          ["weapon", "equipment", "consumable", "attack", "spell", "feat"].includes(o.type) &&
          !o.showUnidentifiedData
      )
      .sort((a, b) => a.sort - b.sort)
      .map((o) => {
        return {
          item: o,
          isSingleUse: o.isSingleUse,
          get haveAnyCharges() {
            return this.item.isCharged;
          },
          maxCharge: o.maxCharges,
          get charges() {
            return this.item.charges;
          },
        };
      });
  }

  /**
   * @param {DocumentModificationContext} context
   */
  async toggleConditionStatusIcons(context = {}) {
    if (this._states.togglingStatusIcons) return;
    this._states.togglingStatusIcons = true;

    if (!this.testUserPermission(game.user, "OWNER")) return;

    const buffTextures = this._calcBuffActiveEffects();
    const fx = [...this.effects];

    // Create and delete buff ActiveEffects
    const toCreate = [];
    const toDelete = [];
    const toUpdate = [];
    for (const [id, obj] of Object.entries(buffTextures)) {
      const existing = fx.find((f) => {
        return f.origin === id || f.flags.pf1?.origin?.item === obj.id;
      });
      if (!existing) {
        if (obj.active) toCreate.push(obj.item.getRawEffectData());
      } else {
        if (!obj.active) toDelete.push(existing.id);
        else {
          const existingData = existing.toObject();
          const mergedData = foundry.utils.mergeObject(existingData, obj.item.getRawEffectData(), { inplace: false });
          const hideIcon = obj.item.system.hideFromToken || game.settings.get("pf1", "hideTokenConditions");
          if (hideIcon) mergedData.icon = null;
          const diffData = foundry.utils.diffObject(existingData, mergedData);
          if (!foundry.utils.isEmpty(diffData)) {
            diffData._id = existing.id;
            toUpdate.push(diffData);
          }
        }
      }
    }

    // Create and delete condition ActiveEffects
    for (const condKey of Object.keys(pf1.config.conditions)) {
      const idx = fx.findIndex((e) => e.getFlag("core", "statusId") === condKey);
      const hasCondition = this.system.attributes.conditions[condKey] === true;
      const hasEffectIcon = idx >= 0;

      if (hasCondition && !hasEffectIcon) {
        toCreate.push({
          "flags.core.statusId": condKey,
          name: pf1.config.conditions[condKey],
          icon: pf1.config.conditionTextures[condKey],
          label: pf1.config.conditions[condKey],
        });
      } else if (!hasCondition && hasEffectIcon) {
        const removeEffects = fx.filter((e) => e.getFlag("core", "statusId") === condKey);
        toDelete.push(...removeEffects.map((e) => e.id));
      }
    }

    // Create sub-contexts and disable render if more updates are done
    const deleteContext = deepClone(context);
    if (context.render !== false) deleteContext.render = !toCreate.length && !toUpdate.length;
    const createContext = deepClone(context);
    if (context.render !== false) createContext.render = !toUpdate.length;

    if (toDelete.length) await this.deleteEmbeddedDocuments("ActiveEffect", toDelete, deleteContext);
    if (toCreate.length) await this.createEmbeddedDocuments("ActiveEffect", toCreate, createContext);
    if (toUpdate.length) await this.updateEmbeddedDocuments("ActiveEffect", toUpdate, context);
    this._states.togglingStatusIcons = false;
  }

  // @Object { id: { title: String, type: buff/string, img: imgPath, active: true/false }, ... }
  _calcBuffActiveEffects() {
    const buffs = this.items.filter((o) => o.type === "buff");
    return buffs.reduce((acc, buff) => {
      const id = buff.uuid;
      acc[id] ??= { id: buff.id, label: buff.name, icon: buff.img, item: buff };
      acc[id].active = buff.isActive;
      return acc;
    }, {});
  }

  refreshAbilityModifiers() {
    for (const k of Object.keys(this.system.abilities)) {
      const total = this.system.abilities[k].total;
      const penalty = Math.abs(this.system.abilities[k].penalty || 0);
      const damage = this.system.abilities[k].damage;
      const newMod = getAbilityModifier(total, { penalty, damage });
      this.system.abilities[k].mod = newMod;

      // Store previous ability score
      if (!pf1.migrations.isMigrating && this._initialized && this._prevAbilityScores) {
        const prevMod = this._prevAbilityScores?.[k].mod ?? 0;
        const diffMod = newMod - prevMod;
        const result = this.system.abilities[k].mod + diffMod;

        this._prevAbilityScores[k] = {
          total,
          mod: result,
        };
      }
    }
  }

  async importFromJSON(json) {
    // Set _initialized flag to prevent faults (such as HP changing incorrectly)
    this._initialized = false;

    // Import from JSON
    const data = JSON.parse(json);
    delete data._id;
    data.effects = [];

    // Update data
    return this.update(data, { diff: false, recursive: false });
  }

  /**
   * @typedef MaxAndValue
   * @type {object}
   * @property {number} max - The maximum value.
   * @property {number} value - The current value.
   * @returns {MaxAndValue} An object with a property `value` which refers to the current used feats, and `max` which refers to the maximum available feats.
   */
  getFeatCount() {
    const result = { max: 0, value: 0 };
    result.value = this.items.filter((o) => {
      return o.type === "feat" && o.system.subType === "feat" && !o.system.disabled;
    }).length;

    // Add feat count by level
    const totalLevels = this.items
      .filter((o) => o.type === "class" && ["base", "npc", "prestige", "racial"].includes(o.system.subType))
      .reduce((cur, o) => {
        return cur + o.hitDice;
      }, 0);
    result.max += Math.ceil(totalLevels / 2);

    // Bonus feat formula
    const featCountRoll = RollPF.safeRoll(this.system.details.bonusFeatFormula || "0", this.getRollData());
    result.max += featCountRoll.total;
    if (featCountRoll.err) {
      ui.notifications.error(
        game.i18n.format("PF1.ErrorActorFormula", {
          context: game.i18n.localize("PF1.BonusFeatFormula"),
          name: this.actor.name,
        })
      );
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
    return this.itemFlags.boolean[flagName] != null;
  }

  /**
   * Restore spellbook used slots and spellpoints.
   *
   * @param {object} [options] Additional options
   * @param {boolean} [options.commit=true] If false, return update data object instead of directly updating the actor.
   * @param {object} [options.rollData] Roll data
   * @returns {Promise<this|object>} Result of update or the update data.
   */
  async resetSpellbookUsage({ commit = true, rollData } = {}) {
    const actorData = this.system;
    const updateData = {};

    rollData ??= this.getRollData();

    // Update spellbooks
    for (const [bookId, spellbook] of Object.entries(actorData.attributes.spells.spellbooks)) {
      // Restore spellbooks using spell points
      if (spellbook.spellPoints.useSystem) {
        // Try to roll restoreFormula, fall back to restoring max spell points
        let restorePoints = spellbook.spellPoints.max;
        if (spellbook.spellPoints.restoreFormula) {
          const restoreRoll = RollPF.safeRoll(spellbook.spellPoints.restoreFormula, rollData);
          if (restoreRoll.err) console.error(restoreRoll.err, spellbook.spellPoints.restoreFormula);
          else restorePoints = Math.min(spellbook.spellPoints.value + restoreRoll.total, spellbook.spellPoints.max);
        }
        updateData[`system.attributes.spells.spellbooks.${bookId}.spellPoints.value`] = restorePoints;
      }
      // Restore spell slots
      else {
        for (let level = 0; level < 10; level++) {
          updateData[`system.attributes.spells.spellbooks.${bookId}.spells.spell${level}.value`] =
            spellbook.spells[`spell${level}`]?.max ?? 0;
        }
      }
    }

    if (commit) return this.update(updateData);
    return updateData;
  }

  /**
   * @param {object} [options] Additional options
   * @param {boolean} [options.commit=true] If false, return update data object instead of directly updating the actor.
   * @param {object} [options.updateData] Update data to complement or read changed values from.
   * @returns {Promise<Item[]|object[]>} Result of an update or the update data.
   */
  async rechargeItems({ updateData = {}, commit = true } = {}) {
    const actorData = this.system;
    const itemUpdates = [];

    // Get data at path, either from passed updateData or directly from actor
    const getPathData = (path) => updateData[path] ?? getProperty(this, path);

    // Update charged items
    for (const item of this.items) {
      const itemUpdate = (await item.recharge({ period: "day", commit: false })) ?? {};
      itemUpdate.system ??= {};

      const itemData = item.system;
      if (item.type === "spell") {
        const bookId = itemData.spellbook,
          level = itemData.level;

        const spellbook = getProperty(actorData, `attributes.spells.spellbooks.${bookId}`);

        // Skip spells with missing spellbook
        if (!spellbook) {
          console.warn(`${item.name} [${item.id}] has invalid spellbook: "${bookId}"`);
          continue;
        }

        // Spontaneous don't store casts in individual spells
        if (spellbook.spontaneous) continue;

        if (itemData.preparation.preparedAmount < itemData.preparation.maxAmount) {
          itemUpdate["system.preparation.preparedAmount"] = itemData.preparation.maxAmount;
          itemUpdates.push(itemUpdate);
        }
        if (!item.system.domain) {
          let sbUses = getPathData(`system.attributes.spells.spellbooks.${bookId}.spells.spell${level}.value`) || 0;
          sbUses -= itemData.preparation.maxAmount;
          updateData[`system.attributes.spells.spellbooks.${bookId}.spells.spell${level}.value`] = sbUses;
        }
      }

      // Update charged actions
      if (item.system.actions?.length > 0) {
        const actions = deepClone(item.system.actions);
        let _changed = false;
        for (const actionData of actions) {
          if (actionData.uses.self?.per === "day") {
            const maxUses = actionData.uses.self.max || 0;
            if (actionData.uses.self.value < maxUses) {
              actionData.uses.self.value = maxUses;
              _changed = true;
            }
          }
        }

        if (_changed) {
          itemUpdate["system.actions"] = actions;
        }
      }

      // Append update to queue
      if (!foundry.utils.isEmpty(itemUpdate)) {
        itemUpdate._id = item.id;
        itemUpdates.push(itemUpdate);
      }
    }

    if (commit) {
      if (itemUpdates.length) return this.updateEmbeddedDocuments("Item", itemUpdates);
    } else return itemUpdates;
    return [];
  }

  /**
   * Handler for character healing during rest.
   *
   * @param {object} options Resting options.
   * @returns {object} Update data object
   */
  _restingHeal(options = {}) {
    const actorData = this.system,
      hp = actorData.attributes.hp;
    const { hours, longTermCare } = options;
    const updateData = {};

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

    updateData["system.attributes.hp.value"] = Math.min(hp.value + heal.hp, hp.max);
    updateData["system.attributes.hp.nonlethal"] = Math.max(0, (hp.nonlethal || 0) - heal.nonlethal);
    for (const [key, abl] of Object.entries(actorData.abilities)) {
      const dmg = Math.abs(abl.damage);
      updateData[`system.abilities.${key}.damage`] = Math.max(0, dmg - heal.abl);
    }

    return updateData;
  }

  /**
   * Perform all changes related to an actor resting, including restoring HP, ability scores, item uses, etc.
   *
   * @see {@link hookEvents!pf1PreActorRest pf1PreActorRest hook}
   * @see {@link hookEvents!pf1ActorRest pf1ActorRest hook}
   * @param {Partial<ActorRestOptions>} options - Options affecting an actor's resting
   * @returns {Promise<ActorRestData | void>} Updates applied to the actor, if resting was completed
   */
  async performRest(options = {}) {
    const { restoreHealth = true, longTermCare = false, restoreDailyUses = true, hours = 8 } = options;
    const actorData = this.system;

    const updateData = {};
    // Restore health and ability damage
    if (restoreHealth === true) {
      const healUpdate = this._restingHeal(options);
      mergeObject(updateData, healUpdate);
    }

    let itemUpdates = [];
    // Restore daily uses of spells, feats, etc.
    if (restoreDailyUses === true) {
      const spellbookUpdates = await this.resetSpellbookUsage({ commit: false });
      mergeObject(updateData, spellbookUpdates);

      itemUpdates = await this.rechargeItems({ commit: false, updateData });
    }

    options = { restoreHealth, restoreDailyUses, longTermCare, hours };
    let allowed = Hooks.call("pf1PreActorRest", this, options, updateData, itemUpdates);
    allowed = callOldNamespaceHook("actorRest", "pf1PreActorRest", allowed, this, options, updateData, itemUpdates);
    if (allowed === false) return;

    if (itemUpdates.length) await this.updateEmbeddedDocuments("Item", itemUpdates);
    if (!foundry.utils.isEmpty(updateData.system)) await this.update(updateData);

    Hooks.callAll("pf1ActorRest", this, options, updateData, itemUpdates);
    return { options, updateData, itemUpdates };
  }

  /**
   * @override
   */
  async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
    let doc = this;
    const current = getProperty(this.system, attribute),
      updates = {};
    const resourceMatch = /^resources\.(?<tag>[^.]+)$/.exec(attribute);
    if (resourceMatch) {
      const { tag } = resourceMatch.groups;
      const itemId = this.system.resources[tag]?._id;
      doc = this.items.get(itemId);
    }
    if (!doc) return;
    const updateData = {};

    // Special keys
    if (attribute === "attributes.hp") {
      if (!isDelta) value = (current.temp + current.value - value) * -1;
      let dt = value;
      if (current.temp > 0 && value < 0) {
        dt = Math.min(0, current.temp + value);
        updates["system.attributes.hp.temp"] = Math.max(0, current.temp + value);
      }
      updates["system.attributes.hp.value"] = Math.min(current.value + dt, current.max);
    } else if (attribute === "attributes.vigor") {
      if (!isDelta) value = (current.temp + current.value - value) * -1;
      let dt = value;
      if (current.temp > 0 && value < 0) {
        dt = Math.min(0, current.temp + value);
        updates["system.attributes.vigor.temp"] = Math.max(0, current.temp + value);
      }
      updates["system.attributes.vigor.value"] = Math.min(current.value + dt, current.max);
    }
    // Absolute
    else if (!isDelta) {
      if (doc instanceof Actor) {
        if (isBar) updates[`system.${attribute}.value`] = value;
        else updates[`system.${attribute}`] = value;
      } else {
        updates["system.uses.value"] = value;
      }
      // Relative
    } else {
      if (doc instanceof Actor) {
        if (isBar)
          updates[`system.${attribute}.value`] = Math.clamped(current.min || 0, current.value + value, current.max);
        else updates[`system.${attribute}`] = current + value;
      } else {
        updates["system.uses.value"] = current.value + value;
      }
    }

    const allowed = Hooks.call("modifyTokenAttribute", { attribute, value, isDelta, isBar }, updates);
    return allowed !== false ? doc.update(updates) : this;
  }

  getItemByTag(tag) {
    return this.items.find((o) => o.system.tag === tag);
  }

  /**
   * Cached result of .itemTypes
   *
   * @private
   */
  _itemTypes;

  /**
   * Cached override
   *
   * @override
   */
  get itemTypes() {
    this._itemTypes ??= super.itemTypes;
    return this._itemTypes;
  }

  /**
   * The VisionPermissionSheet instance for this actor
   *
   * @type {VisionPermissionSheet}
   */
  get visionPermissionSheet() {
    this._visionPermissionSheet ??= new VisionPermissionSheet(this);
    return this._visionPermissionSheet;
  }
}

/**
 * @typedef {object} ActorRestOptions
 * Options given to {@link ActorPF.performRest} affecting an actor's resting.
 * @property {boolean} restoreHealth - Whether the actor's health should be restored. Defaults to `true`.
 * @property {boolean} restoreDailyUses - Whether daily uses of spells and abilities should be restored. Defaults to `true`.
 * @property {boolean} longTermCare - Whether additional hit and ability score points should be restored through the Heal skill. Defaults to `false`.
 * @property {number} hours - The number of hours the actor will rest. Defaults to `8`.
 */

/**
 * @typedef {object} ActorRestData
 * @property {ActorRestOptions} options - Options for resting
 * @property {object} updateData - Updates applied to the actor
 * @property {object[]} itemUpdates - Updates applied to the actor's items
 */
