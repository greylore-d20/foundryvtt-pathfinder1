import { createTabs, getBuffTargetDictionary, getBuffTargets } from "../../lib.js";
import { EntrySelector } from "../../apps/entry-selector.js";
import { ItemPF } from "../entity.js";
import { ItemChange } from "../components/change.js";
import { ItemScriptCall } from "../components/script-call.js";
import { ScriptEditor } from "../../apps/script-editor.js";
import { ActorTraitSelector } from "../../apps/trait-selector.js";
import { Widget_CategorizedItemPicker } from "../../widgets/categorized-item-picker.js";
import { PF1_HelpBrowser } from "../../apps/help-browser.js";

/**
 * Override and extend the core ItemSheet implementation to handle game system specific item types
 *
 * @type {ItemSheet}
 */
export class ItemSheetPF extends ItemSheet {
  constructor(...args) {
    super(...args);

    /**
     * Track the set of item filters which are applied
     *
     * @type {Set}
     */
    this._filters = {
      search: "",
    };

    /** Item search */
    this.searchCompositioning = false; // for IME
    this.searchRefresh = true; // Lock out same term search unless sheet also refreshes
    this.searchDelay = 250; // arbitrary ?ms for arbitrarily decent reactivity; MMke this configurable?
    this.searchDelayEvent = null; // setTimeout id
    this.effectiveSearch = ""; // prevent searching the same thing

    this.items = [];

    /**
     * Tracks the application IDs associated with this sheet.
     *
     * @type {Application[]}
     */
    this._openApplications = [];
  }

  /* -------------------------------------------- */

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      width: 580,
      classes: ["pf1", "sheet", "item"],
      scrollY: [".tab.details", ".buff-flags", '.tab[data-tab="changes"]'],
      dragDrop: [
        {
          dragSelector: "li.conditional",
          dropSelector: 'div[data-tab="conditionals"]',
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
    const path = "systems/pf1/templates/items/";
    return `${path}/${this.item.data.type}.hbs`;
  }

  get actor() {
    let actor = this.item.actor;
    let p = this.parentItem;
    while (!actor && p) {
      actor = p.actor;
      p = p.parentItem;
    }

    return actor;
  }

  /* -------------------------------------------- */

  /**
   * Prepare item sheet data
   * Start with the base item data and extending with additional properties for rendering.
   */
  async getData() {
    const data = await super.getData();
    data.data = data.data.data;
    const rollData = this.item.getRollData();
    data.labels = this.item.labels;

    // Include sub-items
    data.items = [];
    if (this.item.items != null) {
      data.items = this.item.items.map((i) => {
        i.data.labels = i.labels;
        return i.data;
      });
    }

    // Include CONFIG values
    data.config = CONFIG.PF1;

    // Item Type, Status, and Details
    data.itemType = this._getItemType(data.item);
    data.itemStatus = this._getItemStatus(data.item);
    data.itemProperties = this._getItemProperties(data.item);
    data.itemName = data.item.name;
    data.isPhysical = hasProperty(data.item.data, "data.quantity");
    data.isSpell = this.item.type === "spell";
    data.owned = this.item.actor != null;
    data.parentOwned = this.actor != null;
    data.owner = this.item.isOwner;
    data.isGM = game.user.isGM;
    data.showIdentifyDescription = data.isGM && data.isPhysical;
    data.showUnidentifiedData = this.item.showUnidentifiedData;
    data.unchainedActionEconomy = game.settings.get("pf1", "unchainedActionEconomy");
    data.hasActivationType =
      (game.settings.get("pf1", "unchainedActionEconomy") &&
        getProperty(data.item.data, "data.unchainedAction.activation.type")) ||
      (!game.settings.get("pf1", "unchainedActionEconomy") && getProperty(data.item.data, "data.activation.type"));
    if (rollData.item.auraStrength != null) {
      const auraStrength = rollData.item.auraStrength;
      data.auraStrength = auraStrength;

      if (CONFIG.PF1.auraStrengths[auraStrength] != null) {
        const auraStrength_name = CONFIG.PF1.auraStrengths[auraStrength];
        data.auraStrength_name = auraStrength_name;

        data.labels.identify = game.i18n.localize("PF1.IdentifyDCNumber").format(15 + rollData.item.cl);
        // const auraSchool = CONFIG.PF1.spellSchools[rollData.item.aura.school];
        // data.labels.aura = `${auraStrength_name} ${auraSchool}`;
      }
    }

    // Unidentified data
    if (this.item.showUnidentifiedData) {
      data.itemName =
        getProperty(this.item.data, "data.unidentified.name") ||
        getProperty(this.item.data, "data.identifiedName") ||
        this.item.name;
    } else {
      data.itemName = getProperty(this.item.data, "data.identifiedName") || this.item.name;
    }

    // Action Details
    data.hasAttackRoll = this.item.hasAttack;
    data.isHealing = data.item.data.actionType === "heal";
    data.isCombatManeuver = ["mcman", "rcman"].includes(data.item.data.actionType);

    data.isCharged = false;
    if (data.item.data.data.uses != null) {
      data.isCharged = ["day", "week", "charges"].includes(data.item.data.data.uses.per);
    }
    if (data.item.data.data.range != null) {
      data.canInputRange = ["ft", "mi", "spec"].includes(data.item.data.data.range.units);
      data.canInputMinRange = ["ft", "mi", "spec"].includes(data.item.data.data.range.minUnits);
    }
    if (data.item.data.data.duration != null) {
      data.canInputDuration = !["", "inst", "perm", "seeText"].includes(data.item.data.data.duration.units);
    }

    // Show additional ranged properties
    data.showMaxRangeIncrements = getProperty(this.item.data, "data.range.units") === "ft";

    // Prepare feat specific stuff
    if (data.item.type === "feat") {
      data.isClassFeature = getProperty(this.item.data, "data.featType") === "classFeat";
      data.isTemplate = getProperty(this.item.data, "data.featType") === "template";
    }

    // Prepare weapon specific stuff
    if (data.item.type === "weapon") {
      data.isRanged = data.item.data.data.weaponSubtype === "ranged" || data.item.data.data.properties["thr"] === true;

      // Prepare categories for weapons
      data.weaponCategories = { types: {}, subTypes: {} };
      for (const [k, v] of Object.entries(CONFIG.PF1.weaponTypes)) {
        if (typeof v === "object") data.weaponCategories.types[k] = v._label;
      }
      const type = data.item.data.data.weaponType;
      if (hasProperty(CONFIG.PF1.weaponTypes, type)) {
        for (const [k, v] of Object.entries(CONFIG.PF1.weaponTypes[type])) {
          // Add static targets
          if (!k.startsWith("_")) data.weaponCategories.subTypes[k] = v;
        }
      }
    }

    // Prepare equipment specific stuff
    if (data.item.type === "equipment") {
      // Prepare categories for equipment
      data.equipmentCategories = { types: {}, subTypes: {} };
      for (const [k, v] of Object.entries(CONFIG.PF1.equipmentTypes)) {
        if (typeof v === "object") data.equipmentCategories.types[k] = v._label;
      }
      const type = data.item.data.data.equipmentType;
      if (hasProperty(CONFIG.PF1.equipmentTypes, type)) {
        for (const [k, v] of Object.entries(CONFIG.PF1.equipmentTypes[type])) {
          // Add static targets
          if (!k.startsWith("_")) data.equipmentCategories.subTypes[k] = v;
        }
      }

      // Prepare slots for equipment
      data.equipmentSlots = CONFIG.PF1.equipmentSlots[type];

      // Whether the equipment should show armor data
      data.showArmorData = ["armor", "shield"].includes(type);

      // Whether the current equipment type has multiple slots
      data.hasMultipleSlots = Object.keys(data.equipmentSlots).length > 1;
    }

    // Prepare attack specific stuff
    if (data.item.type === "attack") {
      data.isWeaponAttack = data.item.data.data.attackType === "weapon";
      data.isNaturalAttack = data.item.data.data.attackType === "natural";
    }

    // Prepare spell specific stuff
    if (data.item.type === "spell") {
      let spellbook = null;
      if (this.actor != null) {
        spellbook = getProperty(this.actor.data, `data.attributes.spells.spellbooks.${this.item.data.data.spellbook}`);
      }

      data.isPreparedSpell = spellbook != null ? !spellbook.spontaneous : false;
      data.isAtWill = data.item.data.atWill;
      data.spellbooks = {};
      if (this.actor) {
        data.spellbooks = duplicate(this.actor.data.data.attributes.spells.spellbooks);
      }

      // Enrich description
      if (data.data.shortDescription != null) {
        data.shortDescription = TextEditor.enrichHTML(data.data.shortDescription, { rollData });
      }
    }

    // Prepare class specific stuff
    if (data.item.type === "class") {
      data.isMythicPath = data.data.classType === "mythic";

      for (const [a, s] of Object.entries(data.data.savingThrows)) {
        s.label = CONFIG.PF1.savingThrows[a];
      }
      for (const [a, s] of Object.entries(data.data.fc)) {
        s.label = CONFIG.PF1.favouredClassBonuses[a];
      }

      data.isBaseClass = data.data.classType === "base";
      data.isRacialHD = data.data.classType === "racial";

      if (this.actor != null) {
        const healthConfig = game.settings.get("pf1", "healthConfig");
        data.healthConfig = data.isRacialHD
          ? healthConfig.hitdice.Racial
          : this.actor.data.type === "character"
          ? healthConfig.hitdice.PC
          : healthConfig.hitdice.NPC;
      } else data.healthConfig = { auto: false };

      // Add skill list
      if (!this.actor) {
        data.skills = Object.entries(CONFIG.PF1.skills).reduce((cur, o) => {
          cur[o[0]] = { name: o[1], classSkill: getProperty(this.item.data, `data.classSkills.${o[0]}`) === true };
          return cur;
        }, {});
      } else {
        // Get sorted skill list from config, custom skills get appended to bottom of list
        const skills = mergeObject(duplicate(CONFIG.PF1.skills), this.actor.data.data.skills);
        data.skills = Object.entries(skills).reduce((cur, o) => {
          const key = o[0];
          const name = CONFIG.PF1.skills[key] != null ? CONFIG.PF1.skills[key] : o[1].name;
          cur[o[0]] = { name: name, classSkill: getProperty(this.item.data, `data.classSkills.${o[0]}`) === true };
          return cur;
        }, {});
      }
    }

    // Prepare proficiencies
    const profs = {
      armorProf: CONFIG.PF1.armorProficiencies,
      weaponProf: CONFIG.PF1.weaponProficiencies,
    };
    for (const [t, choices] of Object.entries(profs)) {
      if (hasProperty(data.item.data.data, t)) {
        const trait = data.data[t];
        if (!trait) continue;
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
            .split(CONFIG.PF1.re.traitSeparator)
            .forEach((c, i) => (trait.selected[`custom${i + 1}`] = c.trim()));
        }
        trait.cssClass = !isObjectEmpty(trait.selected) ? "" : "inactive";
      }
    }

    // Prepare stuff for active effects on items
    if (this.item.changes) {
      data.changeGlobals = {
        targets: {},
        modifiers: CONFIG.PF1.bonusModifiers,
      };
      for (const [k, v] of Object.entries(CONFIG.PF1.buffTargets)) {
        if (typeof v === "object") data.changeGlobals.targets[k] = v._label;
      }

      const buffTargets = getBuffTargets(this.item.actor);
      data.changes = data.item.data.data.changes.reduce((cur, o) => {
        const obj = { data: o };

        obj.subTargetLabel = buffTargets[o.subTarget]?.label;
        obj.isScript = obj.data.operator === "script";

        cur.push(obj);
        return cur;
      }, []);
    }

    // Prepare stuff for attacks with conditionals
    if (data.data.conditionals) {
      data.conditionals = { targets: {}, conditionalModifierTypes: {} };
      for (const conditional of data.data.conditionals) {
        for (const modifier of conditional.modifiers) {
          modifier.targets = this.item.getConditionalTargets();
          modifier.subTargets = this.item.getConditionalSubTargets(modifier.target);
          modifier.conditionalModifierTypes = this.item.getConditionalModifierTypes(modifier.target);
          modifier.conditionalCritical = this.item.getConditionalCritical(modifier.target);
          modifier.isAttack = modifier.target === "attack";
          modifier.isDamage = modifier.target === "damage";
          modifier.isSize = modifier.target === "size";
          modifier.isSpell = modifier.target === "spell";
        }
      }
    }

    // Prepare stuff for items with context notes
    if (data.item.data.data.contextNotes) {
      data.contextNotes = duplicate(data.item.data.data.contextNotes);
      const noteTargets = getBuffTargets(this.item.actor, "contextNotes");
      data.contextNotes.forEach((o) => {
        o.label = noteTargets[o.subTarget]?.label;
      });
    }

    // Add distance units
    data.distanceUnits = duplicate(CONFIG.PF1.distanceUnits);
    if (this.item.type !== "spell") {
      for (const d of ["close", "medium", "long"]) {
        delete data.distanceUnits[d];
      }
    }

    // Parse notes
    if (data.item.data.data.attackNotes) {
      const value = data.item.data.data.attackNotes;
      setProperty(data, "notes.attack", value);
    }

    // Add item flags
    this._prepareItemFlags(data);

    // Add script calls
    await this._prepareScriptCalls(data);

    // Add links
    await this._prepareLinks(data);

    return data;
  }

  async _prepareLinks(data) {
    data.links = {
      list: [],
    };

    // Add children link type
    data.links.list.push({
      id: "children",
      label: game.i18n.localize("PF1.LinkTypeChildren"),
      help: game.i18n.localize("PF1.LinkHelpChildren"),
      items: [],
    });

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

    // Add ammunition links
    if (this.item.type === "attack") {
      data.links.list.push({
        id: "ammunition",
        label: game.i18n.localize("PF1.LinkTypeAmmunition"),
        help: game.i18n.localize("PF1.LinkHelpAmmunition"),
        fields: {
          recoverChance: {
            type: "Number",
            label: game.i18n.localize("PF1.RecoverChancePercentage"),
          },
        },
        items: [],
      });
    }

    // Post process data
    for (const l of data.links.list) {
      const items = getProperty(this.item.data, `data.links.${l.id}`) || [];
      for (let a = 0; a < items.length; a++) {
        const i = items[a];
        i._index = a;

        // Add item to stack
        l.items.push(i);
      }

      // Sort items
      if (l.id === "classAssociations") {
        l.items = l.items.sort((a, b) => {
          return a.level - b.level;
        });
      }
    }

    await this.item.updateLinkItems();
  }

  _prepareItemFlags(data) {
    // Add boolean flags
    {
      const flags = getProperty(data.item.data, "data.flags.boolean") || [];
      setProperty(data, "flags.boolean", flags);
    }

    // Add dictionary flags
    {
      const flags = getProperty(data.item.data, "data.flags.dictionary") || [];
      const result = [];
      for (const [k, v] of flags) {
        result.push({ key: k, value: v });
      }
      setProperty(data, "flags.dictionary", result);
    }
  }

  async _prepareScriptCalls(data) {
    const categories = game.pf1.registry.getItemScriptCategories().filter((o) => {
      if (!o.itemTypes.includes(this.document.type)) return false;
      if (o.hidden === true && !game.user.isGM) return false;
      return true;
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
      ? duplicate(Array.from(this.document.scriptCalls).map((o) => o.data))
      : [];
    {
      const promises = [];
      for (const o of scriptCalls) {
        promises.push(
          (async () => {
            // Obtain macro info
            if (o.type === "macro") {
              const m = await fromUuid(o.value);
              o.name = m.data.name;
              o.img = m.data.img;
            }

            // Add data
            o.hiddenIcon = o.hidden ? checkYes : checkNo;
            o.hide = o.hidden && !game.user.isGM;
          })()
        );
      }
      await Promise.all(promises);
    }

    // Create categories, and assign items to them
    for (const c of categories) {
      data.scriptCalls[c.key] = {
        name: game.i18n.localize(c.name),
        info: c.info ? game.i18n.localize(c.info) : null,
        items: scriptCalls.filter((o) => o.category === c.key),
        dataset: {
          category: c.key,
        },
      };
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the text item type which is shown in the top-right corner of the sheet
   *
   * @param item
   * @returns {string}
   * @private
   */
  _getItemType(item) {
    const typeKeys = Object.keys(CONFIG.PF1.itemTypes);
    let itemType = item.type;
    if (!typeKeys.includes(itemType)) itemType = typeKeys[0];
    return game.i18n.localize(CONFIG.PF1.itemTypes[itemType]);
  }

  /**
   * Get the text item status which is shown beneath the Item type in the top-right corner of the sheet
   *
   * @param item
   * @returns {string}
   * @private
   */
  _getItemStatus(item) {
    if (item.type === "spell") {
      const spellbook = this.item.spellbook;
      if (item.data.data.preparation.mode === "prepared") {
        if (item.data.data.preparation.preparedAmount > 0) {
          if (spellbook != null && spellbook.spontaneous) {
            return game.i18n.localize("PF1.SpellPrepPrepared");
          } else {
            return game.i18n.localize("PF1.AmountPrepared").format(item.data.data.preparation.preparedAmount);
          }
        }
        return game.i18n.localize("PF1.Unprepared");
      } else if (item.data.data.preparation.mode) {
        return item.data.data.preparation.mode.titleCase();
      } else return "";
    } else if (
      ["weapon", "equipment"].includes(item.type) ||
      (item.type === "loot" && item.data.data.subType === "gear")
    ) {
      return item.data.data.equipped ? game.i18n.localize("PF1.Equipped") : game.i18n.localize("PF1.NotEquipped");
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the Array of item properties which are used in the small sidebar of the description tab
   *
   * @param item
   * @returns {Array}
   * @private
   */
  _getItemProperties(item) {
    const props = [];
    const labels = this.item.labels;

    if (item.type === "weapon") {
      props.push(
        ...Object.entries(item.data.data.properties)
          .filter((e) => e[1] === true)
          .map((e) => CONFIG.PF1.weaponProperties[e[0]])
      );
    } else if (item.type === "spell") {
      props.push(labels.components, labels.materials);
    } else if (item.type === "equipment") {
      props.push(CONFIG.PF1.equipmentTypes[item.data.data.equipmentType][item.data.data.equipmentSubtype]);
      props.push(labels.armor);
    } else if (item.type === "feat") {
      props.push(labels.featType);
    }

    // Action type
    if (item.data.actionType) {
      props.push(CONFIG.PF1.itemActionTypes[item.data.data.actionType]);
    }

    // Action usage
    if (item.type !== "weapon" && item.data.data.activation && !isObjectEmpty(item.data.data.activation)) {
      props.push(labels.activation, labels.range, labels.target, labels.duration);
    }

    // Tags
    if (getProperty(item.data, "data.tags") != null) {
      props.push(
        ...getProperty(item.data, "data.tags").map((o) => {
          return o[0];
        })
      );
    }

    return props.filter((p) => !!p);
  }

  /* -------------------------------------------- */

  setPosition(position = {}) {
    // if ( this._sheetTab === "details" ) position.height = "auto";
    return super.setPosition(position);
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
    // Handle conditionals array
    const conditionals = Object.entries(formData).filter((e) => e[0].startsWith("data.conditionals"));
    formData["data.conditionals"] = conditionals.reduce((arr, entry) => {
      const [i, j, k] = entry[0].split(".").slice(2);
      if (!arr[i]) arr[i] = ItemPF.defaultConditional;
      if (k) {
        const target = formData[`data.conditionals.${i}.${j}.target`];
        if (!arr[i].modifiers[j]) arr[i].modifiers[j] = ItemPF.defaultConditionalModifier;
        arr[i].modifiers[j][k] = entry[1];
        // Target dependent keys
        if (["subTarget", "critical", "type"].includes(k)) {
          const target = (conditionals.find((o) => o[0] === `data.conditionals.${i}.${j}.target`) || [])[1];
          const val = entry[1];
          if (typeof target === "string") {
            let keys;
            switch (k) {
              case "subTarget":
                keys = Object.keys(this.item.getConditionalSubTargets(target));
                break;
              case "type":
                keys = Object.keys(this.item.getConditionalModifierTypes(target));
                break;
              case "critical":
                keys = Object.keys(this.item.getConditionalCritical(target));
                break;
            }
            // Reset subTarget, non-damage type, and critical if necessary
            if (!keys.includes(val) && target !== "damage" && k !== "type") arr[i].modifiers[j][k] = keys[0];
          }
        }
      } else {
        arr[i][j] = entry[1];
      }
      return arr;
    }, []);

    // Handle links arrays
    const links = Object.entries(formData).filter((e) => e[0].startsWith("data.links"));
    for (const e of links) {
      const path = e[0].split(".");
      const linkType = path[2];
      const index = path[3];
      const subPath = path.slice(4).join(".");
      const value = e[1];

      // Non-indexed formData is presumed to have been handled already
      if (index == null) continue;

      delete formData[e[0]];

      if (!formData[`data.links.${linkType}`])
        formData[`data.links.${linkType}`] = duplicate(getProperty(this.item.data, `data.links.${linkType}`));

      setProperty(formData[`data.links.${linkType}`][index], subPath, value);
    }

    // Change relative values
    const relativeKeys = ["data.currency.pp", "data.currency.gp", "data.currency.sp", "data.currency.cp"];
    for (const [k, v] of Object.entries(formData)) {
      if (typeof v !== "string") continue;
      // Add or subtract values
      if (relativeKeys.includes(k)) {
        const originalValue = getProperty(this.item.data, k);
        let max = null;
        const maxKey = k.replace(/\.value$/, ".max");
        if (maxKey !== k) {
          max = getProperty(this.item.data, maxKey);
        }

        if (v.match(/(\+|--?)([0-9]+)/)) {
          const operator = RegExp.$1;
          let value = parseInt(RegExp.$2);
          if (operator === "--") {
            formData[k] = -value;
          } else {
            if (operator === "-") value = -value;
            formData[k] = originalValue + value;
            if (max) formData[k] = Math.min(formData[k], max);
          }
        } else if (v.match(/^[0-9]+$/)) {
          formData[k] = parseInt(v);
          if (max) formData[k] = Math.min(formData[k], max);
        } else if (v === "") {
          formData[k] = 0;
        } else formData[k] = 0; // @TODO: definition?
      }
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

    // Activate tabs
    const tabGroups = {
      primary: {
        description: {},
        links: {},
      },
    };
    this._tabsAlt = createTabs.call(this, html, tabGroups, this._tabsAlt);

    // Tooltips
    html.mousemove((ev) => this._moveTooltips(ev));

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Trigger form submission from textarea elements.
    html.find("textarea").change(this._onSubmit.bind(this));

    // Add drop handler to textareas
    html.find("textarea, .notes input[type='text']").on("drop", this._onTextAreaDrop.bind(this));

    // Open help browser
    html.find("a.help-browser[data-url]").click(this._openHelpBrowser.bind(this));

    // Modify attack formula
    html.find(".attack-control").click(this._onAttackControl.bind(this));

    // Modify damage formula
    html.find(".damage-control").click(this._onDamageControl.bind(this));

    // Modify buff changes
    html.find(".change-control").click(this._onBuffControl.bind(this));
    html.find(".change .change-target").click(this._onChangeTargetControl.bind(this));

    // Modify note changes
    html.find(".context-note-control").click(this._onNoteControl.bind(this));
    html.find(".context-note .context-note-target").click(this._onNoteTargetControl.bind(this));

    // Create attack
    if (["weapon"].includes(this.item.data.type)) {
      html.find("button[name='create-attack']").click(this._createAttack.bind(this));
    }

    // Modify conditionals
    html.find(".conditional-control").click(this._onConditionalControl.bind(this));

    // Listen to field entries
    html.find(".entry-selector").click(this._onEntrySelector.bind(this));

    html.find(".entry-control a").click(this._onEntryControl.bind(this));

    // Add drop handler to link tabs
    html.find('div[data-group="links"],a.item[data-tab="links"]').on("drop", this._onLinksDrop.bind(this));

    html.find(".link-control").click(this._onLinkControl.bind(this));

    // Handle alternative file picker
    html.find(".file-picker-alt").click(this._onFilePickerAlt.bind(this));

    // Click to change text input
    html.find('*[data-action="input-text"]').click((event) => this._onInputText(event));

    // Select the whole text on click
    html.find(".select-on-click").click(this._selectOnClick.bind(this));

    // Edit change script contents
    html.find(".edit-change-contents").on("click", this._onEditChangeScriptContents.bind(this));

    // Trait Selector
    html.find(".trait-selector").click(this._onTraitSelector.bind(this));

    // Search box
    if (["container"].includes(this.item.data.type)) {
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

    /* -------------------------------------------- */
    /*  Links
    /* -------------------------------------------- */

    html.find('a[data-action="compendium"]').click(this._onOpenCompendium.bind(this));

    /* -------------------------------------------- */
    /*  Script Calls
    /* -------------------------------------------- */

    html.find(".script-calls .item-control").click(this._onScriptCallControl.bind(this));

    html.find(".script-calls .items-list .item").contextmenu(this._onScriptCallEdit.bind(this));

    html.find(".script-calls .inventory-list[data-category]").on("drop", this._onScriptCallDrop.bind(this));
  }

  /* -------------------------------------------- */

  _onOpenCompendium(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const target = a.dataset.actionTarget;

    game.pf1.compendiums[target].render(true);
  }

  _onScriptCallControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const item = this.document.scriptCalls ? this.document.scriptCalls.get(a.closest(".item")?.dataset.itemId) : null;
    const group = a.closest(".inventory-list");
    const category = group.dataset.category;

    // Create item
    if (a.classList.contains("item-create")) {
      const list = this.document.data.data.scriptCalls || [];
      const item = ItemScriptCall.create({}, null);
      item.data.category = category;
      item.data.type = "script";
      return this._onSubmit(event, { updateData: { "data.scriptCalls": list.concat(item.data) } });
    }
    // Delete item
    else if (item && a.classList.contains("item-delete")) {
      const list = (this.document.data.data.scriptCalls || []).filter((o) => o._id !== item.id);
      return this._onSubmit(event, { updateData: { "data.scriptCalls": list } });
    }
    // Edit item
    else if (item && a.classList.contains("item-edit")) {
      item.edit();
    }
    // Toggle hidden
    else if (item && a.classList.contains("item-hide")) {
      item.update({
        hidden: !item.data.hidden,
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
    const data = JSON.parse(event.originalEvent.dataTransfer.getData("text/plain"));
    if (!data) return;

    const elem = event.currentTarget;
    let link;

    // Case 1 - Entity from Compendium Pack
    if (data.pack) {
      const pack = game.packs.get(data.pack);
      if (!pack) return;
      const entity = await pack.getDocument(data.id);
      link = `@Compendium[${data.pack}.${data.id}]{${entity.name}}`;
    }

    // Case 2 - Entity from World
    else {
      const config = CONFIG[data.type];
      if (!config) return false;
      const entity = config.collection.instance.get(data.id);
      if (!entity) return false;
      link = `@${data.type}[${entity._id}]{${entity.name}}`;
    }

    // Insert link
    if (link) {
      elem.value = !elem.value ? link : elem.value + "\n" + link;
    }
    return this._onSubmit(event);
  }

  async _onScriptCallDrop(event) {
    event.preventDefault();
    const data = JSON.parse(event.originalEvent.dataTransfer.getData("text/plain"));
    if (!data) return;

    const elem = event.currentTarget;
    const category = elem.dataset.category;

    if (data.type === "Macro") {
      let uuid;
      // Get from compendium
      if (data.pack) {
        const pack = game.packs.get(data.pack);
        const document = await pack.getDocument(data.id);
        uuid = document.uuid;
      }
      // Get from world
      else if (data.id) {
        const document = game.macros.get(data.id);
        uuid = document.uuid;
      }

      // Submit data
      if (uuid) {
        const list = this.document.data.data.scriptCalls ?? [];
        const item = ItemScriptCall.create({ type: "macro", value: uuid, category });
        return this._onSubmit(event, { updateData: { "data.scriptCalls": list.concat(item.data) } });
      }
    }
  }

  _openHelpBrowser(event) {
    event.preventDefault();
    const a = event.currentTarget;

    let browser = null;
    for (const w of Object.values(ui.windows)) {
      if (w instanceof PF1_HelpBrowser) {
        browser = w;
        browser.bringToTop();
        break;
      }
    }
    if (!browser) browser = new PF1_HelpBrowser();

    browser.openURL(a.dataset.url);
  }

  async _onLinksDrop(event) {
    const elem = event.currentTarget;
    let linkType = elem.dataset.tab;

    // Default selection for dropping on tab instead of body
    if (linkType === "links") linkType = "children";

    // Try to extract the data
    let data;
    try {
      data = JSON.parse(event.originalEvent.dataTransfer.getData("text/plain"));
      if (data.type !== "Item") return;
    } catch (err) {
      return false;
    }

    let targetItem;
    let dataType = "";
    let itemLink = "";

    // Case 1 - Import from a Compendium pack
    if (data.pack) {
      dataType = "compendium";
      const pack = game.packs.find((p) => p.collection === data.pack);
      const packItem = await pack.getDocument(data.id);
      if (packItem != null) {
        targetItem = packItem;
        itemLink = `${pack.collection}.${packItem._id}`;
      }
    }

    // Case 2 - Data explicitly provided; check same actor for item
    else if (data.data) {
      dataType = "data";
      if (this.item && this.item.actor) {
        targetItem = this.item.actor.items.find((o) => o.id === data.data._id);
      }
      itemLink = data.data._id;
    }

    // Case 3 - Import from World entity
    else {
      dataType = "world";
      targetItem = game.items.get(data.id);
      itemLink = `world.${data.id}`;
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
    if (elem.dataset?.conditional) {
      const conditional = this.object.data.data.conditionals[elem.dataset?.conditional];
      event.dataTransfer.setData("text/plain", JSON.stringify(conditional));
    }
  }

  async _onDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
      // Surface-level check for conditional
      if (!(data.default != null && typeof data.name === "string" && Array.isArray(data.modifiers))) return;
    } catch (e) {
      return false;
    }

    const item = this.object;
    // Check targets and other fields for valid values, reset if necessary
    for (const modifier of data.modifiers) {
      if (!Object.keys(item.getConditionalTargets()).includes(modifier.target)) modifier.target = "";
      let keys;
      for (let [k, v] of Object.entries(modifier)) {
        switch (k) {
          case "subTarget":
            keys = Object.keys(item.getConditionalSubTargets(modifier.target));
            break;
          case "type":
            keys = Object.keys(item.getConditionalModifierTypes(modifier.target));
            break;
          case "critical":
            keys = Object.keys(item.getConditionalCritical(modifier.target));
            break;
        }
        if (!keys?.includes(v)) v = keys?.[0] ?? "";
      }
    }

    const conditionals = item.data.data.conditionals || [];
    await this.object.update({ "data.conditionals": conditionals.concat([data]) });
  }

  async _onEditChangeScriptContents(event) {
    const elem = event.currentTarget;
    const changeID = elem.closest(".change").dataset.change;
    const change = this.item.changes.find((o) => o._id === changeID);

    if (!change) return;

    const scriptEditor = new ScriptEditor({ command: change.formula }).render(true);
    const result = await scriptEditor.awaitResult();
    if (typeof result.command === "string") {
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
    const label = a.parentElement.querySelector("label");
    const options = {
      name: label.getAttribute("for"),
      title: label.innerText,
      choices: CONFIG.PF1[a.dataset.options],
    };
    new ActorTraitSelector(this.object, options).render(true);
  }

  /**
   * @param {string} linkType - The type of link.
   * @param {string} dataType - Either "compendium", "data" or "world".
   * @param {object} itemData - The (new) item's data.
   * @param {string} itemLink - The link identifier for the item.
   * @param {object} [data] - The raw data from a drop event.
   * @returns {boolean} Whether a link to the item is possible here.
   */
  canCreateLink(linkType, dataType, itemData, itemLink, data = null) {
    const actor = this.item.actor;
    const sameActor = actor != null && data != null && data.actorId === actor._id;

    // Don't create link to self
    const itemId = itemLink.split(".").slice(-1)[0];
    if (itemId === this.item._id) return false;

    // Don't create existing links
    const links = getProperty(this.item.data, `data.links.${linkType}`) || [];
    if (links.filter((o) => o.id === itemLink).length) return false;

    if (["children", "charges", "ammunition"].includes(linkType) && sameActor) return true;

    if (linkType === "classAssociations" && dataType === "compendium") return true;

    return false;
  }

  /**
   * @param {string} linkType - The type of link.
   * @param {string} dataType - Either "compendium", "data" or "world".
   * @param {object} itemData - The (new) item's data.
   * @param {string} itemLink - The link identifier for the item.
   * @param {object} [data] - The raw data from a drop event.
   * @returns {Array} An array to insert into this item's link data.
   */
  generateInitialLinkData(linkType, dataType, itemData, itemLink, data = null) {
    const result = {
      id: itemLink,
      dataType: dataType,
      name: itemData.name,
      img: itemData.img,
      hiddenLinks: {},
    };

    if (linkType === "classAssociations") {
      result.level = 1;
    }

    if (linkType === "ammunition") {
      result.recoverChance = 50;
    }

    return result;
  }

  /**
   * Add or remove a damage part from the damage formula
   *
   * @param {Event} event     The original click event
   * @returns {Promise}
   * @private
   */
  async _onDamageControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const list = a.closest(".damage");
    const k = list.dataset.key || "data.damage.parts";
    const k2 = k.split(".").slice(0, -1).join(".");
    const k3 = k.split(".").slice(-1).join(".");

    // Add new damage component
    if (a.classList.contains("add-damage")) {
      // Get initial data
      const initialData = ["", ""];

      // Add data
      const damage = getProperty(this.item.data, k2);
      const updateData = {};
      updateData[k] = getProperty(damage, k3).concat([initialData]);
      return this._onSubmit(event, { updateData });
    }

    // Remove a damage component
    if (a.classList.contains("delete-damage")) {
      const li = a.closest(".damage-part");
      const damage = duplicate(getProperty(this.item.data, k2));
      getProperty(damage, k3).splice(Number(li.dataset.damagePart), 1);
      const updateData = {};
      updateData[k] = getProperty(damage, k3);
      return this._onSubmit(event, { updateData });
    }
  }

  async _onAttackControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new attack component
    if (a.classList.contains("add-attack")) {
      const attackParts = this.item.data.data.attackParts;
      return this._onSubmit(event, { updateData: { "data.attackParts": attackParts.concat([["", ""]]) } });
    }

    // Remove an attack component
    if (a.classList.contains("delete-attack")) {
      const li = a.closest(".attack-part");
      const attackParts = duplicate(this.item.data.data.attackParts);
      attackParts.splice(Number(li.dataset.attackPart), 1);
      return this._onSubmit(event, { updateData: { "data.attackParts": attackParts } });
    }
  }

  async _onBuffControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new change
    if (a.classList.contains("add-change")) {
      const changes = this.item.data.data.changes || [];
      const change = ItemChange.create({}, null);
      return this._onSubmit(event, { updateData: { "data.changes": changes.concat(change.data) } });
    }

    // Remove a change
    if (a.classList.contains("delete-change")) {
      const li = a.closest(".change");
      const changes = duplicate(this.item.data.data.changes);
      const change = changes.find((o) => o._id === li.dataset.change);
      changes.splice(changes.indexOf(change), 1);
      return this._onSubmit(event, { updateData: { "data.changes": changes } });
    }
  }
  _onChangeTargetControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Prepare categories and changes to display
    const change = this.item.changes.get(a.closest(".change").dataset.change);
    const categories = getBuffTargetDictionary(this.item.actor);

    const part1 = change?.subTarget?.split(".")[0];
    const category = CONFIG.PF1.buffTargets[part1]?.category ?? part1;

    // Show widget
    const w = new Widget_CategorizedItemPicker(
      { title: "PF1.Application.ChangeTargetSelector.Title" },
      categories,
      (key) => {
        if (key) {
          change.update({ subTarget: key });
        }
      },
      { category, item: change?.subTarget }
    );
    this._openApplications.push(w.appId);
    w.render(true);
  }

  async _onConditionalControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new conditional
    if (a.classList.contains("add-conditional")) {
      await this._onSubmit(event); // Submit any unsaved changes
      const conditionals = this.item.data.data.conditionals || [];
      return this.item.update({ "data.conditionals": conditionals.concat([ItemPF.defaultConditional]) });
    }

    // Remove a conditional
    if (a.classList.contains("delete-conditional")) {
      await this._onSubmit(event); // Submit any unsaved changes
      const li = a.closest(".conditional");
      const conditionals = duplicate(this.item.data.data.conditionals);
      conditionals.splice(Number(li.dataset.conditional), 1);
      return this.item.update({ "data.conditionals": conditionals });
    }

    // Add a new conditional modifier
    if (a.classList.contains("add-conditional-modifier")) {
      await this._onSubmit(event);
      const li = a.closest(".conditional");
      const conditionals = this.item.data.data.conditionals;
      conditionals[Number(li.dataset.conditional)].modifiers.push(ItemPF.defaultConditionalModifier);
      // duplicate object to ensure update
      return this.item.update({ "data.conditionals": duplicate(conditionals) });
    }

    // Remove a conditional modifier
    if (a.classList.contains("delete-conditional-modifier")) {
      await this._onSubmit(event);
      const li = a.closest(".conditional-modifier");
      const conditionals = duplicate(this.item.data.data.conditionals);
      conditionals[Number(li.dataset.conditional)].modifiers.splice(Number(li.dataset.modifier), 1);
      return this.item.update({ "data.conditionals": conditionals });
    }
  }

  async _onNoteControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new note
    if (a.classList.contains("add-note")) {
      const contextNotes = this.item.data.data.contextNotes || [];
      await this._onSubmit(event, {
        updateData: { "data.contextNotes": contextNotes.concat([ItemPF.defaultContextNote]) },
      });
    }

    // Remove a note
    if (a.classList.contains("delete-note")) {
      const li = a.closest(".context-note");
      const contextNotes = duplicate(this.item.data.data.contextNotes);
      contextNotes.splice(Number(li.dataset.note), 1);
      await this._onSubmit(event, {
        updateData: { "data.contextNotes": contextNotes },
      });
    }
  }

  _onNoteTargetControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Prepare categories and changes to display
    const li = a.closest(".context-note");
    const noteIndex = Number(li.dataset.note);
    const note = this.item.data.data.contextNotes[noteIndex];
    const categories = getBuffTargetDictionary(this.item.actor, "contextNotes");

    const part1 = note?.subTarget?.split(".")[0];
    const category = CONFIG.PF1.contextNoteTargets[part1]?.category ?? part1;

    // Show widget
    const w = new Widget_CategorizedItemPicker(
      { title: "PF1.Application.ContextNoteTargetSelector.Title" },
      categories,
      (key) => {
        if (key) {
          const updateData = {};
          updateData[`data.contextNotes.${noteIndex}.subTarget`] = key;
          this.item.update(updateData);
        }
      },
      { category, item: note?.subTarget }
    );
    this._openApplications.push(w.appId);
    w.render(true);
  }

  async _onLinkControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Delete link
    if (a.classList.contains("delete-link")) {
      const li = a.closest(".links-item");
      const group = a.closest('div[data-group="links"]');
      let links = duplicate(getProperty(this.item.data, `data.links.${group.dataset.tab}`) || []);
      const link = links.find((o) => o.id === li.dataset.link);
      links = links.filter((o) => o !== link);

      const updateData = {};
      updateData[`data.links.${group.dataset.tab}`] = links;

      // Call hook for deleting a link
      Hooks.callAll("deleteItemLink", this.item, link, group.dataset.tab);

      await this._onSubmit(event, { updateData });

      // Clean link
      this.item._cleanLink(link, group.dataset.tab);
      game.socket.emit("system.pf1", {
        eventType: "cleanItemLink",
        actorUUID: this.item.actor.uuid,
        itemUUID: this.item.uuid,
        link: link,
        linkType: group.dataset.tab,
      });
    }
  }

  async _onFilePickerAlt(event) {
    const button = event.currentTarget;
    const attr = button.dataset.for;
    const current = getProperty(this.item.data, attr);
    const form = button.form;
    const targetField = form[attr];
    if (!targetField) return;

    const fp = new FilePicker({
      type: button.dataset.type,
      current: current,
      callback: (path) => {
        targetField.value = path;
        if (this.options.submitOnChange) {
          this._onSubmit(event);
        }
      },
      top: this.position.top + 40,
      left: this.position.left + 10,
    });
    fp.browse(current);
  }

  /**
   * Makes a readonly text input editable, and focus it.
   *
   * @param event
   * @private
   */
  _onInputText(event) {
    event.preventDefault();
    const elem = this.element.find(event.currentTarget.dataset.for);

    elem.removeAttr("readonly");
    elem.attr("name", event.currentTarget.dataset.attrName);
    let value = getProperty(this.item.data, event.currentTarget.dataset.attrName);
    elem.attr("value", value);
    elem.select();

    elem.focusout((event) => {
      if (typeof value === "number") value = value.toString();
      if (value !== elem.attr("value")) {
        this._onSubmit(event);
      } else {
        this.render();
      }
    });
  }

  async _createAttack(event) {
    if (this.item.actor == null) throw new Error(game.i18n.localize("PF1.ErrorItemNoOwner"));

    await this._onSubmit(event);

    await this.item.actor.createAttackFromWeapon(this.item);
  }

  _onEntrySelector(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const options = {
      name: a.getAttribute("for"),
      title: a.innerText,
      fields: a.dataset.fields,
      dtypes: a.dataset.dtypes,
    };
    new EntrySelector(this.item, options).render(true);
  }

  _onEntryControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const key = a.closest(".notes").dataset.name;

    if (a.classList.contains("add-entry")) {
      const notes = getProperty(this.document.data, key);
      const updateData = {};
      updateData[key] = notes.concat("");
      return this._onSubmit(event, { updateData });
    } else if (a.classList.contains("delete-entry")) {
      const index = a.closest(".entry").dataset.index;
      const notes = duplicate(getProperty(this.document.data, key));
      notes.splice(index, 1);

      const updateData = {};
      updateData[key] = notes;
      return this._onSubmit(event, { updateData });
    }
  }

  _selectOnClick(event) {
    event.preventDefault();
    const el = event.currentTarget;
    el.select();
  }

  /** Item Search */

  _searchFilterCommit(event) {
    const container = this.item;
    const search = this._filters.search.toLowerCase();

    // TODO: Do not refresh if same search term, unless the sheet has updated.
    if (this.effectiveSearch === search && !this.searchRefresh) {
      console.log(this.effectiveSearch, "===", search, this.searchRefresh);
      return;
    }
    this.effectiveSearch = search;
    this.searchRefresh = false;

    const matchSearch = (name) => name.toLowerCase().includes(search); // MKAhvi: Bad method for i18n support.

    $(event.target)
      .closest(".tab")
      .find(".item-list .item")
      .each(function () {
        const jq = $(this);
        if (search?.length > 0) {
          const item = container.items.get(this.dataset.itemId);
          if (matchSearch(item.name)) jq.show();
          else jq.hide();
        } else jq.show();
      });
  }

  _clearSearch(event) {
    this._filters.search = "";
    $(event.target).prev(".search-input").val("").change();
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
    const changed = this._filters.search !== search;

    if (this.searchCompositioning || changed) clearTimeout(this.searchDelayEvent); // reset
    if (this.searchCompositioning) return;

    //if (unchanged) return; // nothing changed
    this._filters.search = search;

    if (event.type === "keyup") {
      // Delay search
      if (changed) this.searchDelayEvent = setTimeout(() => this._searchFilterCommit(event), this.searchDelay);
    } else this._searchFilterCommit(event);
  }
}
