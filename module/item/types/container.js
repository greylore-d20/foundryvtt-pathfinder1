import { ItemPF } from "../entity.js";

export class ItemContainerPF extends ItemPF {
  async createContainerContent(data, options = { raw: false }) {
    const embeddedName = "Item";
    const user = game.user;
    const itemOptions = { temporary: false, renderSheet: false };

    let inventory = duplicate(getProperty(this.data, "data.inventoryItems") || []);
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
    const items = data.map((o) => (options.raw ? o : new ItemPF(o).data));
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

    await this.update({ "data.inventoryItems": inventory });
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
    const inventory = duplicate(getProperty(this.data, "data.inventoryItems") || []).filter((d) => {
      if (!ids.has(d._id)) return true;

      // Call pre-update hooks to ensure the update is allowed to proceed
      if (!options.noHook) {
        const allowed = Hooks.call(`preDelete${embeddedName}`, this, d, options, user.id);
        if (allowed === false) {
          console.debug(`${vtt} | ${embeddedName} update prevented by preUpdate hook`);
          return true;
        }
      }

      // Remove document from collection
      return false;
    }, []);

    // Trigger the Socket workflow
    await this.update({ "data.inventoryItems": inventory });
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
        update = diffObject(d.data, expandObject(update));
        if (isObjectEmpty(update)) return arr;
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
    let inventory = duplicate(this.data.data.inventoryItems).map((o) => {
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

    await this.update({ "data.inventoryItems": inventory });
  }

  /**
   * @param root0
   * @param root0.inLowestDenomination
   * @returns {number} The total amount of currency this item contains, in gold pieces
   */
  getTotalCurrency({ inLowestDenomination = false } = {}) {
    const currency = this.data.data.currency;
    const total = currency.pp * 1000 + currency.gp * 100 + currency.sp * 10 + currency.cp;
    return inLowestDenomination ? total : total / 100;
  }

  getValue({ recursive = true, sellValue = 0.5, inLowestDenomination = false, forceUnidentified = false } = {}) {
    let result = super.getValue(...arguments);

    if (!recursive) return result;

    // Add item's content items' values
    this.items.forEach((i) => {
      result += i.getValue({ recursive: recursive, sellValue: sellValue, inLowestDenomination });
    });

    return result;
  }
}
