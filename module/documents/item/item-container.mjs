import { ItemPhysicalPF } from "./item-physical.mjs";

/**
 * Container item
 *
 * Bags, backpacks, chests, etc.
 */
export class ItemContainerPF extends ItemPhysicalPF {
  /**
   * @override
   */
  static system = Object.freeze({
    ...super.system,
    hasIdentifier: true,
  });

  constructor(...args) {
    super(...args);

    this.items ??= null;
  }

  /**
   * @internal
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    // No system updates
    if (!changed.system) return;

    if (context.recursive === false || context.diff === false) return;

    // Ensure contained item updates adhere to reason
    const items = changed.system.items;
    if (items) {
      for (const [itemId, itemData] of Object.entries(items)) {
        await this._containedItemUpdate(itemId, itemData, items, context);
      }
    }
  }

  /**
   * Handle conhtained item CRUD
   *
   * @internal
   * @param {string} itemId - Item ID
   * @param {object|null} itemData - Item's update data
   * @param context
   * @param {object} items - Parent's items update object
   */
  async _containedItemUpdate(itemId, itemData, items, context) {
    // Deletion
    if (itemId.startsWith("-=")) {
      /** @type {ItemPF} */
      const oldItem = this.items.get(itemId.replace(/^-=/, ""));

      if (oldItem) {
        await oldItem._preDelete(context, game.user);
        // TODO: Run pre-delete on everything contained by this
      }
      return;
    }

    /** @type {ItemPF} */
    const oldItem = this.items.get(itemId);

    let diff;
    // Existing contained item
    if (oldItem) {
      await oldItem._preUpdate(itemData, context, game.user);
      diff = oldItem.updateSource(itemData, { dryRun: true, fallback: false });
      // Remove lingering .data if present, the above line prunes this out if done externally
      if ("data" in this.system.items[itemId]) diff["-=data"] = null;
    }
    // New contained item
    else {
      /** @type {ItemPF} */
      const temp = new Item.implementation(itemData);
      await temp._preCreate(itemData, context, game.user);
      diff = temp.toObject();
    }

    items[itemId] = diff;
  }

  /**
   * @override
   * @param {object} changed
   * @param {object} options
   * @param {string} userId
   */
  _onUpdate(changed, options, userId) {
    // Call various document workflows for changed items
    const items = changed.system?.items;
    if (items) {
      for (const [itemId, itemData] of Object.entries(items)) {
        const item = this.items.get(itemId);
        try {
          if (itemId.startsWith("-=")) {
            // TODO: Item reference is no longer available for _onDelete workflow
            // item._onDelete(options, userId);
          } else if (itemData._id) {
            item._onCreate(itemData, options, userId);
          } else {
            item._onUpdate(itemData, options, userId);
          }
        } catch (err) {
          console.error(err, { parent: this, item });
        }

        // TODO: createDocument, deleteDocument, updateDocument hooks
      }
    }

    super._onUpdate(changed, options, userId);
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();

    // Set base weight to weight of coins, which can be calculated without knowing contained items
    const weightReduction = (100 - (this.system.weight?.reduction?.percent ?? 0)) / 100;
    this.system.weight.currency = this._calculateCoinWeight() * weightReduction;
  }

  /** @override */
  prepareDerivedData() {
    this._prepareInventory();

    super.prepareDerivedData();
  }

  /**
   * Prepare dependent data for contained items.
   *
   * @inheritDoc
   */
  _prepareDependentData(final = false) {
    super._prepareDependentData(final);

    // Update dependant data and resources
    this.items.forEach((item) => {
      item._prepareDependentData();
    });
  }

  /**
   * Prepare .items collection for contained items.
   *
   * @private
   */
  _prepareInventory() {
    const prior = this.items;
    const collection = new Collection();
    this.system.items ??= {}; // Shim for items that haven't had template.json applied to them
    for (const [itemId, itemData] of Object.entries(this.system.items)) {
      try {
        let item = prior?.get(itemId);
        if (item) {
          item.updateSource(new Item.implementation(itemData).toObject(), { recursive: false });
        } else {
          item = new Item.implementation(itemData, { parent: this.actor });
          item.parentItem = this;
        }
        item.reset();
        collection.set(itemId, item);
      } catch (err) {
        console.error("Error preparing contained item:", { id: itemId, data: itemData }, this);
        throw err;
      }
    }

    this.items = collection;
  }

  /** @inheritDoc */
  prepareWeight() {
    this.system.weight ??= {};
    /** @type {ItemWeightData} */
    const weight = this.system.weight;
    weight.total = 0; // Reset

    // Percentile weight reduction
    const weightMult = (100 - (weight.reduction?.percent || 0)) / 100;

    const currencyWeight = this._calculateCoinWeight();
    weight.currency = currencyWeight * weightMult;

    // Total unreduced weight of contents
    weight.contents = this.items.reduce((total, item) => total + item.system.weight.total, 0);
    weight.contents += currencyWeight;

    const reductionFlat = weight.reduction?.value ?? 0;
    weight.total += Math.max(0, weight.contents * weightMult - reductionFlat);

    weight.converted.reduction = pf1.utils.convertWeight(reductionFlat);
    weight.converted.contents = pf1.utils.convertWeight(weight.contents);
    weight.converted.currency = pf1.utils.convertWeight(weight.currency);

    super.prepareWeight();
  }

  /**
   * @deprecated
   * @param itemId
   */
  getContainerContent(itemId) {
    foundry.utils.logCompatibilityWarning(
      "ItemContainerPF.getContainerContent() is deprecated in favor of ItemContainerPF.items collection usage.",
      {
        since: "PF1 v10",
        until: "PF1 v11",
      }
    );
    return this.items.get(itemId);
  }

  /**
   * @protected
   * @param {object[]} itemData Item creation data
   * @param itemsData
   * @param {object} [options={}] Additional options
   * @returns {Promise<this>} Promise to the updated document.
   */
  async createContainerContent(itemsData, options = { renderSheet: false }) {
    itemsData = itemsData instanceof Array ? itemsData : [itemsData];

    const itemOptions = deepClone(options);
    const user = game.user;

    const actuallyCreated = [];
    const updateData = { system: { items: {} } };

    // Iterate over data to create
    for (const itemData of itemsData) {
      // Find unique ID
      do {
        itemData._id = foundry.utils.randomID(16);
      } while (this.system.items[itemData._id] !== undefined);

      // Create temporary item
      const item = new Item.implementation(itemData);

      // Run pre-create workflow
      let allowed = (await item._preCreate(itemData, options, game.user)) ?? true;
      allowed &&= options.noHook || Hooks.call("preCreateItem", item, itemData, itemOptions, user.id);
      if (allowed === false) {
        console.debug(`${vtt} | Item creation prevented during pre-create`);
        continue;
      }

      // Update _stats
      item.updateSource({
        _stats: {
          coreVersion: game.version,
          systemVersion: game.system.version,
          createdTime: Date.now(),
          lastModifiedBy: user.id,
        },
      });

      updateData.system.items[itemData._id] = item.toObject();
      actuallyCreated.push(itemData._id);
    }

    await this.update(updateData, { pf1: { createContained: actuallyCreated } });

    // Mimic createEmbeddedDocuments()
    const created = this.items.filter((i) => actuallyCreated.includes(i.id));
    if (options.renderSheet) created.forEach((i) => i.sheet.render(true));
    return created;
  }

  async deleteContainerContent(data, context = {}) {
    const ids = new Set(data instanceof Array ? data : [data]);

    const embeddedName = "ContainerContent";
    const user = game.user;

    const updateData = { system: { items: {} } };

    const actuallyDeleted = [];

    // Iterate over data to delete
    for (const id of ids) {
      const item = this.items.get(id);

      // Run pre-delete workflow
      let allowed = (await item._preDelete(context, user)) ?? true;
      allowed &&= context.noHook || Hooks.call(`preDelete${embeddedName}`, item, context, user.id);
      if (allowed === false) {
        console.debug(`${vtt} | ${embeddedName} deletion prevented during pre-delete`);
        continue;
      }

      updateData.system.items[`-=${id}`] = null;
      actuallyDeleted.push(id);
    }

    await this.update(updateData, { pf1: { removeContained: actuallyDeleted } });
  }

  async updateContainerContents(data) {
    data = data instanceof Array ? data : [data];

    const embeddedName = "ContainerContent";
    const user = game.user;
    const options = { diff: true };

    const actuallyUpdated = [];
    const updateData = { system: { items: {} } };

    // Difference each update against existing data
    for (const changes of data) {
      if (!changes._id) throw new Error("You must provide an id for every Embedded Document in an update operation");

      const item = this.items.get(changes._id);

      let diff = {};
      try {
        diff = item.updateSource(changes, { dryRun: true, fallback: false });
      } catch (err) {
        console.error(err);
        continue;
      }

      // Run pre-update workflow
      let allowed = (await item._preUpdate(diff, options, user)) ?? true;
      allowed &&= options.noHook || Hooks.call(`preUpdate${embeddedName}`, item, diff, options, user.id);
      if (allowed === false) {
        console.debug(`${vtt} | ${embeddedName} update prevented during pre-update`);
        continue;
      }

      diff._stats = {
        coreVersion: game.version,
        systemVersion: game.system.version,
        modifiedTime: Date.now(),
        lastModifiedBy: user.id,
      };

      updateData.system.items[changes._id] = diff;
      actuallyUpdated.push(changes._id);
    }

    await this.update(updateData, { pf1: { updateContained: actuallyUpdated } });
  }

  /**
   * Returns the currency this item contains
   *
   * @param {object} [options] - Additional options affecting how the value is returned
   * @param {boolean} [options.inLowestDenomination=false] - Whether to return the value in copper, or in gold (default)
   * @returns {number} The total amount of currency this item contains, in gold pieces
   */
  getTotalCurrency({ inLowestDenomination = false } = {}) {
    const currency = this.system.currency || {};
    const total = (currency.pp || 0) * 1000 + (currency.gp || 0) * 100 + (currency.sp || 0) * 10 + (currency.cp || 0);
    return inLowestDenomination ? total : total / 100;
  }

  /**
   * Converts currencies to the given currency type
   *
   * @param {CoinType} type - Converts as much currency as possible to this type.
   * @returns {Promise<this>} The updated item
   */
  convertCurrency(type = "pp") {
    const cp = this.getTotalCurrency({ inLowestDenomination: true });

    const currency = pf1.utils.currency.convert(cp, type);

    return this.update({ system: { currency } });
  }

  /**
   * @returns {number} Weight of coins on the item.
   * @private
   */
  _calculateCoinWeight() {
    const divisor = game.settings.get("pf1", "coinWeight");
    if (!divisor) return 0;
    return Object.values(this.system.currency || {}).reduce((total, coins) => total + (coins || 0), 0) / divisor;
  }

  /** @inheritDoc */
  getValue({ recursive = false, inLowestDenomination = false, ...options } = {}) {
    if (options.single) recursive = false;
    const fullOptions = { recursive, inLowestDenomination, ...options };
    let result = super.getValue(fullOptions);

    if (!recursive) return result;

    // Add item's contained currencies at full value
    result += this.getTotalCurrency({ inLowestDenomination });

    // Add item's content items' values
    this.items.forEach((i) => {
      result += i.getValue(fullOptions);
    });

    return result;
  }

  /** @inheritDoc */
  async getChatData({ chatcard, rollData } = {}) {
    const context = await super.getChatData({ chatcard, rollData });
    // Get contents value
    const cpValue =
      this.getValue({ sellValue: 1, recursive: true, inLowestDenomination: true }) -
      this.getValue({ sellValue: 1, recursive: false, inLowestDenomination: true });
    const totalValue = pf1.utils.currency.split(cpValue);
    const value =
      game.i18n.localize("PF1.Containers.Contents.Value") + ": " + game.i18n.format("PF1.SplitValue", totalValue);
    context.properties.push(value);
    const currency = { ...this.system.currency };
    currency.gp ||= 0;
    currency.gp += currency.pp * 10;
    const coins = game.i18n.localize("PF1.Currency.Label") + ": " + game.i18n.format("PF1.SplitValue", currency);
    context.properties.push(coins);

    return context;
  }

  /**
   * @remarks This item type can not be recharged.
   * @override
   */
  recharge() {
    return;
  }

  /** @inheritDoc */
  adjustContained() {
    super.adjustContained();

    this.system.carried = true;
  }
}
