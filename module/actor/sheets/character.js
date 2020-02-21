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
      height: 800
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
      weapon: { label: "Weapons/Attacks", canCreate: true, items: [], dataset: { type: "weapon" } },
      equipment: { label: "Armor/Equipment", canCreate: true, items: [], dataset: { type: "equipment" }, hasSlots: true },
      consumable: { label: "Consumables", canCreate: true, items: [], dataset: { type: "consumable" } },
      gear: { label: "Gear", canCreate: true, items: [], dataset: { type: "loot", "sub-type": "gear" } },
      ammo: { label: "Ammunition", canCreate: true, items: [], dataset: { type: "loot", "sub-type": "ammo" } },
      misc: { label: "Misc", canCreate: true, items: [], dataset: { type: "loot", "sub-type": "misc" } },
      all: { label: "All", canCreate: false, items: [], dataset: {} },
    };

    // Partition items by category
    let [items, spells, feats, classes] = data.items.reduce((arr, item) => {
      item.img = item.img || DEFAULT_TOKEN;
      item.isStack = item.data.quantity ? item.data.quantity > 1 : false;
      item.hasUses = item.data.uses && (item.data.uses.max > 0);
      item.isOnCooldown = item.data.recharge && !!item.data.recharge.value && (item.data.recharge.charged === false);
      const unusable = item.isOnCooldown && (item.data.uses.per && (item.data.uses.value > 0));
      item.isCharged = !unusable;
      if ( item.type === "spell" ) arr[1].push(item);
      else if ( item.type === "feat" ) arr[2].push(item);
      else if ( item.type === "class" ) arr[3].push(item);
      else if ( Object.keys(inventory).includes(item.type) || (item.data.subType != null && Object.keys(inventory).includes(item.data.subType)) ) arr[0].push(item);
      return arr;
    }, [[], [], [], []]);

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
    let totalWeight = 0;
    for ( let i of items ) {
      const subType = i.type === "loot" ? i.data.subType || "gear" : i.data.subType;
      i.data.quantity = i.data.quantity || 0;
      i.data.weight = i.data.weight || 0;
      i.totalWeight = Math.round(i.data.quantity * i.data.weight * 10) / 10;
      if (inventory[i.type] != null) inventory[i.type].items.push(i);
      if (subType != null && inventory[subType] != null) inventory[subType].items.push(i);
      inventory.all.items.push(i);
      if (i.data.carried) totalWeight += i.totalWeight;
    }
    data.data.attributes.encumbrance = this._computeEncumbrance(totalWeight, data);

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

    // Assign and return
    data.inventory = Object.values(inventory);
    data.spellbookData = spellbookData;
    data.features = Object.values(features);
    data.buffs = buffSections;
  }

  /* -------------------------------------------- */

  /**
   * Compute the level and percentage of encumbrance for an Actor.
   *
   * Optionally include the weight of carried currency across all denominations by applying the standard rule
   * from the PHB pg. 143
   *
   * @param {Number} totalWeight    The cumulative item weight from inventory items
   * @param {Object} actorData      The data object for the Actor being rendered
   * @return {Object}               An object describing the character's encumbrance level
   * @private
   */
  _computeEncumbrance(totalWeight, actorData) {

    // Encumbrance classes
    let mod = {
      normal: {
        fine: 0.125,
        dim: 0.25,
        tiny: 0.5,
        sm: 0.75,
        med: 1,
        lg: 2,
        huge: 4,
        grg: 8,
        col: 16
      },
      quadruped: {
        fine: 0.25,
        dim: 0.5,
        tiny: 0.75,
        sm: 1,
        med: 1.5,
        lg: 3,
        huge: 6,
        grg: 12,
        col: 24
      }
    }[actorData.data.attributes.quadruped === true ? "quadruped" : "normal"][actorData.data.traits.size] || 1;

    let table = [
      0,
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
      115, 130, 150, 175, 200, 230, 260, 300, 350,
      400, 460, 520, 600, 700, 800, 920, 1040, 1200, 1400
    ];

    // Add Currency Weight
    const currency = actorData.data.currency;
    const numCoins = Object.values(currency).reduce((val, denom) => val += denom, 0);
    totalWeight += numCoins / 50;

    // Get carry capacity bonuses
    const carryBonus = actorData.data.abilities.str.carryBonus || 0;
    const carryMultiplier = actorData.data.abilities.str.carryMultiplier || 1;

    // Compute Encumbrance percentage
    const strength = actorData.data.abilities.str.total;
    const totalStrength = strength + carryBonus;
    let heavy = Math.max(3, (totalStrength > table.length ? table[table.length - 1] + 200 * totalStrength : table[totalStrength]) * mod * carryMultiplier);
    const enc = {
      light: Math.floor(heavy / 3),
      medium: Math.floor(heavy / 3 * 2),
      heavy: heavy,
      carry: heavy * 2,
      drag: heavy * 5,
      value: Math.round(totalWeight * 10) / 10,
    };
    enc.pct = {
      light: Math.max(0, Math.min(enc.value * 100 / enc.light, 99.5)),
      medium: Math.max(0, Math.min((enc.value - enc.light) * 100 / (enc.medium - enc.light), 99.5)),
      heavy: Math.max(0, Math.min((enc.value - enc.medium) * 100 / (enc.heavy - enc.medium), 99.5))
    };
    enc.encumbered = {
      light: enc.value >= enc.light,
      medium: enc.value >= enc.medium,
      heavy: enc.value >= enc.heavy
    };
    enc.level = 0;
    if (enc.encumbered.light) enc.level++;
    if (enc.encumbered.medium) enc.level++;

    if (actorData.data.attributes.encumbrance.level !== enc.level) {
      const updateData = {"data.attributes.encumbrance.level": enc.level};
      this.actor.update(updateData);
    }

    return enc;
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
