import { ActorSheetPF } from "../sheets/base.js";

/**
 * An Actor sheet for NPC type characters in the D&D5E system.
 * Extends the base ActorSheetPF class.
 * @type {ActorSheetPF}
 */
export class ActorSheetPFNPC extends ActorSheetPF {

  /**
   * Define default rendering options for the NPC sheet
   * @return {Object}
   */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      classes: ["pf1", "sheet", "actor", "npc"],
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
    return "systems/pf1/templates/actors/npc-sheet.html";
  }

  /* -------------------------------------------- */

  /**
   * Organize Owned Items for rendering the NPC sheet
   * @private
   */
  _prepareItems(data) {

    // Categorize items as inventory, spellbook, features, and classes
    const inventory = {
      weapon: { label: game.i18n.localize("PF1.InventoryWeapons"), canCreate: true, hasActions: false, items: [], dataset: { type: "weapon" } },
      equipment: { label: game.i18n.localize("PF1.InventoryArmorEquipment"), canCreate: true, hasActions: false, items: [], dataset: { type: "equipment" }, hasSlots: true },
      consumable: { label: game.i18n.localize("PF1.InventoryConsumables"), canCreate: true, hasActions: true, items: [], dataset: { type: "consumable" } },
      gear: { label: CONFIG.PF1.lootTypes["gear"], canCreate: true, hasActions: false, items: [], dataset: { type: "loot", "sub-type": "gear" } },
      ammo: { label: CONFIG.PF1.lootTypes["ammo"], canCreate: true, hasActions: false, items: [], dataset: { type: "loot", "sub-type": "ammo" } },
      misc: { label: CONFIG.PF1.lootTypes["misc"], canCreate: true, hasActions: false, items: [], dataset: { type: "loot", "sub-type": "misc" } },
      all: { label: game.i18n.localize("PF1.All"), canCreate: false, hasActions: true, items: [], dataset: {} },
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

    // Apply item filters
    spells = this._filterItems(spells, this._filters.spellbook);
    items = this._filterItems(items, this._filters.inventory);
    feats = this._filterItems(feats, this._filters.features);

    // Organize Spellbook
    let spellbookData = {};
    const spellbooks = data.actor.data.attributes.spells.spellbooks;
    for (let a of Object.keys(spellbooks)) {
      const spellbookSpells = spells.filter(obj => { return obj.data.spellbook === a; });
      spellbookData[a] = {
        data: this._prepareSpellbook(data, spellbookSpells, a),
        prepared: spellbookSpells.filter(obj => { return obj.data.preparation.mode === "prepared" && obj.data.preparation.prepared; }).length,
        orig: data.actor.data.attributes.spells.spellbooks[a],
      };
    }

    // Organize inventory
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
      classes: { label: game.i18n.localize("PF1.ClassPlural"), items: [], canCreate: true, hasActions: false, dataset: { type: "class" }, isClass: true },
      feat: { label: game.i18n.localize("PF1.FeatPlural"), items: [], canCreate: true, hasActions: true, dataset: { type: "feat", "feat-type": "feat" } },
      classFeat: { label: game.i18n.localize("PF1.ClassFeaturePlural"), items: [], canCreate: true, hasActions: true, dataset: { type: "feat", "feat-type": "classFeat" } },
      trait: { label: game.i18n.localize("PF1.TraitPlural"), items: [], canCreate: true, hasActions: true, dataset: { type: "feat", "feat-type": "trait" } },
      racial: { label: game.i18n.localize("PF1.RacialTraitPlural"), items: [], canCreate: true, hasActions: true, dataset: { type: "feat", "feat-type": "racial" } },
      misc: { label: game.i18n.localize("PF1.Misc"), items: [], canCreate: true, hasActions: true, dataset: { type: "feat", "feat-type": "misc" } },
      all: { label: game.i18n.localize("PF1.All"), items: [], canCreate: false, hasActions: true, dataset: { type: "feat" } },
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
      temp: { label: game.i18n.localize("PF1.Temporary"), items: [], hasActions: false, dataset: { type: "buff", "buff-type": "temp" } },
      perm: { label: game.i18n.localize("PF1.Permanent"), items: [], hasActions: false, dataset: { type: "buff", "buff-type": "perm" } },
      item: { label: game.i18n.localize("PF1.Item"), items: [], hasActions: false, dataset: { type: "buff", "buff-type": "item" } },
      misc: { label: game.i18n.localize("PF1.Misc"), items: [], hasActions: false, dataset: { type: "buff", "buff-type": "misc" } },
      all: { label: game.i18n.localize("PF1.All"), items: [], hasActions: false, dataset: { type: "buff" } },
    };

    for (let b of buffs) {
      let s = b.data.buffType;
      if (!buffSections[s]) continue;
      buffSections[s].items.push(b);
      buffSections.all.items.push(b);
    }

    // Attacks
    const attackSections = {
      weapon: { label: game.i18n.localize("PF1.AttackTypeWeaponPlural"), items: [], canCreate: true, initial: false, showTypes: false, dataset: { type: "attack", "attack-type": "weapon" } },
      natural: { label: game.i18n.localize("PF1.AttackTypeNaturalPlural"), items: [], canCreate: true, initial: false, showTypes: false, dataset: { type: "attack", "attack-type": "natural" } },
      ability: { label: game.i18n.localize("PF1.AttackTypeAbilityPlural"), items: [], canCreate: true, initial: false, showTypes: false, dataset: { type: "attack", "attack-type": "ability" } },
      racialAbility: { label: game.i18n.localize("PF1.AttackTypeRacialPlural"), items: [], canCreate: true, initial: false, showTypes: false, dataset: { type: "attack", "attack-type": "racialAbility" } },
      misc: { label: game.i18n.localize("PF1.Misc"), items: [], canCreate: true, initial: false, showTypes: false, dataset: { type: "attack", "attack-type": "misc" } },
      all: { label: game.i18n.localize("PF1.All"), items: [], canCreate: false, initial: true, showTypes: true, dataset: { type: "attack" } },
    };

    for (let a of attacks) {
      let s = a.data.attackType;
      if (!attackSections[s]) continue;
      attackSections[s].items.push(a);
      attackSections.all.items.push(a);
    }

    // Assign and return
    data.features = Object.values(features);
    data.inventory = Object.values(inventory);
    data.spellbookData = spellbookData;
    data.buffs = buffSections;
    data.attacks = attackSections;
  }


  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  getData() {
    const data = super.getData();

    // Challenge Rating
    const cr = parseFloat(data.data.details.cr || 0);
    const crLabels = {0: "0", 0.125: "1/8", 0.25: "1/4", 0.3375: "1/3", 0.5: "1/2"};
    data.labels["cr"] = cr >= 1 ? String(cr) : crLabels[cr] || 1;
    return data;
  }

  /* -------------------------------------------- */
  /*  Object Updates                              */
  /* -------------------------------------------- */

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  async _updateObject(event, formData) {

    // Format NPC Challenge Rating
    const crs = {"1/8": 0.125, "1/4": 0.25, "1/3": 0.3375, "1/2": 0.5};
    let crv = "data.details.cr";
    let cr = formData[crv];
    cr = crs[cr] || parseFloat(cr);
    if ( cr ) formData[crv] = cr < 1 ? cr : parseInt(cr);

    // Parent ActorSheet update steps
    super._updateObject(event, formData);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
	activateListeners(html) {
    super.activateListeners(html);

    // Rollable Health Formula
    html.find(".health .rollable").click(this._onRollHealthFormula.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling NPC health values using the provided formula
   * @param {Event} event     The original click event
   * @private
   */
  _onRollHealthFormula(event) {
    event.preventDefault();
    const formula = this.actor.data.data.attributes.hp.formula;
    if ( !formula ) return;
    const hp = new Roll(formula).roll().total;
    AudioHelper.play({src: CONFIG.sounds.dice});
    this.actor.update({"data.attributes.hp.value": hp, "data.attributes.hp.max": hp});
  }
}
