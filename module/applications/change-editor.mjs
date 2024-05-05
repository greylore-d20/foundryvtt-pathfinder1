import { getBuffTargetDictionary, getBuffTargets } from "@utils";
import { Widget_CategorizedItemPicker } from "./categorized-item-picker.mjs";

/**
 * Change Editor
 *
 * @since PF1 vNEXT
 */
export class ChangeEditor extends ItemSheet {
  /** @type {ItemChange} */
  change;

  constructor(change, options) {
    super(change.parent, options);
    this.change = change;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "pf1", "change-editor"],
      template: "systems/pf1/templates/apps/change-editor.hbs",
      submitOnChange: true,
      submitOnClose: true,
      closeOnSubmit: false,
      sheetConfig: false,
      width: 460,
      height: "auto",
    };
  }

  /**
   * @remarks Remove all header buttons except for close
   * @override
   */
  _getHeaderButtons() {
    return super._getHeaderButtons().filter((b) => b.class === "close");
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
      game.clipboard.copyPlainText(this.object.id);
      ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", { label, type: "id", id: this.change.id }));
    });
    title.append(idLink);
  }

  get title() {
    let title = game.i18n.localize("PF1.Application.ChangeEditor.Label");
    title += ": " + this.item.name;
    if (this.actor) title += " – " + this.actor.name;
    return title;
  }

  getData() {
    const change = this.change,
      actor = this.actor,
      item = this.item;

    const buffTargets = getBuffTargets(actor);
    const target = buffTargets[change.subTarget];

    const context = {
      config: pf1.config,
      actor,
      item,
      change,
      isAdd: change.operator === "add",
      isSet: change.operator === "set",
      isValid: !!target,
      isValidType: !!pf1.config.bonusTypes[change.modifier],
      isValidOp: ["add", "set"].includes(change.operator),
      isDeferred: change.isDeferred,
      label: target?.label || change.subTarget,
      isScript: change.operator === "script",
    };

    return context;
  }

  _onChangeTargetControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Prepare categories and changes to display
    const categories = getBuffTargetDictionary(this.item.actor);

    const part1 = this.change?.subTarget?.split(".")[0];
    const category = pf1.config.buffTargets[part1]?.category ?? part1;

    // Show widget
    const w = new Widget_CategorizedItemPicker(
      { title: "PF1.Application.ChangeTargetSelector.Title", classes: ["change-target-selector"] },
      categories,
      (key) => {
        if (key) {
          this.change.update({ subTarget: key });
        }
      },
      { category, item: this.change?.subTarget }
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

  async _onDelete(event) {
    event.preventDefault();

    this.close();

    this.change.delete();
  }

  async _onDuplicate(event) {
    event.preventDefault();

    const changes = this.item.toObject().system.changes ?? [];
    const old = changes.find((c) => c._id === this.change.id);
    if (old) {
      delete old._id;
      console.log("Creating:", old);
      return pf1.components.ItemChange.create([old], { parent: this.item });
    } else {
      console.log("Old change not found");
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Buttons
    html.find(".buttons button.delete").click(this._onDelete.bind(this));
    html.find(".buttons button.duplicate").click(this._onDuplicate.bind(this));

    // Modify changes
    html.find(".target .change-target").click(this._onChangeTargetControl.bind(this));

    // Open help browser
    html.find("a.help-browser[data-url]").click(this._openHelpBrowser.bind(this));

    // Add warning about formulas
    html.find("input.formula").each(async (_, el) => this._validateFormula(el));

    this.form.reportValidity();
  }

  /**
   * @param {ItemChange} change - Change to modify
   * @param {object} options - Application options
   * @returns {Promise<void|ChangeEditor>} - Promise that resolves when the app is closed. Returns application instance if no new instance was created.
   */
  static async wait(change, options) {
    const old = Object.values(ui.windows).find((app) => app.change === change && app instanceof this);
    if (old) {
      old.render(true, { focus: true });
      return old;
    }

    return new Promise((resolve) => {
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
  _updateObject(event, formData) {
    //if (!this.form.checkValidity()) return;
    const updateData = foundry.utils.expandObject(formData).change;
    this.change.update(updateData);
  }
}
