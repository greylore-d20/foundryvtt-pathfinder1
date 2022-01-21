export class AttackDialog extends Application {
  constructor(object, rollData = null, options = {}) {
    super(options);

    this.object = object;

    this.rollData = rollData ? rollData : this.object.getRollData();

    this.base = {
      cl: this.rollData.cl ?? 0,
      sl: this.rollData.sl ?? 0,
    };
    this.flags = {
      "primary-attack": this.object.data.data.primaryAttack === true,
      "cl-check": this.object.data.data.clCheck === true,
      "measure-template": true,
    };
    this.attributes = {
      d20: this.rollData.d20 ?? "",
      "attack-bonus": "",
      "damage-bonus": "",
      "cl-offset": "0",
      "sl-offset": "0",
      rollMode: game.settings.get("core", "rollMode"),
      "damage-ability-multiplier": this.rollData.item?.ability?.damageMult ?? 1,
      held: this.rollData.item?.held ?? "normal",
    };
    this.conditionals = {};
    for (const [idx, cData] of Object.entries(this.object.data.data.conditionals ?? {})) {
      this.conditionals[`conditional.${idx}`] = cData.default === true;
    }

    // Callback for AttackDialog.show()
    this._callbacks = {
      resolve: null,
      reject: null,
    };
  }

  get title() {
    return `Use: ${this.object.name}`;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/apps/attack-roll-dialog.hbs",
      classes: ["pf1", "attack-dialog"],
      width: 440,
      height: "auto",
      closeOnSubmit: true,
      sheetConfig: false,
      submitOnChange: false,
      submitOnClose: false,
    });
  }

  static get defaultAttack() {
    return {
      name: "",
      bonus: 0,
    };
  }

  getData() {
    return {
      data: this.rollData,
      item: this.object.data.data,
      config: CONFIG.PF1,
      rollMode: game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes,
      hasAttack: this.object.hasAttack,
      hasDamage: this.object.hasDamage,
      hasDamageAbility: this.object.data.data.ability?.damage ?? "" !== "",
      isNaturalAttack: this.object.data.data.attackType === "natural",
      isWeaponAttack: this.object.data.data.attackType === "weapon",
      isMeleeWeaponAttackAction: this.object.data.data.actionType === "mwak",
      isRangedWeaponAttackAction: this.object.data.data.actionType === "rwak",
      isAttack: this.object.type === "attack",
      isWeapon: this.object.type === "weapon",
      isSpell: this.object.type === "spell",
      hasTemplate: this.object.hasTemplate,
      attacks: this.getAttacks(),
      flags: this.flags,
      attributes: this.attributes,
      conditionals: this.conditionals,
    };
  }

  activateListeners(html) {
    // Form changing
    html.find(`.flags input[type="checkbox"]`).on("change", this._onToggleFlag.bind(this));
    html.find(`input.attribute`).on("change", this._onChangeAttribute.bind(this));
    html.find(`input[type="checkbox"][name="concentration"]`).on("change", this._onToggleFlag.bind(this));
    html.find(`input[type="checkbox"][name="cl-check"]`).on("change", this._onToggleFlag.bind(this));
    html.find(`input[type="checkbox"][name="measure-template"]`).on("change", this._onToggleFlag.bind(this));
    html.find(`select`).on("change", this._onSelectChange.bind(this));
    html.find(`.conditionals input[type="checkbox"]`).on("change", this._onToggleConditional.bind(this));

    // Button hover
    html.find(`button[name="attack_single"]`).on("mouseenter", this._hideExtraAttacks.bind(this));
    html.find(`button[name="attack_single"]`).on("mouseleave", this._showExtraAttacks.bind(this));

    // Button press
    html.find(`button[name="attack_single"]`).on("click", this._onAttackSingle.bind(this));
    html.find(`button[name="attack_full"]`).on("click", this._onAttackFull.bind(this));
  }

  _onSelectChange(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    this.attributes[elem.name] = elem.options[elem.selectedIndex].value;
    this.render();
  }

  _hideExtraAttacks(event) {
    const elems = this.element.find(".attacks .attack").filter((index, elem) => parseInt(elem.dataset.index) > 0);
    elems.addClass("disabled");
  }

  _showExtraAttacks(event) {
    this.element.find(".attacks .attack").removeClass("disabled");
  }

  _onToggleFlag(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    this.flags[elem.name] = elem.checked === true;
    this.render();
  }

  _onToggleConditional(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    this.conditionals[elem.name] = elem.checked === true;
    this.render();
  }

  _onChangeAttribute(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    this.attributes[elem.name] = elem.value;

    // Also change roll data, if appropriate
    switch (elem.name) {
      case "cl-offset":
        this.rollData.cl = this.base.cl + parseInt(elem.value);
        break;
      case "sl-offset":
        this.rollData.sl = this.base.sl + parseInt(elem.value);
        break;
      case "damage-ability-multiplier":
        setProperty(this.rollData, "item.ability.damageMult", elem.value);
        break;
      case "held":
        setProperty(this.rollData, "item.held", elem.value);
        break;
    }

    this.render();
  }

  getAttacks() {
    const result = [];

    // Get normal attack
    result.push(
      mergeObject(this.constructor.defaultAttack, {
        name: this.object.data.data.attackName || game.i18n.format("PF1.FormulaAttack", { 0: 1 }),
      })
    );

    // Get static extra attacks
    for (const atk of this.object.data.data.attackParts ?? []) {
      result.push(
        mergeObject(this.constructor.defaultAttack, {
          name: atk[1],
          bonus: RollPF.safeTotal(atk[0], this.rollData),
        })
      );
    }

    // Get formulaic extra attacks
    const attackFormulae = {
      count: this.object.data.data.formulaicAttacks?.count?.formula ?? null,
      bonus: this.object.data.data.formulaicAttacks?.bonus?.formula ?? "0",
    };
    const atkCount = RollPF.safeTotal(attackFormulae.count, this.rollData) || 0;
    for (let a = 0; a < atkCount; a++) {
      this.rollData.formulaicAttack = a + 1;
      const bonus = RollPF.safeTotal(attackFormulae.bonus, this.rollData);
      const name = game.i18n.format(this.object.data.data.formulaicAttacks?.label || "PF1.FormulaAttack", { 0: a + 2 });
      result.push(
        mergeObject(this.constructor.defaultAttack, {
          name,
          bonus,
        })
      );
    }
    if (this.rollData.formulaicAttack !== undefined) delete this.rollData.formulaicAttack;

    // Add haste attack
    if (this.flags["haste-attack"] === true) {
      result.push(
        mergeObject(this.constructor.defaultAttack, {
          name: game.i18n.localize("PF1.Haste"),
          bonus: 0,
        })
      );
    }

    return result;
  }

  getFormAttacks() {
    const result = [];

    const elems = this.element.find(".attacks .attack");
    for (const elem of elems) {
      result.push({
        name: elem.querySelector(".name").value,
        bonus: elem.querySelector(".bonus").value,
      });
    }

    return result;
  }

  _onAttackSingle(event) {
    event.preventDefault();

    const attacks = this.getFormAttacks();
    return this.doAttack(attacks.slice(0, 1), false);
  }

  _onAttackFull(event) {
    event.preventDefault();

    const attacks = this.getFormAttacks();
    return this.doAttack(attacks, true);
  }

  doAttack(attacks, fullAttack = true) {
    this._callbacks.resolve({ fullAttack, attacks, html: this.element });
    this._callbacks.resolve = null;
    this.close();
  }

  async close(options = {}) {
    if (this._callbacks.resolve != null) this._callbacks.resolve();
    return super.close(options);
  }

  show() {
    return new Promise((resolve, reject) => {
      this.render(true);

      this._callbacks.resolve = (...args) => {
        resolve(...args);
      };
      this._callbacks.reject = (...args) => {
        reject(...args);
      };
    });
  }
}
