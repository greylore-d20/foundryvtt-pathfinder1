import { ActorTraitSelector } from "../../apps/trait-selector.js";
import { ActorRestDialog } from "../../apps/actor-rest.js";
import {
  createTag,
  createTabs,
  CR,
  convertWeight,
  createConsumableSpellDialog,
  adjustNumberByStringCommand,
  splitCurrency,
} from "../../lib.js";
import { PointBuyCalculator } from "../../apps/point-buy-calculator.js";
import { Widget_ItemPicker } from "../../widgets/item-picker.js";
import { getSkipActionPrompt } from "../../settings.js";
import { ItemPF } from "../../item/entity.js";
import { dialogGetActor } from "../../dialog.js";
import { applyAccessibilitySettings } from "../../chat.js";
import { LevelUpForm } from "../../apps/level-up.js";
import { getSourceInfo } from "../apply-changes.js";
import { CurrencyTransfer } from "../../apps/currency-transfer.js";
import { getHighestChanges } from "../apply-changes.js";
import { PF1 } from "../../config.js";

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
     * The scroll position on the active tab
     *
     * @type {number}
     */
    this._scrollTab = {};
    this._initialTab = {};

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
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      scrollY: [
        ".inventory-body .inventory-list",
        ".combat-attacks",
        ".spells_primary-body .inventory-list",
        ".spells_secondary-body .inventory-list",
        ".spells_tertiary-body .inventory-list",
        ".spells_spelllike-body .inventory-list",
        ".buffs-body .inventory-list",
        ".skillset-body .skills-list.adventure",
        ".skillset-body .skills-list.background",
        ".feats-body",
        ".traits",
        ".actor-notes",
        ".editor-content[data-edit='data.details.biography.value']",
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
    });
  }

  /**
   * Returns an object containing feature type specific data relevant to feature organization.
   *
   * @static
   * @type {object.<string, any>}
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
      isCharacter: this.document.data.type === "character",
      hasRace: false,
      config: CONFIG.PF1,
      useBGSkills: game.settings.get("pf1", "allowBackgroundSkills"),
      spellFailure: this.document.spellFailure,
      isGM: game.user.isGM,
      race: this.document.race != null ? this.document.race.data : null,
      usesAnySpellbook: (getProperty(this.document.data, "data.attributes.spells.usedSpellbooks") || []).length > 0,
      sourceData: {},
    });
    data.data = data.data.data;
    const rollData = this.document.getRollData();
    data.rollData = rollData;

    // Show whether the item has currency
    data.hasCurrency = Object.values(this.object.data.data.currency).some((o) => o > 0);
    data.hasAltCurrency = Object.values(this.object.data.data.altCurrency).some((o) => o > 0);

    // The Actor and its Items
    if (this.document.isToken) data.token = duplicate(this.document.token.data);
    else data.token = data.actor.token;
    data.items = this.document.items.map((i) => {
      i.data.labels = i.labels;
      i.data.hasAttack = i.hasAttack;
      i.data.hasMultiAttack = i.hasMultiAttack;
      i.data.hasDamage = i.hasDamage;
      i.data.hasRange = i.hasRange;
      i.data.hasEffect = i.hasEffect;
      i.data.hasAction = i.hasAction || i.isCharged || i.getScriptCalls("use").length > 0;
      i.data.showUnidentifiedData = i.showUnidentifiedData;
      if (i.showUnidentifiedData)
        i.data.name =
          getProperty(i.data, "data.unidentified.name") || getProperty(i.data, "data.identifiedName") || i.data.name;
      else i.data.name = getProperty(i.data, "data.identifiedName") || i.data.name;
      return i.data;
    });
    data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    data.labels = this.document.labels || {};
    data.filters = this._filters;

    // Generic melee and ranged attack bonuses, only present for sheet.
    const coreAttack = data.data.attributes.attack.shared + data.data.attributes.attack.general,
      meleeAtkAbl = getProperty(data, `data.abilities.${data.data.attributes.attack.meleeAbility}.mod`),
      rangedAtkAbl = getProperty(data, `data.abilities.${data.data.attributes.attack.rangedAbility}.mod`),
      cmbAbl = getProperty(data, `data.abilities.${data.data.attributes.cmbAbility}.mod`);

    const szMod = CONFIG.PF1.sizeMods[data.data.traits.size],
      szCMBMod = CONFIG.PF1.sizeSpecialMods[data.data.traits.size];

    data.data.attributes.attack.meleeAttackMod = meleeAtkAbl;
    data.data.attributes.attack.rangedAttackMod = rangedAtkAbl;
    data.meleeAttack = coreAttack + szMod + data.data.attributes.attack.melee + (meleeAtkAbl ?? 0);
    data.rangedAttack = coreAttack + szMod + data.data.attributes.attack.ranged + (rangedAtkAbl ?? 0);
    data.cmbAttack = coreAttack + szCMBMod + data.data.attributes.cmb.total + (cmbAbl ?? 0);

    // Add inventory value
    {
      const cpValue = this.calculateTotalItemValue({ inLowestDenomination: true });
      const totalValue = splitCurrency(cpValue);
      data.labels.totalValue = game.i18n
        .localize("PF1.ItemContainerTotalItemValue")
        .format(totalValue.gp, totalValue.sp, totalValue.cp);
    }

    // Hit point sources
    if (this.document.sourceDetails != null) data.sourceDetails = expandObject(this.document.sourceDetails);
    else data.sourceDetails = null;

    // Ability Scores
    for (const [a, abl] of Object.entries(data.data.abilities)) {
      abl.label = CONFIG.PF1.abilities[a];
      abl.sourceDetails = data.sourceDetails != null ? data.sourceDetails.data.abilities[a].total : [];
      abl.totalLabel = abl.total == null ? "-" : abl.total;
    }

    // Armor Class
    for (const [a, ac] of Object.entries(data.data.attributes.ac)) {
      ac.label = CONFIG.PF1.ac[a];
      ac.valueLabel = CONFIG.PF1.acValueLabels[a];
      ac.sourceDetails = data.sourceDetails != null ? data.sourceDetails.data.attributes.ac[a].total : [];
    }

    // Saving Throws
    for (const [a, savingThrow] of Object.entries(data.data.attributes.savingThrows)) {
      savingThrow.label = CONFIG.PF1.savingThrows[a];
      savingThrow.sourceDetails =
        data.sourceDetails != null ? data.sourceDetails.data.attributes.savingThrows[a].total : [];
    }

    // Update skill labels
    const acp = getProperty(this.document.data, "data.attributes.acp.total");
    for (const [s, skl] of Object.entries(data.data.skills)) {
      skl.label = CONFIG.PF1.skills[s];
      skl.arbitrary = CONFIG.PF1.arbitrarySkills.includes(s);
      skl.sourceDetails = [];
      skl.compendiumEntry = CONFIG.PF1.skillCompendiumEntries[s] ?? null;

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
      skl.sourceDetails.push({
        name: CONFIG.PF1.abilities[skl.ability],
        value: data.data.abilities[skl.ability].mod,
      });

      // Add misc skill bonus source
      if (data.sourceDetails != null && data.sourceDetails.data.skills[s] != null) {
        skl.sourceDetails = skl.sourceDetails.concat(data.sourceDetails.data.skills[s].changeBonus);
      }

      // Subtract energy drain
      {
        const energyDrain = getProperty(data.data, "data.attributes.energyDrain");
        if (energyDrain) {
          skl.sourceDetails.push({
            name: game.i18n.localize("PF1.CondTypeEnergyDrain"),
            value: -Math.abs(energyDrain),
          });
        }
      }

      skl.untrained = skl.rt === true && skl.rank <= 0;
      if (skl.subSkills != null) {
        for (const [s2, skl2] of Object.entries(skl.subSkills)) {
          skl2.sourceDetails = [];
          if (skl2.rank > 0) {
            skl2.sourceDetails.push({ name: game.i18n.localize("PF1.SkillRankPlural"), value: skl2.rank });
            if (skl2.cs) {
              skl2.sourceDetails.push({ name: game.i18n.localize("PF1.CSTooltip"), value: 3 });
            }
          }
          skl2.sourceDetails.push({
            name: CONFIG.PF1.abilities[skl2.ability],
            value: data.data.abilities[skl2.ability].mod,
          });
          if (
            data.sourceDetails != null &&
            data.sourceDetails.data.skills[s] != null &&
            data.sourceDetails.data.skills[s].subSkills != null &&
            data.sourceDetails.data.skills[s].subSkills[s2] != null
          ) {
            skl2.sourceDetails = skl2.sourceDetails.concat(data.sourceDetails.data.skills[s].subSkills[s2].changeBonus);
          }
          skl2.untrained = skl2.rt === true && skl2.rank <= 0;
        }
      }
    }

    // Update spellbook info
    for (const [k, spellbook] of Object.entries(getProperty(data.data, "attributes.spells.spellbooks"))) {
      setProperty(
        data.data,
        `attributes.spells.spellbooks.${k}.inUse`,
        (getProperty(data.data, "attributes.spells.usedSpellbooks") || []).includes(k)
      );
    }

    // Control items
    data.items
      .filter((obj) => {
        return obj.type === "spell";
      })
      .forEach((obj) => {
        obj.isPrepared = obj.data.preparation.mode === "prepared";
      });

    // Update traits
    this._prepareTraits(data.data.traits);

    // Prepare owned items
    this._prepareItems(data);

    // Compute encumbrance
    data.encumbrance = this._computeEncumbrance(data);

    // Prepare skillsets
    data.skillsets = this._prepareSkillsets(data.data.skills);

    // Skill rank counting
    const skillRanks = { allowed: 0, used: 0, bgAllowed: 0, bgUsed: 0, sentToBG: 0 };
    // Count used skill ranks
    for (const skl of Object.values(data.data.skills)) {
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
    const sourceData = getSourceInfo(this.document.sourceInfo, "data.skillRanks").positive;
    setProperty(data.sourceData, "skillRanks", sourceData);
    this.document.data.items
      .filter((obj) => {
        return obj.type === "class" && obj.data.data.classType !== "mythic";
      })
      .forEach((cls) => {
        const clsLevel = cls.data.data.level;
        const clsSkillsPerLevel = cls.data.data.skillsPerLevel;
        const fcSkills = cls.data.data.fc.skill.value;
        skillRanks.allowed +=
          Math.max(1, clsSkillsPerLevel + this.document.data.data.abilities.int.mod) * clsLevel + fcSkills;
        if (data.useBGSkills && ["base", "prestige"].includes(cls.data.data.classType))
          skillRanks.bgAllowed += clsLevel * 2;

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
    if (getProperty(this.actor.data, "data.abilities.int.mod") !== 0) {
      sourceData.push({
        name: game.i18n.localize("PF1.AbilityInt"),
        value:
          getProperty(this.actor.data, "data.abilities.int.mod") *
          getProperty(this.actor.data, "data.attributes.hd.total"),
      });
    }
    // Count from bonus skill rank formula
    if (this.actor.data.data.details.bonusSkillRankFormula !== "") {
      const roll = RollPF.safeRoll(this.actor.data.data.details.bonusSkillRankFormula, rollData);
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
        (o) => o.type === "feat" && o.data.data.featType === "feat" && !o.data.data.disabled
      ).length;
      const totalLevels = this.document.items
        .filter((o) => o.type === "class" && ["base", "npc", "prestige", "racial"].includes(o.data.data.classType))
        .reduce((cur, o) => {
          return cur + o.data.data.level;
        }, 0);
      data.featCount.byLevel = Math.ceil(totalLevels / 2);
      sourceData.push({
        name: game.i18n.localize("PF1.Level"),
        value: data.featCount.byLevel,
      });

      // Bonus feat formula
      const featCountRoll = RollPF.safeRoll(this.document.data.data.details.bonusFeatFormula || "0", rollData);
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
        const msg = game.i18n
          .localize("PF1.ErrorActorFormula")
          .format(game.i18n.localize("PF1.BonusFeatFormula"), this.document.name);
        console.error(msg);
        ui.notifications.error(msg);
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
      const actorType = { character: "pc", npc: "npc" }[this.document.data.type];
      data.healthConfig = game.settings.get("pf1", "healthConfig");
      data.useWoundsAndVigor = data.healthConfig.variants[actorType].useWoundsAndVigor;
    }

    // Get classes
    data.data.classes = rollData.classes;

    // Determine hidden elements
    this._prepareHiddenElements();
    data.hiddenElems = this._hiddenElems;

    // Create a table of magic items
    {
      const magicItems = this.document.items
        .filter((o) => {
          if (o.showUnidentifiedData) return false;
          if (!o.data.data.carried) return false;

          const school = getProperty(o.data, "data.aura.school");
          const cl = getProperty(o.data, "data.cl");
          return typeof school === "string" && school.length > 0 && typeof cl === "number" && cl > 0;
        })
        .map((o) => {
          const data = {};

          data.name = o.name;
          data.img = o.img;
          data.id = o.id;
          data.cl = getProperty(o.data, "data.cl");
          data.school = getProperty(o.data, "data.aura.school");
          if (CONFIG.PF1.spellSchools[data.school] != null) {
            data.school = CONFIG.PF1.spellSchools[data.school];
          }
          data.school = `${CONFIG.PF1.auraStrengths[o.auraStrength]} <b>${data.school}</b>`;
          data.identifyDC = 15 + data.cl;
          {
            const quantity = getProperty(o.data, "data.quantity") || 0;
            if (quantity > 1) data.quantity = quantity;
          }
          data.identified = getProperty(o.data, "data.identified") === true;

          return data;
        });
      if (magicItems.length > 0) {
        data.table_magicItems = await renderTemplate("systems/pf1/templates/internal/table_magic-items.hbs", {
          items: magicItems,
          isGM: game.user.isGM,
        });
      }
    }

    // Prepare (interactive) labels
    {
      data.labels.firstClass = game.i18n
        .localize("PF1.Info_FirstClass")
        .format(
          `<a data-action="compendium" data-action-target="classes" title="${game.i18n.localize(
            "PF1.OpenCompendium"
          )}">${game.i18n.localize("PF1.Info_FirstClass_Compendium")}</a>`
        )
        .replace(/[\n\r]+/, "<br>");
    }

    // Return data to the sheet
    return data;
  }

  /* -------------------------------------------- */

  _prepareHiddenElements() {
    // Hide spellbook info
    const spellbooks = getProperty(this.document.data, "data.attributes.spells.spellbooks");
    for (const k of Object.keys(spellbooks)) {
      const key = `spellbook-info_${k}`;
      if (this._hiddenElems[key] == null) this._hiddenElems[key] = true;
    }
  }

  _prepareTraits(traits) {
    const map = {
      // "dr": CONFIG.PF1.damageTypes,
      di: CONFIG.PF1.damageTypes,
      dv: CONFIG.PF1.damageTypes,
      ci: CONFIG.PF1.conditionTypes,
      languages: CONFIG.PF1.languages,
      armorProf: CONFIG.PF1.armorProficiencies,
      weaponProf: CONFIG.PF1.weaponProficiencies,
    };
    for (const [t, choices] of Object.entries(map)) {
      const trait = traits[t];
      if (!trait) continue;
      let values = [];
      // Prefer total over value for dynamically collected proficiencies
      if (["armorProf", "weaponProf"].includes(t)) {
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
          .split(CONFIG.PF1.re.traitSeparator)
          .forEach((c, i) => (trait.selected[`custom${i + 1}`] = c.trim()));
      } else if (trait.custom) {
        // Add custom entry
        trait.custom
          .split(CONFIG.PF1.re.traitSeparator)
          .forEach((c, i) => (trait.selected[`custom${i + 1}`] = c.trim()));
      }
      trait.cssClass = !isObjectEmpty(trait.selected) ? "" : "inactive";
    }
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
    const book = this.document.data.data.attributes.spells.spellbooks[bookKey];

    let min = 0;
    let max = 9;
    if (book.autoSpellLevelCalculation) {
      min = book.hasCantrips ? 0 : 1;

      const cl = book.cl.autoSpellLevelTotal;

      const castsPerDay = CONFIG.PF1.casterProgression.castsPerDay[book.spellPreparationMode][book.casterType][cl - 1];
      max = castsPerDay.length - 1;
    }

    // Reduce spells to the nested spellbook structure
    const spellbook = {};
    for (let a = 0; a < 10; a++) {
      if (!isNaN(getProperty(book, `spells.spell${a}.max`))) {
        spellbook[a] = {
          level: a,
          usesSlots: true,
          spontaneous: book.spontaneous,
          canCreate: owner === true,
          canPrepare: data.actor.type === "character",
          label: CONFIG.PF1.spellLevels[a],
          items: [],
          uses: getProperty(book, `spells.spell${a}.value`) || 0,
          baseSlots: getProperty(book, `spells.spell${a}.base`) || 0,
          slots: getProperty(book, `spells.spell${a}.max`) || 0,
          dataset: { type: "spell", level: a, spellbook: bookKey },
          name: game.i18n.localize(`PF1.SpellLevel${a}`),
          spellMessage: getProperty(book, `spells.spell${a}.spellMessage`),
        };
      }
    }
    spells.forEach((spell) => {
      const spellBookKey = getProperty(spell, "data.spellbook");
      if (spellBookKey === bookKey) {
        const lvl = spell.data.level ?? min;
        spellbook[lvl]?.items.push(spell);
      }
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
      result.all.skills[a] = skl;
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
   * Determine whether an Owned Item will be shown based on the current set of filters
   *
   * @param items
   * @param filters
   * @returns {boolean}
   * @private
   */
  _filterItems(items, filters) {
    const hasTypeFilter = this._typeFilterCount(filters) > 0;

    return items.filter((item) => {
      const data = item.data;

      // Action usage
      for (const f of ["action", "bonus", "reaction"]) {
        if (filters.has(f)) {
          if (data.activation && data.activation.type !== f) return false;
        }
      }

      if (filters.has("prepared")) {
        if (data.level === 0 || ["pact", "innate"].includes(data.preparation.mode)) return true;
        if (this.document.data.type === "npc") return true;
        return data.preparation.prepared;
      }

      // Equipment-specific filters
      if (filters.has("equipped")) {
        if (data.equipped && data.equipped !== true) return false;
      }

      // Whether active
      if (filters.has("active")) {
        if (!data.active) return false;
      }

      if (item.type === "feat") {
        if (hasTypeFilter && !filters.has(`type-${data.featType}`)) return false;
      }

      if (ItemPF.isInventoryItem(item.type)) {
        if (hasTypeFilter && item.type !== "loot" && !filters.has(`type-${item.type}`)) return false;
        else if (hasTypeFilter && item.type === "loot" && !filters.has(`type-${data.subType}`)) return false;
      }

      if (item.type === "spell") {
        if (hasTypeFilter && !filters.has(`type-${data.level}`)) return false;
      }

      if (item.type === "buff") {
        if (hasTypeFilter && !filters.has(`type-${data.buffType}`)) return false;
      }

      if (item.type === "attack") {
        if (hasTypeFilter && !filters.has(`type-${data.attackType}`)) return false;
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
    const carriedWeight = actorData.data.attributes.encumbrance.carriedWeight;
    const load = {
      light: actorData.data.attributes.encumbrance.levels.light,
      medium: actorData.data.attributes.encumbrance.levels.medium,
      heavy: actorData.data.attributes.encumbrance.levels.heavy,
    };
    let carryLabel;
    let usystem = game.settings.get("pf1", "weightUnits"); // override
    if (usystem === "default") usystem = game.settings.get("pf1", "units");
    switch (usystem) {
      case "metric":
        carryLabel = game.i18n.localize("PF1.CarryLabelKg").format(carriedWeight);
        break;
      default:
        carryLabel = game.i18n.localize("PF1.CarryLabel").format(carriedWeight);
        break;
    }
    const enc = {
      pct: {
        light: Math.max(0, Math.min((carriedWeight * 100) / load.light, 99.5)),
        medium: Math.max(0, Math.min(((carriedWeight - load.light) * 100) / (load.medium - load.light), 99.5)),
        heavy: Math.max(0, Math.min(((carriedWeight - load.medium) * 100) / (load.heavy - load.medium), 99.5)),
      },
      encumbered: {
        light: actorData.data.attributes.encumbrance.level >= 1,
        medium: actorData.data.attributes.encumbrance.level >= 2,
        heavy:
          actorData.data.attributes.encumbrance.carriedWeight >= actorData.data.attributes.encumbrance.levels.heavy,
      },
      light: actorData.data.attributes.encumbrance.levels.light,
      medium: actorData.data.attributes.encumbrance.levels.medium,
      heavy: actorData.data.attributes.encumbrance.levels.heavy,
      aboveHead: actorData.data.attributes.encumbrance.levels.heavy,
      offGround: actorData.data.attributes.encumbrance.levels.heavy * 2,
      dragPush: actorData.data.attributes.encumbrance.levels.heavy * 5,
      value: actorData.data.attributes.encumbrance.carriedWeight,
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

    this.createTabs(html);

    // Tooltips
    html.mousemove((ev) => this._moveTooltips(ev));

    // Remove default change handler
    html.off("change");
    // Add alternative change handler
    html.find("input,select,textarea").on("change", this._onChangeInput.bind(this));

    // Add general text box (span) handler
    html.find("span.text-box.direct").on("click", (event) => {
      this._onSpanTextInput(event, this._adjustActorPropertyBySpan.bind(this));
    });

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
    html.find(".item .item-name h4").click((event) => this._onItemSummary(event));

    // Click to change text input
    html.find('*[data-action="input-text"]').click((event) => this._onInputText(event));
    html
      .find('*[data-action="input-text"].wheel-change')
      .on("wheel", (event) => this._onInputText(event.originalEvent));

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

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
    html.find('input[name="data.attributes.hp.value"]').keypress(this._onSubmitElement.bind(this));

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

    // Delete custom skill
    html.find(".skill > .skill-controls > .skill-delete").click((ev) => this._onSkillDelete(ev));

    // Quick Item Action control
    html.find(".item-actions a").mouseup((ev) => this._quickItemActionControl(ev));

    // Roll Skill Checks
    html.find(".skill > .skill-name > .rollable").click(this._onRollSkillCheck.bind(this));
    html.find(".sub-skill > .skill-name > .rollable").click(this._onRollSubSkillCheck.bind(this));

    // Open skill compendium entry
    html.find("a.compendium-entry").click(this._onOpenCompendiumEntry.bind(this));

    // Trait Selector
    html.find(".trait-selector").click(this._onTraitSelector.bind(this));

    // Roll defenses
    html.find(".generic-defenses .rollable").click((ev) => {
      this.document.rollDefenses();
    });

    // Rest
    html.find(".rest").click(this._onRest.bind(this));

    // Race controls
    html.find(".race-container .item-control").click(this._onRaceControl.bind(this));

    // Point Buy Calculator
    html.find("button.pointbuy-calculator").click(this._onPointBuyCalculator.bind(this));

    // Alignment
    html.find(".control.alignment").click(this._onControlAlignment.bind(this));

    // Quick edit race item
    html.find(".race").each((i, el) => {
      if (el.closest(".item").dataset?.itemId) el.addEventListener("contextmenu", (ev) => this._onItemEdit(ev));
    });
    /* -------------------------------------------- */
    /*  Inventory
    /* -------------------------------------------- */

    // Owned Item management
    html.find(".item-create").click((ev) => this._onItemCreate(ev));
    html.find(".item-edit").click(this._onItemEdit.bind(this));
    html.find(".item-delete").click(this._onItemDelete.bind(this));
    html.find(".item-give").click(this._onItemGive.bind(this));

    // Quick edit item
    html.find(".item .item-name h4").contextmenu(this._onItemEdit.bind(this));

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

    html.find(".skill-lock-button").click(this._onToggleSkillLock.bind(this)).addClass("unlocked").click();

    /* -------------------------------------------- */
    /*  Links
    /* -------------------------------------------- */

    html.find('a[data-action="compendium"]').click(this._onOpenCompendium.bind(this));
  }

  createTabs(html) {
    const tabGroups = {
      primary: {
        subdetails: {},
        skillset: {},
        spellbooks: {},
      },
    };
    this._tabsAlt = createTabs.call(this, html, tabGroups, this._tabsAlt);
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

    const name = el.getAttribute("name");
    let maxValue;
    if (name) {
      newEl.setAttribute("name", name);
      prevValue = getProperty(this.document.data, name);
      if (prevValue && typeof prevValue !== "string") prevValue = prevValue.toString();

      if (name.endsWith(".value")) {
        const maxName = name.replace(/\.value$/, ".max");
        maxValue = getProperty(this.document.data, maxName);
      }
    }
    newEl.value = prevValue;

    // Toggle classes
    const forbiddenClasses = ["placeholder", "direct", "allow-relative"];
    for (const cls of el.classList) {
      if (!forbiddenClasses.includes(cls)) newEl.classList.add(cls);
    }

    // Replace span with input element
    const allowRelative = el.classList.contains("allow-relative");
    parent.replaceChild(newEl, el);
    let changed = false;
    if (callback) {
      newEl.addEventListener("keypress", (event) => {
        if (event.key !== "Enter") return;
        changed = true;
        if (allowRelative) {
          const number = adjustNumberByStringCommand(parseFloat(prevValue), newEl.value, maxValue);
          newEl.value = number;
        }

        if (newEl.value === prevValue) {
          this._render();
        } else {
          callback.call(this, event);
        }
      });
    }
    newEl.addEventListener("focusout", (event) => {
      if (!changed) {
        changed = true;
        if (allowRelative && parseFloat(prevValue) !== parseFloat(newEl.value)) {
          const number = adjustNumberByStringCommand(parseFloat(prevValue), newEl.value, maxValue);
          newEl.value = number;
        }

        if (newEl.value === prevValue) {
          this._render();
        } else {
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
    if (app) app.bringToTop();
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
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    if (item == null) return;
    return item.roll();
  }

  _mouseWheelAdd(event, el) {
    const isInput = el.tagName.toUpperCase() === "INPUT";

    if (event && event instanceof WheelEvent) {
      const value = (isInput ? parseFloat(el.value) : parseFloat(el.innerText)) || 0;
      if (Number.isNaN(value)) return;

      const increase = -Math.sign(event.deltaY);
      const amount = parseFloat(el.dataset.wheelStep) || 1;

      if (isInput) {
        el.value = value + amount * increase;
      } else {
        el.innerText = (value + amount * increase).toString();
      }
    }
  }

  _setFeatUses(event) {
    event.preventDefault();
    const el = event.currentTarget;
    const itemId = el.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event.originalEvent, el);

    const value = el.tagName.toUpperCase() === "INPUT" ? Number(el.value) : Number(el.innerText);
    this.setItemUpdate(item.id, "data.uses.value", value);

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
    event.preventDefault();
    const el = event.currentTarget;
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event.originalEvent, el);

    const prevValue = getProperty(item.data, "data.preparation.preparedAmount");
    const value = el.tagName.toUpperCase() === "INPUT" ? Number(el.value) : Number(el.innerText);
    this.setItemUpdate(item.id, "data.preparation.preparedAmount", value);
    if (prevValue < value) {
      this.setItemUpdate(item.id, "data.preparation.maxAmount", Math.max(prevValue, value));
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
    event.preventDefault();
    const el = event.currentTarget;
    const itemId = el.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event.originalEvent, el);

    const prevValue = getProperty(item.data, "data.preparation.maxAmount");
    const value = el.tagName.toUpperCase() === "INPUT" ? Number(el.value) : Number(el.innerText);
    this.setItemUpdate(item.id, "data.preparation.maxAmount", Math.max(0, value));
    if (prevValue > value) {
      this.setItemUpdate(item.id, "data.preparation.preparedAmount", Math.min(prevValue, value));
    }
    if (value < 0) {
      el.tagName.toUpperCase() === "INPUT" ? (el.value = 0) : (el.innerText = 0);
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
    event.preventDefault();
    const el = event.currentTarget;

    this._mouseWheelAdd(event.originalEvent, el);
    // Get base value
    let value = el.tagName.toUpperCase() === "INPUT" ? Number(el.value) : Number(el.innerText);
    if (el.dataset.dtype && el.dataset.dtype.toUpperCase() === "STRING") {
      value = el.tagName.toUpperCase() === "INPUT" ? el.value : el.innerText;
    }

    // Adjust value if needed
    const name = el.getAttribute("name");
    if (name.match(/data\.abilities\.([a-zA-Z0-9]+)\.value$/)) {
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
    event.preventDefault();
    const el = event.currentTarget;
    const itemId = el.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    this._mouseWheelAdd(event.originalEvent, el);
    const value = el.tagName.toUpperCase() === "INPUT" ? Number(el.value) : Number(el.innerText);
    const name = el.getAttribute("name");
    if (name) {
      this._pendingUpdates[name] = value;
    }

    this.setItemUpdate(item.id, "data.level", value);
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
    const newStatus = !getProperty(this.actor.data, key);
    const deleteKey = key.replace(/(\w+)$/, (condition) => `-=${condition}`);
    const updateData = newStatus ? { [key]: true } : { [deleteKey]: null };
    this.actor.update(updateData);
  }

  _onToggleSkillLock(event) {
    event.preventDefault();
    const state = event.target.classList.toggle("unlocked");
    const tab = event.target.closest(".tab.skills");
    const rareInputs = $(tab).find(".skill-acp input,.skill-rt input, .skill-ability select");
    rareInputs.prop("disabled", !state);
    $(tab).find(".skill-controls .skill-delete").toggle();
  }

  _onOpenCompendium(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const target = a.dataset.actionTarget;

    game.pf1.compendiums[target].render(true);
  }

  _onRollConcentration(event) {
    event.preventDefault();

    const spellbookKey = $(event.currentTarget).closest(".spellbook-group").data("tab");
    this.document.rollConcentration(spellbookKey);
  }

  _onRollCL(event) {
    event.preventDefault();

    const spellbookKey = $(event.currentTarget).closest(".spellbook-group").data("tab");
    this.document.rollCL(spellbookKey);
  }

  _setItemActive(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    const value = $(event.currentTarget).prop("checked");
    this.setItemUpdate(item.data._id, "data.active", value);
    this._updateItems();
  }

  _onLevelUp(event) {
    event.preventDefault;
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    const app = Object.values(this.actor.apps).find((o) => {
      return o instanceof LevelUpForm && o._element && o.object === item;
    });
    if (app) app.bringToTop();
    else new LevelUpForm(item).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
   *
   * @param event
   * @private
   */
  _onItemSummary(event) {
    event.preventDefault();
    const li = $(event.currentTarget).parents(".item"),
      item = this.document.items.get(li.attr("data-item-id")),
      chatData = item.getChatData({ secrets: this.document.isOwner });

    // Toggle summary
    if (li.hasClass("expanded")) {
      const summary = li.children(".item-summary");
      summary.slideUp(200, () => summary.remove());
    } else {
      const div = $(`<div class="item-summary">${chatData.description.value}</div>`);
      if (chatData.shortDescription?.length) {
        div.append(TextEditor.enrichHTML(chatData.shortDescription, item.getRollData()));
      }
      const props = $(`<div class="item-properties"></div>`);
      chatData.properties.forEach((p) => props.append(`<span class="tag">${p}</span>`));
      div.append(props);
      li.append(div.hide());
      div.slideDown(200);
    }
    li.toggleClass("expanded");
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
    const value = getProperty(this.document.data, event.currentTarget.dataset.attrName);
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

  _onArbitrarySkillCreate(event) {
    event.preventDefault();
    const skillId = $(event.currentTarget).parents(".skill").attr("data-skill");
    const mainSkillData = this.document.data.data.skills[skillId];
    const skillData = {
      name: "",
      ability: mainSkillData.ability,
      rank: 0,
      mod: 0,
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
    updateData[`data.skills.${skillId}.subSkills.${tag}`] = skillData;
    if (this.document.testUserPermission(game.user, "OWNER")) this.document.update(updateData);
  }

  _onSkillCreate(event) {
    event.preventDefault();
    const isBackground = $(event.currentTarget).parents(".skills-list").attr("data-background") === "true";
    const skillData = {
      name: "",
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
    while (this.document.data.data.skills[tag] != null) {
      count++;
      tag = createTag(skillData.name || "skill") + count.toString();
    }

    const updateData = {};
    updateData[`data.skills.${tag}`] = skillData;
    if (this.document.testUserPermission(game.user, "OWNER")) this.document.update(updateData);
  }

  _onArbitrarySkillDelete(event) {
    event.preventDefault();
    const mainSkillId = $(event.currentTarget).parents(".sub-skill").attr("data-main-skill");
    const subSkillId = $(event.currentTarget).parents(".sub-skill").attr("data-skill");

    const updateData = {};
    updateData[`data.skills.${mainSkillId}.subSkills.-=${subSkillId}`] = null;
    if (this.document.testUserPermission(game.user, "OWNER")) this.document.update(updateData);
  }

  _onSkillDelete(event) {
    event.preventDefault();
    const skillId = $(event.currentTarget).parents(".skill").attr("data-skill");

    const updateData = {};
    updateData[`data.skills.-=${skillId}`] = null;
    if (this.document.testUserPermission(game.user, "OWNER")) this.document.update(updateData);
  }

  async _onRaceControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add race
    if (a.classList.contains("add")) {
      const itemData = {
        name: "New Race",
        type: "race",
      };
      this.document.createOwnedItem(itemData);
    }
    // Edit race
    else if (a.classList.contains("edit")) {
      this._onItemEdit(event);
    }
    // Delete race
    else if (a.classList.contains("delete")) {
      this._onItemDelete(event);
    }
  }

  async _onPointBuyCalculator(event) {
    event.preventDefault();

    const app = Object.values(this.document.apps).find((o) => {
      return o instanceof PointBuyCalculator && o._element;
    });
    if (app) app.bringToTop();
    else new PointBuyCalculator(this.document).render(true);
  }

  async _onControlAlignment(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const items = Object.entries(CONFIG.PF1.alignmentsShort).reduce((cur, o) => {
      cur.push({ value: o[0], label: game.i18n.localize(o[1]) });
      return cur;
    }, []);
    const w = new Widget_ItemPicker(
      (alignment) => {
        this.document.update({ "data.details.alignment": alignment });
      },
      { items: items, columns: 3 }
    );
    w.render($(a));
  }

  async _quickItemActionControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const item = this.document.items.get(itemId);

    // Quick Attack
    if (a.classList.contains("item-attack")) {
      await item.use({ ev: event, skipDialog: getSkipActionPrompt() });
    }
  }

  async _quickChangeItemQuantity(event, add = 1) {
    event.preventDefault();
    const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const item = this.document.items.get(itemId);

    const curQuantity = getProperty(item.data, "data.quantity") || 0;
    let newQuantity = Math.max(0, curQuantity + add);

    if (item.type === "container") newQuantity = Math.min(newQuantity, 1);

    this.setItemUpdate(item.id, "data.quantity", newQuantity);
    this._updateItems();
  }

  async _quickEquipItem(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const item = this.document.items.get(itemId);

    if (hasProperty(item.data, "data.equipped")) {
      this.setItemUpdate(item.id, "data.equipped", !item.data.data.equipped);
      this._updateItems();
    }
  }

  async _quickCarryItem(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const item = this.document.items.get(itemId);

    if (hasProperty(item.data, "data.carried")) {
      item.update({ "data.carried": !item.data.data.carried });
    }
  }

  async _quickIdentifyItem(event) {
    event.preventDefault();
    if (!game.user.isGM) {
      const msg = game.i18n.localize("PF1.ErrorCantIdentify");
      console.error(msg);
      return ui.notifications.error(msg);
    }
    // const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);

    if (hasProperty(item.data, "data.identified")) {
      item.update({ "data.identified": !item.data.data.identified });
    }
  }

  async _itemToggleData(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const itemId = $(a).parents(".item").attr("data-item-id");
    const item = this.document.items.get(itemId);
    const property = $(a).attr("name") || a.dataset.name;

    const updateData = {};
    updateData[property] = !getProperty(item.data, property);
    item.update(updateData);
  }

  async _duplicateItem(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const itemId = $(a).parents(".item").attr("data-item-id");
    const item = this.document.items.get(itemId);
    const data = duplicate(item.data);

    delete data.id;
    data.name = `${data.name} (Copy)`;
    data.data.identifiedName = data.name;
    if (data.data.links) data.data.links = {};

    this.document.createOwnedItem(data);
  }

  _quickAction(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemId = a.dataset.itemId;
    const item = this.document.items.find((o) => o.id === itemId);
    if (!item) return;

    game.pf1.rollItemMacro(item.name, { itemId: item.id, itemType: item.type, actorId: this.document.id });
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
      data: duplicate(header.dataset),
    };
    delete itemData.data["type"];

    const getSubtype = (d) => getProperty(d, `data.${d.type}Type`);
    const subtype = getSubtype(itemData);
    const sameSubgroup = (oldItem) => {
      if (subtype) return subtype === getSubtype(oldItem.data);
      if (type === "spell") {
        return (
          itemData.data.spellbook === oldItem.data.data.spellbook && itemData.data.level === oldItem.data.data.level
        );
      }
      // Assume everything else is only categorized by main type
      return true;
    };

    // Get old items of same general category
    const oldItems = this.document.items
      .filter((i) => i.type === type && sameSubgroup(i))
      .sort((a, b) => a.data.sort - b.data.sort);

    if (oldItems.length) {
      // Ensure new item is at top of the list instead of seemingly random position
      itemData.sort = oldItems[0].data.sort - 10;

      // Ensure no duplicate names occur
      let i = 2;
      while (oldItems.find((i) => i.name === itemData.name)) {
        itemData.name = `${baseName} (${i++})`;
      }
    }

    return this.document.createOwnedItem(itemData);
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

    const app = Object.values(this.document.apps).find((o) => {
      return o instanceof ItemSheet && o.object === item && o._element;
    });
    if (app) app.bringToTop();
    else item.sheet.render(true);
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
    const item = this.document.items.find((o) => o.id === li.dataset.itemId);

    if (keyboard.isDown("Shift")) {
      item.delete();
    } else {
      button.disabled = true;

      const msg = `<p>${game.i18n.localize("PF1.DeleteItemConfirmation")}</p>`;
      Dialog.confirm({
        title: game.i18n.localize("PF1.DeleteItemTitle").format(item.name),
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
    const item = this.document.items.find((o) => o.id === itemId);

    const targets = game.actors.contents.filter((o) => o.testUserPermission(game.user, "OWNER") && o !== this.document);
    targets.push(...this.document.items.filter((o) => o.type === "container"));
    targets.push(
      ...game.items.contents.filter((o) => o.testUserPermission(game.user, "OWNER") && o.type === "container")
    );
    const targetData = await dialogGetActor(`Give item to actor`, targets);

    if (!targetData) return;
    let target;
    if (targetData.type === "actor") {
      target = game.actors.contents.find((o) => o.id === targetData.id);
    } else if (targetData.type === "item") {
      target = this.document.items.find((o) => o.id === targetData.id);
      if (!target) {
        target = game.items.contents.find((o) => o.id === targetData.id);
      }
    }

    if (target && target !== item) {
      const itemData = item.data;
      if (target instanceof Actor) {
        await target.createOwnedItem(itemData);
      } else if (target instanceof Item) {
        await target.createContainerContent(itemData);
      }
      await this.document.deleteOwnedItem(item.id);
    }
  }

  _onSubmitElement(event) {
    if (event.key === "Enter") {
      const elem = event.currentTarget;
      if (elem.name) {
        const attr = getProperty(this.document.data, elem.name);
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
    this.document.rollAbility(ability, { event: event });
  }

  _onRollBAB(event) {
    event.preventDefault();
    this.document.rollBAB({ event: event });
  }

  _onRollMelee(event) {
    event.preventDefault();
    this.document.rollAttack({ event: event, melee: true });
  }

  _onRollRanged(event) {
    event.preventDefault();
    this.document.rollAttack({ event: event, melee: false });
  }

  _onRollCMB(event) {
    event.preventDefault();
    this.document.rollCMB({ event: event });
  }

  _onRollInitiative(event) {
    event.preventDefault();
    this.document.rollInitiative({ createCombatants: true, rerollInitiative: game.user.isGM });
  }

  _onRollSavingThrow(event) {
    event.preventDefault();
    const savingThrow = event.currentTarget.parentElement.dataset.savingthrow;
    this.document.rollSavingThrow(savingThrow, { event: event, skipPrompt: getSkipActionPrompt() });
  }

  /* -------------------------------------------- */

  /**
   * Organize and classify Owned Items
   *
   * @param data
   * @private
   */
  _prepareItems(data) {
    // Set item tags
    for (const [key, res] of Object.entries(getProperty(data, "data.resources"))) {
      if (!res) continue;
      const id = res.id;
      if (!id) continue;
      const item = this.document.items.find((o) => o.id === id);
      if (!item) continue;
      item.data.tag = !item.data.data.useCustomTag ? key : item.data.data.tag;
    }

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
        label: CONFIG.PF1.lootTypes["gear"],
        canCreate: true,
        hasActions: false,
        items: [],
        canEquip: true,
        dataset: { type: "loot", "type-name": game.i18n.localize("PF1.LootTypeGearSingle"), "sub-type": "gear" },
      },
      ammo: {
        label: CONFIG.PF1.lootTypes["ammo"],
        canCreate: true,
        hasActions: false,
        items: [],
        canEquip: false,
        dataset: { type: "loot", "type-name": game.i18n.localize("PF1.LootTypeAmmoSingle"), "sub-type": "ammo" },
      },
      misc: {
        label: CONFIG.PF1.lootTypes["misc"],
        canCreate: true,
        hasActions: false,
        items: [],
        canEquip: false,
        dataset: { type: "loot", "type-name": game.i18n.localize("PF1.Misc"), "sub-type": "misc" },
      },
      tradeGoods: {
        label: CONFIG.PF1.lootTypes["tradeGoods"],
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
        item.img = item.img || CONST.DEFAULT_TOKEN;
        item.isStack = item.data.quantity ? item.data.quantity > 1 : false;
        item.hasUses = item.data.uses && item.data.uses.max > 0;
        item.isCharged = ["day", "week", "charges"].includes(getProperty(item, "data.uses.per"));
        item.price = item.data.identified === false ? item.data.unidentified.price : item.data.price;

        const itemQuantity = getProperty(item, "data.quantity") != null ? getProperty(item, "data.quantity") : 1;
        const itemCharges = getProperty(item, "data.uses.value") != null ? getProperty(item, "data.uses.value") : 1;
        item.empty = itemQuantity <= 0 || (item.isCharged && itemCharges <= 0);
        if (item.type === "spell") arr[1].push(item);
        else if (item.type === "feat") arr[2].push(item);
        else if (item.type === "class") arr[3].push(item);
        else if (item.type === "attack") arr[4].push(item);
        else if (ItemPF.isInventoryItem(item.type)) arr[0].push(item);
        return arr;
      },
      [[], [], [], [], []]
    );

    // Apply active item filters
    items = this._filterItems(items, this._filters.inventory, this._filters.search.inventory);
    feats = this._filterItems(feats, this._filters.features);

    // Organize Spellbook
    const spellbookData = {};
    const spellbooks = data.data.attributes.spells.spellbooks;
    for (const [a, spellbook] of Object.entries(spellbooks)) {
      let spellbookSpells = spells.filter((obj) => {
        return obj.data.spellbook === a;
      });
      spellbookSpells = this._filterItems(spells, getProperty(this._filters, `spellbook-${a}`));
      spellbookData[a] = {
        data: this._prepareSpellbook(data, spellbookSpells, a),
        prepared: spellbookSpells.filter((obj) => {
          return obj.data.preparation.mode === "prepared" && obj.data.preparation.prepared;
        }).length,
        orig: spellbook,
      };
    }

    // Organize Inventory
    let usystem = game.settings.get("pf1", "weightUnits"); // override
    if (usystem === "default") usystem = game.settings.get("pf1", "units");

    for (const i of items) {
      const subType = i.type === "loot" ? i.data.subType || "gear" : i.data.subType;
      i.data.quantity = i.data.quantity || 0;
      i.data.weight = i.data.weight || 0;
      i.totalWeight = Math.round(convertWeight(i.data.quantity * i.data.weight) * 10) / 10;
      i.units = usystem === "metric" ? game.i18n.localize("PF1.Kgs") : game.i18n.localize("PF1.Lbs");
      if (inventory[i.type] != null) inventory[i.type].items.push(i);
      if (subType != null && inventory[subType] != null) inventory[subType].items.push(i);
    }

    // Organize Features
    const features = {};
    const featureDefaults = { items: [], canCreate: true, hasActions: true };
    const featData = this.constructor.featTypeData;
    for (const [featKey, featValue] of Object.entries(PF1.featTypes)) {
      // Merge type specific data into common data template
      features[featKey] = mergeObject(
        featureDefaults,
        {
          // Fist generic data derived from the config object
          label: PF1.featTypesPlurals[featKey] ?? featValue,
          dataset: { type: "feat", "type-name": game.i18n.localize(featValue), "feat-type": featKey },
          // Then any specific data explicitly set to override defaults
          ...featData[featKey],
        },
        { inplace: false }
      );
    }

    for (const f of feats) {
      const k = f.data.featType;
      if (f.data.abilityType && f.data.abilityType !== "none") {
        f.abilityType = game.i18n.localize(CONFIG.PF1.abilityTypes[f.data.abilityType].long);
        f.abilityTypeShort = game.i18n.localize(CONFIG.PF1.abilityTypes[f.data.abilityType].short);
      } else {
        f.abilityType = "";
        f.abilityTypeShort = "";
      }
      features[k]?.items?.push(f);
    }
    classes.sort((a, b) => b.level - a.level);
    classes.forEach((item) => {
      if (item.data.classType !== "mythic") item.canLevelUp = true;
    });

    // Buffs
    let buffs = data.items.filter((obj) => {
      return obj.type === "buff";
    });
    buffs = this._filterItems(buffs, this._filters.buffs);
    const buffSections = {
      temp: {
        label: game.i18n.localize("PF1.Temporary"),
        items: [],
        hasActions: false,
        dataset: { type: "buff", "buff-type": "temp" },
      },
      perm: {
        label: game.i18n.localize("PF1.Permanent"),
        items: [],
        hasActions: false,
        dataset: { type: "buff", "buff-type": "perm" },
      },
      item: {
        label: game.i18n.localize("PF1.Item"),
        items: [],
        hasActions: false,
        dataset: { type: "buff", "buff-type": "item" },
      },
      misc: {
        label: game.i18n.localize("PF1.Misc"),
        items: [],
        hasActions: false,
        dataset: { type: "buff", "buff-type": "misc" },
      },
    };

    for (const b of buffs) {
      const s = b.data.buffType;
      if (!buffSections[s]) continue;
      buffSections[s].items.push(b);
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
        dataset: { type: "attack", "attack-type": "weapon" },
      },
      natural: {
        label: game.i18n.localize("PF1.AttackTypeNaturalPlural"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "attack-type": "natural" },
      },
      ability: {
        label: game.i18n.localize("PF1.AttackTypeAbilityPlural"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "attack-type": "ability" },
      },
      racialAbility: {
        label: game.i18n.localize("PF1.AttackTypeRacialPlural"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "attack-type": "racialAbility" },
      },
      item: {
        label: game.i18n.localize("PF1.Items"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "attack-type": "item" },
      },
      misc: {
        label: game.i18n.localize("PF1.Misc"),
        items: [],
        canCreate: true,
        initial: false,
        showTypes: false,
        dataset: { type: "attack", "attack-type": "misc" },
      },
    };

    for (const a of attacks) {
      const s = a.data.attackType;
      if (!attackSections[s]) continue;
      attackSections[s].items.push(a);
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
    const skill = event.currentTarget.parentElement.parentElement.dataset.skill;
    this.document.rollSkill(skill, { event: event, skipDialog: getSkipActionPrompt() });
  }

  _onRollSubSkillCheck(event) {
    event.preventDefault();
    const mainSkill = event.currentTarget.parentElement.parentElement.dataset.mainSkill;
    const skill = event.currentTarget.parentElement.parentElement.dataset.skill;
    this.document.rollSkill(`${mainSkill}.subSkills.${skill}`, { event: event, skipDialog: getSkipActionPrompt() });
  }

  /**
   * Handle opening a skill's compendium entry
   *
   * @param {Event} event   The originating click event
   * @private
   */
  async _onOpenCompendiumEntry(event) {
    const entryKey = event.currentTarget.dataset.compendiumEntry;
    const parts = entryKey.split(".");
    const packKey = parts.slice(0, 2).join(".");
    const entryId = parts.slice(-1)[0];
    const pack = game.packs.get(packKey);
    const entry = await pack.getDocument(entryId);
    entry.sheet.render(true);
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
    this._onSubmit(event, { preventRender: true }); // prevent sheet refresh

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
    const options = {
      name: label.getAttribute("for"),
      title: label.innerText,
      choices: CONFIG.PF1[a.dataset.options],
    };

    const app = Object.values(this.document.apps).find((o) => {
      return o instanceof ActorTraitSelector && o.options.name === options.name && o._element;
    });
    if (app) app.bringToTop();
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
    if (focus && focus.name.match(/^data\.skills\.(?:[a-zA-Z0-9]*)\.name$/)) focus.blur();

    const result = await super._render(...args);

    // Create placeholders
    this._createPlaceholders(this.element);

    // Apply accessibility settings
    applyAccessibilitySettings(this, this.element, {}, game.settings.get("pf1", "accessibilityConfig"));

    return result;
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
      const item = this.document.items.find((o) => o.id === d._id);
      item?.memorizeVariables();
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
    if (!this.document.isOwner) return false;

    const item = await ItemPF.implementation.fromDropData(data);
    const itemData = item.toJSON();

    // Handle item sorting within the same actor
    const sameActor =
      (data.actorId === this.actor.id || (this.actor.isToken && data.tokenId === this.actor.token.id)) &&
      !data.containerId;
    if (sameActor) {
      const dropTarget = event.target.closest("li[data-item-id]");
      if (dropTarget?.dataset?.itemId === item.id) return; // item dropped onto itself
      return this._onSortItem(event, itemData);
    }

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
      data.data.spellbook = this.currentSpellbookKey;
    }
  }

  /**
   * @override
   */
  _getSortSiblings(source) {
    return this.document.items.filter((i) => {
      if (ItemPF.isInventoryItem(source.data.type)) return ItemPF.isInventoryItem(i.data.type);
      return i.data.type === source.data.type && i.data.id !== source.data.id;
    });
  }

  async _onDropItemCreate(itemData) {
    // Import spell as consumable
    if (itemData.type === "spell" && this.currentPrimaryTab !== "spellbook") {
      const resultData = await createConsumableSpellDialog(itemData);
      if (resultData === "spell") {
        // No action here.
      } else if (resultData) return this.document.createEmbeddedDocuments("Item", [resultData]);
      else return false;
    }
    // Choose how to import class
    if (
      itemData.type === "class" &&
      getProperty(itemData, "data.classType") !== "mythic" &&
      !(event && event.shiftKey)
    ) {
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
            classes: ["dialog", "pf1", "add-character-class"],
          }
        ).render(true);
      });
      if (doReturn) return false;
    }

    if (itemData.id) delete itemData.id;
    const actorRef = this.document;
    return this.document.createEmbeddedDocuments("Item", [itemData]).then((createdItem) => {
      const fullItem = actorRef.items.get(createdItem.id);
      return fullItem;
    });
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
      const elem = html.find('input[for="data.details.cr"]');
      elem.attr("value", CR.fromNumber(this.document.data.data.details.cr.base));
      elem.attr("name", "data.details.cr.base");
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
    const cr = formData["data.details.cr.base"];
    if (typeof cr === "string") formData["data.details.cr.base"] = CR.fromString(cr);

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

        if (getProperty(this.document.data, name) !== value) {
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
    const items = this.document.items.filter((o) => o.data.data.price != null);
    const total = items.reduce((cur, i) => {
      return cur + i.getValue({ sellValue: 1, inLowestDenomination: true });
    }, 0);
    return inLowestDenomination ? total : total / 100;
  }

  calculateSellItemValue({ inLowestDenomination = false } = {}) {
    const items = this.document.items.filter((o) => o.data.data.price != null);
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
