import { ActorSheetPF } from "./base.js";


/**
 * An Actor sheet for player character type actors in the PF system.
 * Extends the base ActorSheetPF class.
 * @type {ActorSheetPF}
 */
export class ActorSheetPFCharacter extends ActorSheetPF {

  /**
   * Define default rendering options for the NPC sheet
   * @return {Object}
   */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      classes: ["pf1", "sheet", "actor", "character"],
      width: 720,
      height: 840
    });
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Get the correct HTML template path to use for rendering this particular sheet
   * @type {String}
   */
  get template() {
    if ( !game.user.isGM && this.actor.limited ) return "systems/pf1/templates/actors/limited-sheet.html";
    return "systems/pf1/templates/actors/character-sheet.html";
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  getData() {
    const sheetData = super.getData();

    // Resources
    sheetData["resources"] = ["primary", "secondary", "tertiary"].reduce((arr, r) => {
      const res = sheetData.data.resources[r] || {};
      res.name = r;
      res.placeholder = game.i18n.localize("pf1.Resource"+r.titleCase());
      if (res && res.value === 0) delete res.value;
      if (res && res.max === 0) delete res.max;
      return arr.concat([res]);
    }, []);

    // Experience Tracking
    sheetData["disableExperience"] = game.settings.get("pf1", "disableExperienceTracking");

    // Return data for rendering
    return sheetData;
  }

  /* -------------------------------------------- */

  /**
   * Organize and classify Owned Items for Character sheets
   * @private
   */
  _prepareItems(data) {

    // Categorize items as inventory, spellbook, features, and classes
    const inventory = {
      weapon: { label: "Weapons", canCreate: true, hasActions: false, items: [], dataset: { type: "weapon" } },
      equipment: { label: "Armor/Equipment", canCreate: true, hasActions: false, items: [], dataset: { type: "equipment" }, hasSlots: true },
      consumable: { label: "Consumables", canCreate: true, hasActions: true, items: [], dataset: { type: "consumable" } },
      gear: { label: CONFIG.PF1.lootTypes["gear"], canCreate: true, hasActions: false, items: [], dataset: { type: "loot", "sub-type": "gear" } },
      ammo: { label: CONFIG.PF1.lootTypes["ammo"], canCreate: true, hasActions: false, items: [], dataset: { type: "loot", "sub-type": "ammo" } },
      misc: { label: CONFIG.PF1.lootTypes["misc"], canCreate: true, hasActions: false, items: [], dataset: { type: "loot", "sub-type": "misc" } },
      all: { label: "All", canCreate: false, hasActions: true, items: [], dataset: {} },
    };

    // Partition items by category
    let [items, spells, feats, classes, attacks] = data.items.reduce((arr, item) => {
      item.img = item.img || DEFAULT_TOKEN;
      item.isStack = item.data.quantity ? item.data.quantity > 1 : false;
      item.hasUses = item.data.uses && (item.data.uses.max > 0);
      item.isOnCooldown = item.data.recharge && !!item.data.recharge.value && (item.data.recharge.charged === false);
      const unusable = item.isOnCooldown && (item.data.uses.per && (item.data.uses.value > 0));
      item.isCharged = !unusable;
      if ( item.type === "spell" ) arr[1].push(item);
      else if ( item.type === "feat" ) arr[2].push(item);
      else if ( item.type === "class" ) arr[3].push(item);
      else if (item.type === "attack") arr[4].push(item);
      else if ( Object.keys(inventory).includes(item.type) || (item.data.subType != null && Object.keys(inventory).includes(item.data.subType)) ) arr[0].push(item);
      return arr;
    }, [[], [], [], [], []]);

    // Apply active item filters
    items = this._filterItems(items, this._filters.inventory);
    spells = this._filterItems(spells, this._filters.spellbook);
    feats = this._filterItems(feats, this._filters.features);

    // Organize Spellbook
    let spellbookData = {};
    const spellbooks = data.actor.data.attributes.spells.spellbooks;
    for (let [a, spellbook] of Object.entries(spellbooks)) {
      const spellbookSpells = spells.filter(obj => { return obj.data.spellbook === a; });
      spellbookData[a] = {
        data: this._prepareSpellbook(data, spellbookSpells, a),
        prepared: spellbookSpells.filter(obj => { return obj.data.preparation.mode === "prepared" && obj.data.preparation.prepared; }).length,
        orig: spellbook
      };
    }

    // Organize Inventory
    for ( let i of items ) {
      const subType = i.type === "loot" ? i.data.subType || "gear" : i.data.subType;
      i.data.quantity = i.data.quantity || 0;
      i.data.weight = i.data.weight || 0;
      i.totalWeight = Math.round(i.data.quantity * i.data.weight * 10) / 10;
      if (inventory[i.type] != null) inventory[i.type].items.push(i);
      if (subType != null && inventory[subType] != null) inventory[subType].items.push(i);
      inventory.all.items.push(i);
    }

    // Organize Features
    const features = {
      classes: { label: "Classes", items: [], canCreate: true, hasActions: false, dataset: { type: "class" }, isClass: true },
      feat: { label: "Feats", items: [], canCreate: true, hasActions: true, dataset: { type: "feat", "feat-type": "feat" } },
      classFeat: { label: "Class Features", items: [], canCreate: true, hasActions: true, dataset: { type: "feat", "feat-type": "classFeat" } },
      trait: { label: "Traits", items: [], canCreate: true, hasActions: true, dataset: { type: "feat", "feat-type": "trait" } },
      racial: { label: "Racial Traits", items: [], canCreate: true, hasActions: true, dataset: { type: "feat", "feat-type": "racial" } },
      misc: { label: "Misc", items: [], canCreate: true, hasActions: true, dataset: { type: "feat", "feat-type": "misc" } },
      all: { label: "All", items: [], canCreate: false, hasActions: true, dataset: { type: "feat" } },
    };

    for ( let f of feats ) {
      let k = f.data.featType;
      features[k].items.push(f);
      features.all.items.push(f);
    }
    classes.sort((a, b) => b.levels - a.levels);
    features.classes.items = classes;

    // Buffs
    let buffs = data.items.filter(obj => { return obj.type === "buff"; });
    buffs = this._filterItems(buffs, this._filters.buffs);
    const buffSections = {
      temp: { label: "Temporary", items: [], hasActions: false, dataset: { type: "buff", "buff-type": "temp" } },
      perm: { label: "Permanent", items: [], hasActions: false, dataset: { type: "buff", "buff-type": "perm" } },
      item: { label: "Item", items: [], hasActions: false, dataset: { type: "buff", "buff-type": "item" } },
      misc: { label: "Misc", items: [], hasActions: false, dataset: { type: "buff", "buff-type": "misc" } },
      all: { label: "All", items: [], hasActions: false, dataset: { type: "buff" } },
    };

    for (let b of buffs) {
      let s = b.data.buffType;
      if (!buffSections[s]) continue;
      buffSections[s].items.push(b);
      buffSections.all.items.push(b);
    }

    // Attacks
    const attackSections = {
      weapon: { label: "Weapon Attacks", items: [], canCreate: true, initial: false, showTypes: false, dataset: { type: "attack", "attack-type": "weapon" } },
      natural: { label: "Natural Attacks", items: [], canCreate: true, initial: false, showTypes: false, dataset: { type: "attack", "attack-type": "natural" } },
      ability: { label: "Class Abilities", items: [], canCreate: true, initial: false, showTypes: false, dataset: { type: "attack", "attack-type": "ability" } },
      racialAbility: { label: "Racial Abilities", items: [], canCreate: true, initial: false, showTypes: false, dataset: { type: "attack", "attack-type": "racialAbility" } },
      misc: { label: "Misc", items: [], canCreate: true, initial: false, showTypes: false, dataset: { type: "attack", "attack-type": "misc" } },
      all: { label: "All", items: [], canCreate: false, initial: true, showTypes: true, dataset: { type: "attack" } },
    };

    for (let a of attacks) {
      let s = a.data.attackType;
      if (!attackSections[s]) continue;
      attackSections[s].items.push(a);
      attackSections.all.items.push(a);
    }

    // Assign and return
    data.inventory = Object.values(inventory);
    data.spellbookData = spellbookData;
    data.features = Object.values(features);
    data.buffs = buffSections;
    data.attacks = attackSections;
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
    if ( !this.options.editable ) return;

    // Inventory Functions
    html.find(".currency-convert").click(this._onConvertCurrency.bind(this));

    // Spell Preparation
    html.find('.toggle-prepared').click(this._onPrepareItem.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the prepared status of an Owned Item within the Actor
   * @param {Event} event   The triggering click event
   * @private
   */
  _onPrepareItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);
    return item.update({"data.preparation.prepared": !item.data.data.preparation.prepared});
  }

  /* -------------------------------------------- */

  async _onConvertCurrency(event) {
    event.preventDefault();
    const curr = duplicate(this.actor.data.data.currency);
    const convert = {
      cp: {into: "sp", each: 10},
      sp: {into: "gp", each: 10 },
      gp: {into: "pp", each: 10 }
    };
    for ( let [c, t] of Object.entries(convert) ) {
      let change = Math.floor(curr[c] / t.each);
      curr[c] -= (change * t.each);
      curr[t.into] += change;
    }
    return this.actor.update({"data.currency": curr});
  }
}
