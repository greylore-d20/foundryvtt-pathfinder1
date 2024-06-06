export class ItemBasePF extends Item {
  /**
   * Item create dialog.
   *
   * @override
   * @param {object} data Initial form data
   * @param {object} [context] Additional options.
   * @param {Actor|null} [context.parent=null] Parent parameter passed to Item.create() options
   * @param {string|null} [context.pack=null] Pack ID parameter passed to Item.create() options
   * @param {object} [context.options] Dialog context options.
   * @returns {Promise<Item|null>}
   *
   * Synchronized with Foundry VTT v11.315
   */
  static async createDialog(data = {}, { parent = null, pack = null, ...options } = {}) {
    return pf1.applications.item.CreateDialog.waitPrompt(data, { parent, pack, options });
  }

  static async createDocuments(data = [], context = {}) {
    const origContext = foundry.utils.deepClone(context);
    const inActor = context.parent instanceof Actor;

    let supplements;
    if (inActor) {
      supplements = await this._collectItemSupplements(data, context);
    }

    const created = await super.createDocuments(data, context);

    if (supplements?.size) {
      await this._addSupplementChildLinks(created, supplements, origContext);
    }

    return created;
  }

  /**
   * @internal
   * @param {Array<object>} items - Array of item data
   * @param {object} context
   * @returns {Map<string, *>}
   */
  static async _collectItemSupplements(items, context) {
    const allSupplements = new Collection();

    const depth = 0;
    const unnotified = 0;

    const collect = async (item, { depth = 0 } = {}) => {
      const supplements = item.system.links?.supplements ?? [];
      const classLink = item.system.class;
      // Log larger fetches.
      // Fails if there's multiple small fetches
      if (supplements.length > 5) console.log("Fetching", supplements.length, "supplements for", item.name);
      // Collect supplements
      const newItems = [];
      for (const supplement of supplements) {
        const { uuid } = supplement;
        if (!uuid) continue; // Erroneous supplement data
        const extraItem = await fromUuid(uuid);
        if (!extraItem) {
          // TODO: Display notification instead when this is from UI interaction.
          console.warn("Supplement", uuid, "not found for", item.uuid ?? item.flags?.core?.sourceId ?? item);
          continue;
        }
        const old = allSupplements.get(uuid);
        if (old) old.count += 1;
        else {
          allSupplements.set(uuid, { parent: item, item: extraItem, count: 1, classLink });
          newItems.push(extraItem);
        }
      }

      // TODO: Make the limits here configurable?
      if (newItems.length) {
        if (depth > 3) {
          return void console.warn("Stopping collecting supplements deeper than 3 layers");
        }
        if (allSupplements.size > 100 && newItems.length) {
          return void console.warn(`Too many supplements (${allSupplements.size}), stopping collecting more`);
        }

        for (const newItem of newItems) {
          // TODO: Somehow add child relation to the children
          await collect(newItem, { depth: depth + 1 });
        }
      }
    };

    // Collect supplements for all items
    for (const item of items) await collect(item);

    if (allSupplements.size) {
      // Add to items array
      for (const supplement of allSupplements) {
        const { item, count, parent } = supplement;
        const parentUuid = parent?.uuid ?? parent?.flags?.core?.sourceId;
        const itemData = game.items.fromCompendium(item, { clearFolder: true });
        if (parentUuid) {
          setProperty(itemData, "flags.pf1.source", parentUuid);
        }
        // Adjust quantity of physical items if more than one was added of the same item
        if (item.isPhysical && itemData.system.quantity > 0) {
          itemData.system.quantity *= count;
        }
        // Inherit class link
        if (supplement.classLink && item.type === "feat" && item.system.subType === "classFeat") {
          itemData.system.class = supplement.classLink;
        }
        items.push(itemData);
      }
    }

    return allSupplements;
  }

  /**
   * Update item child links with supplements.
   *
   * @internal
   * @param {Array<Item>} items
   * @param context
   * @param {Map<string,object>} supplements
   */
  static async _addSupplementChildLinks(items, supplements, context) {
    const updates = new Collection();
    const collection = new Collection();
    for (const item of items) {
      const source = item.getFlag("core", "sourceId");
      if (source) collection.set(source, item);
    }

    for (const item of items) {
      const source = item.getFlag("pf1", "source");
      if (source) {
        const parent = collection.get(source);
        let update = updates.get(parent.id);
        if (!update) {
          update = { system: { links: { children: [] } } };
          update._id = parent.id;
          updates.set(parent.id, update);
        }

        update.system.links.children.push({ uuid: item.getRelativeUUID(this) });
      }
    }

    if (updates.size) {
      return this.updateDocuments(Array.from(updates), context);
    }
  }

  /**
   * Fetch item name
   *
   * @param {boolean} [forcePlayerPerspective=false] - If true, return value players see.
   * @returns {string}
   */
  getName(forcePlayerPerspective = false) {
    return this.name;
  }

  /**
   * Is the item is fully functional.
   *
   * This returns composite result of if the item is equipped, has quantity, is not disabled, is not out of charges, etc.
   * and is not representative if the item can be set active or not via {@link setActive}.
   *
   * @see {@link activeState}
   *
   * @abstract
   * @type {boolean}
   */
  get isActive() {
    return true;
  }

  /**
   * If the item can be activated via {@link setActive}.
   *
   * {@link isActive} can return variable state independent of the toggle that {@link setActive} controls, this returns .
   *
   * @abstract
   * @type {boolean}
   */
  get activeState() {
    return this.isActive;
  }

  /**
   * Set item's active state.
   *
   * @abstract
   * @param {boolean} active - Active state
   * @param {object} [context] - Optional update context
   * @returns {Promise<this>} - Update promise if item type supports the operation.
   * @throws {Error} - If item does not support the operation.
   */
  async setActive(active, context) {
    throw new Error(`Item type ${this.type} does not support ItemBasePF#setActive`);
  }

  /**
   * Is this item usable at base level, disregarding per-action details.
   *
   * @abstract
   * @type {boolean}
   */
  get canUse() {
    return this.isActive;
  }
}
