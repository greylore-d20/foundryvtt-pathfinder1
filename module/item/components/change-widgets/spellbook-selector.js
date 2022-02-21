import { ChangeWidget_Base } from "./base.js";

export class ChangeWidget_SpellbookSelector extends ChangeWidget_Base {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/items/change-widgets/spellbook-selector.hbs",
      classes: ["pf1", "change-widget", "spellbook-selector"],
      width: 400,
    });
  }

  activateListeners(html) {
    html.find(".spellbooks a.spellbook").on("click", this._onClickSpellbook.bind(this));
    html.find("input.formula").on("change", this._onChangeFormula.bind(this));
  }

  _onClickSpellbook(event) {
    event.preventDefault();
    const a = event.currentTarget;

    this._data.spellbook = a.dataset.value;
    this.render();
  }

  _onChangeFormula(event) {
    event.preventDefault();
    const a = event.currentTarget;

    this._data.formula = a.value;
  }

  async getData() {
    const spellbookData = game.system.model.Actor.character.attributes.spells.spellbooks;
    const spellbookInfo = this.actor?.getSpellbookInfo();
    const spellbookNames = Object.entries(spellbookData).reduce((cur, o) => {
      const k = o[0];
      cur[k] = spellbookInfo?.[k]?.name || o[1].name;

      return cur;
    }, {});

    return {
      data: this._data,
      spellbooks: spellbookNames,
    };
  }

  static async getBanner(change) {
    const data = JSON.parse(change.formula);
    const spellbook = data.spellbook;
    const spellbookInfo = change.parent.actor?.getSpellbookInfo();
    const spellbookName =
      spellbook === "_all" ? game.i18n.localize("PF1.All") : spellbookInfo?.[spellbook]?.name || spellbook;

    return renderTemplate("systems/pf1/templates/items/change-widgets/banners/spellbook-selector.hbs", {
      data,
      spellbookName,
      value: await RollPF.safeTotal(data.formula || "0", change.parent.getRollData()),
    });
  }

  static get defaultValue() {
    return {
      spellbook: "_all",
      formula: "0",
    };
  }

  static getBaseChangeVariable(change, data) {
    switch (change.subTarget) {
      case "concentration": {
        return "data.attributes.spells.%1.concentration.changeBonus";
      }
    }

    return null;
  }

  static getChangeTargets(change, data) {
    const targetVariables = [];
    const actor = change.parent.actor;
    if (!actor) return;
    const spellbookKeys = Object.keys(actor.data.data.attributes.spells.spellbooks ?? {});

    const baseVariable = this.getBaseChangeVariable(change, data);
    if (baseVariable == null) {
      console.error(`baseVariable is null in change`, change, data);
      return;
    }

    if (data.spellbook === "_all") {
      spellbookKeys.forEach((k) => {
        targetVariables.push(baseVariable.replaceAll("%1", k));
      });
    } else {
      targetVariables.push(baseVariable.replaceAll("%1", data.spellbook));
    }

    return targetVariables;
  }

  static getValue(change, data) {
    const value = RollPF.safeTotal(data.formula, change.parent.getRollData());
    return value;
  }
}
