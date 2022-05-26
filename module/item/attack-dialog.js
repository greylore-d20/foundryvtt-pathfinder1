export class AttackDialog extends Application {
  constructor(object, rollData = null, options = {}) {
    super(options);

    this.object = object;

    this.rollData = rollData ? rollData : this.object.getRollData();

    this.initAmmoUsage();
    this.initAttacks();

    this.base = {
      cl: this.rollData.cl ?? 0,
      sl: this.rollData.sl ?? 0,
    };
    this.flags = {
      "primary-attack": this.object.item.data.data.primaryAttack === true,
      "cl-check": this.object.data.clCheck === true,
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
    for (const [idx, cData] of Object.entries(this.object.data.conditionals ?? {})) {
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
      ammo: null,
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
      hasDamageAbility: this.object.data.ability?.damage ?? "" !== "",
      isNaturalAttack: this.object.item.data.data.attackType === "natural",
      isWeaponAttack: this.object.item.data.data.attackType === "weapon",
      isMeleeWeaponAttackAction: this.object.data.actionType === "mwak",
      isRangedWeaponAttackAction: this.object.data.actionType === "rwak",
      isAttack: this.object.item.type === "attack",
      isWeapon: this.object.item.type === "weapon",
      isSpell: this.object.item.type === "spell",
      isFeat: this.object.item.type === "feat",
      hasTemplate: this.object.hasTemplate,
      attacks: this.attacks,
      flags: this.flags,
      attributes: this.attributes,
      conditionals: this.conditionals,
      usesAmmo: this.object.data.usesAmmo,
      ammo: this.getAmmo(),
    };
  }

  getAmmo() {
    const actor = this.object.actor;
    const ammo = actor.items.filter(this._filterAmmo.bind(this));

    return ammo.map((o) => {
      return {
        data: o.data,
        isDefault: this.object.getFlag("pf1", "defaultAmmo") === o.id,
      };
    });
  }

  _filterAmmo(item) {
    if (!(item.type === "loot" && item.data.data.subType === "ammo")) return false;
    if (item.data.data.quantity <= 0) return false;

    const weaponAmmoType = this.object.data.data.ammoType;
    const ammoType = item.extraType;
    if (!ammoType) return true;
    if (weaponAmmoType === ammoType) return true;
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

    // Dropdown menu
    html.find(".ammo-select").on("click", this._onAmmoSelectClick.bind(this));
    html.find(".ammo-select .ammo-item .controls a").on("click", this._onAmmoControlClick.bind(this));
    html.find(".ammo-select .ammo-item").on("click", this._onAmmoClick.bind(this));
    html.on("click", this._unfocusElements.bind(this));

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

    // Add or remove haste, rapid-shot or manyshot attack
    if (["haste-attack", "rapid-shot", "manyshot"].includes(elem.name)) {
      if (elem.checked) {
        const translationString = {
          "haste-attack": "PF1.Haste",
          "rapid-shot": "PF1.RapidShot",
          manyshot: "PF1.Manyshot",
        };

        // Correlate manyshot with the first attack, add the others at the end
        const place = elem.name === "manyshot" ? 1 : this.attacks.length;

        this.attacks.splice(
          place,
          0,
          mergeObject(this.constructor.defaultAttack, {
            id: elem.name,
            name: game.i18n.localize(translationString[elem.name]),
            bonus: 0,
          })
        );
        this.setAttackAmmo(place, this.object.item.getFlag("pf1", "defaultAmmo"));
      } else {
        this.attacks = this.attacks.filter((o) => o.id !== elem.name);
      }
    }

    this.render();
  }

  _onToggleConditional(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    this.conditionals[elem.name] = elem.checked === true;
    this.render();
  }

  _onAmmoSelectClick(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    const listElem = elem.querySelector("ul");

    // Filter to NOT act when clicking on the list child element
    if (!event.target.closest("ul")) {
      // Set classes for CSS
      listElem.classList.toggle("open");
      const isOpen = listElem.classList.contains("open");
      if (isOpen) elem.classList.add("focus");
      else elem.classList.remove("focus");
    }
  }

  _onAmmoClick(event) {
    const elem = event.target;
    // Don't do anything if this click was actually on its controls
    if (elem.closest(".controls") && !elem.classList.contains("controls")) return;

    event.preventDefault();
    const ammoId = elem.closest(".ammo-item").dataset.id;
    const attackIndex = parseInt(elem.closest(".attack").dataset.index);

    // Set ammo
    this.setAttackAmmo(attackIndex, ammoId === "null" ? null : ammoId);
    this.render();
  }

  async _onAmmoControlClick(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    const ammoId = elem.closest(".ammo-item").dataset.id;
    switch (elem.dataset.type) {
      case "set-default":
        if (ammoId === "null") await this.object.unsetFlag("pf1", "defaultAmmo");
        else await this.object.setFlag("pf1", "defaultAmmo", ammoId);
        // Apply CSS class, since we can't do a render in here and keep the dropdown menu open
        elem
          .closest("ul")
          .querySelectorAll(".ammo-item")
          .forEach((o) => o.classList.remove("default"));
        if (ammoId !== "null") elem.closest(".ammo-item").classList.add("default");
        break;
      case "set-all":
        for (let a = 0; a < this.attacks.length; a++) {
          this.setAttackAmmo(a, ammoId);
        }
        this.render();
    }
  }

  _unfocusElements(event) {
    // Close ammo select
    if (this.element[0].querySelector(".ammo-select") != null && !event.target.closest(".ammo-select")) {
      const elem = this.element[0].querySelector(".ammo-select");
      elem.classList.remove("focus");
      elem.querySelector("ul").classList.remove("open");
    }
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

  initAttacks() {
    const result = [];

    // Get normal attack
    result.push(
      mergeObject(this.constructor.defaultAttack, {
        name: this.object.data.attackName || game.i18n.format("PF1.FormulaAttack", { 0: 1 }),
      })
    );

    // Get static extra attacks
    let curAttackNumber = 1;
    for (const atk of this.object.data.attackParts ?? []) {
      result.push(
        mergeObject(this.constructor.defaultAttack, {
          name: atk[1] || game.i18n.format("PF1.FormulaAttack", { 0: curAttackNumber + 1 }),
          bonus: RollPF.safeTotal(atk[0], this.rollData),
        })
      );
      curAttackNumber++;
    }

    // Get formulaic extra attacks
    const attackFormulae = {
      count: this.object.data.formulaicAttacks?.count?.formula ?? null,
      bonus: this.object.data.formulaicAttacks?.bonus?.formula || "0",
    };
    const atkCount = RollPF.safeTotal(attackFormulae.count, this.rollData) || 0;
    for (let a = 0; a < atkCount; a++) {
      this.rollData.formulaicAttack = a + 1;
      const bonus = RollPF.safeTotal(attackFormulae.bonus, this.rollData);
      const name = game.i18n.format(this.object.data.formulaicAttacks?.label || "PF1.FormulaAttack", {
        0: curAttackNumber + 1,
      });
      result.push(
        mergeObject(this.constructor.defaultAttack, {
          name,
          bonus,
        })
      );
      curAttackNumber++;
    }
    if (this.rollData.formulaicAttack !== undefined) delete this.rollData.formulaicAttack;

    this.attacks = result;

    // Set ammo usage
    const ammoId = this.object.item.getFlag("pf1", "defaultAmmo");
    if (ammoId != null) {
      for (let a = 0; a < this.attacks.length; a++) {
        this.setAttackAmmo(a, ammoId);
      }
    }
  }

  // Initializes ammo usage, which help avoid being able to overuse ammo
  initAmmoUsage() {
    this.ammoUsage = this.getAmmo().reduce((cur, o) => {
      cur[o.data._id] = {
        quantity: o.data.data.quantity,
        used: 0,
      };

      return cur;
    }, {});
  }

  getFormAttacks() {
    return this.attacks.map((o) => {
      return {
        id: o.id,
        label: o.name,
        attackBonus: o.bonus,
        ammo: o.ammo?.data._id,
      };
    });
  }

  setAttackAmmo(attackIndex, ammoId = null) {
    if (!this.object.data.usesAmmo) return;

    const atk = this.attacks[attackIndex];
    const curAmmo = atk.ammo?.data._id;
    const ammoItem = ammoId ? this.object.actor.items.get(ammoId) : null;
    const abundant = ammoItem?.data.flags?.pf1?.abundant ?? false;

    // Check if ammo exists
    if (ammoId && this.ammoUsage[ammoId] == null) ammoId = null;

    if (!ammoId) {
      atk.ammo = null;
      // Remove from ammo usage tracker
      if (curAmmo != null) {
        this.ammoUsage[curAmmo].used--;
      }
      return;
    }

    // Don't allow overusage
    if (!abundant && this.ammoUsage[ammoId].used >= this.ammoUsage[ammoId].quantity) return;

    atk.ammo = this.getAmmo().find((o) => o.data._id === ammoId);
    // Add to ammo usage tracker
    if (curAmmo != null) {
      this.ammoUsage[curAmmo].used--;
    }
    this.ammoUsage[ammoId].used++;
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
