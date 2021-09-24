import { ItemChange } from "../../pf1.js";
import { WorldConfig } from "../config/world-config.js";
import { slugify } from "../data-lib.js";

/**
 * @param {Widget_IconSelector~Items} [items] - A list of items to initialize this widget with.
 * @param {object} [options]
 * @param {boolean} [options.multiSelect = false] - Whether to allow the selection of multiple items.
 * @param {object} [applicationOptions] - An object normally passed as options to the Application constructor.
 */
export class Widget_IconSelector extends Application {
  constructor(items = [], options = {}, applicationOptions = {}) {
    super(applicationOptions);

    /**
     * @typedef {object} Widget_IconSelector~Item
     * @property {string} key - The key of the item.
     * @property {string} icon - The icon URL of the item.
     * @property {string} [tooltip] - The tooltip text to show for the item.
     */
    /**
     * @property {Widget_IconSelector~Item[]} items
     */
    this.items = items;

    /**
     * @property {boolean} multiSelect
     */
    this.multiSelect = options.multiSelect === true;

    /**
     * Contains the currently selected key(s).
     *
     * @property {string[]} selectedKeys
     */
    this.selectedKeys = [];

    /**
     * Contains functions which need to be called when this application is submitted or closed.
     *
     * @property {Function[]} _resolveFunctions
     * @private
     */
    this._resolveFunctions = [];
    /**
     * Whether the resolve functions have been called already.
     *
     * @property {boolean} _resolved
     * @private
     */
    this._resolved = false;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("PF1.Widget.IconSelector.Name"),
      width: 204,
      height: 224,
      classes: ["widget", "icon-selector"],
      scrollY: [".item-list"],
      template: "systems/pf1/templates/widgets/icon-selector.hbs",
    });
  }

  static get checkImage() {
    return "systems/pf1/icons/misc/check-mark.svg";
  }

  static getSignature(items = []) {
    return "";
  }

  getData() {
    const data = super.getData() ?? {};

    data.checkImage = this.constructor.checkImage;

    data.items = this.items.map((o) => {
      return mergeObject(
        o,
        {
          selected: this.selectedKeys.includes(o.key),
        },
        { inplace: false }
      );
    });

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("a.item").on("click", this._onClickItem.bind(this));
    html.find('button[type="submit"]').on("click", this._onSubmit.bind(this));
  }

  _onClickItem(event) {
    event.preventDefault();

    const a = event.currentTarget;
    const key = a.dataset.key;

    // Multi-select
    if (this.multiSelect && game.keyboard.isDown("Shift")) {
      const idx = this.selectedKeys.indexOf(key);
      if (idx >= 0) {
        this.selectedKeys.splice(idx, 1);
      } else {
        this.selectedKeys.push(key);
      }
    }
    // Single select
    else {
      this.selectedKeys = [key];
    }

    this.render();
  }

  awaitResult() {
    return new Promise((resolve) => {
      this._resolveFunctions.push(resolve);
    });
  }

  _onSubmit(event) {
    event.preventDefault();

    if (!this._resolved) {
      for (let fn of this._resolveFunctions) {
        fn(this.getResult());
      }
      this._resolved = true;
    }
    this.close();
  }

  async close(...args) {
    await super.close(...args);

    if (!this._resolved) {
      for (let fn of this._resolveFunctions) {
        fn(null);
      }
      this._resolved = true;
    }
  }

  getResult() {
    return this.selectedKeys;
  }
}

/**
 * Creates a widget to select data from world data.
 *
 * @param {object} options
 * @param {"damageType"|"damageReduction"|"energyResistance"} options.type - The type of widget to create.
 * @param {object} data - The data to supply this widget with.
 * @param {object} [applicationOptions] - An object normally passed as options to the Application constructor.
 */
export class Widget_WorldListSelector extends Widget_IconSelector {
  constructor(data = {}, options = {}, applicationOptions = {}) {
    const items = Widget_WorldListSelector.getItems(options.type);

    if (applicationOptions.title == null) {
      applicationOptions.title = Widget_WorldListSelector.getTitle(options.type);
    }
    super(items, undefined, applicationOptions);

    this.type = options.type;

    /**
     * Contains the widget's data, which should be able to be used in JSON.stringify
     *
     * @property {object} data
     */
    this.data = duplicate(data);

    this.prepareData();
  }

  static getTitle(type) {
    switch (type) {
      case "damageType":
        return game.i18n.localize("PF1.Widget.WorldListSelector.Name.DamageType");
      case "damageReduction":
        return game.i18n.localize("PF1.Widget.WorldListSelector.Name.DamageReduction");
      case "energyResistance":
        return game.i18n.localize("PF1.Widget.WorldListSelector.Name.EnergyResistance");
    }

    return "";
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      height: 256,
      classes: ["widget", "icon-selector", "world-list-selector"],
    });
  }

  static getItems(type) {
    let list;
    switch (type) {
      case "damageType":
        ({ list } = WorldConfig.getListVariables("damageType"));
        break;
      case "damageReduction":
        ({ list } = WorldConfig.getListVariables("dr"));
        break;
      case "energyResistance":
        ({ list } = WorldConfig.getListVariables("damageType"));
    }

    if (list) {
      return list.map((o) => {
        return {
          key: slugify(o.name),
          img: o.img,
          tooltip: o.name,
        };
      });
    }
    return null;
  }

  static async getSignature(change = null) {
    if (!(change instanceof ItemChange)) return "";

    if (change.subTarget == null) return "";

    let template,
      templateData = {};
    const operatorLabel =
      change.value.logicalOperator === true
        ? game.i18n.localize("PF1.Operators.And")
        : game.i18n.localize("PF1.Operators.Or");

    // Damage Reduction
    if (change.subTarget === "dr") {
      template = "systems/pf1/templates/widgets/signatures/damage-reduction.hbs";
      templateData.value = change.drValue ?? 0;

      const drTypes =
        change.value.keys?.reduce((cur, key) => {
          const data = WorldConfig.getListObject("dr", key);
          if (data) {
            if (data.showAs) cur.push(data.showAs);
            else cur.push(data.name.toLowerCase());
          }
          return cur;
        }, []) ?? [];
      templateData.label = drTypes.join(` ${operatorLabel.toLowerCase()} `);
    }

    // Energy Resistance
    else if (change.subTarget === "eres") {
      template = "systems/pf1/templates/widgets/signatures/energy-resistance.hbs";
      const key = change.value.keys?.[0];
      const data = WorldConfig.getListObject("damageType", key);
      templateData.value = change.resistanceValue ?? 0;
      templateData.img = data?.img ?? CONFIG.PF1.unknownImage;
      templateData.tooltip = key != null ? `${data.name} ${templateData.value}` : null;
    }

    return await renderTemplate(template, templateData);
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".switch").on("click", this._onClickSwitch.bind(this));
    html.find("input[name]").on("change", this._onInputChange.bind(this));
  }

  prepareData() {
    // Set up logical operator switch
    this.usesLogicalOperator = ["damageType", "damageReduction"].includes(this.type);
    if (!hasProperty(this.data, "logicalOperator")) {
      setProperty(this.data, "logicalOperator", true);
    }

    // Set up number field
    this.usesValueField = ["damageReduction", "energyResistance"].includes(this.type);
    if (!hasProperty(this.data, "value")) {
      setProperty(this.data, "value", 0);
    }

    // Set up multi select
    if (this.usesLogicalOperator) {
      this.multiSelect = true;
    }

    // Set up selected keys
    if (hasProperty(this.data, "keys")) {
      this.selectedKeys = getProperty(this.data, "keys");
    }
  }

  getData() {
    const data = super.getData();

    data.data = this.data;
    data.usesLogicalOperator = this.usesLogicalOperator === true;
    data.usesValueField = this.usesValueField === true;
    data.multiSelect = this.multiSelect === true;

    return data;
  }

  getResult() {
    return mergeObject(this.data, {
      keys: this.selectedKeys,
    });
  }

  _onClickSwitch(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    const dataPath = elem.name ?? elem.dataset.name;
    setProperty(this.data, dataPath, !getProperty(this.data, dataPath));

    this.render();
  }

  _onInputChange(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    const dataPath = elem.name ?? elem.dataset.name;
    const value = elem.type === "checkbox" ? elem.checked : elem.value.toString();

    setProperty(this.data, dataPath, value);

    this.render();
  }
}
