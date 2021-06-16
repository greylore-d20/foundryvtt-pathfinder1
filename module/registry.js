export class Registry {
  static _createDatabase(key) {
    if (!Object.hasOwnProperty.call(this, "database")) this.database = {};
    if (!Object.hasOwnProperty.call(this.database, key)) this.database[key] = [];
  }

  /**
   * Registers a value to a database.
   *
   * @param {string} databaseKey - The key of the database to register to.
   * @param {string} module - The module to register this value as. Should be equal to that of the 'name' field in the module's manifest. Used primarily for de-registering values.
   * @param {object} value - The value to register to the registry.
   * @returns {boolean} Whether successful.
   */
  static register(databaseKey, module, value) {
    this._createDatabase(databaseKey);

    this.database[databaseKey].push({ value, module });
    return true;
  }
  /**
   * De-registers something from a database.
   *
   * @param {string} databaseKey - The database key to de-register values from.
   * @param {string} module - The module for which to de-register stuff from.
   * @param {object} [value=null] - The specific value to de-register. Leave null to de-register all values of the given module from this database.
   */
  static unregister(databaseKey, module, value) {
    this._createDatabase(databaseKey);

    if (this.value == null) this.database[databaseKey] = this.database[databaseKey].filter((o) => o.module !== module);
    else {
      this.database[databaseKey] = this.database[databaseKey].filter((o) => {
        return !(o.value === value && o.module === module);
      });
    }
  }
  /**
   * @param {string} databaseKey - The key of the database to find results from.
   * @returns {object[]} All values associated with the database.
   */
  static getAll(databaseKey) {
    this._createDatabase(databaseKey);

    if (!Object.hasOwnProperty.call(this.database, databaseKey)) return [];
    return this.database[databaseKey].map((o) => o.value);
  }

  // Script calls
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
    if (this.getAll("itemScriptCategories").find((o) => o.key === key)) return false;
    return this.register("itemScriptCategories", module, { key, name, itemTypes, info });
  }
  static unregisterItemScriptCategory(module, key) {
    const dbKey = "itemScriptCategories";
    this._createDatabase(dbKey);

    if (key == null) this.database[dbKey] = this.database[dbKey].filter((o) => o.module !== module);
    else {
      this.database[dbKey] = this.database[dbKey].filter((o) => {
        return !(o.value.key === key && o.module === module);
      });
    }
  }
  static getItemScriptCategories() {
    return this.getAll("itemScriptCategories");
  }
}
