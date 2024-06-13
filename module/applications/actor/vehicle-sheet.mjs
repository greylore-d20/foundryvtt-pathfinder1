import { ActorSheetPF } from "./actor-sheet.mjs";

/**
 * An Actor sheet for Vehicle type characters in the game system.
 * Extends the base ActorSheetPF class.
 */
export class ActorSheetPFVehicle extends ActorSheetPF {
  /**
   * Define default rendering options for the NPC sheet
   *
   * @returns {object}
   */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "vehicle"],
      width: 680,
      height: 680,
      tabs: [{ navSelector: "nav.tabs", contentSelector: "section.primary-body", initial: "summary" }],
      scrollY: [".tab.summary"],
    };
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Get the correct HTML template path to use for rendering this particular sheet
   *
   * @type {string}
   */
  get template() {
    if (this.actor.limited) return "systems/pf1/templates/actors/limited-sheet.hbs";
    return "systems/pf1/templates/actors/vehicle-sheet.hbs";
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  async getData() {
    const isOwner = this.document.isOwner;
    const context = {
      owner: isOwner,
      system: this.actor.system,
      limited: this.document.limited,
      editable: this.isEditable,
      cssClass: isOwner ? "editable" : "locked",
      config: pf1.config,
      isGM: game.user.isGM,
      labels: {
        currency: `PF1.Currency.Inline.${this.itemValueDenomination}`,
      },
      isLootSheet: true, // inventory include unwanted data otherwise
    };

    context.system = foundry.utils.deepClone(this.document.system);

    context.vehicleSizes = Object.fromEntries(
      Object.entries(pf1.config.vehicles.size).map(([key, data]) => [key, data.label])
    );

    const notes = context.system.details?.notes?.value ?? "";
    context.notesHTML = notes
      ? await TextEditor.enrichHTML(notes, {
          secrets: isOwner,
          rollData: context.rollData,
          async: true,
          relativeTo: this.actor,
        })
      : null;

    // The Actor and its Items
    context.actor = this.actor;
    context.token = this.token;
    context.items = this.document.items
      .map((item) => this._prepareItem(item))
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));

    // Prepare owned items
    this._prepareItems(context);

    //context.sellMultiplier = this.actor.getFlag("pf1", "sellMultiplier");

    const baseCurrency = this.actor.getTotalCurrency({ inLowestDenomination: true });
    context.hasCurrency = true; // Never fade currency field for this

    // Get total value
    const cpValue = this.calculateTotalItemValue({ inLowestDenomination: true, recursive: true }) + baseCurrency;
    const cpSellValue = this.calculateSellItemValue({ inLowestDenomination: true, recursive: true }) + baseCurrency;

    context.totalValue = pf1.utils.currency.split(cpValue);
    context.sellValue = pf1.utils.currency.split(cpSellValue);
    context.labels.totalValue = game.i18n.format("PF1.Containers.TotalValue", context.totalValue);
    context.labels.sellValue = game.i18n.format("PF1.Containers.SellValue", context.sellValue);

    // Compute encumbrance
    context.encumbrance = this._computeEncumbrance();

    return context;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Organize and classify Owned Items - We just need attacks
   *
   * @param context
   * @private
   * @override
   */
  _prepareItems(context) {
    const [attacks] = context.items.reduce(
      (arr, item) => {
        item.img = item.img || Item.implementation.getDefaultArtwork(item);
        item.hasUses = item.uses && item.uses.max > 0;
        item.isCharged = ["day", "week", "charges"].includes(foundry.utils.getProperty(item, "uses.per"));

        const itemCharges =
          foundry.utils.getProperty(item, "uses.value") != null ? foundry.utils.getProperty(item, "uses.value") : 1;

        if (item.type === "attack") arr[0].push(item);
        return arr;
      },
      [[]]
    );

    const attackSections = Object.values(pf1.config.sheetSections.combatlite)
      .map((data) => ({ ...data }))
      .sort((a, b) => a.sort - b.sort);
    for (const i of attacks) {
      const section = attackSections.find((section) => this._applySectionFilter(i, section));
      if (section) {
        section.items ??= [];
        section.items.push(i);
      } else {
        console.warn("Could not find a sheet section for", i.name);
      }
    }

    context.attacks = attackSections;

    // Categorize items as inventory, spellbook, features, and classes
    const inventory = Object.values(pf1.config.sheetSections.inventory)
      .map((data) => ({ ...data }))
      .sort((a, b) => a.sort - b.sort);

    // Alter inventory columns
    for (const section of inventory) {
      section.interface = { ...section.interface, value: true, actions: false, noEquip: true };
    }

    const items = context.items.filter((i) => i.isPhysical);

    // Organize Inventory
    for (const i of items) {
      const section = inventory.find((section) => this._applySectionFilter(i, section));
      if (section) {
        section.items ??= [];
        section.items.push(i);
      }
    }

    context.inventory = inventory;
  }

  /** @type {CoinType} */
  get itemValueDenomination() {
    return "gp";
  }

  _updateObject(event, formData) {
    formData = foundry.utils.expandObject(formData);

    // Convert distances back to backend imperial format
    const convertibleKeys = ["maxSpeed", "acceleration"];
    for (const key of convertibleKeys) {
      const value = formData.system.details[key];
      if (Number.isFinite(value)) {
        formData.system.details[key] = pf1.utils.convertDistanceBack(value)[0];
      }
    }

    return super._updateObject(event, formData);
  }
}
