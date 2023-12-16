import { ItemPhysicalPF } from "./item-physical.mjs";
import { diffObjectAndArray } from "@utils";

export class ItemContainerPF extends ItemPhysicalPF {
  /**
   * @override
   */
  static system = Object.freeze({
    ...super.system,
    hasIdentifier: false,
  });

  constructor(...args) {
    super(...args);

    this.items ??= null;
  }

  /**
   * @override
   * @param {object} changed
   * @param {object} options
   * @param {User} user
   */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);

    // No system updates
    if (!changed.system) return;

    // Ensure contained item updates adhere to reason
    const items = changed.system.items;
    if (items) {
      for (const [itemId, itemData] of Object.entries(items)) {
        if (itemId.startsWith("-=")) continue; // No validation for deletions
        const oldItem = this.items.get(itemId);
        let diff;
        if (oldItem) {
          diff = oldItem.updateSource(itemData, { dryRun: true, fallback: false });
          // Remove lingering .data if present, the above line prunes this out if done externally
          if ("data" in this.system.items[itemId]) diff["-=data"] = null;
        } else diff = new Item.implementation(itemData).toObject();

        items[itemId] = diff;
      }
    }
  }

  /**
   * @override
   * @param {object} context
   * @param {User} user
   */
  async _preDelete(context, user) {
    if (user.isSelf) {
      if (this.system.quantity > 0) {
        this.executeScriptCalls("changeQuantity", { quantity: { previous: this.system.quantity, new: 0 } });
      }
    }

    await super._preDelete(context, user);
  }

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

  /** @inheritdoc */
  prepareBaseData() {
    super.prepareBaseData();

    // Set base weight to weight of coins, which can be calculated without knowing contained items
    const weightReduction = (100 - (this.system.weight?.reduction?.percent ?? 0)) / 100;
    this.system.weight.currency = this._calculateCoinWeight() * weightReduction;
  }

  prepareDerivedData() {
    this._prepareInventory();

    super.prepareDerivedData();
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
          item.updateSource(itemData, { recursive: false });
          item.reset();
        } else {
          item = new Item.implementation(itemData, { parent: this.actor });
          item.parentItem = this;
        }
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
    /** @type {ItemWeightData} */
    const weight = this.system.weight;

    // Percentile weight reduction
    const reductionPCt = (100 - (weight.reduction?.percent ?? 0)) / 100;

    const currencyWeight = this._calculateCoinWeight();
    weight.currency = currencyWeight * reductionPCt;

    // Total unreduced weight of contents
    weight.contents = this.items.reduce((total, item) => total + item.system.weight.total, 0);
    weight.contents += currencyWeight;

    const reductionFlat = weight.reduction?.value ?? 0;
    weight.total += Math.max(0, weight.contents * reductionPCt - reductionFlat);

    weight.converted.reduction = pf1.utils.convertWeight(reductionFlat);
    weight.converted.contents = pf1.utils.convertWeight(weight.contents);
    weight.converted.currency = pf1.utils.convertWeight(weight.currency);

    super.prepareWeight();
  }

  getContainerContent(itemId) {
    return this.items.get(itemId);
  }

  /**
   * @protected
   * @param {object[]} data Item creation data
   * @param {object} [options={}] Additional options
   * @returns {Promise<this>} Promise to the updated document.
   */
  async createContainerContent(data, options = { raw: false, renderSheet: false }) {
    data = data instanceof Array ? data : [data];

    const itemOptions = { temporary: false, renderSheet: false };
    const user = game.user;

    const actuallyCreated = [];
    const updateData = { system: { items: {} } };

    // Iterate over data to create
    for (const itemData of data) {
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

      updateData.system.items[itemData._id] = options.raw ? itemData : item.toObject();
      actuallyCreated.push(itemData._id);
    }

    await this.update(updateData, { pf1: { createContained: actuallyCreated } });

    // Mimic createEmbeddedDocuments()
    const created = this.items.filter((i) => actuallyCreated.includes(i.id));
    if (options.renderSheet) created.forEach((i) => i.sheet.render(true));
    return created;
  }

  async deleteContainerContent(data) {
    const ids = new Set(data instanceof Array ? data : [data]);

    const embeddedName = "ContainerContent";
    const user = game.user;
    const options = { noHook: false };

    const updateData = { system: { items: {} } };

    const items = this.system.items ?? {};

    const actuallyDeleted = [];

    // Iterate over data to delete
    for (const id of ids) {
      const item = this.items.get(id);

      // Run pre-delete workflow
      let allowed = (await item._preDelete(options, user)) ?? true;
      allowed &&= options.noHook || Hooks.call(`preDelete${embeddedName}`, item, options, user.id);
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
        console.log(err);
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
    const currency = this.system.currency;
    const total = currency.pp * 1000 + currency.gp * 100 + currency.sp * 10 + currency.cp;
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

  /** @inheritdoc */
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

  /**
   * @remarks This item type can not be recharged.
   * @override
   */
  recharge() {
    return;
  }

  adjustContained() {
    super.adjustContained();

    this.system.carried = true;
  }
}
