import { ItemSheetPF } from "./item-sheet.mjs";
import { getSkipActionPrompt } from "../../documents/settings.mjs";
import { CurrencyTransfer } from "../currency-transfer.mjs";
import { renderCachedTemplate } from "@utils/handlebars/templates.mjs";

export class ItemSheetPF_Container extends ItemSheetPF {
  constructor(...args) {
    super(...args);

    /**
     * @type {string[]} IDs of expanded items.
     * @private
     */
    this._expandedItems = [];

    /**
     * Track the set of item filters which are applied
     *
     * @type {Set}
     */
    this._filters = {
      search: { container: "" },
    };

    /** Item search */
    this.searchCompositioning = false; // for IME
    this.searchRefresh = true; // Lock out same term search unless sheet also refreshes
    this.searchDelay = 250; // arbitrary ?ms for arbitrarily decent reactivity; MMke this configurable?
    this.searchDelayEvent = null; // setTimeout id
    this.effectiveSearch = ""; // prevent searching the same thing

    /**
     * Track item updates from the actor sheet.
     *
     * @type {object[]}
     */
    this._itemUpdates = [];

    /**
     * Override item sheet initial tab.
     * Assumes first tab definitionis the main tab.
     */
    this.options.tabs[0].initial = "contents"; // Doesn't actually do anything
    this._tabs[0].active = "contents"; // Actual override
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 800,
      classes: ["pf1", "sheet", "item"],
      scrollY: [".item-groups-list"],
      dragDrop: [
        { dragSelector: "li.item[data-item-id]", dropSelector: '.tab[data-tab="contents"]' },
        { dragSelector: "label.denomination" },
      ],
    });
  }

  /**
   * Return a dynamic reference to the HTML template path used to render this Item Sheet
   *
   * @returns {string}
   */
  get template() {
    return "systems/pf1/templates/items/container.hbs";
  }

  /* -------------------------------------------- */

  /**
   * Prepare item sheet data
   * Start with the base item data and extending with additional properties for rendering.
   */
  async getData() {
    const data = await super.getData();

    data.units = {
      weight: pf1.utils.getWeightSystem() === "metric" ? game.i18n.localize("PF1.Kgs") : game.i18n.localize("PF1.Lbs"),
    };

    // Add filters
    data.filters = this._filters;

    // The item's items
    data.items = this.item.items.reduce((cur, item) => {
      const itemData = item.system;
      const i = { ...item };
      i.id = item.id; // Alias
      cur.push(i);
      i.type = item.type;
      i.subType = item.subType;
      i.document = item;
      i.labels = item.getLabels();
      i.hasAttack = item.hasAttack;
      i.hasDamage = item.hasDamage;
      i.hasAction = item.hasAction || item.isCharged;
      i.showUnidentifiedData = item.showUnidentifiedData;

      i.quantity = itemData.quantity || 0;
      i.isStack = i.quantity > 1;
      //i.price = item.getValue({ recursive: false, sellValue: 1, inLowestDenomination: true }) / 100;
      i.destroyed = itemData.hp?.value <= 0;

      const itemCharges = itemData.uses?.value != null ? itemData.uses.value : 1;

      i.empty = false;
      if (item.isPhysical && i.quantity <= 0) i.empty = true;
      else if (item.isCharged && !itemData.isSingleUse && itemCharges <= 0) i.empty = true;
      i.disabled = i.destroyed || false;

      return cur;
    }, []);
    data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

    // Show whether the item has currency
    data.hasCurrency = Object.values(this.object.system.currency).some((o) => o > 0);

    // Prepare inventory
    this._prepareContents(data);

    // Get contents weight
    const usystem = pf1.utils.getWeightSystem();
    data.weight = {
      contents: this.item.system.weight.converted.contents,
      units: usystem === "metric" ? game.i18n.localize("PF1.Kgs") : game.i18n.localize("PF1.Lbs"),
    };

    // Get contents value
    const coinage = pf1.utils.currency.merge(this.item.system.currency);

    const cpValue =
      this.item.getValue({ recursive: true, sellValue: 1, inLowestDenomination: true }) -
      this.item.getValue({ recursive: false, sellValue: 1, inLowestDenomination: true }) -
      coinage;
    const cpSellValue =
      this.item.getValue({ recursive: true, inLowestDenomination: true }) -
      this.item.getValue({ recursive: false, inLowestDenomination: true }) -
      coinage;

    data.totalValue = pf1.utils.currency.split(cpValue);
    data.sellValue = pf1.utils.currency.split(cpSellValue);
    data.currency = pf1.utils.currency.split(coinage);

    // Set value labels
    data.labels ??= {};
    data.labels.totalValue = game.i18n.format("PF1.SplitValue", data.totalValue);
    data.labels.sellValue = game.i18n.format("PF1.SplitValue", data.sellValue);
    data.labels.currency = game.i18n.format("PF1.SplitValue", data.currency);

    return data;
  }

  /**
   * Filters item by {@link pf1.config.sheetSections sheet section} config.
   *
   * @internal
   * @param {Item} item - Item to filter
   * @param {object} section - Section to filter by
   * @returns {boolean}
   */
  _applySectionFilter(item, section) {
    if (!section.filters) throw new Error(`Section "${section.path}" lacks filters`);
    return section.filters.some((filter) => {
      if (filter.type === item.type) {
        return filter.subTypes?.includes(item.subType) ?? true;
      }
      return false;
    });
  }

  _prepareContents(data) {
    // Categorize items as inventory, spellbook, features, and classes
    const inventory = Object.values(pf1.config.sheetSections.inventory)
      .map((data) => ({ ...data }))
      .sort((a, b) => a.sort - b.sort);

    // Partition items by category
    const items = data.items.reduce((arr, item) => {
      item.img = item.img || DEFAULT_TOKEN;
      item.isStack = item.system.quantity ? item.system.quantity > 1 : false;
      item.hasUses = item.system.uses && item.system.uses.max > 0;
      item.isCharged = ["day", "week", "charges"].includes(item.system.uses?.per);
      item.price = item.system.identified === false ? item.system.unidentified?.price ?? 0 : item.system.price ?? 0;

      const itemQuantity = item.system.quantity || 0;
      const itemCharges = item.system.uses?.value || 0;
      item.empty = itemQuantity <= 0 || (item.isCharged && itemCharges <= 0);
      item.destroyed = item.system.hp?.value <= 0;
      item.disabled = item.empty || item.destroyed;

      arr.push(item);
      return arr;
    }, []);

    // Organize Inventory
    for (const i of items) {
      const section = inventory.find((section) => this._applySectionFilter(i, section));
      if (section) {
        section.items ??= [];
        section.items.push(i);
      } else {
        console.warn(`Could not find section for item "${i.name}"`, i);
      }
    }

    data.inventory = inventory;
  }

  async _renderInner(...args) {
    const html = await super._renderInner(...args);

    // Re-open item summaries
    for (const itemId of this._expandedItems) {
      // Only display summaries of items that are still present
      if (this.document.items.has(itemId)) {
        const elem = html.find(`.item-list>.item[data-item-id="${itemId}"]`)[0];
        if (elem) this._openItemSummary(elem, { animation: false });
      } else {
        // Delete itemIds belonging to items no longer found in the actor
        this._expandedItems.findSplice((o) => o === itemId);
      }
    }

    return html;
  }

  activateListeners(html) {
    super.activateListeners(html);

    /* -------------------------------------------- */
    /*  Inventory
    /* -------------------------------------------- */

    // Owned Item management
    html.find(`.tab[data-tab="contents"] .item-create`).click((ev) => this._onItemCreate(ev));
    html.find(`.tab[data-tab="contents"] .item-edit`).click(this._onItemEdit.bind(this));
    html.find(`.tab[data-tab="contents"] .item-delete`).click(this._onItemDelete.bind(this));
    html.find(`.tab[data-tab="contents"] .item-take`).click(this._onItemTake.bind(this));

    html
      .find(".item .item-name")
      // Quick edit item
      .contextmenu(this._onItemEdit.bind(this))
      // Open item summary
      .click(this._onItemSummary.bind(this));

    // Quick (un)identify item
    html.find("a.item-control.item-identify").click((ev) => {
      this._quickIdentifyItem(ev);
    });

    // Duplicate item
    html.find("a.item-control.item-duplicate").click(this._duplicateItem.bind(this));

    // Quick add item quantity
    html.find("a.item-control.item-quantity-add").click((ev) => {
      this._quickChangeItemQuantity(ev, 1);
    });
    // Quick subtract item quantity
    html.find("a.item-control.item-quantity-subtract").click((ev) => {
      this._quickChangeItemQuantity(ev, -1);
    });

    // Quick Item Action control
    html.find(".item-actions a").click((ev) => this._quickItemActionControl(ev));

    // Set item uses
    html
      .find(".item-detail.item-uses input[type='text']:not(:disabled)")
      .off("change")
      .change(this._setItemUses.bind(this))
      .on("wheel", this._setItemUses.bind(this));

    // Convert currency
    html.find("a.convert-currency").click(this._convertCurrency.bind(this));

    // Item Rolling
    html.find(".item .item-image").click((event) => this._onItemRoll(event));

    // Search box
    const sb = html.find(".search-input");
    sb.on("keyup change", this._searchFilterChange.bind(this));
    sb.on("compositionstart compositionend", this._searchFilterCompositioning.bind(this)); // for IME
    this.searchRefresh = true;
    // Filter following refresh
    sb.each(function () {
      if (this.value.length > 0) $(this).change();
    });
    html.find(".clear-search").on("click", this._clearSearch.bind(this));
  }

  _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const typeName = header.dataset.typeName || header.dataset.type;
    const itemData = {
      name: `New ${typeName.capitalize()}`,
      type: type,
      system: {
        subType: header.dataset.subType,
      },
    };

    return this.item.createContainerContent(itemData, { renderSheet: true });
  }

  _onItemEdit(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    const item = this.item.getContainerContent(li.dataset.itemId);

    item.sheet.render(true, { focus: true, editable: this.isEditable });
  }

  _onItemSummary(event) {
    event.preventDefault();
    const li = event.target.closest(".item[data-item-id]");
    this._openItemSummary(li);
  }

  /**
   * @internal
   * @param {Element} elem
   * @param {object} [options] - Additional options
   * @param {boolean} [options.animation=true]
   * @param {object} [options.rollData]
   */
  async _openItemSummary(elem, { animation = true, rollData } = {}) {
    // Check whether pseudo-item belongs to another collection
    const itemId = elem.dataset.itemId;
    const item = this.document.items.get(itemId);

    rollData ??= item.defaultAction?.getRollData() ?? item.getRollData();

    const { description, properties } = await item.getChatData({ chatcard: false, rollData });

    // Toggle summary
    this._expandedItems = this._expandedItems.filter((o) => o !== itemId);
    if (elem.classList.contains("expanded")) {
      const summary = elem.querySelector(".item-summary");
      if (!animation) summary.remove();
      else $(summary).slideUp(200, () => summary.remove());
    } else {
      const templateData = {
        description: description || game.i18n.localize("PF1.NoDescription"),
        properties,
      };
      let content = await renderTemplate("systems/pf1/templates/actors/parts/actor-item-summary.hbs", templateData);
      content = await TextEditor.enrichHTML(content, { rollData, async: true, secrets: this.document.isOwner });

      const div = $(content);

      if (!animation) elem.append(...div);
      else {
        div.hide();
        elem.append(...div);
        div.slideDown(200);
      }
      this._expandedItems.push(itemId);
    }
    elem.classList.toggle("expanded");
  }

  _onItemDelete(event) {
    event.preventDefault();

    const button = event.currentTarget;
    if (button.disabled) return;

    const li = event.currentTarget.closest(".item");
    if (getSkipActionPrompt()) {
      this.item.deleteContainerContent(li.dataset.itemId);
    } else {
      button.disabled = true;

      const item = this.document.items.get(li.dataset.itemId);

      const msg = `<p>${game.i18n.localize("PF1.DeleteItemConfirmation")}</p>`;
      Dialog.confirm({
        title: game.i18n.format("PF1.DeleteItemTitle", { name: item.name }),
        content: msg,
        yes: () => {
          this.item.deleteContainerContent(li.dataset.itemId);
          button.disabled = false;
        },
        no: () => (button.disabled = false),
        rejectClose: true,
      }).then(null, () => (button.disabled = false));
    }
  }

  async _onItemTake(event) {
    event.preventDefault();

    const li = event.currentTarget.closest(".item");
    const item = this.item.getContainerContent(li.dataset.itemId);

    if (this.actor) {
      await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
      await this.item.deleteContainerContent(item._id);
    }
  }

  _onDragStart(event) {
    // Create drag data for an owned item
    const elem = event.currentTarget;
    let dragData;
    if (elem.classList.contains("denomination")) {
      if (!this.item.testUserPermission(game.user, 3)) return;
      dragData = {
        type: "Currency",
        alt: elem.classList.contains("alt-currency"),
        currency: [...elem.classList].find((o) => /[pgsc]p/.test(o)),
        containerId: this.item.id,
        amount: parseInt(elem.nextElementSibling.textContent || elem.nextElementSibling.value),
      };
    } else {
      const item = this.item.getContainerContent(elem.dataset.itemId);
      dragData = {
        type: "Item",
        data: item.toObject(),
        containerId: this.item.id,
      };
      dragData.itemId = item.id;
    }

    // Add actor to drag data
    dragData.actorUuid = this.item.actor?.uuid;

    // Set data transfer
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  _onDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    // Try to extract the data
    const data = TextEditor.getDragEventData(event);

    const item = this.item;

    // Handle the drop with a Hooked function
    const allowed = Hooks.call("pf1DropContainerSheetData", item, this, data);
    if (allowed === false) return;

    // Handle different data types
    switch (data.type) {
      case "Item":
        return this._onDropItem(event, data);
      case "Currency": {
        return this._onDropCurrency(event, data);
      }
    }
  }

  async _onDropCurrency(event, data) {
    const sourceActor = await fromUuid(data.actorUuid || "");

    return new CurrencyTransfer(
      { actor: sourceActor, container: data.containerId, alt: data.alt },
      {
        actor: this.actor,
        container: this.item.id,
        amount: Object.fromEntries([[data.currency, parseInt(data.amount)]]),
      }
    ).render(true);
  }

  async _onDropItem(event, data) {
    if (!this.item.isOwner) return void ui.notifications.warn("PF1.Error.NoItemPermission", { localize: true });

    const { actorUuid, containerId } = data;
    const item = await Item.implementation.fromDropData(data);
    let sourceActor = actorUuid ? await fromUuid(actorUuid) : null;
    sourceActor ??= item.actor;

    const sameActor = sourceActor && sourceActor === this.item.actor;

    const itemData = game.items.fromCompendium(item, { clearFolder: true, keepId: sameActor, clearSort: !sameActor });

    // Sort item
    if (sameActor && containerId === this.item.id) {
      return this._onSortItem(event, itemData);
    }

    // Create consumable from spell
    if (itemData.type === "spell") {
      const resultData = await pf1.documents.item.ItemSpellPF.toConsumablePrompt(itemData, {
        allowSpell: false,
        actor: this.item.actor,
      });
      if (resultData) return this.item.createContainerContent(resultData);
      else return false;
    }

    // Create or transfer item
    if (item.isPhysical) {
      await this.item.createContainerContent(itemData);
      // TODO: Verify item was created so we don't delete source item without reason

      if (sameActor) {
        if (containerId) {
          sourceActor.containerItems
            .find((i) => i.id === data.itemId && i.parentItem?.id === containerId)
            ?.parentItem.deleteContainerContent(data.itemId);
        } else {
          sourceActor.items.get(item.id)?.delete();
        }
      }
    }
  }

  async _quickIdentifyItem(event) {
    event.preventDefault();
    if (!game.user.isGM) {
      return void ui.notifications.error(game.i18n.localize("PF1.Error.CantIdentify"));
    }
    const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const item = this.item.getContainerContent(itemId);

    const isIdentified = item.system.identified;
    if (isIdentified !== undefined) {
      return item.update({ "system.identified": !isIdentified });
    }
  }

  async _duplicateItem(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const itemId = $(a).parents(".item").attr("data-item-id");
    const item = this.item.getContainerContent(itemId);
    const itemData = item.toObject();

    delete itemData.system?.links?.children;
    delete itemData.system?.links?.charges;

    delete itemData._id;
    itemData.name = `${itemData.name} (${game.i18n.localize("PF1.Copy")})`;
    if (item.isPhysical && !item.system.identified) {
      itemData.system.unidentified.name = `${item.system.unidentified.name} (${game.i18n.localize("PF1.Copy")})`;
    }
    if (itemData.system.links?.children) delete itemData.system.links.children;

    return this.item.createContainerContent(itemData);
  }

  async _quickChangeItemQuantity(event, add = 1) {
    event.preventDefault();
    if (event.shiftKey) add *= 5;
    else if (event.ctrlKey) add *= 10;

    const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
    const item = this.item.getContainerContent(itemId);

    const curQuantity = item.system.quantity || 0;
    let newQuantity = Math.max(0, curQuantity + add);
    if (item.type === "container" && newQuantity > 1) newQuantity = 1;
    return item.update({ "system.quantity": newQuantity });
  }

  /**
   * Handles click events to trigger the use of an item.
   *
   * @protected
   * @param {MouseEvent} event - The originating click event
   */
  _quickItemActionControl(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).closest(".item").attr("data-item-id");
    const item = this.item.getContainerContent(itemId);
    item.use({ ev: event });
  }

  async _setItemUses(event) {
    event.preventDefault();
    const el = event.currentTarget;
    const itemId = el.closest(".item").dataset.itemId;
    const item = this.item.getContainerContent(itemId);

    this._mouseWheelAdd(event.originalEvent, el);

    const value = Number(el.value);
    this.setItemUpdate(item._id, "system.uses.value", value);

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      el.addEventListener("pointerleave", () => this._updateItems(), { passive: true, once: true });
    } else this._updateItems();
  }

  async _updateItems() {
    const promises = [];

    const updates = this._itemUpdates;
    this._itemUpdates = [];

    for (const data of updates) {
      const item = this.item.items.get(data._id);
      if (!item) continue;

      delete data._id;
      if (item.testUserPermission(game.user, "OWNER")) promises.push(item.update(data));
    }

    return Promise.all(promises);
  }

  setItemUpdate(id, key, value) {
    let obj = this._itemUpdates.find((o) => o._id === id);
    if (!obj) {
      obj = { _id: id };
      this._itemUpdates.push(obj);
    }

    obj[key] = value;
  }

  _mouseWheelAdd(event, el) {
    if (event && event instanceof WheelEvent) {
      const value = parseFloat(el.value);
      if (Number.isNaN(value)) return;

      const increase = -Math.sign(event.deltaY);
      const amount = parseFloat(el.dataset.wheelStep) || 1;
      el.value = value + amount * increase;
    }
  }

  _convertCurrency(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const currencyType = a.dataset.type;

    this.item.convertCurrency(currencyType);
  }

  /**
   * @override
   */
  _onSortItem(event, itemData) {
    const items = this.document.items;

    // Get the drag source and its siblings
    const source = items.get(itemData._id);

    // Get the drop target
    const dropTarget = event.target.closest(".item");
    const targetId = dropTarget ? dropTarget.dataset.itemId : null;
    const target = items.get(targetId);

    // Don't sort on yourself
    if (targetId === source.id) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (const el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.itemId;
      if (siblingId && siblingId !== source.id) {
        const item = items.get(el.dataset.itemId);
        // Only take same typed siblings
        if (item.type !== source.type) continue;
        siblings.push(item);
      }
    }

    // Don't sort if target has no siblings
    if (siblings.length == 0) return;

    // Perform the sort
    const sortUpdates = SortingHelpers.performIntegerSort(source, { target, siblings });
    const updateData = sortUpdates.map((u) => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return this.item.updateContainerContents(updateData);
  }

  /**
   * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
   *
   * @param event
   * @private
   */
  _onItemRoll(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.item.getContainerContent(itemId);

    if (item == null) return;
    return item.displayCard();
  }

  /** Item Search */

  _searchFilterCommit(event) {
    const container = this.item;
    const search = this._filters.search.container.toLowerCase();

    // TODO: Do not refresh if same search term, unless the sheet has updated.
    if (this.effectiveSearch === search && !this.searchRefresh) return;

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
    this._filters.search.container = "";
    $(event.target).prev(".search-input").val("").change();
  }

  // IME related
  _searchFilterCompositioning(event) {
    this.searchCompositioning = event.type === "compositionstart";
  }

  _searchFilterChange(event) {
    event.preventDefault();
    event.stopPropagation();

    // Accept input only while not compositioning

    const search = event.target.value;
    const changed = this._filters.search.container !== search;

    if (this.searchCompositioning || changed) clearTimeout(this.searchDelayEvent); // reset
    if (this.searchCompositioning) return;

    this._filters.search.container = search;

    if (event.type === "keyup") {
      // Delay search
      if (changed) this.searchDelayEvent = setTimeout(() => this._searchFilterCommit(event), this.searchDelay);
    } else this._searchFilterCommit(event);
  }
}
