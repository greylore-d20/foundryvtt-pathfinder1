import { ActorTraitSelector } from "../trait-selector.mjs";
import { ActorResistanceSelector } from "../damage-resistance-selector.mjs";
import { ActorRestDialog } from "./actor-rest.mjs";
import { CR, adjustNumberByStringCommand, openJournal } from "../../utils/lib.mjs";
import { PointBuyCalculator } from "../point-buy-calculator.mjs";
import { Widget_ItemPicker } from "../item-picker.mjs";
import { getSkipActionPrompt } from "../../documents/settings.mjs";
import { ItemPF } from "../../documents/item/item-pf.mjs";
import { applyAccessibilitySettings } from "../../utils/chat.mjs";
import { LevelUpForm } from "../level-up.mjs";
import { CurrencyTransfer } from "../currency-transfer.mjs";
import { getHighestChanges } from "../../documents/actor/utils/apply-changes.mjs";
import { RollPF } from "../../dice/roll.mjs";
import { renderCachedTemplate } from "@utils/handlebars/templates.mjs";

/**
 * Extend the basic ActorSheet class to do all the PF things!
 * This sheet is an Abstract layer which is not used.
 *
 * @type {ActorSheet}
 */
export class ActorSheetPF extends ActorSheet {
  constructor(...args) {
    super(...args);

    /**
     * Track the set of item filters which are applied
     *
     * @type {Set}
     */
    this._filters = {
      inventory: new Set(),
      "spellbook-primary": new Set(),
      "spellbook-secondary": new Set(),
      "spellbook-tertiary": new Set(),
      "spellbook-spelllike": new Set(),
      features: new Set(),
      buffs: new Set(),
      attacks: new Set(),
      search: {
        inventory: "",
        attacks: "",
        feats: "",
        buffs: "",
        "spellbook-primary": "",
        "spellbook-secondary": "",
        "spellbook-tertiary": "",
        "spellbook-spelllike": "",
      },
    };

    /** Item search */
    this.searchCompositioning = false; // for IME
    this.searchRefresh = true; // Lock out same term search unless sheet also refreshes
    this.searchDelay = 250; // arbitrary ?ms for arbitrarily decent reactivity; MMke this configurable?
    this.searchDelayEvent = null; // setTimeout id
    this.effectiveSearch = {}; // prevent searching the same thing

    /**
     * Track item updates from the actor sheet.
     *
     * @property
     * @private
     * @type {object[]}
     */
    this._itemUpdates = [];

    /**
     * Track hidden elements of the sheet.
     *
     * @property
     */
    this._hiddenElems = {};

    /**
     * @type {boolean} Whether the skills are currently locked.
     * @property
     * @private
     */
    this._skillsLocked = true;

    /**
     * @type {string[]} IDs of expanded items.
     * @private
     */
    this._expandedItems = [];
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "pf1", "actor"],
      scrollY: [
        ".combat-attacks",
        ".item-groups-list",
        ".skills-list",
        ".traits",
        ".actor-notes",
        ".editor-content[data-edit='system.details.biography.value']",
      ],
      dragDrop: [
        { dragSelector: "li.item[data-item-id]" },
        { dragSelector: ".currency .denomination" },
        { dragSelector: ".race-container.item[data-item-id]" },
        { dragSelector: "li.skill[data-skill]" },
        { dragSelector: "li.sub-skill[data-skill]" },
        { dragSelector: ".saving-throw[data-savingthrow]" },
        { dragSelector: ".attribute[data-attribute]" },
        { dragSelector: ".attribute[data-attack]" },
        { dragSelector: "li.generic-defenses[data-drag]" },
        { dragSelector: ".ability-scores .ability[data-ability]" },
        { dragSelector: ".spellcasting-concentration[data-drag]" },
        { dragSelector: ".spellcasting-cl" },
      ],
      tabs: [
        {
          navSelector: "nav.tabs[data-group='primary']",
          contentSelector: "section.primary-body",
          initial: "summary",
          group: "primary",
        },
        {
          navSelector: "nav.tabs[data-group='skillset']",
          contentSelector: "section.skillset-body",
          initial: "adventure",
          group: "skills",
        },
        {
          navSelector: "nav.tabs[data-group='spellbooks']",
          contentSelector: "section.spellbooks-body",
          initial: "primary",
          group: "spellbooks",
        },
      ],
    };
  }

  /**
   * Returns an object containing feature type specific data relevant to feature organization.
   *
   * @static
   * @type {Object<string, any>}
   */
  static get featTypeData() {
    return {
      template: {
        hasActions: false,
      },
    };
  }

  get currentPrimaryTab() {
    return this._tabs.find((t) => t.group === "primary")?.active || null;
  }

  get currentSpellbookKey() {
    return this._tabs.find((t) => t.group === "spellbooks")?.active || "primary";
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   *
   * @param options
   */
  async getData(options) {
    const isOwner = this.document.isOwner;

    const isMetricDist = pf1.utils.getDistanceSystem() === "metric";

    const data = {
      actor: this.actor,
      document: this.actor,
      effects: this.actor.effects,
      options: this.options,
      owner: isOwner,
      itemTypes: this.actor.itemTypes,
      limited: this.document.limited,
      editable: this.isEditable,
      cssClass: isOwner ? "editable" : "locked",
      isCharacter: this.document.type === "character",
      hasHD: true,
      config: pf1.config,
      isGM: game.user.isGM,
      race: this.document.race != null ? this.document.race.toObject() : null,
      usesAnySpellbook: this.document.system.attributes.spells.usedSpellbooks?.length > 0 ?? false,
      sourceData: {},
      skillsLocked: this._skillsLocked,
      units: {
        weight:
          pf1.utils.getWeightSystem() === "metric" ? game.i18n.localize("PF1.Kgs") : game.i18n.localize("PF1.Lbs"),
        distance: {
          tactical: isMetricDist ? pf1.config.measureUnitsShort.m : pf1.config.measureUnitsShort.ft,
          overland: isMetricDist ? pf1.config.measureUnitsShort.km : pf1.config.measureUnitsShort.mi,
        },
      },
      unchainedActions: game.settings.get("pf1", "unchainedActionEconomy"),
    };

    Object.values(data.itemTypes).forEach((items) => items.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)));

    const rollData = this.document.getRollData();
    data.rollData = rollData;
    data.system = foundry.utils.deepClone(this.document.system);

    data.inCharacterGeneration = this.inCharacterGeneration;

    data.hasProficiencies = data.isCharacter || game.settings.get("pf1", "npcProficiencies");

    // BAB iteratives
    if (!data.unchainedActions) {
      const bab = data.rollData.attributes?.bab?.total;
      if (bab > 0) {
        const numAttacks = 1 + RollPF.safeRoll(pf1.config.iterativeExtraAttacks, { bab }).total || 0;
        const iters = Array.fromRange(numAttacks).map(
          (attackCount) => bab + RollPF.safeRoll(pf1.config.iterativeAttackModifier, { attackCount }).total
        );
        data.iteratives = `+${iters.join(" / +")}`;
      }
    }

    // Show whether the item has currency
    data.hasCurrency = Object.values(this.object.system.currency).some((o) => o > 0);
    data.hasAltCurrency = Object.values(this.object.system.altCurrency).some((o) => o > 0);

    // Enrich descriptions
    data.biographyHTML = await TextEditor.enrichHTML(data.system.details.biography.value, {
      secrets: isOwner,
      rollData: data.rollData,
      async: true,
      relativeTo: this.actor,
    });
    data.notesHTML = await TextEditor.enrichHTML(data.system.details.notes.value, {
      secrets: isOwner,
      rollData: data.rollData,
      async: true,
      relativeTo: this.actor,
    });

    // The Actor and its Items
    data.token = this.token;
    data.items = this.document.items.map((item) => this._prepareItem(item));

    data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    data.labels = this.document.getLabels();
    data.filters = this._filters;

    // Generic melee and ranged attack bonuses, only present for sheet.
    {
      const attributes = data.system.attributes,
        abilities = data.system.abilities,
        sizeModifier = pf1.config.sizeMods[data.system.traits.size],
        baseBonus = attributes.attack.shared + attributes.attack.general + sizeModifier,
        meleeAbility = abilities[attributes.attack.meleeAbility]?.mod ?? 0,
        rangedAbility = abilities[attributes.attack.rangedAbility]?.mod ?? 0;

      data.genericAttacks = {
        melee: {
          ability: attributes.attack.meleeAbility,
          abilityMod: meleeAbility,
          modifier: baseBonus + attributes.attack.melee + meleeAbility,
        },
        ranged: {
          ability: attributes.attack.rangedAbility,
          abilityMod: rangedAbility,
          modifier: baseBonus + attributes.attack.ranged + rangedAbility,
        },
      };
    }

    // Add inventory value
    {
      const cpValue = this.calculateTotalItemValue({ inLowestDenomination: true });
      const totalValue = pf1.utils.currency.split(cpValue);
      data.labels.totalValue = game.i18n.format("PF1.TotalItemValue", {
        gp: totalValue.gp,
        sp: totalValue.sp,
        cp: totalValue.cp,
      });
    }

    // Ability Scores
    for (const [a, abl] of Object.entries(data.system.abilities)) {
      abl.label = pf1.config.abilities[a];
      abl.totalLabel = abl.total == null ? "-" : abl.total;
    }

    // Armor Class
    for (const [a, ac] of Object.entries(data.system.attributes.ac)) {
      ac.label = pf1.config.ac[a];
    }

    // Saving Throws
    for (const [a, savingThrow] of Object.entries(data.system.attributes.savingThrows)) {
      savingThrow.label = pf1.config.savingThrows[a];
    }

    // Update skill labels
    for (const [skillId, skill] of Object.entries(data.system.skills ?? {})) {
      skill.key = skillId;
      skill.skillId = skillId;
      skill.label = pf1.config.skills[skillId] || skill.name;
      skill.arbitrary = pf1.config.arbitrarySkills.includes(skillId);
      skill.compendiumEntry = pf1.config.skillCompendiumEntries[skillId] || skill.journal || null;
      skill.untrained = skill.rt === true && !(skill.rank > 0);

      if (skill.subSkills != null) {
        for (const [subSkillId, subSkill] of Object.entries(skill.subSkills)) {
          subSkill.key = `${skillId}.subSkills.${subSkillId}`;
          subSkill.skillId = skillId;
          subSkill.subSkillId = subSkillId;
          subSkill.label ||= subSkill.name;
          subSkill.compendiumEntry = subSkill.journal || null;
          subSkill.untrained = subSkill.rt === true && !(subSkill.rank > 0);
          subSkill.custom = true; // All subskills are custom
        }
      }
    }

    // Update traits
    this._prepareTraits(data.system.traits);
    data.labels.senses = this._prepareSenseLabels();
    data.dr = this.document.parseResistances("dr");
    data.eres = this.document.parseResistances("eres");

    // Prepare owned items
    this._prepareItems(data);

    // Compute encumbrance
    data.encumbrance = this._computeEncumbrance(data.system);

    // Prepare skillsets
    this._prepareSkillsets(data);

    this._prepareSkills(data, rollData);

    // Feat count
    {
      // Feat count
      const feats = this.actor.getFeatCount();
      // Additional values
      feats.bonus = feats.formula + feats.changes;
      feats.issues = 0;
      if (feats.missing > 0 || feats.excess) feats.issues += 1;
      if (feats.disabled > 0) feats.issues += 1;
      data.featCount = feats;
    }

    // Fetch the game settings relevant to sheet rendering.
    {
      const actorType = { character: "pc", npc: "npc" }[this.document.type];
      data.healthConfig = game.settings.get("pf1", "healthConfig");
      data.useWoundsAndVigor = data.healthConfig.variants[actorType].useWoundsAndVigor;
    }

    // Determine hidden elements
    this._prepareHiddenElements();
    data.hiddenElems = this._hiddenElems;

    data.magicItems = {
      identified: [],
      unidentified: [],
    };

    // Create a table of magic items
    this.document.items
      .filter((o) => {
        if (!o.isPhysical) return false;
        if (o.showUnidentifiedData) return false;
        if (!o.system.carried) return false;
        if (o.system.quantity === 0) return false;

        const school = o.system.aura?.school;
        const cl = o.system.cl;
        return school?.length > 0 && cl > 0;
      })
      .forEach((item) => {
        const itemData = {};

        itemData.name = item.name;
        itemData.img = item.img;
        itemData.id = item.id;
        itemData.cl = item.system.cl;
        itemData.school = item.system.aura?.school;
        if (CONFIG.PF1.spellSchools[itemData.school] != null) {
          itemData.school = CONFIG.PF1.spellSchools[itemData.school];
        }
        itemData.aura = {
          strength: CONFIG.PF1.auraStrengths[item.auraStrength],
          school: itemData.school,
        };
        itemData.identifyDC = 15 + itemData.cl;
        itemData.quantity = item.system.quantity || 0;
        itemData.identified = item.system.identified === true;

        itemData.unidentifiedName = game.user.isGM ? item.system.unidentified?.name : null;

        if (itemData.identified) data.magicItems.identified.push(itemData);
        else data.magicItems.unidentified.push(itemData);
      });

    // Prepare (interactive) labels
    if (this.actor.itemTypes.class.length === 0) {
      data.labels.firstClass = game.i18n
        .format("PF1.Info_FirstClass", {
          html: `<a data-action="compendium" data-action-target="classes" data-tooltip="PF1.OpenCompendium">${game.i18n.localize(
            "PF1.Info_FirstClass_Compendium"
          )}</a>`,
        })
        .replace(/\n+/, "<br>");
    }

    // Conditions
    const conditions = this.actor.system.conditions;
    // Get conditions that are inherited from items
    const inheritedEffects = this.actor.appliedEffects.filter((ae) => ae.parent instanceof Item && ae.statuses.size);
    data.conditions = pf1.registry.conditions.map((cond) => ({
      id: cond.id,
      img: cond.texture,
      active: conditions[cond.id] ?? false,
      items: new Set(inheritedEffects.filter((ae) => ae.statuses.has(cond.id)).map((ae) => ae.parent)),
      get inherited() {
        return this.items.size > 0;
      },
      label: cond.name,
      compendium: cond.journal,
    }));

    // Return data to the sheet
    return data;
  }

  /**
   * Prepare item data for display.
   *
   * @protected
   * @param {ItemPF} item - Original document
   * @returns {object} - Data fed to the sheet
   */
  _prepareItem(item) {
    const result = foundry.utils.deepClone(item.system);
    result.document = item;
    result.type = item.type;
    result.id = item.id;
    result.img = item.img;
    result.isActive = item.isActive;
    result.isPhysical = item.isPhysical ?? false;
    result.isSingleUse = item.isSingleUse;
    result.isCharged = item.isCharged;
    result.hasResource = result.isCharged && !result.isSingleUse;
    result.hasUses = result.uses?.max > 0;

    const firstAction = item.firstAction;
    const firstActionRollData = firstAction?.getRollData();

    result.labels = item.getLabels({ actionId: firstAction?.id, rollData: firstActionRollData });
    result.hasAction = item.hasAction || item.getScriptCalls("use").length > 0;
    if (firstAction) {
      result.hasAttack = firstAction.hasAttack;
      result.hasMultiAttack = firstAction.hasMultiAttack;
      result.hasDamage = firstAction.hasDamage;
      result.hasRange = firstAction.hasRange;
      result.hasEffect = firstAction.hasEffect;
      if (this._canShowRange(item)) {
        result.range = foundry.utils.mergeObject(
          firstAction?.data?.range ?? {},
          {
            min: firstAction?.getRange({ type: "min", rollData: firstActionRollData }),
            max: firstAction?.getRange({ type: "max", rollData: firstActionRollData }),
          },
          { inplace: false }
        );
      }
      if (result.hasAttack) {
        const attacks = firstAction
          .getAttacks({ full: true, resolve: true, conditionals: true, bonuses: true, rollData: firstActionRollData })
          .map((atk) => atk.bonus);
        result.attackArray = attacks;
        const highest = Math.max(...attacks); // Highest bonus, with assumption the first might not be that.
        result.attackSummary = `${attacks.length} (${highest < 0 ? highest : `+${highest}`}${
          attacks.length > 1 ? "/…" : ""
        })`;
      }
    }

    result.sort = item.sort;
    result.showUnidentifiedData = item.showUnidentifiedData;
    result.name = item.name; // Copy name over from item to handle identified state correctly

    if (result.isPhysical) {
      result.quantity ||= 0;
      result.isStack = result.quantity > 1;
      result.destroyed = result.hp?.value <= 0;
    }

    const itemCharges = result.uses?.value != null ? result.uses.value : 1;
    result.empty = false;
    if (result.isPhysical && result.quantity <= 0) result.empty = true;
    else if (result.isCharged && !result.isSingleUse && itemCharges <= 0) result.empty = true;
    result.disabled = result.empty || result.destroyed || false;
    if (result.type === "feat" && !result.isActive) result.disabled = true;

    return result;
  }

  /**
   * Determine if the item can have its range shown on this sheet.
   *
   * @protected
   * @param {Item} item
   * @returns {boolean}
   */
  _canShowRange(item) {
    return item.type === "attack";
  }

  /* -------------------------------------------- */

  /**
   * Determine if this actor is in character generation state.
   *
   * @private
   * @returns {boolean} True if character generation guides are desirable.
   */
  get inCharacterGeneration() {
    return (
      this.actor.system.attributes.hd.total <= 1 ||
      Object.values(this.actor.system.abilities).every((abl) => abl.value === 10)
    );
  }

  _prepareHiddenElements() {
    // Hide spellbook info
    const spellbooks = this.document.system.attributes?.spells?.spellbooks ?? {};
    for (const k of Object.keys(spellbooks)) {
      const key = `spellbook-info_${k}`;
      if (this._hiddenElems[key] == null) this._hiddenElems[key] = true;
    }
  }

  _prepareTraits(traits) {
    const damageTypes = pf1.registry.damageTypes.getLabels();
    const map = {
      // "dr": PF1.damageTypes,
      di: damageTypes,
      dv: damageTypes,
      ci: pf1.config.conditionTypes,
      languages: pf1.config.languages,
      armorProf: pf1.config.armorProficiencies,
      weaponProf: pf1.config.weaponProficiencies,
    };
    for (const [t, choices] of Object.entries(map)) {
      const trait = traits[t];
      if (!trait) continue;
      let values = [];
      // Prefer total over value for dynamically collected proficiencies
      if (["armorProf", "weaponProf", "languages"].includes(t)) {
        values = trait.total ?? trait.value;
      } else if (trait.value) {
        values = trait.value instanceof Array ? trait.value : [trait.value];
      }
      trait.selected = values.reduce((obj, t) => {
        obj[t] = choices[t];
        return obj;
      }, {});

      const custom = new Set();
      // Prefer total over value for dynamically collected proficiencies
      const customSource = trait.customTotal ? trait.customTotal : trait.custom;
      if (customSource?.length) {
        customSource.forEach((c, i) => (trait.selected[`custom${i + 1}`] = c));
      }

      trait.cssClass = !foundry.utils.isEmpty(trait.selected) ? "" : "inactive";
    }
  }

  _prepareSenseLabels() {
    const result = {};

    const senses = this.actor.system.traits.senses ?? {};

    for (const [key, value] of Object.entries(senses)) {
      if (value === 0 || value === false) continue;
      else if (key === "ll" && senses[key].enabled) {
        result[key] = pf1.config.senses[key];
      } else if (key === "custom") {
        if (value.length) {
          value
            .split(pf1.config.re.traitSeparator)
            .map((c) => c.trim())
            .filter((c) => c)
            .forEach((svalue, idx) => (result[`custom${idx + 1}`] = svalue));
        }
      } else if (value === true) {
        result[key] = pf1.config.senses[key];
      } else if (value > 0) {
        const converted = pf1.utils.convertDistance(value);
        result[key] = `${pf1.config.senses[key]} ${converted[0]} ${converted[1]}`;
      }
    }

    return result;
  }

  /* -------------------------------------------- */

  /**
   * Insert a spell into the spellbook object when rendering the character sheet
   *
   * @param {object} data     The Actor data being prepared
   * @param {Array} spells    The spell data being prepared
   * @param {string} bookKey  The key of the spellbook being prepared
   * @private
   */
  _prepareSpellbook(data, spells, bookKey) {
    const editable = this.isEditable;
    const book = this.document.system.attributes.spells.spellbooks[bookKey];

    const min = book.hasCantrips ? 0 : 1;
    let max = 9;
    if (book.autoSpellLevelCalculation) {
      const cl = book.cl.autoSpellLevelTotal;

      const castsPerDay =
        pf1.config.casterProgression.castsPerDay[book.spellPreparationMode]?.[book.casterType]?.[cl - 1];
      // Check against undefined protects against bad CL modifications.
      max = castsPerDay !== undefined ? castsPerDay.length - 1 : 0;
    } else {
      if (book.casterType === "low") max = 4;
      else if (book.casterType === "med") max = 6;
    }

    // Reduce spells to the nested spellbook structure
    const spellbook = {};
    for (let level = 0; level < 10; level++) {
      const spellLevel = book.spells?.[`spell${level}`];
      if (!spellLevel) {
        console.error(`Bad data for spell level ${level} in spellbook "${bookKey}" for actor "${this.actor.name}"`);
        continue;
      }

      const valid = !isNaN(spellLevel.max);

      spellbook[level] = {
        level,
        valid,
        usesSlots: true,
        spontaneous: book.spontaneous,
        canCreate: editable,
        canPrepare: data.actor.type === "character",
        label: pf1.config.spellLevels[level],
        items: [],
        uses: spellLevel.value || 0,
        dataset: { type: "spell", level: level, spellbook: bookKey },
        hasIssues: spellLevel.hasIssues,
        lowAbilityScore: spellLevel.lowAbilityScore,
        lowLevel: spellLevel.lowLevel,
        known: spellLevel.known,
        preparation: spellLevel.preparation,
        slots: spellLevel.slots,
        invalidSlots: spellLevel.invalidSlots,
        mismatchSlots: spellLevel.mismatchSlots,
        invalidKnown: spellLevel.invalidKnown,
        mismatchKnown: spellLevel.mismatchKnown,
        domain: spellLevel.domain,
        data: spellLevel,
        isSchool: book.isSchool,
      };
    }

    spells.forEach((spell) => {
      const lvl = spell.level ?? min;
      spellbook[lvl]?.items.push(spell);
    });

    for (let a = 0; a < 10; a++) {
      if (spellbook[a]?.items.length === 0 && (a > max || a < min)) delete spellbook[a];
    }

    return spellbook;
  }

  /**
   * Prepare adventure/background skill distinction if needed.
   *
   * @internal
   * @param {object} context
   */
  _prepareSkillsets(context) {
    const skills = context.system.skills;

    const sets = {
      all: { skills: {} },
      adventure: { skills: {} },
      background: { skills: {} },
    };

    // sort skills by label
    const keys = Object.keys(skills).sort(function (a, b) {
      if (skills[a].custom && !skills[b].custom) return 1;
      if (!skills[a].custom && skills[b].custom) return -1;
      return ("" + skills[a].label).localeCompare(skills[b].label);
    });

    keys.forEach((a) => {
      const skl = skills[a];
      // Include all but Lore and Artistry in all
      if (!pf1.config.backgroundOnlySkills.includes(a)) sets.all.skills[a] = skl;
      if (skl.background) sets.background.skills[a] = skl;
      else sets.adventure.skills[a] = skl;
    });

    context.skillsets = sets;
  }

  /**
   * Calculate used and available skill ranks.
   *
   * @internal
   * @param {object} context
   * @param {object} rollData
   */
  _prepareSkills(context, rollData) {
    context.useBGSkills = game.settings.get("pf1", "allowBackgroundSkills");

    const isMindless = context.system.abilities?.int?.value === null;

    // Rank counting
    const skillRanks = { allowed: 0, used: 0, bgAllowed: 0, bgUsed: 0, sentToBG: 0 };

    // Count used skill ranks
    for (const skl of Object.values(context.rollData.skills)) {
      if (skl.subSkills != null) {
        for (const subSkl of Object.values(skl.subSkills)) {
          if (context.useBGSkills && skl.background) {
            skillRanks.bgUsed += subSkl.rank;
          } else {
            skillRanks.used += subSkl.rank;
          }
        }
      } else if (context.useBGSkills && skl.background) {
        skillRanks.bgUsed += skl.rank;
      } else {
        skillRanks.used += skl.rank;
      }
    }

    // Allowed skill ranks from HD, classes, intelligence, FCB, etc.
    this.document.itemTypes.class
      .filter((cls) => cls.system.subType !== "mythic")
      .forEach((cls) => {
        // Favoured Class Bonus
        // Apply FCB regardless if mindless if user applied such
        const fcSkills = cls.system.fc?.skill?.value ?? 0;
        if (fcSkills > 0) skillRanks.allowed += fcSkills;

        // Mindless get nothing else
        if (isMindless) return;

        const hd = cls.hitDice;
        if (hd === 0) return;

        const perLevel = cls.system.skillsPerLevel || 0;

        // Allow 0 skills per HD class configuration to function, ignoring minimum skills rule
        if (perLevel > 0) {
          skillRanks.allowed += Math.max(1, perLevel + this.document.system.abilities.int.mod) * hd;
        }

        // Background skills
        if (context.useBGSkills && pf1.config.backgroundSkillClasses.includes(cls.subType)) {
          const bgranks = hd * pf1.config.backgroundSkillsPerLevel;
          if (bgranks > 0) skillRanks.bgAllowed += bgranks;
        }
      });

    // Count from intelligence
    const intMod = context.system.abilities?.int?.mod;

    // Count from bonus skill rank formula
    if (context.system.details.bonusSkillRankFormula !== "") {
      const roll = RollPF.safeRoll(context.system.details.bonusSkillRankFormula, rollData);
      if (roll.err) console.error(`An error occurred in the Bonus Skill Rank formula of actor ${this.actor.name}.`);
      skillRanks.allowed += roll.total;
    }

    // Calculate from changes
    // TODO: Turn bonus skill ranks into actual change target
    this.actor.changes
      .filter((c) => c.subTarget === "bonusSkillRanks" && !!c.value)
      .forEach((c) => (skillRanks.allowed += c.value));

    // Adventure skills transferred to background skills
    if (context.useBGSkills && skillRanks.bgUsed > skillRanks.bgAllowed) {
      skillRanks.sentToBG = skillRanks.bgUsed - skillRanks.bgAllowed;
      skillRanks.allowed -= skillRanks.sentToBG;
      skillRanks.bgAllowed += skillRanks.sentToBG;
    }

    context.skillRanks = skillRanks;
  }

  /**
   * Returns the amount of type filters currently active.
   *
   * @param filters
   * @returns {number}
   * @private
   */
  _typeFilterCount(filters) {
    return Array.from(filters).filter((s) => s.startsWith("type-")).length;
  }

  /* -------------------------------------------- */

  /**
   * Determine whether an Item will be shown based on the current set of filters
   *
   * @param {object[]} items - Raw data objects of items
   * @param filters
   * @returns {boolean}
   * @private
   */
  _filterItems(items, filters) {
    const hasTypeFilter = this._typeFilterCount(filters) > 0;

    return items.filter((item) => {
      if (["feat", "buff", "attack"].includes(item.type)) {
        if (hasTypeFilter && !filters.has(`type-${item.subType}`)) return false;
      }

      if (item.isPhysical) {
        if (hasTypeFilter && item.type !== "loot" && !filters.has(`type-${item.type}`)) return false;
        else if (hasTypeFilter && item.type === "loot" && !filters.has(`type-${item.subType}`)) return false;
      }

      if (item.type === "spell") {
        if (hasTypeFilter && !filters.has(`type-${item.level}`)) return false;
      }

      return true;
    });
  }

  /* -------------------------------------------- */

  /**
   * Compute the level and percentage of encumbrance for an Actor.
   *
   * @param {object} actorData      The data object for the Actor being rendered
   * @returns {object}               An object describing the character's encumbrance level
   * @private
   */
  _computeEncumbrance(actorData) {
    const carriedWeight = actorData.attributes.encumbrance.carriedWeight;
    const load = {
      light: actorData.attributes.encumbrance.levels.light,
      medium: actorData.attributes.encumbrance.levels.medium,
      heavy: actorData.attributes.encumbrance.levels.heavy,
    };
    const usystem = pf1.utils.getWeightSystem();
    const carryLabel =
      usystem === "metric"
        ? game.i18n.format("PF1.CarryLabelKg", { kg: carriedWeight })
        : game.i18n.format("PF1.CarryLabel", { lbs: carriedWeight });

    const enc = {
      pct: {
        light: Math.clamped((carriedWeight * 100) / load.light, 0, 99.5),
        medium: Math.clamped(((carriedWeight - load.light) * 100) / (load.medium - load.light), 0, 99.5),
        heavy: Math.clamped(((carriedWeight - load.medium) * 100) / (load.heavy - load.medium), 0, 99.5),
      },
      encumbered: {
        light: actorData.attributes.encumbrance.level >= pf1.config.encumbranceLevels.medium,
        medium: actorData.attributes.encumbrance.level >= pf1.config.encumbranceLevels.heavy,
        heavy: actorData.attributes.encumbrance.carriedWeight >= actorData.attributes.encumbrance.levels.heavy,
      },
      light: actorData.attributes.encumbrance.levels.light,
      medium: actorData.attributes.encumbrance.levels.medium,
      heavy: actorData.attributes.encumbrance.levels.heavy,
      aboveHead: actorData.attributes.encumbrance.levels.heavy,
      offGround: actorData.attributes.encumbrance.levels.heavy * 2,
      dragPush: actorData.attributes.encumbrance.levels.heavy * 5,
      value: actorData.attributes.encumbrance.carriedWeight,
      carryLabel: carryLabel,
    };

    return enc;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers
  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   *
   * @param {JQuery} html The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Tooltips
    html[0].addEventListener("mousemove", (ev) => this._moveTooltips(ev), { passive: true });

    // Activate Item Filters
    const filterLists = html.find(".filter-list");
    filterLists.each(this._initializeFilterItemList.bind(this));
    filterLists.on("click", ".filter-item", this._onToggleFilter.bind(this));

    // Search boxes
    {
      const sb = html.find(".search-input");
      sb.on("keyup change", this._searchFilterChange.bind(this));
      sb.on("compositionstart compositionend", this._searchFilterCompositioning.bind(this)); // for IME
      this.searchRefresh = true;
      // Filter tabs on followup refreshes
      sb.each(function () {
        if (this.value.length > 0) $(this).change();
      });
      html.find(".clear-search").on("click", this._clearSearch.bind(this));
    }

    // Item summaries
    html.find(".item .item-name").click((event) => this._onItemSummary(event));

    // Allow opening items even if the sheet isn't editable.

    // General items
    html.find(".item-edit").on("click", this._onItemEdit.bind(this));
    // General items (right click)
    html.find(".item .item-name").contextmenu(this._onItemEdit.bind(this));
    // Quick items (right click)
    html.find(".quick-actions li").contextmenu(this._onItemEdit.bind(this));
    // Race item special right-click handler
    html.find(".race.item").contextmenu(this._onItemEdit.bind(this));

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) {
      html.find("span.text-box").addClass("readonly");
      return;
    }

    // Add general text box (span) handler
    html.find("span.text-box.direct").on("click", (event) => {
      this._onSpanTextInput(event, this._adjustActorPropertyBySpan.bind(this));
    });

    // Click to change text input
    html.find('*[data-action="input-text"]').click((event) => this._onInputText(event));
    html
      .find('*[data-action="input-text"].wheel-change')
      .on("wheel", (event) => this._onInputText(event.originalEvent));

    // Trigger form submission from textarea elements.
    html.find("textarea").change(this._onSubmit.bind(this));

    // Select the whole text on click
    html.find(".select-on-click").click(this._selectOnClick.bind(this));

    /* -------------------------------------------- */
    /*  Abilities, Skills, Defenses and Traits
    /* -------------------------------------------- */

    // Ability Checks
    html.find(".ability-name").click(this._onRollAbilityTest.bind(this));

    // BAB Check
    html.find(".attribute.bab .rollable").click(this._onRollBAB.bind(this));

    // Generic attack weapon and CMB checks
    html.find(".attribute.attack .rollable").click(this._onRollAttack.bind(this));

    // Initiative Check
    html.find(".attribute.initiative .rollable").click(this._onRollInitiative.bind(this));

    // Saving Throw
    html.find(".saving-throw .rollable").click(this._onRollSavingThrow.bind(this));

    // Adjust skill rank
    html.find("span.text-box.skill-rank").on("click", (event) => {
      this._onSpanTextInput(event, this._adjustActorPropertyBySpan.bind(this));
    });

    // Add arbitrary skill
    html.find(".skills .skill.arbitrary .skill-create").click((ev) => this._onArbitrarySkillCreate(ev));

    // Add custom skill
    html.find(".skills .controls > .skill-create").click((ev) => this._onSkillCreate(ev));

    // Edit skill
    html.find(".skills .skill > .controls > .skill-edit").on("click", (ev) => this._onSkillEdit(ev));
    // Delete custom skill
    html.find(".skills .skill > .controls > .skill-delete").click((ev) => this._onSkillDelete(ev));

    // Item Action control
    html.find(".item-actions a.item-action").click(this._itemActivationControl.bind(this));

    // Roll Skill Checks
    html.find(".tab.skills .skill > .action.roll").click(this._onRollSkillCheck.bind(this));

    // Open skill compendium entry
    html.find("a.compendium-entry").click(this._onOpenCompendiumEntry.bind(this));

    // Trait Selector
    html.find(".trait-selector").click(this._onTraitSelector.bind(this));

    // Resistance Selector
    html.find(".resistance-selector").click(this._onResistanceSelector.bind(this));

    // Display defenses
    html.find(".generic-defenses .rollable").click((ev) => {
      this.document.displayDefenseCard({ token: this.token });
    });

    // Rest
    html.find(".rest").click(this._onRest.bind(this));

    // Point Buy Calculator
    html.find("button.pointbuy-calculator").click(this._onPointBuyCalculator.bind(this));

    // Alignment
    html.find(".control.alignment").click(this._onControlAlignment.bind(this));

    // Edit senses
    html.find(".senses-selector").on("click", this._onSensesSelector.bind(this));

    /* -------------------------------------------- */
    /*  Inventory
    /* -------------------------------------------- */

    // Owned Item management
    html.find(".item-create").on("click", (ev) => this._onItemCreate(ev));
    html.find(".item-delete").on("click", this._onItemDelete.bind(this));
    html.find(".item-give").on("click", this._onItemGive.bind(this));
    html.find(".item-split:not(.disabled)").on("click", this._onItemSplit.bind(this));

    // Item Rolling
    html.find(".item .item-image").click((event) => this._onItemRoll(event));

    // Quick add item quantity
    html.find("a.item-control.item-quantity-add").click((ev) => {
      this._quickChangeItemQuantity(ev, 1);
    });
    // Quick subtract item quantity
    html.find("a.item-control.item-quantity-subtract").click((ev) => {
      this._quickChangeItemQuantity(ev, -1);
    });

    // Quick (un)equip item
    html.find("a.item-control.item-equip").click((ev) => {
      this._quickEquipItem(ev);
    });

    // Quick carry item
    html.find("a.item-control.item-carry").click((ev) => {
      this._quickCarryItem(ev);
    });

    // Quick (un)identify item
    html.find("a.item-control.item-identify").click((ev) => {
      this._quickIdentifyItem(ev);
    });

    // Quick toggle item property
    html.find("a.item-control.item-toggle-prepared").click(this._itemPreparedToggle.bind(this));

    // Duplicate item
    html.find("a.item-control.item-duplicate").click(this._duplicateItem.bind(this));

    // Quick Action
    html.find(".quick-actions li").click(this._quickAction.bind(this));

    // Convert currency
    html.find("a.convert-currency").click(this._convertCurrency.bind(this));

    // Set item charges
    html
      .find(".inventory-body .item-uses span.text-box.value")
      .on("wheel", this._setFeatUses.bind(this))
      .on("click", (event) => {
        this._onSpanTextInput(event, this._setFeatUses.bind(this));
      });

    // Set attack charges
    html
      .find(".attacks-body .item-uses span.text-box.value")
      .on("wheel", this._setFeatUses.bind(this))
      .on("click", (event) => {
        this._onSpanTextInput(event, this._setFeatUses.bind(this));
      });

    // Dynamic tooltips

    // Weight details tooltip
    html[0].querySelectorAll(".item-list .item[data-item-id] .item-detail.item-weight").forEach((el) => {
      el.addEventListener(
        "mouseenter",
        (ev) => {
          const el0 = ev.currentTarget;
          const item = this.actor.items.get(el0.closest("[data-item-id]").dataset.itemId);
          const weight = item?.system.weight?.converted;

          if (weight && weight.total > 0) {
            const contents = [];
            const quantity = item.system.quantity || 0;
            contents.push(game.i18n.format("PF1.StackDetails.Base", { value: weight.value }));
            if (quantity > 1)
              contents.push(
                game.i18n.format("PF1.StackDetails.Stack", { value: Math.floor(weight.value * 100 * quantity) / 100 })
              );
            if (weight.contents > 0) {
              contents.push(game.i18n.format("PF1.StackDetails.Contents", { value: weight.contents }));
              contents.push(game.i18n.format("PF1.StackDetails.Total", { value: weight.total }));
            }

            game.tooltip.activate(el0, {
              text: contents.join("<br>"),
              direction: TooltipManager.TOOLTIP_DIRECTIONS.LEFT,
              cssClass: "pf1",
            });
          }
        },
        { passive: true }
      );
      el.addEventListener("mouseleave", () => game.tooltip.deactivate(), { passive: true });
    });

    /* -------------------------------------------- */
    /*  Feats
    /* -------------------------------------------- */

    html
      .find(".feats-body .item-uses span.text-box.value")
      .on("wheel", this._setFeatUses.bind(this))
      .on("click", (event) => {
        this._onSpanTextInput(event, this._setFeatUses.bind(this));
      });

    /* -------------------------------------------- */
    /*  Classes
    /* -------------------------------------------- */

    // Level Up
    html.find(".level-up").click(this._onLevelUp.bind(this));

    /* -------------------------------------------- */
    /*  Spells
    /* -------------------------------------------- */

    // Set specific spell's (max) uses
    html
      .find(".item-list .spell-uses span.text-box[data-type='amount']")
      .on("wheel", this._setSpellUses.bind(this))
      .on("click", (event) => {
        this._onSpanTextInput(event, this._setSpellUses.bind(this));
      });
    html
      .find(".item-list .spell-uses span.text-box[data-type='max']")
      .on("wheel", this._setMaxSpellUses.bind(this))
      .on("click", (event) => {
        this._onSpanTextInput(event, this._setMaxSpellUses.bind(this));
      });

    // Set spell level uses for spontaneous spellbooks
    html
      .find(".spell-uses .spell-slots.spontaneous span.text-box")
      .on("wheel", this._adjustActorPropertyBySpan.bind(this))
      .on("click", (event) => {
        this._onSpanTextInput(event, this._adjustActorPropertyBySpan.bind(this));
      });
    // Set base amount of spell uses for a given spell level
    html.find(".spell-uses .spell-max span.text-box").on("click", (event) => {
      this._onSpanTextInput(event, this._adjustActorPropertyBySpan.bind(this));
    });

    // Set spell point amount
    html
      .find(".spell-points-current .value span.text-box")
      .on("wheel", this._adjustActorPropertyBySpan.bind(this))
      .on("click", (event) => {
        this._onSpanTextInput(event, this._adjustActorPropertyBySpan.bind(this));
      });

    html.find(".spellcasting-concentration.rollable").click(this._onRollConcentration.bind(this));

    html.find(".spellcasting-cl.rollable").click(this._onRollCL.bind(this));

    /* -------------------------------------------- */
    /*  Buffs
    /* -------------------------------------------- */

    html
      .find(".item-detail.item-active input[type='checkbox']")
      .off("change")
      .on("change", this._setItemActive.bind(this));

    html
      .find(".item-detail.item-level span.text-box")
      .on("wheel", this._setBuffLevel.bind(this))
      .on("click", (event) => {
        this._onSpanTextInput(event, this._setBuffLevel.bind(this));
      });

    html.find("a.hide-show").click(this._hideShowElement.bind(this));

    // Toggle condition
    html.find(".condition .checkbox").click(this._onToggleCondition.bind(this));

    /* -------------------------------------------- */
    /*  Skills
    /* -------------------------------------------- */

    html.find(".skill-lock-button").on("click", this._onToggleSkillLock.bind(this));

    /* -------------------------------------------- */
    /*  Links
    /* -------------------------------------------- */

    html.find('a[data-action="compendium"]').click(this._onOpenCompendium.bind(this));

    html
      // "mouseenter" would be better, but Foundry tooltip behaves unpredictably with it.
      .on("mouseover", "[data-tooltip-extended]", this._activateExtendedTooltip.bind(this))
      .on("mouseleave", "[data-tooltip-extended]", () => game.tooltip.deactivate());
  }

  /**
   * Handle extended tooltip on hover activation.
   *
   * Async to reduce UX impact.
   *
   * @private
   * @param {Event} event
   */
  async _activateExtendedTooltip(event) {
    const el = event.currentTarget;
    const id = el.dataset.tooltipExtended;
    if (!id) return;

    const context = { actor: this.actor, bonusTypes: pf1.config.bonusTypes, config: pf1.config };
    this._getTooltipContext(id, context);

    context.sources = context.sources?.filter((list) => list.sources?.length > 0);

    if (
      !(
        context.header ||
        context?.paths?.length > 0 ||
        context?.sources?.length > 0 ||
        context?.details?.length > 0 ||
        context?.notes?.length > 0
      )
    )
      return;

    for (const src of context.sources) {
      src.sources = src.sources.map((s) => ({
        ...s,
        type: s.type || pf1.config.bonusTypes[s.modifier || "untyped"] || s.modifier,
      }));
    }

    const text = renderCachedTemplate("systems/pf1/templates/extended-tooltip.hbs", context);

    game.tooltip.activate(el, {
      text,
      cssClass: "pf1 extended",
      direction: el.dataset.tooltipDirection || undefined,
    });
  }

  /**
   * @private
   * @param {string} fullId - Target ID
   * @param {object} context - Context object to store data into
   * @throws {Error} - If provided ID is invalid.
   */
  _getTooltipContext(fullId, context) {
    const actor = this.actor,
      system = actor.system;

    // Lazy roll data
    const lazy = {
      get rollData() {
        this._rollData ??= actor.getRollData();
        return this._rollData;
      },
    };

    const getSource = (path) => this.actor.sourceDetails[path];

    const getNotes = (context) => {
      const noteObjs = actor.getContextNotes(context);
      return actor.formatContextNotes(noteObjs, lazy.rollData, { roll: false });
    };

    const damageTypes = (d) =>
      [
        ...(d.values?.map((dv) => pf1.registry.damageTypes.get(dv)?.name || dv) ?? []),
        ...(d.custom
          ?.split(";")
          .map((dv) => dv?.trim())
          .filter((dv) => !!dv) ?? []),
      ].flat();

    const details = [];
    const paths = [];
    const sources = [];
    let notes;

    const re = /^(?<id>[\w-]+)(?:\.(?<detail>.*))?$/.exec(fullId);
    const { id, detail } = re?.groups ?? {};

    switch (id) {
      case "level":
        paths.push({ path: "@attributes.hd.total", value: system.attributes?.hd?.total });
        if (system.details?.mythicTier > 0) {
          paths.push({ path: "@details.mythicTier", value: system.details.mythicTier });
        }
        break;
      case "hit-points":
        paths.push(
          { path: "@attributes.hp.value", value: system.attributes.hp.value },
          { path: "@attributes.hp.max", value: system.attributes.hp.max },
          { path: "@attributes.hp.temp", value: system.attributes.hp.temp },
          { path: "@attributes.hp.nonlethal", value: system.attributes.hp.nonlethal }
        );
        sources.push({ sources: getSource("system.attributes.hp.max") });
        break;
      case "vigor": // Wounds & Vigor
        paths.push(
          { path: "@attributes.vigor.value", value: system.attributes.vigor.value },
          { path: "@attributes.vigor.temp", value: system.attributes.vigor.temp },
          { path: "@attributes.vigor.max", value: system.attributes.vigor.max }
        );

        sources.push({
          sources: getSource("system.attributes.vigor.max"),
        });
        break;
      case "wounds": // Wounds & Vigor
        paths.push(
          { path: "@attributes.wounds.value", value: system.attributes.wounds.value },
          { path: "@attributes.wounds.max", value: system.attributes.wounds.max }
        );

        sources.push({
          sources: getSource("system.attributes.wounds.max"),
        });
        break;
      case "speed": {
        sources.push(
          { sources: getSource("system.attributes.speed.land.base") },
          { sources: getSource("system.attributes.speed.land.total") }
        );

        const isMetricDist = pf1.utils.getDistanceSystem() === "metric";

        const mode = detail;

        // Add base speed
        const [tD] = pf1.utils.convertDistance(system.attributes.speed[mode].total);
        const tU = isMetricDist ? pf1.config.measureUnitsShort.m : pf1.config.measureUnitsShort.ft;
        paths.push({ path: `@attributes.speed.${mode}.total`, value: tD, unit: tU });
        // Add overland speed if we have actual speed
        if (tD > 0) {
          const [oD] = pf1.utils.convertDistance(system.attributes.speed[mode].overland);
          const oU = isMetricDist ? pf1.config.measureUnitsShort.km : pf1.config.measureUnitsShort.mi;
          paths.push({ path: `@attributes.speed.${mode}.overland`, value: oD, unit: oU });
        }
        break;
      }
      case "flyManeuverability":
        paths.push({
          path: "@attributes.speed.fly.maneuverability",
          value: system.attributes.speed.fly.maneuverability,
        });
        break;
      case "ac": {
        const ac = system.attributes.ac[detail];
        paths.push(
          { path: `@attributes.ac.${detail}.total`, value: ac?.total },
          { path: "@armor.type", value: lazy.rollData.armor?.type },
          { path: "@shield.type", value: lazy.rollData.shield?.type }
        );
        sources.push({
          sources: getSource(`system.attributes.ac.${detail}.total`),
        });
        break;
      }
      case "cmd":
        paths.push({
          path: `@attributes.cmd.${detail}`,
          value: system.attributes.cmd[detail],
        });

        sources.push({
          sources: getSource(`system.attributes.cmd.${detail}`),
        });

        notes = getNotes(`misc.cmd`);
        break;
      case "save":
        paths.push({
          path: `@attributes.savingThrows.${detail}.total`,
          value: system.attributes.savingThrows[detail]?.total,
        });

        sources.push({
          sources: getSource(`system.attributes.savingThrows.${detail}.total`),
        });

        notes = getNotes(`savingThrow.${detail}`);
        break;
      case "sr":
        paths.push({
          path: "@attributes.sr.total",
          value: system.attributes.sr.total,
        });

        sources.push({
          sources: getSource("system.attributes.sr.total"),
        });

        notes = getNotes("misc.sr");
        break;
      case "bab":
        paths.push({
          path: "@attributes.bab.total",
          value: system.attributes.bab.total,
        });

        sources.push({
          sources: getSource("system.attributes.bab.total"),
        });
        break;
      case "cmb":
        paths.push({
          path: "@attributes.cmb.total",
          value: system.attributes.cmb.total,
          // omit: + @attributes.attack.shared
          // omit: + @attributes.attack.general
        });

        if (system.traits.size !== "med") {
          sources.push({
            sources: [{ name: game.i18n.localize("PF1.Size"), value: pf1.config.sizeSpecialMods[system.traits.size] }],
          });
        }

        sources.push({
          sources: getSource("system.attributes.attack.shared"),
        });

        if (system.attributes.cmbAbility) {
          sources.push({
            sources: [
              {
                name: pf1.config.abilities[system.attributes.cmbAbility],
                value: system.abilities[system.attributes.cmbAbility]?.mod,
              },
            ],
          });
        }

        sources.push(
          { sources: getSource("system.attributes.attack.general") },
          { sources: getSource("system.attributes.cmb.bonus") }
        );

        notes = getNotes("misc.cmb");
        break;
      case "init":
        paths.push({
          path: "@attributes.init.total",
          value: system.attributes.init.total,
        });

        sources.push({
          sources: getSource("system.attributes.init.total"),
        });

        notes = getNotes("misc.init");
        break;
      case "abilityScore": {
        const abl = detail;
        const ability = system.abilities[detail] ?? {};
        paths.push(
          { path: `@abilities.${abl}.total`, value: ability.total, sign: false },
          { path: `@abilities.${abl}.value`, value: ability.value, sign: false },
          { path: `@abilities.${abl}.mod`, value: ability.mod },
          { path: `@abilities.${abl}.damage`, value: ability.damage, sign: false },
          { path: `@abilities.${abl}.drain`, value: ability.drain, sign: false },
          { path: `@abilities.${abl}.penalty`, value: ability.penalty, sign: false },
          { path: `@abilities.${abl}.base`, value: ability.base, sign: false },
          { path: `@abilities.${abl}.baseMod`, value: ability.baseMod }
        );

        sources.push(
          { sources: getSource(`system.abilities.${abl}.total`) },
          { sources: getSource(`system.abilities.${abl}.penalty`) },
          {
            label: game.i18n.localize("PF1.ModifierOnly"),
            sources: getSource(`system.abilities.${abl}.mod`),
          }
        );

        notes = getNotes(`abilityChecks.${abl}`);
        break;
      }
      case "acp":
        paths.push({
          path: "@attributes.acp.total",
          value: system.attributes.acp.total,
        });

        sources.push(
          {
            sources: getSource("system.attributes.acp.total"),
          },
          {
            label: game.i18n.localize("PF1.EquipSlots.armor"),
            sources: getSource("system.attributes.acp.armorBonus"),
          },
          {
            label: game.i18n.localize("PF1.EquipSlots.shield"),
            sources: getSource("system.attributes.acp.shieldBonus"),
          }
        );
        break;
      case "max-dex":
        paths.push({
          path: "@attributes.maxDexBonus",
          value: system.attributes.maxDexBonus,
        });

        sources.push(
          {
            sources: getSource("system.attributes.maxDexBonus"),
          },
          {
            label: game.i18n.localize("PF1.EquipSlots.armor"),
            sources: getSource("system.attributes.mDex.armorBonus"),
          },
          {
            label: game.i18n.localize("PF1.EquipSlots.shield"),
            sources: getSource("system.attributes.mDex.shieldBonus"),
          }
        );
        break;
      case "asf": {
        // TODO: Make ASF proper change target
        const asfSources = [];
        this.actor.itemTypes.equipment
          .filter((item) => item.isActive)
          .reduce((cur, item) => {
            const itemASF = item.system.spellFailure || 0;
            if (itemASF > 0) asfSources.push({ name: item.name, value: `${itemASF}%` });
            return cur + itemASF;
          }, 0);

        if (asfSources.length) {
          sources.push({ sources: asfSources });
        }
        break;
      }
      case "size":
        paths.push({ path: "@traits.size", value: system.traits.size }, { path: "@size", value: lazy.rollData.size });
        break;
      case "stature":
        paths.push({ path: "@traits.stature", value: system.traits.stature });
        break;
      case "aura":
        paths.push({ path: "@traits.aura.custom", empty: true });
        break;
      case "fastHeal":
        paths.push({ path: "@traits.fastHealing", empty: true });
        break;
      case "regen":
        paths.push({ path: "@traits.regen", empty: true });
        break;
      case "conditionResistance":
        paths.push({ path: "@traits.cres", empty: true });
        break;
      case "conditionImmunity":
        paths.push({ path: "@traits.ci.value", empty: true }, { path: "@traits.ci.custom", empty: true });
        break;
      case "energyResistance":
        paths.push({ path: "@traits.eres.total", empty: true });
        break;
      case "damageReduction":
        paths.push({ path: "@traits.dr.total", empty: true });
        break;
      case "damageImmunity":
        paths.push({ path: "@traits.di.value", empty: true }, { path: "@traits.di.custom", empty: true });
        break;
      case "damageVulnerability":
        paths.push({ path: "@traits.dv.value", empty: true }, { path: "@traits.dv.custom", empty: true });
        break;
      case "proficiency":
        switch (detail) {
          case "language":
            paths.push({ path: "@traits.languages.total", empty: true });
            sources.push({ sources: getSource("system.traits.languages"), left: true, untyped: true });
            break;
          case "weapon":
            paths.push({ path: "@traits.weaponProf.total", empty: true });
            sources.push({ sources: getSource("system.traits.weaponProf"), left: true, untyped: true });
            break;
          case "armor":
            paths.push({ path: "@traits.armorProf.total", empty: true });
            sources.push({ sources: getSource("system.traits.armorProf"), left: true, untyped: true });
            break;
        }
        break;
      case "quadruped":
        paths.push({ path: "@attributes.quadruped", value: String(system.attributes.quadruped) });
        break;
      case "negativeLevels":
        paths.push({ path: "@attributes.energyDrain", value: system.attributes.energyDrain, signed: false });
        break;
      case "item": {
        const [itemId, target] = detail.split(".");
        const item = this.actor.items.get(itemId);
        if (!item) return;
        switch (target) {
          case "level":
            paths.push({
              path: `@classes.${item.system.tag}.level`,
              value: item.system.level,
            });
            break;
          case "resources": {
            if (item.isCharged && item.system.uses?.max > 0) {
              paths.push(
                { path: `@resources.${item.system.tag}.value`, value: item.system.uses?.value },
                { path: `@resources.${item.system.tag}.max`, value: item.system.uses?.max }
              );
            }
            break;
          }
          case "attacks": {
            const action = item.firstAction;
            const attacks =
              action
                ?.getAttacks({ full: true, resolve: true, conditionals: true, bonuses: true })
                ?.map((atk) => atk.bonus) ?? [];

            if (attacks.length == 0) return;

            const formatter = new Intl.NumberFormat("nu", { signDisplay: "always" });
            context.header = attacks.map((n) => formatter.format(n)).join("/");

            sources.push({
              sources: item.attackSources,
            });
            break;
          }
          case "damage": {
            const action = item.firstAction;
            if (!action?.hasDamage) return;

            const actionData = action.data;
            const parts = [];
            const rollData = action.getRollData();

            const handleFormula = (formula, change) => {
              try {
                switch (typeof formula) {
                  case "string": {
                    // Ensure @item.level and similar gets parsed correctly
                    const rd = formula.indexOf("@") >= 0 ? change?.parent?.getRollData() ?? rollData : {};
                    if (formula != 0) {
                      const newformula = pf1.utils.formula.simplify(formula, rd);
                      if (newformula != 0) parts.push(newformula);
                    }
                    break;
                  }
                  case "number":
                    if (formula != 0) parts.push(`${formula}`);
                    break;
                }
              } catch (err) {
                console.error(`Formula parsing error with "${formula}"`, err);
                parts.push("NaN");
              }
            };

            const handleParts = (parts) => parts.forEach(({ formula }) => handleFormula(formula));

            // Normal damage parts
            handleParts(actionData.damage.parts);

            const isNatural = action.item.subType === "natural";

            // Include ability score only if the string isn't too long yet
            const dmgAbl = actionData.ability.damage;
            const dmgAblBaseMod = system.abilities[dmgAbl]?.mod ?? 0;
            let dmgMult = actionData.ability.damageMult || 1;
            if (isNatural && !(actionData.naturalAttack?.primaryAttack ?? true)) {
              dmgMult = actionData.naturalAttack?.secondary?.damageMult ?? 0.5;
            }
            const dmgAblMod = Math.floor(dmgAblBaseMod * dmgMult);
            if (dmgAblMod != 0) parts.push(dmgAblMod);

            // Include damage parts that don't happen on crits
            handleParts(actionData.damage.nonCritParts);

            // Include general sources. Item enhancement bonus is among these.
            action.allDamageSources.forEach((s) => handleFormula(s.formula, s));

            if (parts.length === 0) parts.push("NaN"); // Something probably went wrong

            const semiFinal = pf1.utils.formula.compress(parts.join("+"));

            context.header = semiFinal;

            const dmgSources = [];

            context.subHeader = game.i18n.localize("PF1.Details");

            const damage = action.data.damage;
            for (const { formula, type } of damage.parts ?? []) {
              dmgSources.push({
                name: formula,
                value: pf1.utils.formula.simplify(formula, rollData),
                type: damageTypes(type).join(", "),
                //unvalued: true,
              });
            }
            for (const { formula, type } of damage.nonCritParts ?? []) {
              dmgSources.push({
                name: formula,
                value: pf1.utils.formula.simplify(formula, rollData),
                type: damageTypes(type).join(", "),
                //unvalued: true,
              });
            }
            const abl = actionData.ability?.damage;
            if (abl) {
              const mult = actionData.ability?.damageMult ?? 1;
              dmgSources.push({
                value: Math.floor(rollData.abilities[abl]?.mod * mult),
                type: pf1.config.abilities[abl],
              });
            }

            sources.push({ sources: dmgSources });

            sources.push({
              sources: action.allDamageSources.map((s) => ({ name: s.flavor, ...s })),
            });

            const hasOptionalConditionals = action?.data.conditionals.find((c) => !c.default);
            if (hasOptionalConditionals) {
              // <span class="span3">+ {{localize "PF1.Conditionals"}}</span>
            }

            if (damage.critParts?.length) {
              // <span class="span3">+ {{localize "PF1.OnCritBonusFormula"}}</span>
            }
            break;
          }
          case "range": {
            const action = item.firstAction;
            if (!action?.hasRange) return;

            const maxIncr = action.data.range?.maxIncrements ?? 1;
            if (maxIncr <= 1) return;

            details.push({
              key: game.i18n.localize("PF1.MaximumRangeIncrements"),
              value: action.data.range.maxIncrements,
              left: true,
            });

            const rollData = action.getRollData();
            const range = {
              ...(action.data.range ?? {}),
              min: action.getRange({ type: "min", rollData }),
              max: action.getRange({ type: "max", rollData }),
            };

            const u = pf1.utils.convertDistance(0, "ft")[1];
            const mu = pf1.utils.convertDistance(0, range.units)[1];

            details.push({
              key: game.i18n.localize("PF1.Range"),
              value: `${range.min} ${u} – ${range.max} ${mu}`,
              left: true,
            });
            break;
          }
          default:
            throw new Error(`Invalid extended tooltip identifier "${fullId}"`);
        }
        break;
      }
      case "carryCapacity":
        paths.push(
          { path: "@attributes.encumbrance.level", value: system.attributes.encumbrance.level },
          { path: "@details.carryCapacity.bonus.total", value: system.details.carryCapacity.bonus.total },
          { path: "@details.carryCapacity.multiplier.total", value: system.details.carryCapacity.multiplier.total }
        );

        sources.push({
          label: game.i18n.localize("PF1.CarryStrength"),
          sources: getSource("system.details.carryCapacity.bonus.total"),
        });
        sources.push({
          label: game.i18n.localize("PF1.CarryMultiplier"),
          sources: getSource("system.details.carryCapacity.multiplier.total"),
        });
        break;
      case "feats": {
        const featSources = [];

        // Generate fake sources
        // TODO: Move this to the real source info generation
        this.actor.changes
          .filter((c) => c.subTarget === "bonusFeats")
          .forEach((c) => {
            if (c.parent || c.flavor) {
              featSources.push({
                name: c.parent?.name ?? c.flavor,
                value: c.value,
              });
            }
          });

        const feats = this.actor.getFeatCount();
        if (feats.formula !== 0) {
          featSources.push({
            name: game.i18n.localize("PF1.BonusFeatFormula"),
            value: feats.formula,
          });
        }
        sources.push({ sources: featSources });
        break;
      }
      case "skills": {
        const useBGSkills = game.settings.get("pf1", "allowBackgroundSkills");
        const isMindless = system.abilities?.int?.value === null;

        const skillSources = [];
        const isBG = detail === "background";

        let bgAllowed = 0;

        this.actor.itemTypes.class
          .filter((cls) => cls.system.subType !== "mythic")
          .forEach((cls) => {
            // Favoured Class Bonus
            // Apply FCB regardless if mindless if user applied such
            const fcSkills = cls.system.fc?.skill?.value ?? 0;
            if (fcSkills > 0 && !isBG) {
              skillSources.push({
                name: game.i18n.format("PF1.SourceInfoSkillRank_ClassFC", { className: cls.name }),
                value: fcSkills,
                untyped: true,
              });
            }

            // Mindless get nothing else
            if (isMindless) return;

            const hd = cls.hitDice;
            if (hd === 0) return;

            // Background skills
            if (useBGSkills && pf1.config.backgroundSkillClasses.includes(cls.subType)) {
              const bgranks = hd * pf1.config.backgroundSkillsPerLevel;
              if (bgranks > 0 && isBG) {
                bgAllowed += bgranks;
                skillSources.push({
                  name: game.i18n.format("PF1.SourceInfoSkillRank_ClassBase", { className: cls.name }),
                  value: bgranks,
                  untyped: true,
                });
              }
            }

            if (!isBG) {
              const perLevel = cls.system.skillsPerLevel || 0;
              skillSources.push({
                name: game.i18n.format("PF1.SourceInfoSkillRank_ClassBase", { className: cls.name }),
                value: perLevel * hd,
                untyped: true,
              });
            }
          });

        // Ability ability score
        if (!isBG && !isMindless) {
          const intMod = system.abilities?.int?.mod;
          if (intMod !== 0) {
            skillSources.push({
              name: game.i18n.localize("PF1.AbilityInt"),
              value: intMod * system.attributes?.hd?.total,
            });
          }
        }

        // Count from bonus skill rank formula
        if (system.details.bonusSkillRankFormula !== "") {
          const roll = RollPF.safeRoll(system.details.bonusSkillRankFormula, lazy.rollData);
          if (roll.err) console.error(`An error occurred in the Bonus Skill Rank formula of actor ${this.actor.name}.`);
          skillSources.push({
            name: game.i18n.localize("PF1.SkillBonusRankFormula"),
            value: roll.total,
          });
        }

        // Calculate from changes
        this.actor.changes
          .filter((o) => o.subTarget === "bonusSkillRanks")
          .forEach((o) => {
            if (!o.value) return;

            skillSources.push({
              name: o.parent?.name ?? game.i18n.localize("PF1.Change"),
              value: o.value,
            });
          });

        // Count transfers for background skills
        if (useBGSkills && isBG) {
          let bgUsed = 0;

          // Count used skill ranks
          for (const skl of Object.values(lazy.rollData.skills)) {
            if (skl.subSkills) {
              for (const subSkl of Object.values(skl.subSkills)) {
                if (skl.background) {
                  bgUsed += subSkl.rank;
                }
              }
            } else if (skl.background) {
              bgUsed += skl.rank;
            }
          }

          // Adventure skills transferred to background skills
          const sentToBG = bgUsed - bgAllowed;
          if (sentToBG > 0) {
            skillSources.push({
              name: game.i18n.localize("PF1.Transferred"),
              value: sentToBG,
            });
          }
        }

        sources.push({
          sources: skillSources,
        });
        break;
      }
      case "skill": {
        const fullSkillId = detail;
        const skillIdParts = fullSkillId.split(".");
        const mainId = skillIdParts[0];
        const subSkillId = skillIdParts.length > 1 ? skillIdParts.at(-1) : null;

        const skill = this.actor.getSkillInfo(fullSkillId, { rollData: lazy.rollData });

        paths.push(
          { path: `@skills.${fullSkillId}.mod`, value: skill.mod },
          { path: `@skills.${fullSkillId}.rank`, value: skill.rank }
        );

        const acp = system.attributes?.acp?.total || 0;

        const skillSources = [];
        // Add skill rank source
        if (skill.rank > 0) {
          skillSources.push({ name: game.i18n.localize("PF1.SkillRankPlural"), value: skill.rank });

          // Add class skill bonus source
          if (skill.cs) {
            skillSources.push({ name: game.i18n.localize("PF1.CSTooltip"), value: pf1.config.classSkillBonus });
          }
        }

        // Add ACP source
        if (skill.acp && acp > 0) {
          skillSources.push({ name: game.i18n.localize("PF1.ACPLong"), value: -acp });
        }

        // Add ability modifier source
        if (skill.ability) {
          skillSources.push({
            name: pf1.config.abilities[skill.ability],
            value: lazy.rollData.abilities[skill.ability]?.mod ?? 0,
          });
        }

        sources.push({ sources: skillSources }, { sources: getSource(`system.skills.${fullSkillId}.mod`) });

        notes = getNotes(`skill.${fullSkillId}`);
        break;
      }
      case "spellbook": {
        const [bookId, target, subTarget] = detail.split(".");
        const spellbook = system.attributes?.spells?.spellbooks?.[bookId];
        switch (target) {
          case "class": {
            paths.push(
              { path: "@cl", value: spellbook.cl.total },
              { path: `@spells.${bookId}.cl.total`, value: spellbook.cl.total }
            );

            const cls = lazy.rollData.classes?.[spellbook.class];
            if (cls) paths.push({ path: "@classLevel", value: cls.level });

            sources.push({
              sources: getSource(`system.attributes.spells.spellbooks.${bookId}.cl.total`),
            });
            break;
          }
          case "level":
            paths.push({
              path: `@spells.${bookId}.cl.total`,
              value: spellbook.cl?.total,
            });
            sources.push({
              sources: getSource(`system.attributes.spells.spellbooks.${bookId}.cl.total`),
            });
            break;
          case "concentration": {
            paths.push({
              path: `@spells.${bookId}.concentration.total`,
              value: spellbook.concentration?.total,
            });
            sources.push({
              sources: getSource(`system.attributes.spells.spellbooks.${bookId}.concentration.total`),
            });
            break;
          }
          case "range": {
            const unit = subTarget;
            paths.push({
              path: `@spells.${bookId}.range.${unit}`,
              value: spellbook.range?.[unit],
              unit:
                pf1.utils.getDistanceSystem() === "metric"
                  ? pf1.config.measureUnitsShort.m
                  : pf1.config.measureUnitsShort.ft,
            });
            break;
          }
          case "spellPoints":
            paths.push(
              { path: `@spells.${bookId}.spellPoints.value`, value: spellbook.spellPoints.value },
              { path: `@spells.${bookId}.spellPoints.max`, value: spellbook.spellPoints.max }
            );

            break;
        }
        break;
      }
      case "spell": {
        const [itemId, target] = detail.split(".");
        const item = this.actor.items.get(itemId);
        switch (target) {
          case "material": {
            const materials = item.system.materials ?? {};
            if (materials.focus) {
              details.push({
                key: game.i18n.localize("PF1.SpellComponents.Type.focus.Label"),
                value: materials.focus,
              });
            }
            if (materials.value) {
              details.push({
                key: game.i18n.localize("PF1.SpellComponents.Type.material.Label"),
                value: materials.value,
              });
            }
            break;
          }
          case "school": {
            if (item.system.subschool) {
              details.push({
                key: game.i18n.localize("PF1.SubSchool"),
                value: item.system.subschool,
              });
            }

            if (item.system.descriptors?.total?.size) {
              details.push({
                key: game.i18n.localize("PF1.DescriptorPlural"),
                value: Array.from(item.system.descriptors?.total).join(", "),
              });
            }

            const action = item.firstAction;

            if (action?.hasDamage) {
              const types = action.data.damage?.parts?.map((d) => d.type).map(damageTypes) ?? [];

              if (types.length) {
                details.push({
                  key: game.i18n.localize("PF1.Damage"),
                  value: types.join(", "),
                });
              }
            }
            break;
          }
        }
        break;
      }
      // Generics
      case "generic": {
        const [target, subTarget] = detail.split(".");
        switch (target) {
          case "attack": {
            paths.push(
              { path: "@attributes.attack.shared", value: system.attributes.attack.shared },
              { path: "@attributes.attack.general", value: system.attributes.attack.general },
              { path: `@attributes.attack.${subTarget}`, value: system.attributes.attack[subTarget] }
            );

            const abl = system.attributes.attack[`${subTarget}Ability`];

            sources.push(
              { sources: getSource("system.attributes.attack.shared") },
              {
                sources: [
                  {
                    name: pf1.config.abilities[abl] || abl,
                    value: lazy.rollData.abilities[abl]?.mod,
                  },
                ],
              }
            );

            if (system.traits.size !== "med") {
              sources.push({
                sources: [
                  {
                    name: game.i18n.localize("PF1.Size"),
                    value: pf1.config.sizeMods[system.traits.size],
                  },
                ],
              });
            }

            sources.push({ sources: getSource("system.attributes.attack.general") });
            sources.push({ sources: getSource(`system.attributes.attack.${subTarget}`) });
            break;
          }
        }
        break;
      }
      default:
        throw new Error(`Invalid extended tooltip identifier "${fullId}"`);
    }

    context.details = details;
    context.paths = paths;
    context.sources = sources;
    context.notes = notes ?? [];
  }

  /* -------------------------------------------- */

  /**
   * @protected
   * @param {Event} event - Triggering event
   * @param {Function} callback - Submission handler
   */
  _onSpanTextInput(event, callback) {
    const el = event.target;
    const parent = el.parentElement;

    const isNumber = el.dataset.dtype === "Number" || el.type === "number";

    // Replace span element with an input (text) element
    const newEl = document.createElement("INPUT");
    newEl.type = "text";
    if (el.dataset?.dtype) {
      newEl.dataset.dtype = el.dataset.dtype;
      if (isNumber) newEl.size = 12; // HTML defaults to 20
    }

    const noCap = el.classList.contains("no-value-cap");
    const name = el.getAttribute("name"); // span has no .name attribute even if name="" is used

    let prevValue = 0,
      maxValue;

    if (name) {
      newEl.setAttribute("name", name);
      prevValue = foundry.utils.getProperty(this.document, name) || 0;
      if (name.endsWith(".value") && !noCap && isNumber) {
        const maxName = name.replace(/\.value$/, ".max");
        maxValue = foundry.utils.getProperty(this.document, maxName);
      }
    } else {
      if (!el.classList.contains("placeholder")) {
        prevValue = isNumber ? parseFloat(el.innerText || "0") : el.innerText || "";
      }
    }

    // Set value of new input element
    newEl.value = `${prevValue || 0}`;

    // Toggle classes
    const forbiddenClasses = ["placeholder", "direct", "allow-relative"];
    for (const cls of el.classList) {
      if (!forbiddenClasses.includes(cls)) newEl.classList.add(cls);
    }

    const allowRelative = el.classList.contains("allow-relative"),
      clearValue = isNumber ? parseFloat(el.dataset.clearValue || "0") : "";

    // Replace span with input element
    parent.replaceChild(newEl, el);

    let changed;
    newEl.addEventListener(
      "change",
      (event) => {
        event.preventDefault();
        event.stopPropagation(); // Prevent Foundry acting on this
        changed = true;

        let newValue;
        if (allowRelative) {
          newValue = adjustNumberByStringCommand(prevValue, newEl.value, maxValue, clearValue);
          newEl.value = newValue;
        } else {
          newValue = parseFloat(newEl.value || "0");
        }

        // Reset if nothing changed (probably never triggers, since it's not a change)
        if (newValue === prevValue) {
          parent.replaceChild(el, newEl);
        }
        // Pass it to callback
        else {
          newEl.readOnly = true;
          callback.call(this, event);
        }
      },
      { once: true }
    );

    newEl.addEventListener(
      "focusout",
      (event) => {
        if (changed) return;

        const newValue = parseFloat(newEl.value || "0");
        if (newValue === prevValue) {
          parent.replaceChild(el, newEl);
        }
      },
      { passive: true, once: true }
    );

    // Select text inside new element
    newEl.focus();
    newEl.select();
  }

  /**
   * @protected
   * @param {Event} event
   */
  _moveTooltips(event) {
    let elem = event.target;
    if (!elem.matches(".tooltip")) elem = elem.closest(".tooltip");
    if (elem) {
      const tip = elem.querySelector(".tooltipcontent");
      if (tip) {
        const x = event.clientX;
        const y = event.clientY + 24;
        tip.style.cssText += `left:${x}px;top:${y}px;`;
      }
    }
  }

  _onDragSkillStart(event) {
    const elem = event.currentTarget;
    const skillElem = elem.closest(".skill");
    const mainSkill = skillElem.dataset.skill;
    const subSkill = skillElem.dataset.subSkill;

    const result = {
      type: "skill",
      uuid: this.document.uuid,
      skill: subSkill ? `${mainSkill}.subSkills.${subSkill}` : mainSkill,
    };

    event.dataTransfer.setData("text/plain", JSON.stringify(result));
  }

  /**
   * @param {DragEvent} event
   * @param {"bab"|"cmb"|"defenses"|"concentration"|"cl"|"initiative"|"abilityScore"|"attack"} type
   * @param {string} [subType] Type specific subtype
   */
  _onDragMiscStart(event, type, subType) {
    const result = {
      type: type,
      uuid: this.document.uuid,
    };

    switch (type) {
      case "bab":
      case "cmb":
      case "initiative":
      case "defenses":
        // No special handling
        break;
      case "concentration":
      case "cl": {
        const elem = event.currentTarget.closest(".tab.spellbook-group");
        result.bookId = elem.dataset.tab;
        break;
      }
      case "abilityScore":
        result.ability = subType;
        break;
      case "attack":
        result.attack = subType;
        break;
      default:
        throw new Error(`Unrecognized drag source: ${type}`);
    }

    event.dataTransfer.setData("text/plain", JSON.stringify(result));
  }

  _onDragSaveStart(event, type) {
    const result = {
      type: "save",
      save: type,
      uuid: this.document.uuid,
    };

    event.dataTransfer.setData("text/plain", JSON.stringify(result));
  }

  /**
   * Initialize Item list filters by activating the set of filters which are currently applied
   *
   * @param i
   * @param ul
   * @private
   */
  _initializeFilterItemList(i, ul) {
    const set = this._filters[ul.dataset.filter];
    const filters = ul.querySelectorAll(".filter-item");
    for (const li of filters) {
      if (set.has(li.dataset.filter)) li.classList.add("active");
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  async _onRest(event) {
    event.preventDefault();

    const skipDialog = pf1.documents.settings.getSkipActionPrompt();
    if (skipDialog) {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await this.actor.performRest({ verbose: true });
      } finally {
        button.disabled = false;
      }
    } else {
      const app = Object.values(this.document.apps).find((o) => {
        return o instanceof ActorRestDialog && o._element;
      });
      if (app) app.render(true, { focus: true });
      else new ActorRestDialog(this.document).render(true);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
   *
   * @param event
   * @private
   */
  _onItemRoll(event) {
    event.preventDefault();
    event.stopPropagation();

    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    if (item == null) return;
    return item.displayCard(undefined, { token: this.token });
  }

  _mouseWheelAdd(event, el) {
    const isInput = el.tagName === "INPUT";
    const { originalEvent } = event;

    if (originalEvent && originalEvent instanceof WheelEvent && originalEvent.ctrlKey) {
      event.preventDefault();
      const value = (isInput ? parseFloat(el.value) : parseFloat(el.innerText)) || 0;
      if (Number.isNaN(value)) return;

      const increase = -Math.sign(originalEvent.deltaY);
      const amount = parseFloat(el.dataset.wheelStep) || 1;

      if (isInput) {
        el.value = value + amount * increase;
      } else {
        el.innerText = (value + amount * increase).toString();
      }
    }
  }

  _setFeatUses(event) {
    if (!(event.originalEvent instanceof MouseEvent)) event.preventDefault();
    const el = event.currentTarget;
    const itemId = el.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event, el);

    const value = el.tagName === "INPUT" ? Number(el.value) : Number(el.innerText);
    this.setItemUpdate(item.id, "system.uses.value", value);

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      el.addEventListener("mouseleave", () => this._updateItems(), { passive: true, once: true });
    } else this._updateItems();
  }

  _setSpellUses(event) {
    if (!(event.originalEvent instanceof MouseEvent)) event.preventDefault();
    const el = event.currentTarget;
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event, el);

    const prevValue = item.system.preparation?.value ?? 0;
    const value = el.tagName === "INPUT" ? Number(el.value) : Number(el.innerText);
    this.setItemUpdate(item.id, "system.preparation.value", value);
    if (prevValue < value) {
      const maxValue = item.system.preparation.max ?? 0;
      this.setItemUpdate(item.id, "system.preparation.max", Math.max(maxValue, value));
    }

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      el.addEventListener("mouseleave", () => this._updateItems(), { passive: true, once: true });
    } else this._updateItems();
  }
  _setMaxSpellUses(event) {
    if (!(event.originalEvent instanceof MouseEvent)) event.preventDefault();
    const el = event.currentTarget;
    const itemId = el.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event, el);

    const prevValue = item.system.preparation?.max ?? 0;
    const value = el.tagName === "INPUT" ? Number(el.value) : Number(el.innerText);
    this.setItemUpdate(item.id, "system.preparation.max", Math.max(0, value));
    if (prevValue > value) {
      const curValue = item.system.preparation.value ?? 0;
      this.setItemUpdate(item.id, "system.preparation.value", Math.min(curValue, value));
    }
    if (value < 0) {
      el.tagName === "INPUT" ? (el.value = 0) : (el.innerText = 0);
    }

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      el.addEventListener("mouseleave", () => this._updateItems(), { passive: true, once: true });
    } else this._updateItems();
  }

  async _adjustActorPropertyBySpan(event) {
    if (!(event.originalEvent instanceof MouseEvent)) event.preventDefault();
    const el = event.currentTarget;
    this._mouseWheelAdd(event, el);

    // Get base value
    const rawValue = el.tagName === "INPUT" ? el.value : el.innerText;
    let value = el.dataset.dtype === "String" ? rawValue : Number(rawValue);

    // Adjust value if needed
    const name = el.getAttribute("name"); // .name is not available on non-inputs
    if (name.match(/^system\.abilities\.([a-zA-Z0-9]+)\.value$/)) {
      if (Number.isNaN(parseInt(value))) value = null;
      else value = parseInt(value);
    }

    let updateData;
    if (name) {
      if (value === getProperty(this.actor, name)) return;
      updateData = { [name]: value };
    }

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      el.addEventListener("mouseleave", async (event) => this._updateObject(event, this._getSubmitData(updateData)), {
        once: true,
      });
    } else {
      this._updateObject(event, this._getSubmitData(updateData));
    }
  }

  _setBuffLevel(event) {
    if (!(event.originalEvent instanceof MouseEvent)) event.preventDefault();
    const el = event.currentTarget;
    const itemId = el.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event, el);
    const value = el.tagName === "INPUT" ? Number(el.value) : Number(el.innerText);

    this.setItemUpdate(item.id, "system.level", value);

    if (event.originalEvent instanceof MouseEvent) {
      el.addEventListener("mouseleave", () => this._updateItems(), { passive: true, once: true });
    } else this._updateItems();
  }

  _hideShowElement(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const target = this.element.find(`.${a.dataset.for}`);

    if (target.hasClass("hidden")) {
      $(a).find("i").removeClass("fa-arrow-circle-down").addClass("fa-arrow-circle-up");
      target.removeClass("hidden");
      target.hide();
      target.slideDown(200);

      this._hiddenElems[a.dataset.for] = false;
    } else {
      $(a).find("i").removeClass("fa-arrow-circle-up").addClass("fa-arrow-circle-down");
      target.slideUp(200, () => target.addClass("hidden"));

      this._hiddenElems[a.dataset.for] = true;
    }
  }

  _onToggleCondition(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const conditionId = a.dataset.conditionId;

    this.actor.toggleCondition(conditionId);
  }

  /**
   * Toggle skill lock.
   *
   * @param {MouseEvent} event
   */
  _onToggleSkillLock(event) {
    event.preventDefault();
    this._skillsLocked = !this._skillsLocked;

    const target = event.currentTarget;
    target.classList.toggle("unlocked", !this._skillsLocked);

    const tab = target.closest(".tab");
    tab.classList.toggle("locked", this._skillsLocked);

    tab.querySelectorAll(".lockable").forEach((el) => {
      if (["INPUT", "SELECT"].includes(el.tagName)) {
        el.disabled = this._skillsLocked;
      } else {
        el.classList.toggle("hide-contents", this._skillsLocked);
      }
    });
  }

  _onOpenCompendium(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const target = a.dataset.actionTarget;

    pf1.applications.compendiums[target].render(true, { focus: true });
  }

  _onRollConcentration(event) {
    event.preventDefault();

    const spellbookKey = $(event.currentTarget).closest(".spellbook-group").data("tab");
    this.document.rollConcentration(spellbookKey, { token: this.token });
  }

  _onRollCL(event) {
    event.preventDefault();

    const spellbookKey = $(event.currentTarget).closest(".spellbook-group").data("tab");
    this.document.rollCL(spellbookKey, { token: this.token });
  }

  _setItemActive(event) {
    event.preventDefault();
    const el = event.currentTarget;
    const state = el.checked;
    const itemId = el.closest(".item").dataset.itemId;

    this.actor.items.get(itemId).setActive(state);
  }

  _onLevelUp(event) {
    event.preventDefault;
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    return LevelUpForm.increaseLevel(this.actor, item, { token: this.token });
  }

  /* -------------------------------------------- */

  /**
   * @param {JQuery.ClickEvent<HTMLElement>} event - The click event on the item
   * @private
   */
  _onItemSummary(event) {
    event.preventDefault();
    const li = event.target.closest(".item[data-item-id]");
    this.openItemSummary(li);
  }

  /**
   * Toggle inline display of an item's summary/description by expanding or hiding info div
   *
   * @param {JQuery<HTMLElement>} elem - The element to open. Likely will have the `item` class in CSS.
   * @param {boolean} [instant=false] - Whether to instantly show the expansion (true), or animate it (false)
   */
  async openItemSummary(elem, { instant = false, rollData } = {}) {
    // Check whether pseudo-item belongs to another collection
    const itemId = elem.dataset.itemId;
    const item = this.actor.items.get(itemId);

    rollData ??= item.firstAction?.getRollData() ?? item.getRollData();

    const { description, properties } = await item.getChatData({ chatcard: false, rollData });

    // Toggle summary
    this._expandedItems = this._expandedItems.filter((o) => o !== itemId);
    if (elem.classList.contains("expanded")) {
      const summary = elem.querySelector(".item-summary");
      if (instant) summary.remove();
      else $(summary).slideUp(200, () => summary.remove());
    } else {
      const templateData = {
        description: description || game.i18n.localize("PF1.NoDescription"),
        properties,
      };
      let content = await renderTemplate("systems/pf1/templates/actors/parts/actor-item-summary.hbs", templateData);
      content = await TextEditor.enrichHTML(content, { rollData, async: true, secrets: this.actor.isOwner });

      const div = $(content);

      if (instant) elem.append(...div);
      else {
        div.hide();
        elem.append(...div);
        div.slideDown(200);
      }
      this._expandedItems.push(itemId);
    }
    elem.classList.toggle("expanded");
  }

  /**
   * Makes a readonly text input editable, and focus it.
   *
   * @private
   * @param {Event} event
   */
  _onInputText(event) {
    event.preventDefault();
    const elem = event.target;

    if (!elem || elem?.disabled) return;

    elem.readOnly = false;
    const value = foundry.utils.getProperty(this.document, elem.name);

    const origValue = elem.value;
    elem.value = value;

    const wheelEvent = event instanceof WheelEvent;
    if (wheelEvent) {
      this._mouseWheelAdd(event, elem);
    } else {
      elem.select();
    }

    const handler = (event) => {
      // Clear selection if any
      const s = document.getSelection();
      if (s.anchorNode === elem || s.anchorNode === elem.parentElement) s.removeAllRanges();

      if (wheelEvent) elem.removeEventListener("mouseout", handler);
      else {
        elem.removeEventListener("focusout", handler);
        elem.removeEventListener("keydown", keyHandler);
      }
      elem.removeEventListener("click", handler);

      if (`${value}` !== elem.value) changed = true;

      if (changed) {
        this._onSubmit(event);
      } else {
        elem.readOnly = true;
        elem.value = origValue;
      }
    };
    const keyHandler = (event) => {
      if (event.key === "Enter") {
        changed = true;
        handler.call(this, event);
      }
    };

    let changed = false;
    if (wheelEvent) {
      elem.addEventListener("mouseout", handler, { passive: true });
      changed = true;
    } else {
      elem.addEventListener("focusout", handler, { passive: true });
      elem.addEventListener("keydown", keyHandler, { passive: true });
    }
    elem.addEventListener("click", handler, { passive: true });
  }

  /* -------------------------------------------- */

  async _onArbitrarySkillCreate(event) {
    event.preventDefault();
    const skillId = $(event.currentTarget).parents(".skill").attr("data-skill");
    const mainSkillData = this.document.system.skills[skillId];
    const skillData = {
      name: game.i18n.format("DOCUMENT.New", { type: game.i18n.localize("PF1.Skill") }),
      ability: mainSkillData.ability,
      rank: 0,
      rt: mainSkillData.rt,
      cs: mainSkillData.cs,
      acp: mainSkillData.acp,
    };

    // Get tag
    let count = 1;
    let tag = `${skillId}${count}`;
    while (mainSkillData.subSkills[tag] != null) {
      count++;
      tag = `${skillId}${count}`;
    }

    const updateData = {};
    updateData[`system.skills.${skillId}.subSkills.${tag}`] = skillData;
    if (this.document.testUserPermission(game.user, "OWNER")) await this.document.update(updateData);

    return this._editSkill(skillId, tag);
  }

  async _onSkillCreate(event) {
    event.preventDefault();
    const isBackground = $(event.currentTarget).parents(".skills-list").attr("data-background") === "true";
    const skillData = {
      name: game.i18n.format("DOCUMENT.New", { type: game.i18n.localize("PF1.Skill") }),
      ability: "int",
      rank: 0,
      mod: 0,
      rt: false,
      cs: false,
      acp: false,
      background: isBackground,
      custom: true,
    };

    const baseName = skillData.name || "skill";
    const baseTag = pf1.utils.createTag(baseName);
    let tag = baseTag;
    let count = 1;
    while (this.document.system.skills[tag] != null) {
      count++;
      tag = baseTag + count.toString();
    }

    const updateData = {};
    updateData[`system.skills.${tag}`] = skillData;
    await this.document.update(updateData);

    return this._editSkill(tag);
  }

  /**
   * Opens a dialog to edit a skill.
   *
   * @param {string} skillId - The id of the skill in question.
   * @param {string} [subSkillId] - The id of the subskill, if appropriate.
   * @returns {Promise.<void>}
   */
  _editSkill(skillId, subSkillId) {
    return new Promise((resolve) => {
      const app = new pf1.applications.SkillEditor(this.document, skillId, subSkillId);
      app.addCallback(resolve);
      app.render(true);
    });
  }

  _onSkillEdit(event) {
    event.preventDefault();
    const el = event.target.closest(".skill");
    const mainSkillId = el.dataset.skill;
    const subSkillId = el.dataset.subSkill;

    return this._editSkill(mainSkillId, subSkillId);
  }

  _onSkillDelete(event) {
    event.preventDefault();
    if (!this.document.testUserPermission(game.user, "OWNER")) return;

    const el = event.target.closest(".skill");
    const mainSkillId = el.dataset.skill;
    const subSkillId = el.dataset.subSkill;
    const skillId = subSkillId ? `${mainSkillId}.subSkills.${subSkillId}` : mainSkillId;

    const info = this.actor.getSkillInfo(skillId);

    const deleteSkill = () => {
      const updateData = {};
      // Delete subskill
      if (subSkillId) updateData[`system.skills.${mainSkillId}.subSkills.-=${subSkillId}`] = null;
      // Delete main skill
      else updateData[`system.skills.-=${mainSkillId}`] = null;
      this.document.update(updateData);
    };

    if (getSkipActionPrompt()) {
      deleteSkill();
    } else {
      Dialog.confirm({
        title: game.i18n.format("PF1.DeleteSkillTitle", { name: info.name }),
        content: `<p>${game.i18n.localize("PF1.DeleteSkillConfirmation")}</p>`,
        yes: () => deleteSkill(),
        rejectClose: true,
      });
    }
  }

  async _onPointBuyCalculator(event) {
    event.preventDefault();

    const app = Object.values(this.document.apps).find((o) => {
      return o instanceof PointBuyCalculator && o._element;
    });
    if (app) app.render(true, { focus: true });
    else new PointBuyCalculator(this.document).render(true);
  }

  async _onSensesSelector(event) {
    event.preventDefault();

    const app = Object.values(this.document.apps).find((o) => {
      return o instanceof pf1.applications.SensesSelector && o._element;
    });
    if (app) app.render(true, { focus: true });
    else new pf1.applications.SensesSelector(this.document).render(true);
  }

  async _onControlAlignment(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const items = Object.entries(pf1.config.alignmentsShort).map(([value, label]) => ({ value, label }));
    const w = new Widget_ItemPicker(
      (alignment) => {
        this.document.update({ "system.details.alignment": alignment });
      },
      { items, columns: 3 }
    );
    w.render($(a));
  }

  /**
   * Activate an item from item control button.
   *
   * @param {MouseEvent} event Click event
   */
  _itemActivationControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemId = a.closest(".item[data-item-id]").dataset.itemId;
    const item = this.document.items.get(itemId);

    item.use({ ev: event, token: this.token });
  }

  async _quickChangeItemQuantity(event, add = 1) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    const curQuantity = item.system.quantity || 0;
    let newQuantity = Math.max(0, curQuantity + add);

    if (item.type === "container") newQuantity = Math.min(newQuantity, 1);

    item.update({ "system.quantity": newQuantity });
  }

  async _quickEquipItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (item.isPhysical) {
      item.update({ "system.equipped": !item.system.equipped });
    }
  }

  async _quickCarryItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (item.isPhysical) {
      item.update({ "system.carried": !item.system.carried });
    }
  }

  async _quickIdentifyItem(event) {
    event.preventDefault();
    if (!game.user.isGM) {
      return void ui.notifications.error(game.i18n.localize("PF1.Error.CantIdentify"));
    }
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    if (item.isPhysical) {
      item.update({ "system.identified": !item.system.identified });
    }
  }

  async _itemPreparedToggle(event) {
    event.preventDefault();
    const el = event.currentTarget;

    const itemId = el.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    const property = el.dataset.name;

    const updateData = { system: {} };
    foundry.utils.setProperty(updateData.system, property, foundry.utils.getProperty(item.system, property) ? 0 : 1);
    item.update(updateData);
  }

  async _duplicateItem(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemId = a.closest(".item[data-item-id]").dataset.itemId;
    const item = this.document.items.get(itemId);
    const itemData = item.toObject();

    delete itemData._id;

    if (itemData.system.links?.children) delete itemData.system.links.children;

    // BUG: If unidentified item has same name, it won't be matched
    const searchUnusedName = (name) => {
      let iter = 1;
      let newName;
      do {
        iter += 1;
        newName = `${name} (${iter})`;
      } while (this.actor.items.getName(newName));
      return newName;
    };

    // Eliminate previous iterator
    itemData.name = itemData.name.replace(/\s+\(\d+\)$/, "");

    itemData.name = searchUnusedName(itemData.name);

    // TODO: itemData.system.unidentified?.name;

    this.document.createEmbeddedDocuments("Item", [itemData]);
  }

  _quickAction(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemId = a.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (!item) return;

    return item.use({ token: this.token });
  }

  _convertCurrency(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const currencyType = a.dataset.type;
    const category = a.dataset.category;

    this.document.convertCurrency(category, currencyType);
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   *
   * @param event
   * @private
   */
  _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;

    const type = header.dataset.type;
    let subType = header.dataset.subType;
    const typeName = header.dataset.typeName || game.i18n.localize(CONFIG.Item.typeLabels[type] || type);

    const itemData = {
      name: game.i18n.format("PF1.NewItem", { type: typeName }),
      type,
      system: foundry.utils.duplicate(header.dataset),
    };

    delete itemData.system.type;
    delete itemData.system.tooltip;
    delete itemData.system.typeName;

    // Ensure variable type is correct
    if (type === "spell") {
      if (typeof itemData.system?.level === "string") itemData.system.level = parseInt(itemData.system.level);
    }

    const newItem = new Item.implementation(itemData);

    this._sortNewItem(newItem);

    subType = newItem.subType;

    // Get old items of same general category
    const oldItems = this.actor.itemTypes[type]
      .filter((oldItem) => this._isItemSameSubGroup(newItem, oldItem))
      .sort((a, b) => b.sort - a.sort);

    if (oldItems.length) {
      // Ensure no duplicate names occur
      const baseName = newItem.name;
      let newName = baseName;
      let i = 2;
      const names = new Set(oldItems.map((i) => i.name));
      while (names.has(newName)) {
        newName = `${baseName} (${i++})`;
      }

      if (newName !== newItem.name) newItem.updateSource({ name: newName });
    }

    return this.document.createEmbeddedDocuments("Item", [newItem.toObject()], { renderSheet: true });
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an existing Owned Item for the Actor
   *
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemEdit(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    const item = this.document.items.get(li.dataset.itemId);

    item.sheet.render(true, { focus: true });
  }

  /**
   * Handle deleting an existing Owned Item for the Actor
   *
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemDelete(event) {
    event.preventDefault();

    const button = event.currentTarget;
    if (button.disabled) return;

    const li = event.currentTarget.closest(".item");
    const item = this.document.items.get(li.dataset.itemId);

    if (getSkipActionPrompt()) {
      item.delete();
    } else {
      button.disabled = true;

      const msg = `<p>${game.i18n.localize("PF1.DeleteItemConfirmation")}</p>`;
      Dialog.confirm({
        title: game.i18n.format("PF1.DeleteItemTitle", { name: item.name }),
        content: msg,
        yes: () => {
          item.delete();
          button.disabled = false;
        },
        no: () => (button.disabled = false),
        rejectClose: true,
      }).then(null, () => (button.disabled = false));
    }
  }

  async _onItemGive(event) {
    event.preventDefault();

    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    const targets = game.actors.contents.filter((o) => o.testUserPermission(game.user, "OWNER") && o !== this.document);
    targets.push(
      ...game.actors.contents.filter(
        (o) => o.hasPlayerOwner && o !== this.document && !o.testUserPermission(game.user, "OWNER")
      )
    );

    const targetData = await pf1.utils.dialog.getActor(`Give item to actor`, targets);

    if (!targetData) return;
    let target;
    if (targetData.type === "actor") {
      target = game.actors.get(targetData.id);
    } else if (targetData.type === "item") {
      target = this.document.items.get(targetData.id);
      if (!target) {
        target = game.items.get(targetData.id);
      }
    }

    if (target && target !== item) {
      const itemData = item.toObject();
      if (target instanceof Actor) {
        if (target.testUserPermission(game.user, "OWNER")) {
          await target.createEmbeddedDocuments("Item", [itemData]);
        } else {
          game.socket.emit("system.pf1", {
            eventType: "giveItem",
            targetActor: target.uuid,
            item: item.uuid,
          });
          // Deleting will be performed on the gm side as well to prevent race conditions
          return;
        }
      } else if (target instanceof Item) {
        await target.createContainerContent(itemData);
      }

      await this.document.deleteEmbeddedDocuments("Item", [item.id]);
    }
  }

  async _onItemSplit(event) {
    event.preventDefault();

    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    new Dialog(
      {
        title: game.i18n.format("PF1.Dialog.SplitItem.Title", { name: item.name }),
        content: `<p>${game.i18n.format("PF1.Dialog.SplitItem.Desc")}</p><input type="text" name="value" value="1">`,
        buttons: {
          split: {
            // icon: `<i class="fas fa-people-arrows></i>`,
            label: game.i18n.localize("PF1.Split"),
            callback: async (html) => {
              let splitValue = parseInt(html.find(`[name="value"]`).val());
              splitValue = Math.min(item.system.quantity - 1, Math.max(0, splitValue));
              if (splitValue > 0) {
                await item.update({ "system.quantity": Math.max(0, item.system.quantity - splitValue) });
                const data = item.toObject();
                data.system.quantity = splitValue;
                await Item.implementation.createDocuments([data], { parent: this.document });
              }
            },
          },
        },
        default: "split",
      },
      {
        classes: [...Dialog.defaultOptions.classes, "pf1", "item-split"],
      }
    ).render(true);
  }

  /**
   * Handle rolling an Ability check, either a test or a saving throw
   *
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollAbilityTest(event) {
    event.preventDefault();
    const ability = event.currentTarget.closest(".ability").dataset.ability;
    this.document.rollAbilityTest(ability, { token: this.token });
  }

  _onRollBAB(event) {
    event.preventDefault();
    this.document.rollBAB({ token: this.token });
  }

  /**
   * @internal
   * @param {Event} event
   */
  _onRollAttack(event) {
    event.preventDefault();
    /** @type {HTMLElement} */
    let el = event.target;
    if (!el.classList.contains("rollable")) el = el.closest(".rollable");

    const maneuver = el.dataset.type !== "weapon";
    const ranged = el.dataset.ranged === "true";

    this.document.rollAttack({ maneuver, ranged, token: this.token });
  }

  _onRollInitiative(event) {
    event.preventDefault();
    this.document.rollInitiative({
      createCombatants: true,
      rerollInitiative: game.user.isGM,
      token: this.token,
    });
  }

  _onRollSavingThrow(event) {
    event.preventDefault();
    const savingThrow = event.currentTarget.closest(".saving-throw").dataset.savingthrow;
    this.document.rollSavingThrow(savingThrow, { token: this.token });
  }

  /* -------------------------------------------- */

  /**
   * Organize and classify Owned Items
   *
   * @param data
   * @private
   */
  _prepareItems(data) {
    // Categorize items as inventory, spellbook, features, and classes
    const inventory = {
      weapon: {
        label: game.i18n.localize("PF1.InventoryWeapons"),
        canCreate: true,
        hasActions: true,
        items: [],
        canEquip: true,
        dataset: { type: "weapon" },
      },
      equipment: {
        label: game.i18n.localize("PF1.InventoryArmorEquipment"),
        canCreate: true,
        hasActions: true,
        items: [],
        canEquip: true,
        dataset: { type: "equipment" },
        hasSlots: true,
      },
      consumable: {
        label: game.i18n.localize("PF1.InventoryConsumables"),
        canCreate: true,
        hasActions: true,
        items: [],
        canEquip: false,
        dataset: { type: "consumable" },
      },
      gear: {
        label: pf1.config.lootTypes["gear"],
        canCreate: true,
        hasActions: true,
        items: [],
        canEquip: true,
        dataset: {
          type: "loot",
          "type-name": game.i18n.localize("PF1.Subtypes.Item.loot.gear.Single"),
          "sub-type": "gear",
        },
      },
      ammo: {
        label: pf1.config.lootTypes["ammo"],
        canCreate: true,
        hasActions: false,
        items: [],
        canEquip: false,
        dataset: {
          type: "loot",
          "type-name": game.i18n.localize("PF1.Subtypes.Item.loot.ammo.Single"),
          "sub-type": "ammo",
        },
      },
      misc: {
        label: pf1.config.lootTypes["misc"],
        canCreate: true,
        hasActions: false,
        items: [],
        canEquip: false,
        dataset: { type: "loot", "type-name": game.i18n.localize("PF1.Misc"), "sub-type": "misc" },
      },
      tradeGoods: {
        label: pf1.config.lootTypes["tradeGoods"],
        canCreate: true,
        hasActions: false,
        items: [],
        canEquip: false,
        dataset: {
          type: "loot",
          "type-name": game.i18n.localize("PF1.Subtypes.Item.loot.tradeGoods.Single"),
          "sub-type": "tradeGoods",
        },
      },
      container: {
        label: game.i18n.localize("PF1.InventoryContainers"),
        canCreate: true,
        hasActions: false,
        items: [],
        dataset: { type: "container", "type-name": game.i18n.localize("TYPES.Item.container") },
      },
    };

    // Partition items by category
    let [items, spells, feats, classes, attacks, buffs] = data.items.reduce(
      (arr, item) => {
        if (item.type === "spell") arr[1].push(item);
        else if (item.type === "feat") arr[2].push(item);
        else if (item.type === "class") arr[3].push(item);
        else if (item.type === "attack") arr[4].push(item);
        else if (item.type === "buff") arr[5].push(item);
        else if (item.isPhysical) arr[0].push(item);
        return arr;
      },
      [[], [], [], [], [], []]
    );

    // Apply active item filters
    items = this._filterItems(items, this._filters.inventory, this._filters.search.inventory);
    feats = this._filterItems(feats, this._filters.features);

    // Organize Spellbook
    let hasASF = false;
    const spellbookData = {};
    const spellbooks = data.system.attributes.spells.spellbooks;
    for (const [bookId, spellbook] of Object.entries(spellbooks)) {
      // Required for spellbook selection in settings
      spellbookData[bookId] = { ...spellbook };
      // The rest are unnecssary processing if spellbook is not enabled
      if (!spellbook.inUse) continue;
      const book = spellbookData[bookId];
      let spellbookSpells = spells.filter((obj) => obj.spellbook === bookId);
      spellbookSpells = this._filterItems(spellbookSpells, this._filters[`spellbook-${bookId}`]);
      book.section = this._prepareSpellbook(data, spellbookSpells, bookId);
      book.prepared = spellbookSpells.filter(
        (obj) => obj.preparation.mode === "prepared" && obj.preparation.prepared
      ).length;
      book.rollData = data.rollData.spells[bookId];
      book.classId = spellbook.class;
      book.class = data.rollData.classes[spellbook.class];
      if (spellbook.arcaneSpellFailure) hasASF = true;
    }

    if (hasASF) {
      // TODO: Make ASF proper change target
      const asf = this.actor.itemTypes.equipment
        .filter((item) => item.isActive)
        .reduce((cur, item) => {
          const itemASF = item.system.spellFailure || 0;
          return cur + itemASF;
        }, 0);

      data.asf = {
        total: asf,
      };
    }

    // Organize Inventory
    const usystem = pf1.utils.getWeightSystem();

    for (const i of items) {
      const subType = i.type === "loot" ? i.subType || "gear" : i.subType;
      if (inventory[i.type] != null) inventory[i.type].items.push(i);
      // Only loot has subType specific sections
      if (i.type === "loot") {
        const subType = i.subType || "gear";
        let subsectionId = subType;
        switch (subType) {
          case "adventuring":
          case "tool":
          case "reagent":
          case "remedy":
          case "herb":
          case "animalGear":
            subsectionId = "gear";
            break;
          case "treasure":
            subsectionId = "tradeGoods";
            break;
          case "food":
          case "entertainment":
          case "vehicle":
            subsectionId = "misc";
            break;
          case "ammo":
          case "tradeGoods":
          case "misc":
          default:
            subsectionId = subType;
            break;
        }
        const subsection = inventory[subsectionId];
        subsection?.items.push(i);
      }
    }

    // Organize Features
    const features = {};
    const featureDefaults = { items: [], canCreate: true, hasActions: true };
    const featData = this.constructor.featTypeData;
    for (const [featKey, featValue] of Object.entries(pf1.config.featTypes)) {
      // Merge type specific data into common data template
      features[featKey] = foundry.utils.mergeObject(
        featureDefaults,
        {
          // Fist generic data derived from the config object
          label: pf1.config.featTypesPlurals[featKey] ?? featValue,
          dataset: { type: "feat", "type-name": game.i18n.localize(featValue), "sub-type": featKey },
          // Then any specific data explicitly set to override defaults
          ...featData[featKey],
        },
        { inplace: false }
      );
    }

    for (const f of feats) {
      const k = f.subType;
      const ablType = f.abilityType;
      f.typelabel = pf1.config.abilityTypes[ablType]?.short || pf1.config.abilityTypes.na.short;
      features[k]?.items?.push(f);
    }
    classes.sort((a, b) => b.level - a.level);

    // Buffs
    const buffSections = {};
    Object.entries(pf1.config.buffTypes).forEach(([buffId, label]) => {
      buffSections[buffId] = {
        label,
        items: [],
        hasActions: true,
        dataset: { type: "buff", "sub-type": buffId },
      };
    });

    buffs = this._filterItems(buffs, this._filters.buffs);
    for (const b of this._filterItems(buffs, this._filters.buffs)) {
      buffSections[b.subType]?.items.push(b);
    }

    // Attacks
    attacks = this._filterItems(attacks, this._filters.attacks);
    const attackSections = {
      weapon: {
        label: game.i18n.localize("PF1.Subtypes.Item.attack.weapon.Plural"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "sub-type": "weapon" },
      },
      natural: {
        label: game.i18n.localize("PF1.Subtypes.Item.attack.natural.Plural"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "sub-type": "natural" },
      },
      ability: {
        label: game.i18n.localize("PF1.Subtypes.Item.attack.ability.Plural"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "sub-type": "ability" },
      },
      racialAbility: {
        label: game.i18n.localize("PF1.Subtypes.Item.attack.racialAbility.Plural"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "sub-type": "racialAbility" },
      },
      item: {
        label: game.i18n.localize("PF1.Items"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "sub-type": "item" },
      },
      misc: {
        label: game.i18n.localize("PF1.Misc"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "sub-type": "misc" },
      },
    };

    for (const attack of attacks) {
      const subType = attack.subType;
      if (!attackSections[subType]) {
        console.warn(`Attack for unrecognized subtype "${subType}"`);
        continue;
      }
      attackSections[subType].items.push(attack);
    }

    // Apply type filters
    {
      const sections = [
        { key: "inventory", section: inventory },
        { key: "features", section: features },
        { key: "buffs", section: buffSections },
        { key: "attacks", section: attackSections },
      ];
      for (const [k, sb] of Object.entries(spellbookData)) {
        if (!sb.inUse) continue;
        sections.push({ key: `spellbook-${k}`, section: sb.section });
      }

      for (const section of sections) {
        for (const [k, s] of Object.entries(section.section)) {
          const typeFilterCount = this._typeFilterCount(this._filters[section.key]);
          if (typeFilterCount > 0 && s.items.length === 0) {
            s._hidden = true;
          }
          if (typeFilterCount === 1 && this._filters[section.key].has(`type-${k}`)) {
            s._hidden = false;
          }
        }
      }
    }

    // Assign and return
    data.inventory = inventory;
    data.spellbookData = spellbookData;
    data.features = features;
    data.buffs = buffSections;
    data.attacks = attackSections;
    data.classes = classes;
    data.quickActions = this.document.getQuickActions();
  }

  /**
   * Handle rolling a Skill check
   *
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSkillCheck(event) {
    event.preventDefault();
    const el = event.target;
    const skill = el.dataset.skill;
    const subSkill = el.dataset.subSkill;
    const skillId = subSkill ? `${skill}.subSkills.${subSkill}` : skill;

    this.document.rollSkill(skillId, { token: this.token });
  }

  /**
   * Handle opening a skill's compendium entry
   *
   * @param {Event} event   The originating click event
   * @private
   */
  async _onOpenCompendiumEntry(event) {
    const uuid = event.currentTarget.dataset.compendiumEntry;

    openJournal(uuid);
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling of filters to display a different set of owned items
   *
   * @param {Event} event     The click event which triggered the toggle
   * @private
   */
  _onToggleFilter(event) {
    event.preventDefault();

    const li = event.currentTarget;
    const set = this._filters[li.parentElement.dataset.filter];
    const filter = li.dataset.filter;
    const typeFilterCount = this._typeFilterCount(set);

    const tabLikeFilters = game.settings.get("pf1", "invertSectionFilterShiftBehaviour")
      ? !event.shiftKey
      : event.shiftKey;
    if (tabLikeFilters) {
      for (const f of Array.from(set)) {
        if (f.startsWith("type-") && (f !== filter || typeFilterCount > 1)) {
          set.delete(f);
        }
      }
    }

    if (set.has(filter)) set.delete(filter);
    else set.add(filter);
    this.render();
  }

  _searchFilterCommit(event) {
    const actor = this.actor;
    const search = this._filters.search[event.target.dataset.category].toLowerCase();
    const category = event.target.dataset.category;

    // TODO: Do not refresh if same search term, unless the sheet has updated.
    if (this.effectiveSearch[category] === search && !this.searchRefresh) return;
    this.effectiveSearch[category] = search;
    this.searchRefresh = false;

    const matchSearch = (name) => name.toLowerCase().includes(search); // MKAhvi: Bad method for i18n support.

    $(event.target)
      .closest(".tab")
      .find(".item-list .item")
      .each(function () {
        const jq = $(this);
        if (search?.length > 0) {
          const item = actor.items.get(this.dataset.itemId);
          if (matchSearch(item.name)) jq.show();
          else jq.hide();
        } else jq.show();
      });
  }

  _clearSearch(event) {
    const sb = $(event.target).prev(".search-input");
    this._filters.search[sb.get(0).dataset.category] = "";
    sb.val("").change();
  }

  // IME related
  _searchFilterCompositioning(event) {
    this.searchCompositioning = event.type === "compositionstart";
  }

  _searchFilterChange(event) {
    event.preventDefault();
    event.stopPropagation();

    // Accept input only while not compositioning

    const search = event.target.value;
    const category = event.target.dataset.category;
    const changed = this._filters.search[category] !== search;

    if (this.searchCompositioning || changed) clearTimeout(this.searchDelayEvent); // reset
    if (this.searchCompositioning) return;

    //if (unchanged) return; // nothing changed
    this._filters.search[category] = search;

    if (event.type === "keyup") {
      // Delay search
      if (changed) this.searchDelayEvent = setTimeout(() => this._searchFilterCommit(event), this.searchDelay);
    } else {
      this._searchFilterCommit(event);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle spawning the ActorTraitSelector application which allows a checkbox of multiple trait options
   *
   * @param {Event} event   The click event which originated the selection
   * @private
   */
  _onTraitSelector(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const label = a.parentElement.querySelector("label");
    const choices =
      a.dataset.options in pf1.registry ? pf1.registry[a.dataset.options].getLabels() : pf1.config[a.dataset.options];
    const options = {
      name: a.dataset.for,
      title: label.innerText,
      subject: a.dataset.options,
      choices: choices,
    };

    let app = Object.values(this.document.apps).find(
      (app) => app instanceof ActorTraitSelector && app.options.name === options.name
    );
    app ??= new ActorTraitSelector(this.document, options);
    app.render(true, { focus: true });
  }

  /**
   * Handle spawning the ActorResistanceSelector application which allows a number entry of multiple trait options
   *
   * @param {Event} event   The click event which originated the selection
   * @private
   */
  _onResistanceSelector(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const options = {
      name: a.dataset.for,
      title: a.innerText,
      fields: a.dataset.fields,
      dtypes: a.dataset.dtypes,
      width: a.dataset.options === "dr" ? 575 : 450,
      isDR: a.dataset.options === "dr" ? true : false,
    };

    const app = Object.values(this.document.apps).find((o) => {
      return o instanceof ActorResistanceSelector && o.options.name === options.name && o._element;
    });
    if (app) app.render(true, { focus: true });
    else new ActorResistanceSelector(this.document, options).render(true);
  }

  setItemUpdate(id, key, value) {
    let obj = this._itemUpdates.find((o) => o._id === id);
    if (!obj) {
      obj = { _id: id };
      this._itemUpdates.push(obj);
    }

    obj[key] = value;
  }

  async _render(...args) {
    // Trick to avoid error on elements with changing name
    let focus = this.element.find(":focus");
    focus = focus.length ? focus[0] : null;
    if (focus?.name?.match(/^system\.skills\.(?:[a-zA-Z0-9]*)\.name$/)) focus.blur();

    const result = await super._render(...args);

    // Create placeholders
    this._createPlaceholders(this.element);

    // Apply accessibility settings
    applyAccessibilitySettings(this, this.element, {}, game.settings.get("pf1", "accessibilityConfig"));

    return result;
  }

  async _renderInner(...args) {
    const html = await super._renderInner(...args);

    // Re-open item summaries
    for (const itemId of this._expandedItems) {
      // Only display summaries of items that are still present
      if (this.object.items.has(itemId)) {
        const elem = html.find(`.item-list>.item[data-item-id="${itemId}"]`)[0];
        if (elem) this.openItemSummary(elem, { instant: true });
      } else {
        // Delete itemIds belonging to items no longer found in the actor
        this._expandedItems.findSplice((o) => o === itemId);
      }
    }

    return html;
  }

  async _onSubmit(event, { updateData = null, preventClose = false, preventRender = false } = {}) {
    event.preventDefault();

    if (this._itemUpdates?.length) preventRender = true;

    await super._onSubmit(event, { updateData, preventClose, preventRender });

    // Update items
    await this._updateItems();
  }

  async _updateItems() {
    const promises = [];

    const updates = this._itemUpdates;
    this._itemUpdates = [];

    // Memorize variables in document
    for (const d of updates) {
      const item = this.document.items.get(d._id);
      if (!item) {
        console.error("Item update for non-existing item:", d._id, d);
        continue;
      }
      delete d._id;
      await item.update(d);
    }
  }

  async _onDropCurrency(event, data) {
    const sourceActor = await fromUuid(data.actorUuid || "");

    const { currency, amount, containerId, alt } = data;

    return new CurrencyTransfer(
      { actor: sourceActor, container: containerId, alt },
      { actor: this.actor, amount: Object.fromEntries([[currency, parseInt(amount)]]) }
    ).render(true);
  }

  /**
   * @override
   */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;

    const sourceItem = await Item.implementation.fromDropData(data);
    const itemData = game.items.fromCompendium(sourceItem, { clearFolder: true });

    const sourceActor = await fromUuid(data.actorUuid || "");

    // Handle item sorting within the same actor
    const sameActor = sourceItem.actor === this.actor && !data.containerId;
    if (sameActor) return this._onSortItem(event, itemData);

    // Create the owned item
    this._alterDropItemData(itemData, sourceItem);
    const rv = await this._onDropItemCreate(itemData);

    // Remove from container if item was successfully created
    if (data.containerId && rv?.length && sourceActor === this.actor) {
      const container = this.actor.allItems.find((o) => o.id === data.containerId);
      if (container) container.deleteContainerContent(data.itemId);
    }

    return rv;
  }

  /**
   * @internal
   * @param {object} data - Item data
   * @param {pf1.documents.item.ItemPF} source - Source item
   */
  _alterDropItemData(data, source) {
    // Identify source location
    const fromCompendium = !!source.pack;
    const fromActor = !!source.parent;
    const fromItemsDir = !fromCompendium && !fromActor && !!source.id;

    // Items for NPC should be unidentified by default
    if (
      this.actor.type === "npc" &&
      source.isPhysical &&
      fromCompendium &&
      // We need to check if the item either have Caster Level beyond 0 or it's a drug or poison
      (source.system?.cl > 0 || ["drug", "poison"].includes(source.system.subType))
    ) {
      data.system.identified = false;
    }

    // Set spellbook to currently viewed one
    if (data.type === "spell") {
      data.system.spellbook = this.currentSpellbookKey;
    }

    // Apply actor size to physical items, assuming they're appropriately sized for them
    // But do so only when the drop originates from compendium or items directory
    if (source.isPhysical) {
      if (fromCompendium || fromItemsDir) {
        data.system.size = this.actor.system.traits?.size || "med";
      }
    }
  }

  /**
   * Tests if two items in same sub-group.
   *
   * @private
   * @param {ItemPF} item0
   * @param {ItemPF} item1
   * @returns {boolean}
   */
  _isItemSameSubGroup(item0, item1) {
    if (item0.type === "spell") {
      return item0.system.spellbook === item1.system.spellbook && item0.system.level === item1.system.level;
    }

    if (item0.subType) return item0.subType === item1.subType;

    // Assume everything else is only categorized by main type
    return true;
  }

  /**
   * Sort item at the bottom of the list instead of seemingly random position
   *
   * @private
   * @param {ItemPF} item - Temporary item to do sorting on.
   */
  _sortNewItem(item) {
    const type = item.type;

    // Get old items of same general category
    const oldItems = this.actor.itemTypes[type]
      .filter((oldItem) => this._isItemSameSubGroup(item, oldItem))
      .sort((a, b) => b.sort - a.sort);

    if (oldItems.length) {
      item.updateSource({
        sort: oldItems[0].sort + CONST.SORT_INTEGER_DENSITY,
      });
    }
  }

  async _onDropItemCreate(itemData) {
    const itemDatas = itemData instanceof Array ? itemData : [itemData];

    const creationData = [];
    for (const itemData of itemDatas) {
      delete itemData._id;

      // Assign associated class if actor has only one class
      if (itemData.type === "feat" && itemData.system?.subType === "classFeat") {
        // Available classes ordered by level
        const classes = [...this.actor.itemTypes.class].sort((a, b) => (b.system.level || 0) - (a.system.level || 0));
        if (classes.length === 0) {
          // Nothing to do
        }
        // Only one choice
        else if (classes.length === 1) {
          itemData.system.class = classes[0].system.tag;
        }
        // Query which class to associate with
        else {
          const options = {
            actor: this.actor,
            empty: true,
            items: classes,
            selected: classes[0]?._id,
          };

          const appOptions = {
            title: `${game.i18n.format("PF1.SelectSpecific", {
              specifier: game.i18n.localize("TYPES.Item.class"),
            })} - ${itemData.name} - ${this.actor.name}`,
          };

          const clsId = await pf1.applications.ItemSelector.wait(options, appOptions);
          if (clsId) {
            const cls = this.actor.items.get(clsId);
            itemData.system.class = cls.system.tag;
          }
          // TODO: Cancel if dialog was closed or no class was selected?
        }
      }

      // Import spell as consumable
      if (itemData.type === "spell" && this.currentPrimaryTab !== "spellbook") {
        const spells = this.actor.system.attributes?.spells ?? {};
        const spellType = spells.spellbooks?.[this.currentSpellbookKey]?.kind || "arcane";

        const resultData = await pf1.documents.item.ItemSpellPF.toConsumablePrompt(itemData, {
          spellType,
          actor: this.actor,
          allowSpell: spells.usedSpellbooks?.length > 0,
        });

        if (resultData) {
          creationData.push(resultData);
          continue;
        } else if (resultData === null) continue;
        // else continue with regular spell creation
      }

      const newItem = new Item.implementation(itemData);
      this._sortNewItem(newItem);

      // Choose how to import class
      if (itemData.type === "class") {
        // Set new class to be always level 1
        newItem.updateSource({ system: { level: 1 } });

        if (!(event && event.shiftKey)) {
          const cls = await LevelUpForm.addClassWizard(this.actor, newItem.toObject(), { token: this.token });
          if (cls && itemDatas.length === 1) this._focusTabByItem(cls);
          continue;
        }
      }

      creationData.push(newItem.toObject());
    }

    if (creationData.length === 1) this._focusTabByItem(creationData[0]);

    return this.document.createEmbeddedDocuments("Item", creationData);
  }

  /**
   * Focuses certain tab based on provided item.
   *
   * @internal
   * @param {*} item
   */
  _focusTabByItem(item) {
    let tabId;
    switch (item.type) {
      case "race":
      case "class":
        tabId = "summary";
        break;
      case "spell":
        tabId = "spellbook";
        break;
      case "buff":
        tabId = "buffs";
        break;
      case "feat":
        tabId = "feats";
        break;
      case "weapon":
      case "equipment":
      case "consumable":
      case "loot":
      case "container":
        tabId = "inventory";
        break;
      case "attack":
        tabId = "combat";
        break;
    }

    if (tabId) this.activateTab(tabId, "primary");
  }

  /**
   * Allow drag start always.
   * Foundry blocks this if sheet is not editable, which blocks copying items.
   *
   * @override
   * @param {string} selector Selector string
   */
  _canDragStart(selector) {
    // Conditionally block currency transfer
    if (selector.includes(".denomination")) return this.isEditable;
    return true;
  }

  _onDragStart(event) {
    const elem = event.target;
    if (elem.classList.contains("denomination")) {
      const isAlt = elem.classList.contains("alt-currency");
      const denomination = elem.dataset.denomination;
      const currency = isAlt ? this.actor.system.altCurrency : this.actor.system.currency;
      const dragData = {
        actorUuid: this.actor.uuid,
        type: "Currency",
        alt: isAlt,
        currency: denomination,
        amount: currency[denomination],
      };
      event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    } else if (elem.dataset?.skill) {
      this._onDragSkillStart(event);
    } else if (elem.dataset?.attribute) {
      this._onDragMiscStart(event, elem.dataset.attribute);
    } else if (elem.dataset?.drag) {
      this._onDragMiscStart(event, elem.dataset.drag);
    } else if (elem.dataset?.savingthrow) {
      this._onDragSaveStart(event, elem.dataset.savingthrow);
    } else if (elem.dataset?.ability) {
      this._onDragMiscStart(event, "abilityScore", elem.dataset.ability);
    } else if (elem.dataset?.attack) {
      this._onDragMiscStart(event, "attack", elem.dataset.attack);
    } else {
      super._onDragStart(event);
    }
  }

  _selectOnClick(event) {
    event.preventDefault();
    const el = event.currentTarget;
    el.select();
  }

  _updateObject(event, formData) {
    // Translate CR
    const cr = formData["system.details.cr.base"];
    if (typeof cr === "string") formData["system.details.cr.base"] = CR.fromString(cr);

    // Update from elements with 'data-name'
    {
      const elems = this.element.find("*[data-name]");
      const changedData = {};
      for (const el of elems) {
        const name = el.dataset.name;
        let value;
        if (el.nodeName === "INPUT") value = el.value;
        else if (el.nodeName === "SELECT") value = el.options[el.selectedIndex].value;

        if (el.dataset.dtype === "Number") value = Number(value);
        else if (el.dataset.dtype === "Boolean") value = Boolean(value);

        if (foundry.utils.getProperty(this.document.system, name) !== value) {
          changedData[name] = value;
        }
      }

      for (const [k, v] of Object.entries(changedData)) {
        formData[k] = v;
      }
    }

    this.searchRefresh = true;

    return super._updateObject(event, formData);
  }

  calculateTotalItemValue({ inLowestDenomination = false, recursive = false } = {}) {
    const items = this.actor.items.filter((item) => item.isPhysical && item.system.price != null);
    const total = items.reduce((cur, i) => {
      return cur + i.getValue({ recursive, sellValue: 1, inLowestDenomination: true });
    }, 0);
    return inLowestDenomination ? total : total / 100;
  }

  calculateSellItemValue({ inLowestDenomination = false, recursive = false } = {}) {
    const items = this.document.items.filter((o) => o.system.price != null);
    const sellMultiplier = this.document.getFlag("pf1", "sellMultiplier") || 0.5;
    const total = items.reduce((cur, i) => {
      return cur + i.getValue({ recursive, sellValue: sellMultiplier, inLowestDenomination: true });
    }, 0);
    return inLowestDenomination ? total : total / 100;
  }

  _createPlaceholders(html) {
    const elems = html.find("span[data-placeholder]");
    for (const el of elems) {
      if (!el.innerText) {
        el.classList.add("placeholder");
        el.innerText = el.dataset.placeholder;
      }
    }
  }
}
