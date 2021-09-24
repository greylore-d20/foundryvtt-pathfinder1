import { uniqueName } from "../lib.js";

/**
 * A string identifying the type of list on the world configuration we are talking about.
 *
 * @typedef {("damageType"|"material"|"damageReduction")} WorldConfig.ListType
 */

export class WorldConfig extends FormApplication {
  constructor(object, options) {
    if (!object) object = duplicate(WorldConfig.settings);
    super(mergeObject(WorldConfig.defaultSettings, object ?? {}, { inplace: false }), options);
  }

  static get defaultDamageTypeData() {
    return {
      id: randomID(16),
      name: game.i18n.localize("PF1.WorldConfig.DamageType.NewName"),
      img: "icons/svg/sword.svg",
    };
  }

  static get defaultMaterialData() {
    return {
      id: randomID(16),
      name: game.i18n.localize("PF1.WorldConfig.Material.NewName"),
      img: "icons/svg/coins.svg",
      hardness: 10,
      hpPer: 30,
      bypassesDR: [],
    };
  }

  static get defaultDRData() {
    return {
      id: randomID(16),
      name: game.i18n.localize("PF1.WorldConfig.DR.NewName"),
      showAs: "",
      img: "icons/svg/statue.svg",
    };
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("PF1.WorldConfig.Name"),
      id: "world-config",
      template: "systems/pf1/templates/settings/world-config.hbs",
      width: 640,
      height: 720,
      resizable: true,
      scrollY: ["ul.items"],
      tabs: [{ navSelector: "nav.tabs", contentSelector: "section.tabs", initial: "damageType" }],
    });
  }

  static get defaultSettings() {
    return {
      damageTypes: [
        {
          id: randomID(16),
          name: "Untyped",
          img: "icons/skills/wounds/injury-body-pain-gray.webp",
        },
        {
          id: randomID(16),
          name: "Slashing",
          img: "icons/weapons/axes/axe-battle-black.webp",
        },
        {
          id: randomID(16),
          name: "Piercing",
          img: "icons/weapons/polearms/spear-flared-blue.webp",
        },
        {
          id: randomID(16),
          name: "Bludgeoning",
          img: "icons/weapons/hammers/hammer-double-steel-embossed.webp",
        },
        {
          id: randomID(16),
          name: "Fire",
          img: "icons/magic/fire/blast-jet-stream-splash.webp",
        },
        {
          id: randomID(16),
          name: "Cold",
          img: "icons/magic/water/barrier-ice-crystal-wall-faceted.webp",
        },
        {
          id: randomID(16),
          name: "Electricity",
          img: "icons/magic/lightning/bolt-blue.webp",
        },
        {
          id: randomID(16),
          name: "Acid",
          img: "icons/magic/acid/dissolve-pool-bubbles.webp",
        },
        {
          id: randomID(16),
          name: "Sonic",
          img: "icons/magic/sonic/explosion-shock-wave-teal.webp",
        },
        {
          id: randomID(16),
          name: "Force",
          img: "icons/magic/lightning/orb-ball-purple.webp",
        },
        {
          id: randomID(16),
          name: "Positive Energy",
          img: "icons/magic/light/beam-strike-orange-gold.webp",
        },
        {
          id: randomID(16),
          name: "Negative Energy",
          img: "icons/magic/unholy/orb-rays-blue.webp",
        },
      ],
      materials: [
        {
          id: randomID(16),
          name: "Steel",
          img: "icons/commodities/metal/ingot-plain-steel.webp",
          hardness: 10,
          hpPer: 30,
          bypassesDR: [],
        },
        {
          id: randomID(16),
          name: "Cold Iron",
          img: "icons/commodities/metal/ingot-worn-steel.webp",
          hardness: 10,
          hpPer: 30,
          bypassesDR: ["cold-iron"],
        },
        {
          id: randomID(16),
          name: "Alchemical Silver",
          img: "icons/commodities/metal/ingot-engraved-silver.webp",
          hardness: 8,
          hpPer: 10,
          bypassesDR: ["silver"],
        },
        {
          id: randomID(16),
          name: "Mithral",
          img: "icons/commodities/metal/ingot-stamped-silver.webp",
          hardness: 15,
          hpPer: 30,
          bypassesDR: ["silver"],
        },
        {
          id: randomID(16),
          name: "Adamantine",
          img: "icons/commodities/metal/ingot-stamped-purple.webp",
          hardness: 20,
          hpPer: 40,
          bypassesDR: ["adamantine"],
        },
        {
          id: randomID(16),
          name: "Glass",
          img: "icons/tools/laboratory/alembic-glass-ball-blue.webp",
          hardness: 1,
          hpPer: 1,
          bypassesDR: [],
        },
        {
          id: randomID(16),
          name: "Paper",
          img: "icons/sundries/documents/paper-plain-white.webp",
          hardness: 0,
          hpPer: 2,
          bypassesDR: [],
        },
        {
          id: randomID(16),
          name: "Cloth",
          img: "icons/commodities/cloth/cloth-bolt-yellow.webp",
          hardness: 0,
          hpPer: 2,
          bypassesDR: [],
        },
        {
          id: randomID(16),
          name: "Ice",
          img: "icons/magic/water/barrier-ice-crystal-wall-faceted.webp",
          hardness: 0,
          hpPer: 3,
          bypassesDR: [],
        },
        {
          id: randomID(16),
          name: "Leather",
          img: "icons/commodities/leather/leather-bolt-tan.webp",
          hardness: 2,
          hpPer: 5,
          bypassesDR: [],
        },
        {
          id: randomID(16),
          name: "Wood",
          img: "icons/commodities/wood/lumber-stack.webp",
          hardness: 5,
          hpPer: 10,
          bypassesDR: [],
        },
        {
          id: randomID(16),
          name: "Stone",
          img: "icons/commodities/stone/ore-chunk-grey.webp",
          hardness: 8,
          hpPer: 15,
          bypassesDR: [],
        },
      ],
      dr: [
        {
          id: randomID(16),
          name: "Untyped",
          showAs: "-",
          img: "icons/skills/wounds/injury-body-pain-gray.webp",
        },
        {
          id: randomID(16),
          name: "Slashing",
          showAs: "",
          img: "icons/weapons/axes/axe-battle-black.webp",
        },
        {
          id: randomID(16),
          name: "Piercing",
          showAs: "",
          img: "icons/weapons/polearms/spear-flared-blue.webp",
        },
        {
          id: randomID(16),
          name: "Bludgeoning",
          showAs: "",
          img: "icons/weapons/hammers/hammer-double-steel-embossed.webp",
        },
        {
          id: randomID(16),
          name: "Magic",
          showAs: "",
          img: "icons/magic/lightning/orb-ball-purple.webp",
        },
        {
          id: randomID(16),
          name: "Cold Iron",
          showAs: "",
          img: "icons/commodities/metal/ingot-worn-steel.webp",
        },
        {
          id: randomID(16),
          name: "Silver",
          showAs: "",
          img: "icons/commodities/metal/ingot-engraved-silver.webp",
        },
        {
          id: randomID(16),
          name: "Adamantine",
          showAs: "",
          img: "icons/commodities/metal/ingot-stamped-purple.webp",
        },
        {
          id: randomID(16),
          name: "Good",
          showAs: "",
          img: "icons/magic/holy/angel-winged-humanoid-blue.webp",
        },
        {
          id: randomID(16),
          name: "Evil",
          showAs: "",
          img: "icons/magic/unholy/hand-claw-glow-orange.webp",
        },
        {
          id: randomID(16),
          name: "Lawful",
          showAs: "",
          img: "icons/magic/symbols/cog-shield-white-blue.webp",
        },
        {
          id: randomID(16),
          name: "Chaotic",
          showAs: "",
          img: "icons/magic/fire/projectile-fireball-purple.webp",
        },
        {
          id: randomID(16),
          name: "Epic",
          showAs: "",
          img: "icons/magic/movement/trail-streak-pink.webp",
        },
      ],
    };
  }

  static get settings() {
    return game.settings.get("pf1", "worldConfig");
  }

  /**
   * @typedef {Object} NameUpdateData
   * @property {string} name - The object's `name` property to find it by.
   * @property {Object} data - The update data for the object.
   */
  /**
   * Changes list data
   *
   * @param {WorldConfig.ListType} type - The type of list to change objects for.
   * @param {NameUpdateData[]} updateData - The changes to push. An array containing an object for each slot.
   * @returns {Promise.<Object>} A promise returning the new settings object.
   */
  static async updateListData(type, updateData) {
    const settings = duplicate(this.settings);

    const { listKey } = this.getListVariables(type);
    const hookArgs = [];

    // Alter slot data
    let hasChanges = false;
    for (const item of settings[listKey]) {
      const pair = updateData.find((o) => o.name === item.name);
      if (pair) {
        mergeObject(item, pair.data);
        hasChanges = true;
        updateData.splice(updateData.indexOf(pair), 1);
        hookArgs.push([item, pair]);
      }
    }

    // Apply results
    if (hasChanges) {
      await game.settings.set("pf1", "worldConfig", settings);
      for (let args of hookArgs) {
        Hooks.callAll(`pf1.worldData.update.${type}`, ...args);
      }
    }
    return settings;
  }

  /**
   * @typedef {Object} WorldConfig.ListVariables
   * @property {Object[]} list - The list in question.
   * @property {string} listKey - The key of the list object on the settings object.
   * @property {Object} defaultData - The default data of objects associated with the list.
   * @property {string[]} itemIDs - All the IDs of the items within the list.
   */
  /**
   * Returns some variables about one of the world configuration's lists.
   *
   * @param {WorldConfig.ListType} type - The type of list to get variables from.
   * @param {Object} [settings] - The optional settings object to provide, in case you need e.g. a duplicate to work with.
   * @returns {WorldConfig.ListVariables|null} The list's variables.
   */
  static getListVariables(type, settings = null) {
    if (!settings) settings = this.settings;

    let listKey, defaultData;
    switch (type) {
      case "damageType":
        listKey = "damageTypes";
        defaultData = this.defaultDamageTypeData;
        break;
      case "material":
        listKey = "materials";
        defaultData = this.defaultMaterialData;
        break;
      case "dr":
        listKey = "dr";
        defaultData = this.defaultDRData;
        break;
    }
    const list = settings[listKey];

    if (!list || !defaultData) return null;

    const itemIDs = list.map((o) => o.id);

    return { list, listKey, defaultData, itemIDs };
  }

  /**
   * Finds an object from a list within the world data.
   *
   * @param {WorldConfig.ListType} type - The type of list to find an object in.
   * @param {string} id - The ID of the object to find.
   * @returns {Object} The data object, if found.
   */
  static getListObject(type, id) {
    const { list } = this.getListVariables(type);

    return list.find((o) => o.id === id);
  }

  /**
   * Adds an object to one of the world configuration's lists.
   *
   * @param {WorldConfig.ListType} type - The list to append an item to.
   * @param {Object} [data = {}] - The data to merge with the new object.
   * @returns {Object} The new world settings data object.
   */
  static async addListObject(type, data = {}) {
    const settings = duplicate(this.settings);
    const { list, defaultData } = this.getListVariables(type, settings);

    const keys = list.reduce((cur, o) => {
      cur.push(o.id);
      return cur;
    }, []);

    const newData = mergeObject(defaultData, data);
    newData.name = uniqueName(keys, newData.name);

    list.push(newData);
    await game.settings.set("pf1", "worldConfig", settings);
    Hooks.callAll(`pf1.worldData.create.${type}`, newData);
    return settings;
  }

  /**
   * Removes an object from one of the world configuration's lists.
   *
   * @param {WorldConfig.ListType} type - The type of list to remove from.
   * @param {string} id - The id of the item to remove.
   * @returns {Object} The new world settings data object.
   */
  static async removeListObject(type, id) {
    const settings = duplicate(this.settings);
    const { list, listKey } = this.getListVariables(type, settings);
    const obj = list.find((o) => o.id === id);
    if (!obj) return settings;

    settings[listKey].splice(settings[listKey].indexOf(obj), 1);
    await game.settings.set("pf1", "worldConfig", settings);
    Hooks.callAll(`pf1.worldData.delete.${type}`, obj);
    return settings;
  }

  /**
   * Moves a list object within its list, reordering it.
   *
   * @param {WorldConfig.ListType} type - The type of list to move an object in.
   * @param {string} from - The id of the item to move around.
   * @param {string} to - The id of the item to move just above of (if earlier) of just below (if later).
   * @returns {Object} The new world settings data object.
   */
  static async moveListObject(type, from, to) {
    const settings = duplicate(this.settings);
    const { list } = this.getListVariables(type, settings);

    if (from === to) return settings;

    const fromObj = list.find((o) => o.id === from);
    const toObj = list.find((o) => o.id === to);
    const fromIdx = list.indexOf(fromObj);
    const toIdx = list.indexOf(toObj);

    const hasBothIndexes = fromIdx >= 0 && toIdx >= 0;
    if (!hasBothIndexes) return settings;

    list.splice(fromIdx, 1);
    list.splice(toIdx, 0, fromObj);

    await game.settings.set("pf1", "worldConfig", settings);
    return settings;
  }

  async getData() {
    const data = {
      raw: this.object,
    };

    // Parse damage types
    data.damageTypes = this.object.damageTypes.reduce((cur, o) => {
      cur.push(
        mergeObject(
          o,
          {
            key: o.id,
          },
          { inplace: false }
        )
      );

      return cur;
    }, []);

    // Parse materials
    data.materials = this.object.materials.reduce((cur, o) => {
      cur.push(
        mergeObject(
          o,
          {
            key: o.id,
          },
          { inplace: false }
        )
      );

      return cur;
    }, []);

    // Parse DR types
    data.dr = this.object.dr.reduce((cur, o) => {
      cur.push(
        mergeObject(
          o,
          {
            key: o.id,
            showAsPlaceholder: o.name.toLowerCase(),
          },
          { inplace: false }
        )
      );

      return cur;
    }, []);

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // ----------------------------- //
    //  Slots                        //
    // ----------------------------- //
    html.find('.item-list .item input.data-field[type="text"]').on("change", this._onChangeListObjectText.bind(this));
    html.find('.item-list .item img[data-action="file-picker"]').on("click", this._onChangeListObjectImage.bind(this));
    html.find(".item-list .item .item-controls a").on("click", this._onListObjectControl.bind(this));

    html.find(".item-list .header .item-controls a").on("click", this._onListObjectHeaderControl.bind(this));

    html.find(".item-list .draggable").on("dragstart", this._onDragStart.bind(this));
    html.find(".item-list .draggable").on("dragend", this._onDragEnd.bind(this));
    html.find(".item-list").on("drop", this._onDrop.bind(this));
  }

  _onDragStart(event) {
    const elem = event.currentTarget.closest(".item");
    elem.style.opacity = 0.4;
    event.originalEvent.dataTransfer.setData("text/plain", elem.dataset.key);
  }

  _onDragEnd(event) {
    const elem = event.currentTarget.closest(".item");
    elem.style.opacity = 1;
  }

  async _onDrop(event) {
    const elem = event.target?.closest(".item");
    const listType = event.target?.closest(".item-list")?.dataset.listType;

    if (!elem || !listType) return;

    const origKey = event.originalEvent.dataTransfer.getData("text/plain").toString();
    const dropKey = elem.dataset.key;

    this.object = await this.constructor.moveListObject(listType, origKey, dropKey);
    this.render();
  }

  async _onChangeListObjectText(event) {
    const elem = event.currentTarget;
    const listType = elem.closest(".item-list").dataset.listType;
    const { list } = this.constructor.getListVariables(listType);
    const key = elem.closest(".item").dataset.key;

    const dataPath = elem.name;
    const isName = dataPath === "name";
    const listObj = this.constructor.getListObject(listType, key);

    const newValue = elem.value;

    // Abort if new name is empty
    if (isName && !newValue) {
      this.render();
      return;
    }

    // Abort if it would create a duplicate key
    if (isName) {
      if (list.filter((o) => o.name === newValue).length > 0) {
        this.render();
        return;
      }
    }

    // Change name
    this.object = await this.constructor.updateListData(listType, [
      {
        name: listObj.name,
        data: {
          [dataPath]: newValue,
        },
      },
    ]);
    this.render();
  }

  _onChangeListObjectImage(event) {
    const listType = event.currentTarget.closest(".item-list").dataset.listType;
    const { listKey } = this.constructor.getListVariables(listType);

    return new Promise((resolve, reject) => {
      const id = event.currentTarget.closest(".item").dataset.key;
      const item = this.object[listKey].find((o) => o.id === id);
      if (!item) return;

      const fp = new FilePicker({
        type: "image",
        current: item.img,
        callback: async (path) => {
          if (item.img !== path) {
            this.object = await this.constructor.updateListData(listType, [{ name: item.name, data: { img: path } }]);
            this.render();
            resolve();
          } else {
            reject(new Error("The image path didn't change."));
          }
        },
        top: this.position.top + 40,
        left: this.position.left + 10,
      });
      fp.browse();
    });
  }

  async _onListObjectHeaderControl(event) {
    const action = event.currentTarget.dataset.action;
    const listType = event.currentTarget.closest(".item-list").dataset.listType;

    switch (action) {
      case "add":
        this.object = await this.constructor.addListObject(listType);
        this.render();
        break;
    }
  }

  async _onListObjectControl(event) {
    const elem = event.currentTarget;
    const action = elem.dataset.action;
    const key = elem.closest(".item").dataset.key;
    const listType = event.currentTarget.closest(".item-list").dataset.listType;
    const item = this.constructor.getListObject(listType, key);

    if (!item) return;

    switch (action) {
      case "delete":
        return new Promise((resolve) => {
          Dialog.confirm({
            title: game.i18n.localize("PF1.DeleteItemTitle").format(item.name),
            content: `<p>${game.i18n.localize("PF1.DeleteItemConfirmation")}</p>`,
            yes: async () => {
              this.object = await this.constructor.removeListObject(listType, key);
              this.render();
            },
            no: () => {},
          }).then(() => {
            resolve();
          });
        });
    }
  }
}
