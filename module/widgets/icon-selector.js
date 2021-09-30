import { ItemChange } from "../../pf1.js";
import { WorldConfig } from "../config/world-config.js";
import { Data_DamageType } from "../misc/data.js";

/**
 * @typedef {object} Widget_IconSelector_ListItem
 * @property {string} key - The key of the item.
 * @property {string} img - The icon URL of the item.
 * @property {string} [tooltip] - The tooltip text to show for the item.
 */
/**
 * @typedef {object} IconHeader
 * @property {string} label - The label of the header.
 * @property {Widget_IconSelector_ListItem[]} items - The list of icons to pass.
 * @property {string[]} [selected] - Mark the initially selected icons by their key.
 * @property {boolean} [multiselect = false] - Whether to allow multiple selections within this header.
 */
/**
 * @param {Widget_IconSelector_ListItem[]} [items] - A list of items to initialize this widget with.
 * @param {object} [options]
 * @param {boolean} [options.multiSelect = false] - Whether to allow the selection of multiple items.
 * @param {object} [applicationOptions] - An object normally passed as options to the Application constructor.
 */
export class Widget_IconSelector extends Application {
  constructor(items = [], options = {}, applicationOptions = {}) {
    super(applicationOptions);

    /**
     * @property {Widget_IconSelector_ListItem[]} items
     * The primary items for this widget.
     */
    this.items = items;

    /**
     * @property {boolean} multiSelect
     * Whether to allow multiple selections.
     */
    this.multiSelect = options.multiSelect;

    /**
     * @property {string[]} selectedKeys
     * Contains the currently selected key(s).
     */
    this.selectedKeys = [];

    /**
     * @property {Function[]} _resolveFunctions
     * Contains functions which need to be called when this application is submitted or closed.
     * @private
     */
    this._resolveFunctions = [];
    /**
     * @property {boolean} _resolved
     * Whether the resolve functions have been called already.
     * @private
     */
    this._resolved = false;

    /**
     * @property {object.<string, IconHeader>} extraHeaders
     * Extra headers
     */
    this.extraHeaders = {};
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("PF1.Widget.IconSelector.Name"),
      width: 204,
      height: 256,
      classes: ["widget", "icon-selector"],
      scrollY: [".content"],
      template: "systems/pf1/templates/widgets/icon-selector.hbs",
    });
  }

  static get checkImage() {
    return "systems/pf1/icons/misc/check-mark.svg";
  }

  /**
   * @typedef {object} Widget_IconSelector_SignatureItem
   * @property {string} img - The image URL of the item.
   * @property {string} [name] - The name of the item.
   */
  /**
   * Renders a signature HTML element.
   *
   * @param {Widget_IconSelector_SignatureItem[]} items - The items to insert.
   * @param {string[]} [classes] - Additional class names to insert to the root signature element.
   * @param {boolean|null} [logicalOperator = null] - If null, no logical operator is shown. Otherwise, separate items with 'and' for true, or 'or' for false.
   * @param {Widget_IconSelector_SignatureItem[]} [extraItems] - Extra items to pass, which will be shown in a list separate from the primary items.
   * @returns {string} The new HTML element, as a string.
   */
  static async getSignature(items = [], classes = [], logicalOperator = null, extraItems = []) {
    if (logicalOperator === true) logicalOperator = game.i18n.localize("PF1.Operators.And").toLowerCase();
    else if (logicalOperator === false) logicalOperator = game.i18n.localize("PF1.Operators.Or").toLowerCase();

    const templateData = {
      items,
      classes,
      logicalOperator,
      extraItems,
    };
    return renderTemplate("systems/pf1/templates/widgets/signatures/icons.hbs", templateData);
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

    data.extraHeaders = this.extraHeaders;
    for (const header of Object.values(data.extraHeaders)) {
      header.items.forEach((item) => {
        item.selected = (header.selected ?? []).includes(item.key);
      });
    }

    data.config = CONFIG.PF1;

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("a.item").on("click", this._onClickItem.bind(this));
    html.find('button[type="submit"]').on("click", this._onSubmit.bind(this));
    html.find(".switch").on("click", this._onClickSwitch.bind(this));
    html.find("input[name]").on("change", this._onInputChange.bind(this));
  }

  _onClickItem(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    const key = elem.dataset.key;
    const headerKey = elem.closest(".item-list").dataset.header;
    const header = this.extraHeaders?.[headerKey];

    const multiSelect = header?.multiSelect ?? this.multiSelect;
    const selected = header != null ? header.selected ?? [] : this.selectedKeys;
    if (header) header.selected = selected;

    // Multi-select
    if (multiSelect && game.keyboard.isDown("Shift")) {
      const idx = selected.indexOf(key);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else {
        selected.push(key);
      }
    }
    // Single select
    else {
      if (selected.includes(key)) selected.splice(selected.indexOf(key), 1);
      else selected.splice(0, selected.length, key);
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
 * @param {object} data - The data to supply this widget with.
 * @param {object} options
 * @param {"damageType|singleDamageType"|"damageReduction"|"energyResistance"} options.type - The type of widget to create.
 * @param {boolean} [options.multiSelect] - Override the widget's multi select option.
 * @param {boolean} [options.useLogicalOperator] - Override whether to render the logical operator.
 * @param {boolean} [options.useValueField] - Override whether to render the value field.
 * @param {boolean} [options.useDamageRule] - Override whether to add a switch for splitting damage or using the best source.
 * @param {object.<string, IconHeader>} [options.extraHeaders] - Extra headers to pass, for additional icon options.
 * @param {object} [applicationOptions] - An object normally passed as options to the Application constructor.
 */
export class Widget_WorldListSelector extends Widget_IconSelector {
  constructor(data = {}, options = {}, applicationOptions = {}) {
    const items = Widget_WorldListSelector.getItems(options.type);

    if (applicationOptions.title == null) {
      applicationOptions.title = Widget_WorldListSelector.getTitle(options.type);
    }
    super(items, undefined, applicationOptions);

    this.widgetOptions = options;

    /**
     * @property {object} data
     *
     * Contains the widget's data.
     */
    this.data = duplicate(data);

    this.extraHeaders = options.extraHeaders ?? {};

    this.prepareData();
  }

  static getTitle(type) {
    switch (type) {
      case "damageType":
      case "singleDamageType":
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
      height: 320,
      classes: ["widget", "icon-selector", "world-list-selector"],
    });
  }

  static getItems(type) {
    let list;
    switch (type) {
      case "damageType":
        list = WorldConfig.getListVariables("damageTypes").list.filter((o) => !o.isModifier);
        break;
      case "singleDamageType":
        ({ list } = WorldConfig.getListVariables("damageTypes"));
        break;
      case "damageReduction":
        ({ list } = WorldConfig.getListVariables("damageReduction"));
        break;
      case "energyResistance":
        ({ list } = WorldConfig.getListVariables("damageTypes")).list.filter((o) => !o.isModifier);
        break;
    }

    if (list) {
      return list.map((o) => {
        return {
          key: o.id,
          img: o.img,
          tooltip: o.name,
        };
      });
    }
    return null;
  }

  /**
   * Renders a signature HTML element based off a single change.
   *
   * @param {ItemChange} change - An array of change items to add.
   * @returns {string} The new HTML element, as a string.
   */
  static async getChangeSignature(change = null) {
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
          const data = WorldConfig.getListObject("damageReduction", key);
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
      const data = WorldConfig.getListObject("damageTypes", key);
      if (!data) return "";
      templateData.value = change.resistanceValue ?? 0;
      templateData.img = data?.img ?? CONFIG.PF1.unknownImage;
      templateData.tooltip = `${data.name} ${templateData.value}`;
    }

    // Damage Vulnerability/Immunity
    else if (["di", "dv"].includes(change.subTarget)) {
      template = "systems/pf1/templates/widgets/signatures/di-dv.hbs";
      const key = change.value.keys?.[0];
      const data = WorldConfig.getListObject("damageTypes", key);
      if (!data) return "";
      templateData.img = data?.img ?? CONFIG.PF1.unknownImage;
      templateData.tooltip = `${data.name}`;
    }

    if (!template) return "";
    return await renderTemplate(template, templateData);
  }

  prepareData() {
    const options = this.widgetOptions;

    // Set up logical operator switch
    if (options.useLogicalOperator == null)
      options.useLogicalOperator = ["damageType", "damageReduction"].includes(options.type);
    if (!hasProperty(this.data, "logicalOperator")) {
      setProperty(this.data, "logicalOperator", true);
    }

    // Set up damage switch
    if (options.useDamageRule == null) options.useDamageRule = false;
    if (!hasProperty(this.data, "rule")) {
      setProperty(this.data, "rule", Object.keys(CONFIG.PF1.damageRules)[0]);
    }

    // Set up number field
    if (options.useValueField == null)
      options.useValueField = ["damageReduction", "energyResistance"].includes(options.type);
    if (!hasProperty(this.data, "value")) {
      setProperty(this.data, "value", 0);
    }

    // Set up multi select
    if (options.useLogicalOperator) {
      this.multiSelect = true;
    }

    // Set up selected keys
    if (hasProperty(this.data, "keys")) {
      this.selectedKeys = getProperty(this.data, "keys");
    }

    // Set up extra headers
    if (options.extraHeaders == null) options.extraHeaders = {};

    // Damage type modifier header
    if (options.type === "damageType") {
      this.extraHeaders.modifier = {
        label: game.i18n.localize("PF1.Modifier"),
        items: WorldConfig.getListVariables("damageTypes")
          .list.filter((o) => o.isModifier)
          .map((o) => {
            return {
              key: o.id,
              name: o.name,
              img: o.img,
            };
          }),
        selected: this.data.modifiers,
        multiSelect: true,
      };
    }
  }

  getData() {
    const data = super.getData();
    const options = this.widgetOptions;

    data.data = this.data;
    data.useLogicalOperator = options.useLogicalOperator === true;
    data.useValueField = options.useValueField === true;
    data.useDamageRule = options.useDamageRule === true;
    data.multiSelect = this.multiSelect === true;

    return data;
  }

  getResult() {
    if (this.widgetOptions.type === "damageType") {
      return new Data_DamageType({
        keys: this.selectedKeys,
        modifiers: this.extraHeaders.modifier.selected ?? [],
        logicalOperator: this.data.logicalOperator,
        rule: this.data.rule,
      });
    }

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
