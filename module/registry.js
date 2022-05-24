export class Registry {
  static _createDatabase(key) {
    if (!Object.hasOwnProperty.call(this, "database")) this.database = {};
    if (!Object.hasOwnProperty.call(this.database, key)) this.database[key] = new Collection();
    return this.database[key];
  }

  /**
   * Registers a value to a database.
   *
   * @param {string} databaseKey - The key of the database to register to.
   * @param {string} module - The module to register this value as. Should be equal to that of the 'name' field in the module's manifest. Used primarily for de-registering values.
   * @param {string} key - The unique key of this item within the database.
   * @param {object} value - The value to register to the registry.
   * @returns {boolean} Whether successful.
   */
  static register(databaseKey, module, key, value) {
    const db = this._createDatabase(databaseKey);
    if (db.has(key)) return false;
    db.set(key, { value, module });
    return true;
  }
  /**
   * De-registers something from a database.
   *
   * @param {string} databaseKey - The database key to de-register values from.
   * @param {string} module - The module for which to de-register stuff from.
   * @param {object} [key=null] - The key of the item to de-register. Leave null to de-register all values of the given module from this database.
   */
  static unregister(databaseKey, module, key) {
    const db = this._createDatabase(databaseKey);

    if (this.value == null) {
      db.entries.forEach((o) => {
        const [k, v] = o;
        if (v.module === module) db.unset(k);
      });
    } else {
      this.database.unset(key);
    }
  }
  /**
   * @param {string} databaseKey - The key of the database to find results from.
   * @returns {object[]} All values associated with the database.
   */
  static getAll(databaseKey) {
    const db = this._createDatabase(databaseKey);

    const result = [];
    for (const v of db.values()) {
      result.push(v.value);
    }
    return result;
  }

  // ----------------------------------- //
  // Script calls                        //
  // ----------------------------------- //
  /**
   * Registers a category for item script calls.
   *
   * @param {string} module - The module to register this value as. Should be equal to that of the 'name' field in the module's manifest. Used primarily for de-registering values.
   * @param {string} key - The unique key of the category.
   * @param {string} name - The name of the category. Can be something usable with `game.i18n.localize`.
   * @param {string[]} itemTypes - The item types to add this category to. Something like `["equipment", "buffs"]`.
   * @param {string} [info=null] - The information of the category. Can be something usable with `game.i18n.localize`.
   * @returns {boolean} Whether successful.
   */
  static registerItemScriptCategory(module, key, name, itemTypes, info) {
    this._createDatabase("itemScriptCategories");
    return this.register("itemScriptCategories", module, key, { key, name, itemTypes, info });
  }
  static unregisterItemScriptCategory(module, key) {
    return this.unregister("itemScriptCategories", module, key);
  }
  static getItemScriptCategories() {
    return this.getAll("itemScriptCategories");
  }

  // ----------------------------------- //
  // Damage types                        //
  // ----------------------------------- //
  /**
   * Registers a category for item script calls.
   *
   * @param {string} module - The module to register this value as. Should be equal to that of the 'name' field in the module's manifest. Used primarily for de-registering values.
   * @param {string} key - The unique key of the damage type.
   * @param {DamageType} damageType - The damage type to add. Use an instance of `game.pf1.documentComponents.DamageType`.
   * @returns {boolean} Whether successful.
   */
  static registerDamageType(module, damageType) {
    if (!(damageType instanceof game.pf1.documentComponents.DamageType)) return false;
    this._createDatabase("damageTypes");
    return this.register("damageTypes", module, damageType.id, damageType);
  }
  static unregisterDamageType(module, key) {
    return this.unregister("damageTypes", module, key);
  }
  static getDamageTypes() {
    return this.getAll("damageTypes");
  }

  // ----------------------------------- //
  // Materials                           //
  // ----------------------------------- //
  /**
   * Registers a category for item script calls.
   *
   * @param {string} module - The module to register this value as. Should be equal to that of the 'name' field in the module's manifest. Used primarily for de-registering values.
   * @param {string} key - The unique key of the damage type.
   * @param {ItemMaterial} material - The material to add. Use an instance of `game.pf1.documentComponents.ItemMaterial`.
   * @returns {boolean} Whether successful.
   */
  static registerMaterial(module, material) {
    if (!(material instanceof game.pf1.documentComponents.ItemMaterial)) return false;
    this._createDatabase("materials");
    return this.register("materials", module, material.id, material);
  }
  static unregisterMaterial(module, key) {
    return this.unregister("materials", module, key);
  }
  static getMaterials() {
    return this.getAll("materials");
  }
}
