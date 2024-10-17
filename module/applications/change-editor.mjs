import { getBuffTargetDictionary, getBuffTargets } from "@utils";
import { Widget_CategorizedItemPicker } from "./categorized-item-picker.mjs";
const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Change Editor
 *
 * @since PF1 v10
 */
export class ChangeEditor extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: ChangeEditor._updateObject,
      submitOnChange: true,
      submitOnClose: true,
      closeOnSubmit: false,
    },
    classes: ["pf1-v2", "change-editor"],
    window: {
      minimizable: false,
      resizable: false,
    },
    position: {
      width: 460,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/change-editor.hbs",
    },
  };

  /** @type {ItemChange} */
  change;

  constructor(change, options) {
    super(options);
    this.change = change;
  }

  /**
   * Replace ID link creation.
   *
   * Synchronized with Foundry v11.315
   *
   * @override
   */
  _createDocumentIdLink(html) {
    const title = html.find(".window-title");
    const label = game.i18n.localize("PF1.Change");
    const idLink = document.createElement("a");
    idLink.classList.add("document-id-link");
    idLink.setAttribute("alt", game.i18n.localize("PF1.Application.ChangeEditor.CopyId"));
    idLink.dataset.tooltip = `${label}: ${this.change.id}`;
    idLink.dataset.tooltipDirection = "UP";
    idLink.innerHTML = '<i class="fa-solid fa-passport"></i>';
    idLink.addEventListener("click", (event) => {
      event.preventDefault();
      game.clipboard.copyPlainText(this.item.id);
      ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", { label, type: "id", id: this.change.id }));
    });
    title.append(idLink);
  }

  get item() {
    return this.document;
  }

  get title() {
    let title = game.i18n.localize("PF1.Application.ChangeEditor.Label");
    title += ": " + this.item.name;
    if (this.actor) title += " – " + this.actor.name;
    return title;
  }

  get id() {
    return super.id + "-Change-" + this.change.id;
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const change = this.change,
      actor = this.actor,
      item = this.item;

    const buffTargets = getBuffTargets("buffs", { actor, item });
    const target = buffTargets[change.target];

    return {
      config: pf1.config,
      actor,
      item,
      change,
      isAdd: change.operator === "add",
      isSet: change.operator === "set",
      isValid: !!target,
      isValidType: !!pf1.config.bonusTypes[change.type],
      isValidOp: ["add", "set"].includes(change.operator),
      isDeferred: change.isDeferred,
      label: target?.label || change.target,
    };
  }

  _onChangeTargetControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Prepare categories and changes to display
    const categories = getBuffTargetDictionary("buffs", { actor: this.item.actor, item: this.item });

    // Sort specific categories
    const sortable = new Set(["skill"]);
    const lang = game.settings.get("core", "language");
    for (const category of categories) {
      if (!sortable.has(category.key)) continue;
      category.items.sort((a, b) => a.label.localeCompare(b.label, lang));
    }

    const part1 = this.change?.target?.split(".")[0];
    const category = pf1.config.buffTargets[part1]?.category ?? part1;

    // Show widget
    const w = new Widget_CategorizedItemPicker(
      { title: "PF1.Application.ChangeTargetSelector.Title", classes: ["change-target-selector"] },
      categories,
      (key) => {
        if (key) {
          this.change.update({ target: key });
        }
      },
      { category, item: this.change?.target }
    );
    w.render(true);
  }

  _openHelpBrowser(event) {
    event.preventDefault();
    const a = event.currentTarget;

    pf1.applications.helpBrowser.openUrl(a.dataset.url);
  }

  /**
   * Validate input formula for basic errors.
   *
   * @internal
   * @param {HTMLElement} el
   */
  async _validateFormula(el) {
    const formula = el.value;
    if (!formula) return;

    let roll;
    // Test if formula even works
    try {
      roll = Roll.create(formula);
      await roll.evaluate();
    } catch (e) {
      el.dataset.tooltip = e.message;
      el.setCustomValidity(e.message);
      return;
    }

    // Deterministic formulas must be deterministic
    if (el.classList.contains("deterministic")) {
      if (!roll.isDeterministic) {
        el.dataset.tooltip = "PF1.WarningFormulaMustBeDeterministic";
        el.setCustomValidity(game.i18n.localize("PF1.WarningFormulaMustBeDeterministic"));
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Attach event listeners to the rendered application form.
   *
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onRender(context, options) {
    // Modify changes
    this.element
      .querySelector(".target .change-target")
      .addEventListener("click", this._onChangeTargetControl.bind(this));

    // Open help browser
    this.element.querySelector("a.help-browser[data-url]").addEventListener("click", this._openHelpBrowser.bind(this));

    // Add warning about formulas
    this.element.querySelectorAll("input.formula").forEach(async (_, el) => this._validateFormula(el));

    this.element.reportValidity();
  }

  /**
   * @param {ItemChange} change - Change to modify
   * @param {object} options - Application options
   * @returns {Promise<void|ChangeEditor>} - Promise that resolves when the app is closed. Returns application instance if no new instance was created.
   */
  static async wait(change, options = {}) {
    const old = Object.values(ui.windows).find((app) => app.change === change && app instanceof this);
    if (old) {
      old.render(true, { focus: true });
      return old;
    }

    return new Promise((resolve) => {
      options.document = change.parent;
      const app = new this(change, options);
      app.resolve = resolve;
      app.render(true, { focus: true });
    });
  }

  /**
   * @override
   * @param {Event} event
   * @param {object} formData
   */
  static _updateObject(event, form, formData) {
    formData = formData.object;

    //if (!this.form.checkValidity()) return;
    const updateData = foundry.utils.expandObject(formData).change;
    this.change.update(updateData);
  }
}
