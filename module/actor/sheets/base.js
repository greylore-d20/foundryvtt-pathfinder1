import { ActorTraitSelector } from "../../apps/trait-selector.js";
import { ActorSheetFlags } from "../../apps/actor-flags.js";
import { DicePF } from "../../dice.js";
import { TokenConfigPF } from "../../token-config.js";
import { createTag } from "../../lib.js";

/**
 * Extend the basic ActorSheet class to do all the PF things!
 * This sheet is an Abstract layer which is not used.
 *
 * @type {ActorSheet}
 */
export class ActorSheetPF extends ActorSheet {
  constructor(...args) {
    super(...args);

    this.options.submitOnClose = false;

    /**
     * The scroll position on the active tab
     * @type {number}
     */
    this._scrollTab = 0;

    this._scrollSub = 0;

    /**
     * Track the set of item filters which are applied
     * @type {Set}
     */
    this._filters = {
      inventory: new Set(),
      spellbook: new Set(),
      features: new Set(),
      buffs: new Set()
    };
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  getData() {
    // Basic data
    let isOwner = this.entity.owner;
    const data = {
      owner: isOwner,
      limited: this.entity.limited,
      options: this.options,
      editable: this.isEditable,
      cssClass: isOwner ? "editable" : "locked",
      isCharacter: this.entity.data.type === "character",
      hasRace: false,
      config: CONFIG.PF1,
      useBGSkills: this.entity.data.type === "character" && game.settings.get("pf1", "allowBackgroundSkills"),
    };

    // The Actor and its Items
    data.actor = duplicate(this.actor.data);
    data.items = this.actor.items.map(i => {
      i.data.labels = i.labels;
      i.data.hasAttack = i.hasAttack;
      i.data.hasMultiAttack = i.hasMultiAttack;
      i.data.hasDamage = i.hasDamage;
      i.data.hasEffect = i.hasEffect;
      return i.data;
    });
    data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    data.data = data.actor.data;
    data.labels = this.actor.labels || {};
    data.filters = this._filters;

    // Hit point sources
    if (this.actor.sourceDetails != null) data.sourceDetails = expandObject(this.actor.sourceDetails);
    else data.sourceDetails = null;

    // Ability Scores
    for ( let [a, abl] of Object.entries(data.actor.data.abilities)) {
      abl.label = CONFIG.PF1.abilities[a];
      abl.sourceDetails = data.sourceDetails != null ? data.sourceDetails.data.abilities[a].total : [];
    }

    // Armor Class
    for (let [a, ac] of Object.entries(data.actor.data.attributes.ac)) {
      ac.label = CONFIG.PF1.ac[a];
      ac.valueLabel = CONFIG.PF1.acValueLabels[a];
      ac.sourceDetails = data.sourceDetails != null ? data.sourceDetails.data.attributes.ac[a].total : [];
    }

    // Saving Throws
    for (let [a, savingThrow] of Object.entries(data.actor.data.attributes.savingThrows)) {
      savingThrow.label = CONFIG.PF1.savingThrows[a];
      savingThrow.sourceDetails = data.sourceDetails != null ? data.sourceDetails.data.attributes.savingThrows[a].total : [];
    }

    // Update skill labels
    for ( let [s, skl] of Object.entries(data.actor.data.skills)) {
      skl.label = CONFIG.PF1.skills[s];
      skl.arbitrary = CONFIG.PF1.arbitrarySkills.includes(s);
      skl.sourceDetails = (data.sourceDetails != null && data.sourceDetails.data.skills[s] != null) ? data.sourceDetails.data.skills[s].changeBonus : [];
      if (skl.subSkills != null) {
        for (let [s2, skl2] of Object.entries(skl.subSkills)) {
          if (data.sourceDetails == null) continue;
          if (data.sourceDetails.data.skills[s] == null) continue;
          if (data.sourceDetails.data.skills[s].subSkills == null) continue;
          skl2.sourceDetails = data.sourceDetails.data.skills[s].subSkills[s2] != null ? data.sourceDetails.data.skills[s].subSkills[s2].changeBonus : [];
        }
      }
    }

    // Update spellbook info
    for (let spellbook of Object.values(data.actor.data.attributes.spells.spellbooks)) {
      const cl = spellbook.cl.total;
      spellbook.range = {
        close: 25 + 5 * Math.floor(cl / 2),
        medium: 100 + 10 * cl,
        long: 400 + 40 * cl
      };
    }

    // Control items
    data.items.filter(obj => { return obj.type === "spell"; })
    .forEach(obj => {
      obj.isPrepared = obj.data.preparation.mode === "prepared";
    });

    // Update traits
    this._prepareTraits(data.actor.data.traits);

    // Prepare owned items
    this._prepareItems(data);

    // Prepare skillsets
    data.skillsets = this._prepareSkillsets(data.actor.data.skills);

    // Return data to the sheet
    return data
  }

  /* -------------------------------------------- */

  _prepareTraits(traits) {
    const map = {
      // "dr": CONFIG.PF1.damageTypes,
      "di": CONFIG.PF1.damageTypes,
      "dv": CONFIG.PF1.damageTypes,
      "ci": CONFIG.PF1.conditionTypes,
      "languages": CONFIG.PF1.languages,
      "armorProf": CONFIG.PF1.armorProficiencies,
      "weaponProf": CONFIG.PF1.weaponProficiencies
    };
    for ( let [t, choices] of Object.entries(map) ) {
      const trait = traits[t];
      if ( !trait ) continue;
      let values = [];
      if ( trait.value ) {
        values = trait.value instanceof Array ? trait.value : [trait.value];
      }
      trait.selected = values.reduce((obj, t) => {
        obj[t] = choices[t];
        return obj;
      }, {});

      // Add custom entry
      if ( trait.custom ) {
        trait.custom.split(CONFIG.PF1.re.traitSeparator).forEach((c, i) => trait.selected[`custom${i+1}`] = c.trim());
      }
      trait.cssClass = !isObjectEmpty(trait.selected) ? "" : "inactive";
    }
  }

  /* -------------------------------------------- */

  /**
   * Insert a spell into the spellbook object when rendering the character sheet
   * @param {Object} data     The Actor data being prepared
   * @param {Array} spells    The spell data being prepared
   * @param {String} bookKey  The key of the spellbook being prepared
   * @private
   */
  _prepareSpellbook(data, spells, bookKey) {
    const owner = this.actor.owner;
    const book = this.actor.data.data.attributes.spells.spellbooks[bookKey];

    // Reduce spells to the nested spellbook structure
    let spellbook = {};
    for (let a = 0; a < 10; a++) {
      spellbook[a] = {
        level: a,
        usesSlots: true,
        canCreate: owner === true,
        canPrepare: (data.actor.type === "character"),
        label: CONFIG.PF1.spellLevels[a],
        spells: [],
        uses: book.spells["spell"+a].value || 0,
        slots: book.spells["spell"+a].max || 0,
        dataset: { type: "spell", level: a, spellbook: bookKey },
      };
    }
    spells.forEach(spell => {
      const lvl = spell.data.level || 0;
      spellbook[lvl].spells.push(spell);
    });

    // Sort the spellbook by section order
    spellbook = Object.values(spellbook);
    spellbook.sort((a, b) => a.level - b.level);
    return spellbook;
  }

  _prepareSkillsets(skillset) {
    let result = {
      all: { skills: {} },
      adventure: { skills: {} },
      background: { skills: {} }
    };

    for (let [a, skl] of Object.entries(skillset)) {
      result.all.skills[a] = skl;
      if (skl.background) result.background.skills[a] = skl;
      else result.adventure.skills[a] = skl;
    }

    return result;
  }

  /* -------------------------------------------- */

  /**
   * Determine whether an Owned Item will be shown based on the current set of filters
   * @return {boolean}
   * @private
   */
  _filterItems(items, filters) {
    return items.filter(item => {
      const data = item.data;

      // Action usage
      for ( let f of ["action", "bonus", "reaction"] ) {
        if ( filters.has(f) ) {
          if ((data.activation && (data.activation.type !== f))) return false;
        }
      }

      if ( filters.has("prepared") ) {
        if ( data.level === 0 || ["pact", "innate"].includes(data.preparation.mode) ) return true;
        if ( this.actor.data.type === "npc" ) return true;
        return data.preparation.prepared;
      }

      // Equipment-specific filters
      if ( filters.has("equipped") ) {
        if (data.equipped && data.equipped !== true) return false;
      }

      // Whether active
      if (filters.has("active")) {
        if (!data.active) return false;
      }
      
      return true;
    });
  }

  /* -------------------------------------------- */

  /**
   * Get the font-awesome icon used to display a certain level of skill proficiency
   * @private
   */
  _getProficiencyIcon(level) {
    const icons = {
      0: '<i class="far fa-circle"></i>',
      0.5: '<i class="fas fa-adjust"></i>',
      1: '<i class="fas fa-check"></i>',
      2: '<i class="fas fa-check-double"></i>'
    };
    return icons[level];
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers
  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Activate tabs
    new Tabs(html.find('.tabs[data-group="primary"]'), {
      initial: this["_sheetTab"],
      callback: clicked => {
        this._scrollTab = 0;
        this._subScroll = 0;
        this["_sheetTab"] = clicked.data("tab");
      }
    });
    new Tabs(html.find('.tabs[data-group="spellbook"]'), {
      initial: this["_spellbookTab"],
      callback: clicked => {
        this._subScroll = 0;
        this["_spellbookTab"] = clicked.data("tab");
      }
    });
    new Tabs(html.find('.tabs[data-group="skillset"]'), {
      initial: this["_skillsetTab"],
      callback: clicked => {
        this._subScroll = 0;
        this["_skillsetTab"] = clicked.data("tab");
      }
    });
    new Tabs(html.find('.tabs[data-group="inventory"]'), {
      initial: this["_inventoryTab"],
      callback: clicked => {
        this._subScroll = 0;
        this["_inventoryTab"] = clicked.data("tab");
      }
    });
    new Tabs(html.find('.tabs[data-group="feats"]'), {
      initial: this["_featsTab"],
      callback: clicked => {
        this._subScroll = 0;
        this["_featsTab"] = clicked.data("tab");
      }
    });
    new Tabs(html.find('.tabs[data-group="buffs"]'), {
      initial: this["_buffsTab"],
      callback: clicked => {
        this._subScroll = 0;
        this["_buffsTab"] = clicked.data("tab");
      }
    });
    new Tabs(html.find('.tabs[data-group="spells"]'), {
      initial: this["_spellsTab"],
      callback: clicked => {
        this._subScroll = 0;
        this["_spellsTab"] = clicked.data("tab");
      }
    });

    // Save scroll position
    const activeTab = html.find('.tab.active[data-group="primary"]')[0];
    if (activeTab) {
      activeTab.scrollTop = this._scrollTab;
      let subElem = $(activeTab).find(".sub-scroll:visible")[0];
      if (subElem) subElem.scrollTop = this._subScroll;
    }
    html.find(".tab").scroll(ev => this._scrollTab = ev.currentTarget.scrollTop);
    html.find(".sub-scroll").scroll(ev => this._subScroll = ev.currentTarget.scrollTop);

    // Tooltips
    html.mousemove(ev => this._moveTooltips(ev));

    // Activate Item Filters
    const filterLists = html.find(".filter-list");
    filterLists.each(this._initializeFilterItemList.bind(this));
    filterLists.on("click", ".filter-item", this._onToggleFilter.bind(this));

    // Item summaries
    html.find('.item .item-name h4').click(event => this._onItemSummary(event));

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Handle checkboxes
    html.find('input[type="checkbox"]').change(this._onSubmit.bind(this));

    // Trigger form submission from textarea elements.
    html.find("textarea").focusout(this._onSubmit.bind(this));

    /* -------------------------------------------- */
    /*  Abilities, Skills, Defenses and Traits
    /* -------------------------------------------- */

    // Ability Checks
    html.find('.ability-name').click(this._onRollAbilityTest.bind(this));

    // BAB Check
    html.find(".attribute.bab .attribute-name").click(this._onRollBAB.bind(this));

    // CMB Check
    html.find(".attribute.cmb .attribute-name").click(this._onRollCMB.bind(this));

    // Saving Throw
    html.find(".defenses .saving-throw .attribute-name").click(this._onRollSavingThrow.bind(this));

    // Add arbitrary skill
    html.find(".skill.arbitrary .skill-create").click(ev => this._onArbitrarySkillCreate(ev));

    // Delete arbitrary skill
    html.find(".sub-skill > .skill-controls > .skill-delete").click(ev => this._onArbitrarySkillDelete(ev));

    // Add custom skill
    html.find(".skill-controls.skills .skill-create").click(ev => this._onSkillCreate(ev));

    // Delete custom skill
    html.find(".skill > .skill-controls > .skill-delete").click(ev => this._onSkillDelete(ev));

    // Quick Item Action control
    html.find(".item-actions a").click(ev => this._quickItemActionControl(ev));

    // Roll Skill Checks
    html.find(".skill > .skill-name > .rollable").click(this._onRollSkillCheck.bind(this));
    html.find(".sub-skill > .skill-name > .rollable").click(this._onRollSubSkillCheck.bind(this));

    // Trait Selector
    html.find('.trait-selector').click(this._onTraitSelector.bind(this));

    // Configure Special Flags
    html.find('.configure-flags').click(this._onConfigureFlags.bind(this));

    /* -------------------------------------------- */
    /*  Inventory
    /* -------------------------------------------- */

    // Owned Item management
    html.find('.item-create').click(ev => this._onItemCreate(ev));
    html.find('.item-edit').click(this._onItemEdit.bind(this));
    html.find('.item-delete').click(this._onItemDelete.bind(this));

    // Item Dragging
    let handler = ev => this._onDragItemStart(ev);
    html.find('li.item').each((i, li) => {
      if ( li.classList.contains("inventory-header") ) return;
      li.setAttribute("draggable", true);
      li.addEventListener("dragstart", handler, false);
    });

    // Item Rolling
    html.find('.item .item-image').click(event => this._onItemRoll(event));

    /* -------------------------------------------- */
    /*  Feats
    /* -------------------------------------------- */

    html.find(".item-detail.item-uses input[type='text']:not(:disabled)").off("focusout").focusout(this._setFeatUses.bind(this));

    /* -------------------------------------------- */
    /*  Spells
    /* -------------------------------------------- */

    html.find(".item-list .spell-uses input[type='text']").off("focusout").focusout(this._setSpellUses.bind(this));

    html.find(".spellcasting-concentration .rollable").click(this._onRollConcentration.bind(this));

    html.find(".spellcasting-cl .rollable").click(this._onRollCL.bind(this));

    /* -------------------------------------------- */
    /*  Buffs
    /* -------------------------------------------- */

    html.find(".item-detail.item-active input[type='checkbox']").off("change").change(this._setItemActive.bind(this));

    html.find(".item-detail.item-level input[type='text']").off("focusout").focusout(this._setBuffLevel.bind(this));
  }

  /* -------------------------------------------- */

  _moveTooltips(event) {
    $(event.currentTarget).find(".tooltipcontent").css("left", `${event.clientX}px`).css("top", `${event.clientY + 24}px`);
  }

  /**
   * Initialize Item list filters by activating the set of filters which are currently applied
   * @private
   */
  _initializeFilterItemList(i, ul) {
    const set = this._filters[ul.dataset.filter];
    const filters = ul.querySelectorAll(".filter-item");
    for ( let li of filters ) {
      if ( set.has(li.dataset.filter) ) li.classList.add("active");
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle click events for the Traits tab button to configure special Character Flags
   */
  _onConfigureFlags(event) {
    event.preventDefault();
    new ActorSheetFlags(this.actor).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
   * @private
   */
  _onItemRoll(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);

    // Roll spells through the actor
    if ( item.data.type === "spell" ) {
      return this.actor.useSpell(item, {configureDialog: !event.shiftKey});
    }

    // Otherwise roll the Item directly
    else return item.roll();
  }

  _setFeatUses(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);

    const value = Number(event.currentTarget.value);
    const updateData = {};
    updateData["data.uses.value"] = Math.min(item.data.data.uses.max, value);
    if (item.hasPerm(game.user, "OWNER")) item.update(updateData);
  }

  _setSpellUses(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);

    const value = Number(event.currentTarget.value);
    const updateData = {};
    updateData["data.preparation.preparedAmount"] = value;
    if (item.hasPerm(game.user, "OWNER")) item.update(updateData);
  }

  _setBuffLevel(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);

    const value = Number(event.currentTarget.value);
    const updateData = {};
    updateData["data.level"] = value;
    if (item.hasPerm(game.user, "OWNER")) item.update(updateData);
  }

  _onRollConcentration(event) {
    event.preventDefault();

    const spellbookKey = $(event.currentTarget).closest(".spellbook-group").data("tab");
    const spellbook = this.actor.data.data.attributes.spells.spellbooks[spellbookKey];
    const rollData = duplicate(this.actor.data.data);
    rollData.cl = spellbook.cl.total;

    // Add contextual attack string
    let effectStr = "";
    if (typeof spellbook.concentrationNotes === "string" && spellbook.concentrationNotes.length) {
      effectStr = DicePF.messageRoll({
        actor: this.actor,
        data: rollData,
        msgStr: spellbook.concentrationNotes
      });
    }

    let formulaRoll = new Roll(spellbook.concentrationFormula, rollData).roll();
    return DicePF.d20Roll({
      event: event,
      parts: ["@cl + @mod + @concentrationBonus + @formulaBonus"],
      data: {
        cl: spellbook.cl.total,
        mod: this.actor.data.data.abilities[spellbook.ability].mod,
        concentrationBonus: spellbook.concentration,
        formulaBonus: formulaRoll.total
      },
      title: `Concentration Check`,
      speaker: ChatMessage.getSpeaker({actor: this}),
      takeTwenty: false,
      chatTemplate: "systems/pf1/templates/chat/roll-ext.html",
      chatTemplateData: { hasExtraText: effectStr.length > 0, extraText: effectStr }
    });
  }
  
  _onRollCL(event) {
    event.preventDefault();

    const spellbookKey = $(event.currentTarget).closest(".spellbook-group").data("tab");
    const spellbook = this.actor.data.data.attributes.spells.spellbooks[spellbookKey];
    const rollData = duplicate(this.actor.data.data);

    // Add contextual attack string
    let effectStr = "";
    if (typeof spellbook.clNotes === "string" && spellbook.clNotes.length) {
      effectStr = DicePF.messageRoll({
        actor: this.actor,
        data: rollData,
        msgStr: spellbook.clNotes
      });
    }

    return DicePF.d20Roll({
      event: event,
      parts: [`@cl`],
      data: { cl: spellbook.cl.total },
      title: `Caster Level Check`,
      speaker: ChatMessage.getSpeaker({actor: this}),
      takeTwenty: false,
      chatTemplate: "systems/pf1/templates/chat/roll-ext.html",
      chatTemplateData: { hasExtraText: effectStr.length > 0, extraText: effectStr }
    });
  }

  _setItemActive(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);

    const value = $(event.currentTarget).prop("checked");
    const updateData = {};
    updateData["data.active"] = value;
    if (item.hasPerm(game.user, "OWNER")) item.update(updateData);
  }

  /* -------------------------------------------- */

  /**
   * Handle attempting to recharge an item usage by rolling a recharge check
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemRecharge(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);
    return item.rollRecharge();
  };

  /* -------------------------------------------- */

  /**
   * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
   * @private
   */
  _onItemSummary(event) {
    event.preventDefault();
    let li = $(event.currentTarget).parents(".item"),
        item = this.actor.getOwnedItem(li.attr("data-item-id")),
        chatData = item.getChatData({secrets: this.actor.owner});

    // Toggle summary
    if ( li.hasClass("expanded") ) {
      let summary = li.children(".item-summary");
      summary.slideUp(200, () => summary.remove());
    } else {
      let div = $(`<div class="item-summary">${chatData.description.value}</div>`);
      let props = $(`<div class="item-properties"></div>`);
      chatData.properties.forEach(p => props.append(`<span class="tag">${p}</span>`));
      div.append(props);
      li.append(div.hide());
      div.slideDown(200);
    }
    li.toggleClass("expanded");
  }

  /* -------------------------------------------- */

  _onArbitrarySkillCreate(event) {
    event.preventDefault();
    const skillId = $(event.currentTarget).parents(".skill").attr("data-skill");
    const mainSkillData = this.actor.data.data.skills[skillId];
    const skillData = {
      name: "",
      ability: mainSkillData.ability,
      rank: 0,
      notes: "",
      mod: 0,
      rt: mainSkillData.rt,
      cs: mainSkillData.cs,
      acp: mainSkillData.acp
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
    if (this.actor.hasPerm(game.user, "OWNER")) this.actor.update(updateData);
  }

  _onSkillCreate(event) {
    event.preventDefault();
    const isBackground = $(event.currentTarget).parents(".skills-list").attr("data-background") === "true";
    const skillData = {
      name: "New Skill",
      ability: "int",
      rank: 0,
      notes: "",
      mod: 0,
      rt: false,
      cs: false,
      acp: false,
      background: isBackground,
      custom: true
    };

    let tag = createTag(skillData.name);
    let count = 1;
    while (this.actor.data.data.skills[tag] != null) {
      count++;
      tag = createTag(skillData.name) + count.toString();
    }

    const updateData = {};
    updateData[`data.skills.${tag}`] = skillData;
    if (this.actor.hasPerm(game.user, "OWNER")) this.actor.update(updateData);
  }

  _onArbitrarySkillDelete(event) {
    event.preventDefault();
    const mainSkillId = $(event.currentTarget).parents(".sub-skill").attr("data-main-skill");
    const subSkillId = $(event.currentTarget).parents(".sub-skill").attr("data-skill");

    const updateData = {};
    updateData[`data.skills.${mainSkillId}.subSkills.${subSkillId}`] = null;
    if (this.actor.hasPerm(game.user, "OWNER")) this.actor.update(updateData);
  }

  _onSkillDelete(event) {
    event.preventDefault();
    const skillId = $(event.currentTarget).parents(".skill").attr("data-skill");

    const updateData = {};
    updateData[`data.skills.${skillId}`] = null;
    if (this.actor.hasPerm(game.user, "OWNER")) this.actor.update(updateData);
  }

  async _quickItemActionControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const item = this.actor.getOwnedItem(itemId);
    
    // Quick Attack
    if (a.classList.contains("item-attack")) {
      await this._onSubmit(event);
      item.rollAttack({ event: event, fastForward: true });
    }
    // Quick multi attack
    else if (a.classList.contains("item-multi-attack")) {
      await this._onSubmit(event);
      item.rollAttackFull({ event: event, fastForward: true });
    }
    // Quick effect
    else if (a.classList.contains("item-effect")) {
      await this._onSubmit(event);
      if (item.hasDamage) item.rollDamage({ event: event, fastForward: true });
      else item.rollEffect({ event: event });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @private
   */
  _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const itemData = {
      name: `New ${type.capitalize()}`,
      type: type,
      data: duplicate(header.dataset)
    };
    delete itemData.data["type"];
    return this.actor.createOwnedItem(itemData);
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemEdit(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    const item = this.actor.getOwnedItem(li.dataset.itemId);
    item.sheet.render(true);
  }

  /**
   * Handle deleting an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemDelete(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    this.actor.deleteOwnedItem(li.dataset.itemId);
  }

  /**
   * Handle rolling an Ability check, either a test or a saving throw
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollAbilityTest(event) {
    event.preventDefault();
    let ability = event.currentTarget.parentElement.dataset.ability;
    this.actor.rollAbility(ability, {event: event});
  }

  _onRollBAB(event) {
    event.preventDefault();
    this.actor.rollBAB({event: event});
  }

  _onRollCMB(event) {
    event.preventDefault();
    this.actor.rollCMB({event: event});
  }

  _onRollSavingThrow(event) {
    event.preventDefault();
    let savingThrow = event.currentTarget.parentElement.dataset.savingthrow;
    this.actor.rollSavingThrow(savingThrow, {event: event});
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling a Skill check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSkillCheck(event) {
    event.preventDefault();
    const skill = event.currentTarget.parentElement.parentElement.dataset.skill;
    this.actor.rollSkill(skill, {event: event}, 0);
  }

  _onRollSubSkillCheck(event) {
    event.preventDefault();
    const mainSkill = event.currentTarget.parentElement.parentElement.dataset.mainSkill;
    const skill = event.currentTarget.parentElement.parentElement.dataset.skill;
    this.actor.rollSkill(mainSkill, {event: event}, 1, skill);
  }

  _onRollCustomSkillCheck(event) {
    event.preventDefault();
    const skill = event.currentTarget.parentElement.parentElement.dataset.customSkill;
    this.actor.rollSkill(skill, {event: event}, 2);
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling of filters to display a different set of owned items
   * @param {Event} event     The click event which triggered the toggle
   * @private
   */
  _onToggleFilter(event) {
    event.preventDefault();
    const li = event.currentTarget;
    const set = this._filters[li.parentElement.dataset.filter];
    const filter = li.dataset.filter;
    if ( set.has(filter) ) set.delete(filter);
    else set.add(filter);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle spawning the ActorTraitSelector application which allows a checkbox of multiple trait options
   * @param {Event} event   The click event which originated the selection
   * @private
   */
  _onTraitSelector(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const label = a.parentElement.querySelector("label");
    console.log(a, a.dataset);
    const options = {
      name: label.getAttribute("for"),
      title: label.innerText,
      choices: CONFIG.PF1[a.dataset.options]
    };
    new ActorTraitSelector(this.actor, options).render(true)
  }

  _onConfigureToken(event) {
    event.preventDefault();

    // Determine the Token for which to configure
    const token = this.token || new Token(this.actor.data.token);

    // Render the Token Config application
    new TokenConfigPF(token, {
      left: Math.max(this.position.left - 560 - 10, 10),
      top: this.position.top,
      configureDefault: !this.token
    }).render(true);
  }
}
