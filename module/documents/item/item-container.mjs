import { ItemPF } from "./item-pf.mjs";

export class ItemContainerPF extends ItemPF {
  /**
   * @inheritDoc
   * @internal
   */
  static system = Object.freeze(foundry.utils.mergeObject(super.system, { isPhysical: true }, { inplace: false }));

  async _preDelete(options, user) {
    if (user.id === game.user.id) {
      if (this.system.quantity > 0) {
        this.executeScriptCalls("changeQuantity", { quantity: { previous: this.system.quantity, new: 0 } });
      }
    }

    return super._preDelete(options, user);
  }

  /** @inheritdoc */
  prepareBaseData() {
    super.prepareBaseData();

    // HACK: Migration shim
    if (typeof this.system.weight !== "object") {
      this.system.weight = {
        value: this.system.weight,
      };
    }

    // Set base weight to weight of coins, which can be calculated without knowing contained items
    const weightReduction = (100 - (this.system.weightReduction ?? 0)) / 100;
    this.system.weight.currency = this._calculateCoinWeight() * weightReduction;
  }

  /** @inheritDoc */
  prepareWeight() {
    super.prepareWeight();

    /** @type {ItemWeightData} */
    const weight = this.system.weight;
    // Quantity can be ignored for containers
    weight.contents = this.items.reduce((total, item) => total + item.system.weight.total, this._calculateCoinWeight());
    weight.converted.contents = pf1.utils.convertWeight(weight.contents);
  }

  async createContainerContent(data, options = { raw: false }) {
    const embeddedName = "Item";
    const user = game.user;
    const itemOptions = { temporary: false, renderSheet: false };

    let inventory = deepClone(this.system.inventoryItems ?? []);
    // Iterate over data to create
    data = data instanceof Array ? data : [data];
    if (!(itemOptions.temporary || itemOptions.noHook)) {
      for (const d of data) {
        const allowed = Hooks.call(`preCreate${embeddedName}`, this, d, itemOptions, user.id);
        if (allowed === false) {
          console.debug(`${vtt} | ${embeddedName} creation prevented by preCreate hook`);
          return null;
        }

        d._id = randomID(16);
      }
    }

    // Add to updates
    const items = data.map((o) => (options.raw ? o : new ItemPF(o).toObject()));
    inventory.push(...items);

    // Filter items with duplicate _id
    {
      const ids = [];
      inventory = inventory.filter((i) => {
        if (ids.includes(i._id)) return false;
        ids.push(i._id);
        return true;
      });
    }

    await this.update({ "system.inventoryItems": inventory });
  }

  getContainerContent(itemId) {
    return this.items.get(itemId);
  }

  async deleteContainerContent(data) {
    const embeddedName = "ContainerContent";
    const user = game.user;
    const options = { noHook: false };

    // Iterate over data to create
    data = data instanceof Array ? data : [data];
    const ids = new Set(data);

    // Iterate over elements of the collection
    const inventory = deepClone(this.system.inventoryItems ?? []).filter((item) => {
      if (!ids.has(item._id)) return true;

      // Call pre-update hooks to ensure the update is allowed to proceed
      if (!options.noHook) {
        const allowed = Hooks.call(`preDelete${embeddedName}`, this, item, options, user.id);
        if (allowed === false) {
          console.debug(`${vtt} | ${embeddedName} update prevented by preUpdate hook`);
          return true;
        }
      }

      // Remove document from collection
      return false;
    }, []);

    // Trigger the Socket workflow
    await this.update({ "system.inventoryItems": inventory });
  }

  async updateContainerContents(data) {
    const embeddedName = "ContainerContent";
    const user = game.user;
    const options = { diff: true };

    // Structure the update data
    const pending = new Map();
    data = data instanceof Array ? data : [data];
    for (const d of data) {
      if (!d._id) throw new Error("You must provide an id for every Embedded Document in an update operation");
      pending.set(d._id, d);
    }

    // Difference each update against existing data
    const updates = this.items.reduce((arr, d) => {
      if (!pending.has(d.id)) return arr;
      let update = pending.get(d.id);

      // Diff the update against current data
      if (options.diff) {
        update = diffObject(d, expandObject(update));
        if (foundry.utils.isEmpty(update)) return arr;
        update["_id"] = d.id;
      }

      // Call pre-update hooks to ensure the update is allowed to proceed
      if (!options.noHook) {
        const allowed = Hooks.call(`preUpdate${embeddedName}`, this, d, update, options, user.id);
        if (allowed === false) {
          console.debug(`${vtt} | ${embeddedName} update prevented by preUpdate hook`);
          return arr;
        }
      }

      // Stage the update
      arr.push(update);
      return arr;
    }, []);
    if (!updates.length) return [];
    let inventory = duplicate(this.system.inventoryItems).map((o) => {
      for (const u of updates) {
        if (u._id === o._id) return mergeObject(o, u);
      }
      return o;
    });

    // Filter items with duplicate _id
    {
      const ids = [];
      inventory = inventory.filter((i) => {
        if (ids.includes(i._id)) return false;
        ids.push(i._id);
        return true;
      });
    }

    await this.update({ "system.inventoryItems": inventory });
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
   * Converts currencies of the given category to the given currency type
   *
   * @param {string} type - Either 'pp', 'gp', 'sp' or 'cp'. Converts as much currency as possible to this type.
   */
  convertCurrency(type = "pp") {
    const totalValue = this.getTotalCurrency();
    const values = [0, 0, 0, 0];
    switch (type) {
      case "pp":
        values[0] = Math.floor(totalValue / 10);
        values[1] = Math.max(0, Math.floor(totalValue) - values[0] * 10);
        values[2] = Math.max(0, Math.floor(totalValue * 10) - values[0] * 100 - values[1] * 10);
        values[3] = Math.max(0, Math.floor(totalValue * 100) - values[0] * 1000 - values[1] * 100 - values[2] * 10);
        break;
      case "gp":
        values[1] = Math.floor(totalValue);
        values[2] = Math.max(0, Math.floor(totalValue * 10) - values[1] * 10);
        values[3] = Math.max(0, Math.floor(totalValue * 100) - values[1] * 100 - values[2] * 10);
        break;
      case "sp":
        values[2] = Math.floor(totalValue * 10);
        values[3] = Math.max(0, Math.floor(totalValue * 100) - values[2] * 10);
        break;
      case "cp":
        values[3] = Math.floor(totalValue * 100);
        break;
    }

    const updateData = {};
    updateData[`system.currency.pp`] = values[0];
    updateData[`system.currency.gp`] = values[1];
    updateData[`system.currency.sp`] = values[2];
    updateData[`system.currency.cp`] = values[3];
    return this.update(updateData);
  }

  /**
   * @returns {number} Weight of coins on the item.
   * @private
   */
  _calculateCoinWeight() {
    const coinWeightDivisor = game.settings.get("pf1", "coinWeight");
    if (!coinWeightDivisor) return 0;
    return (
      Object.values(this.system.currency || {}).reduce((cur, amount) => {
        return cur + amount;
      }, 0) / coinWeightDivisor
    );
  }

  /** @inheritdoc */
  getValue({ recursive = true, sellValue = 0.5, inLowestDenomination = false, forceUnidentified = false } = {}) {
    let result = super.getValue(...arguments);

    // Add item's contained currencies at full value
    result += this.getTotalCurrency({ inLowestDenomination });

    if (!recursive) return result;

    // Add item's content items' values
    this.items.forEach((i) => {
      result += i.getValue({ recursive: recursive, sellValue: sellValue, inLowestDenomination });
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
}
