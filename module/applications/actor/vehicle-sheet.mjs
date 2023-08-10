import { ActorSheetPF } from "./actor-sheet.mjs";

/**
 * An Actor sheet for Vehicle type characters in the game system.
 * Extends the base ActorSheetPF class.
 *
 * @type {ActorSheetPF}
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
      width: 800,
      height: 650,
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
    const data = {
      owner: isOwner,
      limited: this.document.limited,
      editable: this.isEditable,
      cssClass: isOwner ? "editable" : "locked",
      config: pf1.config,
      isGM: game.user.isGM,
    };

    data.system = deepClone(this.document.system);

    // The Actor and its Items
    data.actor = this.actor;
    data.token = this.token;
    data.items = this.document.items.map((item) => {
      const i = deepClone(item.system);
      i.document = item;
      i.type = item.type;
      i.id = item.id;
      i.img = item.img;
      i.isSingleUse = item.isSingleUse;
      i.isCharged = item.isCharged;
      i.hasResource = i.isCharged && !i.isSingleUse;
      i.hasUses = i.uses?.max > 0;

      const firstAction = item.firstAction;
      const firstActionRollData = firstAction?.getRollData();

      i.labels = item.getLabels({ actionId: firstAction?.id, rollData: firstActionRollData });
      i.hasAttack = firstAction?.hasAttack;
      i.hasMultiAttack = firstAction?.hasMultiAttack;
      i.hasDamage = firstAction?.hasDamage;
      i.hasRange = firstAction?.hasRange;
      i.hasEffect = firstAction?.hasEffect;
      i.hasAction = item.hasAction || item.getScriptCalls("use").length > 0;
      i.range = mergeObject(
        firstAction?.data?.range ?? {},
        {
          min: firstAction?.getRange({ type: "min", rollData: firstActionRollData }),
          max: firstAction?.getRange({ type: "max", rollData: firstActionRollData }),
        },
        { inplace: false }
      );
      i.sort = item.sort;
      i.showUnidentifiedData = item.showUnidentifiedData;
      i.name = item.name; // Copy name over from item to handle identified state correctly

      i.isStack = i.quantity > 1;
      i.price = item.getValue({ recursive: false, sellValue: 1 });

      const itemQuantity = i.quantity != null ? i.quantity : 1;
      const itemCharges = i.uses?.value != null ? i.uses.value : 1;
      i.empty = itemQuantity <= 0 || (i.isCharged && !i.isSingleUse && itemCharges <= 0);

      return i;
    });
    data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

    // Prepare owned items
    this._prepareItems(data);

    return data;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   *
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.find('input[name="system.attributes.hp.max"]').keypress(this._onSubmitElement.bind(this));
  }

  /**
   * Organize and classify Owned Items - We just need attacks
   *
   * @param data
   * @private
   * @override
   */
  _prepareItems(data) {
    const [attacks] = data.items.reduce(
      (arr, item) => {
        item.img = item.img || foundry.data.ItemData.DEFAULT_ICON;
        item.hasUses = item.uses && item.uses.max > 0;
        item.isCharged = ["day", "week", "charges"].includes(getProperty(item, "uses.per"));

        const itemCharges = getProperty(item, "uses.value") != null ? getProperty(item, "uses.value") : 1;

        if (item.type === "attack") arr[0].push(item);
        return arr;
      },
      [[]]
    );

    const attackSections = {
      all: {
        label: game.i18n.localize("PF1.ActionPlural"),
        items: [],
        canCreate: true,
        initial: true,
        showTypes: true,
        dataset: { type: "attack", "sub-type": "weapon" },
      },
    };

    for (const a of attacks) {
      attackSections.all.items.push(a);
    }

    data.attacks = attackSections;
  }
}
