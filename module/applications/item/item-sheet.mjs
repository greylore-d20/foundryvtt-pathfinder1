import {
  adjustNumberByStringCommand,
  getBuffTargetDictionary,
  getBuffTargets,
  enrichHTMLUnrolledAsync,
  naturalSort,
} from "@utils";
import { ItemPF } from "@item/item-pf.mjs";
import { ActorTraitSelector } from "@app/trait-selector.mjs";
import { SpeedEditor } from "@app/speed-editor.mjs";
import { Widget_CategorizedItemPicker } from "@app/categorized-item-picker.mjs";
import { getSkipActionPrompt } from "../../documents/settings.mjs";
import { renderCachedTemplate } from "@utils/handlebars/templates.mjs";

/**
 * Override and extend the core ItemSheet implementation to handle game system specific item types
 *
 * @type {ItemSheet}
 */
export class ItemSheetPF extends ItemSheet {
  constructor(...args) {
    super(...args);

    // Add item type to selectors
    this.options.classes.push(`type-${this.item.type}`);

    this.items = [];

    /**
     * Track action updates from the item sheet.
     *
     * @property
     * @private
     * @type {object[]}
     */
    this._actionUpdates = [];

    // Activate more reasonable default links sub-tab per item type.
    // Related core issue: https://github.com/foundryvtt/foundryvtt/issues/9748
    const links = this._tabs.find((t) => t.group === "links");
    if (this.item.type === "class") {
      links.active = "classAssociations";
    } else if (["feat", "consumable", "attack", "equipment"].includes(this.item.type)) {
      links.active = "charges";
    }
  }

  /* -------------------------------------------- */

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 620,
      classes: ["pf1", "sheet", "item"],
      scrollY: [".tab", ".buff-flags", ".editor-content"],
      dragDrop: [
        {
          dragSelector: "li.action-part",
          dropSelector: ".tab.details",
        },
        {
          dragSelector: ".tab.changes li.change",
          dropSelector: null,
        },
        {
          dragSelector: ".tab.links .item-name",
          dropSelector: ".tab.links .tab[data-group='links']",
        },
      ],
      tabs: [
        {
          navSelector: "nav.tabs[data-group='primary']",
          contentSelector: "section.primary-body",
          initial: "description",
          group: "primary",
        },
        {
          navSelector: "nav.tabs[data-group='links']",
          contentSelector: "section.links-body",
          initial: "children",
          group: "links",
        },
        {
          navSelector: "nav.tabs[data-group='description']",
          contentSelector: "section.description-body",
          initial: "identified",
          group: "description",
        },
      ],
    });
  }

  /* -------------------------------------------- */

  /**
   * Return a dynamic reference to the HTML template path used to render this Item Sheet
   *
   * @returns {string}
   */
  get template() {
    const path = "systems/pf1/templates/items";
    return `${path}/${this.item.type}.hbs`;
  }

  get title() {
    const actor = this.actor;
    if (actor) return `${super.title} – ${actor.name}`;
    return super.title;
  }

  /* -------------------------------------------- */

  /**
   * Prepare item sheet data
   * Start with the base item data and extending with additional properties for rendering.
   */
  async getData() {
    const lang = game.settings.get("core", "language");

    /** @type {ItemPF} */
    const item = this.item,
      itemData = item.system;

    const actor = item.actor,
      actorData = actor?.system;

    const defaultAction = item.defaultAction;

    const rollData = defaultAction?.getRollData() ?? item.getRollData();

    const context = {
      cssClass: this.isEditable ? "editable" : "locked",
      item,
      document: item, // Reference used by unknown data
      name: item.name,
      system: itemData,
      itemType: game.i18n.localize(CONFIG.Item.typeLabels[item.type]),
      rollData,
      config: pf1.config,
      owned: !!actor,
      owner: item.isOwner,
      editable: this.isEditable,
      isGM: game.user.isGM,
      labels: item.getLabels({ rollData }),
      canClassLink: pf1.config.classAssociations.includes(item.type) && !!rollData.classes,
      inContainer: item.inContainer ?? false,
      // Include raw tag data (from source to not get autofilled tag)
      tag: this.item._source.system.tag,
    };

    // Item type identifiers
    const isPhysical = item.isPhysical;
    const isWeapon = item.type === "weapon";
    const isAttack = item.type === "attack";
    const isWeaponLike = isAttack && item.subType === "weapon";
    const isNaturalAttack = isAttack && itemData.subType === "natural";
    const isClass = item.type === "class";
    const isSpell = item.type === "spell";
    const isImplant = item.type === "implant";
    const isEquipment = item.type === "equipment";

    context.isPhysical = isPhysical;
    context.isWeapon = isWeapon;
    context.isAttack = isAttack;
    context.isWeaponLike = isWeaponLike;
    context.isNaturalAttack = isNaturalAttack;
    context.isClass = isClass;
    context.isSpell = isSpell;
    context.isImplant = isImplant;
    context.isEquipment = isEquipment;

    if (context.canClassLink) {
      context.hasClassLink = !!item.system.class;
      context.classes = {};
      for (const [classTag, classData] of Object.entries(rollData.classes)) {
        context.classes[classTag] = classData.name;
      }
    }

    // Include sub-items
    context.items = item.items?.map((i) => i.toObject()) ?? [];

    // Add hit die size options for classes
    if (isClass) {
      context.hitDieSizes = context.config.hitDieSizes.reduce((all, size) => {
        all[size] = game.i18n.format("PF1.DieSize", { size });
        return all;
      }, {});

      context.isMythic = this.item.subType === "mythic";

      if (item.system.wealth) {
        const context = { formula: item.system.wealth, item: this.item };
        const max = Roll.defaultImplementation.safeRollSync(item.system.wealth, undefined, context, undefined, {
          maximize: true,
        })?.total;
        const min = Roll.defaultImplementation.safeRollSync(item.system.wealth, undefined, context, undefined, {
          minimize: true,
        })?.total;
        if (max > 0) {
          context.wealth ??= {};
          context.wealth.average = (max + min) / 2;
        }
      }
    }

    if (item.links.charges) context.inheritCharges = item.links.charges;
    context.isCharged = !["single", "", undefined].includes(itemData.uses?.per);
    context.defaultChargeFormula = item.getDefaultChargeFormula();

    context.limitedUsePeriods = { ...pf1.config.limitedUsePeriods };
    if (!item.isPhysical) delete context.limitedUsePeriods.single;
    context.isRechargeable = pf1.config.limitedUsePeriodOrder.includes(itemData.uses?.per);

    context.isActivatable = !["race", "class", "container", "loot"].includes(item.type);
    context.hasAction = item.hasAction;
    context.hasAttack = item.hasAttack;
    context.hasDamage = item.hasDamage;
    context.showBothDescriptions = context.isGM && context.isPhysical;
    context.showUnidentifiedData = item.showUnidentifiedData;
    context.showIdentified = !item.showUnidentifiedData;
    context.showIdentifiedData = context.showIdentified;
    if (context.showIdentified && context.isPhysical) context.showBothDescriptions = true;
    context.unchainedActionEconomy = game.settings.get("pf1", "unchainedActionEconomy");

    // Identification information
    context.identify ??= {};
    context.identify.dc = 0;
    const auraStrength = rollData.item.auraStrength;
    if (auraStrength) {
      context.aura = {
        strength: auraStrength,
        strengthLabel: pf1.config.auraStrengths[auraStrength],
        school:
          pf1.config.spellSchools[itemData.aura.school] || itemData.aura.school || game.i18n.localize("PF1.Unknown"),
      };

      context.identify.dc = 15 + rollData.item.cl;
      context.identify.curse = context.identify.dc + 10;
    }

    // Add spellcasting configuration
    if (isClass) {
      context.casting = {
        types: pf1.config.spellcasting.type,
        spells: pf1.config.spellcasting.spells,
        progression: {
          high: "PF1.High",
          med: "PF1.Medium",
          low: "PF1.Low",
        },
      };

      if (!item.actor) context.hasSpellbook = true; // Not true, but avoids unwanted behaviour.
      else {
        context.hasSpellbook = Object.values(rollData.spells ?? {}).find(
          (book) => !!book.class && book.class === itemData.tag && book.inUse
        );
      }
    }

    /** @type {DescriptionAttribute[]} */
    context.descriptionAttributes = [];

    // Override description attributes
    if (context.isPhysical) {
      // Add quantity
      context.descriptionAttributes.push({
        isNumber: true,
        name: "system.quantity",
        label: game.i18n.localize("PF1.Quantity"),
        value: itemData.quantity || 0,
        decimals: 0,
        id: "data-quantity",
        constraints: {
          min: 0,
          step: 1,
        },
      });

      // Add weight
      context.descriptionAttributes.push({
        isNumber: true,
        name: "system.weight.value",
        label: game.i18n.localize("PF1.Weight"),
        value: itemData.weight.converted.total,
        fakeValue: true,
        inputValue: itemData.weight.converted.value,
        decimals: 2,
        tooltip: "weight",
        id: "data-weight-value",
        constraints: {
          min: 0,
          step: 0.01,
        },
      });

      // Add price
      if (context.isGM) {
        context.descriptionAttributes.push(
          {
            isNumber: true,
            name: "system.price",
            label: game.i18n.localize("PF1.Price"),
            value: item.getValue({ sellValue: 1 }),
            decimals: 2,
            tooltip: "price",
            id: "data-price",
            constraints: {
              min: 0,
              step: 0.01,
            },
          },
          {
            isNumber: true,
            name: "system.unidentified.price",
            label: game.i18n.localize("PF1.UnidentifiedPriceShort"),
            value: item.getValue({ sellValue: 1, forceUnidentified: true }),
            decimals: 2,
            id: "data-unidentifiedPrice",
            constraints: {
              min: 0,
              step: 0.01,
            },
          }
        );
      } else if (context.showUnidentifiedData) {
        context.descriptionAttributes.push({
          isNumber: true,
          name: "system.unidentified.price",
          fakeName: true,
          label: game.i18n.localize("PF1.Price"),
          value: item.getValue({ sellValue: 1 }),
          decimals: 2,
          tooltip: "price",
          id: "data-price",
          constraints: {
            min: 0,
            step: 0.01,
          },
        });
      } else {
        context.descriptionAttributes.push({
          isNumber: true,
          name: "system.price",
          label: game.i18n.localize("PF1.Price"),
          value: item.getValue({ sellValue: 1 }),
          decimals: 2,
          tooltip: "price",
          id: "data-price",
          constraints: {
            min: 0,
            step: 0.01,
          },
        });
      }

      // Add hit points
      if (!context.isImplant) {
        context.descriptionAttributes.push({
          isNumber: true,
          isRange: true,
          label: game.i18n.localize("PF1.HPShort"),
          value: {
            name: "system.hp.value",
            value: itemData.hp?.value || 0,
            constraints: {
              step: 1,
              max: itemData.hp?.max || 0,
            },
          },
          max: {
            name: "system.hp.max",
            value: itemData.hp?.max || 0,
            constraints: {
              min: 0,
              step: 1,
            },
          },
        });

        // Add hardness
        context.descriptionAttributes.push({
          isNumber: true,
          label: game.i18n.localize("PF1.Hardness"),
          name: "system.hardness",
          decimals: 0,
          value: itemData.hardness || 0,
          constraints: {
            min: 0,
            step: 1,
          },
        });
      }

      let disableEquipping = false;
      if (item.inContainer) {
        if (item.canEquip === false) disableEquipping = true;
        else if (context.isImplant) disableEquipping = true;
      }

      // Add equipped/implanted flag
      if (context.isImplant) {
        context.descriptionAttributes.push({
          isBoolean: true,
          name: "system.implanted",
          label: game.i18n.localize("PF1.Implanted"),
          value: itemData.implanted,
          disabled: disableEquipping,
        });
      } else {
        // Certain loot types don't have equipped
        if (item.type === "loot" && pf1.config.unequippableLoot.includes(this.item.subType)) disableEquipping = true;

        context.descriptionAttributes.push({
          isBoolean: true,
          name: "system.equipped",
          label: game.i18n.localize("PF1.Equipped"),
          value: itemData.equipped,
          disabled: disableEquipping,
        });
      }

      // Add carried flag
      context.descriptionAttributes.push({
        isBoolean: true,
        name: "system.carried",
        label: game.i18n.localize("PF1.Carried"),
        value: itemData.carried || item.system.implanted || false,
        disabled: item.inContainer || item.system.implanted || false,
      });
    }

    if (context.isPhysical || item.isQuasiPhysical) {
      // Add broken flag
      if (!context.isImplant) {
        context.descriptionAttributes.push({
          isBoolean: true,
          name: "system.broken",
          label: game.i18n.localize("PF1.Broken"),
          value: itemData.broken,
          disabled: context.isNaturalAttack,
        });
      }

      // Add masterwork flag
      if (!context.isImplant) {
        context.descriptionAttributes.push({
          isBoolean: true,
          name: "system.masterwork",
          label: game.i18n.localize("PF1.Masterwork"),
          value: itemData.masterwork,
          disabled: context.isNaturalAttack,
        });
      }
    }

    if (context.isPhysical) {
      // Add identified flag for GM
      if (game.user.isGM) {
        context.descriptionAttributes.push({
          isBoolean: true,
          name: "system.identified",
          label: game.i18n.localize("PF1.Identified"),
          value: itemData.identified ?? true,
          disabled: !game.user.isGM,
        });
      }
    }

    // Prepare feat specific stuff
    if (item.type === "feat") {
      context.isClassFeature = itemData.subType === "classFeat";
      context.isTemplate = itemData.subType === "template";

      context.abilityTypes = Object.fromEntries(
        Object.entries(pf1.config.abilityTypes).map(([key, { short, long }]) => [key, `${long} (${short})`])
      );
    }

    // Add skill list to items that support them
    // TODO: Make this ask the item itself if they have class skills
    if (itemData.classSkills || ["class", "feat", "race"].includes(item.type)) {
      const classSkills = itemData.classSkills ?? {};
      // Get all skills
      const skills = foundry.utils.mergeObject(pf1.config.skills, actorData?.skills ?? {}, { inplace: false });
      // Build skill context
      context.skills = Object.entries(skills)
        .map(([skillId, skilldata]) => ({
          ...skilldata,
          key: skillId,
          name: pf1.config.skills[skillId] || skilldata.name,
          isCS: classSkills[skillId] === true,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    // Prepare attack-specific stuff
    if (isAttack) {
      const wtype = (isWeaponLike ? itemData.weapon?.type : null) || "all";
      context.materialCategories = this._prepareMaterialsAndAddons(item);

      context.alignmentTypes = this._prepareAlignments(itemData.alignments);
    }

    const material = isEquipment ? this.item.system.armor?.material : this.item.system.material;
    if (material?.addon?.length) {
      context.materialAddons =
        material.addon.reduce((obj, v) => {
          obj[v] = true;
          return obj;
        }, {}) ?? {};
    }

    // Prepare categories for weapons
    if (isWeaponLike) {
      itemData.weapon ??= {};
      itemData.weapon.category ||= "simple";
      itemData.weapon.type ||= "1h";
    }

    // Prepare weapon specific stuff
    if (isWeapon || isWeaponLike) {
      const category = isWeapon ? itemData.subType : itemData.weapon.category;
      const wsubtype = isWeapon ? itemData.weaponSubtype : itemData.weapon.type;

      switch (category) {
        case "siege":
          context.isRanged = ["direct", "indirect"].includes(wsubtype);
          break;
        case "heavy":
        case "firearm":
          context.isRanged = true;
          break;
        default:
          context.isRanged = wsubtype === "ranged" || itemData.properties?.["thr"] === true;
          break;
      }
    }

    if (isWeapon || isWeaponLike) {
      context.weaponCategories = { types: {}, subTypes: {} };
      for (const [k, v] of Object.entries(pf1.config.weaponTypes)) {
        context.weaponCategories.types[k] = v._label;
      }
      let type;
      if (isWeapon) type = itemData.subType;
      else if (isWeaponLike) type = itemData.weapon?.category;

      if (type in pf1.config.weaponTypes) {
        for (const [k, v] of Object.entries(pf1.config.weaponTypes[type])) {
          // Add static targets
          if (!k.startsWith("_")) context.weaponCategories.subTypes[k] = v;
        }
      }
    }

    if (isWeapon) {
      context.materialCategories = this._prepareMaterialsAndAddons(item);

      context.alignmentTypes = this._prepareAlignments(itemData.alignments);
    }

    // Prepare equipment specific stuff
    if (isEquipment) {
      // Prepare categories for equipment
      context.equipmentCategories = { types: {}, subTypes: {} };
      for (const [k, v] of Object.entries(pf1.config.equipmentTypes)) {
        context.equipmentCategories.types[k] = v._label;
      }
      const subType = itemData.subType;
      if (subType in pf1.config.equipmentTypes) {
        for (const [k, v] of Object.entries(pf1.config.equipmentTypes[subType])) {
          // Add static targets
          if (!k.startsWith("_")) context.equipmentCategories.subTypes[k] = v;
        }
      }

      // Prepare slots for equipment
      context.equipmentSlots = pf1.config.equipmentSlots.wondrous;

      // Whether the current equipment type has multiple slots
      context.hasMultipleSlots = item.hasSlots;

      context.hasSubCategory = ["armor", "shield"].includes(subType);

      // Prepare materials where they're needed.
      if (["armor", "shield"].includes(item.subType)) {
        context.materialCategories = this._prepareMaterialsAndAddons(item);
      }
    }

    if (isImplant) {
      context.subTypes = pf1.config.implantTypes;

      context.isCybertech = item.subType === "cybertech";
      if (context.isCybertech) context.slots = pf1.config.implantSlots.cybertech;
    }

    let topDescription;

    // Prepare spell specific stuff
    if (context.isSpell) {
      let spellbook = null;
      if (actor) {
        const bookId = itemData.spellbook;
        spellbook = actorData?.attributes.spells?.spellbooks[bookId];
      }

      context.isSpontaneousLike = spellbook?.spontaneous || spellbook?.spellPoints?.useSystem || false;
      context.isPreparedSpell = !context.isSpontaneousLike;
      context.usesSpellpoints = spellbook != null ? spellbook.spellPoints?.useSystem ?? false : false;
      context.isAtWill = itemData.atWill;
      context.spellbooks = actorData?.attributes.spells.spellbooks ?? {};
      context.spellbookChoices = Object.fromEntries(
        Object.entries(context.spellbooks)
          .filter(([_, { inUse }]) => inUse)
          .map(([key, { label }]) => [key, label])
          .sort(([_0, n0], [_1, n1]) => n0.localeCompare(n1, lang))
      );

      topDescription = renderCachedTemplate(
        "systems/pf1/templates/internal/spell-description.hbs",
        item.getDescriptionData({ rollData })
      );

      // Reverse mapping of pf1.config.divineFocus for readability
      const dfVariants = { DF: 1, MDF: 2, FDF: 3 };
      itemData.components ??= {};
      const df = itemData.components.divineFocus;
      // Force intrinsic DF components
      if (df === dfVariants.MDF) itemData.components.material = true;
      if (df === dfVariants.FDF) itemData.components.focus = true;

      // Generate component list according to spellbook
      const c = { ...itemData.components };
      context.components = c;
      if (spellbook) {
        const isDivine = spellbook.kind === "divine";
        if (isDivine) {
          if (df === dfVariants.FDF) c.focus = false;
          if (df === dfVariants.MDF) c.material = false;
        } else {
          c.divineFocus = false;
        }
      }

      // Material for spells to emulate
      context.materialCategories = this._prepareMaterialsAndAddons(item);

      context.alignmentTypes = this._prepareAlignments(itemData.alignments);
    }

    if (this.item.type === "buff") {
      context.noDurationTiming = !itemData.duration.units || itemData.duration.units === "turn";
    }

    // Prepare class specific stuff
    if (isClass) {
      context.isMythicPath = itemData.subType === "mythic";

      for (const [a, s] of Object.entries(itemData.savingThrows)) {
        s.label = pf1.config.savingThrows[a];
      }
      for (const [a, s] of Object.entries(itemData.fc)) {
        s.label = pf1.config.favouredClassBonuses[a];
      }

      context.isBaselikeClass = pf1.config.favoredClassTypes.includes(itemData.subType);
      context.isRacialHD = itemData.subType === "racial";
      context.isNPCClass = itemData.subType === "npc";
      context.isPCClass = !context.isNPCClass && !context.isRacialHD;

      const healthConfig = game.settings.get("pf1", "healthConfig");
      context.healthConfig = healthConfig.getClassHD(this.item);
    }

    if (item.type === "consumable") {
      context.hasSpellType = ["potion", "scroll", "wand", "staff"].includes(item.subType);
    }

    // Prepare ammunition
    context.canUseAmmo = !context.isNaturalAttack && item.type !== "spell";
    if (context.canUseAmmo && item.system.ammo?.type) {
      context.defaultAmmo = actor?.items.get(item.getFlag("pf1", "defaultAmmo"));
      if (context.defaultAmmo) {
        context.invalidDefaultAmmo = context.defaultAmmo.system.extraType !== item.system.ammo.type;
      }
    }

    // Prepare {value: [], custom: []} objects
    const profs = {
      armorProf: pf1.config.armorProficiencies,
      descriptors: pf1.config.spellDescriptors,
      languages: pf1.config.languages,
      weaponGroups: pf1.config.weaponGroups,
      weaponProf: pf1.config.weaponProficiencies,
    };

    for (const [t, choices] of Object.entries(profs)) {
      if (!itemData[t]) continue;

      const trait = foundry.utils.deepClone(itemData[t]);
      context[t] = trait;

      let values = [];
      if (trait.value) {
        values = trait.value instanceof Array ? trait.value : [trait.value];
      }
      trait.selected = values.reduce((obj, t) => {
        obj[t] = choices[t];
        return obj;
      }, {});

      // Add custom entry
      if (trait.custom?.length) {
        trait.custom.forEach((c, i) => (trait.selected[`custom${i + 1}`] = c));
      }
      trait.active = !foundry.utils.isEmpty(trait.selected);
    }

    // Prepare stuff for changes
    if (item.changes?.size) {
      const buffTargets = getBuffTargets("buffs", { actor, item });
      let showPriority = false;
      context.changes =
        item.changes?.map((/** @type {ItemChange} */ ch) => {
          const target = buffTargets[ch.target];
          const typeLabel = pf1.config.bonusTypes[ch.type];
          const chData = {
            change: ch,
            isValid: !!target,
            label: target?.label ?? ch.target,
            isDeferred: ch.isDeferred,
            isAdd: ch.operator === "add",
            isSet: ch.operator === "set",
            ...ch,
            isValidType: !!typeLabel,
            typeLabel: typeLabel || ch.type,
            id: ch.id,
          };
          chData.priority ||= 0;
          if (chData.priority != 0) showPriority = true;
          return chData;
        }) ?? [];

      context.changePriority = showPriority;
    }

    // Prepare stuff for items with context notes
    if (itemData.contextNotes) {
      // TODO: Remove .toObject() and move the supporting data to the datamodel
      context.contextNotes = itemData.contextNotes.map((cn) => cn.toObject());
      const noteTargets = getBuffTargets("contextNotes", { actor, item });
      context.contextNotes.forEach((n) => {
        const target = noteTargets[n.target];
        n.isValid = !!target;
        n.label = target?.label ?? n.target;
      });
    }

    // Prepare condition display
    context.conditions = item.effects
      .filter((e) => !e.disabled && e.statuses.size)
      .map((e) => Array.from(e.statuses))
      .flat()
      .map((s) => pf1.registry.conditions.get(s)?.name || s);

    if (item.system.conditions?.all?.size) {
      context.system.conditions.selected = item.system.conditions?.all?.map(
        (c) => pf1.registry.conditions.get(c)?.name || c
      );

      context.conditions = context.conditions.concat(Array.from(context.system.conditions.selected));
    }

    context.conditions = new Set(context.conditions.sort((a, b) => a.localeCompare(b)));

    // Add distance units
    context.distanceUnits = foundry.utils.deepClone(pf1.config.distanceUnits);
    if (item.type !== "spell") {
      for (const d of ["close", "medium", "long"]) {
        delete context.distanceUnits[d];
      }
    }

    // Parse notes
    if (itemData.attackNotes) {
      const value = itemData.attackNotes;
      foundry.utils.setProperty(context, "notes.attack", value);
    }

    // Add item flags
    this._prepareItemFlags(context);

    // Add actions
    context.actions = this.item.actions;

    context.distanceUnit = game.i18n.localize(
      pf1.utils.getDistanceSystem() === "imperial" ? "PF1.Distance.ftShort" : "PF1.Distance.mShort"
    );

    // Prepare speeds
    if (item.type === "race") {
      context.speeds = [];
      for (const key of ["land", "fly", "swim", "climb", "burrow"]) {
        const value = item.system.speeds?.[key] ?? 0;
        if (value == 0) continue;
        let descriptor;
        if (key === "fly") {
          const fm = item.system.speeds.flyManeuverability || "average";
          descriptor = `PF1.Movement.FlyManeuverability.Quality.${fm}`;
        }
        context.speeds.push({
          value: pf1.utils.convertDistance(value)[0],
          mode: key,
          label: `PF1.Movement.Mode.${key}`,
          descriptor,
        });
      }
    }

    // Content source, fill in from registry
    if (context.showIdentifiedData) {
      this._prepareContentSource(context);
    }

    // Trailing async awaits to ensure they're all awaited in one go instead of sequentially

    // Add descriptions
    const description = context.showIdentified ? this.item.getDescription({ rollData, header: false }) : null;

    context.descriptionHTML = {
      identified: null,
      unidentified: null,
    };
    const enrichOptions = {
      secrets: context.owner,
      rollData: rollData,
      relativeTo: this.actor,
    };
    const pIdentDesc = description ? enrichHTMLUnrolledAsync(description, enrichOptions) : Promise.resolve();
    pIdentDesc.then((html) => (context.descriptionHTML.identified = html));
    const unidentDesc = itemData.description?.unidentified;
    const pUnidentDesc = unidentDesc ? enrichHTMLUnrolledAsync(unidentDesc, enrichOptions) : Promise.resolve();
    pUnidentDesc.then((html) => (context.descriptionHTML.unidentified = html));

    const pTopDesc = topDescription
      ? TextEditor.enrichHTML(topDescription, {
          rollData,
          relativeTo: this.actor,
        })
      : Promise.resolve();
    pTopDesc.then((html) => (context.topDescription = html));

    // Add script calls
    const pScripts = this._prepareScriptCalls(context);

    // Add links
    const pLinks = this._prepareLinks(context);

    await Promise.all([pIdentDesc, pUnidentDesc, pTopDesc, pScripts, pLinks]);

    return context;
  }

  _prepareContentSource(context) {
    const sources = this._getContentSources();
    if (sources.length == 0) return;

    const main = this._selectContentSource(sources);

    context.bookSources = {
      all: sources,
      main,
    };

    if (sources.length > 1) {
      context.bookSources.extras = sources.filter((s) => s !== main);
    }
  }

  _selectContentSource(sources) {
    if (sources?.length === 0) return null;

    sources.sort((a, b) => b.datestamp - a.datestamp);

    return sources[0];
  }

  _getContentSources() {
    const sources = this.item.system.sources ?? [];

    return sources.map((source) => {
      const registry = pf1.registry.sources.get(source?.id) ?? {};
      const { publisher, date, abbr, name, edition } = registry;

      return {
        publisher,
        date,
        abbr,
        name,
        edition,
        ...source,
        title: source.title || registry.name,
        registry,
        datestamp: Date.parse(source.date || registry.date),
      };
    });
  }

  _prepareMaterialsAndAddons(item) {
    const materialList = {};
    const addonList = [];
    const basicList = {};

    naturalSort([...pf1.registry.materials], "name").forEach((material) => {
      if (material.basic) {
        // Filter basic materials
        basicList[material.id] = material.name;
      } else {
        const isAllowed = material.isAllowed(item);
        if (!isAllowed) return;

        if (!material.addon) {
          materialList[material.id] = material.name;
        } else {
          addonList.push({ key: material.id, name: material.name });
        }
      }
    });

    return {
      materials: materialList,
      addons: addonList,
      basics: basicList,
    };
  }

  _prepareAlignments(alignments) {
    const alignmentChoices = {};

    Object.keys(pf1.config.damageResistances).forEach((dType) => {
      if (!["magic", "epic"].includes(dType)) alignmentChoices[dType] = pf1.config.damageResistances[dType];
    });

    return {
      choices: alignmentChoices,
      values: foundry.utils.deepClone(alignments),
    };
  }

  _prepareLinks(context) {
    context.links = {
      list: [],
    };

    // Add charges link type
    if (["feat", "consumable", "attack", "equipment"].includes(this.item.type)) {
      context.links.list.push({
        id: "charges",
        label: game.i18n.localize("PF1.LinkTypeCharges"),
        help: game.i18n.localize("PF1.LinkHelpCharges"),
        items: [],
      });
    }

    // Add class associations
    if (context.isClass) {
      context.links.list.push({
        id: "classAssociations",
        label: game.i18n.localize("PF1.LinkTypeClassAssociations"),
        help: game.i18n.localize("PF1.LinkHelpClassAssociations"),
        fields: {
          level: {
            type: "Number",
            label: game.i18n.localize("PF1.Level"),
          },
        },
        items: [],
      });
    }

    // Add children link type
    context.links.list.push({
      id: "children",
      label: game.i18n.localize("PF1.LinkTypeChildren"),
      help: game.i18n.localize("PF1.LinkHelpChildren"),
      items: [],
    });

    context.links.list.push({
      id: "supplements",
      label: game.i18n.localize("PF1.LinkTypeSupplements"),
      help: game.i18n.localize("PF1.LinkHelpSupplements"),
      fields: {
        /*
        // TODO: Add child link creation toggle
        asChild: {
          type: "Boolean",
          label: game.i18n.localize("PF1.AsChild"),
        },
        */
      },
      items: [],
    });

    // Post process data
    const item = this.item,
      actor = item.actor;
    for (const links of context.links.list) {
      const items = item.system.links?.[links.id] || [];
      for (let index = 0; index < items.length; index++) {
        const linkData = foundry.utils.deepClone(items[index]);
        linkData.index = index; // Record index so sorted lists maintain data cohesion

        const linkedItem = fromUuidSync(linkData.uuid, { relative: actor });
        if (!linkedItem) linkData.broken = true;
        linkData.img = linkedItem?.img || Item.implementation.getDefaultArtwork(linkedItem);

        // Fill in name if it's not in the local data
        linkData.name ||= linkedItem?.name;

        // Add item to stack
        links.items.push(linkData);
      }
    }
  }

  _prepareItemFlags(context) {
    const flags = context.system.flags ?? {};
    context.flags ??= {};
    context.flags.boolean = flags.boolean ?? {};
    context.flags.dictionary = flags.dictionary ?? {};
  }

  async _prepareScriptCalls(context) {
    context.scriptCalls = null;

    const categories = pf1.registry.scriptCalls.filter((category) => {
      if (!category.itemTypes.includes(this.item.type)) return false;
      return !(category.hidden === true && !game.user.isGM);
    });
    // Don't show the Script Calls section if there are no categories for this item type
    if (!categories.length) return;

    context.scriptCalls = {};

    // Iterate over all script calls, and adjust data
    const scriptCalls = this.item.scriptCalls ?? [];

    // Create categories, and assign items to them
    for (const { id, name, info } of categories) {
      context.scriptCalls[id] = {
        name,
        tooltip: info,
        items: scriptCalls.filter((sc) => sc.category === id && !sc.hide),
        dataset: {
          category: id,
        },
      };
    }
  }

  /* -------------------------------------------- */
  /*  Form Submission                             */
  /* -------------------------------------------- */

  /**
   * Extend the parent class _updateObject method to ensure that damage ends up in an Array
   *
   * @param event
   * @param formData
   * @private
   */
  async _updateObject(event, formData) {
    formData = foundry.utils.expandObject(formData);

    const system = formData.system;
    const links = system.links;

    if (links) {
      const oldLinks = this.item.system?.links ?? {};
      // Handle links arrays
      for (const [linkType, typedLinks] of Object.entries(links)) {
        if (Array.isArray(typedLinks)) continue; // Already handled by something else

        // Maintain array and merge new data in
        links[linkType] = foundry.utils.deepClone(oldLinks[linkType] ?? []);
        for (const [index, linkData] of Object.entries(typedLinks)) {
          links[linkType][index] = foundry.utils.mergeObject(links[linkType][index] ?? {}, linkData);
        }
      }
    }

    // Ensure values are stored as lbs
    if (system.weight) {
      if (system.weight?.value !== undefined) {
        const wmult = this.item.getWeightMultiplier();
        system.weight.value = pf1.utils.convertWeightBack(system.weight.value / wmult);
      }
      if (system.weight.reduction?.value !== undefined) {
        system.weight.reduction.value = pf1.utils.convertWeightBack(system.weight.reduction.value);
      }
    }

    // Change currencies with relative values
    // @TODO: Create a common relative input handler.
    const relativeKeys = ["currency.pp", "currency.gp", "currency.sp", "currency.cp"];
    for (const key of relativeKeys) {
      const value = foundry.utils.getProperty(system, key);
      if (typeof value !== "string") continue;

      // Add or subtract values
      let newValue;
      if (value.match(/(\+|-)(\d+)/)) {
        const operator = RegExp.$1;
        let value = parseInt(RegExp.$2);
        if (operator === "-") value = -value;
        const originalValue = foundry.utils.getProperty(this.item.system, key);
        newValue = originalValue + value;
      } else if (value.match(/^[0-9]+$/)) {
        newValue = parseInt(value);
      } else if (value === "") {
        newValue = 0;
      } else {
        // Invalid strings
        newValue = 0;
        // Trigger warning for bad value
        if (event.target.name === `system.${key}`) {
          event.target.setCustomValidity(game.i18n.localize("PF1.Warning.InvalidInput"));
        }
      }

      foundry.utils.setProperty(system, key, Math.max(0, newValue));
    }

    // Adjust Material Addons
    // The available addons can change depending in the chosen material,
    // so we need to get the values to build the addons on the item.
    const material = this.item.type === "equipment" ? system.armor?.material : system.material;
    if (material?.addon) {
      // Convert to array
      material.addon = Object.entries(material.addon)
        .filter(([_, chosen]) => chosen)
        .map(([key]) => key);
    }

    // Update the Item
    return super._updateObject(event, formData);
  }

  /* -------------------------------------------- */

  _onHoverTooltip(event) {
    const type = event.target.dataset.tooltipType;
    const content = [];
    switch (type) {
      case "weight":
        this._onHoverWeightTooltip(event, content);
        break;
      case "price":
        this._onHoverPriceTooltip(event, content);
        break;
    }
    return content.join("<br>");
  }

  _onHoverWeightTooltip(event, content) {
    const unit = game.i18n.localize(pf1.utils.getWeightSystem() === "metric" ? "PF1.Kgs" : "PF1.Lbs");
    // TODO: better i18n support
    const mValue = `${this.item.system.weight.converted.value} ${unit}`;

    content.push(game.i18n.format("PF1.StackDetails.Base", { value: mValue }));
  }

  _onHoverPriceTooltip(event, content) {
    const cp = this.item.getValue({ sellValue: 1, single: true, inLowestDenomination: true });
    const c = pf1.utils.currency.split(cp);
    const inline = [];
    Object.entries(c).forEach(([key, value]) => {
      if (value > 0) inline.push(game.i18n.format(`PF1.Currency.Inline.${key}`, { value }));
    });

    content.push(game.i18n.format("PF1.StackDetails.Base", { value: inline.join(", ") }));
  }

  /**
   * Validate input formula for basic errors.
   *
   * @internal
   * @param {HTMLElement} el
   */
  async _validateFormula(el) {
    const formula = el.value;
    if (!formula) return;

    let roll;
    // Test if formula even works
    try {
      roll = Roll.create(formula || "0");
      await roll.evaluate();
    } catch (e) {
      el.dataset.tooltip = e.message;
      el.classList.add("invalid");
      el.setCustomValidity(e.message);
      return;
    }

    // Formulas not meant for checks or other rolls must be deterministic
    // TODO: Make this selection better
    if (!el.classList.contains("roll")) {
      if (!roll.isDeterministic) {
        el.dataset.tooltip = "PF1.Warning.FormulaMustBeDeterministic";
        el.classList.add("invalid");
        el.setCustomValidity(game.i18n.localize("PF1.Warning.FormulaMustBeDeterministic"));
      }
    }
  }

  /**
   * Activate listeners for interactive item sheet events
   *
   * @param {JQuery<HTMLElement>} html
   */
  activateListeners(html) {
    super.activateListeners(html);

    const hasActor = !!this.actor;

    if (this.item.isPhysical) {
      html.find(".details-tooptip").each((i, el) => {
        el.addEventListener(
          "pointermove",
          (ev) => {
            const content = this._onHoverTooltip(ev);
            if (content) {
              game.tooltip.activate(el, {
                text: content,
                direction: TooltipManager.TOOLTIP_DIRECTIONS.RIGHT,
                cssClass: "pf1",
              });
            }
          },
          { passive: true }
        );
        el.addEventListener("pointerleave", (ev) => game.tooltip.deactivate(), { passive: true });
      });
    }

    // Tooltips
    html.mousemove((ev) => this._moveTooltips(ev));

    // Action interactions
    html
      .find(".actions .item-list .item .item-name")
      // Edit action
      .on("contextmenu", this._onActionEdit.bind(this))
      // Action summaries
      .on("click", this._onActionSummary.bind(this));

    // Action control
    html.find(".actions .action-controls a").on("click", this._onActionControl.bind(this));

    // Open help browser
    html.find("a.help-browser[data-url]").click(this._openHelpBrowser.bind(this));

    // Open entry/trait editor/viewer
    html.find(".entry-selector").click(this._onEntrySelector.bind(this));
    html.find(".trait-selector").click(this._onTraitSelector.bind(this));

    // Content source editor
    html
      .find(".content-source .control a.edit")
      .click(() => pf1.applications.ContentSourceEditor.open(this.item, { editable: this.isEditable }));

    // Mark proficiency in indeterminate state if not forced but actor has it.
    if (
      hasActor &&
      this.item.system.proficient !== true &&
      ["weapon", "equipment", "attack"].includes(this.item.type)
    ) {
      if (this.item.isProficient) {
        const proficiency = html.find("input[name='system.proficient']")[0];
        if (proficiency) proficiency.indeterminate = true;
      }
    }

    // Mark broken in indeterminate state if it's automatically designated broken but not explicitly
    if (this.item.isPhysical) {
      if (this.item.isBroken && this.item.system.broken !== true) {
        const broken = html.find("input[name='system.broken']")[0];
        if (broken) {
          broken.indeterminate = true;
          broken.dataset.tooltip = "PF1.AutoBroken";
        }
      }
    }

    // Allow editing and viewing visible scripts
    html.find(".script-calls .item-list .item").contextmenu(this._onScriptCallEdit.bind(this));
    html.find(".script-calls .item-control").click(this._onScriptCallControl.bind(this));

    // Add warning about formulas
    html.find("input.formula").each(async (_, el) => this._validateFormula(el));

    // Linked item clicks
    html
      .find(".tab[data-tab='links'] .links-item .item-name .source-item")
      .on("click", this._openLinkedItem.bind(this));

    html.find('a[data-action="browse"]').click(this._onOpenCompendiumBrowser.bind(this));

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) {
      html.find("span.text-box").addClass("readonly");
      return;
    }

    // Add drop handler to textareas and text inputs
    html.find("textarea, input[type='text']").on("drop", this._onTextAreaDrop.bind(this));

    // Create new change
    html.find(".tab.changes .controls a.add-change").click(this._onCreateChange.bind(this));

    // Changes
    html[0].querySelectorAll(".tab.changes .changes .change[data-change-id]").forEach((el) => {
      // Sticky tooltip cotrols
      el.querySelector(".controls a.menu").addEventListener("pointerenter", this._onOpenChangeMenu.bind(this), {
        passive: true,
      });
      // Right click open change editor
      el.addEventListener("contextmenu", this._onEditChange.bind(this));
    });

    // Modify note changes
    html.find(".context-note-control").click(this._onNoteControl.bind(this));
    html.find(".context-note .context-note-target").click(this._onNoteTargetControl.bind(this));

    // Create attack
    if (["weapon"].includes(this.item.type)) {
      html.find("button[name='create-attack']").click(this._createAttack.bind(this));
    }

    // Create spellbook
    if (this.item.type === "class") {
      html.find("button[name='create-spellbook']").click(this._createSpellbook.bind(this));
    }

    // Effect notes and footnotes
    html.find(".card-notes .controls a").click(this._onCardNoteControl.bind(this));

    // Listen to field entries
    html.find(".item-selector").click(this._onItemSelector.bind(this));

    html.find(".link-control").click(this._onLinkControl.bind(this));

    // Click to change text input
    html.find('*[data-action="input-text"]').click((event) => this._onInputText(event));

    // Select the whole text on click
    html.find(".select-on-click").click(this._selectOnClick.bind(this));

    html.find(".speed-editor").click(this._onSpeedEdit.bind(this));

    /* -------------------------------------------- */
    /*  Actions
    /* -------------------------------------------- */

    // Modify action charges
    html
      .find(".action-parts .item-uses span.text-box.value")
      .on("wheel", this._setActionUses.bind(this))
      .on("click", (event) => {
        this._onSpanTextInput(event, this._setActionUses.bind(this));
      });

    // Open charge source with right click
    html.find(".item-link[data-item-id]").on("contextmenu", (event) => {
      event.preventDefault();
      const itemId = event.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      item?.sheet.render(true, { focus: true });
    });

    /* -------------------------------------------- */
    /*  Script Calls
    /* -------------------------------------------- */

    html.find(".script-calls .item-list[data-category]").on("drop", this._onScriptCallDrop.bind(this));
  }

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
      prevValue = foundry.utils.getProperty(this.item, name) ?? "";
      if (typeof prevValue !== "string") prevValue = prevValue.toString();

      if (name.endsWith(".value") && !noCap) {
        const maxName = name.replace(/\.value$/, ".max");
        maxValue = foundry.utils.getProperty(this.item, maxName);
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

  _setActionUses(event) {
    if (!(event.originalEvent instanceof MouseEvent)) event.preventDefault();
    const el = event.currentTarget;
    const actionId = el.closest(".item[data-action-id]").dataset.actionId;
    const action = this.item.actions.get(actionId);

    this._mouseWheelAdd(event, el);

    const value = el.tagName === "INPUT" ? Number(el.value) : Number(el.innerText);
    this.setActionUpdate(action.id, "uses.self.value", value);

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      el.addEventListener("pointerleave", () => this._updateActions(), { passive: true, once: true });
    } else this._updateActions();
  }

  setActionUpdate(id, key, value) {
    let obj = this._actionUpdates.find((o) => o._id === id);
    if (!obj) {
      obj = { _id: id };
      this._actionUpdates.push(obj);
    }

    obj[key] = value;
  }

  async _updateActions() {
    const promises = [];

    const updates = this._actionUpdates;
    this._actionUpdates = [];

    // Memorize variables in document
    for (const d of updates) {
      const action = this.item.actions.get(d._id);
      if (!action) {
        console.error("Item update for non-existing item:", d._id, d);
        continue;
      }
      await action.update(d);
    }
  }

  /* -------------------------------------------- */

  _onOpenCompendiumBrowser(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const category = a.dataset.category;

    pf1.applications.compendiums[category].render(true, { focus: true });
  }

  async _onScriptCallControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const script = this.item.scriptCalls ? this.item.scriptCalls.get(a.closest(".item")?.dataset.itemId) : null;
    const group = a.closest(".item-list");
    const category = group.dataset.category;

    // Create item
    if (a.classList.contains("item-create")) {
      await this._onSubmit(event, { preventRender: true });
      const newScripts = await pf1.components.ItemScriptCall.create([{ category, type: "script" }], {
        parent: this.item,
      });
      newScripts?.forEach((script) => script.edit());
      return;
    }
    // Delete item
    else if (script && a.classList.contains("item-delete")) {
      const list = (this.item.system.scriptCalls || []).filter((o) => o._id !== script.id);
      const updateData = { "system.scriptCalls": list };
      return this._updateObject(event, this._getSubmitData(updateData));
    }
    // Edit item
    else if (script && a.classList.contains("item-edit")) {
      script.edit();
    }
    // Toggle hidden
    else if (script && a.classList.contains("item-hide")) {
      await this._onSubmit(event, { preventRender: true });
      script.update({ hidden: !script.hidden });
    }
  }

  _onScriptCallEdit(event) {
    event.preventDefault();
    const el = event.currentTarget;

    /** @type {pf1.components.ItemScriptCall} */
    const script = this.item.scriptCalls?.get(el.dataset.itemId);
    script?.edit({ editable: this.isEditable });
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

  /**
   * Handle dropping content-linkable data to `<textarea>` or text `<input>`
   *
   * @internal
   * @param {DragEvent} event
   */
  async _onTextAreaDrop(event) {
    event.preventDefault();

    const eventData = TextEditor.getDragEventData(event.originalEvent);
    if (!eventData) return;

    const elem = event.currentTarget;
    const link = await TextEditor.getContentLink(eventData, { relativeTo: this.actor });
    if (!link) return void ui.notifications.warn("PF1.Error.InvalidContentLinkDrop", { localize: true });

    // Insert link
    // TODO: Replace painted text if any
    elem.value = !elem.value ? link : elem.value + "\n" + link;

    return this._onSubmit(event); // Save
  }

  async _onScriptCallDrop(event) {
    event.preventDefault();

    const eventData = TextEditor.getDragEventData(event.originalEvent);
    if (!eventData) return;

    const { uuid, type } = eventData;
    if (type !== "Macro") return;

    // Submit data
    if (uuid) {
      await this._onSubmit(event, { preventRender: true });

      const elem = event.currentTarget;
      const category = elem.dataset.category;
      const list = this.item.system.scriptCalls ?? [];
      return pf1.components.ItemScriptCall.create([{ type: "macro", value: uuid, category, name: "", img: "" }], {
        parent: this.item,
      });
    }
  }

  _openHelpBrowser(event) {
    event.preventDefault();
    const a = event.currentTarget;

    pf1.applications.helpBrowser.openUrl(a.dataset.url);
  }

  /**
   * By default, returns true only for GM
   *
   * @override
   */
  _canDragStart(selector) {
    return true;
  }

  /**
   * @internal
   * @override
   * @param {DragEvent} event
   */
  _onDragStart(event) {
    const elem = event.target;

    // Drag action
    const actionId = elem.dataset.actionId;
    if (actionId) {
      const action = this.item.actions.get(actionId);
      const obj = { type: "action", uuid: this.item.uuid, actionId: action.id, data: action.data };
      event.dataTransfer.setData("text/plain", JSON.stringify(obj));
      return;
    }

    // Drag Change
    const changeId = elem.dataset.changeId;
    if (changeId) {
      const ch = this.item.changes.get(changeId);
      const obj = { type: "pf1Change", data: ch.data, changeId, uuid: this.item.uuid };
      event.dataTransfer.setData("text/plain", JSON.stringify(obj));
      return;
    }

    // Drag link
    if (elem.matches(".links-item .item-name")) {
      const el = elem.closest("[data-uuid]");
      const type = el.closest("[data-tab]")?.dataset.tab;
      let uuid = el.dataset.uuid;
      if (type === "children") {
        // Transform relative UUID into absolute
        uuid = fromUuidSync(uuid, { relative: this.actor })?.uuid;
      }
      const index = Number(el.dataset.index);
      const link = this.item.system.links?.[type]?.[index];
      const obj = { type: "Item", uuid, pf1Link: {} };
      if (link) obj.pf1Link.level = link.level;
      event.dataTransfer.setData("text/plain", JSON.stringify(obj));
      return;
    }
  }

  /**
   * Allow non-GM to drag&drop actions and items (for containers) to this sheet.
   *
   * @override
   * @protected
   */
  _canDragDrop() {
    return this.isEditable;
  }

  /**
   * @internal
   * @param {DragEvent} event
   */
  async _onDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isEditable) return;

    const data = TextEditor.getDragEventData(event);
    const { type, uuid } = data;
    /** @type {ItemPF} */
    const item = this.item;

    const srcItem = uuid ? await fromUuid(uuid) : null;

    switch (type) {
      // Handle actions
      case "action": {
        const actionId = data.actionId;
        // Re-order
        if (srcItem === item) {
          const targetActionID = event.target?.closest(".item[data-action-id]")?.dataset?.actionId;
          const prevActions = foundry.utils.deepClone(item.toObject().system.actions);

          let targetIdx;
          if (!targetActionID) targetIdx = prevActions.length - 1;
          else targetIdx = prevActions.indexOf(prevActions.find((o) => o._id === targetActionID));
          const srcIdx = prevActions.indexOf(prevActions.find((o) => o._id === actionId));

          const [actionData] = prevActions.splice(srcIdx, 1);
          prevActions.splice(targetIdx, 0, actionData);
          await this.item.update({ "system.actions": prevActions });
        }
        // Add to another item
        else {
          const prevActions = foundry.utils.deepClone(item.toObject().system.actions ?? []);
          data.data._id = foundry.utils.randomID(16);
          prevActions.splice(prevActions.length, 0, data.data);
          await this.item.update({ "system.actions": prevActions });
        }
        break;
      }
      case "pf1Change": {
        const chData = data.data;
        // Sort in same item
        if (srcItem === item) {
          const el = event.target.matches("li.change") ? event.target : event.target.closest("li.change");
          if (!el) return;
          const targetChangeId = el.dataset.changeId;
          if (chData._id === targetChangeId) {
            // Dropped onto self, ignore.
          } else {
            // Re-arrange
            /** @type {Array<object>} */
            const changes = item.toObject().system.changes ?? [];
            const removed = changes.findSplice((c) => c._id === chData._id);
            if (!removed) return;
            const idx = changes.findIndex((c) => c._id === targetChangeId);
            if (idx >= 0) {
              changes.splice(idx, 0, removed);
              return item.update({ "system.changes": changes });
            }
          }
        }
        // Duplicate
        else {
          delete chData._id;
          this.activateTab("changes", "primary");
          return pf1.components.ItemChange.create([chData], { parent: item });
        }
        break;
      }
      case "Item": {
        // Add drop handler to link tabs
        const linksTab = event.target.closest(".tab.links .tab[data-group='links']");
        if (linksTab) {
          this._onLinksDrop(event, data);
        }
        break;
      }
      case "pf1ContentSourceEntry": {
        const src = data.data;
        const origin = await fromUuid(data.uuid);
        if (!origin) return;
        if (origin === this.item) return; // From same item

        const sources = this.item.toObject().system.sources ?? [];

        // Disallow same ID source copy
        if (src.id && sources.some((osrc) => (src.id ? osrc.id === src.id : osrc.title === src.title))) {
          ui.notifications.warn("PF1.ContentSource.Errors.DuplicateID", { localize: true });
          return;
        }

        sources.push(src);
        await this.item.update({ "system.sources": sources });
        if (!event.shiftKey) {
          pf1.applications.ContentSourceEditor.open(this.item);
          // TODO: Activate desired tab.
        }
        break;
      }
    }
  }

  async _onLinksDrop(event, data) {
    const elem = event.target;
    let linkType = elem.closest("[data-tab]").dataset.tab;

    // Default selection for dropping on tab instead of body
    if (linkType === "links") linkType = "children";

    // Try to extract the data
    if (!data.type) throw new Error("Invalid drop data received");

    const targetItem = await fromUuid(data.uuid);
    if (!targetItem || !(targetItem instanceof Item))
      throw new Error(`UUID did not resolve to valid item: ${data.uuid}`);

    let dataType,
      itemLink = data.uuid;
    // Case 1 - Import from a Compendium pack
    if (targetItem.pack) {
      dataType = "compendium";
    }
    // Case 2 - Import from same actor
    else if (targetItem.actor === this.item.actor) {
      dataType = "data";
      itemLink = targetItem.getRelativeUUID(this.actor);
    }

    // Case 3 - Import from World Document
    else {
      dataType = "world";
    }

    // Add extra data
    const extraData = {};
    switch (linkType) {
      case "classAssociations": {
        const level = data.pf1Link?.level;
        if (Number.isNumeric(level)) extraData.level = level;
        break;
      }
    }

    await this.item.createItemLink(linkType, dataType, targetItem, itemLink, extraData);
  }

  /**
   * Handle spawning the ActorTraitSelector application which allows a checkbox of multiple trait options
   *
   * @param {Event} event   The click event which originated the selection
   * @private
   */
  _onTraitSelector(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const options = {
      name: a.dataset.for,
      title: game.i18n.localize(a.dataset.title),
      subject: a.dataset.options,
      choices: pf1.config[a.dataset.options],
    };

    switch (a.dataset.options) {
      case "conditions": {
        options.choices = pf1.registry.conditions.getLabels();
        break;
      }
    }

    new ActorTraitSelector(this.item, options).render(true);
  }

  _onSpeedEdit(event) {
    event.preventDefault();

    let app = Object.values(ui.windows).find(
      (oldApp) => oldApp instanceof SpeedEditor && oldApp.document === this.item
    );
    app ??= new SpeedEditor(this.item);
    app.render(true, { focus: true });
  }

  /**
   * Toggle inline display of an item's summary/description by expanding or hiding info div
   *
   * @param {JQuery.ClickEvent<HTMLElement>} event - The click event on the item
   * @private
   */
  async _onActionSummary(event) {
    event.preventDefault();

    const li = event.target.closest(".item[data-action-id]");
    // Check whether pseudo-item belongs to another collection
    const action = this.item.actions.get(li.dataset.actionId);

    const rollData = action.getRollData();

    // For actions (embedded into a parent item), show only the action's summary instead of a complete one
    const { actionDescription, properties } = await action.getChatData({ chatcard: false, rollData });

    // Toggle summary
    if (li.classList.contains("expanded")) {
      const summary = li.querySelector(".item-summary");
      $(summary).slideUp(200, () => summary.remove());
    } else {
      const templateData = {
        description: actionDescription || game.i18n.localize("PF1.NoDescription"),
        properties,
      };
      let content = await renderTemplate("systems/pf1/templates/actors/parts/actor-item-summary.hbs", templateData);
      content = await TextEditor.enrichHTML(content, { rollData, secrets: this.item.isOwner });

      const div = $(content);
      div.hide();
      li.append(...div);
      div.slideDown(200);
    }
    li.classList.toggle("expanded");
  }

  /**
   * Open linked item sheet.
   *
   * @param {Event} event
   */
  async _openLinkedItem(event) {
    event.preventDefault();
    const el = event.target.closest(".links-item[data-uuid],.links-item[data-item-id]");
    const { uuid } = el.dataset;

    const item = await fromUuid(uuid, { relative: this.actor });
    item.sheet.render(true, { focus: true });
  }

  async _onActionControl(event) {
    event.preventDefault();
    event.stopPropagation();

    const a = event.currentTarget;

    const getUniqueActionName = (baseName) => {
      baseName = baseName.replace(/\s*\(\d+\)$/, ""); // Strip existing number
      let name = baseName;
      const names = new Set(this.item.actions?.map((act) => act.name) ?? []);
      let iter = 1;
      // Find unique name
      while (names.has(name)) name = `${baseName} (${iter++})`;
      return name;
    };

    // Edit action
    if (a.classList.contains("edit-action")) {
      return this._onActionEdit(event);
    }
    // Add action
    else if (a.classList.contains("add-action")) {
      await this._onSubmit(event, { preventRender: true });

      const baseName = ["weapon", "attack"].includes(this.item.type)
        ? game.i18n.localize("PF1.Attack")
        : game.i18n.localize("PF1.Use");

      const newActionData = {
        name: getUniqueActionName(baseName),
      };

      const newActions = await pf1.components.ItemAction.create([newActionData], { parent: this.item });
      newActions.forEach((action) => action.sheet.render(true));
      return;
    }
    // Remove action
    else if (a.classList.contains("delete-action")) {
      const li = a.closest(".item[data-action-id]");
      const action = this.item.actions.get(li.dataset.actionId);

      const confirmed = getSkipActionPrompt()
        ? true
        : await Dialog.confirm({
            title: game.i18n.format("PF1.DeleteItemTitle", { name: action.name }),
            content: `<p>${game.i18n.localize("PF1.DeleteItemConfirmation")}</p>`,
            yes: () => true,
            no: () => false,
            close: () => false,
            rejectClose: false,
          });

      if (confirmed === true) {
        await this._onSubmit(event, { preventRender: true });
        action.delete();
      }
    }
    // Duplicate action
    else if (a.classList.contains("duplicate-action")) {
      const li = a.closest(".item[data-action-id]");
      const actions = this.item.toObject().system.actions ?? [];
      const action = foundry.utils.deepClone(actions.find((act) => act._id === li.dataset.actionId) ?? {});
      action.name = getUniqueActionName(action.name);
      action._id = foundry.utils.randomID(16);
      actions.push(action);
      const updateData = { "system.actions": actions };
      await this._updateObject(event, this._getSubmitData(updateData));
      this.item.actions.get(action._id)?.sheet.render(true);
    }
  }

  async _onActionEdit(event) {
    event.preventDefault();
    event.stopPropagation();

    const li = event.target.closest(".item[data-action-id]");
    this.item.actions.get(li.dataset.actionId).sheet.render(true);
  }

  async _onOpenChangeMenu(event) {
    const el = event.target;

    const changeId = el.dataset.changeId;
    if (!changeId) return;

    const content = document.createElement("div");
    content.innerHTML = await renderTemplate("systems/pf1/templates/items/parts/item-change-tooltip.hbs", { changeId });

    content.querySelector(".duplicate").addEventListener("click", (ev) => this._onDuplicateChange(ev, el));
    content.querySelector(".delete").addEventListener("click", (ev) => this._onDeleteChange(ev, el));
    content.querySelector(".edit").addEventListener("click", (ev) => this._onEditChange(ev, el, true));

    await game.tooltip.activate(el, {
      content,
      locked: true,
      direction: TooltipManager.TOOLTIP_DIRECTIONS.LEFT,
      cssClass: "pf1 change-menu",
    });
  }

  /**
   * @internal
   * @param {Event} event - Click event
   * @param {boolean} [tooltip] - Is this event from locked tooltip?
   */
  _onEditChange(event, tooltip = false) {
    event.preventDefault();
    const el = event.target;
    const changeId = el.closest("[data-change-id]").dataset.changeId;
    const change = this.item.changes.get(changeId);
    if (change) {
      if (tooltip) game.tooltip.dismissLockedTooltip(el.closest(".locked-tooltip"));
      return void pf1.applications.ChangeEditor.wait(change);
    }
  }

  _onDuplicateChange(event) {
    event.preventDefault();
    const el = event.target;
    const changeId = el.dataset.changeId;
    if (!changeId) return;
    const changes = this.item.toObject().system.changes ?? [];
    const old = changes.find((c) => c._id === changeId);
    if (old) {
      game.tooltip.dismissLockedTooltip(el.closest(".locked-tooltip"));
      delete old._id;
      return pf1.components.ItemChange.create([old], { parent: this.item });
    }
  }

  _onDeleteChange(event) {
    event.preventDefault();
    const el = event.target;
    const changeId = el.dataset.changeId;
    game.tooltip.dismissLockedTooltip(el.closest(".locked-tooltip"));
    this.item.changes.get(changeId)?.delete();
  }

  async _onCreateChange(event) {
    event.preventDefault();

    const [change] = await pf1.components.ItemChange.create([{ modifier: "untyped" }], { parent: this.item });
    if (change) pf1.applications.ChangeEditor.wait(change);
  }

  async _onNoteControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new note
    if (a.classList.contains("add-note")) {
      const contextNotes = this.item.toObject().system.contextNotes || [];
      contextNotes.push(new pf1.components.ContextNote().toObject());
      const updateData = { "system.contextNotes": contextNotes };
      return this._updateObject(event, this._getSubmitData(updateData));
    }
    // Remove a note
    if (a.classList.contains("delete-note")) {
      const li = a.closest(".context-note");
      const contextNotes = this.item.toObject().system.contextNotes || [];
      contextNotes.splice(Number(li.dataset.note), 1);
      const updateData = { "system.contextNotes": contextNotes };
      return this._updateObject(event, this._getSubmitData(updateData));
    }
  }

  _onNoteTargetControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Prepare categories and changes to display
    const li = a.closest(".context-note");
    const noteIndex = Number(li.dataset.note);
    const note = this.item.system.contextNotes[noteIndex];
    const categories = getBuffTargetDictionary("contextNotes", { actor: this.item.actor, item: this.item });

    // Sort specific categories
    const sortable = new Set(["skill"]);
    const lang = game.settings.get("core", "language");
    for (const category of categories) {
      if (!sortable.has(category.key)) continue;
      category.items.sort((a, b) => a.label.localeCompare(b.label, lang));
    }

    const part1 = note?.target?.split(".")[0];
    const category = pf1.config.contextNoteTargets[part1]?.category ?? part1;

    // Show widget
    const w = new Widget_CategorizedItemPicker(
      { title: "PF1.Application.ContextNoteTargetSelector.Title" },
      categories,
      (key) => {
        if (key) {
          const updateData = {};
          updateData[`system.contextNotes.${noteIndex}.target`] = key;
          this.item.update(updateData);
        }
      },
      { category, item: note?.target }
    );
    w.render(true);
  }

  async _onLinkControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Delete link
    if (a.classList.contains("delete-link")) {
      const { type, uuid, index } = a.dataset;
      const links = this.item.toObject().system.links?.[type] ?? [];

      const deleted = links.splice(Number(index), 1);

      // Sanity check: Should happen only if update sneaks in between render and click
      if (deleted.uuid && deleted.uuid !== uuid) throw new Error("Link deletion UUID mismatch");

      // Call hook for deleting a link
      Hooks.callAll("pf1DeleteItemLink", this.item, deleted, type);

      const updateData = { "system.links": { [type]: links } };
      return this._updateObject(event, this._getSubmitData(updateData));
    }
  }

  /**
   * Makes a readonly text input editable, and focus it.
   *
   * @param {Event} event
   * @private
   */
  _onInputText(event) {
    event.preventDefault();

    /** @type {HTMLElement} */
    const elem = event.target;

    elem.readOnly = false;

    // Get and set real value
    const { inputValue } = elem.dataset;
    let origValue = inputValue ?? foundry.utils.getProperty(this.item, elem.name);
    const displayValue = elem.value;
    elem.value = origValue;
    elem.select();

    // Restore old display on unfocus if nothing was changed
    elem.addEventListener(
      "blur",
      () => {
        if (typeof origValue === "number") origValue = origValue.toString();
        if (origValue === elem.value) {
          elem.readOnly = true;
          elem.value = displayValue;
        }

        // Clear selection
        const s = document.getSelection();
        if (s.anchorNode === elem || s.anchorNode === elem.parentElement) s.removeAllRanges();
      },
      { once: true, passive: true }
    );
  }

  async _createAttack(event) {
    if (!this.actor) throw new Error(game.i18n.localize("PF1.Error.ItemNoOwner"));

    await this._onSubmit(event, { preventRender: true });

    const sourceItem = this.item;

    const attackItem = pf1.documents.item.ItemAttackPF.fromItem(sourceItem);

    // Show in quickbar only if if the original item is there
    attackItem.system.showInQuickbar = sourceItem.system.showInQuickbar;

    // Create attack
    const newItem = await Item.implementation.create(attackItem, { parent: this.actor });
    if (!newItem) throw new Error("Failed to create attack from weapon");

    // Disable quick use of weapon
    await sourceItem.update({ "system.showInQuickbar": false });

    // Create link
    await sourceItem.createItemLink("children", "data", newItem, newItem.getRelativeUUID(this.actor));

    // Notify user
    ui.notifications.info(game.i18n.format("PF1.NotificationCreatedAttack", { item: sourceItem.name }));
  }

  async _createSpellbook(event) {
    event.preventDefault();
    if (this.item.actor == null) throw new Error(game.i18n.localize("PF1.Error.ItemNoOwner"));
    await this._onSubmit(event, { preventRender: true });

    await this.item.actor.createSpellbook({ ...this.item.system.casting, class: this.item.system.tag });

    // HACK: The above does not re-render the item sheet for some reason
    this.render();
  }

  _onEntrySelector(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const options = {
      name: a.dataset.for,
      title: a.dataset.title,
      flag: a.dataset.flag === "true",
      boolean: a.dataset.boolean === "true",
      flat: a.dataset.flat === "true",
      fields: a.dataset.fields,
      dtypes: a.dataset.dtypes,
    };

    pf1.applications.EntrySelector.open(this.item, options);
  }

  async _onItemSelector(event) {
    event.preventDefault();
    if (!this.item.isOwner) return void ui.notifications.warn("PF1.Error.NoItemPermission", { localize: true });
    // This functionm should never be called without an actor
    if (!this.actor) throw new Error("No actor to find items from.");

    const { type, subType, kind, empty, selected, label, name } = event.currentTarget.dataset;

    const filter = (item) => {
      if (type && item.type !== type) return false;
      if (subType && item.subType !== subType) return false;
      if (subType === "ammo" && kind) {
        if (item.system.extraType !== kind) return false;
      }
      return true;
    };

    const options = {
      actor: this.actor,
      empty: empty === "true" || empty !== "false",
      filter,
      selected,
    };

    const appOptions = {
      title: `${game.i18n.format("PF1.SelectSpecific", { specifier: game.i18n.localize(label) })} - ${this.actor.name}`,
      id: `${this.item.uuid}-item-selector`,
    };

    const item = await pf1.applications.ItemSelector.wait(options, appOptions);
    if (item === null) return;

    this.item.update({ [name]: item });
  }

  /**
   * Control effect notes and footnotes
   *
   * @internal
   * @param {Event} event
   * @returns
   */
  async _onCardNoteControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const name = a.dataset.name;
    const action = a.dataset.action;

    const notes = foundry.utils.getProperty(this.item.toObject(), name) ?? [];

    switch (action) {
      case "add": {
        notes.push("");
        const updateData = { [name]: notes };
        return this._updateObject(event, this._getSubmitData(updateData));
      }
      case "delete": {
        notes.splice(Number(a.dataset.index), 1);
        const updateData = { [name]: notes };
        return this._updateObject(event, this._getSubmitData(updateData));
      }
    }
  }

  _selectOnClick(event) {
    event.preventDefault();
    const el = event.currentTarget;
    el.select();
  }
}

/**
 * @typedef {object} DescriptionAttribute
 * @property {string} name - Data path to which the input will be written
 * @property {boolean} [fakeName] - Is player lied to about what they're editing. Unused.
 * @property {string} id
 * @property {boolean} [isNumber] - Whether the input is a number (text input)
 * @property {boolean} [isBoolean] - Whether the input is a boolean (checkbox)
 * @property {boolean} [isRange] - Whether this is a dual input for a value and a maximum value
 * @property {string} label - The label for the input
 * @property {string | boolean | number | {value: string | number, name: string}} value - The value that is show in the sidebar.
 *   Ranges require an object with `value` and `name` properties.
 * @property {{value: string | number, name: string}} [max] - Maximum value for a range input
 * @property {number} [decimals] - Number of decimals to display for `number`s
 * @property {boolean} [fakeValue] - Is {@link DescriptionAttribute#inputValue} actually used.
 * @property {string} [inputValue] - Value that will appear in the input field when it is edited,
 *                                   overriding the default value retrieved from the item data
 *                                   using {@link DescriptionAttribute#name}
 */
