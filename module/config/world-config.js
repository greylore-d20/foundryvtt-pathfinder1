import { Widget_WorldListSelector } from "../widgets/icon-selector.js";
import { uniqueName } from "../lib.js";
import { DamageType_Default } from "./world-data/damage-types.js";
import { DamageReduction_Default } from "./world-data/damage-reduction.js";
import { Material_Default } from "./world-data/materials.js";

/**
 * A string identifying the type of list on the world configuration we are talking about.
 *
 * @typedef {("damageTypes"|"materials"|"damageReduction")} WorldConfig.ListType
 */

export class WorldConfig extends FormApplication {
  constructor(options) {
    super(null, options);
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

  static getSettings(type) {
    return game.settings.get("pf1", `worldData.${type}`);
  }

  /**
   * @typedef {object} NameUpdateData
   * @property {string} name - The object's `name` property to find it by.
   * @property {object} data - The update data for the object.
   */
  /**
   * Changes list data
   *
   * @param {WorldConfig.ListType} type - The type of list to change objects for.
   * @param {NameUpdateData[]} updateData - The changes to push. An array containing an object for each slot.
   * @returns {Promise.<object>} A promise returning the new settings object.
   */
  static async updateListData(type, updateData) {
    const settings = duplicate(this.getSettings(type));

    const { listKey } = this.getListVariables(type);
    const hookArgs = [];

    // Alter slot data
    let hasChanges = false;
    for (const item of settings) {
      const pair = updateData.find((o) => o.id === item.id);
      if (pair) {
        mergeObject(item, pair.data);
        hasChanges = true;
        updateData.splice(updateData.indexOf(pair), 1);
        hookArgs.push([item, pair]);
      }
    }

    // Apply results
    if (hasChanges) {
      await game.settings.set("pf1", `worldData.${type}`, settings);
      for (let args of hookArgs) {
        Hooks.callAll(`pf1.worldData.update.${type}`, ...args);
      }
    }
    return settings;
  }

  /**
   * @typedef {object} WorldConfig.ListVariables
   * @property {object[]} list - The list in question.
   * @property {string} listKey - The key of the list object on the settings object.
   * @property {object} defaultData - The default data of objects associated with the list.
   * @property {string[]} itemIDs - All the IDs of the items within the list.
   */
  /**
   * Returns some variables about one of the world configuration's lists.
   *
   * @param {string} type - The type of list to get variables from.
   * @param {object} [settings] - The optional settings object to provide, in case you need e.g. a duplicate to work with.
   * @returns {WorldConfig.ListVariables|null} The list's variables.
   */
  static getListVariables(type, settings = null) {
    if (!settings) settings = this.getSettings(type);

    const defaultData = this.getDefaultData(type);
    const list = settings;

    if (!list || !defaultData) return null;

    const itemIDs = list.map((o) => o.id);

    return { list, listKey: type, defaultData, itemIDs };
  }

  static getDefaultData(type) {
    switch (type) {
      case "damageTypes":
        return DamageType_Default();
      case "materials":
        return Material_Default();
      case "damageReduction":
        return DamageReduction_Default();
    }

    return null;
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
    const settings = duplicate(this.getSettings(type));
    const { list, defaultData } = this.getListVariables(type, settings);

    const keys = list.reduce((cur, o) => {
      cur.push(o.id);
      return cur;
    }, []);

    const newData = mergeObject(defaultData, data);
    newData.name = uniqueName(keys, newData.name);

    list.push(newData);
    await game.settings.set("pf1", `worldData.${type}`, settings);
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
    const settings = duplicate(this.getSettings(type));
    const { list, listKey } = this.getListVariables(type, settings);
    const obj = list.find((o) => o.id === id);
    if (!obj) return settings;

    settings[listKey].splice(settings[listKey].indexOf(obj), 1);
    await game.settings.set("pf1", `worldData.${type}`, settings);
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
    const settings = duplicate(this.getSettings(type));
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

    await game.settings.set("pf1", `worldData.${type}`, settings);
    return settings;
  }

  async getData() {
    const data = {
      raw: this.object,
    };

    // Parse damage types
    data.damageTypes = this.constructor.getSettings("damageTypes").reduce((cur, o) => {
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
    data.materials = this.constructor.getSettings("materials").reduce((cur, o) => {
      cur.push(
        mergeObject(
          o,
          {
            key: o.id,
            bypassDRData: o.bypassesDR.map((o2) => {
              const dr = this.constructor.getListObject("damageReduction", o2);
              return {
                img: dr.img,
                name: dr.name,
              };
            }),
          },
          { inplace: false }
        )
      );

      return cur;
    }, []);

    // Parse DR types
    data.dr = this.constructor.getSettings("damageReduction").reduce((cur, o) => {
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

    // List objects
    html.find('.item-list .item input.data-field[type="text"]').on("change", this._onChangeListObjectText.bind(this));
    html
      .find('.item-list .item input.data-field[type="checkbox"]')
      .on("change", this._onChangeListObjectCheckbox.bind(this));
    html.find('.item-list .item img[data-action="file-picker"]').on("click", this._onChangeListObjectImage.bind(this));
    html.find(".item-list .item .widget.bypass-dr").on("click", this._onClickBypassDR.bind(this));
    html.find(".item-list .item .item-controls a").on("click", this._onListObjectControl.bind(this));

    // Header control
    html.find(".item-list .header .item-controls a").on("click", this._onListObjectHeaderControl.bind(this));

    // Dragging
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
    event.preventDefault();
    const elem = event.target?.closest(".item");
    const listType = event.target?.closest(".item-list")?.dataset.listType;

    if (!elem || !listType) return;

    const origKey = event.originalEvent.dataTransfer.getData("text/plain").toString();
    const dropKey = elem.dataset.key;

    this.object = await this.constructor.moveListObject(listType, origKey, dropKey);
    this.render();
  }

  async _onChangeListObjectText(event) {
    event.preventDefault();
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
    await this.constructor.updateListData(listType, [
      {
        id: listObj.id,
        data: {
          [dataPath]: newValue,
        },
      },
    ]);
    this.render();
  }

  async _onChangeListObjectCheckbox(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const listType = elem.closest(".item-list").dataset.listType;
    const key = elem.closest(".item").dataset.key;

    const dataPath = elem.name;
    const listObj = this.constructor.getListObject(listType, key);

    const newValue = elem.checked === true;

    // Change value
    await this.constructor.updateListData(listType, [
      {
        id: listObj.id,
        data: {
          [dataPath]: newValue,
        },
      },
    ]);
    this.render();
  }

  _onChangeListObjectImage(event) {
    event.preventDefault();
    const listType = event.currentTarget.closest(".item-list").dataset.listType;
    const { listKey } = this.constructor.getListVariables(listType);

    return new Promise((resolve, reject) => {
      const id = event.currentTarget.closest(".item").dataset.key;
      const item = this.constructor.getSettings(listKey).find((o) => o.id === id);
      if (!item) return;

      const fp = new FilePicker({
        type: "image",
        current: item.img,
        callback: async (path) => {
          if (item.img !== path) {
            this.object = await this.constructor.updateListData(listType, [{ id: id, data: { img: path } }]);
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

  async _onClickBypassDR(event) {
    event.preventDefault();
    const thisListType = event.currentTarget.closest(".item-list").dataset.listType;
    const { ...thisData } = this.constructor.getListVariables(thisListType);

    const id = event.currentTarget.closest(".item").dataset.key;
    const item = this.constructor.getSettings(thisData.listKey).find((o) => o.id === id);
    if (!item) return;

    const app = new Widget_WorldListSelector(
      { keys: item.bypassesDR },
      {
        type: "damageReduction",
        multiSelect: true,
        useLogicalOperator: false,
        useValueField: false,
      }
    );
    app.render(true);
    const result = await app.awaitResult();

    if (result != null) {
      this.object = await this.constructor.updateListData(thisListType, [
        { id: id, data: { bypassesDR: result.keys } },
      ]);
      this.render();
    }
  }

  async _onListObjectHeaderControl(event) {
    event.preventDefault();
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
