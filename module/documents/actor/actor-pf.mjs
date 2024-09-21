import { ActorBasePF } from "./actor-base.mjs";
import { ItemPF, ItemRacePF } from "@item/_module.mjs";
import { createTag, fractionalToString, enrichHTMLUnrolled, openJournal } from "@utils";
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
import { VisionSharingSheet } from "module/applications/vision-sharing.mjs";
import { Resource } from "./components/resource.mjs";

/**
 * Extend the base Actor class to implement additional game system logic.
 */
export class ActorPF extends ActorBasePF {
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

    if (this._rollData === undefined)
      /**
       * Cached roll data for this item.
       *
       * @internal
       * @type {object}
       */
      this._rollData = null;

    if (this.containerItems === undefined)
      /**
       * All items this actor is holding in containers.
       *
       * @type {ItemPF[]}
       */
      this.containerItems = [];

    this._visionSharingSheet ??= null;
  }

  /**
   * @internal
   * @override
   * @param {object} data
   * @param {object} context
   * @param {User} user
   */
  async _preCreate(data, context, user) {
    await super._preCreate(data, context, user);

    const updates = this.preCreateData(data, context, user);

    if (Object.keys(updates).length) this.updateSource(updates);
  }

  /**
   * Meant to be overridden.
   *
   * @abstract
   * @protected
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

  /**
   * Generic chatlog listener
   *
   * @internal
   * @param {JQuery<HTMLElement>} html
   */
  static chatListeners(html) {
    html.on("click", "button[data-action], a[data-action]", this._onChatCardButtonAction.bind(this));
  }

  /**
   * @internal
   * @param {Event} event
   */
  static async _onChatCardButtonAction(event) {
    event.preventDefault();

    // Extract card data
    const button = event.currentTarget;
    const card = button.closest(".chat-card");
    const action = button.dataset.action;

    // Roll saving throw
    if (action === "defense-save") {
      const messageId = card.closest(".chat-message").dataset.messageId;
      const message = game.messages.get(messageId);
      const actor = ChatMessage.getSpeakerActor(message.speaker);
      const saveId = button.dataset.save;
      actor.rollSavingThrow(saveId, { event });
    } else if (action === "save") {
      const saveId = button.dataset.type;

      let actors = canvas.tokens.controlled.map((t) => t.actor).filter((t) => !!t);
      if (actors.length == 0 && game.user.character) actors = [game.user.character];

      let noSound = false;
      for (const actor of actors) {
        actor?.rollSavingThrow(saveId, { event, noSound });
        noSound = true;
      }
    }
    // Show compendium entry
    else if (action === "open-compendium-entry") {
      openJournal(button.dataset.compendiumEntry);
    }
  }

  /* -------------------------------------------- */

  /**
   * @type {number} - Effective spell failure percentage as number from 0 to 100.
   */
  get spellFailure() {
    return this.itemTypes.equipment
      .filter((o) => o.system.equipped === true)
      .reduce((cur, o) => cur + (o.system.spellFailure || 0), 0);
  }

  /**
   * Actor's current race item.
   *
   * @type {pf1.documents.item.ItemRacePF|null}
   */
  get race() {
    return this.itemTypes.race[0] ?? null;
  }

  /**
   * @internal
   * @param {SourceInfo} src - Source info
   */
  static _getSourceLabel(src) {
    const item = src.change?.parent;
    if (item) {
      const subtype = item.subType;
      let typeLabel;

      if (subtype && ((item.system.identified ?? true) || game.user.isGM) && !["weapon"].includes(item.type))
        typeLabel = game.i18n.localize(`PF1.Subtypes.Item.${item.type}.${subtype}.Single`);
      else typeLabel = game.i18n.localize(`TYPES.Item.${item.type}`);

      return `${src.name} (${typeLabel})`;
    }

    return src.name;
  }

  /**
   * Retrieve valid skill change targets for this actor.
   *
   * @internal
   */
  get _skillTargets() {
    const skills = [];
    for (const [sklKey, skl] of Object.entries(this.system.skills)) {
      if (skl == null) continue;
      // Add main skill
      skills.push(`skill.${sklKey}`);
      // Add subskills if present
      for (const subSklKey of Object.keys(skl.subSkills ?? [])) {
        skills.push(`skill.${sklKey}.${subSklKey}`);
      }
    }
    return skills;
  }

  /**
   * Change targets for spellbooks on the actor.
   *
   * @internal
   * @type {Array[]} Target paths
   */
  get _spellbookTargets() {
    const spellTargets = [];
    // Add caster level and concentration to targets
    for (const [bookId, bookData] of Object.entries(this._source.system.attributes?.spells?.spellbooks ?? {})) {
      if (bookData.inUse) {
        spellTargets.push(`cl.book.${bookId}`, `concn.${bookId}`);
      }
    }
    return spellTargets;
  }

  /**
   * @internal
   */
  _prepareContainerItems() {
    const collection = [];

    /**
     * @param {Item} item
     */
    function getContainerContents(item) {
      if (item.type !== "container") return;

      item.items.forEach((i) => {
        collection.push(i);
        getContainerContents(i);
      });
    }

    this.itemTypes.container.forEach((item) => {
      getContainerContents(item);
    });

    this.containerItems = collection;
  }

  /**
   * Prepare boolean and dictionary flags.
   *
   * @internal
   */
  _prepareItemFlags() {
    const items = this.allItems;
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
        const dEntries = Object.entries(item.system.flags?.dictionary || {});
        if (dEntries.length) {
          dFlags[tag] ||= {};

          for (const [key, value] of dEntries) {
            if (dFlags[tag][key] !== undefined && this.isOwner) {
              const msg = game.i18n.format("PF1.Warning.DuplicateDFlag", {
                actor: this.uuid,
                item: item.name,
                key,
                tag,
              });
              ui.notifications.warn(msg, { console: false });
              console.warn(msg, item);
            }

            dFlags[tag][key] = item.isActive ? value : 0;
          }
        }
      }
    }

    this.itemFlags = {
      boolean: bFlags,
      dictionary: dFlags,
    };
  }

  /**
   * @internal
   */
  _prepareChanges() {
    this.changeItems = this.items.filter((item) => item.hasChanges && item.isActive);

    const changes = [];
    for (const i of this.changeItems) {
      changes.push(...i.changes);
    }

    addDefaultChanges.call(this, changes);

    const c = new Collection();
    for (const change of changes) {
      // Avoid ID conflicts
      const parentId = change.parent?.id ?? "Actor";
      const uniqueId = `${parentId}-${change._id}`;
      c.set(uniqueId, change);
    }
    this.changes = c;
  }

  /**
   * @internal
   * @override
   */
  applyActiveEffects() {
    // Apply active effects. Required for status effects in v11 and onward, such as blind and invisible.
    super.applyActiveEffects();

    this.prepareConditions();

    this._prepareContainerItems();
    this._prepareItemFlags();
    this._prepareChanges();
  }

  /**
   * Deletes expired temporary active effects and disables linked expired buffs.
   *
   * @param {object} [options] Additional options
   * @param {Combat} [options.combat] Combat to expire data in, if relevant
   * @param {number} [options.worldTime] - World time
   * @param {number} [options.timeOffset=0] Time offset from world time
   * @param {string} [options.event] - Expiration event
   * @param {number} [options.initiative] - Initiative based expiration marker
   * @param {DocumentModificationContext} [context] Document update context
   * @throws {Error} - With insufficient permissions to control the actor.
   */
  async expireActiveEffects(
    { combat, timeOffset = 0, worldTime = null, event = null, initiative = null } = {},
    context = {}
  ) {
    if (!this.isOwner) throw new Error("Must be owner");

    // Canonical world time.
    // Due to async code in numerous places and no awaiting of time updates, this can go out of sync of actual time.
    worldTime ??= game.time.worldTime;
    worldTime += timeOffset;

    // Effects that have timed out
    const expiredEffects = this._effectsWithDuration.filter((ae) => {
      const { seconds, startTime } = ae.duration;
      const { rounds, startRound } = ae.duration;

      // Calculate remaining duration.
      // AE.duration.remaining is updated by Foundry only in combat and is unreliable.
      let remaining = Infinity;
      // Convert rounds to seconds
      if (Number.isFinite(seconds) && seconds >= 0) {
        const elapsed = worldTime - (startTime ?? 0);
        remaining = seconds - elapsed;
      } else if (rounds > 0 && combat) {
        // BUG: This will ignore which combat the round tracking started for
        const elapsed = combat.round - (startRound ?? 0);
        remaining = (rounds - elapsed) * CONFIG.time.roundTime;
      }

      // Time still remaining
      if (remaining > 0) return false;

      const flags = ae.getFlag("pf1", "duration") ?? {};

      switch (flags.end || "turnStart") {
        // Initiative based ending
        case "initiative":
          if (initiative !== null) {
            return initiative <= flags.initiative;
          }
          // Anything not on initiative expires if they have negative time remaining
          return remaining < 0;
        // End on turn start, but we're not there yet
        case "turnStart":
          if (remaining === 0 && !["turnStart", "turnEnd"].includes(event)) return false;
          break;
        // End on turn end, but we're not quite there yet
        case "turnEnd":
          if (remaining === 0 && event !== "turnEnd") return false;
          break;
      }

      // Otherwise end when time is out
      return remaining <= 0;
    });

    const disableActiveEffects = [],
      deleteActiveEffects = [],
      disableBuffs = [];

    for (const ae of expiredEffects) {
      let item;
      // Use AE parent when available
      if (ae.parent instanceof Item) item = ae.parent;
      // Otherwise support older origin cases
      else item = ae.origin ? fromUuidSync(ae.origin, { relative: this }) : null;

      if (item?.type === "buff") {
        disableBuffs.push({ _id: item.id, "system.active": false });
      } else {
        if (ae.getFlag("pf1", "autoDelete")) {
          deleteActiveEffects.push(ae.id);
        } else {
          disableActiveEffects.push({ _id: ae.id, disabled: true });
        }
      }
    }

    // Add context info for why this update happens to allow modules to understand the cause.
    context.pf1 ??= {};
    context.pf1.reason = "duration";

    if (deleteActiveEffects.length) {
      const deleteAEContext = foundry.utils.mergeObject(
        { render: !disableBuffs.length && !disableActiveEffects.length },
        context
      );
      await this.deleteEmbeddedDocuments("ActiveEffect", deleteActiveEffects, deleteAEContext);
    }

    if (disableActiveEffects.length) {
      const disableAEContext = foundry.utils.mergeObject({ render: !disableBuffs.length }, context);
      await this.updateEmbeddedDocuments("ActiveEffect", disableActiveEffects, disableAEContext);
    }

    if (disableBuffs.length) {
      await this.updateEmbeddedDocuments("Item", disableBuffs, context);
    }
  }

  /**
   * Prepare actor data before items are prepared.
   *
   * @override
   */
  prepareBaseData() {
    this._initialized = false; // For preventing items initializing certain data too early

    super.prepareBaseData();

    this.system.details ??= {};
    this.system.details.level ??= {};

    /** @type {Record<string, SourceInfo>} */
    this.sourceInfo = {};
    this.changeFlags = {};

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

    this._prepareNaturalReach();

    if (Hooks.events.pf1PrepareBaseActorData?.length) {
      Hooks.callAll("pf1PrepareBaseActorData", this);
    }

    // Update total level and mythic tier
    const classes = this.itemTypes.class;
    /** @type {{hd:number,mythic:number,level:number}} */
    const levels = classes.reduce(
      (cur, o) => {
        o.reset(); // HACK: Out of order preparation for later.
        cur.hd += o.hitDice;
        if (!["mythic", "racial"].includes(o.subType)) {
          cur.level += o.system.level ?? 0;
        }
        cur.mythic += o.mythicTier;
        return cur;
      },
      { hd: 0, mythic: 0, level: 0 }
    );

    this.system.details.level.value = levels.level;
    this.system.details.mythicTier = levels.mythic;

    // Refresh ability scores
    for (const ability of Object.values(this.system.abilities)) {
      const value = ability.value;
      if (value === null) {
        ability.total = null;
        ability.base = null;
      } else {
        ability.undrained = value;
        ability.total = value - ability.drain;
        ability.penalty = (ability.penalty || 0) - Math.abs(ability.userPenalty || 0);
        ability.base = ability.total;
      }
    }
    this.refreshAbilityModifiers();

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

      // Add .value for NPC lite sheet
      if (this.system.attributes.bab.value) this.system.attributes.bab.total += this.system.attributes.bab.value ?? 0;
    }

    this._prepareClassSkills();

    // Reset HD
    foundry.utils.setProperty(this.system, "attributes.hd.total", levels.hd);
  }

  /**
   * Prepare actor.system.conditions for use.
   *
   * @protected
   */
  prepareConditions() {
    this.system.conditions = {};
    const conditions = this.system.conditions;

    // Populate condition base values
    for (const condition of pf1.registry.conditions.keys()) {
      conditions[condition] = false;
    }

    // Fill in actual state
    // ??[] is to deal with the set not being available yet for some actors
    for (const status of this.statuses) {
      if (status in conditions) {
        conditions[status] = true;
      }
    }

    // Conditions backwards compatibility
    if (!Object.getOwnPropertyDescriptor(this.system.attributes, "conditions")?.["get"]) {
      delete this.system.attributes.conditions;
      Object.defineProperty(this.system.attributes, "conditions", {
        get() {
          foundry.utils.logCompatibilityWarning(
            "actor.system.attributes.conditions is deprecated in favor of actor.system.conditions and actor.statuses",
            { since: "PF1 v10", until: "PF1 v11" }
          );
          return conditions;
        },
        enumerable: false,
      });
    }
  }

  /**
   * Prepare natural reach for melee range and for reach weapons.
   *
   * @protected
   */
  _prepareNaturalReach() {
    // Prepare base natural reach
    this.system.traits.reach ??= {};
    const reach = this.system.traits.reach;

    reach.base = this.constructor.getReach(this.system.traits.size, this.system.traits.stature);

    // Reset values
    reach.natural = reach.base;
    reach.total = { ...reach.base };

    // Add base natural values to the change sources
    getSourceInfo(this.sourceInfo, "system.traits.reach.total.melee").positive.push({
      name: game.i18n.localize("PF1.BuffTarReach"),
      modifier: "base",
      value: reach.base.melee,
    });
    getSourceInfo(this.sourceInfo, "system.traits.reach.total.reach").positive.push({
      name: game.i18n.localize("PF1.BuffTarReach"),
      modifier: "base",
      value: reach.base.reach,
    });
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
        foundry.utils.setProperty(skillData, `subSkills.${k2}.cs`, skillSet.has(skillKey));
      }
    }
  }

  /**
   * Checks if there's any matching proficiency
   *
   * @param {pf1.document.item.ItemEquipmentPF} item - The item to check for.
   * @returns {boolean} Whether the actor is proficient with that item.
   */
  hasArmorProficiency(item) {
    // Check for item type
    if (item.type !== "equipment" || !["armor", "shield"].includes(item.system.subType)) return true;

    const aprof = this.system.traits?.armorProf;
    if (!aprof) return false;

    // Base proficiency
    if (aprof.total.includes(item.baseArmorProficiency)) return true;

    // Base types with custom proficiencies
    const profs = aprof.customTotal ?? [];
    if (profs.length == 0) return false;
    const baseTypes = item.system.baseTypes ?? [];
    if (baseTypes.length == 0) return false;

    return profs.some((prof) => baseTypes.includes(prof));
  }

  /**
   * Test if actor is proficient with specified weapon.
   *
   * @remarks Natural attacks incorrectly do not count as proficient.
   *
   * @param {ItemPF} item - Item to test
   * @param {object} [options] - Additional options
   * @param {boolean} [options.override=true] - Allow item's proficiency override to influence the result.
   * @returns {boolean} - Proficiency state
   */
  hasWeaponProficiency(item, { override = true } = {}) {
    if (override && item.system.proficient) return true; // Explicitly marked as proficient

    const wprof = this.system.traits?.weaponProf;
    if (!wprof) return false;

    // Match basic proficiencies, e.g. simple and martial (only present on weapons)
    // TODO: Make the item identify it's own weapon type
    let category;
    if (item.type === "weapon") {
      category = item.subType;
    } else if (item.type === "attack") {
      category = item.subType === "weapon" ? item.system.weapon?.category : null;
    }
    if (wprof.total.includes(category)) return true;

    // Match base types
    const profs = wprof.customTotal ?? [];
    if (profs.length == 0) return false;
    const baseTypes = item.system.baseTypes ?? [];
    if (baseTypes.length == 0) return false;

    return profs.some((prof) => baseTypes.includes(prof));
  }

  /**
   * Update specific spellbook.
   *
   * @internal
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

    book.isSchool = book.kind !== "divine";

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
    const spellSlotAbilityScoreBonus = RollPF.safeRollSync(book.spellSlotAbilityBonusFormula || "0", rollData).total,
      spellSlotAbilityScore = (spellbookAbility?.total ?? 10) + spellSlotAbilityScoreBonus,
      spellSlotAbilityMod = pf1.utils.getAbilityModifier(spellSlotAbilityScore);

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
        const value = rollData.classes[book.class].unlevel;
        total += value;
        clTotal += value;

        setSourceInfoByName(this.sourceInfo, key, rollData.classes[book.class].name, value);
      }

      // Set auto spell level calculation offset
      if (book.autoSpellLevelCalculation) {
        const autoFormula = book.cl.autoSpellLevelCalculationFormula || "0";
        const autoBonus = RollPF.safeRollSync(autoFormula, rollData).total ?? 0;
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
      const clBonus = RollPF.safeRollSync(formula, rollData).total;
      clTotal += clBonus;
      if (clBonus > 0) {
        setSourceInfoByName(this.sourceInfo, key, game.i18n.localize("PF1.CasterLevelBonusFormula"), clBonus);
      } else if (clBonus < 0) {
        setSourceInfoByName(this.sourceInfo, key, game.i18n.localize("PF1.CasterLevelBonusFormula"), clBonus, false);
      }

      // Apply negative levels
      if (rollData.attributes.energyDrain) {
        clTotal = Math.max(0, clTotal - rollData.attributes.energyDrain);
        setSourceInfoByName(
          this.sourceInfo,
          key,
          game.i18n.localize("PF1.NegativeLevels"),
          -Math.abs(rollData.attributes.energyDrain),
          false
        );
      }

      clTotal += book.cl.total ?? 0;
      clTotal += book.cl.bonus ?? 0;
      book.cl.total = clTotal;
    }

    // Set concentration bonus
    {
      // Temp fix for old actors that fail migration
      if (Number.isFinite(book.concentration)) {
        console.error(`Bad spellbook concentration value "${book.concentration}" in spellbook "${bookId}"`);
        book.concentration = {};
      }

      // Bonus formula
      const concFormula = book.concentrationFormula;
      const formulaRoll = concFormula.length
        ? RollPF.safeRollSync(concFormula, rollData, undefined, undefined, { minimize: true })
        : { total: 0, isDeterministic: true };
      const rollBonus = formulaRoll.isDeterministic ? formulaRoll.total : 0;

      // Add it all up
      const classAbilityMod = actorData.abilities[book.ability]?.mod ?? 0;
      const concentration = clTotal + classAbilityMod + rollBonus;
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
        formulaRoll.isDeterministic ? formulaRoll.total : formulaRoll.formula,
        false
      );

      // Apply value
      book.concentration ??= {};
      book.concentration.total = prevTotal + concentration;
    }

    const getAbilityBonus = (a) => (a !== 0 ? ActorPF.getSpellSlotIncrease(spellSlotAbilityMod, a) : 0);

    const mode = new SpellbookMode(book);

    // Spell slots
    const useAuto = book.autoSpellLevelCalculation;

    // Turn off spell points with auto slots
    if (useAuto) book.spellPoints.useSystem = false;
    // Turn off bonus slots from ability score without auto slots
    else book.autoSpellLevels = false;

    const useSpellPoints = book.spellPoints.useSystem === true;

    // Set base "spontaneous" based on spell prep mode when using auto slots or spell points
    book.spontaneous = mode.isSemiSpontaneous;
    const isSpontaneous = book.spontaneous;

    if (useAuto) {
      let casterType = book.casterType;
      // Set caster type to sane default if configuration not found.
      if (pf1.config.casterProgression.castsPerDay[mode.raw]?.[casterType] === undefined) {
        const keys = Object.keys(pf1.config.casterProgression.castsPerDay[mode.raw]);
        if (mode.isPrestige) book.casterType = casterType = keys[0];
        else book.casterType = casterType = keys.at(-1);
      }

      const castsForLevels =
        pf1.config.casterProgression[isSpontaneous ? "castsPerDay" : "spellsPreparedPerDay"][mode.raw][casterType];
      let classLevel = Math.clamped(book.cl.autoSpellLevelTotal, 1, 20);

      // Protect against invalid class level bricking actors
      if (!Number.isSafeInteger(classLevel)) {
        const msg = `Actor ${this.id} has invalid caster class level.`;
        console.error(msg, classLevel);
        ui.notifications?.error(msg);
        classLevel = Math.floor(classLevel);
      }

      rollData.ablMod = spellSlotAbilityMod;

      const allLevelModFormula = book[isSpontaneous ? "castPerDayAllOffsetFormula" : "preparedAllOffsetFormula"] || "0";
      const allLevelMod = RollPF.safeRollSync(allLevelModFormula, rollData).total ?? 0;

      for (let level = 0; level < 10; level++) {
        const levelData = book.spells[`spell${level}`];
        // 0 is special because it doesn't get bonus preps and can cast them indefinitely so can't use the "cast per day" value
        const spellsForLevel =
          (level === 0 && isSpontaneous
            ? pf1.config.casterProgression.spellsPreparedPerDay[mode.raw][casterType][classLevel - 1][level]
            : castsForLevels[classLevel - 1][level]) ?? NaN;
        levelData.base = spellsForLevel || 0;

        const offsetFormula = levelData[isSpontaneous ? "castPerDayOffsetFormula" : "preparedOffsetFormula"] || "0";

        const max =
          (level === 0 && book.hasCantrips) || Number.isFinite(spellsForLevel)
            ? spellsForLevel +
              getAbilityBonus(level) +
              allLevelMod +
              (RollPF.safeRollSync(offsetFormula, rollData).total ?? 0)
            : NaN;

        levelData.max = max;
        if (!Number.isFinite(levelData.value)) levelData.value = max;
      }
    } else {
      for (let level = book.hasCantrips ? 0 : 1; level < 10; level++) {
        const levelData = book.spells[`spell${level}`];
        let base = levelData.base;
        if (Number.isNaN(base) || base === null) {
          levelData.base = null;
          levelData.max = 0;
        } else if (book.autoSpellLevels && base >= 0) {
          base += getAbilityBonus(level);
          levelData.max = base;
        } else {
          levelData.max = base || 0;
        }

        if (!Number.isFinite(levelData.value)) {
          levelData.value = levelData.max;
        }
      }
    }

    // Set spontaneous spell slots to something sane
    for (let a = 0; a < 10; a++) {
      book.spells[`spell${a}`].value ||= 0;
    }

    // Update spellbook slots
    {
      const slots = {};
      for (let spellLevel = 0; spellLevel < 10; spellLevel++) {
        slots[spellLevel] = new SpellbookSlots({
          level: spellLevel,
          max: book.spells[`spell${spellLevel}`].max || 0,
          domain: book.domainSlotValue || 0,
        });
      }

      // Slot usage
      for (let level = 0; level < 10; level++) {
        /** @type {pf1.documents.item.ItemSpellPF[]} */
        const levelSpells = bookInfo.level[level]?.spells ?? [];
        const lvlSlots = slots[level];
        const levelData = book.spells[`spell${level}`];
        levelData.slots = { used: 0, max: lvlSlots.max };

        if (isSpontaneous) continue;

        for (const spell of levelSpells) {
          if (Number.isFinite(spell.maxCharges)) {
            const slotCost = spell.slotCost;
            const slots = spell.maxCharges * slotCost;
            if (spell.isDomain) {
              lvlSlots.domain -= slots;
            } else {
              lvlSlots.used += slots;
            }
            lvlSlots.value -= slots;
          }
        }
        levelData.value = lvlSlots.value;

        // Add slot statistics
        levelData.slots.used = lvlSlots.used;
        levelData.slots.remaining = levelData.slots.max - levelData.slots.used;
        levelData.slots.excess = Math.max(0, -levelData.slots.remaining);
        levelData.domain = { max: lvlSlots.domainMax, remaining: lvlSlots.domain };
        levelData.domain.excess = Math.max(0, -levelData.domain.remaining);
        levelData.mismatchSlots = -(
          levelData.slots.excess +
          levelData.domain.excess -
          Math.max(0, levelData.slots.remaining)
        );
        if (levelData.mismatchSlots == 0) levelData.mismatchSlots = levelData.slots.remaining;
        levelData.invalidSlots = levelData.mismatchSlots != 0 || levelData.slots.remaining != 0;
      }

      // Spells available hint text if auto spell levels is enabled
      const maxLevelByAblScore = (spellbookAbility?.total ?? 0) - 10;

      const allLevelModFormula = book.preparedAllOffsetFormula || "0";
      const allLevelMod = RollPF.safeRollSync(allLevelModFormula, rollData).total ?? 0;

      const casterType = book.casterType || "high";
      const classLevel = Math.floor(Math.clamped(book.cl.autoSpellLevelTotal, 1, 20));

      for (let spellLevel = 0; spellLevel < 10; spellLevel++) {
        const spellLevelData = book.spells[`spell${spellLevel}`];
        // Insufficient ability score for the level
        if (maxLevelByAblScore < spellLevel) {
          const unlimit = bookInfo.data.noAbilityLimit ?? false;
          if (!unlimit) {
            spellLevelData.hasIssues = true;
            spellLevelData.lowAbilityScore = true;
          }
        }

        spellLevelData.known = { unused: 0, max: 0 };
        const domainSlotMax = spellLevel > 0 ? slots[spellLevel].domainMax ?? 0 : 0;
        spellLevelData.preparation = { unused: 0, max: 0, domain: domainSlotMax };

        let remaining = 0;
        if (mode.isPrepared) {
          // for prepared casters, just use the 'value' calculated above
          remaining = spellLevelData.value;
          spellLevelData.preparation.max = spellLevelData.max + domainSlotMax;
        } else {
          // spontaneous or hybrid
          // if not prepared then base off of casts per day
          let available = useAuto
            ? pf1.config.casterProgression.spellsPreparedPerDay[mode.raw][casterType]?.[classLevel - 1][spellLevel]
            : spellLevelData.max;
          available += allLevelMod;

          const formula = spellLevelData.preparedOffsetFormula || "0";
          available += RollPF.safeRollSync(formula, rollData).total ?? 0;

          // Leave record of max known
          spellLevelData.known.max = available;

          if (Number.isNaN(available)) {
            spellLevelData.hasIssues = true;
            spellLevelData.lowLevel = true;
          }

          // Count spell slots used
          let dSlots = slots[spellLevel].domain;
          const used =
            bookInfo.level[spellLevel]?.spells.reduce((acc, /** @type {pf1.documents.item.ItemSpellPF} */ i) => {
              const { preparation, atWill, domain } = i.system;
              if (!atWill && preparation.value) {
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

        const lvlSlots = slots[spellLevel];
        // Detect domain slot problems
        const domainSlotsRemaining = spellLevel > 0 ? lvlSlots.domain : 0;

        spellLevelData.remaining = remaining;

        // No more processing needed
        if (remaining == 0 && domainSlotsRemaining <= 0) continue;

        spellLevelData.hasIssues = true;

        if (isSpontaneous) {
          spellLevelData.known.unused = Math.max(0, remaining);
          spellLevelData.known.excess = -Math.min(0, remaining);
          if (useAuto) {
            spellLevelData.invalidKnown = spellLevelData.known.unused != 0 || spellLevelData.known.excess != 0;
            spellLevelData.mismatchKnown = remaining;
          }
        } else {
          spellLevelData.preparation.unused = Math.max(0, remaining);
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

      const roll = RollPF.safeRollSync(formula, rollData);
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
   * @internal
   * @returns {object} Spellbook cache
   */
  _generateSpellbookCache() {
    const bookKeys = Object.keys(this.system.attributes.spells.spellbooks);

    const allSpells = this.itemTypes.spell;

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
   * @internal
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
    Object.defineProperty(this.system.attributes.spells, "usedSpellbooks", {
      get() {
        foundry.utils.logCompatibilityWarning(
          "actor.system.attributes.spells.usedSpellbooks is deprecated with no replacement.",
          {
            since: "PF1 v10",
            until: "PF1 v11",
          }
        );

        return Object.keys(spellbooks).filter((book) => spellbooks[book].inUse);
      },
    });
  }

  /**
   * Called just before the first change is applied, and after every change is applied.
   * Sets additional variables (such as spellbook range)
   *
   * @internal
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
      // Broken gear affects only skills
      this.system.attributes.acp.skill = Math.max(encPen.acp, gearPen.acpSkill);

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
   *
   * @override
   */
  prepareDerivedData() {
    super.prepareDerivedData();

    const race = this.race;
    if (race) {
      const creatureType = race?.system.creatureType || "humanoid";
      this.system.traits ??= {};
      this.system.traits.type = creatureType;
      this.system.traits.humanoid = creatureType === "humanoid";
      this.system.attributes ??= {};
      this.system.attributes.quadruped ??= race?.system.quadruped ?? false;
    }

    this.prepareProficiencies();

    // Reset roll data cache
    // Some changes act wonky without this
    // Example: `@skills.hea.rank >= 10 ? 6 : 3` doesn't work well without this
    delete this._rollData;

    // Update dependant data and resources
    this.items.forEach((item) => {
      item._prepareDependentData(false);
      this.updateItemResources(item);
    });

    applyChanges.call(this);

    const natReach = this.system.traits.reach.total;
    // Ensure reach never becomes negative value
    if (natReach.melee < 0) natReach.melee = 0;
    if (natReach.reach < 0) natReach.reach = 0;

    // Prepare specific derived data
    this.prepareSpecificDerivedData();

    // Prepare CMB total
    this.prepareCMB();

    // Setup links
    this.prepareItemLinks();

    this._prepareOverlandSpeeds();

    // Reset roll data cache again to include processed info
    delete this._rollData;

    // Update items
    this.items.forEach((item) => {
      item._prepareDependentData(true);
      // because the resources were already set up above, this is just updating from current roll data - so do not warn on duplicates
      this.updateItemResources(item, { warnOnDuplicate: false });
    });

    // Initialization is effectively complete at this point
    this._initialized = true;

    this._setSourceDetails();
  }

  /**
   * Calculate overland speeds.
   *
   * @protected
   */
  _prepareOverlandSpeeds() {
    for (const speed of Object.values(this.system.attributes?.speed ?? {})) {
      speed.overland = speed.total > 0 ? pf1.utils.overlandSpeed(speed.total).speed : 0;
    }
  }

  /**
   * Prepare armor, weapon, and language proficiencies.
   *
   * @protected
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

    const validItems = this.items.filter((i) => i.isActive);

    for (const [prof, translations] of Object.entries(proficiencies)) {
      // Custom proficiency baseline from actor
      const customProficiencies = actorData.traits[prof]?.custom || [];

      // Iterate over all items to create one array of non-custom proficiencies
      const proficiencies = validItems.reduce(
        (profs, item) => {
          // Check only items able to grant proficiencies
          if (foundry.utils.hasProperty(item, `system.${prof}`)) {
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
            const customProfs = item.system[prof].custom || [];
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
      actorData.traits[prof].customTotal = [...customProficiencies];
    }
  }

  /**
   * Prepare total CMB value.
   *
   * @todo Move all the logic here to the Change system.
   *
   * @protected
   */
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

  /**
   * @protected
   */
  prepareSpecificDerivedData() {
    if (Hooks.events.pf1PrepareDerivedActorData?.length) {
      Hooks.callAll("pf1PrepareDerivedActorData", this);
    }

    this.refreshDerivedData();

    const attributes = this.system.attributes,
      abilities = this.system.abilities;

    // Set base ability modifier
    for (const ab of Object.keys(abilities)) {
      const total = abilities[ab].base;
      const penalty = abilities[ab].penalty || 0;
      const damage = abilities[ab].damage;
      abilities[ab].baseMod = pf1.utils.getAbilityModifier(total, { penalty, damage });
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
      const v = foundry.utils.getProperty(actorData, k);
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
      let reducedSpeed = false;
      const sInfo = { name: "", value: game.i18n.localize("PF1.ReducedMovementSpeed") };

      // from encumbrance
      const encLevel = attributes.encumbrance.level;
      if (encLevel > 0) {
        const encLevels = pf1.config.encumbranceLevels;
        if (encLevel >= encLevels.heavy) {
          if (!this.changeFlags.noHeavyEncumbrance) {
            reducedSpeed = true;
            sInfo.name = game.i18n.localize("PF1.HeavyEncumbrance");
          }
        } else if (encLevel >= encLevels.medium) {
          if (!this.changeFlags.noMediumEncumbrance) {
            reducedSpeed = true;
            sInfo.name = game.i18n.localize("PF1.MediumEncumbrance");
          }
        }
      }

      const armor = { type: 0 };
      const eqData = this.equipment;
      if (eqData) this._prepareArmorData(eqData.armor, armor);

      // Wearing heavy armor
      if (armor.type == pf1.config.armorTypes.heavy && !this.changeFlags.heavyArmorFullSpeed) {
        reducedSpeed = true;
        sInfo.name = game.i18n.localize("PF1.Subtypes.Item.equipment.armor.Types.heavy");
      }
      // Wearing medium armor
      else if (armor.type == pf1.config.armorTypes.medium && !this.changeFlags.mediumArmorFullSpeed) {
        reducedSpeed = true;
        sInfo.name = game.i18n.localize("PF1.Subtypes.Item.equipment.armor.Types.medium");
      }

      for (const speedKey of Object.keys(this.system.attributes.speed)) {
        const speedValue = this.system.attributes.speed[speedKey].total;
        // Save speed unaffected by speed maluses here (not counting negative changes)
        // TODO: Somehow make this ignore additional set operators
        this.system.attributes.speed[speedKey].unhindered = speedValue; // @since PF1 v10

        if (reducedSpeed && speedValue > 0) {
          this.system.attributes.speed[speedKey].total = this.constructor.getReducedMovementSpeed(speedValue);
          getSourceInfo(this.sourceInfo, `system.attributes.speed.${speedKey}.total`).negative.push(sInfo);
        }
      }
    }

    // Add encumbrance source details
    let encACPPPenalty = null,
      encMaxDex = null;
    switch (attributes.encumbrance.level) {
      case pf1.config.encumbranceLevels.medium: {
        encACPPPenalty = 3;
        encMaxDex = 3;
        break;
      }
      case pf1.config.encumbranceLevels.heavy: {
        encACPPPenalty = 6;
        encMaxDex = 1;
        break;
      }
    }
    const encLabel = game.i18n.localize("PF1.Encumbrance");
    if (encACPPPenalty !== null) {
      getSourceInfo(this.sourceInfo, "system.attributes.acp.total").negative.push({
        name: encLabel,
        value: encACPPPenalty,
      });
    }
    if (encMaxDex !== null) {
      getSourceInfo(this.sourceInfo, "system.attributes.maxDexBonus").negative.push({
        name: encLabel,
        value: encMaxDex,
      });
      let maxDexLabel = new Intl.NumberFormat(undefined, { signDisplay: "always" }).format(encMaxDex);
      maxDexLabel = `${game.i18n.localize("PF1.MaxDexShort")} ${maxDexLabel}`;
      getSourceInfo(this.sourceInfo, "system.attributes.ac.normal.total").negative.push({
        name: encLabel,
        value: maxDexLabel,
        valueAsNumber: encMaxDex,
      });
      getSourceInfo(this.sourceInfo, "system.attributes.ac.touch.total").negative.push({
        name: encLabel,
        value: maxDexLabel,
        valueAsNumber: encMaxDex,
      });
    }

    this.updateSpellbookInfo();
  }

  /**
   * Returns this actor's labels for use with sheets.
   *
   * @protected
   * @returns {Record<string, string>}
   */
  getLabels() {
    const labels = {};

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
   * @internal
   * @returns {MobilityPenaltyResult} The resulting penalties from armor.
   */
  _applyArmorPenalties() {
    let attackACPPenalty = 0; // ACP to attack penalty from lacking proficiency. Stacks infinitely.
    const acp = { armor: 0, shield: 0 };
    const broken = { armor: { value: 0, item: null }, shield: { value: 0, item: null } };
    const mdex = { armor: null, shield: null };

    this.itemTypes.equipment
      .filter((item) => item.system.equipped)
      .forEach((item) => {
        const eqType = item.system.subType;
        const isShieldOrArmor = ["armor", "shield"].includes(eqType);
        let itemACP = Math.abs(item.system.armor.acp);
        if (item.system.masterwork === true && isShieldOrArmor) itemACP = Math.max(0, itemACP - 1);

        if (isShieldOrArmor) {
          itemACP = Math.max(0, itemACP + (this.system.attributes?.acp?.[`${eqType}Bonus`] ?? 0));
        }

        if (itemACP) {
          if (item.isBroken) {
            broken[eqType].value = itemACP;
            broken[eqType].item = item;

            const bsInfo = getSourceInfo(this.sourceInfo, "system.attributes.acp.skill").negative.find(
              (o) => o.itemId === item.id
            );
            if (bsInfo) bsInfo.value = itemACP;
            else {
              getSourceInfo(this.sourceInfo, "system.attributes.acp.skill").negative.push({
                name: `${item.name} (${game.i18n.localize("PF1.Broken")})`,
                itemId: item.id,
                value: itemACP,
              });
            }
          }

          const sInfo = getSourceInfo(this.sourceInfo, "system.attributes.acp.total").negative.find(
            (o) => o.itemId === item.id
          );

          if (sInfo) sInfo.value = itemACP;
          else {
            getSourceInfo(this.sourceInfo, "system.attributes.acp.total").negative.push({
              name: item.name,
              itemId: item.id,
              value: itemACP,
            });
          }
        }

        if (isShieldOrArmor) {
          if (itemACP > acp[eqType]) acp[eqType] = itemACP;
          if (!item.getProficiency(false)) attackACPPenalty += itemACP;
        }

        if (item.system.armor.dex !== null && isShieldOrArmor) {
          const mDex = item.system.armor.dex;
          if (Number.isInteger(mDex)) {
            const mod = this.system.attributes?.mDex?.[`${eqType}Bonus`] ?? 0;
            const itemMDex = mDex + mod;
            mdex[eqType] = Math.min(itemMDex, mdex[eqType] ?? Number.POSITIVE_INFINITY);

            const sInfo = getSourceInfo(this.sourceInfo, "system.attributes.maxDexBonus").negative.find(
              (o) => o.itemId === item.id
            );
            if (sInfo) sInfo.value = itemMDex;
            else {
              getSourceInfo(this.sourceInfo, "system.attributes.maxDexBonus").negative.push({
                name: item.name,
                itemId: item.id,
                value: itemMDex,
                ignoreNull: false,
              });
            }

            // Add max dex to AC, too.
            let maxDexLabel = new Intl.NumberFormat(undefined, { signDisplay: "always" }).format(itemMDex);
            maxDexLabel = `${game.i18n.localize("PF1.MaxDexShort")} ${maxDexLabel}`;
            for (const p of ["system.attributes.ac.normal.total", "system.attributes.ac.touch.total"]) {
              // Use special maxDex id to ensure only the worst is shown
              const sInfoA = getSourceInfo(this.sourceInfo, p).negative.find((o) => o.id === "maxDexEq");
              if (sInfoA) {
                if (itemMDex < sInfoA.valueAsNumber) {
                  sInfoA.value = maxDexLabel;
                  sInfoA.valueAsNumber = itemMDex;
                  sInfoA.itemId = item.id;
                  sInfoA.name = item.name;
                } else if (sInfoA.itemId == item.id) {
                  // Update existing (armor training or the like)
                  sInfoA.value = maxDexLabel;
                  sInfoA.valueAsNumber = itemMDex;
                }
              } else {
                getSourceInfo(this.sourceInfo, p).negative.push({
                  name: item.name,
                  value: maxDexLabel,
                  valueAsNumber: itemMDex,
                  itemId: item.id,
                  id: "maxDexEq",
                });
              }
            }
          }
        }
      });

    // Add Broken to sources
    {
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
            name: `${broken[eqType].item.name} (${game.i18n.localize("PF1.Broken")})`,
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
      acpSkill: totalACP + broken.armor.value + broken.shield.value,
    };
    this.system.attributes.acp.gear = totalACP;
    if (mdex.armor !== null || mdex.shield !== null)
      result.maxDexBonus = Math.min(mdex.armor ?? Number.POSITIVE_INFINITY, mdex.shield ?? Number.POSITIVE_INFINITY);

    // Set armor penalty to attack rolls
    this.system.attributes.acp.attackPenalty = attackACPPenalty;

    return result;
  }

  /**
   * @internal
   */
  prepareItemLinks() {
    for (const item of this.items) {
      const links = item.system.links;
      if (!links) continue;

      for (const type of Object.keys(links)) {
        for (const link of links[type]) {
          const linkedItem = fromUuidSync(link.uuid, { relative: this });
          if (!linkedItem) continue;

          // Detect bad links pointing to other actors
          if (linkedItem.actor && linkedItem.actor !== this) {
            console.error("Invalid item link:", { type, uuid: link.uuid, actor: this, item, linked: linkedItem });
            continue;
          }

          switch (type) {
            case "charges": {
              linkedItem.links.charges = item;
              linkedItem.prepareLinks();
              break;
            }
            case "children": {
              linkedItem.links.parent = item;
              break;
            }
          }
        }
      }
    }
  }

  /**
   * @internal
   */
  _setSourceDetails() {
    const actorData = this.system;
    const sourceDetails = {};
    // Get empty source arrays
    for (const b of Object.keys(pf1.config.buffTargets)) {
      const buffTargets = getChangeFlat.call(this, b, null);
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
      if (abl.damage > 0) {
        sourceDetails[`system.abilities.${a}.mod`].push({
          name: game.i18n.localize("PF1.AbilityDamage"),
          value: -Math.floor(Math.abs(abl.damage) / 2),
        });
      }
      if (abl.drain > 0) {
        sourceDetails[`system.abilities.${a}.total`].push({
          name: game.i18n.localize("PF1.AbilityDrain"),
          value: -Math.abs(abl.drain),
        });
      }
    }

    // Add wound threshold data
    const hpconf = game.settings.get("pf1", "healthConfig").variants;
    const hpconfvariant = this.type === "npc" ? hpconf.npc : hpconf.pc;
    const wtUsage = hpconfvariant.useWoundThresholds;
    if (wtUsage > 0) {
      const wtData = this.getWoundThresholdData({ healthConfig: hpconfvariant });

      if (wtData.level > 0) {
        const penalty = -wtData.penalty;
        for (const fk of pf1.config.woundThresholdChangeTargets) {
          const flats = getChangeFlat.call(this, fk, "untyped", penalty);
          for (const k of flats) {
            if (!k) continue;
            sourceDetails[k].push({
              name: pf1.config.woundThresholdConditions[wtData.level],
              value: penalty,
            });
          }
        }
      }
    }

    const dexDenied = this.changeFlags.loseDexToAC === true;

    // Add extra data
    const rollData = this.getRollData();
    for (const [path, changeGrp] of Object.entries(this.sourceInfo)) {
      /** @type {Array<SourceInfo[]>} */
      const sourceGroups = Object.values(changeGrp);
      for (const grp of sourceGroups) {
        sourceDetails[path] ||= [];
        for (const src of grp) {
          src.operator ||= "add";
          // TODO: Separate source name from item type label
          const label = this.constructor._getSourceLabel(src);
          let srcValue =
            src.value != null
              ? src.value
              : RollPF.safeRollAsync(src.formula || "0", rollData, [path, src, this], {
                  suppressError: !this.isOwner,
                }).total;
          if (src.operator === "set") {
            let displayValue = srcValue;
            if (src.change?.isDistance) displayValue = pf1.utils.convertDistance(displayValue)[0];
            srcValue = game.i18n.format("PF1.SetTo", { value: displayValue });
          }

          // Add sources only if they actually add something else than zero
          if (!(src.operator === "add" && srcValue === 0) || src.ignoreNull === false) {
            // Account for dex denied denying dodge bonuses
            if (dexDenied && srcValue > 0 && src.modifier === "dodge" && src.operator === "add" && src.change?.isAC)
              continue;

            sourceDetails[path].push({
              name: label.replace(/[[\]]/g, ""),
              modifier: src.modifier || "",
              value: srcValue,
            });
          }
        }
      }
    }

    this.sourceDetails = sourceDetails;
  }

  /**
   * @internal
   */
  _getInherentTotalsKeys() {
    // Determine base keys
    const keys = {
      "attributes.ac.normal.total": 10,
      "attributes.ac.touch.total": 10,
      "attributes.ac.flatFooted.total": 10,
      "attributes.bab.total": 0,
      "attributes.cmd.total": 10,
      "attributes.cmd.flatFootedTotal": 10,
      "attributes.acp.armorBonus": 0,
      "attributes.acp.shieldBonus": 0,
      "attributes.acp.gear": 0,
      "attributes.acp.encumbrance": 0,
      "attributes.acp.total": 0,
      "attributes.acp.skill": 0,
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
      "attributes.init.total": this.system.attributes.init.value ?? 0,
      "attributes.cmb.bonus": 0,
      "attributes.cmb.total": 0,
      "attributes.cmb.value": 0,
      "attributes.hp.max": this.system.attributes.hp.base ?? 0,
      "attributes.vigor.max": this.system.attributes.vigor.base ?? 0,
      "attributes.wounds.max": this.system.attributes.wounds.base ?? 0,
      "attributes.wounds.threshold": 0,
      "attributes.attack.general": 0,
      "attributes.attack.melee": 0,
      "attributes.attack.natural": 0,
      "attributes.attack.ranged": 0,
      "attributes.attack.thrown": 0,
      "attributes.attack.shared": 0,
      "attributes.attack.critConfirm": 0,
      "attributes.mDex": { armorBonus: 0, shieldBonus: 0 },
      "attributes.damage.general": 0,
      "attributes.damage.weapon": 0,
      "attributes.damage.natural": 0,
      "attributes.damage.melee": 0, // Melee weapon
      "attributes.damage.meleeAll": 0,
      "attributes.damage.ranged": 0, // Ranged weapon
      "attributes.damage.rangedAll": 0,
      "attributes.damage.thrown": 0, // Thrown weapon
      "attributes.damage.spell": 0,
      "attributes.damage.shared": 0,
      "attributes.woundThresholds.level": 0,
      "attributes.woundThresholds.mod": 0,
      "attributes.woundThresholds.override": -1,
      "attributes.woundThresholds.penaltyBase": 0,
      "attributes.woundThresholds.penalty": 0,
      "abilities.str.checkMod": 0,
      "abilities.str.total": 0,
      "abilities.str.undrained": 0,
      "abilities.dex.checkMod": 0,
      "abilities.dex.total": 0,
      "abilities.dex.undrained": 0,
      "abilities.con.checkMod": 0,
      "abilities.con.total": 0,
      "abilities.con.undrained": 0,
      "abilities.int.checkMod": 0,
      "abilities.int.total": 0,
      "abilities.int.undrained": 0,
      "abilities.wis.checkMod": 0,
      "abilities.wis.total": 0,
      "abilities.wis.undrained": 0,
      "abilities.cha.checkMod": 0,
      "abilities.cha.total": 0,
      "abilities.cha.undrained": 0,
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
      "details.feats.bonus": 0,
      "details.skills.bonus": 0,
      "attributes.speed.land.add": 0,
      "attributes.speed.swim.add": 0,
      "attributes.speed.fly.add": 0,
      "attributes.speed.climb.add": 0,
      "attributes.speed.burrow.add": 0,
      "attributes.savingThrows.fort.total": this.system.attributes.savingThrows.fort.base ?? 0,
      "attributes.savingThrows.ref.total": this.system.attributes.savingThrows.ref.base ?? 0,
      "attributes.savingThrows.will.total": this.system.attributes.savingThrows.will.base ?? 0,
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

  /**
   * Data to reset base value of, but only if missing.
   *
   * @private
   * @see {@link _resetInherentTotals}
   * @returns {Record<string,number>}
   */
  _getBaseValueFillKeys() {
    return [
      { parent: "abilities.str", key: "base", value: 0 },
      { parent: "abilities.dex", key: "base", value: 0 },
      { parent: "abilities.con", key: "base", value: 0 },
      { parent: "abilities.int", key: "base", value: 0 },
      { parent: "abilities.wis", key: "base", value: 0 },
      { parent: "abilities.cha", key: "base", value: 0 },
    ];
  }

  /**
   * @protected
   */
  _resetInherentTotals() {
    const keys = this._getInherentTotalsKeys();

    // Reset totals
    for (const [k, v] of Object.entries(keys)) {
      try {
        foundry.utils.setProperty(this.system, k, v);
      } catch (err) {
        console.error(err, k);
      }
    }

    for (const data of this._getBaseValueFillKeys()) {
      const { parent, key, value } = data;
      const o = getProperty(this.system, parent);
      if (!o) continue; // Not all actor types have these
      o[key] ??= value;
    }
  }

  /**
   * Return reduced movement speed.
   *
   * @example
   * pf1.documents.actor.ActorPF.getReducedMovementSpeed(30); // => 20
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
   * @example
   * pf1.documents.actor.ActorPF.getSpellSlotIncrease(2, 1); // => 1
   * pf1.documents.actor.ActorPF.getSpellSlotIncrease(6, 1); // => 2
   * pf1.documents.actor.ActorPF.getSpellSlotIncrease(6, 7); // => 0
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
   * @param {number} level - The desired level
   * @returns {number} - The XP required
   */
  getLevelExp(level) {
    return 0; // Only used by PCs
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
  /* -------------------------------------------- */

  /**
   * @internal
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    if (context.diff === false || context.recursive === false) return; // Don't diff if we were told not to diff

    if (!changed.system) return; // No system updates.

    const oldData = this.system;

    this._syncProtoTokenSize(changed);

    // Offset HP values
    const attributes = changed.system.attributes;
    if (attributes) {
      for (const key of ["hp", "wounds", "vigor"]) {
        const hp = attributes[key];
        if (!hp) continue;
        if (hp.value !== undefined && hp.offset === undefined) {
          const max = hp.max ?? oldData.attributes[key]?.max ?? 0;
          hp.offset = hp.value - max;
        }
        // Do not ever keep .value
        delete hp.value;
      }

      // Convert excess vigor damage to wounds
      const vigor = attributes.vigor;
      if (vigor?.offset < 0) {
        const maxVigor = oldData.attributes.vigor.max;
        const excessVigorDamage = -(maxVigor + vigor.offset);
        if (excessVigorDamage > 0) {
          attributes.wounds ??= {};
          attributes.wounds.offset ??= oldData.attributes?.wounds?.offset ?? 0;
          attributes.wounds.offset -= excessVigorDamage;
          vigor.offset = -maxVigor;
        }
      }
    }

    if (changed.system.attributes?.quadruped !== undefined) {
      const quad = changed.system.attributes.quadruped;
      const quadRace = this.race?.system.quadruped ?? false;
      // Null if setting qudruped to same as race (no override)
      if (quad === quadRace) changed.system.attributes.quadruped = null;
    }

    // Make certain variables absolute
    const abilities = changed.system.abilities;
    if (abilities) {
      const absoluteKeys = ["userPenalty", "damage", "drain"];
      const keys = Object.keys(abilities);
      for (const abl of keys) {
        const ablData = abilities[abl];
        if (!ablData) continue; // e.g. if null from being deleted for homebrew
        for (const absKey of absoluteKeys) {
          if (ablData[absKey] !== undefined) {
            ablData[absKey] = Math.abs(ablData[absKey]);
          }
        }
      }
    }

    const energyDrain = changed.system.attributes?.energyDrain;
    if (energyDrain !== undefined) {
      changed.system.attributes.energyDrain = Math.abs(energyDrain);
    }

    // Backwards compatibility
    const conditions = changed.system.attributes?.conditions;

    // Never allow updates to the new condtions location
    if (changed.system.conditions !== undefined) {
      delete changed.system.conditions;
    }

    if (conditions) {
      foundry.utils.logCompatibilityWarning(
        "Toggling conditions via Actor.update() is deprecated in favor of Actor.setCondition()",
        {
          since: "PF1 v10",
          until: "PF1 v11",
        }
      );

      // Prevent data storage
      delete changed.system.attributes.conditions;

      // Toggle AEs
      await this.setConditions(conditions);
    }
  }

  /**
   * Synchronize prototype token sizing with actor size.
   *
   * @internal
   * @param {object} changed - Pre-uppdate data
   */
  _syncProtoTokenSize(changed) {
    const sizeKey = changed.system.traits?.size;
    if (!sizeKey) return;

    if (this.token) return;

    const staticSize =
      changed.prototypeToken?.flags?.pf1?.staticSize ?? this.prototypeToken.getFlag("pf1", "staticSize") ?? false;
    if (staticSize) return;

    const size = pf1.config.tokenSizes[sizeKey];
    if (!size) return;

    changed.prototypeToken ??= {};
    if (changed.prototypeToken?.width === undefined) {
      changed.prototypeToken.width = size.w;
    }
    if (changed.prototypeToken?.height === undefined) {
      changed.prototypeToken.height = size.h;
    }
  }

  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {string} userId
   */
  _onUpdate(changed, context, userId) {
    super._onUpdate(changed, context, userId);

    // No system data updated
    if (!changed.system) return;

    const sourceUser = game.user.id === userId;

    let initializeVision = false,
      refreshLighting = false;

    if (foundry.utils.hasProperty(changed.system, "traits.senses")) {
      initializeVision = true;
      if (changed.system.traits.senses.ll) {
        refreshLighting = true;
      }
    } else if (changed.flags?.pf1?.visionSharing) {
      initializeVision = true;
      refreshLighting = true;
    }

    if (initializeVision || refreshLighting) {
      if (this.testUserPermission(game.user, "OBSERVER")) {
        const visionUpdate = {
          refreshLighting: true,
          refreshVision: true,
        };

        // Ensure vision immediately updates
        if (initializeVision) {
          for (const token of this.getActiveTokens(false, true)) {
            token._syncSenses();
          }
          visionUpdate.initializeVision = true;
        }

        // Ensure LLV functions correctly
        if (refreshLighting) {
          visionUpdate.initializeLighting = true;
        }

        canvas.perception.update(visionUpdate, true);
      }
    }

    if (sourceUser) {
      const sizeKey = changed.system.traits?.size;
      if (sizeKey !== undefined) {
        this._updateTokenSize(sizeKey);
      }
    }
  }

  /**
   * Resize token sizes based on actor size.
   *
   * Ignores tokens with static size set.
   *
   * @todo Add option to update token size on all scenes.
   *
   * @internal
   * @param {string} sizeKey - New size key
   * @param {object} [options] - Additional options
   * @returns {Promise<TokenDocument[]>|null} - Updated token documents, or null if no update was performed.
   * @throws {Error} - On invalid parameters
   */
  async _updateTokenSize(sizeKey, options = {}) {
    const size = pf1.config.tokenSizes[sizeKey];
    if (!size) throw new Error(`Size key "${sizeKey}" is invalid`);
    const scene = canvas.scene;
    if (!scene) return null;

    // Get relevant tokens
    const tokens = this.token
      ? [this.token]
      : this.getActiveTokens(false, true).filter((token) => !token.getFlag("pf1", "staticSize"));

    const protoTexture = this.prototypeToken?.texture ?? {};

    const updates = tokens.map((t) => ({
      _id: t.id,
      width: size.w,
      height: size.h,
      texture: {
        scaleX: size.scale * (protoTexture.scaleX || 1),
        scaleY: size.scale * (protoTexture.scaleY || 1),
      },
    }));

    return TokenDocument.implementation.updateDocuments(updates, { parent: scene });
  }

  /**
   * @internal
   * @override
   * @param {Item|Actor} parent - Parent document
   * @param {"items"|"effects"} collection - Collection name
   * @param {Item[]|ActiveEffect[]} documents - Created documents
   * @param {object[]} result - Creation data for the documents
   * @param {object} context - Create context options
   * @param {string} userId - Triggering user's ID
   */
  _onCreateDescendantDocuments(parent, collection, documents, result, context, userId) {
    super._onCreateDescendantDocuments(...arguments);

    if (userId !== game.user.id) return;

    if (collection === "items") {
      // Apply race size to actor
      const race = documents.find((d) => d.type === "race");
      if (race?.system.size) {
        if (this.system.traits.size !== race.system.size) this.update({ "system.traits.size": race.system.size });
      }
    }

    if (collection === "effects") {
      if (context.pf1?.updateConditionTracks !== false) {
        this._handleConditionTracks(documents, context);
      }
    }
  }

  /**
   * Handle condition track toggling post active effect creation if there's still some issues.
   *
   * @internal
   * @param {ActiveEffect[]} documents Updated active effect documents
   * @returns {Promise}
   */
  async _handleConditionTracks(documents) {
    // Record of previously update conditions that didn't get notified about
    const previousConditions = {};

    const conditions = {};
    const tracks = pf1.registry.conditions.trackedConditions();
    for (const ae of documents) {
      for (const statusId of ae.statuses ?? []) {
        // Skip non-conditions
        if (!pf1.registry.conditions.has(statusId)) continue;

        // Mark this condition for notification
        previousConditions[statusId] = true;

        // Process condition tracks
        for (const conditionGroup of tracks) {
          if (!conditionGroup.includes(statusId)) continue;
          // Disable other conditions in the track
          for (const disableConditionId of conditionGroup) {
            if (disableConditionId === statusId) continue;
            conditions[disableConditionId] = false;
          }
        }
      }
    }

    this._conditionToggleNotify(previousConditions);

    if (!foundry.utils.isEmpty(conditions)) {
      return this.setConditions(conditions);
    }
  }

  /**
   * @internal
   * @override
   * @param {*} parent
   * @param {"items"|"effects"} collection
   * @param {Item|ActiveEffect[]} documents
   * @param {string[]} ids
   * @param {object} context - Delete context
   * @param {string} userId
   */
  _onDeleteDescendantDocuments(parent, collection, documents, ids, context, userId) {
    super._onDeleteDescendantDocuments(parent, collection, documents, ids, context, userId);

    if (collection === "effects") {
      const updatedConditions = {};
      for (const ae of documents) {
        for (const statusId of ae.statuses ?? []) {
          // Toggle off only if it's valid ID and there isn't any other AEs that have same condition still
          if (pf1.registry.conditions.has(statusId) && !this.statuses.has(statusId)) {
            updatedConditions[statusId] = false;
          }
        }
      }

      if (context?.pf1?.updateConditionTracks !== false) {
        this._conditionToggleNotify(updatedConditions);
      }
    }

    // Following process is done only on triggering user
    if (game.user.id !== userId) return;

    if (collection === "items") {
      this._cleanItemLinksTo(documents);

      // Delete child linked items
      const toRemove = new Set();

      // Remove linked children with item
      const _enumChildren = (item) => {
        toRemove.add(item.id);

        const links = item.getLinkedItemsSync("children");
        for (const link of links) {
          if (toRemove.has(link.id)) continue;
          const child = item.actor.items.get(link.id);
          if (child) _enumChildren(child);
        }
      };

      // Find children
      for (const item of documents) _enumChildren(item);
      // Remove already deleted items
      for (const id of ids) toRemove.delete(id);

      if (toRemove.size > 0) {
        this.deleteEmbeddedDocuments("Item", Array.from(toRemove));
      }
    }
  }

  /**
   * @internal
   * @param {pf1.documents.item.ItemPF[]} items - Item documents to clean links to.
   */
  async _cleanItemLinksTo(items) {
    const updates = [];
    // Clean up references to this item
    for (const deleted of items) {
      const uuid = deleted.getRelativeUUID(this);
      for (const item of this.items) {
        const updateData = await item.removeItemLink(uuid, { commit: false });
        if (updateData) {
          updateData._id = item.id;
          updates.push(updateData);
        }
      }
    }

    if (updates.length) {
      return this.updateEmbeddedDocuments("Item", updates);
    }
  }

  /**
   * @todo - The condition notification needs to be smarter.
   *
   * @internal
   * @param conditions
   */
  _conditionToggleNotify(conditions = {}) {
    for (const [conditionId, state] of Object.entries(conditions)) {
      Hooks.callAll("pf1ToggleActorCondition", this, conditionId, state);
    }
  }

  /**
   * @internal
   * @param {ItemPF} item - the item to add to the actor's resources
   * @param {object} [options] - extra options
   * @param {boolean} [options.warnOnDuplicate] - Skips warning if item tag already exists in dictionary flags
   * @returns {boolean} True if resources were set
   */

  updateItemResources(item, { warnOnDuplicate = true } = {}) {
    if (item.type === "spell") return false;
    if (!item.isCharged) return false;
    if (item.isSingleUse) return false;
    if (item.isPhysical) return false;

    const tag = item.system.tag;
    if (!tag) console.error("Attempting create resource on tagless item", item);

    if (warnOnDuplicate && this.system.resources[tag] && this.isOwner) {
      const msg = game.i18n.format("PF1.Warning.DuplicateTag", {
        actor: this.uuid,
        item: item.name,
        tag,
      });
      ui.notifications.warn(msg, { console: false });
      console.warn(msg, item);
    }

    const res = new Resource(item);
    this.system.resources[tag] = res;

    return true;
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  /**
   * @deprecated - See {@link pf1.documents.item.ItemAttackPF.fromItem ItemAttackPF.fromItem()}
   * @param {pf1.documents.item.ItemWeaponPF} item - Weapon to create attack from
   * @returns {Item|undefined} - Created item.
   */
  async createAttackFromWeapon(item) {
    foundry.utils.logCompatibilityWarning(
      "ActorPF.createAttackFromWeapon() is deprecated in favor of ItemAttackPF.fromItem()",
      {
        since: "PF1 v10",
        until: "PF1 v11",
      }
    );

    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.Error.NoActorPermissionAlt", { name: this.name }));
    }

    const attackItem = pf1.documents.item.ItemAttackPF.fromItem(item);

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
   * @example
   * // Create spellbook for inquisitor
   * actor.createSpellbook({ type: "spontaneous", progression: "med", ability: "wis", spells: "divine", class: "inquisitor", cantrips: true, domain: 0 });
   *
   * @param {object} [casting] - Book casting configuration
   * @param {"prepared"|"spontaneous"|"hybrid"} [casting.type="prepared"] - Spellbook type
   * @param {"high"|"med"|"low"} [casting.progression="high"] - Casting progression type
   * @param {string} [casting.ability="int"] - Spellcasting ability score ID
   * @param {"arcane"|"divine"|"psychic"|"alchemy"} [casting.spells="arcane"] - Spell/spellcasting type
   * @param {string} [casting.class="_hd"] - Class tag
   * @param {boolean} [casting.cantrips=true] - Has cantrips?
   * @param {number} [casting.domain=1] - Domain/School slots
   * @param {number} [casting.offset] - Level offset
   * @returns {Promise<this>} - Promise to updated document
   */
  createSpellbook(casting = {}, { commit = true } = {}) {
    const books = this.system.attributes.spells.spellbooks ?? {};

    const oldBook = casting.class
      ? Object.entries(books).find(([_, book]) => !!book.class && book.class === casting.class)
      : null;

    let bookId;
    if (oldBook) {
      if (oldBook[1].inUse) return void ui.notifications.warn(game.i18n.localize("PF1.Error.SpellbookExists"));
      bookId = oldBook[0]; // Reuse old book
    } else {
      const available = Object.entries(books).find(([bookId, bookData]) => bookData.inUse !== true);
      if (available === undefined) return void ui.notifications.warn(game.i18n.localize("PF1.Error.NoFreeSpellbooks"));
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
    casting.domain ??= 1;
    casting.offset ??= 0;
    if (casting.offset !== 0) casting.offset = `${casting.offset}`;

    const updateData = {
      [`system.attributes.spells.spellbooks.${bookId}`]: {
        inUse: true,
        kind: casting.spells,
        class: casting.class,
        spellPreparationMode: casting.type,
        casterType: casting.progression,
        ability: casting.ability,
        psychic: casting.spells === "psychic",
        arcaneSpellFailure: casting.spells === "arcane",
        hasCantrips: casting.cantrips,
        domainSlotValue: casting.domain,
        "cl.formula": casting.offset ? `${casting.offset}` : "",
      },
    };

    if (commit) return this.update(updateData);
    else return updateData;
  }

  /* -------------------------------------------- */

  /**
   * Retrieve information about a skill.
   *
   * @example
   * actor.getSkillInfo("per"); // Perception skill info
   * actor.getSkillInfo("crf.alchemy"); // Craft (Alchemy) subskill info
   *
   * @param {string} skillId - Skill ID
   * @param {object} [options] - Additional options
   * @param {{ skills: {[key: string]: SkillData}}} [options.rollData] - Roll data instance to use.
   * @throws {Error} - If defined skill is not found.
   * @returns {SkillInfo}
   */
  getSkillInfo(skillId, { rollData } = {}) {
    const skillIdParts = skillId.split(".");
    if (skillIdParts.length > 2) skillIdParts.splice(1, 1);

    const mainSkillId = skillIdParts.shift(),
      subSkillId = skillIdParts.pop(),
      isSubSkill = !!subSkillId;

    // Reconstruct skillId with new shorter version to ensure format
    skillId = [mainSkillId, subSkillId].filterJoin(".");

    rollData ??= this.getRollData();
    const parentSkill = isSubSkill ? this.getSkillInfo(mainSkillId, { rollData }) : null;

    /** @type {SkillInfo} */
    const skill = subSkillId
      ? parentSkill.subSkills?.[subSkillId]
      : foundry.utils.deepClone(rollData.skills[mainSkillId]);

    if (!skill) throw new Error(`Invalid skill ID '${skillId}'`);

    skill.journal ||= pf1.config.skillCompendiumEntries[isSubSkill ? mainSkillId : skillId];
    skill.name ||= pf1.config.skills[skillId] || skillId;
    skill.id = skillId;

    if (isSubSkill) {
      skill.fullName = `${parentSkill.name} (${skill.name})`;
      skill.parentSkill = parentSkill;
    } else {
      skill.fullName = skill.name;
    }

    return skill;
  }

  /**
   * Roll a Skill Check
   *
   * @example
   * await actor.rollSkill("per", { skipDialog: true, bonus: "1d6", dice: "2d20kh" });
   *
   * @param {string} skillId      The skill id (e.g. "per", "prf.prf1", or "crf.alchemy")
   * @param {ActorRollOptions} [options={}]      Options which configure how the skill check is rolled
   * @returns {Promise<ChatMessage|object|void>} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollSkill(skillId, options = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.Error.NoActorPermissionAlt", { name: this.name }));
    }

    const skillIdParts = skillId.split(".");
    const mainSkillId = skillIdParts[0],
      subSkillId = skillIdParts.length > 1 ? skillIdParts.at(-1) : null;
    // Reconstruct skill ID to ensure it is valid for everything else.
    skillId = subSkillId ? `${mainSkillId}.${subSkillId}` : mainSkillId;
    const skillDataPathPart = subSkillId ? `${mainSkillId}.subSkills.${subSkillId}` : mainSkillId;

    const skl = this.getSkillInfo(skillId);
    const haveParentSkill = !!subSkillId;

    // Add contextual attack string
    const rollData = this.getRollData();
    const noteObjects = this.getContextNotes(`skill.${skillId}`);
    if (haveParentSkill) noteObjects.push(...this.getContextNotes(`skill.${mainSkillId}`, false));
    const notes = this.formatContextNotes(noteObjects, rollData);

    // Add untrained note
    if (skl.rt && !skl.rank) {
      notes.push(game.i18n.localize("PF1.Untrained"));
    }

    // Gather changes
    const parts = [];
    const changes = getHighestChanges(
      this.changes.filter((c) => {
        const cf = c.getTargets(this);

        if (haveParentSkill && cf.includes(`system.skills.${mainSkillId}.mod`)) return true;
        return cf.includes(`system.skills.${skillDataPathPart}.mod`);
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
    if (skl.acp && rollData.attributes.acp.skill !== 0) {
      parts.push(`-@attributes.acp.skill[${game.i18n.localize("PF1.ACPLong")}]`);
    }

    // Add Wound Thresholds info
    if (rollData.attributes.woundThresholds?.penalty > 0) {
      const label = pf1.config.woundThresholdConditions[rollData.attributes.woundThresholds.level];
      notes.push(label);
      parts.push(`- @attributes.woundThresholds.penalty[${label}]`);
    }

    // Add changes
    for (const c of changes) {
      if (!c.value) continue;
      // Hide complex change formulas in parenthesis.
      if (typeof c.value === "string" && RollPF.parse(c.value).length > 1) {
        parts.push(`(${c.value})[${c.flavor}]`);
      } else {
        parts.push(`${c.value}[${c.flavor}]`);
      }
    }

    const props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    const token = options.token ?? this.token;

    // Add metadata about the skill
    const metadata = { skill: { rank: skl.rank ?? 0 } };
    if (["acr", "swm", "clm"].includes(skillId)) {
      const speeds = this.system.attributes?.speed ?? {};
      metadata.speed = { base: speeds.land?.total ?? 0 };
      if (skillId === "swm") metadata.speed.swim = speeds.swim?.total ?? 0;
      if (skillId === "clm") metadata.speed.climb = speeds.climb?.total ?? 0;
    }

    const rollOptions = {
      ...options,
      parts,
      rollData,
      flavor: game.i18n.format("PF1.SkillCheck", { skill: skl.fullName }),
      chatTemplateData: { properties: props },
      compendium: { entry: pf1.config.skillCompendiumEntries[skillId] ?? skl.journal, type: "JournalEntry" },
      subject: { skill: skillId },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
      messageData: {
        flags: {
          pf1: {
            metadata,
          },
        },
      },
    };
    if (Hooks.call("pf1PreActorRollSkill", this, rollOptions, skillId) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    if (result) Hooks.callAll("pf1ActorRollSkill", this, result, skillId);
    return result;
  }

  /* -------------------------------------------- */

  /**
   * Roll basic BAB check
   *
   * @param {ActorRollOptions} [options] - Additional options
   * @returns {Promise<ChatMessage|object|void>} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollBAB(options = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.Error.NoActorPermissionAlt", { name: this.name }));
    }

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
   * @deprecated
   * @param {ActorRollOptions & {ranged: boolean, ability: string | null}} [options={}]
   * @returns {Promise<ChatMessage|object|void>} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollCMB(options = {}) {
    foundry.utils.logCompatibilityWarning(
      "ActorPF.rollCMB() is deprecated in favor of ActorPF.rollAttack({maneuver:true})",
      {
        since: "PF1 v10",
        until: "PF1 v11",
      }
    );

    return this.rollAttack({ maneuver: true, ...options });
  }

  /**
   * Roll a generic attack
   *
   * @example
   * await actor.rollAttack({ ranged: true }); // Basic ranged attack
   * await actor.rollAttack({ maneuver: true }); // Basic melee maneuver
   *
   * @param {ActorRollOptions} [options={}]
   * @param {boolean} [options.maneuver=false] - Whether this is weapon or maneuver check.
   * @param {boolean} [options.ranged=false] - Melee or ranged.
   * @param {boolean} [options.ability=null] - Attack ability. If not defined, appropriate one is chosen based on the ranged option.
   * @returns {Promise<ChatMessage|object|void>} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollAttack({ maneuver = false, ranged = false, ability = null, ...options } = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.Error.NoActorPermissionAlt", { name: this.name }));
    }

    if (options.melee !== undefined) {
      foundry.utils.logCompatibilityWarning("ActorPF.rollAttack() melee parameter has been deprecated.", {
        since: "PF1 v10",
        until: "PF1 v11",
      });

      ranged = !options.melee;
      delete options.melee;
    }

    const rangeLabel = {
      melee: "PF1.Melee",
      ranged: "PF1.Ranged",
    };

    let actionType;
    if (!maneuver) actionType = ranged ? "rwak" : "mwak";
    else actionType = ranged ? "rcman" : "mcman";

    const atkData = {
      ...pf1.components.ItemAction.defaultData,
      name: !ranged ? game.i18n.localize("PF1.Melee") : game.i18n.localize("PF1.Ranged"),
      actionType,
    };

    // Alter attack ability
    const atkAbl = this.system.attributes?.attack?.[`${ranged ? "ranged" : "melee"}Ability`];
    atkData.ability.attack = ability ?? (atkAbl || (ranged ? "dex" : "str"));

    // Alter activation type
    atkData.activation.type = "attack";
    atkData.activation.unchained.type = "attack";

    // Generate temporary item
    /** @type {pf1.documents.item.ItemAttackPF} */
    const atk = new Item.implementation(
      {
        type: "attack",
        name: !maneuver ? game.i18n.localize("TYPES.Item.weapon") : game.i18n.localize("PF1.CMBAbbr"),
        system: {
          actions: [atkData],
        },
      },
      { parent: this }
    );

    return atk.use(options);
  }

  /**
   * Roll a Caster Level check using a particular spellbook of this actor
   *
   * @example
   * await actor.rollCL("primary");
   *
   * @param {string} bookId Spellbook identifier
   * @param {ActorRollOptions} [options={}] Roll options
   * @returns {Promise<ChatMessage|object|void>} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollCL(bookId, options = {}) {
    const spellbook = this.system.attributes.spells.spellbooks[bookId];
    const rollData = options.rollData || this.getRollData();
    rollData.cl = spellbook.cl.total;

    // Set up roll parts
    const parts = [];

    const describePart = (value, label) => parts.push(`${value}[${label}]`);
    const srcDetails = (s) => s?.reverse().forEach((d) => describePart(d.value, d.name, -10));
    srcDetails(this.sourceDetails[`system.attributes.spells.spellbooks.${bookId}.cl.total`]);

    // Add contextual caster level string
    const notes = this.getContextNotesParsed(`spell.cl.${bookId}`);

    // Wound Threshold penalty
    const wT = this.getWoundThresholdData();
    if (wT.valid) notes.push(pf1.config.woundThresholdConditions[wT.level]);

    const props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    const token = options.token ?? this.token;

    const rollOptions = {
      ...options,
      parts,
      rollData,
      subject: { core: "cl", spellbook: bookId },
      flavor: game.i18n.localize("PF1.CasterLevelCheck"),
      chatTemplateData: { properties: props },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollCl", this, rollOptions, bookId) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    Hooks.callAll("pf1ActorRollCl", this, result, bookId);
    return result;
  }

  /**
   * Roll a concentration check using a particular spellbook of this actor
   *
   * @param {string} bookId Spellbook identifier
   * @param {ActorRollOptions} [options={}] Roll options
   * @returns {Promise<ChatMessage|object|void>} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollConcentration(bookId, options = {}) {
    const spellbook = this.system.attributes.spells.spellbooks[bookId];
    const rollData = options.rollData || this.getRollData();
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

    const token = options.token ?? this.token;

    const rollOptions = {
      ...options,
      parts,
      rollData,
      subject: { core: "concentration", spellbook: bookId },
      flavor: game.i18n.localize("PF1.ConcentrationCheck"),
      chatTemplateData: { properties: props },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollConcentration", this, rollOptions, bookId) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    Hooks.callAll("pf1ActorRollConcentration", this, result, bookId);
    return result;
  }

  /**
   * @protected
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
        const value = [
          ...actorData.traits.dv.value.map((obj) => damageTypes[obj]),
          ...(actorData.traits.dv.custom || []),
        ];
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
      const value = [
        ...actorData.traits.di.value.map((obj) => damageTypes[obj]),
        ...(actorData.traits.di.custom || []),
        ...actorData.traits.ci.value.map((obj) => pf1.config.conditionTypes[obj]),
        ...(actorData.traits.ci.custom || []),
      ];
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

  /**
   * @protected
   * @returns
   */
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
   * @example
   * await actor.rollInitiative({ dice: "2d20kh", createCombatants: true, skipDialog: true });
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
   * @param {TokenDocumentPF} [options.token=this.token] - For which token this initiative roll is for
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
    token,
  } = {}) {
    token ||= this.token;

    // Obtain (or create) a combat encounter
    let combat = game.combat;
    if (!combat) {
      if (game.user.isGM) {
        const cls = getDocumentClass("Combat");
        combat = await cls.create({ scene: canvas.scene?.id, active: true });
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
      }
      // No tokens on scene
      else {
        const existing = combat.combatants.filter((t) => t.actor == this && !t.token);
        if (!existing.length) {
          toCreate.push({ actorId: this.id, hidden: false });
        }
      }

      if (toCreate.length) await combat.createEmbeddedDocuments("Combatant", toCreate);
    }

    let untokened = 0;
    // Roll initiative for combatants
    let combatants = combat.combatants.filter((c) => {
      if (c.actor?.id !== this.id) return false;
      if (token && c.token?.id !== token.id) return false;
      if (!c.token) untokened += 1;
      return rerollInitiative || c.initiative === null;
    });

    // If more than one relevant combatants with no token present, prune list of valid combatants.
    if (untokened > 1) {
      combatants = combatants.filter((c) => !!c.token || c.initiative === null);
      if (combatants.length == 0) ui.notifications.warn(game.i18n.localize("PF1.Error.NoInitOnDuplicateCombatant"));
    }

    // No combatants. Possibly from reroll being disabled.
    if (combatants.length == 0) return combat;

    foundry.utils.mergeObject(initiativeOptions, { d20: dice, bonus, rollMode, skipDialog });

    await combat.rollInitiative(
      combatants.map((c) => c.id),
      initiativeOptions
    );

    return combat;
  }

  /**
   * Roll a specific saving throw
   *
   * @example
   * await actor.rollSavingThrow("ref", { skipDialog: true, dice: "2d20kh", bonus: "4" });
   *
   * @param {"ref"|"fort"|"will"} savingThrowId Identifier for saving throw type.
   * @param {ActorRollOptions} [options={}] Roll options.
   * @returns {Promise<ChatMessage|object|void>} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollSavingThrow(savingThrowId, options = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.Error.NoActorPermissionAlt", { name: this.name }));
    }

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
    const changes = this.changes.filter((c) => ["allSavingThrows", savingThrowId].includes(c.target));
    {
      // Get damage bonus
      changeBonus = getHighestChanges(
        changes.filter((c) => {
          return c.operator !== "set";
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
      const label = pf1.config.woundThresholdConditions[rollData.attributes.woundThresholds.level];
      notes.push(label);
      parts.push(`- @attributes.woundThresholds.penalty[${label}]`);
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
      chatTemplateData: { properties: props },
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
   * @example
   * await actor.rollAbilityTest("str");
   *
   * @param {string} abilityId - The ability ID (e.g. "str")
   * @param {object} [options={}] - Additional options
   * @returns {Promise<ChatMessage|object|void>} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   */
  async rollAbilityTest(abilityId, options = {}) {
    if (!this.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.Error.NoActorPermissionAlt", { name: this.name }));
    }

    // Add contextual notes
    const rollData = options.rollData || this.getRollData();
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
      const label = pf1.config.woundThresholdConditions[rollData.attributes.woundThresholds.level];
      notes.push(label);
      parts.push(`- @attributes.woundThresholds.penalty[${label}]`);
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
      chatTemplateData: { properties: props },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };
    if (Hooks.call("pf1PreActorRollAbility", this, rollOptions, abilityId) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    Hooks.callAll("pf1ActorRollAbility", this, result, abilityId);
    return result;
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
      return void ui.notifications.warn(game.i18n.format("PF1.Error.NoActorPermissionAlt", { name: this.name }));
    }
    const rollData = this.getRollData();
    const damageTypes = pf1.registry.damageTypes.getLabels();

    // Add contextual AC notes
    const acNoteObjects = this.getContextNotes("misc.ac");
    const acNotes = this.formatContextNotes(acNoteObjects, rollData);
    if (this.system.attributes.acNotes) acNotes.push(...this.system.attributes.acNotes.split(/[\n\r]+/));

    // Add contextual CMD notes
    const cmdNoteObjects = this.getContextNotes("misc.cmd");
    const cmdNotes = this.formatContextNotes(cmdNoteObjects, rollData);
    if (this.system.attributes.cmdNotes) cmdNotes.push(...this.system.attributes.cmdNotes.split(/[\n\r]+/));

    // Add contextual SR notes
    const srNoteObjects = this.getContextNotes("misc.sr");
    const srNotes = this.formatContextNotes(srNoteObjects, rollData);
    if (this.system.attributes.srNotes) srNotes.push(...this.system.attributes.srNotes.split(/[\n\r]+/));

    // BUG: No specific saving throw notes are included
    const saveNotesObjects = this.getContextNotes("allSavingThrows");
    const saveNotes = this.formatContextNotes(saveNotesObjects, rollData);
    if (this.system.attributes.saveNotes) saveNotes.push(...this.system.attributes.saveNotes.split(/[\n\r]+/));

    // Add misc data
    const reSplit = pf1.config.re.traitSeparator;
    // Damage Reduction
    const drNotes = Object.values(this.parseResistances("dr"));

    // Energy Resistance
    const energyResistance = Object.values(this.parseResistances("eres"));

    // Damage Immunity
    if (this.system.traits.di.value.length || this.system.traits.di.custom.length) {
      const values = [
        ...this.system.traits.di.value.map((obj) => damageTypes[obj]),
        ...(this.system.traits.di.custom || []),
      ];
      energyResistance.push(...values.map((o) => game.i18n.format("PF1.ImmuneTo", { immunity: o })));
    }
    // Damage Vulnerability
    if (this.system.traits.dv.value.length || this.system.traits.dv.custom.length) {
      const values = [
        ...this.system.traits.dv.value.map((obj) => damageTypes[obj]),
        ...(this.system.traits.dv.custom || []),
      ];
      energyResistance.push(...values.map((o) => game.i18n.format("PF1.VulnerableTo", { vulnerability: o })));
    }
    // Conditions
    const conditions = Object.entries(this.system.conditions ?? {})
      .filter(([_, enabled]) => enabled)
      .map(([id]) => pf1.registry.conditions.get(id))
      .filter((c) => c?.showInDefense)
      .map((c) => c.name);

    // Wound Threshold penalty
    const wT = this.getWoundThresholdData();
    if (wT.valid) {
      const wTlabel = pf1.config.woundThresholdConditions[wT.level];
      acNotes.push(wTlabel);
      cmdNotes.push(wTlabel);
    }

    // Get actor's token
    token ??= this.token;

    // Create message
    const actorData = this.system;
    const templateData = {
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
        hardness: actorData.traits.hardness,
        sr: actorData.attributes.sr.total,
        srNotes: srNotes,
        drNotes: drNotes,
        energyResistance: energyResistance,
        conditions: conditions,
      },
      saves: {
        notes: saveNotes,
      },
    };
    // Add regeneration and fast healing
    if ((actorData.traits?.fastHealing || "").length || (actorData.traits?.regen || "").length) {
      templateData.regen = {
        regen: actorData.traits.regen,
        fastHealing: actorData.traits.fastHealing,
      };
    }

    rollMode ??= game.settings.get("core", "rollMode");

    const chatData = {
      content: await renderTemplate("systems/pf1/templates/chat/defenses.hbs", templateData),
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
      rollMode,
      flags: {
        core: {
          canPopout: true,
        },
        pf1: {
          subject: "defenses",
        },
      },
    };

    // Apply roll mode
    ChatMessage.implementation.applyRollMode(chatData, rollMode);

    return ChatMessage.implementation.create(chatData);
  }

  /**
   * @internal
   * @param key
   */
  _deprecatePF1PrefixConditions(key) {
    if (/^pf1_/.test(key)) {
      const newKey = key.replace(/^pf1_/, "");
      foundry.utils.logCompatibilityWarning(`Condition "${key}" is deprecated in favor of "${newKey}"`, {
        since: "PF1 v10",
        until: "PF1 v11",
      });
      key = newKey;
    }
    return key;
  }

  /**
   * Easy way to toggle a condition.
   *
   * @example
   * await actor.toggleCondition("dazzled");
   *
   * @param {boolean} conditionId - A direct condition key, as per {@link pf1.registry.conditions}, such as `shaken` or `dazed`.
   * @param {object} [aeData] - Extra data to add to the AE if it's being enabled
   * @returns {object} Condition ID to boolean mapping of actual updates.
   */
  async toggleCondition(conditionId, aeData) {
    let active = !this.hasCondition(conditionId);
    if (active && aeData) active = aeData;
    return this.setCondition(conditionId, active);
  }

  /**
   * Easy way to set a condition.
   *
   * @example
   * await actor.setCondition("dazzled", true);
   * await actor.setCondition("sleep", { duration: { seconds: 60 } });
   *
   * @param {string} conditionId - A direct condition key, as per {@link pf1.registry.conditions}, such as `shaken` or `dazed`.
   * @param {object|boolean} enabled - Whether to enable (true) the condition, or disable (false) it. Or object for merging into the active effect as part of enabling.
   * @param {object} [context] Update context
   * @returns {object} Condition ID to boolean mapping of actual updates.
   */
  async setCondition(conditionId, enabled, context) {
    if (typeof enabled !== "boolean" && foundry.utils.getType(enabled) !== "Object")
      throw new TypeError("Actor.setCondition() enabled state must be a boolean or plain object");
    return this.setConditions({ [conditionId]: enabled }, context);
  }

  /**
   * Set state of multiple conditions.
   * Also handles condition tracks to minimize number of updates.
   *
   * @example
   * await actor.setConditions({ blind: true, sleep: false, shaken:true });
   *
   * @param {object} conditions Condition ID to boolean (or update data) mapping of new condition states. See {@link setCondition()}
   * @param {object} [context] Update context
   * @returns {Record<string,boolean>} Condition ID to boolean mapping of actual updates.
   */
  async setConditions(conditions = {}, context = {}) {
    conditions = foundry.utils.deepClone(conditions);

    // Backgrounds compatibility
    for (const key of Object.keys(conditions)) {
      const newKey = this._deprecatePF1PrefixConditions(key);
      if (newKey !== key) {
        conditions[newKey] = conditions[key];
        delete conditions[key];
      }
    }

    // Handle Condition tracks
    const tracks = pf1.registry.conditions.trackedConditions();
    for (const conditionGroup of tracks) {
      const newTrackState = conditionGroup.find((c) => conditions[c] === true);
      if (!newTrackState) continue;
      const disableTrackEntries = conditionGroup.filter((c) => c !== newTrackState);
      for (const key of disableTrackEntries) {
        conditions[key] = false;
      }
    }

    // Create update data
    const toDelete = [],
      toCreate = [];

    const immunities = this.getConditionImmunities();

    for (const [conditionId, value] of Object.entries(conditions)) {
      const currentCondition = pf1.registry.conditions.get(conditionId);
      if (currentCondition === undefined) {
        console.error("Unrecognized condition:", conditionId);
        delete conditions[conditionId];
        continue;
      }

      if (value === true && immunities.has(conditionId)) {
        console.warn("Actor is immune to condition:", conditionId, this);
        delete conditions[conditionId];
        continue;
      }

      const oldAe = this.hasCondition(conditionId) ? this.effects.find((ae) => ae.statuses.has(conditionId)) : null;

      // Create
      if (value) {
        if (!oldAe) {
          const aeData = {
            flags: {
              pf1: {
                autoDelete: true,
              },
            },
            statuses: [conditionId],
            name: currentCondition.name,
            icon: currentCondition.texture,
            label: currentCondition.name,
          };

          // Special boolean for easy overlay
          if (value?.overlay) {
            delete value.overlay;
            foundry.utils.setProperty(aeData.flags, "core.overlay", true);
          }

          if (typeof value !== "boolean") {
            foundry.utils.mergeObject(aeData, value);
          }

          toCreate.push(aeData);
        } else {
          delete conditions[conditionId];
        }
      }
      // Delete
      else {
        if (oldAe) {
          toDelete.push(oldAe.id);
        } else {
          delete conditions[conditionId];
        }
      }
    }

    // Perform updates
    // Inform update handlers they don't need to do work
    context.pf1 ??= {};
    context.pf1.updateConditionTracks = false;

    if (toDelete.length) {
      const deleteContext = foundry.utils.deepClone(context);
      // Prevent double render
      if (context.trender && toCreate.length) deleteContext.render = false;
      // Without await the deletions may not happen at all, presumably due to race condition, if AEs are also created.
      await this.deleteEmbeddedDocuments("ActiveEffect", toDelete, context);
    }
    if (toCreate.length) {
      const createContext = foundry.utils.deepClone(context);
      await this.createEmbeddedDocuments("ActiveEffect", toCreate, context);
    }

    this._conditionToggleNotify(conditions);

    return conditions;
  }

  /**
   * Easy way to determine whether this actor has a condition.
   *
   * @example
   * actor.hasCondition("grappled");
   *
   * @param {string} conditionId - A direct condition key, as per pf1.registry.conditions, such as `shaken` or `dazed`.
   * @returns {boolean} Condition state
   */
  hasCondition(conditionId) {
    conditionId = this._deprecatePF1PrefixConditions(conditionId);
    return this.statuses.has(conditionId);
  }

  /* -------------------------------------------- */

  /**
   * Helper function for actor energy resistance and damage reduction feedback.
   *
   * @protected
   * @param {string} damage Value to check resistances for. Either "dr" or "eres".
   * @returns {object} Entry to label mapping of resistances or reductions.
   */
  parseResistances(damage) {
    const format = (amount, type, operator, type2) => {
      let translatedType = type;
      if (type2) {
        switch (operator) {
          case false: {
            // Combine with AND
            translatedType = game.i18n.format("PF1.Application.DamageResistanceSelector.CombinationFormattedAnd", {
              type1: type,
              type2: type2,
            });
            break;
          }
          default:
          case true: {
            // Combine with OR
            translatedType = game.i18n.format("PF1.Application.DamageResistanceSelector.CombinationFormattedOr", {
              type1: type,
              type2: type2,
            });
            break;
          }
        }
      }

      return damage === "dr" ? `${amount}/${translatedType}` : `${translatedType} ${amount}`;
    };

    const damages = this.system.traits[damage];
    const resistances = {};
    damages.value.forEach((entry, counter) => {
      const { amount, operator } = entry;
      const type1 =
        pf1.registry.damageTypes.get(entry.types[0])?.name ??
        pf1.registry.materialTypes.get(entry.types[0])?.shortName ??
        pf1.registry.materialTypes.get(entry.types[0])?.name ??
        pf1.config.damageResistances[entry.types[0]] ??
        "-";
      const type2 =
        pf1.registry.damageTypes.get(entry.types[1])?.name ??
        pf1.registry.materialTypes.get(entry.types[1])?.shortName ??
        pf1.registry.materialTypes.get(entry.types[1])?.name ??
        pf1.config.damageResistances[entry.types[1]] ??
        "";

      resistances[`${counter + 1}`] = format(amount, type1, operator, type2);
    });

    if (damages.custom.length) {
      damages.custom.split(pf1.config.re.traitSeparator).forEach((entry, counter) => {
        const re = /(?<value>\d+)/.exec(entry);
        const amount = parseInt(re?.groups.value || "0");
        const type = entry.replace(/\d+\s*\/?/, "").trim();

        resistances[`custom${counter + 1}`] = format(amount, type, null, "");
      });
    }

    return resistances;
  }

  /**
   * Wrapper for the static function, taking this actor as the only target.
   *
   * @see {@link ActorPF.applyDamage}
   *
   * @example
   * await actor.applyDamage(10); // Cause 10 damage
   * await actor.applyDamage(-10): // Heal 10 damage
   * await actor.applyDamage(3, { asWounds: true }); // Apply 3 damage directly to Wounds instead of Vigor
   *
   * @param {number} value Value to adjust health by.
   * @param {object} options Additional options.
   */
  async applyDamage(value, options = {}) {
    return this.constructor.applyDamage(
      value,
      foundry.utils.mergeObject(options, {
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
   * @param {Array.<Token|Actor>} [options.targets=null] - Override the targets to apply damage to
   * @param {number} [options.critMult=0] - Critical multiplier as needed for Wounds & Vigor variant health rule. Set to 0 for non-critical hits.
   * @param {boolean} [options.asWounds=false] - Apply damage to wounds directly instead of vigor, as needed for Wounds & Vigor variant health rule.
   * @param {Event} [options.event] - Triggering event, if any
   * @param {Element} [options.element] - Triggering element, if any.
   * @param {ChatMessage} [options.message] - Chat message reference if any. This is to help modules, the system does not use it.
   * @param {DamageInstance[]} [options.instances] - Individual instances of damage. This is not processed currently.
   * @param {boolean} [options.dualHeal] - Is this dual dealing? If enabled, healing affects both normal health and nonlethal.
   * @returns {Promise<false|Actor[]>} - False if cancelled or array of updated actors.
   */
  static async applyDamage(
    value = 0,
    {
      forceDialog = false,
      reductionDefault = "",
      asNonlethal = false,
      targets = null,
      critMult = 0,
      dualHeal = false,
      asWounds = false,
      instances = [],
      event,
      element,
      message = null,
    } = {}
  ) {
    if (value == 0 || !Number.isFinite(value)) return void console.warn("Attempting to apply 0 damage.");

    const isHealing = value < 0;

    const promises = [];
    let controlled = canvas.tokens.controlled,
      healingInvert = 1;

    // Override targets, if supplied
    if (targets instanceof Array) {
      controlled = targets.filter((o) => o instanceof Token || o instanceof Actor);
    }

    const healthConfig = game.settings.get("pf1", "healthConfig");

    const numReg = /(\d+)/g,
      sliceReg = /[^,;\n]+/g;

    const _submit = async function (form, multiplier) {
      if (form) {
        value = form.find('[name="damage"]').val();
        let dR = form.find('[name="damage-reduction"]').val();
        value = value.length ? RollPF.safeRollSync(value).total : 0;
        dR = dR.length ? RollPF.safeRollSync(dR).total : 0;
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

      if (value == 0) return void console.warn("Attempting to apply 0 damage."); // Early exit

      for (const t of controlled) {
        const a = t instanceof Token ? t.actor : t;

        if (!a.isOwner) {
          ui.notifications.warn(game.i18n.format("PF1.Error.NoActorPermissionAlt", { name: this.name }));
          continue;
        }

        const actorType = { character: "pc", npc: "npc" }[a.type];
        const useWoundsAndVigor = healthConfig.variants[actorType]?.useWoundsAndVigor ?? false,
          hp = !useWoundsAndVigor ? a.system.attributes.hp : a.system.attributes.vigor,
          tmp = hp.temp || 0;

        const updateData = {};

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
            if (currentHealth > 0) {
              value = Math.min(currentHealth, value);
            } else {
              woundAdjust -= critMult > 1 ? critMult : 1;
              value = 0; // No other bleedover to wounds
            }
          }

          // Create update data
          if (dt != 0) updateData["system.attributes.vigor.temp"] = tmp - dt;
          if (value != 0) {
            let newHP = Math.min(currentHealth - value, hp.max);
            if (value > 0) {
              if (newHP < 0) {
                woundAdjust -= -newHP;
                if (critMult > 0) woundAdjust -= critMult;
                newHP = 0;
              }
            }

            if (newHP != hp.value) updateData["system.attributes.vigor.value"] = newHP;
          }

          if (woundAdjust != 0) {
            const wounds = a.system.attributes.wounds;
            updateData["system.attributes.wounds.value"] = Math.clamped(wounds.value + woundAdjust, 0, wounds.max);
          }
        }
        // Normal Hit Points
        else {
          // Nonlethal damage
          let nld = 0;
          if (asNonlethal) {
            if (value > 0) {
              nld = Math.min(hp.max - hp.nonlethal, value);
              value -= nld;
            }
            // Nonlethal healing
            else if (value < 0) {
              nld = value;
              value = 0;
            }
          }
          // Dual healing heals also nonlethal
          else if (isHealing && dualHeal) {
            nld = value;
          }

          // Temp HP adjustment
          const dt = value > 0 ? Math.min(tmp, value) : 0;

          // Create update data
          if (nld != 0) updateData["system.attributes.hp.nonlethal"] = Math.max(0, hp.nonlethal + nld);
          if (dt != 0) updateData["system.attributes.hp.temp"] = tmp - dt;
          const newHp = Math.min(hp.value - (value - dt), hp.max);
          if (newHp != hp.value) updateData["system.attributes.hp.value"] = newHp;
        }

        promises.push(a.update(updateData));
      }
      return Promise.all(promises);
    };

    if (pf1.skipConfirmPrompt ? !forceDialog : forceDialog) {
      if (isHealing) {
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
          dr: Object.values(actor.parseResistances("dr")),
          eres: Object.values(actor.parseResistances("eres")),
          hardness: actor.system.traits.hardness,
          di: [...actor.system.traits.di.value, ...(actor.system.traits.di.custom || [])],
          dv: [...actor.system.traits.dv.value, ...(actor.system.traits.dv.custom || [])],
          checked: true,
        };
      });

      // Dialog configuration and callbacks
      const template = "systems/pf1/templates/apps/damage-dialog.hbs";

      const dialogData = {
        damage: value,
        healing: healingInvert == -1 ? true : false,
        damageReduction: reductionDefault,
        tokens,
        nonlethal: asNonlethal,
        asWounds,
        critMult,
        instances,
      };

      const content = await renderTemplate(template, dialogData);

      return Dialog.wait(
        {
          title: healingInvert > 0 ? game.i18n.localize("PF1.ApplyDamage") : game.i18n.localize("PF1.ApplyHealing"),
          content,
          buttons: {
            normal: {
              label: game.i18n.localize("PF1.Apply"),
              callback: (html) => _submit.call(this, html, 1 * healingInvert),
            },
            half: {
              label: game.i18n.localize("PF1.ApplyHalf"),
              callback: (html) => _submit.call(this, html, 0.5 * healingInvert),
            },
          },
          default: "normal",
          close: (html) => false,
          render: (inp) => {
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
        },
        {
          focus: true,
        }
      );
    } else return _submit();
  }

  /**
   * Adjust temporary hit points.
   *
   * @example
   * ```js
   * actor.addTempHP(50); // Gain 50 THP
   * actor.addTempHP(-10); // Lose 10 THP
   * actor.addTempHP(0, {set:true}); // Set THP to zero
   * ```
   *
   * @param {number} value - Value to add to temp HP
   * @param {object} [options] - Additonal optons
   * @param {boolean} [options.set] - If true, the temporary hit points are set to the provide value instead of added to existing.
   * @returns {Promise<this|undefined>} - Updated document or undefined if no update occurred
   */
  async addTempHP(value, { set = false } = {}) {
    const hpconf = game.settings.get("pf1", "healthConfig").variants;
    const variant = this.type === "npc" ? hpconf.npc : hpconf.pc;
    const vigor = variant.useWoundsAndVigor;

    const curTHP = (vigor ? this.system.attributes.vigor.temp : this.system.attributes.hp.temp) || 0;
    const newTHP = Math.max(0, !set ? curTHP + value : value);

    return this.update({ system: { attributes: { [vigor ? "vigor" : "hp"]: { temp: newTHP } } } });
  }

  /**
   * Returns effective Wound Threshold multiplier with rules and overrides applied.
   *
   * @protected
   * @param {object} [options]
   * @param {object} [options.healthConfig] - PC/NPC health config variant data
   * @returns {number} Multiplier
   */
  getWoundThresholdMultiplier({ healthConfig } = {}) {
    healthConfig ??= game.settings.get("pf1", "healthConfig").variants[this.type === "npc" ? "npc" : "pc"];

    const wt = this.system.attributes?.woundThresholds ?? {};
    const override = wt.override ?? -1;
    return override >= 0 && healthConfig.allowWoundThresholdOverride ? override : healthConfig.useWoundThresholds;
  }

  /**
   * Returns Wound Threshold relevant data.
   *
   * @protected
   * @param {object} [options]
   * @param {object} [options.healthConfig] - PC/NPC health config variant data
   * @returns {{level:number,penalty:number,multiplier:number,valid:boolean}}
   */
  getWoundThresholdData({ healthConfig } = {}) {
    healthConfig ??= game.settings.get("pf1", "healthConfig").variants[this.type === "npc" ? "npc" : "pc"];

    const wt = this.system.attributes?.woundThresholds ?? {};

    const woundMult = this.getWoundThresholdMultiplier({ healthConfig }),
      woundLevel = wt.level || 0,
      woundPenalty = woundLevel * woundMult + (wt.mod || 0);

    return {
      level: woundLevel,
      penalty: woundPenalty,
      multiplier: woundMult,
      valid: woundLevel > 0 && woundMult > 0,
    };
  }

  /**
   * Updates attributes.woundThresholds.level variable.
   *
   * @protected
   */
  updateWoundThreshold() {
    const hpconf = game.settings.get("pf1", "healthConfig").variants;
    const variant = this.type === "npc" ? hpconf.npc : hpconf.pc;
    const usage = variant.useWoundThresholds;
    const vigor = variant.useWoundsAndVigor;
    const wt = this.system.attributes.woundThresholds;
    // Null if WT is not in use, or it is combined with Wounds & Vigor
    if (!usage || vigor) {
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

    const wtMult = this.getWoundThresholdMultiplier({ healthConfig: variant });
    const wtMod = wt.mod ?? 0;

    wt.level = level;
    wt.penaltyBase = level * wtMult; // To aid relevant formulas
    wt.penalty = level * wtMult + wtMod;

    const penalty = wt.penalty;
    // TODO: Convert to changes
    if (penalty != 0) {
      const changeFlatKeys = pf1.config.woundThresholdChangeTargets;
      for (const fk of changeFlatKeys) {
        const flats = getChangeFlat.call(this, fk, "untyped", -penalty);
        for (const k of flats) {
          if (!k) continue;
          const curValue = foundry.utils.getProperty(this, k) ?? 0;
          foundry.utils.setProperty(this, k, curValue - penalty);
        }
      }

      // Soft add change for attacks
      const ch = new pf1.components.ItemChange({
        _id: "woundThreshold",
        formula: `-${penalty}`,
        flavor: pf1.config.woundThresholdConditions[wt.level],
        target: "attack",
        type: "untyped",
        value: -penalty,
      });
      this.changes.set(ch.id, ch);
    } else {
      this.changes.delete("woundThreshold");
    }
  }

  /**
   * @type {Array<string>} - Array of all skill IDs relevant to this actor.
   */
  get allSkills() {
    const result = [];
    for (const [key, skillData] of Object.entries(this.system.skills)) {
      if (!skillData) continue;
      result.push(key);
      for (const subKey of Object.keys(skillData.subSkills ?? {})) {
        result.push(`${key}.${subKey}`);
      }
    }
    return result;
  }

  /**
   * An array of all context note data for this actor.
   *
   * @type {{notes: Array<pf1.components.ContextNote>, item: ItemPF}[]}
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
   * @param {boolean} [all=true] - Retrieve notes meant for all.
   */
  getContextNotes(context, all = true) {
    if (context.string) context = context.string;
    const result = this.allNotes;

    // Attacks
    if (context.match(/^attacks\.(.+)/)) {
      const key = RegExp.$1;
      for (const note of result) {
        note.notes = note.notes.filter((o) => o.target === key).map((o) => o.text);
      }

      return result;
    }

    // Skill
    if (context.match(/^skill\.(.+)/)) {
      const skillKey = RegExp.$1;
      const skill = this.getSkillInfo(skillKey);
      const ability = skill.ability;
      for (const noteSource of result) {
        noteSource.notes = noteSource.notes
          .filter((n) => [context, `${ability}Skills`].includes(n.target) || (all && n.target === "skills"))
          .map((n) => n.text);
      }

      return result;
    }

    // Saving throws
    if (context.match(/^savingThrow\.(.+)/)) {
      const saveKey = RegExp.$1;
      for (const noteSource of result) {
        noteSource.notes = noteSource.notes
          .filter((n) => [saveKey, "allSavingThrows"].includes(n.target))
          .map((n) => n.text);
      }

      if (this.system.attributes.saveNotes != null && this.system.attributes.saveNotes !== "") {
        result.push({ notes: [this.system.attributes.saveNotes], item: null });
      }

      return result;
    }

    // Ability checks
    if (context.match(/^abilityChecks\.(.+)/)) {
      const ablKey = RegExp.$1;
      for (const noteSource of result) {
        noteSource.notes = noteSource.notes
          .filter((n) => [`${ablKey}Checks`, "allChecks"].includes(n.target))
          .map((n) => n.text);
      }

      return result;
    }

    // Misc
    if (context.match(/^misc\.(.+)/)) {
      const miscKey = RegExp.$1;
      for (const noteSource of result) {
        noteSource.notes = noteSource.notes.filter((n) => n.target === miscKey).map((n) => n.text);
      }

      return result;
    }

    if (context.match(/^spell\.concentration\.([a-z]+)$/)) {
      const bookId = RegExp.$1;
      for (const noteSource of result) {
        noteSource.notes = noteSource.notes.filter((n) => n.target === "concentration").map((n) => n.text);
      }

      const spellbookNotes = this.system.attributes?.spells?.spellbooks?.[bookId]?.concentrationNotes;
      if (spellbookNotes?.length) {
        result.push({ notes: spellbookNotes.split(/[\n\r]+/), item: null });
      }

      return result;
    }

    if (context.match(/^spell\.cl\.([a-z]+)$/)) {
      const bookId = RegExp.$1;
      for (const noteSource of result) {
        noteSource.notes = noteSource.notes.filter((n) => n.target === "cl").map((n) => n.text);
      }

      const spellbookNotes = this.system.attributes?.spells?.spellbooks?.[bookId]?.clNotes;
      if (spellbookNotes?.length) {
        result.push({ notes: spellbookNotes.split(/[\n\r]+/), item: null });
      }

      return result;
    }

    if (context.match(/^spell\.effect$/)) {
      for (const noteSource of result) {
        noteSource.notes = noteSource.notes.filter((n) => n.target === "spellEffect").map((n) => n.text);
      }

      return result;
    }

    // Otherwise return notes if they directly match context
    for (const note of result) {
      note.notes = note.notes.filter((o) => o.target === context).map((o) => o.text);
    }

    return result.filter((n) => n.notes.length);
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
          relativeTo: this,
        };
        cur.push(enrichHTMLUnrolled(note, enrichOptions));
      }

      return cur;
    }, []);
  }

  /**
   * @param notes
   * @param rollData
   * @param root0
   * @param root0.roll
   * @returns {Array<string>}
   */
  formatContextNotes(notes, rollData, { roll = true } = {}) {
    const result = [];
    rollData ??= this.getRollData();
    for (const noteObj of notes) {
      rollData.item = {};
      if (noteObj.item != null) rollData = noteObj.item.getRollData();

      for (const note of noteObj.notes) {
        result.push(
          ...note
            .split(/[\n\r]+/)
            .map((subnote) => enrichHTMLUnrolled(subnote, { rollData, rolls: roll, relativeTo: this }))
        );
      }
    }
    return result;
  }

  /**
   * @typedef {object} MobilityPenaltyResult
   * @property {number|null} maxDexBonus - The maximum dexterity bonus allowed for this result.
   * @property {number} acp - The armor check penalty of this result.
   */

  /**
   * Computes encumbrance values for this actor.
   *
   * @internal
   * @returns {MobilityPenaltyResult} The resulting penalties from encumbrance.
   */
  _computeEncumbrance() {
    // Init base data
    this.system.attributes ??= {};
    const attributes = this.system.attributes;
    attributes.encumbrance ??= {};
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

  /**
   * @internal
   * @returns {number} - Total coin weight in lbs
   */
  _calculateCoinWeight() {
    const divisor = game.settings.get("pf1", "coinWeight");
    if (!divisor) return 0;
    return Object.values(this.system.currency || {}).reduce((total, coins) => total + (coins || 0), 0) / divisor;
  }

  /**
   * Calculate current carry capacity limits.
   *
   * @returns {{light:number,medium:number,heavy:number}}
   */
  getCarryCapacity() {
    // Determine carrying capacity
    const carryCapacity = this.system.details?.carryCapacity ?? {};
    const carryStr = this.system.abilities.str.total + carryCapacity.bonus?.total;
    let carryMultiplier = carryCapacity.multiplier?.total;
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

  /**
   * Determines carried weight.
   *
   * @returns {number} - kg or lbs of all carried things, including currency
   */
  getCarriedWeight() {
    const weight = this.items
      .filter((i) => i.isPhysical && i.system.carried !== false)
      .reduce((cur, o) => cur + o.system.weight.total, this._calculateCoinWeight());

    return pf1.utils.convertWeight(weight);
  }

  /**
   * Total coinage in both weighted and weightless.
   *
   * @deprecated Use {@link ActorPF.getTotalMergedCurrency} instead.
   * @param {object} [options] - Additional options
   * @param {boolean} [options.inLowestDenomination=false] - Use copper for calculations and return.
   * @returns {number} - The total amount of currency, in gold pieces.
   */
  mergeCurrency({ inLowestDenomination = false } = {}) {
    foundry.utils.logCompatibilityWarning(
      "ActorPF.mergeCurrency() is deprecated in favor of ActorPF.getTotalCurrency()",
      {
        since: "PF1 v10",
        until: "PF1 v11",
      }
    );

    return this.getTotalCurrency({ inLowestDenomination }, { v2: true });
  }

  /**
   * Get total currency in category.
   *
   * @param {"currency"|"altCurrency"} [category="currency"] - Currency category.
   * @param {object} [options] - Additional options
   * @param {boolean} [options.inLowestDenomination=true] - Return result in lowest denomination. If false, returns gold instead.
   * @returns {number} - Total currency in category.
   */
  getCurrency(category = "currency", { inLowestDenomination = true } = {}) {
    const currencies = this.system[category];
    if (!currencies) {
      console.error(`Currency type "${category}" not found.`);
      return NaN;
    }
    const total = currencies.pp * 1000 + currencies.gp * 100 + currencies.sp * 10 + currencies.cp;
    return inLowestDenomination ? total : total / 100;
  }

  /**
   * Total coinage in both weighted and weightless.
   *
   * @param {object} [options] - Additional options
   * @param {boolean} [options.inLowestDenomination=true] - Use copper for calculations and return.
   * @param {object} [deprecated] - Deprecated options
   * @returns {number} - The total amount of currency, in copper pieces.
   */
  getTotalCurrency(options, deprecated) {
    if (typeof options === "string" || options === undefined) {
      foundry.utils.logCompatibilityWarning(
        "ActorPF.getTotalCurrency() parameters changed. Options are now the first and only parameter. Old behaviour is found in getCurrency()",
        {
          since: "PF1 v10",
          until: "PF1 v11",
        }
      );

      return this.getCurrency(options, deprecated);
    }

    options ??= {};
    options.inLowestDenomination ??= true;

    const total =
      this.getCurrency("currency", { inLowestDenomination: true }) +
      this.getCurrency("altCurrency", { inLowestDenomination: true });
    return options.inLowestDenomination ? total : total / 100;
  }

  /**
   * Converts currencies of the given category to the given currency type
   *
   * @see {@link pf1.utils.currency.convert}
   *
   * @param {"currency"|"altCurrency"} [category="currency"] - Currency category, altCurrency is for weightless
   * @param {CoinType} [type="pp"] - Target currency.
   * @returns {Promise<this>|undefined} Updated document or undefined if no update occurred.
   */
  convertCurrency(category = "currency", type = "pp") {
    const cp = this.getCurrency(category, { inLowestDenomination: true });
    if (!Number.isFinite(cp)) {
      console.error(`Invalid total currency "${cp}" in "${category}" category`);
      return;
    }

    const currency = pf1.utils.currency.convert(cp, type, { pad: true });

    return this.update({ system: { [category]: currency } });
  }

  /**
   * Prepare armor/shield data for roll data
   *
   * @internal
   * @param {object} equipment Equipment info
   * @param {string} equipment.id Item ID
   * @param {string} equipment.type Armor/Shield type
   * @param {object} armorData Armor data object
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

  /**
   * Retrieve data used to fill in roll variables.
   *
   * @example
   * await new Roll("1d20 + \@abilities.wis.mod[Wis]", actor.getRollData()).toMessage();
   *
   * @override
   * @param {object} [options] - Additional options
   * @returns {object}
   */
  getRollData(options = { refresh: false }) {
    // Return cached data, if applicable
    const skipRefresh = !options.refresh && this._rollData;

    const result = { ...(skipRefresh ? this._rollData : foundry.utils.deepClone(this.system)) };

    pf1.utils.rollData.addStatic(result);

    // Clear certain fields if not refreshing
    if (skipRefresh) {
      for (const path of pf1.config.temporaryRollDataFields.actor) {
        foundry.utils.setProperty(result, path, undefined);
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
    result.conditions ??= {};
    result.conditions.loseDexToAC = this.changeFlags?.loseDexToAC ?? false;

    // Return cached data, if applicable
    if (skipRefresh) return result;

    /* ----------------------------- */
    /* Set the following data on a refresh
    /* ----------------------------- */

    // Sync health values
    for (const hpKey of ["hp", "wounds", "vigor"]) {
      const hp = result.attributes[hpKey];
      hp.value = hp.max + hp.offset;
      /*
      // Supporting values
      const thp = hp.temp ?? 0;
      hp.effective = hp.value + thp;
      hp.ratio = hp.effective / (hp.max + thp);
      */
    }

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
    result.bFlags = Object.fromEntries(
      Object.entries(this.itemFlags?.boolean ?? {}).map(([key, { sources }]) => [key, sources.length > 0 ? 1 : 0])
    );

    result.range = this.system.traits?.reach?.total ?? { melee: NaN, reach: NaN };

    // Add class info
    result.classes = this.classes;
    const negLevels = result.attributes.energyDrain ?? 0;
    if (negLevels > 0 && result.classes) {
      for (const cls of Object.values(result.classes)) {
        if (cls.isMythic) continue;
        cls.level = Math.max(0, cls.unlevel - negLevels);
      }
    }

    // Map HP ability
    const hpAbility = result.abilities[result.attributes.hpAbility];
    Object.defineProperty(result.attributes, "hpAbility", {
      get() {
        return hpAbility;
      },
    });

    // @since PF1 v10
    result.alignment = pf1.utils.parseAlignment(this.system.details?.alignment || "tn");

    this._rollData = result;

    // Call hook
    if (Hooks.events["pf1GetRollData"]?.length > 0) Hooks.callAll("pf1GetRollData", this, result);

    return result;
  }

  /**
   * Get melee and reach maximum ranges.
   *
   * @param {ActorSize|number} size - Actor size as size key or number
   * @param {ActorStature} stature - Actor stature
   * @returns {{melee:number,reach:number}} - Ranges
   */
  static getReach(size = "med", stature = "tall") {
    let effectiveSize = size >= 0 ? size : Object.keys(pf1.config.sizeChart).indexOf(size);
    // Long creatures larger than medium count as one size smaller
    // https://www.aonprd.com/Rules.aspx?ID=179
    if (stature !== "tall" && effectiveSize > 4) effectiveSize -= 1;

    const reachStruct = (melee, reach) => ({ melee, reach });

    switch (effectiveSize) {
      case 0: // Fine
      case 1: // Diminutive
        return reachStruct(0, 0);
      case 2: // Tiny
        return reachStruct(0, 5);
      default:
      case 3: // Small
      case 4: // Medium
        return reachStruct(5, 10);
      case 5: // Large
        return reachStruct(10, 20);
      case 6: // Huge
        return reachStruct(15, 30);
      case 7: // Gargantuan
        return reachStruct(20, 40);
      case 8: // Colossal
        return reachStruct(30, 60);
    }
  }

  /**
   * @protected
   * @returns
   */
  getQuickActions() {
    return this.items
      .filter((o) => o.isActive && o.system.showInQuickbar === true && o.showUnidentifiedData !== true)
      .sort((a, b) => a.sort - b.sort)
      .map((item) => {
        const qi = {
          item,
          name: item.name,
          id: item.id,
          type: item.type,
          img: item.img,
          get isSingleUse() {
            return item.isSingleUse;
          },
          get haveAnyCharges() {
            return this.item.isCharged && Number.isFinite(this.maxCharge);
          },
          get maxCharge() {
            return item.maxCharges;
          },
          get charges() {
            return this.item.charges;
          },
        };

        // Fill in charge details
        qi.isCharged = qi.haveAnyCharges;
        if (qi.isCharged) {
          let chargeCost = item.defaultAction?.getChargeCost() ?? item.getDefaultChargeCost();
          if (chargeCost == 0) qi.isCharged = false;

          qi.recharging = chargeCost < 0;
          chargeCost = Math.abs(chargeCost);

          if (chargeCost != 0) {
            qi.max = qi.maxCharge;
            qi.uses = qi.charges;

            // Maximum charging
            if (qi.recharging) {
              qi.uses = Math.ceil((qi.max - qi.uses) / chargeCost);
              qi.max = Math.ceil(qi.max / chargeCost);
            }
            // Actual uses
            else {
              qi.uses = Math.floor(qi.uses / chargeCost);
              qi.max = Math.floor(qi.max / chargeCost);
            }
          }
        } else {
          const action = item.defaultAction;
          // Add fake charges for ammo using items
          if (action?.ammoType) {
            const ammo = item.defaultAmmo;
            if (ammo) {
              qi.isCharged = true;
              qi.uses = ammo.system.quantity || 0;
            }
          }
        }

        return qi;
      });
  }

  /**
   * @internal
   */
  refreshAbilityModifiers() {
    for (const k of Object.keys(this.system.abilities)) {
      const total = this.system.abilities[k].total;
      const penalty = Math.abs(this.system.abilities[k].penalty || 0);
      const damage = this.system.abilities[k].damage;
      const newMod = pf1.utils.getAbilityModifier(total, { penalty, damage });
      this.system.abilities[k].mod = newMod;
    }
  }

  /**
   * @override
   * @protected
   * @param {object} json
   * @returns {Promise<this>}
   */
  async importFromJSON(json) {
    // Import from JSON
    const data = JSON.parse(json);
    delete data._id;
    data.effects = [];

    // Update data
    return this.update(data, { diff: false, recursive: false });
  }

  /**
   * Return feat counts.
   *
   * @typedef FeatCounts
   * @type {object}
   * @property {number} max - The maximum allowed feats.
   * @property {number} active - The current number of active feats.
   * @property {number} owned - The current number of feats, active or not.
   * @property {number} levels - Feats gained by levels specifically
   * @property {number} mythic - Mythic feats
   * @property {number} formula - Feats gained by custom formula on the feats tab
   * @property {number} changes - Feats gained via Changes
   * @property {number} disabled - Disabled feats
   * @property {number} excess - Feats over maximum allowed
   * @property {number} missing - Feats under maximum allowed
   * @returns {FeatCounts} An object with a property `value` which refers to the current used feats, and `max` which refers to the maximum available feats.
   */
  getFeatCount() {
    const feats = this.itemTypes.feat.filter((o) => o.subType === "feat");

    const active = feats.filter((o) => o.isActive).length;
    const owned = feats.length;

    const result = {
      max: 0,
      active,
      owned,
      disabled: owned - active,
      levels: 0,
      mythic: 0,
      formula: 0,
      changes: 0,
      // Count totals
      get discrepancy() {
        return this.max - this.active;
      },
      get missing() {
        return Math.max(0, this.discrepancy);
      },
      get excess() {
        return Math.max(0, -this.discrepancy);
      },
    };

    // Backwards compatibility
    Object.defineProperty(result, "value", {
      get() {
        foundry.utils.logCompatibilityWarning("getFeatCount().value is deprecated in favor of getFeatCount().active", {
          since: "PF1 v10",
          until: "PF1 v11",
        });

        return this.active;
      },
    });

    const isMindless = this.system.abilities?.int?.value === null;

    // Ignore classes for feats with mindless
    // Mindless gets other bonuses to feats beyond these...
    // ... since they can be explicit "gains X feat", homebrew, or other impossible to account for.
    if (!isMindless) {
      // Add feat count by level
      result.levels = Math.ceil(this.system.attributes.hd.total / 2);
      result.max += result.levels;

      // Mythic feats
      // https://aonprd.com/Rules.aspx?Name=Mythic%20Heroes&Category=Mythic%20Rules
      // Gained at 1, 3, 5, etc.
      result.mythic = Math.ceil(this.system.details.mythicTier / 2);
      result.max += result.mythic;
    }

    // Bonus feat formula
    const bonusRoll = RollPF.safeRollSync(this.system.details?.bonusFeatFormula || "0", this.getRollData());
    result.formula = bonusRoll.total;
    result.max += result.formula;
    if (bonusRoll.err) {
      console.error(
        `An error occurred in the Bonus Feat Formula of actor "${this.name}" [${this.id}].`,
        {
          formula: this.system.details?.bonusFeatFormula,
          actor: this,
        },
        bonusRoll.err
      );
    }

    // Bonuses from changes
    result.changes = getHighestChanges(
      this.changes.filter((c) => {
        if (c.target !== "bonusFeats") return false;
        return c.operator !== "set";
      }),
      { ignoreTarget: true }
    ).reduce((cur, c) => cur + c.value, 0);
    result.max += result.changes;

    return result;
  }

  /**
   * Check if actor has item with specified boolean flag.
   *
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
      if (!spellbook.inUse) continue;

      // Restore spellbooks using spell points
      if (spellbook.spellPoints.useSystem) {
        // Try to roll restoreFormula, fall back to restoring max spell points
        let restorePoints = spellbook.spellPoints.max;
        if (spellbook.spellPoints.restoreFormula) {
          const restoreRoll = await RollPF.safeRollAsync(spellbook.spellPoints.restoreFormula, rollData);
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
   * Recharge all owned items.
   *
   * @see {@link pf1.documents.item.ItemPF.recharge}
   *
   * @example
   * await actor.rechargeItems(); // Recharge items with default settings.
   * await actor.rechargeItems({ period: "week" }); // Recharge items as if week had passed.
   *
   * @param {RechargeActorItemsOptions} [options] - Additional options
   * @returns {Promise<Item[]|object[]>} - Result of an update or the update data.
   */
  async rechargeItems({ commit = true, ...rechargeOptions } = {}) {
    const actorData = this.system;
    const itemUpdates = [];

    // Update charged items
    // TODO: Await all item recharges in one go.
    for (const item of this.items) {
      const itemUpdate = await item.recharge({ ...rechargeOptions, commit: false });

      // Append update to queue
      if (itemUpdate?.system && !foundry.utils.isEmpty(itemUpdate.system)) {
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
   * @protected
   * @param {object} options Resting options.
   * @returns {object} Update data object
   */
  _restingHeal(options = {}) {
    const actorData = this.system,
      hp = actorData.attributes.hp,
      wounds = actorData.attributes?.wounds,
      vigor = actorData.attributes?.vigor;

    const { hours, longTermCare } = options;
    const updateData = {};

    const hd = actorData.attributes.hd.total;

    // Base healing
    const heal = {
      hp: hd,
      abl: 1,
      nonlethal: hours * hd,
      vigor: vigor?.max ?? 0,
      wounds: wounds?.max > 0 ? 1 : 0,
    };

    // -- Normal Hit Points ---

    // Full day of resting
    if (hours >= 24) {
      heal.hp += 1;
      heal.wounds += Math.floor(hd / 2);
      heal.abl += 1;
    }
    // Long term care
    if (longTermCare === true) {
      heal.hp *= 2;
      heal.abl *= 2;
      heal.wounds *= 2;
    }

    updateData["system.attributes.hp.value"] = Math.min(hp.value + heal.hp, hp.max);
    updateData["system.attributes.hp.nonlethal"] = Math.max(0, (hp.nonlethal || 0) - heal.nonlethal);
    for (const [key, abl] of Object.entries(actorData.abilities)) {
      const dmg = Math.abs(abl.damage);
      updateData[`system.abilities.${key}.damage`] = Math.max(0, dmg - heal.abl);
    }

    // --- Wounds & Vigor ---

    // Secondary actors don't use W&V rules
    if (wounds?.max && vigor?.max) {
      updateData["system.attributes.wounds.value"] = Math.min(wounds.value + heal.wounds, wounds.max);
      updateData["system.attributes.vigor.value"] = Math.min(vigor.value + heal.vigor, vigor.max);
    }

    return updateData;
  }

  /**
   * Perform all changes related to an actor resting, including restoring HP, ability scores, item uses, etc.
   *
   * @example
   * await actor.performRest();
   *
   * @see {@link hookEvents!pf1PreActorRest pf1PreActorRest hook}
   * @see {@link hookEvents!pf1ActorRest pf1ActorRest hook}
   * @param {Partial<ActorRestOptions>} options - Options affecting an actor's resting
   * @returns {Promise<ActorRestData | void>} Updates applied to the actor, if resting was completed
   */
  async performRest(options = {}) {
    const { restoreHealth = true, longTermCare = false, restoreDailyUses = true, hours = 8, verbose = false } = options;
    const actorData = this.system;

    const updateData = {};
    // Restore health and ability damage
    if (restoreHealth === true) {
      const healUpdate = this._restingHeal(options);
      foundry.utils.mergeObject(updateData, healUpdate);
    }

    let itemUpdates = [];
    // Restore daily uses of spells, feats, etc.
    if (restoreDailyUses === true) {
      const spellbookUpdates = await this.resetSpellbookUsage({ commit: false });
      foundry.utils.mergeObject(updateData, spellbookUpdates);

      // Recharge all items (including spells for prepared spellbooks)
      itemUpdates = await this.rechargeItems({ commit: false, updateData, period: "day" });
    }

    options = { restoreHealth, restoreDailyUses, longTermCare, hours };
    const allowed = Hooks.call("pf1PreActorRest", this, options, updateData, itemUpdates);
    if (allowed === false) return;

    const context = { pf1: { action: "rest", restOptions: options } };

    if (itemUpdates.length) await this.updateEmbeddedDocuments("Item", itemUpdates, foundry.utils.deepClone(context));
    if (!foundry.utils.isEmpty(updateData.system)) await this.update(updateData, foundry.utils.deepClone(context));

    Hooks.callAll("pf1ActorRest", this, options, updateData, itemUpdates);

    if (verbose) {
      const message = restoreDailyUses ? "PF1.FullRestMessage" : "PF1.RestMessage";
      ui.notifications.info(game.i18n.format(message, { name: this.token?.name ?? this.name, hours }));
    }

    return { options, updateData, itemUpdates };
  }

  /**
   * @protected
   * @override
   */
  async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
    let doc = this;
    const current = foundry.utils.getProperty(this.system, attribute),
      updates = {};

    const isResource = current instanceof Resource;
    if (isResource) doc = current.item;

    if (!doc) return;
    const updateData = {};

    // Hit points
    if (attribute === "attributes.hp") {
      if (!isDelta) value = (current.temp + current.value - value) * -1;
      let dt = value;
      if (current.temp > 0 && value < 0) {
        dt = Math.min(0, current.temp + value);
        updates["system.attributes.hp.temp"] = Math.max(0, current.temp + value);
      }
      updates["system.attributes.hp.value"] = Math.min(current.value + dt, current.max);
    }
    // Wounds & Vigor
    else if (attribute === "attributes.vigor") {
      if (!isDelta) value = (current.temp + current.value - value) * -1;
      let dt = value;
      if (current.temp > 0 && value < 0) {
        dt = Math.min(0, current.temp + value);
        updates["system.attributes.vigor.temp"] = Math.max(0, current.temp + value);
      }
      updates["system.attributes.vigor.value"] = Math.min(current.value + dt, current.max);
    }
    // Relative
    else if (isDelta) {
      if (isResource) {
        updates["system.uses.value"] = Math.min(current.value + value, current.max);
      } else {
        if (isBar)
          updates[`system.${attribute}.value`] = Math.clamped(current.value + value, current.min || 0, current.max);
        else updates[`system.${attribute}`] = current + value;
      }
    }
    // Absolute
    else {
      if (isResource) {
        updates["system.uses.value"] = Math.clamped(value, 0, current.max);
      } else {
        if (isBar) updates[`system.${attribute}.value`] = Math.min(value, current.max);
        else updates[`system.${attribute}`] = value;
      }
    }

    const allowed = Hooks.call("modifyTokenAttribute", { attribute, value, isDelta, isBar }, updates);
    return allowed !== false ? doc.update(updates) : this;
  }

  /**
   * The VisionSharingSheet instance for this actor
   *
   * @type {VisionSharingSheet}
   */
  get visionSharingSheet() {
    this._visionSharingSheet ??= new VisionSharingSheet(this);
    return this._visionSharingSheet;
  }
}

/**
 * @typedef {object} ActorRestOptions
 * Options given to {@link ActorPF.performRest} affecting an actor's resting.
 * @property {boolean} [restoreHealth=true] - Whether the actor's health should be restored.
 * @property {boolean} [restoreDailyUses=true] - Whether daily uses of spells and abilities should be restored.
 * @property {boolean} [longTermCare=false] - Whether additional hit and ability score points should be restored through the Heal skill.
 * @property {number} [hours=8] - The number of hours the actor will rest.
 * @property {boolean} [verbose=false] - Display notification once rest processing finishes.
 */

/**
 * @typedef {object} ActorRestData
 * @property {ActorRestOptions} options - Options for resting
 * @property {object} updateData - Updates applied to the actor
 * @property {object[]} itemUpdates - Updates applied to the actor's items
 */

/**
 * @typedef {object} DamageInstance
 * @property {number} value - Total damage in this instance
 * @property {object} types - Damage type data
 * @property {string} types.custom - Custom damage types
 * @property {string[]} types.values - Standard damage types
 */

/**
 * TODO: Merge data/handling to changes
 *
 * @typedef {object} SourceInfo
 * @property {string} modifier - Bonus type
 * @property {string} name - Item name or other label
 * @property {"add"|"set"} operator - Change operator
 * @property {string} type - Arbitrary type
 * @property {number} value - Change value
 * @property {ItemChange} change - Parent change
 */
