import { getBuffTargetDictionary, getBuffTargets, diffObjectAndArray } from "../../utils/lib.mjs";
import { ItemPF } from "../../documents/item/item-pf.mjs";
import { ScriptEditor } from "../script-editor.mjs";
import { ActorTraitSelector } from "../trait-selector.mjs";
import { Widget_CategorizedItemPicker } from "../categorized-item-picker.mjs";
import { getSkipActionPrompt } from "../../documents/settings.mjs";

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
        },
        { navSelector: "nav.tabs[data-group='links']", contentSelector: "section.links-body", initial: "children" },
        {
          navSelector: "nav.tabs[data-group='description']",
          contentSelector: "section.description-body",
          initial: "identified",
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
    data.system = data.item.system;
    data.flags = { flags: data.flags };
    const rollData = this.item.getRollData();
    data.labels = this.item.labels;

    // Include sub-items
    data.items = [];
    if (this.item.items != null) {
      data.items = this.item.items.map((i) => {
        return i.toObject();
      });
    }

    // Include CONFIG values
    data.config = CONFIG.PF1;

    // Item Type, Status, and Details
    data.itemType = this._getItemType(data.item);
    data.itemStatus = this._getItemStatus(data.item);
    data.itemProperties = this._getItemProperties(data.item);
    data.itemName = data.item.name;
    data.isCharged = ["day", "week", "charges"].includes(data.item.system.uses?.per);
    data.isPhysical = data.item.system.quantity !== undefined;
    data.isNaturalAttack = data.item.system.attackType === "natural";
    data.isSpell = this.item.type === "spell";
    data.owned = this.item.actor != null;
    data.parentOwned = this.actor != null;
    data.owner = this.item.isOwner;
    data.isGM = game.user.isGM;
    data.hasAction = this.item.hasAction;
    data.showIdentifyDescription = data.isGM && data.isPhysical;
    data.showUnidentifiedData = this.item.showUnidentifiedData;
    data.unchainedActionEconomy = game.settings.get("pf1", "unchainedActionEconomy");
    if (rollData.item.auraStrength != null) {
      const auraStrength = rollData.item.auraStrength;
      data.auraStrength = auraStrength;

      if (CONFIG.PF1.auraStrengths[auraStrength] != null) {
        const auraStrength_name = CONFIG.PF1.auraStrengths[auraStrength];
        data.auraStrength_name = auraStrength_name;

        data.labels.identify = game.i18n.localize("PF1.IdentifyDCNumber").format(15 + rollData.item.cl);
      }
    }

    // Unidentified data
    if (this.item.showUnidentifiedData) {
      data.itemName = this.item.system.unidentified.name || this.item.system.identifiedName || this.item.name;
    } else {
      data.itemName = this.item.system.identifiedName || this.item.name;
    }

    // Override description attributes
    if (data.isPhysical) {
      /** @type {DescriptionAttribute[]} */
      data.descriptionAttributes = [];

      // Add quantity
      data.descriptionAttributes.push({
        isNumber: true,
        name: "system.quantity",
        label: game.i18n.localize("PF1.Quantity"),
        value: data.item.system.quantity,
        decimals: 0,
        id: "data-quantity",
      });

      // Add weight
      data.descriptionAttributes.push({
        isNumber: true,
        name: "system.weight.value",
        fakeName: true,
        label: game.i18n.localize("PF1.Weight"),
        value: data.item.system.weight.converted.total,
        inputValue: data.item.system.weight.converted.value,
        decimals: 2,
        id: "data-weight-value",
      });

      // Add price
      if (data.showIdentifyDescription) {
        data.descriptionAttributes.push(
          {
            isNumber: true,
            name: "system.price",
            fakeName: true,
            label: game.i18n.localize("PF1.Price"),
            value: this.item.getValue({ sellValue: 1 }),
            decimals: 2,
            id: "data-price",
          },
          {
            isNumber: true,
            name: "system.unidentified.price",
            fakeName: true,
            label: game.i18n.localize("PF1.UnidentifiedPriceShort"),
            value: this.item.getValue({ sellValue: 1, forceUnidentified: true }),
            decimals: 2,
            id: "data-unidentifiedBasePrice",
          }
        );
      } else {
        if (data.showUnidentifiedData) {
          data.descriptionAttributes.push({
            isNumber: true,
            name: "system.unidentified.price",
            fakeName: true,
            label: game.i18n.localize("PF1.Price"),
            value: this.item.getValue({ sellValue: 1 }),
            decimals: 2,
            id: "data-price",
          });
        } else {
          data.descriptionAttributes.push({
            isNumber: true,
            name: "system.price",
            fakeName: true,
            label: game.i18n.localize("PF1.Price"),
            value: this.item.getValue({ sellValue: 1 }),
            decimals: 2,
            id: "data-price",
          });
        }
      }

      // Add hit points
      data.descriptionAttributes.push({
        isRange: true,
        label: game.i18n.localize("PF1.HPShort"),
        value: {
          name: "system.hp.value",
          value: data.item.system.hp.value,
        },
        max: {
          name: "system.hp.max",
          value: data.item.system.hp.max,
        },
      });

      // Add hardness
      data.descriptionAttributes.push({
        isNumber: true,
        label: game.i18n.localize("PF1.Hardness"),
        name: "system.hardness",
        decimals: 0,
        value: data.item.system.hardness,
      });

      // Add carried flag
      data.descriptionAttributes.push({
        isBoolean: true,
        name: "system.carried",
        label: game.i18n.localize("PF1.Carried"),
        value: data.item.system.carried,
      });
    }

    // Prepare feat specific stuff
    if (data.item.type === "feat") {
      data.isClassFeature = getProperty(this.item, "system.featType") === "classFeat";
      data.isTemplate = getProperty(this.item, "system.featType") === "template";
    }

    if (["class", "feat", "race"].includes(data.item.type)) {
      // Add skill list
      if (!this.actor) {
        data.skills = Object.entries(CONFIG.PF1.skills).reduce((cur, o) => {
          cur[o[0]] = { name: o[1], classSkill: getProperty(this.item, `system.classSkills.${o[0]}`) === true };
          return cur;
        }, {});
      } else {
        // Get sorted skill list from config, custom skills get appended to bottom of list
        const skills = mergeObject(deepClone(CONFIG.PF1.skills), this.actor.system.skills);
        data.skills = Object.entries(skills).reduce((cur, o) => {
          const key = o[0];
          const name = CONFIG.PF1.skills[key] != null ? CONFIG.PF1.skills[key] : o[1].name;
          cur[o[0]] = { name: name, classSkill: getProperty(this.item, `system.classSkills.${o[0]}`) === true };
          return cur;
        }, {});
      }
    }

    // Prepare weapon specific stuff
    if (data.item.type === "weapon") {
      data.isRanged = data.item.system.weaponSubtype === "ranged" || data.item.system.properties["thr"] === true;

      // Prepare categories for weapons
      data.weaponCategories = { types: {}, subTypes: {} };
      for (const [k, v] of Object.entries(CONFIG.PF1.weaponTypes)) {
        if (typeof v === "object") data.weaponCategories.types[k] = v._label;
      }
      const type = data.item.system.weaponType;
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
      const type = data.item.system.equipmentType;
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

    // Prepare spell specific stuff
    if (data.item.type === "spell") {
      let spellbook = null;
      if (this.actor != null) {
        spellbook = getProperty(this.actor, `system.attributes.spells.spellbooks.${this.item.system.spellbook}`);
      }

      data.isPreparedSpell = spellbook != null ? !spellbook.spontaneous && !spellbook.spellPoints?.useSystem : false;
      data.usesSpellpoints = spellbook != null ? spellbook.spellPoints?.useSystem ?? false : false;
      data.isAtWill = data.item.system.atWill;
      data.spellbooks = deepClone(this.actor?.system.attributes?.spells?.spellbooks ?? {});

      const desc = await renderTemplate(
        "systems/pf1/templates/internal/spell-description.hbs",
        this.document.spellDescriptionData
      );
      const firstAction = this.item.firstAction;
      data.topDescription = TextEditor.enrichHTML(desc, {
        rollData: firstAction?.getRollData() ?? rollData,
        async: false,
      });

      // Enrich description
      if (data.shortDescription != null) {
        data.shortDescription = TextEditor.enrichHTML(data.shortDescription, {
          rollData: firstAction?.getRollData() ?? rollData,
          secrets: data.owner,
        });
      }
    }

    // Prepare class specific stuff
    if (data.item.type === "class") {
      data.isMythicPath = data.system.classType === "mythic";

      for (const [a, s] of Object.entries(data.system.savingThrows)) {
        s.label = CONFIG.PF1.savingThrows[a];
      }
      for (const [a, s] of Object.entries(data.system.fc)) {
        s.label = CONFIG.PF1.favouredClassBonuses[a];
      }

      data.isBaseClass = data.system.classType === "base";
      data.isRacialHD = data.system.classType === "racial";

      if (this.actor != null) {
        const healthConfig = game.settings.get("pf1", "healthConfig");
        data.healthConfig = data.isRacialHD
          ? healthConfig.hitdice.Racial
          : this.actor.type === "character"
          ? healthConfig.hitdice.PC
          : healthConfig.hitdice.NPC;
      } else data.healthConfig = { auto: false };

      // Add skill list
      if (!this.actor) {
        data.skills = Object.entries(CONFIG.PF1.skills).reduce((cur, o) => {
          cur[o[0]] = { name: o[1], classSkill: getProperty(data, `system.classSkills.${o[0]}`) === true };
          return cur;
        }, {});
      } else {
        // Get sorted skill list from config, custom skills get appended to bottom of list
        const skills = mergeObject(deepClone(CONFIG.PF1.skills), this.actor.system.skills);
        data.skills = Object.entries(skills).reduce((cur, o) => {
          const key = o[0];
          const name = CONFIG.PF1.skills[key] != null ? CONFIG.PF1.skills[key] : o[1].name;
          cur[o[0]] = { name: name, classSkill: getProperty(data, `system.classSkills.${o[0]}`) === true };
          return cur;
        }, {});
      }
    }

    // Prepare proficiencies & languages
    const profs = {
      armorProf: CONFIG.PF1.armorProficiencies,
      weaponProf: CONFIG.PF1.weaponProficiencies,
      languages: CONFIG.PF1.languages,
    };
    for (const [t, choices] of Object.entries(profs)) {
      if (hasProperty(data.item.system, t)) {
        const trait = data[t];
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
      data.changes = data.item.system.changes.reduce((cur, o) => {
        const obj = { data: o };

        obj.subTargetLabel = buffTargets[o.subTarget]?.label;
        obj.isScript = obj.data.operator === "script";

        cur.push(obj);
        return cur;
      }, []);
    }

    // Prepare stuff for items with context notes
    if (data.item.system.contextNotes) {
      data.contextNotes = deepClone(data.item.system.contextNotes);
      const noteTargets = getBuffTargets(this.item.actor, "contextNotes");
      data.contextNotes.forEach((o) => {
        o.label = noteTargets[o.subTarget]?.label;
      });
    }

    // Add distance units
    data.distanceUnits = deepClone(CONFIG.PF1.distanceUnits);
    if (this.item.type !== "spell") {
      for (const d of ["close", "medium", "long"]) {
        delete data.distanceUnits[d];
      }
    }

    // Parse notes
    if (data.item.system.attackNotes) {
      const value = data.item.system.attackNotes;
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

    // Post process data
    for (const l of data.links.list) {
      const items = getProperty(this.item, `system.links.${l.id}`) || [];
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
    setProperty(data, "flags.boolean", getProperty(data.item.system, "system.flags.boolean") ?? {});
    setProperty(data, "flags.dictionary", getProperty(data.item.system, "system.flags.dictionary") ?? {});
  }

  async _prepareScriptCalls(data) {
    const categories = game.pf1.scriptCalls.filter((o) => {
      if (!o.data.itemTypes.includes(this.document.type)) return false;
      return !(o.hidden === true && !game.user.isGM);
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
      ? deepClone(Array.from(this.document.scriptCalls).map((o) => o.data))
      : [];
    {
      const promises = [];
      for (const o of scriptCalls) {
        promises.push(
          (async () => {
            // Obtain macro info
            if (o.type === "macro") {
              const m = await fromUuid(o.value);
              if (m == null) {
                o.name = `${game.i18n.localize("PF1.Unknown")} (${game.i18n.localize("DOCUMENT.Macro")})`;
                o.img = "icons/svg/hazard.svg";
              } else {
                o.name = m.data.name;
                o.img = m.data.img;
              }
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
    const itemData = item.system;
    if (item.type === "spell") {
      const spellbook = this.item.spellbook;
      if (itemData.preparation.mode === "prepared") {
        if (spellbook?.spellPreparationMode === "spontaneous") {
          if (itemData.preparation.spontaneousPrepared) return game.i18n.localize("PF1.SpellPrepPrepared");
          else return game.i18n.localize("PF1.Unprepared");
        } else if (itemData.preparation.preparedAmount > 0)
          return game.i18n.localize("PF1.AmountPrepared").format(itemData.preparation.preparedAmount);
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
        ...Object.entries(item.system.properties)
          .filter((e) => e[1] === true)
          .map((e) => CONFIG.PF1.weaponProperties[e[0]])
      );
    } else if (item.type === "spell") {
      props.push(labels.components, labels.materials);
    } else if (item.type === "equipment") {
      props.push(CONFIG.PF1.equipmentTypes[item.system.equipmentType][item.system.equipmentSubtype]);
      props.push(labels.armor);
    } else if (item.type === "feat") {
      props.push(labels.featType);
    }

    // Action type
    if (item.system.actionType) {
      props.push(CONFIG.PF1.itemActionTypes[item.system.actionType]);
    }

    // Action usage
    if (item.type !== "weapon" && item.system.activation && !foundry.utils.isEmpty(item.system.activation)) {
      props.push(labels.activation, labels.range, labels.target, labels.duration);
    }

    // Tags
    if (getProperty(item.system, "system.tags") != null) {
      props.push(
        ...getProperty(item.system, "system.tags").map((o) => {
          return o[0];
        })
      );
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
    // Handle links arrays
    const links = Object.entries(formData).filter((e) => e[0].startsWith("system.links"));
    for (const e of links) {
      const path = e[0].split(".");
      const linkType = path[2];
      const index = path[3];
      const subPath = path.slice(4).join(".");
      const value = e[1];

      // Non-indexed formData is presumed to have been handled already
      if (index == null) continue;

      delete formData[e[0]];

      if (!formData[`system.links.${linkType}`])
        formData[`system.links.${linkType}`] = deepClone(getProperty(this.item, `system.links.${linkType}`));

      setProperty(formData[`system.links.${linkType}`][index], subPath, value);
    }

    // Handle weight to ensure `weight.value` is in lbs
    if (formData["system.weight.value"]) {
      formData["system.weight.value"] = game.pf1.utils.convertWeightBack(formData["system.weight.value"]);
    }

    // Change relative values
    const relativeKeys = ["system.currency.pp", "system.currency.gp", "system.currency.sp", "system.currency.cp"];
    for (const [k, v] of Object.entries(formData)) {
      if (typeof v !== "string") continue;
      // Add or subtract values
      if (relativeKeys.includes(k)) {
        const originalValue = getProperty(this.item.system, k);
        let max = null;
        const maxKey = k.replace(/\.value$/, ".max");
        if (maxKey !== k) {
          max = getProperty(this.item.system, maxKey);
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

    // Tooltips
    html.mousemove((ev) => this._moveTooltips(ev));

    // Edit action
    html.find(".actions .items-list .item").on("contextmenu", this._onActionEdit.bind(this));

    // Item summaries
    html.find(".item .item-name h4").on("click", (event) => this._onItemSummary(event));

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Trigger form submission from textarea elements.
    html.find("textarea").change(this._onSubmit.bind(this));

    // Add drop handler to textareas
    html.find("textarea, .notes input[type='text']").on("drop", this._onTextAreaDrop.bind(this));

    // Open help browser
    html.find("a.help-browser[data-url]").click(this._openHelpBrowser.bind(this));

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

    // Linked item clicks
    html
      .find(".tab[data-tab='links'] .links-item[data-link] .links-item-name")
      .on("click", this._openLinkedItem.bind(this));

    /* -------------------------------------------- */
    /*  Actions
    /* -------------------------------------------- */

    // Action control
    html.find(".action-controls a").on("click", this._onActionControl.bind(this));

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

    game.pf1.compendiums[target].render(true, { focus: true });
  }

  async _onScriptCallControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const item = this.document.scriptCalls ? this.document.scriptCalls.get(a.closest(".item")?.dataset.itemId) : null;
    const group = a.closest(".inventory-list");
    const category = group.dataset.category;

    // Create item
    if (a.classList.contains("item-create")) {
      await this._onSubmit(event);
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
        hidden: !item.system.hidden,
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

    // Case 1 - Document from Compendium Pack
    if (data.pack) {
      const pack = game.packs.get(data.pack);
      if (!pack) return;
      const doc = await pack.getDocument(data.id);
      link = `@Compendium[${data.pack}.${data.id}]{${doc.name}}`;
    }

    // Case 2 - Document from World
    else {
      const config = CONFIG[data.type];
      if (!config) return false;
      const doc = config.collection.instance.get(data.id);
      if (!doc) return false;
      link = `@${data.type}[${doc._id}]{${doc.name}}`;
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
        const list = this.document.system.scriptCalls ?? [];
        await this._onSubmit(event);
        return pf1.components.ItemScriptCall.create([{ type: "macro", value: uuid, category }], {
          parent: this.item,
        });
      }
    }
  }

  _openHelpBrowser(event) {
    event.preventDefault();
    const a = event.currentTarget;

    game.pf1.helpBrowser.openUrl(a.dataset.url);
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

    let dataType, itemLink;
    // Case 1 - Import from a Compendium pack
    if (targetItem.pack) {
      dataType = "compendium";
      itemLink = `${targetItem.pack}.${targetItem.id}`;
    }

    // Case 2 - Import from same actor
    else if (targetItem.parent instanceof Actor && targetItem.parent === this.document.parentActor) {
      dataType = "data";
      itemLink = targetItem.id;
    }

    // Case 3 - Import from World Document
    else {
      dataType = "world";
      itemLink = `world.${targetItem.id}`;
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
      const action = this.object.actions.get(elem.dataset.itemId);
      const obj = { type: "action", source: this.object.uuid, data: action.data };
      event.dataTransfer.setData("text/plain", JSON.stringify(obj));
    }
  }

  async _onDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    let data, type;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
      // Surface-level check for action
      if (data.type === "action" && data.source) type = "action";
    } catch (e) {
      return false;
    }

    const item = this.object;

    // Handle actions
    if (type === "action") {
      const srcItem = await fromUuid(data.source);

      // Re-order
      if (srcItem === item) {
        const targetActionID = event.target?.closest("li.action-part")?.dataset?.itemId;
        const prevActions = deepClone(this.object.system.actions);

        let targetIdx;
        if (!targetActionID) targetIdx = prevActions.length - 1;
        else targetIdx = prevActions.indexOf(prevActions.find((o) => o._id === targetActionID));
        const srcIdx = prevActions.indexOf(prevActions.find((o) => o._id === data._id));

        prevActions.splice(srcIdx, 1);
        prevActions.splice(targetIdx, 0, data);
        await this.object.update({ "system.actions": prevActions });
      }

      // Add to another item
      else {
        const prevActions = deepClone(this.object.system.actions ?? []);
        data._id = randomID(16);
        prevActions.splice(prevActions.length, 0, data);
        await this.object.update({ "system.actions": prevActions });
      }
    }
  }

  async _onEditChangeScriptContents(event) {
    const elem = event.currentTarget;
    const changeID = elem.closest(".change").dataset.change;
    const change = this.item.changes.find((o) => o._id === changeID);

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
    const label = a.parentElement.querySelector("label");
    const options = {
      name: label.getAttribute("for"),
      title: label.innerText,
      subject: a.dataset.options,
      choices: CONFIG.PF1[a.dataset.options],
    };
    new ActorTraitSelector(this.object, options).render(true);
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
    const { description, actionDescription, properties } = item.getChatData();

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
  _openLinkedItem(event) {
    event.preventDefault();
    const el = event.target.closest("[data-link]"),
      link = el.dataset.link,
      parts = link.split("."),
      packId = parts.length === 3 ? parts.slice(0, 2).join(".") : null,
      itemId = parts.pop();

    if (packId) {
      game.packs
        .get(packId)
        .getDocument(itemId)
        .then((d) => d.sheet.render(true, { focus: true }));
    } else {
      this.actor.items.get(itemId).sheet.render(true, { focus: true });
    }
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
    };

    if (linkType === "classAssociations") {
      result.level = 1;
    }

    if (linkType === "ammunition") {
      result.recoverChance = 50;
    }

    return result;
  }

  async _onActionControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add action
    if (a.classList.contains("add-action")) {
      const newActionData = {
        img: this.item.img,
        name: ["weapon", "attack"].includes(this.item.type)
          ? game.i18n.localize("PF1.Attack")
          : game.i18n.localize("PF1.Use"),
      };
      await this._onSubmit(event);
      return pf1.components.ItemAction.create([newActionData], { parent: this.item });
    }

    // Edit action
    if (a.classList.contains("edit-action")) {
      return this._onActionEdit(event);
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
          title: game.i18n.localize("PF1.DeleteItemTitle").format(action.name),
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
      const action = deepClone(this.item.actions.get(li.dataset.itemId).data);
      action.name = `${action.name} (${game.i18n.localize("PF1.Copy")})`;
      action._id = randomID(16);
      const actionParts = deepClone(this.item.system.actions ?? []);
      return this._onSubmit(event, { updateData: { "system.actions": actionParts.concat(action) } });
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
        app.render(true, { focus: true, editable: !this.isEditable });
        return;
      }
    }

    // Open new window
    const app = new game.pf1.applications.ItemActionSheet(action);
    app.render(true);
  }

  async _onBuffControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new change
    if (a.classList.contains("add-change")) {
      await this._onSubmit(event);
      return pf1.components.ItemChange.create([{}], { parent: this.item });
    }

    // Remove a change
    if (a.classList.contains("delete-change")) {
      const li = a.closest(".change");
      const changes = deepClone(this.item.system.changes);
      const change = changes.find((o) => o._id === li.dataset.change);
      changes.splice(changes.indexOf(change), 1);
      return this._onSubmit(event, { updateData: { "system.changes": changes } });
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

  async _onNoteControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new note
    if (a.classList.contains("add-note")) {
      const contextNotes = this.item.system.contextNotes || [];
      await this._onSubmit(event, {
        updateData: { "system.contextNotes": contextNotes.concat([ItemPF.defaultContextNote]) },
      });
    }

    // Remove a note
    if (a.classList.contains("delete-note")) {
      const li = a.closest(".context-note");
      const contextNotes = duplicate(this.item.system.contextNotes);
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
    const category = CONFIG.PF1.contextNoteTargets[part1]?.category ?? part1;

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
      let links = duplicate(getProperty(this.item, `system.links.${group.dataset.tab}`) || []);
      const link = links.find((o) => o.id === li.dataset.link);
      links = links.filter((o) => o !== link);

      const updateData = {};
      updateData[`system.links.${group.dataset.tab}`] = links;

      // Call hook for deleting a link
      Hooks.callAll("deleteItemLink", this.item, link, group.dataset.tab);

      await this._onSubmit(event, { updateData });

      // Clean link
      this.item._cleanLink(link, group.dataset.tab);
      game.socket.emit("system.pf1", {
        eventType: "cleanItemLink",
        actorUUID: this.item.actor?.uuid,
        itemUUID: this.item.uuid,
        link: link,
        linkType: group.dataset.tab,
      });
    }
  }

  async _onFilePickerAlt(event) {
    const button = event.currentTarget;
    const attr = button.dataset.for;
    const current = getProperty(this.item.system, attr);
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
    const { inputValue } = event.currentTarget.dataset;
    let value = inputValue ?? getProperty(this.item, event.currentTarget.dataset.attrName);
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
      flag: a.dataset.flag === "true",
      flat: a.dataset.flat === "true",
      fields: a.dataset.fields,
      dtypes: a.dataset.dtypes,
    };
    new game.pf1.applications.EntrySelector(this.item, options).render(true);
  }

  _onEntryControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const key = a.closest(".notes").dataset.name;

    if (a.classList.contains("add-entry")) {
      const notes = getProperty(this.document, key) ?? [];
      const updateData = {};
      updateData[key] = notes.concat("");
      return this._onSubmit(event, { updateData });
    } else if (a.classList.contains("delete-entry")) {
      const index = a.closest(".entry").dataset.index;
      const notes = duplicate(getProperty(this.document, key));
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
}

/**
 * @typedef {object} DescriptionAttribute
 * @property {string} name - Data path to which the input will be written
 * @property {boolean} [fakeName] - Whether to show a value different from the one the `name` points to
 * @property {string} id
 * @property {boolean} [isNumber] - Whether the input is a number (text input)
 * @property {boolean} [isBoolean] - Whether the input is a boolean (checkbox)
 * @property {boolean} [isRange] - Whether this is a dual input for a value and a maximum value
 * @property {string} label - The label for the input
 * @property {string | boolean | number | {value: string | number, name: string}} value - The value that is show in the sidebar.
 *   Ranges require an object with `value` and `name` properties.
 * @property {{value: string | number, name: string}} [max] - Maximum value for a range input
 * @property {number} [decimals] - Number of decimals to display for `number`s
 * @property {string} [inputValue] - Value that will appear in the input field when it is edited,
 *                                   overriding the default value retrieved from the item data
 *                                   using {@link DescriptionAttribute#name}
 */
