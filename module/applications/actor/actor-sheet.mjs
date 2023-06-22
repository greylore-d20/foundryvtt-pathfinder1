import { ActorTraitSelector } from "../trait-selector.mjs";
import { ActorRestDialog } from "./actor-rest.mjs";
import {
  createTag,
  CR,
  createConsumableSpellDialog,
  adjustNumberByStringCommand,
  splitCurrency,
} from "../../utils/lib.mjs";
import { getWeightSystem } from "@utils";
import { PointBuyCalculator } from "../point-buy-calculator.mjs";
import { Widget_ItemPicker } from "../item-picker.mjs";
import { getSkipActionPrompt } from "../../documents/settings.mjs";
import { ItemPF } from "../../documents/item/item-pf.mjs";
import { dialogGetActor } from "../../utils/dialog.mjs";
import { applyAccessibilitySettings } from "../../utils/chat.mjs";
import { LevelUpForm } from "../level-up.mjs";
import { CurrencyTransfer } from "../currency-transfer.mjs";
import { getHighestChanges } from "../../documents/actor/utils/apply-changes.mjs";
import { RollPF } from "../../dice/roll.mjs";

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
     * Whether a submit has been queued in any way.
     *
     * @property
     */
    this._submitQueued = false;

    /**
     * Whether inner part of this sheet has been rendered already.
     *
     * @property
     */
    this._renderedInner = false;

    /**
     * A dictionary of additional queued updates, to be added on top of the form's data (and cleared afterwards).
     *
     * @property
     * @private
     */
    this._pendingUpdates = {};

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
    return mergeObject(super.defaultOptions, {
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
        { dragSelector: "label.denomination" },
        { dragSelector: ".race-container.item[data-item-id]" },
        { dragSelector: "li.skill[data-skill]" },
        { dragSelector: "li.sub-skill[data-skill]" },
        { dragSelector: "th.saving-throw[data-savingthrow]" },
        { dragSelector: "th.attribute.cmb[data-attribute]" },
        { dragSelector: "th.attribute.bab[data-attribute]" },
        { dragSelector: "li.generic-defenses[data-drag]" },
        { dragSelector: ".spellcasting-concentration[data-drag]" },
        { dragSelector: ".spellcasting-cl" },
      ],
      tabs: [
        {
          navSelector: "nav.tabs[data-group='primary']",
          contentSelector: "section.primary-body",
          initial: "summary",
        },
        {
          navSelector: "nav.tabs[data-group='skillset']",
          contentSelector: "section.skillset-body",
          initial: "adventure",
        },
        {
          navSelector: "nav.tabs[data-group='spellbooks']",
          contentSelector: "section.spellbooks-body",
          initial: "primary",
        },
      ],
    });
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
    const primaryElem = this.element.find('nav[data-group="primary"] .item.active');
    if (primaryElem.length !== 1) return null;
    return primaryElem.attr("data-tab");
  }

  get currentSpellbookKey() {
    const elems = this.element.find("nav.spellbooks .item.active");
    if (elems.length === 1) return elems.attr("data-tab");
    else return "primary";
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   *
   * @param options
   */
  async getData(options) {
    const isOwner = this.document.isOwner;
    const data = mergeObject(await super.getData(options), {
      owner: isOwner,
      limited: this.document.limited,
      editable: this.isEditable,
      cssClass: isOwner ? "editable" : "locked",
      isCharacter: this.document.type === "character",
      hasRace: false,
      config: pf1.config,
      useBGSkills: game.settings.get("pf1", "allowBackgroundSkills"),
      isGM: game.user.isGM,
      race: this.document.race != null ? this.document.race.toObject() : null,
      usesAnySpellbook: this.document.system.attributes.spells.usedSpellbooks?.length > 0 ?? false,
      sourceData: {},
      skillsLocked: this._skillsLocked,
    });
    const rollData = this.document.getRollData();
    data.rollData = rollData;
    data.system = deepClone(this.document.system);

    data.hasProficiencies = data.isCharacter || game.settings.get("pf1", "npcProficiencies");

    // Show whether the item has currency
    data.hasCurrency = Object.values(this.object.system.currency).some((o) => o > 0);
    data.hasAltCurrency = Object.values(this.object.system.altCurrency).some((o) => o > 0);

    // Enrich descriptions
    data.biographyHTML = await TextEditor.enrichHTML(data.system.details.biography.value, {
      secrets: isOwner,
      rollData: data.rollData,
      async: true,
    });
    data.notesHTML = await TextEditor.enrichHTML(data.system.details.notes.value, {
      secrets: isOwner,
      rollData: data.rollData,
      async: true,
    });

    // The Actor and its Items
    data.token = this.token;
    data.items = this.document.items.map((item) => {
      const i = deepClone(item.system);
      i.document = item;
      i.type = item.type;
      i.id = item.id;
      i.img = item.img;
      i.isSingleUse = item.isSingleUse;
      i.isCharged = item.isCharged;
      i.hasResource = i.isCharged && !i.isSingleUse;
      i.hasUses = i.uses?.max > 0;

      const firstAction = item.firstAction;
      i.labels = item.getLabels({ actionId: firstAction?.id });
      i.hasAttack = firstAction?.hasAttack;
      i.hasMultiAttack = firstAction?.hasMultiAttack;
      i.hasDamage = firstAction?.hasDamage;
      i.hasRange = firstAction?.hasRange;
      i.hasEffect = firstAction?.hasEffect;
      i.hasAction = item.hasAction || item.getScriptCalls("use").length > 0;
      i.range = mergeObject(
        firstAction?.data?.range ?? {},
        {
          min: firstAction?.getRange({ type: "min" }),
          max: firstAction?.getRange({ type: "max" }),
        },
        { inplace: false }
      );
      i.sort = item.sort;
      i.showUnidentifiedData = item.showUnidentifiedData;
      i.name = item.name; // Copy name over from item to handle identified state correctly

      i.isStack = i.quantity > 1;
      i.price = item.getValue({ recursive: false, sellValue: 1 });

      const itemQuantity = i.quantity != null ? i.quantity : 1;
      const itemCharges = i.uses?.value != null ? i.uses.value : 1;
      i.empty = itemQuantity <= 0 || (i.isCharged && !i.isSingleUse && itemCharges <= 0);

      return i;
    });
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
      const totalValue = splitCurrency(cpValue);
      data.labels.totalValue = game.i18n.format("PF1.ItemContainerTotalItemValue", {
        gp: totalValue.gp,
        sp: totalValue.sp,
        cp: totalValue.cp,
      });
    }

    // Hit point sources
    if (this.document.sourceDetails != null) data.sourceDetails = expandObject(this.document.sourceDetails);
    else data.sourceDetails = null;

    // Ability Scores
    for (const [a, abl] of Object.entries(data.system.abilities)) {
      abl.label = pf1.config.abilities[a];
      abl.totalLabel = abl.total == null ? "-" : abl.total;

      abl.sourceDetails = [
        ...(data.sourceDetails?.system?.abilities?.[a]?.total ?? []),
        ...(data.sourceDetails?.system?.abilities?.[a]?.penalty ?? []),
      ];
    }

    // Armor Class
    for (const [a, ac] of Object.entries(data.system.attributes.ac)) {
      ac.label = pf1.config.ac[a];
      ac.sourceDetails = data.sourceDetails != null ? data.sourceDetails.system.attributes.ac[a].total : [];
    }

    // Saving Throws
    for (const [a, savingThrow] of Object.entries(data.system.attributes.savingThrows)) {
      savingThrow.label = pf1.config.savingThrows[a];
      savingThrow.sourceDetails =
        data.sourceDetails != null ? data.sourceDetails.system.attributes.savingThrows[a].total : [];
    }

    // Update skill labels
    const acp = this.document.system.attributes?.acp?.total;
    for (const [s, skl] of Object.entries(data.system.skills ?? {})) {
      skl.label = pf1.config.skills[s];
      skl.arbitrary = pf1.config.arbitrarySkills.includes(s);
      skl.sourceDetails = [];
      skl.compendiumEntry = pf1.config.skillCompendiumEntries[s] ?? skl.journal ?? null;

      // Add skill rank source
      if (skl.rank > 0) {
        skl.sourceDetails.push({ name: game.i18n.localize("PF1.SkillRankPlural"), value: skl.rank });

        // Add class skill bonus source
        if (skl.cs) {
          skl.sourceDetails.push({ name: game.i18n.localize("PF1.CSTooltip"), value: 3 });
        }
      }

      // Add ACP source
      if (skl.acp && acp > 0) {
        skl.sourceDetails.push({ name: game.i18n.localize("PF1.ACPLong"), value: -acp });
      }

      // Add ability modifier source
      if (skl.ability) {
        skl.sourceDetails.push({
          name: pf1.config.abilities[skl.ability],
          value: data.rollData.abilities[skl.ability]?.mod ?? 0,
        });
      }

      // Add misc skill bonus source
      if (data.sourceDetails != null && data.sourceDetails.system.skills[s] != null) {
        skl.sourceDetails = skl.sourceDetails.concat(data.sourceDetails.system.skills[s].changeBonus);
      }

      skl.untrained = skl.rt === true && skl.rank <= 0;
      if (skl.subSkills != null) {
        for (const [s2, skl2] of Object.entries(skl.subSkills)) {
          skl2.compendiumEntry = skl2.journal ?? null;
          skl2.sourceDetails = [];
          if (skl2.rank > 0) {
            skl2.sourceDetails.push({ name: game.i18n.localize("PF1.SkillRankPlural"), value: skl2.rank });
            if (skl2.cs) {
              skl2.sourceDetails.push({ name: game.i18n.localize("PF1.CSTooltip"), value: 3 });
            }
          }
          skl2.sourceDetails.push({
            name: pf1.config.abilities[skl2.ability],
            value: data.system.abilities[skl2.ability]?.mod ?? 0,
          });
          if (
            data.sourceDetails != null &&
            data.sourceDetails.system.skills[s] != null &&
            data.sourceDetails.system.skills[s].subSkills != null &&
            data.sourceDetails.system.skills[s].subSkills[s2] != null
          ) {
            skl2.sourceDetails = skl2.sourceDetails.concat(
              data.sourceDetails.system.skills[s].subSkills[s2].changeBonus
            );
          }
          skl2.untrained = skl2.rt === true && skl2.rank <= 0;
        }
      }
    }

    // Update traits
    this._prepareTraits(data.system.traits);
    data.senses = this._prepareSenses(data.system.traits.senses);

    // Prepare owned items
    this._prepareItems(data);

    // Compute encumbrance
    data.encumbrance = this._computeEncumbrance(data.system);

    // Prepare skillsets
    data.skillsets = this._prepareSkillsets(data.system.skills);

    // Skill rank counting
    const skillRanks = { allowed: 0, used: 0, bgAllowed: 0, bgUsed: 0, sentToBG: 0 };
    // Count used skill ranks
    for (const skl of Object.values(data.rollData.skills)) {
      if (skl.subSkills != null) {
        for (const subSkl of Object.values(skl.subSkills)) {
          if (data.useBGSkills && skl.background) {
            skillRanks.bgUsed += subSkl.rank;
          } else {
            skillRanks.used += subSkl.rank;
          }
        }
      } else if (data.useBGSkills && skl.background) {
        skillRanks.bgUsed += skl.rank;
      } else {
        skillRanks.used += skl.rank;
      }
    }
    // Count allowed skill ranks
    const sourceData = [];
    setProperty(data.sourceData, "skillRanks", sourceData);
    this.document.items
      .filter((obj) => {
        return obj.type === "class" && obj.system.subType !== "mythic";
      })
      .forEach((cls) => {
        const clsLevel = cls.system.hitDice;
        const clsSkillsPerLevel = cls.system.skillsPerLevel;
        const fcSkills = cls.system.fc.skill.value;
        skillRanks.allowed +=
          Math.max(1, clsSkillsPerLevel + this.document.system.abilities.int.mod) * clsLevel + fcSkills;
        if (data.useBGSkills && pf1.config.backgroundSkillClasses.includes(cls.system.subType))
          skillRanks.bgAllowed += clsLevel * pf1.config.backgroundSkillsPerLevel;

        sourceData.push({
          name: game.i18n.format("PF1.SourceInfoSkillRank_ClassBase", { className: cls.name }),
          value: clsSkillsPerLevel * clsLevel,
        });
        if (fcSkills > 0) {
          sourceData.push({
            name: game.i18n.format("PF1.SourceInfoSkillRank_ClassFC", { className: cls.name }),
            value: fcSkills,
          });
        }
      });
    // Count from intelligence
    const intMod = this.actor.system.abilities?.int?.mod;
    if (intMod !== 0) {
      sourceData.push({
        name: game.i18n.localize("PF1.AbilityInt"),
        value: intMod * this.actor.system.attributes?.hd?.total,
      });
    }
    // Count from bonus skill rank formula
    if (this.actor.system.details.bonusSkillRankFormula !== "") {
      const roll = RollPF.safeRoll(this.actor.system.details.bonusSkillRankFormula, rollData);
      if (roll.err) console.error(`An error occurred in the Bonus Skill Rank formula of actor ${this.actor.name}.`);
      skillRanks.allowed += roll.total;
      sourceData.push({
        name: game.i18n.localize("PF1.SkillBonusRankFormula"),
        value: roll.total,
      });
    }
    // Calculate from changes
    this.actor.changes
      .filter((o) => o.subTarget === "bonusSkillRanks")
      .forEach((o) => {
        if (!o.value) return;

        skillRanks.allowed += o.value;
        sourceData.push({
          name: o.parent ? o.parent.name : game.i18n.localize("PF1.Change"),
          value: o.value,
        });
      });
    // Calculate used background skills
    if (data.useBGSkills) {
      if (skillRanks.bgUsed > skillRanks.bgAllowed) {
        skillRanks.sentToBG = skillRanks.bgUsed - skillRanks.bgAllowed;
        skillRanks.allowed -= skillRanks.sentToBG;
        skillRanks.bgAllowed += skillRanks.sentToBG;
      }
    }
    data.skillRanks = skillRanks;

    // Feat count
    {
      const sourceData = [];
      setProperty(data.sourceData, "bonusFeats", sourceData);

      // Feat count
      // By level
      data.featCount = {};
      data.featCount.value = this.actor.items.filter(
        (o) => o.type === "feat" && o.system.subType === "feat" && !o.system.disabled
      ).length;
      const totalLevels = this.document.items
        .filter((o) => o.type === "class" && ["base", "npc", "prestige", "racial"].includes(o.system.subType))
        .reduce((cur, o) => {
          return cur + o.hitDice;
        }, 0);
      data.featCount.byLevel = Math.ceil(totalLevels / 2);
      sourceData.push({
        name: game.i18n.localize("PF1.Level"),
        value: data.featCount.byLevel,
      });

      // Bonus feat formula
      const featCountRoll = RollPF.safeRoll(this.document.system.details.bonusFeatFormula || "0", rollData);
      const changes = this.document.changes.filter((c) => c.subTarget === "bonusFeats");
      const changeBonus = getHighestChanges(
        changes.filter((c) => {
          c.applyChange(this.document);
          if (c.parent || c.flavor) {
            sourceData.push({
              name: c.parent?.name ?? c.flavor,
              value: c.value,
            });
          }
          return !["set", "="].includes(c.operator);
        }),
        { ignoreTarget: true }
      ).reduce((cur, c) => {
        return cur + c.value;
      }, 0);
      data.featCount.byFormula = featCountRoll.total + changeBonus;
      if (featCountRoll.err) {
        ui.notifications.error(
          game.i18n.format("PF1.ErrorActorFormula", {
            error: game.i18n.localize("PF1.BonusFeatFormula"),
            name: this.document.name,
          })
        );
      }
      if (featCountRoll.total !== 0) {
        sourceData.push({
          name: game.i18n.localize("PF1.BonusFeatFormula"),
          value: featCountRoll.total,
        });
      }

      // Count total
      data.featCount.total = data.featCount.byLevel + data.featCount.byFormula;
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
    {
      data.labels.firstClass = game.i18n
        .format("PF1.Info_FirstClass", {
          html: `<a data-action="compendium" data-action-target="classes" data-tooltip="PF1.OpenCompendium">${game.i18n.localize(
            "PF1.Info_FirstClass_Compendium"
          )}</a>`,
        })
        .replace(/\n+/, "<br>");
    }

    // Return data to the sheet
    return data;
  }

  /* -------------------------------------------- */

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

      // Prefer total over value for dynamically collected proficiencies
      if (trait.customTotal) {
        trait.customTotal
          .split(pf1.config.re.traitSeparator)
          .forEach((c, i) => (trait.selected[`custom${i + 1}`] = c.trim()));
      } else if (trait.custom) {
        // Add custom entry
        trait.custom
          .split(pf1.config.re.traitSeparator)
          .forEach((c, i) => (trait.selected[`custom${i + 1}`] = c.trim()));
      }
      trait.cssClass = !foundry.utils.isEmpty(trait.selected) ? "" : "inactive";
    }
  }

  _prepareSenses(senses) {
    const result = {};

    for (const [k, v] of Object.entries(senses)) {
      if (k === "ll" && senses[k].enabled) {
        result[k] = pf1.config.senses[k];
        continue;
      }

      if (k === "custom" && v.length) {
        v.split(pf1.config.re.traitSeparator).forEach((c, i) => {
          result[`custom${i + 1}`] = c.trim();
        });
        continue;
      }

      if (typeof v === "number" && v > 0) {
        const converted = pf1.utils.convertDistance(v);
        result[k] = `${pf1.config.senses[k]} ${converted[0]} ${converted[1]}`;
        continue;
      }

      if (v === true) {
        result[k] = pf1.config.senses[k];
        continue;
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
    const owner = this.document.isOwner;
    const book = this.document.system.attributes.spells.spellbooks[bookKey];

    const min = book.hasCantrips ? 0 : 1;
    let max = 9;
    if (book.autoSpellLevelCalculation) {
      const cl = book.cl.autoSpellLevelTotal;

      const castsPerDay =
        pf1.config.casterProgression.castsPerDay[book.spellPreparationMode]?.[book.casterType]?.[cl - 1];
      // Check against undefined protects against bad CL modifications.
      max = castsPerDay !== undefined ? castsPerDay.length - 1 : 0;
    }

    // Reduce spells to the nested spellbook structure
    const spellbook = {};
    for (let level = 0; level < 10; level++) {
      const spellLevel = book.spells?.[`spell${level}`];
      if (!spellLevel) {
        console.error(`Bad data for spell level ${level} in spellbook "${bookKey}" for actor "${this.actor.name}"`);
        continue;
      }
      if (!isNaN(spellLevel.max)) {
        spellbook[level] = {
          level: level,
          usesSlots: true,
          spontaneous: book.spontaneous,
          canCreate: owner === true,
          canPrepare: data.actor.type === "character",
          label: pf1.config.spellLevels[level],
          items: [],
          uses: spellLevel.value || 0,
          baseSlots: spellLevel.base || 0,
          slots: spellLevel.max || 0,
          dataset: { type: "spell", level: level, spellbook: bookKey },
          name: game.i18n.localize(`PF1.SpellLevel${level}`),
          spellMessage: spellLevel.spellMessage,
          lowAbilityScore: spellLevel.lowAbilityScore,
          known: spellLevel.known,
          preparation: spellLevel.preparation,
        };
      }
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

  _prepareSkillsets(skillset) {
    const result = {
      all: { skills: {} },
      adventure: { skills: {} },
      background: { skills: {} },
    };

    // sort skills by label
    const keys = Object.keys(skillset).sort(function (a, b) {
      if (skillset[a].custom && !skillset[b].custom) return 1;
      if (!skillset[a].custom && skillset[b].custom) return -1;
      return ("" + skillset[a].label).localeCompare(skillset[b].label);
    });

    keys.forEach((a) => {
      const skl = skillset[a];
      // Include all bute Lore and Artistry in all
      if (!pf1.config.backgroundOnlySkills.includes(a)) result.all.skills[a] = skl;
      if (skl.background) result.background.skills[a] = skl;
      else result.adventure.skills[a] = skl;
    });

    return result;
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

      if (item.document.isPhysical) {
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
    const usystem = getWeightSystem();
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
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Tooltips
    html.mousemove((ev) => this._moveTooltips(ev));

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

    // Race item
    html.find(".race").each((i, el) => {
      if (el.closest(".item").dataset?.itemId) el.addEventListener("contextmenu", (ev) => this._onItemEdit(ev));
    });
    // General items
    html.find(".item-edit").on("click", this._onItemEdit.bind(this));
    // General items (right click)
    html.find(".item .item-name").contextmenu(this._onItemEdit.bind(this));
    // Quick items (right click)
    html.find(".quick-actions li").contextmenu(this._onItemEdit.bind(this));
    // Race controls (editable limitations done internally)
    html.find(".race-container .item-control").click(this._onRaceControl.bind(this));

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) {
      html.find("span.text-box").addClass("readonly");
      return;
    }

    // Remove default change handler
    html.off("change");
    // Add alternative change handler
    html.find("input,select,textarea").on("change", this._onChangeInput.bind(this));

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

    // Show configureable fields
    html.find(".config .config-control").click(this._onConfigControl.bind(this));

    // Select the whole text on click
    html.find(".select-on-click").click(this._selectOnClick.bind(this));

    // Submit on blur
    html.find(".submit-on-blur").on("blur", async (ev) => {
      await this._onSubmit(ev, { preventRender: true });
      this.render();
    });

    /* -------------------------------------------- */
    /*  Abilities, Skills, Defenses and Traits
    /* -------------------------------------------- */

    // Submit hit points
    html.find('input[name="system.attributes.hp.value"]').keypress(this._onSubmitElement.bind(this));

    // Ability Checks
    html.find(".ability-name").click(this._onRollAbilityTest.bind(this));

    // BAB Check
    html.find(".attribute.bab .rollable").click(this._onRollBAB.bind(this));

    // CMB Check
    html.find(".attribute.cmb .rollable").click(this._onRollCMB.bind(this));

    // Attack check
    html.find(".attribute.attack.melee .rollable").click(this._onRollMelee.bind(this));
    html.find(".attribute.attack.ranged .rollable").click(this._onRollRanged.bind(this));

    // Initiative Check
    html.find(".attribute.initiative .rollable").click(this._onRollInitiative.bind(this));

    // Saving Throw
    html.find(".saving-throw .rollable").click(this._onRollSavingThrow.bind(this));

    // Adjust skill rank
    html.find("span.text-box.skill-rank").on("click", (event) => {
      this._onSpanTextInput(event, this._adjustActorPropertyBySpan.bind(this));
    });

    // Add arbitrary skill
    html.find(".skill.arbitrary .skill-create").click((ev) => this._onArbitrarySkillCreate(ev));

    // Delete arbitrary skill
    html.find(".sub-skill > .skill-controls > .skill-delete").click((ev) => this._onArbitrarySkillDelete(ev));

    // Add custom skill
    html.find(".skill-controls.skills .skill-create").click((ev) => this._onSkillCreate(ev));

    // Edit skill
    html.find(".sub-skill > .skill-controls > .skill-edit").on("click", (ev) => this._onSkillEdit(ev));
    html.find(".skill > .skill-controls > .skill-edit").on("click", (ev) => this._onSkillEdit(ev));
    // Delete custom skill
    html.find(".skill > .skill-controls > .skill-delete").click((ev) => this._onSkillDelete(ev));

    // Item Action control
    html.find(".item-actions a.item-action").click(this._itemActivationControl.bind(this));

    // Roll Skill Checks
    html.find(".skill > .action.roll").click(this._onRollSkillCheck.bind(this));
    html.find(".sub-skill > .action.roll").click(this._onRollSubSkillCheck.bind(this));

    // Open skill compendium entry
    html.find("a.compendium-entry").click(this._onOpenCompendiumEntry.bind(this));

    // Trait Selector
    html.find(".trait-selector").click(this._onTraitSelector.bind(this));

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
    html.find("a.item-control.item-toggle-data").click(this._itemToggleData.bind(this));

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
      this._onSpanTextInput(event, this._onSubmit.bind(this));
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
  }

  /* -------------------------------------------- */

  _onSpanTextInput(event, callback = null) {
    const el = event.currentTarget;
    const parent = el.parentElement;

    // Replace span element with an input (text) element
    const newEl = document.createElement(`INPUT`);
    newEl.type = "text";
    if (el.dataset?.dtype) newEl.dataset.dtype = el.dataset.dtype;

    // Set value of new input element
    let prevValue = el.innerText;
    if (el.classList.contains("placeholder")) prevValue = "";

    const noCap = el.classList.contains("no-value-cap");

    const name = el.getAttribute("name");
    let maxValue;
    if (name) {
      newEl.setAttribute("name", name);
      prevValue = getProperty(this.document, name) ?? "";
      if (prevValue && typeof prevValue !== "string") prevValue = prevValue.toString();

      if (name.endsWith(".value") && !noCap) {
        const maxName = name.replace(/\.value$/, ".max");
        maxValue = getProperty(this.document, maxName);
      }
    }
    newEl.value = prevValue;

    // Toggle classes
    const forbiddenClasses = ["placeholder", "direct", "allow-relative"];
    for (const cls of el.classList) {
      if (!forbiddenClasses.includes(cls)) newEl.classList.add(cls);
    }

    // Replace span with input element
    const allowRelative = el.classList.contains("allow-relative"),
      clearValue = parseFloat(el.dataset.clearValue || "0");
    parent.replaceChild(newEl, el);
    let changed = false;
    newEl.addEventListener("keypress", (event) => {
      if (event.key !== "Enter") return;
      changed = true;
      if (allowRelative) {
        const number = adjustNumberByStringCommand(parseFloat(prevValue), newEl.value, maxValue, clearValue);
        newEl.value = number;
      }

      if (newEl.value.toString() === prevValue.toString()) {
        this.render();
      } else if (typeof callback === "function") {
        callback.call(this, event);
      }
    });
    newEl.addEventListener("focusout", (event) => {
      if (!changed) {
        changed = true;
        if (allowRelative && parseFloat(prevValue) !== parseFloat(newEl.value)) {
          const number = adjustNumberByStringCommand(parseFloat(prevValue), newEl.value, maxValue, clearValue);
          newEl.value = number;
        }

        if (newEl.value.toString() === prevValue.toString()) {
          this.render();
        } else if (typeof callback === "function") {
          callback.call(this, event);
        }
      }
    });

    // Select text inside new element
    newEl.focus();
    newEl.select();
  }

  _moveTooltips(event) {
    const elem = $(event.currentTarget);
    const x = event.clientX;
    const y = event.clientY + 24;
    elem.find(".tooltip:hover .tooltipcontent").css("left", `${x}px`).css("top", `${y}px`);
  }

  _onDragSkillStart(event) {
    const elem = event.currentTarget;
    let skillElem = elem.closest(".sub-skill");
    let mainSkill = null;
    let subSkill = null;
    let isSubSkill = true;
    if (!skillElem) {
      skillElem = elem.closest(".skill");
      isSubSkill = false;
    }
    if (!skillElem) return;

    if (isSubSkill) {
      mainSkill = skillElem.dataset.mainSkill;
      subSkill = skillElem.dataset.skill;
    } else {
      mainSkill = skillElem.dataset.skill;
    }

    const result = {
      type: "skill",
      actor: this.document.id,
      skill: subSkill ? `${mainSkill}.subSkills.${subSkill}` : mainSkill,
    };
    if (this.document.isToken) {
      result.sceneId = canvas.scene.id;
      result.tokenId = this.document.token.id;
    }

    event.dataTransfer.setData("text/plain", JSON.stringify(result));
  }

  _onDragMiscStart(event, type) {
    const result = {
      type: type,
      actor: this.document.id,
    };
    if (this.document.isToken) {
      result.sceneId = canvas.scene.id;
      result.tokenId = this.document.token.id;
    }

    switch (type) {
      case "concentration":
      case "cl": {
        const elem = event.currentTarget.closest(".tab.spellbook-group");
        result.altType = elem.dataset.tab;
        break;
      }
    }

    event.dataTransfer.setData("text/plain", JSON.stringify(result));
  }

  _onDragSaveStart(event, type) {
    const result = {
      type: "save",
      altType: type,
      actor: this.document.id,
    };
    if (this.document.isToken) {
      result.sceneId = canvas.scene.id;
      result.tokenId = this.document.token.id;
    }

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

  _onRest(event) {
    event.preventDefault();
    const app = Object.values(this.document.apps).find((o) => {
      return o instanceof ActorRestDialog && o._element;
    });
    if (app) app.render(true, { focus: true });
    else new ActorRestDialog(this.document).render(true);
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
      if (!this._submitQueued) {
        $(el).one("mouseleave", (event) => {
          this._updateItems();
        });
      }
    } else this._updateItems();
  }

  _setSpellUses(event) {
    if (!(event.originalEvent instanceof MouseEvent)) event.preventDefault();
    const el = event.currentTarget;
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event, el);

    const prevValue = item.system.preparation?.preparedAmount;
    const value = el.tagName === "INPUT" ? Number(el.value) : Number(el.innerText);
    this.setItemUpdate(item.id, "system.preparation.preparedAmount", value);
    if (prevValue < value) {
      const maxValue = item.system.preparation.maxAmount;
      this.setItemUpdate(item.id, "system.preparation.maxAmount", Math.max(maxValue, value));
    }

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      if (!this._submitQueued) {
        $(el).one("mouseleave", (event) => {
          this._updateItems();
        });
      }
    } else this._updateItems();
  }
  _setMaxSpellUses(event) {
    if (!(event.originalEvent instanceof MouseEvent)) event.preventDefault();
    const el = event.currentTarget;
    const itemId = el.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event, el);

    const prevValue = item.system.preparation?.maxAmount;
    const value = el.tagName === "INPUT" ? Number(el.value) : Number(el.innerText);
    this.setItemUpdate(item.id, "system.preparation.maxAmount", Math.max(0, value));
    if (prevValue > value) {
      const curValue = item.system.preparation.preparedAmount;
      this.setItemUpdate(item.id, "system.preparation.preparedAmount", Math.min(curValue, value));
    }
    if (value < 0) {
      el.tagName === "INPUT" ? (el.value = 0) : (el.innerText = 0);
    }

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      if (!this._submitQueued) {
        $(el).one("mouseleave", (event) => {
          this._updateItems();
        });
      }
    } else this._updateItems();
  }

  _adjustActorPropertyBySpan(event) {
    if (!(event.originalEvent instanceof MouseEvent)) event.preventDefault();
    const el = event.currentTarget;
    this._mouseWheelAdd(event, el);

    // Get base value
    const rawValue = el.tagName === "INPUT" ? el.value : el.innerText;
    let value = el.dataset.dtype === "String" ? rawValue : Number(rawValue);

    // Adjust value if needed
    const name = el.getAttribute("name");
    if (name.match(/^system\.abilities\.([a-zA-Z0-9]+)\.value$/)) {
      if (Number.isNaN(parseInt(value))) value = null;
      else value = parseInt(value);
    }

    // Add pending update
    if (name) {
      this._pendingUpdates[name] = value;
    }

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      if (!this._submitQueued) {
        $(el).one("mouseleave", (event) => {
          this._onSubmit(event);
        });
      }
    } else this._onSubmit(event);
  }

  _setBuffLevel(event) {
    if (!(event.originalEvent instanceof MouseEvent)) event.preventDefault();
    const el = event.currentTarget;
    const itemId = el.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event, el);
    const value = el.tagName === "INPUT" ? Number(el.value) : Number(el.innerText);
    const name = el.getAttribute("name");
    if (name) {
      this._pendingUpdates[name] = value;
    }

    this.setItemUpdate(item.id, "system.level", value);
    if (event.originalEvent instanceof MouseEvent) {
      if (!this._submitQueued) {
        $(el).one("mouseleave", (event) => {
          this._updateItems();
        });
      }
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
    const key = a.name;

    // Delete the stored condition status if setting to false
    const newStatus = !getProperty(this.actor, key);
    const deleteKey = key.replace(/(\w+)$/, (condition) => `-=${condition}`);
    const updateData = newStatus ? { [key]: true } : { [deleteKey]: null };
    this.actor.update(updateData);
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
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    const value = $(event.currentTarget).prop("checked");
    this.setItemUpdate(item.id, "system.active", value);
    this._updateItems();
  }

  _onLevelUp(event) {
    event.preventDefault;
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    const app = Object.values(this.actor.apps).find((o) => {
      return o instanceof LevelUpForm && o._element && o.object === item;
    });
    if (app) app.render(true, { focus: true });
    else new LevelUpForm(item, { token: this.token }).render(true);
  }

  /* -------------------------------------------- */

  /**
   * @param {JQuery.ClickEvent<HTMLElement>} event - The click event on the item
   * @private
   */
  _onItemSummary(event) {
    event.preventDefault();
    const li = $(event.currentTarget).parents(".item");
    this.openItemSummary(li);
  }

  /**
   * Toggle inline display of an item's summary/description by expanding or hiding info div
   *
   * @param {JQuery<HTMLElement>} elem - The element to open. Likely will have the `item` class in CSS.
   * @param {boolean} [instant=false] - Whether to instantly show the expansion (true), or animate it (false)
   */
  openItemSummary(elem, { instant = false } = {}) {
    // Check whether pseudo-item belongs to another collection
    const collection = elem.attr("data-item-collection") ?? "items";
    const itemId = elem.attr("data-item-id");
    const item = this.document[collection].get(itemId);
    const { description, properties } = item.getChatData({ chatcard: false });

    // Toggle summary
    this._expandedItems = this._expandedItems.filter((o) => o !== itemId);
    if (elem.hasClass("expanded")) {
      const summary = elem.children(".item-summary");
      if (instant) summary.remove();
      else summary.slideUp(200, () => summary.remove());
    } else {
      const div = $(`<div class="item-summary">${description}</div>`);
      const props = $(`<div class="item-properties tag-list"></div>`);
      properties.forEach((p) => props.append(`<span class="tag">${p}</span>`));
      div.append(props);
      if (instant) elem.append(div);
      else {
        elem.append(div.hide());
        div.slideDown(200);
      }
      this._expandedItems.push(itemId);
    }
    elem.toggleClass("expanded");
  }

  /**
   * Makes a readonly text input editable, and focus it.
   *
   * @param event
   * @private
   */
  _onInputText(event) {
    event.preventDefault();
    const forStr = event.currentTarget.dataset.for;
    let elem;
    if (forStr.match(/CHILD-([0-9]+)/)) {
      const n = parseInt(RegExp.$1);
      elem = $(event.currentTarget.children[n]);
    } else {
      elem = this.element.find(event.currentTarget.dataset.for);
    }
    if (!elem || (elem && elem.attr("disabled"))) return;

    elem.prop("readonly", false);
    elem.attr("name", event.currentTarget.dataset.attrName);
    const value = getProperty(this.document, event.currentTarget.dataset.attrName);
    elem.attr("value", value);

    const wheelEvent = event && event instanceof WheelEvent;
    if (wheelEvent) {
      this._mouseWheelAdd(event, elem[0]);
    } else {
      elem.select();
    }

    const handler = (event) => {
      if (wheelEvent) elem[0].removeEventListener("mouseout", handler);
      else {
        elem[0].removeEventListener("focusout", handler);
        elem[0].removeEventListener("keydown", keyHandler);
      }
      elem[0].removeEventListener("click", handler);

      if (
        (typeof value === "string" && value !== elem[0].value) ||
        (typeof value === "number" && value !== parseInt(elem[0].value))
      ) {
        changed = true;
      }

      if (changed) {
        this._onSubmit(event);
      } else {
        this.render();
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
      elem[0].addEventListener("mouseout", handler);
      changed = true;
    } else {
      elem[0].addEventListener("focusout", handler);
      elem[0].addEventListener("keydown", keyHandler);
    }
    elem[0].addEventListener("click", handler);
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

    let tag = createTag(skillData.name || "skill");
    let count = 1;
    while (this.document.system.skills[tag] != null) {
      count++;
      tag = createTag(skillData.name || "skill") + count.toString();
    }

    const updateData = {};
    updateData[`system.skills.${tag}`] = skillData;
    if (this.document.testUserPermission(game.user, "OWNER")) await this.document.update(updateData);

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
    const mainSkillId =
      $(event.currentTarget).parents(".sub-skill").attr("data-main-skill") ??
      $(event.currentTarget).parents(".skill").attr("data-skill");
    const subSkillId = $(event.currentTarget).parents(".sub-skill").attr("data-skill");

    return this._editSkill(mainSkillId, subSkillId);
  }

  _onArbitrarySkillDelete(event) {
    event.preventDefault();
    const mainSkillId = $(event.currentTarget).parents(".sub-skill").attr("data-main-skill");
    const skill = this.document.system.skills[mainSkillId];
    const subSkillId = $(event.currentTarget).parents(".sub-skill").attr("data-skill");
    const subSkill = skill?.subSkills?.[subSkillId];
    const skillName = `${pf1.config.skills[mainSkillId] ?? skill.name} (${subSkill.name})`;

    const deleteSkill = () => {
      const updateData = {};
      updateData[`system.skills.${mainSkillId}.subSkills.-=${subSkillId}`] = null;
      this.document.update(updateData);
    };

    if (getSkipActionPrompt()) {
      deleteSkill();
    } else {
      const msg = `<p>${game.i18n.localize("PF1.DeleteSkillConfirmation")}</p>`;
      Dialog.confirm({
        title: game.i18n.format("PF1.DeleteSkillTitle", { name: skillName }),
        content: msg,
        yes: () => {
          deleteSkill();
        },
        rejectClose: true,
      });
    }
  }

  _onSkillDelete(event) {
    event.preventDefault();
    if (!this.document.testUserPermission(game.user, "OWNER")) return;
    const skillId = $(event.currentTarget).parents(".skill").attr("data-skill");
    const skill = this.document.system.skills[skillId];
    const skillName = pf1.config.skills[skillId] ?? skill.name;

    const deleteSkill = () => {
      const updateData = {};
      updateData[`system.skills.-=${skillId}`] = null;
      this.document.update(updateData);
    };

    if (getSkipActionPrompt()) {
      deleteSkill();
    } else {
      const msg = `<p>${game.i18n.localize("PF1.DeleteSkillConfirmation")}</p>`;
      Dialog.confirm({
        title: game.i18n.format("PF1.DeleteSkillTitle", { name: skillName }),
        content: msg,
        yes: () => {
          deleteSkill();
        },
        rejectClose: true,
      });
    }
  }

  async _onRaceControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Edit race (allow opening without edit rights)
    if (a.classList.contains("edit")) {
      this._onItemEdit(event);
    }
    // Add race
    else if (this.isEditable) {
      if (a.classList.contains("add")) {
        const itemData = {
          name: "New Race",
          type: "race",
        };
        this.document.createEmbeddedDocuments("Item", [itemData]);
      }
      // Delete race
      else if (a.classList.contains("delete")) {
        this._onItemDelete(event);
      }
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

    const items = Object.entries(pf1.config.alignmentsShort).reduce((cur, o) => {
      cur.push({ value: o[0], label: game.i18n.localize(o[1]) });
      return cur;
    }, []);
    const w = new Widget_ItemPicker(
      (alignment) => {
        this.document.update({ "system.details.alignment": alignment });
      },
      { items: items, columns: 3 }
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
    const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const item = this.document.items.get(itemId);

    const curQuantity = item.system.quantity || 0;
    let newQuantity = Math.max(0, curQuantity + add);

    if (item.type === "container") newQuantity = Math.min(newQuantity, 1);

    this.setItemUpdate(item.id, "system.quantity", newQuantity);
    this._updateItems();
  }

  async _quickEquipItem(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const item = this.document.items.get(itemId);

    if (hasProperty(item, "system.equipped")) {
      this.setItemUpdate(item.id, "system.equipped", !item.system.equipped);
      this._updateItems();
    }
  }

  async _quickCarryItem(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const item = this.document.items.get(itemId);

    if (hasProperty(item, "system.carried")) {
      item.update({ "system.carried": !item.system.carried });
    }
  }

  async _quickIdentifyItem(event) {
    event.preventDefault();
    if (!game.user.isGM) {
      return void ui.notifications.error(game.i18n.localize("PF1.ErrorCantIdentify"));
    }
    // const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    if (hasProperty(item, "system.identified")) {
      item.update({ "system.identified": !item.system.identified });
    }
  }

  async _itemToggleData(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const itemId = $(a).parents(".item").attr("data-item-id");
    const item = this.document.items.get(itemId);
    const property = $(a).attr("name") || a.dataset.name;

    const updateData = {};
    updateData[property] = !getProperty(item, property);
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
    const typeName = header.dataset.typeName || header.dataset.type;
    const baseName = `New ${typeName.capitalize()}`;
    const itemData = {
      name: baseName,
      type: type,
      system: duplicate(header.dataset),
    };
    delete itemData.system.type;

    const subType = itemData.system.subType;
    const sameSubgroup = (oldItem) => {
      if (subType) return subType === oldItem.subType;
      if (type === "spell") {
        return itemData.spellbook === oldItem.system.spellbook && itemData.level === oldItem.system.level;
      }
      // Assume everything else is only categorized by main type
      return true;
    };

    // Get old items of same general category
    const oldItems = this.document.items
      .filter((i) => i.type === type && sameSubgroup(i))
      .sort((a, b) => b.sort - a.sort);

    if (oldItems.length) {
      // Ensure new item is at the bottom of the list instead of seemingly random position
      itemData.sort = oldItems[0].sort + 100;

      // Ensure no duplicate names occur
      let i = 2;
      while (oldItems.find((item) => item.name === itemData.name)) {
        itemData.name = `${baseName} (${i++})`;
      }
    }

    // Ensure variable type is correct
    if (type === "spell") {
      if (typeof itemData.system?.level === "string") itemData.system.level = parseInt(itemData.system.level);
    }

    return this.document.createEmbeddedDocuments("Item", [itemData]);
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

    const app = Object.values(item.apps).find((o) => {
      return o instanceof ItemSheet && o.document === item && o._element != null;
    });
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
    targets.push(...this.document.items.filter((o) => o.type === "container"));
    targets.push(
      ...game.items.contents.filter((o) => o.testUserPermission(game.user, "OWNER") && o.type === "container")
    );
    targets.push(
      ...game.actors.contents.filter(
        (o) => o.hasPlayerOwner && o !== this.document && !o.testUserPermission(game.user, "OWNER")
      )
    );
    const targetData = await dialogGetActor(`Give item to actor`, targets);

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
        content: `<p>${game.i18n.format("PF1.Dialog.SplitItem.Desc")}</p><input type="text" name="value" value="1" />`,
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
                await CONFIG.Item.documentClass.createDocuments([data], { parent: this.document });
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

  _onSubmitElement(event) {
    if (event.key === "Enter") {
      const elem = event.currentTarget;
      if (elem.name) {
        const attr = getProperty(this.document.system, elem.name);
        if (typeof attr === "number" && attr === parseFloat(elem.value)) {
          this._onSubmit(event);
        } else if (typeof attr === "string" && attr === elem.value) {
          this._onSubmit(event);
        }
      }
    }
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

  _onRollMelee(event) {
    event.preventDefault();
    this.document.rollAttack({ melee: true, token: this.token });
  }

  _onRollRanged(event) {
    event.preventDefault();
    this.document.rollAttack({ melee: false, token: this.token });
  }

  _onRollCMB(event) {
    event.preventDefault();
    this.document.rollCMB({ token: this.token });
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
    const savingThrow = event.currentTarget.parentElement.dataset.savingthrow;
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
        hasActions: false,
        items: [],
        canEquip: true,
        dataset: { type: "loot", "type-name": game.i18n.localize("PF1.LootTypeGearSingle"), "sub-type": "gear" },
      },
      ammo: {
        label: pf1.config.lootTypes["ammo"],
        canCreate: true,
        hasActions: false,
        items: [],
        canEquip: false,
        dataset: { type: "loot", "type-name": game.i18n.localize("PF1.LootTypeAmmoSingle"), "sub-type": "ammo" },
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
          "type-name": game.i18n.localize("PF1.LootTypeTradeGoodsSingle"),
          "sub-type": "tradeGoods",
        },
      },
      container: {
        label: game.i18n.localize("PF1.InventoryContainers"),
        canCreate: true,
        hasActions: false,
        items: [],
        dataset: { type: "container" },
      },
    };

    // Partition items by category
    let [items, spells, feats, classes, attacks] = data.items.reduce(
      (arr, item) => {
        if (item.type === "spell") arr[1].push(item);
        else if (item.type === "feat") arr[2].push(item);
        else if (item.type === "class") arr[3].push(item);
        else if (item.type === "attack") arr[4].push(item);
        else if (item.document.isPhysical) arr[0].push(item);
        return arr;
      },
      [[], [], [], [], []]
    );

    // Apply active item filters
    items = this._filterItems(items, this._filters.inventory, this._filters.search.inventory);
    feats = this._filterItems(feats, this._filters.features);

    // Organize Spellbook
    let hasASF = false;
    const spellbookData = {};
    const spellbooks = data.system.attributes.spells.spellbooks;
    for (const [key, spellbook] of Object.entries(spellbooks)) {
      // Required for spellbook selection in settings
      spellbookData[key] = { orig: spellbook, inUse: spellbook.inUse };
      // The rest are unnecssary processing if spellbook is not enabled
      if (!spellbook.inUse) continue;
      let spellbookSpells = spells.filter((obj) => obj.spellbook === key);
      spellbookSpells = this._filterItems(spellbookSpells, this._filters[`spellbook-${key}`]);
      spellbookData[key].data = this._prepareSpellbook(data, spellbookSpells, key);
      spellbookData[key].prepared = spellbookSpells.filter(
        (obj) => obj.preparation.mode === "prepared" && obj.preparation.prepared
      ).length;
      spellbookData[key].rollData = data.rollData.spells[key];
      spellbookData[key].class = data.rollData.classes[spellbook.class];
      if (spellbook.arcaneSpellFailure) hasASF = true;
    }

    if (hasASF) {
      const asfSources = [];
      const asf = this.actor.items
        .filter((item) => item.type === "equipment" && item.system.equipped === true)
        .reduce((cur, item) => {
          const itemASF = item.system.spellFailure ?? 0;
          if (itemASF > 0) {
            asfSources.push({ item, asf: itemASF });
            return cur + itemASF;
          }
          return cur;
        }, 0);

      data.asf = {
        total: asf,
        sources: asfSources,
      };
    }

    // Organize Inventory
    const usystem = getWeightSystem();

    for (const i of items) {
      const subType = i.type === "loot" ? i.subType || "gear" : i.subType;
      i.quantity = i.quantity || 0;
      i.totalWeight = Math.roundDecimals(i.weight.converted.total, 1);
      i.units = usystem === "metric" ? game.i18n.localize("PF1.Kgs") : game.i18n.localize("PF1.Lbs");
      if (inventory[i.type] != null) inventory[i.type].items.push(i);
      // Only loot has subType specific sections
      if (i.type === "loot") inventory[subType]?.items.push(i);
    }

    // Organize Features
    const features = {};
    const featureDefaults = { items: [], canCreate: true, hasActions: true };
    const featData = this.constructor.featTypeData;
    for (const [featKey, featValue] of Object.entries(pf1.config.featTypes)) {
      // Merge type specific data into common data template
      features[featKey] = mergeObject(
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
      if (f.abilityType && f.abilityType !== "none") {
        f.abilityTypeShort = pf1.config.abilityTypes[f.abilityType].short;
        f.abilityType = pf1.config.abilityTypes[f.abilityType].long;
      } else {
        f.abilityTypeShort = "";
        f.abilityType = "";
      }
      features[k]?.items?.push(f);
    }
    classes.sort((a, b) => b.level - a.level);
    classes.forEach((item) => {
      if (item.subType !== "mythic") item.canLevelUp = true;
    });

    // Buffs
    let buffs = data.items.filter((obj) => obj.type === "buff");
    buffs = this._filterItems(buffs, this._filters.buffs);
    const buffSections = {};
    Object.entries(pf1.config.buffTypes).forEach(([buffId, label]) => {
      buffSections[buffId] = {
        label,
        items: [],
        hasActions: true,
        dataset: { type: "buff", "sub-type": buffId },
      };
    });

    for (const b of buffs) {
      buffSections[b.subType]?.items.push(b);
    }

    // Attacks
    attacks = this._filterItems(attacks, this._filters.attacks);
    const attackSections = {
      weapon: {
        label: game.i18n.localize("PF1.AttackTypeWeaponPlural"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "sub-type": "weapon" },
      },
      natural: {
        label: game.i18n.localize("PF1.AttackTypeNaturalPlural"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "sub-type": "natural" },
      },
      ability: {
        label: game.i18n.localize("PF1.AttackTypeAbilityPlural"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "sub-type": "ability" },
      },
      racialAbility: {
        label: game.i18n.localize("PF1.AttackTypeRacialPlural"),
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
        sections.push({ key: `spellbook-${k}`, section: sb.data });
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
    const skill = event.currentTarget.parentElement.dataset.skill;
    this.document.rollSkill(skill, { token: this.token });
  }

  _onRollSubSkillCheck(event) {
    event.preventDefault();
    const mainSkill = event.currentTarget.parentElement.dataset.mainSkill;
    const skill = event.currentTarget.parentElement.dataset.skill;
    this.document.rollSkill(`${mainSkill}.subSkills.${skill}`, { token: this.token });
  }

  /**
   * Handle opening a skill's compendium entry
   *
   * @param {Event} event   The originating click event
   * @private
   */
  async _onOpenCompendiumEntry(event) {
    const uuid = event.currentTarget.dataset.compendiumEntry;
    const document = await fromUuid(uuid);

    // Open document
    if (document instanceof JournalEntryPage) {
      document.parent.sheet.render(true, { pageId: document.id });
    } else {
      document.sheet.render(true);
    }
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
      name: label.getAttribute("for"),
      title: label.innerText,
      subject: a.dataset.options,
      choices: choices,
    };

    const app = Object.values(this.document.apps).find((o) => {
      return o instanceof ActorTraitSelector && o.options.name === options.name && o._element;
    });
    if (app) app.render(true, { focus: true });
    else new ActorTraitSelector(this.document, options).render(true);
  }

  setItemUpdate(id, key, value) {
    let obj = this._itemUpdates.filter((o) => {
      return o._id === id;
    })[0];
    if (obj == null) {
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
        const elem = html.find(`.item-list>.item[data-item-id="${itemId}"]`);
        if (elem.length) this.openItemSummary(elem, { instant: true });
      } else {
        // Delete itemIds belonging to items no longer found in the actor
        this._expandedItems.findSplice((o) => o === itemId);
      }
    }

    return html;
  }

  async _onSubmit(event, { updateData = null, preventClose = false, preventRender = false } = {}) {
    event.preventDefault();

    this._submitQueued = false;

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
      item.memorizeVariables();
      delete d._id;
      await item.update(d);
    }
  }

  async _onDropCurrency(event, data) {
    const sourceActor = data.tokenId ? game.actors.tokens[data.tokenId] : data.actorId,
      dataType = "currency";
    return new CurrencyTransfer(
      { actor: sourceActor, container: data.containerId, alt: data.alt },
      { actor: this.actor, amount: Object.fromEntries([[data.currency, parseInt(data.amount)]]) }
    ).render(true);
  }

  /**
   * @override
   */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;

    const item = await ItemPF.implementation.fromDropData(data);
    const itemData = item.toObject();

    // Handle item sorting within the same actor
    const sameActor = item.parent?.uuid === this.actor.uuid && !data.containerId;
    if (sameActor) return this._onSortItem(event, itemData);

    // Remove from container
    if (data.containerId) {
      const container = this.actor.allItems.find((o) => o.id === data.containerId);

      if (container) container.deleteContainerContent(itemData._id);
    }

    // Create the owned item
    this._alterDropItemData(itemData);
    return this._onDropItemCreate(itemData);
  }

  _alterDropItemData(data) {
    if (data.type === "spell") {
      data.system.spellbook = this.currentSpellbookKey;
    }
  }

  async _onDropItemCreate(itemData) {
    const itemDatas = itemData instanceof Array ? itemData : [itemData];

    const creationData = [];
    for (const itemData of itemDatas) {
      delete itemData._id;

      // Import spell as consumable
      if (itemData.type === "spell" && this.currentPrimaryTab !== "spellbook") {
        const resultData = await createConsumableSpellDialog(itemData);
        if (resultData === "spell") {
          // No action here.
        } else if (resultData) return this.document.createEmbeddedDocuments("Item", [resultData]);
        else return false;
      }
      // Choose how to import class
      if (itemData.type === "class" && itemData.system.subType !== "mythic" && !(event && event.shiftKey)) {
        const doReturn = await new Promise((resolve) => {
          new Dialog(
            {
              title: game.i18n.localize("PF1.AddClass"),
              content: `<div class="pf1"><p>${game.i18n.localize(
                "PF1.Info.AddClassDialog_Desc"
              )}</p><div class="help-text"><i class="fas fa-info-circle"></i> ${game.i18n.localize(
                "PF1.Info.AddClassDialog"
              )}</div></div>`,
              buttons: {
                normal: {
                  icon: '<i class="fas fa-hat-wizard"></i>',
                  label: game.i18n.localize("PF1.Normal"),
                  callback: () => {
                    LevelUpForm.addClassWizard(this.actor, itemData).then(() => {
                      resolve(true);
                    });
                  },
                },
                raw: {
                  icon: '<i class="fas fa-file"></i>',
                  label: game.i18n.localize("PF1.Raw"),
                  callback: () => {
                    resolve(false);
                  },
                },
              },
              close: () => {
                resolve(true);
              },
            },
            {
              classes: [...Dialog.defaultOptions.classes, "pf1", "add-character-class"],
            }
          ).render(true);
        });
        if (doReturn) return false;
      }

      creationData.push(itemData);
    }

    return this.document.createEmbeddedDocuments("Item", creationData);
  }

  /**
   * Allow drag start always.
   * Foundry blocks this if sheet is not editable, which blocks copying items.
   *
   * @override
   */
  _canDragStart(selector) {
    return true;
  }

  _onDragStart(event) {
    const elem = event.target;
    if (elem.classList.contains("denomination")) {
      if (this.actor.permission < 3) return;
      const dragData = {
        actorId: this.actor.id,
        sceneId: this.actor.isToken ? canvas.scene?.id : null,
        tokenId: this.actor.isToken ? this.actor.token.id : null,
        type: "Currency",
        alt: elem.classList.contains("alt-currency"),
        currency: [...elem.classList].find((o) => /[pgsc]p/.test(o)),
        amount: parseInt(elem.nextElementSibling.textContent || elem.nextElementSibling.value),
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
    } else super._onDragStart(event);
  }

  async _onConfigControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const f = $(a).attr("for");
    const html = this.element;

    $(a).css("display", "none");

    // Show CR field
    if (f === "cr") {
      const elem = html.find('input[for="system.details.cr"]');
      elem.attr("value", CR.fromNumber(this.document.system.details.cr.base));
      elem.attr("name", "system.details.cr.base");
      elem.prop("disabled", false);
      elem.focus();
      elem.select();
    }

    // Show base Spell Slots field
    else if (f === "spellSlots") {
      const elem = $(a).closest(".spell-uses").find(".base");
      elem.css("display", "block");
      elem.focus();
      elem.select();
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

        if (getProperty(this.document.system, name) !== value) {
          changedData[name] = value;
        }
      }

      for (const [k, v] of Object.entries(changedData)) {
        formData[k] = v;
      }
    }

    // Add pending updates
    for (const [k, v] of Object.entries(this._pendingUpdates)) {
      formData[k] = v;
    }
    this._pendingUpdates = {};

    this.searchRefresh = true;

    return super._updateObject(event, formData);
  }

  calculateTotalItemValue({ inLowestDenomination = false } = {}) {
    const items = this.document.items.filter((o) => o.system.price != null);
    const total = items.reduce((cur, i) => {
      return cur + i.getValue({ sellValue: 1, inLowestDenomination: true });
    }, 0);
    return inLowestDenomination ? total : total / 100;
  }

  calculateSellItemValue({ inLowestDenomination = false } = {}) {
    const items = this.document.items.filter((o) => o.system.price != null);
    const sellMultiplier = this.document.getFlag("pf1", "sellMultiplier") || 0.5;
    const total = items.reduce((cur, i) => {
      return cur + i.getValue({ sellValue: sellMultiplier, inLowestDenomination: true });
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
