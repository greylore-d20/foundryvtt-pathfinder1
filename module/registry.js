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
    for (const v of db.contents) {
      result.push(v.value);
    }
    return result;
  }

  /**
   * Gets all raw registry data, to be used in e.g. Application.getData.
   */
  static getRawData() {
    const result = {};

    Object.entries(this.database).forEach((entries) => {
      const [databaseKey, database] = entries;
      result[databaseKey] = database.contents.reduce((cur, o) => {
        cur[o.value.id] = deepClone(o.value.data);
        return cur;
      }, {});
    });

    return result;
  }

  // ----------------------------------- //
  // Script calls                        //
  // ----------------------------------- //
  /**
   * Registers a category for item script calls.
   *
   * @param {string} module - The module to register this value as. Should be equal to that of the 'name' field in the module's manifest. Used primarily for de-registering values.
   * @param {RegistryScriptCall} scriptCall - A script call to add. Use an instance of `game.pf1.registryTypes.ScriptCall`.
   * @returns {boolean} Whether successful.
   */
  static registerItemScriptCategory(module, scriptCall) {
    this._createDatabase("itemScriptCategories");
    return this.register("itemScriptCategories", module, scriptCall.id, scriptCall);
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
   * @param {DamageType} damageType - The damage type to add. Use an instance of `game.pf1.registryTypes.DamageType`.
   * @returns {boolean} Whether successful.
   */
  static registerDamageType(module, damageType) {
    if (!(damageType instanceof game.pf1.registryTypes.DamageType)) return false;
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
   * @param {ItemMaterial} material - The material to add. Use an instance of `game.pf1.registryTypes.ItemMaterial`.
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
