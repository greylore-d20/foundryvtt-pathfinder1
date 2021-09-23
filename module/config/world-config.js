import { slugify, uniqueKey } from "../data-lib.js";

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
      name: game.i18n.localize("PF1.WorldConfig.DamageType.NewName"),
      img: "icons/svg/sword.svg",
    };
  }

  static get defaultMaterialData() {
    return {
      name: game.i18n.localize("PF1.WorldConfig.Material.NewName"),
      img: "icons/svg/coins.svg",
      hardness: 10,
      hpPer: 30,
      bypassesDR: [],
    };
  }

  static get defaultDRData() {
    return {
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
          name: "Untyped",
          img: "icons/skills/wounds/injury-body-pain-gray.webp",
        },
        {
          name: "Slashing",
          img: "icons/weapons/axes/axe-battle-black.webp",
        },
        {
          name: "Piercing",
          img: "icons/weapons/polearms/spear-flared-blue.webp",
        },
        {
          name: "Bludgeoning",
          img: "icons/weapons/hammers/hammer-double-steel-embossed.webp",
        },
        {
          name: "Fire",
          img: "icons/magic/fire/blast-jet-stream-splash.webp",
        },
        {
          name: "Cold",
          img: "icons/magic/water/barrier-ice-crystal-wall-faceted.webp",
        },
        {
          name: "Electricity",
          img: "icons/magic/lightning/bolt-blue.webp",
        },
        {
          name: "Acid",
          img: "icons/magic/acid/dissolve-pool-bubbles.webp",
        },
        {
          name: "Sonic",
          img: "icons/magic/sonic/explosion-shock-wave-teal.webp",
        },
        {
          name: "Force",
          img: "icons/magic/lightning/orb-ball-purple.webp",
        },
        {
          name: "Positive Energy",
          img: "icons/magic/light/beam-strike-orange-gold.webp",
        },
        {
          name: "Negative Energy",
          img: "icons/magic/unholy/orb-rays-blue.webp",
        },
      ],
      materials: [
        {
          name: "Steel",
          img: "icons/commodities/metal/ingot-plain-steel.webp",
          hardness: 10,
          hpPer: 30,
          bypassesDR: [],
        },
        {
          name: "Cold Iron",
          img: "icons/commodities/metal/ingot-worn-steel.webp",
          hardness: 10,
          hpPer: 30,
          bypassesDR: ["cold-iron"],
        },
        {
          name: "Alchemical Silver",
          img: "icons/commodities/metal/ingot-engraved-silver.webp",
          hardness: 8,
          hpPer: 10,
          bypassesDR: ["silver"],
        },
        {
          name: "Mithral",
          img: "icons/commodities/metal/ingot-stamped-silver.webp",
          hardness: 15,
          hpPer: 30,
          bypassesDR: ["silver"],
        },
        {
          name: "Adamantine",
          img: "icons/commodities/metal/ingot-stamped-purple.webp",
          hardness: 20,
          hpPer: 40,
          bypassesDR: ["adamantine"],
        },
        {
          name: "Glass",
          img: "icons/tools/laboratory/alembic-glass-ball-blue.webp",
          hardness: 1,
          hpPer: 1,
          bypassesDR: [],
        },
        {
          name: "Paper",
          img: "icons/sundries/documents/paper-plain-white.webp",
          hardness: 0,
          hpPer: 2,
          bypassesDR: [],
        },
        {
          name: "Cloth",
          img: "icons/commodities/cloth/cloth-bolt-yellow.webp",
          hardness: 0,
          hpPer: 2,
          bypassesDR: [],
        },
        {
          name: "Ice",
          img: "icons/magic/water/barrier-ice-crystal-wall-faceted.webp",
          hardness: 0,
          hpPer: 3,
          bypassesDR: [],
        },
        {
          name: "Leather",
          img: "icons/commodities/leather/leather-bolt-tan.webp",
          hardness: 2,
          hpPer: 5,
          bypassesDR: [],
        },
        {
          name: "Wood",
          img: "icons/commodities/wood/lumber-stack.webp",
          hardness: 5,
          hpPer: 10,
          bypassesDR: [],
        },
        {
          name: "Stone",
          img: "icons/commodities/stone/ore-chunk-grey.webp",
          hardness: 8,
          hpPer: 15,
          bypassesDR: [],
        },
      ],
      dr: [
        {
          name: "Untyped",
          showAs: "-",
          img: "icons/skills/wounds/injury-body-pain-gray.webp",
        },
        {
          name: "Slashing",
          showAs: "",
          img: "icons/weapons/axes/axe-battle-black.webp",
        },
        {
          name: "Piercing",
          showAs: "",
          img: "icons/weapons/polearms/spear-flared-blue.webp",
        },
        {
          name: "Bludgeoning",
          showAs: "",
          img: "icons/weapons/hammers/hammer-double-steel-embossed.webp",
        },
        {
          name: "Cold Iron",
          showAs: "",
          img: "icons/commodities/metal/ingot-worn-steel.webp",
        },
        {
          name: "Silver",
          showAs: "",
          img: "icons/commodities/metal/ingot-engraved-silver.webp",
        },
        {
          name: "Adamantine",
          showAs: "",
          img: "icons/commodities/metal/ingot-stamped-purple.webp",
        },
        {
          name: "Good",
          showAs: "",
          img: "icons/magic/holy/angel-winged-humanoid-blue.webp",
        },
        {
          name: "Evil",
          showAs: "",
          img: "icons/magic/unholy/hand-claw-glow-orange.webp",
        },
        {
          name: "Lawful",
          showAs: "",
          img: "icons/magic/symbols/cog-shield-white-blue.webp",
        },
        {
          name: "Chaotic",
          showAs: "",
          img: "icons/magic/fire/projectile-fireball-purple.webp",
        },
        {
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

    // Alter slot data
    let hasChanges = false;
    for (const item of settings[listKey]) {
      const pair = updateData.find((o) => o.name === item.name);
      if (pair) {
        mergeObject(item, pair.data);
        hasChanges = true;
        updateData.splice(updateData.indexOf(pair), 1);
      }
    }

    // Apply results
    if (hasChanges) {
      await game.settings.set("pf1", "worldConfig", settings);
    }
    return settings;
  }

  /**
   * @typedef {Object} WorldConfig.ListVariables
   * @property {Object[]} list - The list in question.
   * @property {string} listKey - The key of the list object on the settings object.
   * @property {Object} defaultData - The default data of objects associated with the list.
   * @property {string[]} itemKeys - All the keys (slugified names) of the items within the list.
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

    const itemKeys = list.map((o) => slugify(o.name));

    return { list, listKey, defaultData, itemKeys };
  }

  /**
   * Finds an object from a list within the world data.
   *
   * @param {WorldConfig.ListType} type - The type of list to find an object in.
   * @param {string} key - The key (slugified name) of the object to find.
   * @returns {Object} The data object, if found.
   */
  static getListObject(type, key) {
    const { list } = this.getListVariables(type);

    return list.find((o) => slugify(o.name) === key);
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
      cur.push(slugify(o.name));
      return cur;
    }, []);

    const newData = mergeObject(defaultData, data);
    newData.name = uniqueKey(keys, newData.name);

    list.push(newData);
    await game.settings.set("pf1", "worldConfig", settings);
    Hooks.callAll(`pf1.worldData.create.${type}`, newData);
    return settings;
  }

  /**
   * Removes an object from one of the world configuration's lists.
   *
   * @param {WorldConfig.ListType} type - The type of list to remove from.
   * @param {string} key - The key (slugified name) of the item to remove.
   * @returns {Object} The new world settings data object.
   */
  static async removeListObject(type, key) {
    const settings = duplicate(this.settings);
    const { list, listKey } = this.getListVariables(type, settings);
    settings[listKey] = list.filter((o) => slugify(o.name) !== key);

    await game.settings.set("pf1", "worldConfig", settings);
    Hooks.callAll(`pf1.worldData.delete.${type}`, key);
    return settings;
  }

  /**
   * Moves a list object within its list, reordering it.
   *
   * @param {WorldConfig.ListType} type - The type of list to move an object in.
   * @param {string} from - The slugified name of the item to move around.
   * @param {string} to - The slugified name of the item to move just above of (if earlier) of just below (if later).
   * @returns {Object} The new world settings data object.
   */
  static async moveListObject(type, from, to) {
    const settings = duplicate(this.settings);
    const { list } = this.getListVariables(type, settings);

    if (from === to) return settings;

    const fromObj = list.find((o) => slugify(o.name) === from);
    const toObj = list.find((o) => slugify(o.name) === to);
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
            key: slugify(o.name),
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
            key: slugify(o.name),
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
            key: slugify(o.name),
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
    html.find('.item-list .item input[name="name"]').on("change", this._onChangeListObjectName.bind(this));
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

  async _onChangeListObjectName(event) {
    const elem = event.currentTarget;
    const listType = elem.closest(".item-list").dataset.listType;
    const { list, listKey } = this.constructor.getListVariables(listType);
    const key = elem.closest(".item").dataset.key;

    const prevName = this.constructor.settings[listKey].find((o) => slugify(o.name) === key)?.name;
    if (!prevName) return;

    const newName = elem.value;
    const newKey = slugify(newName);

    // Abort if new name is empty
    if (!newName) {
      this.render();
      return;
    }

    // Abort if it would create a duplicate key
    if (list.filter((o) => slugify(o.name) === newKey).length > 0 && key !== newKey) {
      this.render();
      return;
    }

    // Change name
    this.object = await this.constructor.updateListData(listType, [
      {
        name: prevName,
        data: {
          name: newName,
        },
      },
    ]);
    Hooks.callAll(`pf1.worldData.rename.${listType}`, prevName, newName);
    this.render();
  }

  _onChangeListObjectImage(event) {
    const listType = event.currentTarget.closest(".item-list").dataset.listType;
    const { listKey } = this.constructor.getListVariables(listType);

    return new Promise((resolve, reject) => {
      const key = event.currentTarget.closest(".item").dataset.key;
      const item = this.object[listKey].find((o) => slugify(o.name) === key);
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
