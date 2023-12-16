import { adjustNumberByStringCommand, getBuffTargetDictionary, getBuffTargets, getDistanceSystem } from "@utils";
import { ItemPF } from "@item/item-pf.mjs";
import { ScriptEditor } from "../script-editor.mjs";
import { ActorTraitSelector } from "../trait-selector.mjs";
import { SpeedEditor } from "../speed-editor.mjs";
import { Widget_CategorizedItemPicker } from "../categorized-item-picker.mjs";
import { getSkipActionPrompt } from "../../documents/settings.mjs";
import { ContentSourceEditor } from "../content-source.mjs";

/**
 * Override and extend the core ItemSheet implementation to handle game system specific item types
 *
 * @type {ItemSheet}
 */
export class ItemSheetPF extends ItemSheet {
  constructor(...args) {
    super(...args);

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
      width: 580,
      classes: ["pf1", "sheet", "item"],
      scrollY: [".tab", ".buff-flags", ".editor-content"],
      dragDrop: [
        {
          dragSelector: "li.action-part",
          dropSelector: ".tab.details",
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
    const context = await super.getData();
    context.flags = { flags: context.flags };

    /** @type {ItemPF} */
    const item = this.item,
      itemData = item.system;
    context.system = itemData;

    const actor = item.actor,
      actorData = actor?.system;

    const firstAction = item.firstAction;

    const rollData = firstAction?.getRollData() ?? item.getRollData();

    context.rollData = rollData;
    context.labels = item.getLabels();

    context.canClassLink = pf1.config.classAssociations.includes(item.type) && !!rollData.classes;
    if (context.canClassLink) {
      context.hasClassLink = !!item.system.class;
      context.classes = {};
      for (const [classTag, classData] of Object.entries(rollData.classes)) {
        context.classes[classTag] = classData.name;
      }
    }

    // Include sub-items
    context.items = item.items?.map((i) => i.toObject()) ?? [];

    // Include CONFIG values
    context.config = pf1.config;

    context.inContainer = item.inContainer ?? false;

    // Add hit die size options for classes
    if (item.type === "class") {
      context.hitDieSizes = context.config.hitDieSizes.reduce((all, size) => {
        all[size] = game.i18n.format("PF1.DieSize", { size });
        return all;
      }, {});
    }

    // Include raw tag data (from source to not get autofilled tag)
    context.tag = this.item._source.system.tag;

    // Item Type, Status, and Details
    context.itemType = game.i18n.localize(CONFIG.Item.typeLabels[item.type]);
    context.itemStatus = this._getItemStatus(item);
    context.itemProperties = this._getItemProperties();
    context.itemName = item.name;
    if (item.links.charges) context.inheritCharges = item.links.charges;
    context.isCharged = ["day", "week", "charges"].includes(itemData.uses?.per);
    context.defaultChargeFormula = item.getDefaultChargeFormula();
    context.isPhysical = itemData.quantity !== undefined;
    context.isNaturalAttack = itemData.subType === "natural";
    context.isSpell = item.type === "spell";
    context.owned = !!actor;
    context.owner = item.isOwner;
    context.isGM = game.user.isGM;
    context.hasAction = item.hasAction;
    context.showIdentifyDescription = context.isGM && context.isPhysical;
    context.showUnidentifiedData = item.showUnidentifiedData;
    context.showIdentifiedData = !context.showUnidentifiedData;
    context.unchainedActionEconomy = game.settings.get("pf1", "unchainedActionEconomy");

    // Identification information
    context.identify ??= {};
    if (rollData.item.auraStrength != null) {
      const auraStrength = rollData.item.auraStrength;
      context.auraStrength = auraStrength;

      if (pf1.config.auraStrengths[auraStrength]) {
        context.auraStrength_name = pf1.config.auraStrengths[auraStrength];

        context.identify.dc = 15 + rollData.item.cl;
        context.identify.curse = context.identify.dc + 10;
      }
    }

    // Add spellcasting configuration
    if (item.type === "class") {
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

    const description = this.document.getDescription();

    // Add descriptions
    context.descriptionHTML = {
      identified: await TextEditor.enrichHTML(description, {
        secrets: context.owner,
        rollData: rollData,
        async: true,
        relativeTo: this.actor,
      }),
      unidentified: await TextEditor.enrichHTML(itemData.description.unidentified, {
        secrets: context.owner,
        rollData: rollData,
        async: true,
        relativeTo: this.actor,
      }),
    };

    context.name = item.name;

    // Override description attributes
    if (context.isPhysical) {
      /** @type {DescriptionAttribute[]} */
      context.descriptionAttributes = [];

      // Add quantity
      context.descriptionAttributes.push({
        isNumber: true,
        name: "system.quantity",
        label: game.i18n.localize("PF1.Quantity"),
        value: itemData.quantity,
        decimals: 0,
        id: "data-quantity",
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
        id: "data-weight-value",
      });

      // Add price
      if (context.showIdentifyDescription) {
        context.descriptionAttributes.push(
          {
            isNumber: true,
            name: "system.price",
            label: game.i18n.localize("PF1.Price"),
            value: item.getValue({ sellValue: 1 }),
            decimals: 2,
            id: "data-price",
          },
          {
            isNumber: true,
            name: "system.unidentified.price",
            label: game.i18n.localize("PF1.UnidentifiedPriceShort"),
            value: item.getValue({ sellValue: 1, forceUnidentified: true }),
            decimals: 2,
            id: "data-unidentifiedPrice",
          }
        );
      } else {
        if (context.showUnidentifiedData) {
          context.descriptionAttributes.push({
            isNumber: true,
            name: "system.unidentified.price",
            fakeName: true,
            label: game.i18n.localize("PF1.Price"),
            value: item.getValue({ sellValue: 1 }),
            decimals: 2,
            id: "data-price",
          });
        } else {
          context.descriptionAttributes.push({
            isNumber: true,
            name: "system.price",
            label: game.i18n.localize("PF1.Price"),
            value: item.getValue({ sellValue: 1 }),
            decimals: 2,
            id: "data-price",
          });
        }
      }

      // Add hit points
      context.descriptionAttributes.push({
        isRange: true,
        label: game.i18n.localize("PF1.HPShort"),
        value: {
          name: "system.hp.value",
          value: itemData.hp.value,
        },
        max: {
          name: "system.hp.max",
          value: itemData.hp.max,
        },
      });

      // Add hardness
      context.descriptionAttributes.push({
        isNumber: true,
        label: game.i18n.localize("PF1.Hardness"),
        name: "system.hardness",
        decimals: 0,
        value: itemData.hardness,
      });

      let disableEquipping = false;
      if (item.inContainer) {
        // Apply similar logic as in .adjustContained()
        if (item.type === "weapon") disableEquipping = true;
        else if (item.type === "equipment") {
          if (["armor", "shield", "clothing"].includes(item.subType)) {
            disableEquipping = true;
          }
          // For items not matching the above, only slotless are allowed
          else if (["wondrous", "other"].includes(item.subType) && itemData.slot !== "slotless") {
            disableEquipping = true;
          }
        }
      }

      // Add equipped flag
      context.descriptionAttributes.push({
        isBoolean: true,
        name: "system.equipped",
        label: game.i18n.localize("PF1.Equipped"),
        value: itemData.equipped,
        disabled: disableEquipping,
      });

      // Add carried flag
      context.descriptionAttributes.push({
        isBoolean: true,
        name: "system.carried",
        label: game.i18n.localize("PF1.Carried"),
        value: itemData.carried,
        disabled: item.inContainer,
      });
    }

    // Prepare feat specific stuff
    if (item.type === "feat") {
      context.isClassFeature = itemData.subType === "classFeat";
      context.isTemplate = itemData.subType === "template";
    }

    if (["class", "feat", "race"].includes(item.type)) {
      // Add skill list
      if (!actor) {
        context.skills = Object.entries(pf1.config.skills).reduce((cur, [skillId, label]) => {
          cur[skillId] = { name: label, classSkill: itemData.classSkills?.[skillId] === true };
          return cur;
        }, {});
      } else {
        // Get sorted skill list from config, custom skills get appended to bottom of list
        const skills = foundry.utils.mergeObject(foundry.utils.deepClone(pf1.config.skills), actorData.skills ?? {});
        context.skills = Object.entries(skills).reduce((cur, [skillId, skillIdata]) => {
          const name = pf1.config.skills[skillId] || skillIdata.name;
          cur[skillId] = { name: name, classSkill: item.system.classSkills?.[skillId] === true };
          return cur;
        }, {});
      }
    }

    // Prepare attack-specific stuff
    if (item.type === "attack" && item.subType === "weapon") {
      context.materialCategories = this._prepareMaterialsAndAddons(
        "weapon",
        "all",
        itemData.subType,
        itemData.material?.normal.value
      );

      context.alignmentTypes = this._prepareAlignments(itemData.alignments);
    }

    // Prepare weapon specific stuff
    if (item.type === "weapon") {
      context.isRanged = itemData.weaponSubtype === "ranged" || itemData.properties["thr"] === true;

      // Prepare categories for weapons
      context.weaponCategories = { types: {}, subTypes: {} };
      for (const [k, v] of Object.entries(pf1.config.weaponTypes)) {
        context.weaponCategories.types[k] = v._label;
      }
      const type = itemData.subType;
      if (type in pf1.config.weaponTypes) {
        for (const [k, v] of Object.entries(pf1.config.weaponTypes[type])) {
          // Add static targets
          if (!k.startsWith("_")) context.weaponCategories.subTypes[k] = v;
        }
      }

      context.materialCategories = this._prepareMaterialsAndAddons(
        item.type,
        itemData.weaponSubtype,
        null,
        itemData.material?.normal.value
      );

      context.alignmentTypes = this._prepareAlignments(itemData.alignments);
    }

    // Prepare equipment specific stuff
    if (item.type === "equipment") {
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
        context.materialCategories = this._prepareMaterialsAndAddons(
          item.type,
          itemData.equipmentSubtype,
          itemData.subType,
          itemData.armor.material?.normal.value ?? ""
        );
      }
    }

    // Prepare spell specific stuff
    if (item.type === "spell") {
      let spellbook = null;
      if (actor) {
        const bookId = itemData.spellbook;
        spellbook = actorData?.attributes.spells?.spellbooks[bookId];
      }

      context.isSpontaneousLike = spellbook?.spontaneous || spellbook?.spellPoints?.useSystem || false;
      context.isPreparedSpell = !context.isSpontaneousLike;
      context.usesSpellpoints = spellbook != null ? spellbook.spellPoints?.useSystem ?? false : false;
      context.isAtWill = itemData.atWill;
      context.spellbooks = foundry.utils.deepClone(actorData?.attributes.spells.spellbooks ?? {});

      const desc = await renderTemplate(
        "systems/pf1/templates/internal/spell-description.hbs",
        item.spellDescriptionData
      );
      context.topDescription = await TextEditor.enrichHTML(desc, {
        rollData,
        async: true,
        relativeTo: this.actor,
      });

      // Enrich description
      if (itemData.shortDescription != null) {
        context.shortDescription = await TextEditor.enrichHTML(itemData.shortDescription, {
          rollData,
          secrets: context.owner,
          async: true,
          relativeTo: this.actor,
        });
      }

      // Reverse mapping of pf1.config.divineFocus for readability
      const dfVariants = { DF: 1, MDF: 2, FDF: 3 };
      itemData.components ??= {};
      const df = itemData.components.divineFocus;
      // Force intrinsic DF components
      if (df === dfVariants.MDF) itemData.components.material = true;
      if (df === dfVariants.FDF) itemData.components.focus = true;
    }

    // Prepare class specific stuff
    if (item.type === "class") {
      context.isMythicPath = itemData.subType === "mythic";

      for (const [a, s] of Object.entries(itemData.savingThrows)) {
        s.label = pf1.config.savingThrows[a];
      }
      for (const [a, s] of Object.entries(itemData.fc)) {
        s.label = pf1.config.favouredClassBonuses[a];
      }

      context.isBaseClass = itemData.subType === "base";
      context.isRacialHD = itemData.subType === "racial";

      if (actor) {
        const healthConfig = game.settings.get("pf1", "healthConfig");
        context.healthConfig = context.isRacialHD
          ? healthConfig.hitdice.Racial
          : actor.type === "character"
            ? healthConfig.hitdice.PC
            : healthConfig.hitdice.NPC;
      } else context.healthConfig = { auto: false };

      // Add skill list
      if (!actor) {
        context.skills = Object.entries(pf1.config.skills).reduce((cur, [skillId, label]) => {
          cur[skillId] = { name: label, classSkill: itemData.classSkills?.[skillId] === true };
          return cur;
        }, {});
      } else {
        // Get sorted skill list from config, custom skills get appended to bottom of list
        const skills = foundry.utils.mergeObject(foundry.utils.deepClone(pf1.config.skills), actorData.skills ?? {});
        context.skills = Object.entries(skills).reduce((cur, [skillId, skillData]) => {
          const name = pf1.config.skills[skillId] != null ? pf1.config.skills[skillId] : skillData.name;
          cur[skillId] = { name: name, classSkill: itemData.classSkills?.[skillId] === true };
          return cur;
        }, {});
      }
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

    // Prepare proficiencies & languages
    const profs = {
      armorProf: pf1.config.armorProficiencies,
      weaponProf: pf1.config.weaponProficiencies,
      languages: pf1.config.languages,
      weaponGroups: pf1.config.weaponGroups,
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
      if (trait.custom) {
        trait.custom
          .split(pf1.config.re.traitSeparator)
          .forEach((c, i) => (trait.selected[`custom${i + 1}`] = c.trim()));
      }
      trait.active = !foundry.utils.isEmpty(trait.selected);
    }

    // Prepare stuff for active effects on items
    if (item.changes) {
      context.changeGlobals = {
        targets: {},
        modifiers: pf1.config.bonusModifiers,
      };
      for (const [k, v] of Object.entries(pf1.config.buffTargets)) {
        context.changeGlobals.targets[k] = v._label;
      }

      const buffTargets = getBuffTargets(actor);
      context.changes =
        itemData.changes?.map((o) => {
          const target = buffTargets[o.subTarget];
          return {
            data: o,
            isValid: !!target,
            label: target?.label ?? o.subTarget,
            isScript: o.operator === "script",
          };
        }) ?? [];
    }

    // Prepare stuff for items with context notes
    if (itemData.contextNotes) {
      context.contextNotes = foundry.utils.deepClone(itemData.contextNotes);
      const noteTargets = getBuffTargets(actor, "contextNotes");
      context.contextNotes.forEach((o) => {
        const target = noteTargets[o.subTarget];
        o.isValid = !!target;
        o.label = target?.label ?? o.subTarget;
      });
    }

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

    // Add script calls
    await this._prepareScriptCalls(context);

    // Add links
    await this._prepareLinks(context);

    // Add actions
    this._prepareActions(context);

    context.distanceUnit = game.i18n.localize(
      getDistanceSystem() === "imperial" ? "PF1.DistFtShort" : "PF1.DistMShort"
    );

    // Prepare speeds
    if (item.type === "race") {
      context.speeds = [];
      for (const key of ["land", "fly", "swim", "climb", "burrow"]) {
        const value = item.system.speeds?.[key] ?? 0;
        if (value == 0) continue;
        context.speeds.push({
          value: pf1.utils.convertDistance(value)[0],
          mode: key,
          label: `PF1.Movement.Mode.${key}`,
        });
      }
    }

    // Content source, fill in from registry
    context.bookSource = foundry.utils.deepClone(itemData.source);
    if (context.bookSource?.id) {
      const rsource = pf1.registry.sources.get(itemData.source.id);
      if (rsource) {
        context.bookSource.title ||= rsource.name;
        context.bookSource.publisher ||= rsource.publisher;
        context.bookSource.errata ||= rsource.errata;
        context.bookSource.edition ||= rsource.edition;
        // Data only in registry
        context.bookSource.date = rsource.date;
        context.bookSource.abbr = rsource.abbr;
      }
    }

    return context;
  }

  _prepareMaterialsAndAddons(itemType, itemSubtype, subType, chosenMaterial = "") {
    const materialList = {};
    const addonList = [];
    const basicList = {};

    pf1.registry.materialTypes.forEach((material) => {
      if (this._isMaterialAllowed(itemType, itemSubtype, subType, material)) {
        materialList[material.id] = material.name;
      }

      if (
        material.addon && // Filter addons by chosen material
        !(
          (material.id === "alchemicalsilver" && ["adamantine", "coldiron", "mithral"].includes(chosenMaterial)) ||
          (material.id === "throneglass" && itemSubtype === "ranged") ||
          (["heatstoneplating", "lazurite", "sunsilk"].includes(material.id) && itemType === "weapon")
        )
      ) {
        addonList.push({ key: material.id, name: material.name });
      }

      if (material.basic) {
        // Filter basic materials
        basicList[material.id] = material.name;
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

  /**
   * Check if a given material is okay to be added to our materials list
   * for the item sheet.
   *
   * @param {string} itemType - Whether we're checking weapons or equipment
   * @param {string} itemSubtype - Item-specific typing to filter with
   * @param {string} subType - Only relevant with shields, since "other" is used in both shield and general gear
   * @param {pf1.registry.MaterialType} material - The Material object from the registry that has our needed metadata
   * @returns {boolean}
   */
  _isMaterialAllowed(itemType, itemSubtype, subType, material) {
    // Let's end this early if we can never be allowed
    if (material.addon || material.basic) return false;

    // Check whether the material is allowed for the given item
    switch (itemType) {
      case "weapon": {
        switch (itemSubtype) {
          case "light":
            return material.allowed.lightBlade;
          case "1h":
            return material.allowed.oneHandBlade;
          case "2h":
            return material.allowed.twoHandBlade;
          case "ranged":
            return material.allowed.rangedWeapon;
          case "all": // We're prepping an Attack and don't care (don't have the info anyways)
            return true;
          default:
            // Shouldn't find this
            return false;
        }
      }
      case "equipment": {
        if (subType === "shield") return material.allowed.buckler;
        return material.allowed[itemSubtype];
      }
    }

    return true; // Finally made it through the gauntlet!
  }

  _prepareLinks(data) {
    data.links = {
      list: [],
    };

    // Add charges link type
    if (["feat", "consumable", "attack", "equipment"].includes(this.item.type)) {
      data.links.list.push({
        id: "charges",
        label: game.i18n.localize("PF1.LinkTypeCharges"),
        help: game.i18n.localize("PF1.LinkHelpCharges"),
        items: [],
      });
    }

    // Add class associations
    if (this.item.type === "class") {
      data.links.list.push({
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
    data.links.list.push({
      id: "children",
      label: game.i18n.localize("PF1.LinkTypeChildren"),
      help: game.i18n.localize("PF1.LinkHelpChildren"),
      items: [],
    });

    data.links.list.push({
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
    for (const links of data.links.list) {
      const items = item.system.links?.[links.id] || [];
      for (let index = 0; index < items.length; index++) {
        const linkData = foundry.utils.deepClone(items[index]);
        linkData.index = index; // Record index so sorted lists maintain data cohesion

        const linkedItem = item.getLinkedItemSync(linkData);
        if (!linkedItem) linkData.broken = true;
        linkData.img = linkedItem?.img || ItemPF.DEFAULT_ICON;

        // Add item to stack
        links.items.push(linkData);
      }
    }
  }

  _prepareActions(data) {
    if (!data.system.actions) return [];
    const result = [];

    for (const d of data.system.actions) {
      const doc = this.object.actions.get(d._id);
      const obj = {
        data: d,
        isSelfCharged: doc.isSelfCharged,
      };

      result.push(obj);
    }

    data.actions = result;
  }

  _prepareItemFlags(data) {
    const flags = data.item.system.flags ?? {};
    data.flags ??= {};
    data.flags.boolean = flags.boolean ?? {};
    data.flags.dictionary = flags.dictionary ?? {};
  }

  async _prepareScriptCalls(data) {
    const categories = pf1.registry.scriptCalls.filter((scriptCallCategory) => {
      if (!scriptCallCategory.itemTypes.includes(this.document.type)) return false;
      return !(scriptCallCategory.hidden === true && !game.user.isGM);
    });
    // Don't show the Script Calls section if there are no categories for this item type
    if (!categories.length) {
      data.scriptCalls = null;
      return;
    }
    // Don't show the Script Calls section if players are not allowed to edit script macros
    if (!game.user.can("MACRO_SCRIPT")) {
      data.scriptCalls = null;
      return;
    }

    data.scriptCalls = {};

    // Prepare data to add
    const checkYes = '<i class="fas fa-check"></i>';
    const checkNo = '<i class="fas fa-times"></i>';

    // Iterate over all script calls, and adjust data
    const scriptCalls = Object.hasOwnProperty.call(this.document, "scriptCalls")
      ? foundry.utils.deepClone(Array.from(this.document.scriptCalls).map((o) => o.data))
      : [];

    // Add data
    for (const o of scriptCalls) o.hide = o.hidden && !game.user.isGM;

    // Create categories, and assign items to them
    for (const c of categories) {
      data.scriptCalls[c.id] = {
        name: game.i18n.localize(c.name),
        info: c.info ? game.i18n.localize(c.info) : null,
        items: scriptCalls.filter((o) => o.category === c.id),
        dataset: {
          category: c.id,
        },
      };
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the text item status which is shown beneath the Item type in the top-right corner of the sheet
   *
   * @param item
   * @returns {string}
   * @private
   */
  _getItemStatus(item) {
    const itemData = item.system;
    if (item.type === "spell") {
      const spellbook = this.item.spellbook;
      if (itemData.preparation.mode === "prepared") {
        if (spellbook?.spellPreparationMode === "spontaneous") {
          if (itemData.preparation.spontaneousPrepared) return game.i18n.localize("PF1.SpellPrepPrepared");
          else return game.i18n.localize("PF1.Unprepared");
        } else if (itemData.preparation.preparedAmount > 0)
          return game.i18n.format("PF1.AmountPrepared", { count: itemData.preparation.preparedAmount });
        else return game.i18n.localize("PF1.Unprepared");
      } else if (itemData.preparation.mode) {
        return itemData.preparation.mode.titleCase();
      }
    } else if (itemData.equipped !== undefined) {
      return itemData.equipped ? game.i18n.localize("PF1.Equipped") : game.i18n.localize("PF1.NotEquipped");
    }
  }

  /* -------------------------------------------- */

  /**
   * Get an array of item properties which are used in the small sidebar of the description tab
   *
   * @returns {string[]}
   * @private
   */
  _getItemProperties() {
    const props = [];
    const item = this.item;
    const labels = this.item.getLabels();

    if (item.type === "weapon") {
      props.push(
        ...Object.entries(item.system.properties)
          .filter((e) => e[1] === true)
          .map((e) => pf1.config.weaponProperties[e[0]])
      );
    } else if (item.type === "spell") {
      props.push(labels.components, labels.materials);
    } else if (item.type === "equipment") {
      const subType = item.subType;
      // Obfuscate wondrous item as clothing or other, if unidentified
      if (subType === "wondrous") {
        if (!item.showUnidentifiedData) {
          props.push(pf1.config.equipmentTypes.wondrous._label);
        } else {
          props.push(pf1.config.equipmentTypes.other._label);
        }
      } else {
        const subtypeLabels = pf1.config.equipmentTypes[subType];
        const typeLabel = subtypeLabels?.[item.system.equipmentSubtype] ?? subtypeLabels?._label;
        if (typeLabel) props.push(typeLabel);
      }
      // Add AC
      props.push(labels.armor);
    } else if (item.type === "feat") {
      props.push(labels.subType);
    }

    // Action type
    const itemActionTypes = item.actionTypes;
    if (itemActionTypes) {
      props.push(...itemActionTypes.map((o) => pf1.config.itemActionTypes[o]));
    }

    // Action usage
    if (item.type !== "weapon" && item.system.activation && !foundry.utils.isEmpty(item.system.activation)) {
      props.push(labels.activation, labels.range, labels.target, labels.duration);
    }

    // Tags
    const tags = item.system.tags;
    if (tags != null) {
      props.push(...tags);
    }

    return props.filter((p) => !!p);
  }

  /* -------------------------------------------- */

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
      }

      foundry.utils.setProperty(system, key, Math.max(0, newValue));
    }

    // Adjust Material Addons
    // The available addons can change depending in the chosen material,
    // so we need to get the values to build the addons on the item.
    const material = system.material;
    if (material?.addon) {
      // Convert to array
      material.addon = Object.values(material.addon);
    }

    // Update the Item
    return super._updateObject(event, formData);
  }

  /* -------------------------------------------- */

  /**
   * Activate listeners for interactive item sheet events
   *
   * @param html
   */
  activateListeners(html) {
    super.activateListeners(html);

    const hasActor = !!this.actor;

    // Tooltips
    html.mousemove((ev) => this._moveTooltips(ev));

    // Edit action
    html.find(".actions .item-list .item").on("contextmenu", this._onActionEdit.bind(this));

    // Item summaries
    html.find(".item .item-name h4").on("click", (event) => this._onItemSummary(event));

    // Action control
    html.find(".action-controls a").on("click", this._onActionControl.bind(this));

    // Open help browser
    html.find("a.help-browser[data-url]").click(this._openHelpBrowser.bind(this));

    // Open entry/trait editor/viewer
    html.find(".entry-selector").click(this._onEntrySelector.bind(this));
    html.find(".trait-selector").click(this._onTraitSelector.bind(this));

    // Content source editor
    html
      .find(".content-source .control .edit")
      .click(() => ContentSourceEditor.open(this.document, { editable: this.isEditable }));

    // Mark proficiency in indeterminate state if not forced but actor has it.
    if (
      hasActor &&
      this.item.system.proficient === false &&
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
        if (broken) broken.indeterminate = true;
      }
    }

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) {
      html.find("span.text-box").addClass("readonly");
      return;
    }

    // Trigger form submission from textarea elements.
    html.find("textarea").change(this._onSubmit.bind(this));

    // Add drop handler to textareas
    html.find("textarea, .notes input[type='text']").on("drop", this._onTextAreaDrop.bind(this));

    // Modify buff changes
    html.find(".change-control").click(this._onBuffControl.bind(this));
    html.find(".change .change-target").click(this._onChangeTargetControl.bind(this));

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

    // Listen to field entries
    html.find(".entry-control a").click(this._onEntryControl.bind(this));
    html.find(".item-selector").click(this._onItemSelector.bind(this));

    // Add drop handler to link tabs
    html.find('div[data-group="links"],a.item[data-tab="links"]').on("drop", this._onLinksDrop.bind(this));

    html.find(".link-control").click(this._onLinkControl.bind(this));

    // Click to change text input
    html.find('*[data-action="input-text"]').click((event) => this._onInputText(event));

    // Select the whole text on click
    html.find(".select-on-click").click(this._selectOnClick.bind(this));

    // Edit change script contents
    html.find(".edit-change-contents").on("click", this._onEditChangeScriptContents.bind(this));

    html.find(".speed-editor").click(this._onSpeedEdit.bind(this));

    // Linked item clicks
    html.find(".tab[data-tab='links'] .links-item .links-item-name").on("contextmenu", this._openLinkedItem.bind(this));

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
    /*  Links
    /* -------------------------------------------- */

    html.find('a[data-action="compendium"]').click(this._onOpenCompendium.bind(this));

    /* -------------------------------------------- */
    /*  Script Calls
    /* -------------------------------------------- */

    html.find(".script-calls .item-control").click(this._onScriptCallControl.bind(this));

    html.find(".script-calls .item-list .item").contextmenu(this._onScriptCallEdit.bind(this));

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
      prevValue = foundry.utils.getProperty(this.document, name) ?? "";
      if (typeof prevValue !== "string") prevValue = prevValue.toString();

      if (name.endsWith(".value") && !noCap) {
        const maxName = name.replace(/\.value$/, ".max");
        maxValue = foundry.utils.getProperty(this.document, maxName);
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
    const actionId = el.closest(".item").dataset.itemId;
    const action = this.document.actions.get(actionId);

    this._mouseWheelAdd(event, el);

    const value = el.tagName === "INPUT" ? Number(el.value) : Number(el.innerText);
    this.setActionUpdate(action.id, "uses.self.value", value);

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      el.addEventListener("mouseleave", () => this._updateActions(), { passive: true, once: true });
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
      const action = this.document.actions.get(d._id);
      if (!action) {
        console.error("Item update for non-existing item:", d._id, d);
        continue;
      }
      await action.update(d);
    }
  }

  /* -------------------------------------------- */

  _onOpenCompendium(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const target = a.dataset.actionTarget;

    pf1.applications.compendiums[target].render(true, { focus: true });
  }

  async _onScriptCallControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const item = this.document.scriptCalls ? this.document.scriptCalls.get(a.closest(".item")?.dataset.itemId) : null;
    const group = a.closest(".item-list");
    const category = group.dataset.category;

    // Create item
    if (a.classList.contains("item-create")) {
      await this._onSubmit(event, { preventRender: true });
      return pf1.components.ItemScriptCall.create([{ category, type: "script" }], { parent: this.item });
    }
    // Delete item
    else if (item && a.classList.contains("item-delete")) {
      const list = (this.document.system.scriptCalls || []).filter((o) => o._id !== item.id);
      return this._onSubmit(event, { updateData: { "system.scriptCalls": list } });
    }
    // Edit item
    else if (item && a.classList.contains("item-edit")) {
      item.edit();
    }
    // Toggle hidden
    else if (item && a.classList.contains("item-hide")) {
      item.update({
        hidden: !item.hidden,
      });
    }
  }

  _onScriptCallEdit(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const item = this.document.scriptCalls ? this.document.scriptCalls.get(a.dataset.itemId) : null;

    if (item) {
      item.edit();
    }
  }

  _moveTooltips(event) {
    const elem = $(event.currentTarget);
    const x = event.clientX;
    const y = event.clientY + 24;
    elem.find(".tooltip:hover .tooltipcontent").css("left", `${x}px`).css("top", `${y}px`);
  }

  async _onTextAreaDrop(event) {
    event.preventDefault();

    const eventData = TextEditor.getDragEventData(event.originalEvent);
    if (!eventData) return;

    const elem = event.currentTarget;
    const link = await TextEditor.getContentLink(eventData, { relativeTo: this.actor });

    // Insert link
    if (link) {
      elem.value = !elem.value ? link : elem.value + "\n" + link;
    }
    return this._onSubmit(event);
  }

  async _onScriptCallDrop(event) {
    event.preventDefault();

    const eventData = TextEditor.getDragEventData(event.originalEvent);
    if (!eventData) return;

    const { uuid, type } = eventData;
    if (type !== "Macro") return;

    // Submit data
    if (uuid) {
      const elem = event.currentTarget;
      const category = elem.dataset.category;
      const list = this.document.system.scriptCalls ?? [];
      await this._onSubmit(event, { preventRender: true });
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

  async _onLinksDrop(event) {
    const elem = event.currentTarget;
    let linkType = elem.dataset.tab;

    // Default selection for dropping on tab instead of body
    if (linkType === "links") linkType = "children";

    // Try to extract the data
    const data = TextEditor.getDragEventData(event.originalEvent);
    if (!data.type) return;

    const targetItem = await fromUuid(data.uuid);
    if (!targetItem) return;

    let dataType,
      itemLink = data.uuid;
    // Case 1 - Import from a Compendium pack
    if (targetItem.pack) {
      dataType = "compendium";
    }
    // Case 2 - Import from same actor
    else if (targetItem.actor === this.document.actor) {
      dataType = "data";
      itemLink = targetItem.id;
    }

    // Case 3 - Import from World Document
    else {
      dataType = "world";
    }

    await this.item.createItemLink(linkType, dataType, targetItem, itemLink);
  }

  /**
   * By default, returns true only for GM
   *
   * @override
   */
  _canDragStart(selector) {
    return true;
  }

  _onDragStart(event) {
    const elem = event.currentTarget;

    // Drag action
    if (elem.dataset?.itemId) {
      const action = this.item.actions.get(elem.dataset.itemId);
      const obj = { type: "action", uuid: this.item.uuid, actionId: action.id, data: action.data };
      event.dataTransfer.setData("text/plain", JSON.stringify(obj));
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

  async _onDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (e) {
      return false;
    }
    const { type, uuid, actionId } = data;

    const item = this.item;

    // Handle actions
    if (type === "action") {
      const srcItem = await fromUuid(uuid);

      // Re-order
      if (srcItem === item) {
        const targetActionID = event.target?.closest("li.action-part")?.dataset?.itemId;
        const prevActions = foundry.utils.deepClone(item.system.actions);

        let targetIdx;
        if (!targetActionID) targetIdx = prevActions.length - 1;
        else targetIdx = prevActions.indexOf(prevActions.find((o) => o._id === targetActionID));
        const srcIdx = prevActions.indexOf(prevActions.find((o) => o._id === actionId));

        const [actionData] = prevActions.splice(srcIdx, 1);
        prevActions.splice(targetIdx, 0, actionData);
        await this.object.update({ "system.actions": prevActions });
      }

      // Add to another item
      else {
        const prevActions = foundry.utils.deepClone(this.object.system.actions ?? []);
        data.data._id = foundry.utils.randomID(16);
        prevActions.splice(prevActions.length, 0, data.data);
        await this.object.update({ "system.actions": prevActions });
      }
    }
  }

  async _onEditChangeScriptContents(event) {
    const elem = event.currentTarget;
    const changeId = elem.closest(".change").dataset.change;
    const change = this.item.changes.find((change) => change._id === changeId);

    if (!change) return;

    const scriptEditor = new ScriptEditor({ command: change.formula, parent: this.object }).render(true);
    const result = await scriptEditor.awaitResult();
    if (typeof result?.command === "string") {
      return change.update({ formula: result.command });
    }
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
    const label = a.closest("div.form-group").querySelector("label"); // TODO: Do not rely on HTML layout
    const options = {
      name: a.dataset.for,
      title: label.innerText,
      subject: a.dataset.options,
      choices: pf1.config[a.dataset.options],
    };
    new ActorTraitSelector(this.object, options).render(true);
  }

  _onSpeedEdit(event) {
    event.preventDefault();

    let app = Object.values(ui.windows).find(
      (oldApp) => oldApp instanceof SpeedEditor && oldApp.document === this.document
    );
    app ??= new SpeedEditor(this.document);
    app.render(true, { focus: true });
  }

  /**
   * Toggle inline display of an item's summary/description by expanding or hiding info div
   *
   * @param {JQuery.ClickEvent<HTMLElement>} event - The click event on the item
   * @private
   */
  _onItemSummary(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest(".item:not(.sheet)");
    // Check whether pseudo-item belongs to another collection
    const collection = li.attr("data-item-collection") ?? "items";
    const item = this.document[collection].get(li.attr("data-item-id"));
    // For actions (embedded into a parent item), show only the action's summary instead of a complete one
    const isAction = collection === "actions";
    const { description, actionDescription, properties } = item.getChatData({ chatcard: false });

    // Toggle summary
    if (li.hasClass("expanded")) {
      const summary = li.children(".item-summary");
      summary.slideUp(200, () => summary.remove());
    } else {
      const div = $(`<div class="item-summary">${isAction ? actionDescription : description}</div>`);
      const props = $(`<div class="item-properties tag-list"></div>`);
      // Transform properties into a tag list containing HTML, and append to div
      properties?.forEach((p) => props.append(`<span class="tag">${p}</span>`));
      div.append(props);
      li.append(div.hide());
      div.slideDown(200);
    }
    li.toggleClass("expanded");
  }

  /**
   * Open linked item sheet.
   *
   * @param {Event} event
   */
  async _openLinkedItem(event) {
    event.preventDefault();
    const el = event.target.closest(".links-item[data-uuid],.links-item[data-item-id]");
    const { uuid, itemId } = el.dataset;

    let item;
    if (itemId) item = this.item.actor.items.get(itemId);
    else item = await fromUuid(uuid);
    item.sheet.render(true, { focus: true });
  }

  async _onActionControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Edit action
    if (a.classList.contains("edit-action")) {
      return this._onActionEdit(event);
    }

    if (!this.isEditable) return;

    // Add action
    if (a.classList.contains("add-action")) {
      const newActionData = {
        img: this.item.img,
        name: ["weapon", "attack"].includes(this.item.type)
          ? game.i18n.localize("PF1.Attack")
          : game.i18n.localize("PF1.Use"),
      };
      await this._onSubmit(event, { preventRender: true });
      return pf1.components.ItemAction.create([newActionData], { parent: this.item });
    }

    // Remove action
    if (a.classList.contains("delete-action")) {
      const li = a.closest(".action-part");
      const action = this.item.actions.get(li.dataset.itemId);

      const deleteItem = async () => {
        return action.delete();
      };

      if (getSkipActionPrompt()) {
        deleteItem();
      } else {
        const msg = `<p>${game.i18n.localize("PF1.DeleteItemConfirmation")}</p>`;
        Dialog.confirm({
          title: game.i18n.format("PF1.DeleteItemTitle", { name: action.name }),
          content: msg,
          yes: () => {
            deleteItem();
          },
          rejectClose: true,
        });
      }
    }

    // Duplicate action
    if (a.classList.contains("duplicate-action")) {
      const li = a.closest(".action-part");
      const action = foundry.utils.deepClone(this.item.actions.get(li.dataset.itemId).data);
      action.name = `${action.name} (${game.i18n.localize("PF1.Copy")})`;
      action._id = foundry.utils.randomID(16);
      const actionParts = foundry.utils.deepClone(this.item.system.actions ?? []);
      actionParts.push(action);
      return this._onSubmit(event, { updateData: { "system.actions": actionParts } });
    }
  }

  async _onActionEdit(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const li = a.closest(".action-part");
    const action = this.item.actions.get(li.dataset.itemId);

    // Find existing window
    for (const app of Object.values(this.item.apps)) {
      if (app.object === action) {
        app.render(true, { focus: true });
        return;
      }
    }

    // Open new window
    action.sheet.render(true);
  }

  async _onBuffControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new change
    if (a.classList.contains("add-change")) {
      await this._onSubmit(event, { preventRender: true });
      return pf1.components.ItemChange.create([{}], { parent: this.item });
    }

    // Remove a change
    if (a.classList.contains("delete-change")) {
      const li = a.closest(".change");
      const changeId = li.dataset.change;

      const changes = foundry.utils.deepClone(this.item.system.changes ?? []);
      changes.findSplice((c) => c._id === changeId);

      return this._onSubmit(event, { updateData: { "system.changes": changes } });
    }
  }
  _onChangeTargetControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Prepare categories and changes to display
    const changeId = a.closest(".change").dataset.change;
    const change = this.item.changes.get(changeId);
    const categories = getBuffTargetDictionary(this.item.actor);

    const part1 = change?.subTarget?.split(".")[0];
    const category = pf1.config.buffTargets[part1]?.category ?? part1;

    // Show widget
    const w = new Widget_CategorizedItemPicker(
      { title: "PF1.Application.ChangeTargetSelector.Title", classes: ["change-target-selector"] },
      categories,
      (key) => {
        if (key) {
          change.update({ subTarget: key });
        }
      },
      { category, item: change?.subTarget }
    );
    w.render(true);
  }

  async _onNoteControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new note
    if (a.classList.contains("add-note")) {
      const contextNotes = foundry.utils.deepClone(this.item.system.contextNotes || []);
      contextNotes.push(ItemPF.defaultContextNote);
      await this._onSubmit(event, { updateData: { "system.contextNotes": contextNotes } });
    }

    // Remove a note
    if (a.classList.contains("delete-note")) {
      const li = a.closest(".context-note");
      const contextNotes = foundry.utils.deepClone(this.item.system.contextNotes || []);
      contextNotes.splice(Number(li.dataset.note), 1);
      await this._onSubmit(event, {
        updateData: { "system.contextNotes": contextNotes },
      });
    }
  }

  _onNoteTargetControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Prepare categories and changes to display
    const li = a.closest(".context-note");
    const noteIndex = Number(li.dataset.note);
    const note = this.item.system.contextNotes[noteIndex];
    const categories = getBuffTargetDictionary(this.item.actor, "contextNotes");

    const part1 = note?.subTarget?.split(".")[0];
    const category = pf1.config.contextNoteTargets[part1]?.category ?? part1;

    // Show widget
    const w = new Widget_CategorizedItemPicker(
      { title: "PF1.Application.ContextNoteTargetSelector.Title" },
      categories,
      (key) => {
        if (key) {
          const updateData = {};
          updateData[`system.contextNotes.${noteIndex}.subTarget`] = key;
          this.item.update(updateData);
        }
      },
      { category, item: note?.subTarget }
    );
    w.render(true);
  }

  async _onLinkControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Delete link
    if (a.classList.contains("delete-link")) {
      const li = a.closest(".links-item");
      const group = a.closest('div[data-group="links"]');
      const linkType = group.dataset.tab;

      await this._onSubmit(event, { preventRender: true });

      let links = foundry.utils.deepClone(this.item.system.links?.[linkType] ?? []);
      const { uuid, itemId } = li.dataset;
      const link = links.find((o) => {
        if (uuid) return o.uuid === uuid;
        if (itemId) return o.id === itemId;
        return false;
      });
      links = links.filter((o) => o !== link);

      const updateData = {};
      updateData[`system.links.${linkType}`] = links;

      // Call hook for deleting a link
      Hooks.callAll("pf1DeleteItemLink", this.item, link, linkType);

      await this.document.update(updateData);
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
      },
      { once: true, passive: true }
    );
  }

  async _createAttack(event) {
    if (this.item.actor == null) throw new Error(game.i18n.localize("PF1.ErrorItemNoOwner"));

    await this._onSubmit(event, { preventRender: true });

    await this.item.actor.createAttackFromWeapon(this.item);
  }

  async _createSpellbook(event) {
    event.preventDefault();
    if (this.item.actor == null) throw new Error(game.i18n.localize("PF1.ErrorItemNoOwner"));
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
    if (!this.item.isOwner) return void ui.notifications.warn("Insufficient permissions to modify item.");
    if (!this.actor) return void ui.notifications.warn("No actor to find items from.");

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

  _onEntryControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const key = a.closest(".notes").dataset.name;

    if (a.classList.contains("add-entry")) {
      const notes = foundry.utils.deepClone(foundry.utils.getProperty(this.document, key) ?? []);
      notes.push("");
      const updateData = { [key]: notes };
      return this._onSubmit(event, { updateData });
    } else if (a.classList.contains("delete-entry")) {
      const index = a.closest(".entry").dataset.index;
      const notes = foundry.utils.deepClone(foundry.utils.getProperty(this.document, key) ?? []);
      notes.splice(index, 1);
      const updateData = { [key]: notes };
      return this._onSubmit(event, { updateData });
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
